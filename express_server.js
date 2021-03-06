const express = require("express");
const app = express();
const PORT = 8080;
const bodyParser = require("body-parser");
const cookieSession = require("cookie-session");
const bcrypt = require("bcrypt");
const methodOverride = require("method-override");
const dateFormat = require("dateformat");
app.use(methodOverride("_method"));
app.use(cookieSession({
  name: "session",
  keys: ["login", "uniqueVisitor"],
}));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/views")); // allows css in expressjs
const saltRounds = 10;

// Users database with sample users
let users = {
  "x5RsDv": {
    id: "x5RsDv",
    email: "user1@example.com",
    password: "$2b$10$LH..m8FREYZowLgq6jys5uMKr4nZ5dTI.O8holfs4O1QgqnAK1Fs2"
  },
  "ui98nm": {
    id: "ui98nm",
    email: "user2@example.com",
    password: "$2b$10$TVqjs.52rX29kJwYRFjcyOO7gbiiY0yTYG6HMMufUPtXh7iUV9VBW"
  }
};

// url database with sample urls
let urlDatabase = {
  "b2xVn2": {
    short: "b2xVn2",
    long: "http://www.lighthouselabs.ca",
    id: "x5RsDv",
    clicks: 0,
    visitors: [],
    visits: []
  },
  "9sm5xK": {
    short: "9sm5xK",
    long: "http://www.google.com",
    id: "ui98nm",
    clicks: 0,
    visitors: [],
    visits: []
  }
};

// home redirects
app.get("/", (req, res) => {
  const login = req.session.userId;
  if (login) {
    res.redirect("/urls");
  } else {
    res.redirect("/login");
  }
});

// render registration page
app.get("/register", (req, res) => {
  const login = req.session.userId;
  if (login) {
    res.redirect("/urls");
  } else {
    let templateVars = {
      urls: urlDatabase,
      userId: req.session.userId,
      user: users[req.session.userId]
    };
    res.render("urls_register", templateVars);
  }
});

// create new user registration, add to users object
app.post("/register", (req, res) => {
  const newID = generateRandomString();
  let newUserObj = {};
  newUserObj.id = newID;
  if (!req.body.email.trim()) { // no email
    res.status(400).send("<h2>Error 400: Bad Request</h2><h3>Email and Password fields cannot be empty!<h3>");
    return;
  } else {
    newUserObj.email = req.body.email;
  }
  if (!req.body.password.trim()) { // no password
    res.status(400).send("<h2>Error 400: Bad Request</h2><h3>Email and Password fields cannot be empty!<h3>");
    return;
  } else {
    newUserObj.password = bcrypt.hashSync(req.body.password, saltRounds);
  }
  for (let key in users) { // duplicate email
    if (users[key].email === req.body.email) {
      res.status(400).send("<h2>Error 400: Bad Request</h2><h3>Email already exists!<h3>");
      return;
    }
  }
  users[newID] = newUserObj;
  req.session.userId = newID;
  res.redirect("/urls");
});

// render login page
app.get("/login", (req, res) => {
  const login = req.session.userId;
  if (login) {
    res.redirect("/urls");
  } else {
    let templateVars = {
      urls: urlDatabase,
      userId: req.session.userId,
      user: users[req.session.userId]
    };
    res.render("urls_login", templateVars);
  }
});

// create login cookie, redirect to urls page
app.post("/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;
  let userid = "";
  for (let key in users) {
    if (users[key].email === email) { // email in database
      if (bcrypt.compareSync(password, users[key].password)) { // password in database
        userid = users[key].id;
      }
    }
  }
  if (!userid) {
    res.status(403).send("<h2>Error 403: Forbidden</h2><h3>Incorrect Email or Password!<h3>");
    return;
  }
  req.session.userId = userid;
  res.redirect("/urls");
});

// delete login cookie, redirect to urls page
app.post("/logout", (req, res) => {
  req.session.userId = undefined;
  res.redirect("/urls");
});

// render urls page
app.get("/urls", (req, res) => {
  const userId = req.session.userId;
  let templateVars = {
    urls: urlsForUser(userId),
    userId: req.session.userId,
    user: users[req.session.userId]
  };
  res.render("urls_index", templateVars);
});

// render new url page
app.get("/urls/new", (req, res) => {
  const login = req.session.userId;
  if (login) {
    let templateVars = {
      urls: urlDatabase,
      userId: req.session.userId,
      user: users[req.session.userId]
    };
    res.render("urls_new", templateVars);
  } else {
    res.redirect("/login");
  }
});

