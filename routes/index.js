var express = require("express"),
    router = express.Router(),
    passport = require("passport"),
    middleware = require("../middleware"), // If we just require a directory, then by default index.js is required...
    async = require("async"),
    nodemailer = require("nodemailer"),
    crypto = require("crypto"),
    User = require("../models/user"),
    Campground = require("../models/campgrounds"),
    Notification = require("../models/notification");

// Root Route
router.get('/', function(req, res) {
    res.render('landing');
});

// ================
// AUTH ROUTES
// ================

// Show the Register Form
router.get('/register', function(req, res) {
    res.render('register', {
        page: "register"
    });
});

// Handle Sign-up Logic
router.post('/register', function(req, res) {
    var newUser = new User({
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        avatar: req.body.avatar,
        email: req.body.email
    });

    if (req.body.adminCode === process.env.ADMIN_CODE) {
        newUser.isAdmin = true
    }

    User.register(newUser, req.body.password, function(err, user) {
        if (err) {
            // req.flash("error", err.message);
            console.log(err);
            return res.render('register', {
                "error": err.message
            });
        }
        passport.authenticate('local')(req, res, function() {
            req.flash("success", "Welcome to YelpCamp " + user.username);
            res.redirect('campgrounds');
        });
    });
});

// Show Login Form
router.get('/login', function(req, res) {
    res.render('login', {
        page: "login"
    });
});

// Handling Login Logic
// router.post('/login',
//     passport.authenticate('local', {
//         successRedirect: '/campgrounds',
//         failureRedirect: '/login',
//         failureFlash: true,
//         successFlash: "Welcome Back!"
//     }),
//     function(req, res) {console.log(User);}
// );

// In the previous method to Handle Login Logic, we can't add Username to flash message
// Use Below Code to do that...
router.post("/login", function(req, res, next) {
    passport.authenticate("local", function(err, user, info) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("/login");
        }
        // User is set to false if auth fails.
        if (!user) {
            req.flash("error", info.message);
            return res.redirect("/login");
        }
        // Establish a session manually with req.logIn
        req.logIn(user, function(err) {
            if (err) {
                req.flash("error", err.message);
                res.redirect("/login");
            }

            // Login success! Add custom success flash message.
            req.flash("success", "Welcome back " + user.username + "!");
            res.redirect("/campgrounds");

        });
    })(req, res, next);
});

// Logout Route
router.get('/logout', function(req, res) {
    req.logout();
    req.flash("success", "Logged You Out!");
    res.redirect('/campgrounds');
});

// Route for Forgot Password
router.get("/forgot", function(req, res) {
    res.render("forgot");
});

// Handles the Logic for Forgot Password
router.post("/forgot", function(req, res, next) {

    // We will be using waterfall method to avoid Callback Hell
    // Waterfall method allows us to execute a series of functions in the order
    // We pass all the Functions in an Array
    async.waterfall([

        function(done) {
            crypto.randomBytes(20, function(err, buf) {
                var token = buf.toString("hex");
                done(err, token);
            });
        },

        function(token, done) {
            User.findOne({
                email: req.body.email
            }, function(err, user) {
                if (!user) {
                    req.flash("error", "No Account with the given Email Address exists!");
                    return res.redirect("/forgot");
                }
                user.resetPasswordToken = token;
                user.resetPasswordExpires = Date.now() + 3600000; // Token will be valid for an hour

                user.save(function(err) {
                    done(err, token, user);
                });
            });
        },

        function(token, user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "videshloya24@gmail.com",
                    pass: process.env.GMAIL_PW
                }
            });
            var mailOptions = {
                to: user.email,
                from: "videshloya24@gmail.com",
                subject: "Yelp Camp Password Reset!",
                text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                    'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                    'http://' + req.headers.host + '/reset/' + token + '\n\n' +
                    'If you did not request this, please ignore this email and your password will remain unchanged.\n'
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                if (err) {
                    console.log(err);
                } else {
                    req.flash("success", "An E-Mail has been sent to " + user.email + " further instructions");
                    done(err, "done");
                }
            });
        }
    ], function(err) {
        if (err) return next(err);
        res.redirect("/forgot");
    });

});

// Route for Token
router.get("/reset/:token", function(req, res) {
    User.findOne({
        resetPasswordToken: req.params.token,
        resetPasswordExpires: {
            $gt: Date.now()
        }
    }, function(err, user) {
        if (!user) {
            req.flash("error", "Password Reset Token is invalid or has expired!");
            return res.redirect("/forgot");
        }
        res.render("reset", {
            token: req.params.token
        });
    });
});

// Handles the Logic for Reset Password
router.post("/reset/:token", function(req, res) {
    async.waterfall([
        function(done) {
            User.findOne({
                    resetPasswordToken: req.params.token,
                    resetPasswordExpires: {
                        $gt: Date.now()
                    }
                },
                function(err, user) {
                    if (!user) {
                        req.flash("error", "Password reset token is invalid or has expired!");
                        return res.redirect("back");
                    }
                    if (req.body.password === req.body.confirm) {
                        user.setPassword(req.body.password, function(err) {
                            user.resetPasswordToken = undefined;
                            user.resetPasswordExpires = undefined;

                            user.save(function(err) {
                                req.logIn(user, function(err) {
                                    done(err, user);
                                });
                            });

                        });
                    } else {
                        req.flash("error", "Passwords do not match!");
                        return res.redirect("back");
                    }
                });
        },
        function(user, done) {
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "videshloya24@gmail.com",
                    pass: process.env.GMAIL_PW
                }
            });
            var mailOptions = {
                to: user.email,
                from: "videshloya24@gmail.com",
                subject: "Your password has been changed",
                text: "Hello,\n\n" +
                    "This is a confirmation that the password for your account " + user.email + " has just been changed.\n"
            };
            smtpTransport.sendMail(mailOptions, function(err) {
                req.flash("success", "Success! Your password has been changed.");
                done(err);
            });
        }
    ], function(err) {
        res.redirect("/campgrounds");
    });
});

// Shows the User Profile
router.get('/users/:id', async function(req, res) {
    try {
        let foundUser = await User.findById(req.params.id).populate("followers").exec();
        Campground.find().where('author.id').equals(foundUser._id).exec(async function(err, campgrounds) {
            if (err) {
                console.log(err);
                req.flash("error", "Something went wrong!");
                res.redirect("/");
            }
            res.render("users/show", {
                user: foundUser,
                campgrounds: campgrounds
            });
        });
    } catch (err) {
        req.flash("error", err.message);
        return res.redirect("back");
    }
});

// Follows A User
router.get("/follow/:id", middleware.isLoggedIn, async function(req, res) {
    try {
        let user = await User.findById(req.params.id);
        user.followers.push(req.user._id);
        user.save();
        req.flash("success", "Successfully followed " + user.username + "!");
        res.redirect("/users/" + req.params.id);
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// Views all Notifications
router.get("/notifications", middleware.isLoggedIn, async function(req, res) {
    try {
        let user = await User.findById(req.user._id).populate({
            path: "notifications",
            options: {
                sort: {
                    "_id": -1
                }
            }
        }).exec();
        let allNotifications = user.notifications;
        res.render("notifications/index", {
            allNotifications
        });
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

// Handle the Notifications
router.get("/notifications/:id", middleware.isLoggedIn, async function(req, res) {
    try {
        let notification = await Notification.findById(req.params.id);
        notification.isRead = true;
        notification.save();
        res.redirect("/campgrounds/" + notification.campgroundId);
    } catch (err) {
        req.flash("error", err.message);
        res.redirect("back");
    }
});

module.exports = router;