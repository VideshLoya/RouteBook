require("dotenv").config()

var express = require('express'),
    app = express(),
    bodyParser = require('body-parser'),
    mongoose = require('mongoose'),
    flash = require("connect-flash"),
    passport = require('passport'),
    LocalStrategy = require('passport-local'),
    methodOverride = require("method-override"),
    Campground = require('./models/campgrounds'),
    Comment = require('./models/comment'),
    User = require('./models/user'),
    seedDB = require('./seeds');

// Requiring Routes
var commentRoutes = require("./routes/comments"),
    campgroundRoutes = require("./routes/campgrounds"),
    indexRoutes = require("./routes/index"),
    reviewRoutes = require("./routes/review");

var url = process.env.DATABASE_URL || 'mongodb+srv://Manish:manish@cluster0-rn0jl.mongodb.net/yelp-camp?retryWrites=true&w=majority';

mongoose.connect(url, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true
});

app.use(express.json());
app.use(
    bodyParser.urlencoded({
        extended: true
    })
);
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');
app.use(methodOverride("_method"));
app.use(flash());

// Seeding the Database
// seedDB();

// PASSPORT CONFIGURATION
app.use(
    require('express-session')({
        secret: 'Once again, Rusty wins cutest dog!',
        resave: false,
        saveUninitialized: false
    })
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.locals.moment = require("moment");

// Using our own Middleware to pass req.user to every template
app.use(async function(req, res, next) {
    res.locals.currentUser = req.user;

    if (req.user) {
        try {
            let user = await User.findById(req.user._id).populate("notifications", null, {
                isRead: false
            }).exec();
            res.locals.notifications = user.notifications.reverse();
        } catch (err) {
            console.log(err.message);
        }
    }

    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

app.use("/", indexRoutes);
app.use("/campgrounds", campgroundRoutes);
app.use("/campgrounds/:id/comments", commentRoutes);
app.use("/campgrounds/:id/reviews", reviewRoutes);

var port = process.env.PORT || 3000;
app.listen(port, function() {
    console.log('Hurray, the Server got started!');
});