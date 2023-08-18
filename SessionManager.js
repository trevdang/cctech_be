const crypto = require("crypto");

class SessionError extends Error {}

function SessionManager() {
  const CookieMaxAgeMs = 600000;

  const sessions = {};

  this.createSession = (response, username, maxAge = CookieMaxAgeMs) => {
    const token = crypto.randomBytes(127).toString("hex");
    const expireTime = Date.now();
    if (maxAge) {
      expireTime += maxAge;
    }

    const sessionObject = {
      username: username,
      timeCreated: Date.now(),
      expireTime: expireTime,
    };

    sessions[token] = sessionObject;

    response.cookie("cctech_be", token, { maxAge: maxAge });
    setTimeout(() => {
      delete sessions[token], maxAge;
    });
  };

  this.deleteSession = (request) => {
    delete request["username"];
    delete sessions[request["session"]];
    delete request["session"];
  };

  this.middleware = (request, response, next) => {
    const cookieHeader = request.headers["cookie"];
    if (!cookieHeader) {
      next(new SessionError("Cookie does not exist"));
      return;
    } else {
      if (cookieHeader.includes(";")) {
        const noColons = cookieHeader.split("; ");
        const parsedCookieHeader = noColons[0].split("=");
        const cookieVal = parsedCookieHeader[1];

        if (sessions[cookieVal]) {
          request["username"] = sessions[cookieVal]["username"];
          request["session"] = cookieVal;
          next();
          return;
        } else {
          next(
            new SessionError(
              "Cookie token could not be found in sessions object"
            )
          );
          return;
        }
      } else {
        const parsedCookieHeader = cookieHeader.split("=");
        const cookieVal = parsedCookieHeader[1];
        if (sessions[cookieVal]) {
          request["username"] = sessions[cookieVal]["username"];
          request["session"] = cookieVal;
          next();
          return;
        } else {
          next(
            new SessionError(
              "Cookie token could not be found in sessions object"
            )
          );
          return;
        }
      }
    }
  };

  /**
   *
   * @param {string} token to get this use req.headers["cookie"] to access the cookieHeader and parse it with .split("=")
   * @returns the username of the user's token
   */
  this.getUsername = (token) =>
    token in sessions ? sessions[token].username : null;
}

SessionManager.Error = SessionError;

module.exports = SessionManager;
