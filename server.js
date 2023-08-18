const path = require("path");
const express = require("express");

const Database = require("./Database.js");
const SessionManager = require("./SessionManager.js");

const crypto = require("crypto");

function logRequest(req, res, next) {
  console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
  next();
}

const host = "localhost";
const port = 3000;
const clientApp = path.join(__dirname, "client");

let app = express();

app.use(express.json()); // to parse application/json
app.use(express.urlencoded({ extended: true })); // to parse application/x-www-form-urlencoded
app.use(logRequest); // logging for debug

var db = new Database("mongodb://localhost:27017", "cctech-be");
var sessionManager = new SessionManager();

// -------------------------- MIDDLEWARE LOGIN and SETUP -----------------------------

app.use(
  "/login",
  express.static(clientApp + "/login.html", { extensions: ["html"] })
);

app.route("/login").post(function (req, res, next) {
  const reqBody = JSON.parse(JSON.stringify(req.body));
  db.getUser(reqBody["username"]).then((value) => {
    if (value) {
      if (isCorrectPassword(reqBody["password"], value["password"])) {
        sessionManager.createSession(res, reqBody["username"]);
        res.redirect("/");
      } else {
        res.redirect("/login");
      }
    } else {
      res.redirect("/login");
    }
  });
});

app.use(sessionManager.middleware);

app.use("/", express.static(clientApp, { extensions: ["html"] }));
app.listen(port, () => {
  console.log(
    `${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`
  );
});

// -------------------------- START of REST APIs -----------------------------

// GET request to get all tasks in an array form
app.route("/tasks").get(function (req, res, next) {
  // Assumption: GET request does not contain anything in its query with 'search' key to perform task filtering
  if (!req.query["search"]) {
    db.getTasks().then((value) => {
      if (value) {
        res.status(200);
        res.send(value);
      } else {
        res.status(404);
        res.send(value);
      }
    });
  }
  // Assumption: GET request contains 'search' key in its query to perform task filtering on the task name
  else {
    db.getTasks().then((value) => {
      if (value) {
        const filterString = req.query["search"];
        const taskFilterList = [];
        if (typeof filterString === "string") {
          for (let i = 0; i < value.length; i++) {
            if (
              value["name"].toLowerCase().includes(filterString.toLowerCase())
            ) {
              taskFilterList.push(value);
            }
          }
        }
        res.status(200);
        res.send(taskFilterList);
      } else {
        res.status(404);
        res.send(value);
      }
    });
  }
});

// GET request to get a single task object
app.route("/tasks/:task_id").get(function (req, res, next) {
  db.getTask(req.params["task_id"]).then((value) => {
    if (value) {
      res.status(200);
      res.send(value);
    } else {
      res.status(404);
      res.send(value);
    }
  });
});

// POST request to add a single task record to the database
app.route("/tasks").post(function (req, res, next) {
  let reqBody = JSON.parse(JSON.stringify(req.body));
  if (!reqBody["name"] || !reqBody["duration"]) {
    res.status(400);
    if (!reqBody["name"]) res.send("Error: no 'name' field");
    if (!reqBody["duration"]) res.send("Error: no 'duration' field");
  } else {
    const cookieHeader = req.headers["cookie"];
    if (!cookieHeader) {
      res.status(404);
      res.send(cookieHeader + " does not exist");
    } else {
      let parsedCookieHeader = cookieHeader.split("=");
      if (!sessionManager.getUsername(parsedCookieHeader[1])) {
        res.status(404);
        res.send(
          "Could not find username with cookie: " + parsedCookieHeader[1]
        );
      } else {
        const task = {};
        task["name"] = reqBody["name"];
        task["duration"] = reqBody["duration"];
        task["finished"] = false;
        task["author"] = sessionManager.getUsername(
          parsedCookieHeader[1]
        ).username;
        db.addTask(task).then((value) => {
          if (value) {
            res.status(200);
            res.send(value);
          } else {
            res.status(404);
            res.send(value);
          }
        });
      }
    }
  }
});

// DELETE request to delete a task record from the database
app.route("/tasks/:task_id").delete(function (req, res, next) {
  db.getTask(req.params["task_id"]).then((value) => {
    if (value) {
      let parsedCookieHeader = getParsedCookieHeader(req, res);
      if (!sessionManager.getUsername(parsedCookieHeader)) {
        res.status(404);
        res.send("Could not find username with cookie: " + parsedCookieHeader);
      } else {
        const username =
          sessionManager.getUsername(parsedCookieHeader).username;
        if (value["author"] === username) {
          db.deleteTask(req.params["task_id"]).then((value) => {
            if (value) {
              res.status(200);
              res.send(value);
            } else {
              res.status(404);
              res.send(value);
            }
          });
        } else {
          res.status(400);
          res.send(
            username + " is not the author of this task, cannot be deleted"
          );
        }
      }
    } else {
      res.status(404);
      res.send("Task: " + value + " does not exist");
    }
  });
});

// PUT request to update a task record in the database
app.route("/tasks/:task_id").put(function (req, res, next) {
  db.getTask(req.params["task_id"]).then((value) => {
    if (value) {
      let parsedCookieHeader = getParsedCookieHeader(req, res);
      if (!sessionManager.getUsername(parsedCookieHeader)) {
        res.status(404);
        res.send("Could not find username with cookie: " + parsedCookieHeader);
      } else {
        const username =
          sessionManager.getUsername(parsedCookieHeader).username;
        if (value["author"] === username) {
          const reqBody = JSON.parse(JSON.stringify(req.body));
          if (
            "name" in reqBody ||
            "duration" in reqBody ||
            "finished" in reqBody
          ) {
            db.updateTask(req.params["task_id"], reqBody).then((value) => {
              if (value) {
                res.status(200);
                res.send(value);
              } else {
                res.status(400);
                res.send(value);
              }
            });
          } else {
            res.status(404);
            res.send(
              "Could not find name or duration or finished key in object"
            );
          }
        } else {
          res.status(400);
          res.send(
            username + " is not the author of this task, cannot be updated"
          );
        }
      }
    } else {
      res.status(404);
      res.send("Task: " + value + " does not exist");
    }
  });
});

// -------------------------- ADDITIONAL FUNCTIONS -----------------------------

function getParsedCookieHeader(req, res) {
  const cookieHeader = req.headers["cookie"];
  if (!cookieHeader) {
    res.status(404);
    res.send(cookieHeader + " does not exist");
  } else {
    const parsedCookieHeader = cookieHeader.split("=");
    return parsedCookieHeader[1];
  }
}

function isCorrectPassword(password, saltedHash) {
  const salt = saltedHash.substring(0, 20);
  const saltedPassword = password.concat(salt);

  const shaHash = crypto
    .createHash("sha256")
    .update(saltedPassword)
    .digest("base64");
  const saltAndHash = salt.concat(shaHash);

  if (saltAndHash == saltedHash) {
    return true;
  } else {
    return false;
  }
}