// create new short/long url pair, redirect to urls
app.post("/urls/new", (req, res) => {
  let newURL = {};
  let userId = req.session.userId;
  let shortURL = generateRandomString();
  let longURL = req.body.longURL;
  let checker = true;
  if (urlDatabase.hasOwnProperty(shortURL)) { // if string already exists, generates a new string. Will cause an error if the 2nd attempt is the same as well. Probability laws say to ignore for purposes of this project.
    shortURL = generateRandomString();
  }
  if (!longURL.includes("www.")) {
    checker = false;
    res.status(400).send('<h2>Error 400: Bad Request</h2><h3>URLs must begin with "www."<h3>');
    return;
  }
  if (checker) {
    if (!longURL.startsWith("http")) {
      longURL = "http://" + longURL;
    }
    newURL.short = shortURL;
    newURL.long = longURL;
    newURL.id = userId;
    newURL.clicks = 0;
    newURL.visitors = [];
    newURL.visits = [];
    urlDatabase[shortURL] = newURL;
    res.redirect(`/urls/${shortURL}`);
  }
});

// redirect to full site
app.get("/u/:shortURL", (req, res) => {
  const userId = req.session.userId;
  const shortURL = req.params.shortURL;
  const longURL = urlDatabase[shortURL].long;
  if (!longURL) {
    res.status(404).send("<h2>Error 404: Not Found</h2><h3>Shortened URL doesn't exist!<h3>");
    return;
  } else {
    let dateVisit = []
    let newVisitTime = new Date();
    dateVisit.push(dateFormat(newVisitTime, "mmmm dS, yyyy, h:MM TT") + " UTC");
    urlDatabase[shortURL].visits.push(dateVisit);
    if (!req.session.uniqueVisitor) {
      req.session.uniqueVisitor = generateRandomString();
      urlDatabase[shortURL].visitors.push(req.session.uniqueVisitor);
    }
    urlDatabase[shortURL].clicks++;
    res.redirect(longURL);
  }
});

// render show page
app.get("/urls/:id", (req, res) => {
  const login = req.session.userId;
  if (!login) {
    res.status(404).send("<h2>Error 403: Forbidden</h2><h3>Must be logged in first!<h3>");
  } else if (urlDatabase[req.params.id].id !== login) {
    res.status(404).send("<h2>Error 403: Forbidden</h2><h3>Cannot edit URLs you didn't make!<h3>");
  } else {
    let userId = req.session.userId;
    let templateVars = {
      shortURL: req.params.id,
      database: urlDatabase,
      urls: urlsForUser(userId),
      userId: req.session.userId,
      user: users[req.session.userId]
    };
    res.render("urls_show", templateVars);
  }
});

// edit url, redirect to urls page
app.put("/urls/:id", (req, res) => {
  let newURL = {};
  let shortURL = req.params.id;
  let longURL = req.body[req.params.id];
  let userId = req.session.userId;
  let url_id = urlDatabase[req.params.id].id;
  let checker = true;
  if (!userId) {
    res.status(403).send("<h2>Error 403: Forbidden</h2><h3>Must be logged in first!<h3>");
    return;
  } else if (userId !== url_id) {
    res.status(403).send("<h2>Error 403: Forbidden</h2><h3>Cannot edit URLs you didn't make!<h3>");
    return;
  }
  if (!longURL.includes("www.")) {
    checker = false;
    res.status(400).send('<h2>Error 400: Bad Request</h2><h3>URLs must begin with "www."<h3>');
    return;
  }
  if (checker) {
    if (!longURL.startsWith("http")) {
      longURL = "http://" + longURL;
    }
    newURL.short = shortURL;
    newURL.long = longURL;
    newURL.id = userId;
    urlDatabase[shortURL] = Object.assign(urlDatabase[shortURL], newURL);
    res.redirect("/urls");
  }
});

// delete url, redirect to urls page
app.delete("/urls/:id", (req, res) => {
  let userId = req.session.userId;
  let url_id = urlDatabase[req.params.id].id;
  if (!userId) {
    res.status(403).send("<h2>Error 403: Forbidden</h2><h3>Must be logged in first!<h3>");
    return;
  } else if (userId !== url_id) {
    res.status(403).send("<h2>Error 403: Forbidden</h2><h3>Cannot delete URLs you didn't make!<h3>");
    return;
  } else {
    delete urlDatabase[req.params.id];
    res.redirect("/urls");
  }
});

// redirect edit button to show page
app.get("/urls/:id/edit", (req, res) => {
  let shortURL = req.params.id;
  res.redirect(`/urls/${shortURL}`);
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}!`);
});

// --------- Functions ---------
// random string - sampled from https://stackoverflow.com/questions/16106701/how-to-generate-a-random-string-of-letters-and-numbers-in-javascript
function generateRandomString() {
  let string = "";
  const charsetLower = "0123456789abcdefghijklmnopqrstuvwxyz";
  const charsetUpper = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let i = 0; i < 6; i++) {
    if (Math.random() >= 0.5) { // 50/50 choice between uppercase and lowercase charsets
      string += charsetUpper.charAt(Math.floor(Math.random() * charsetUpper.length));
    } else {
      string += charsetLower.charAt(Math.floor(Math.random() * charsetLower.length));
    }
  }
  return string;
}

// filters urlDatabase for user's urls
function urlsForUser(id) {
  let userURLS = {};
  for (let url in urlDatabase) {
    if (urlDatabase[url].id === id) {
      userURLS[url] = urlDatabase[url];
    }
  }
  return userURLS;
}