const express = require("express");
const mysql = require("mysql");
const session = require("express-session");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const saltRounds = 10;

const app = express();
const path = require("path");
const { error } = require("console");

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // req.body
app.use(express.static("public"));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

//  MySQL database connection
const connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "mathgurunew",
});

connection.connect((err) => {
    if (err) {
        console.error("Error connecting to MySQL database:", err);
        return;
    }
    console.log("Connected to MySQL database!");
});

// prepare to use session
app.use(session({
    secret: 'rono',
    saveUninitialized: false,
    resave: true
}))





// continue to check if user is loged in
app.use((req, res, next) => {
    res.locals.isLogedIn = (req.session.userID !== undefined);
    next();
});


app.get("/", (req, res) => {
    res.render("index.ejs");
});

app.get("/forms", (req, res) => {
    res.render("forms.ejs");
});

app.get("/register", (req, res) => {
    if (req.session.user) {
        res.redirect("/");
    } else {
        res.render("forms.ejs");
    }
});

app.post("/register", (req, res) => {
    // Check if email already exists
    // Encrypt the password
    // Save data to db
    connection.query(
        "SELECT email FROM users WHERE email = ?",
        [req.body.email],
        (selectErr, data) => {
            if (selectErr) {
                console.log("SQL error: " + selectErr);
                res.render("forms.ejs", {
                    error: "An error occurred. Please try again later.",
                });
            } else {
                if (data.length > 0) {
                    res.render("forms.ejs", { emailError: "Email already exists" });
                } else {
                    if (req.body.confirmPassword === req.body.password) {
                        const salt = bcrypt.genSaltSync(saltRounds);
                        const hashedPassword = bcrypt.hashSync(req.body.password, salt);
                        connection.query(
                            "INSERT INTO users(username, email, password) VALUES(?, ?, ?)",
                            [req.body.username, req.body.email, hashedPassword],
                            (err) => {
                                if (err) {
                                    console.log("SQL error: " + err);
                                    res.render("forms.ejs", {
                                        error: "An error occurred. Please try again later.",
                                    });
                                } else {
                                    res.redirect("/login");
                                }
                            }
                        );
                    } else {
                        res.render("forms.ejs", {
                            passwordError: "Password and confirm password do not match",
                        });
                    }
                }
            }
        }
    );
});

app.get("/login", (req, res) => {
    res.render("forms.ejs");
});

app.post("/login", (req, res) => {
    console.log("Login route triggered");
    // Fetch user data from the database based on the provided email
    connection.query(
        "SELECT * FROM users WHERE email = ?",
        [req.body.email],
        (selectErr, data) => {
            if (selectErr) {
                console.log("SQL error: " + selectErr);
                res.render("forms.ejs", {
                    error: "An error occurred. Please try again later.",
                });
            } else {
                if (data.length > 0) {
                    // Perform password comparison asynchronously
                    bcrypt.compare(
                        req.body.password,
                        data[0].password,
                        (compareErr, isPasswordCorrect) => {
                            if (compareErr) {
                                console.log("Password comparison error:", compareErr);
                                res.render("forms.ejs", {
                                    error: "An error occurred. Please try again later.",
                                });
                            } else if (isPasswordCorrect) {
                                // Set session variables to indicate successful login
                                req.session.userID = data[0].u_id
                                console.log("Redirecting to /courses");
                                res.redirect("/courses");
                                console.log("Redirection executed");
                            } else {
                                // Password incorrect
                                res.render("forms.ejs", {
                                    loginError: "Password incorrect",
                                });
                            }
                        }
                    );
                } else {
                    // User not found
                    res.render("forms.ejs", {
                        loginError: "Account does not exist. Please create one",
                    });
                }
            }
        }
    );
});

