const { MongoClient, ObjectID, ObjectId } = require("mongodb"); // require the mongodb driver
const { join } = require("path");

function Database(mongoUrl, dbName) {
  if (!(this instanceof Database)) return new Database(monogUrl, dbName);
  this.connected = new Promise((resolve, reject) => {
    MongoClient.connect(
      mongoUrl,
      {
        useNewUrlParser: true,
      },
      (err, client) => {
        if (err) reject(err);
        else {
          console.log("[MongoClient] Connected to: " + mongoUrl + "/" + dbName);
          resolve(client.db(dbName));
        }
      }
    );
  });
  this.status = () =>
    this.connected.then(
      (db) => ({ error: null, url: mongoUrl, db: dbName }),
      (err) => ({ error: err })
    );
}

/**
 *
 * @returns an array of todoTasks (i.e. an array of objects)
 */
Database.prototype.getTasks = function () {
  return this.connected.then((db) => {
    new Promise((resolve, reject) => {
      if (db) {
        db.collection("todo")
          .find({})
          .toArray((err, todos) => {
            if (err) {
              reject(err);
            } else {
              const todoTasks = [];
              for (let i = 0; i < todos.length; i++) {
                todoTasks.push(todos[i]);
              }
              resolve(todoTasks);
            }
          });
      } else {
        reject(new Error(db + " does not exist"));
      }
    });
  });
};

/**
 *
 * @param {string} task_id is a task string id
 * @returns a single todo task (i.e. a singular object)
 */
Database.prototype.getTask = function (task_id) {
  return this.connected.then((db) => {
    new Promise((resolve, reject) => {
      if (db) {
        db.collection("todo")
          .find({})
          .toArray((err, todos) => {
            if (err) {
              reject(err);
            } else {
              for (let i = 0; i < todos.length; i++) {
                if (todos[i].task_id === task_id) {
                  resolve(todos[i]);
                  break;
                }
              }
              resolve(null);
            }
          });
      } else {
        reject(new Error(db + " does not exist"));
      }
    });
  });
};

/**
 *
 * @param {object} task is an object containing { name, duration, finished, author } as keys
 * @returns the newly created record
 */
Database.prototype.addTask = function (task) {
  return this.connected.then((db) => {
    new Promise((resolve, reject) => {
      if (db) {
        db.collection("todo").insertOne(task, (err, res) => {
          if (err) reject(err);
          else {
            if (task["name"]) {
              if (typeof res["insertedId"] === "object") {
                task["task_id"] = res["insertedId"].toString();
              } else {
                task["task_id"] = res["insertedId"];
              }
              resolve(task);
            } else {
              reject(new Error(task["name"] + " has no name parameter"));
            }
          }
        });
      } else {
        reject(new Error(db + " does not exist"));
      }
    });
  });
};

/**
 *
 * @param {string} task_id is a task string id
 * @returns deleted record
 */
Database.prototype.deleteTask = function (task_id) {
  return this.connected.then((db) => {
    new Promise((resolve, reject) => {
      if (db) {
        const query = { task_id: task_id };
        db.collection("todo").deleteOne(query, (err, res) => {
          if (err) reject(err);
          else {
            resolve(res);
          }
        });
      } else {
        reject(new Error(db + " does not exist"));
      }
    });
  });
};

/**
 *
 * @param {string} task_id is a task string id
 * @param {object} info is an object containing at least one of these parameters { name, duration, finished }
 * @returns updated record
 */
Database.prototype.updateTask = function (task_id, info) {
  return this.connected.then((db) => {
    new Promise((resolve, reject) => {
      if (db) {
        const options = { upsert: false };
        const query = { task_id: task_id };
        const updateInfo = { $set: info };
        db.collection("todo").updateOne(
          query,
          updateInfo,
          options,
          (err, res) => {
            if (err) reject(err);
            else {
              resolve(res);
            }
          }
        );
      } else {
        reject(new Error(db + " does not exist"));
      }
    });
  });
};

/**
 *
 * @param {string} username
 * @returns desired user object back to client
 */
Database.prototype.getUser = function (username) {
  return this.connected.then((db) => {
    new Promise((resolve, reject) => {
      if (db) {
        resolve(db.collection("users").findOne({ username: username }));
      } else {
        reject(new Error(db + " does not exist"));
      }
    });
  });
};

module.exports = Database;