app.get("/courses", (req, res) => {
    // Fetch courses/programs data from your database
    const query = "SELECT * FROM courses"; // Assuming the table name is "Courses"
    connection.query(query, (err, result) => {
        if (err) {
            console.error("Error fetching courses:", err);
            return res.status(500).send("Error fetching courses");
        }
        const courses = result;
        console.log("Courses:", courses); 
        res.render("courses.ejs", { courses });
    }); 
});

// Route to handle course card click and redirect to levels page
app.get("/courses/:courseId", (req, res) => {
    const courseId = req.params.courseId;
    // Redirect to the levels page for the specific course
    res.redirect(`/courses/${courseId}/levels`);
});

// Route to render the levels page for a specific course
app.get("/courses/:courseId/levels", (req, res) => {
    const courseId = req.params.courseId;
    // Fetch levels data for the specific course from the database based on courseId
    const levelsQuery = "SELECT levels.level_id, levels.level_description, courses.course_id, courses.course_name FROM levels JOIN courses ON levels.course_id = courses.course_id WHERE courses.course_id = ?";
    connection.query(levelsQuery, [courseId], (err, levelsResult) => {
        if (err) {
            console.error("Error fetching levels:", err);
            return res.status(500).send("Error fetching levels");
        }
        res.render("levels.ejs", { levels: levelsResult });
    });
});


// Route to handle course card click and redirect to levels page
app.get("/course/:courseId", (req, res) => {
    const courseId = req.params.courseId;
    // Redirect to the levels page for the specific course
    res.redirect(`/courses/${courseId}/levels`);
});

app.get("/courses/:courseId/levels/:levelId/quiz", (req, res) => {
    const quizQuery = 'SELECT q.question_id, q.question_text, c.course_name FROM questions q JOIN courses c ON q.course_id = c.course_id WHERE q.course_id = ?';
    connection.query(
        quizQuery,
        [req.params.courseId],
        (err, result) => {
            if (err) {
                console.error("Error fetching quiz questions:", err);
                return res.status(500).send("Error fetching quiz questions");
            }
            const dbquestions = result;
            const optionQuery = 'SELECT * FROM options';
            connection.query(
                optionQuery,
                [],
                (err, result) => {
                    if (err) {
                        console.error("Error fetching quiz options:", err);
                        return res.status(500).send("Error fetching quiz questions");
                    }
                    const dboptions = result;
                    const level = req.params.levelId;
                    const courseId = req.params.courseId;
                    res.render("quiz.ejs", { level: level, courseId: courseId, dbquestions: dbquestions, dboptions: dboptions });
                }
            );
        }
    );
});

app.post("/submitmyquiz/:courseId", (req, res) => {
    const selectedOptionIds = Object.values(req.body);
    const scoreQuery = `SELECT SUM(CASE WHEN o.correctness = 'correct' THEN 1 ELSE 0 END) AS score FROM options o WHERE o.option_id IN (?)`;
    connection.query(scoreQuery, [selectedOptionIds], (err, result) => {
        if (err) {
            console.error("Error calculating score:", err);
            return res.status(500).send("Error calculating score");
        }
        const score = result[0].score; 
        const courseId = req.params.courseId;
        res.render("chart.ejs", { courseId: courseId, score: score, selectedOptionIds: selectedOptionIds }); 
    });
});

app.get("/logout", (req, res) => {
    // Destroy the session and redirect to the home page
    req.session.destroy((err) => {
        if (err) {
            console.log("Error destroying session:", err);
        }
        res.redirect("/");
    });
});

app.get("/survey", (req, res) => {
    res.render("survey.ejs");
});

app.get("/faq", (req, res) => {
    console.log("Accessed /faq route");
    res.render("FAQ.ejs");
});

app.get("/subscription", (req, res) => {
    console.log("Accessed /subscription route");
    res.render("subscription.ejs");
});

app.get("/payment", (req, res) => {
    console.log("Accessed /payment route");
    res.render("payment.ejs");
});

app.get("/quizform", (req, res) => {
    console.log("Accessed the /quizform route");
    res.render("quizform.ejs");
});

const port = 3005;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
