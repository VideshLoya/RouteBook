var express = require("express"),
    router = express.Router(),
    middleware = require("../middleware"), // If we just require a directory, then by default index.js is required...
    Campground = require("../models/campgrounds"),
    Comment = require("../models/comment"),
    Review = require("../models/review"),
    User = require("../models/user"),
    Notification = require("../models/notification");

// ============================
// GEOCODER CONFIG
// ============================

var NodeGeocoder = require('node-geocoder');

var options = {
    provider: process.env.GEOCODER_PROVIDER,
    httpAdapter: 'https',
    apiKey: process.env.GEOCODER_API_KEY,
    formatter: null
};

var geocoder = NodeGeocoder(options);

// ============================
// CLOUDINARY & MULTER CONFIG
// ============================

var multer = require('multer');
var storage = multer.diskStorage({
    filename: function(req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});
var imageFilter = function(req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};
var upload = multer({
    storage: storage,
    fileFilter: imageFilter
})

var cloudinary = require('cloudinary');
cloudinary.config({
    cloud_name: 'routebook',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// ======================
// CAMPGROUND ROUTES
// ======================

// INDEX- Show all Campgrounds
router.get('/', function(req, res) {

    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;

    if (req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        // Get all campgrounds from DB
        Campground.find({
            name: regex
        }).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, allCampgrounds) {
            Campground.countDocuments({
                name: regex
            }).exec(function(err, count) {
                if (err) {
                    console.log(err);
                    res.redirect("back");
                } else {
                    if (allCampgrounds.length < 1) {
                        noMatch = "No campgrounds match that query, please try again.";
                    }
                    res.render('campgrounds/index', {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        page: "campgrounds",
                        noMatch: noMatch,
                        search: req.query.search
                    });
                }
            });
        });
    } else {
        // Get all campgrounds from DB
        Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function(err, allCampgrounds) {
            Campground.countDocuments().exec(function(err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render('campgrounds/index', {
                        campgrounds: allCampgrounds,
                        page: "campgrounds",
                        noMatch: noMatch,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        search: false
                    });
                }
            });
        });
    };
});

// CREATE- Add new Campground to the DB
router.post("/", middleware.isLoggedIn, upload.single('image'), function(req, res) {

    geocoder.geocode(req.body.location, function(err, data) {

        var lat = data[0].latitude;
        var lng = data[0].longitude;

        var isLatInvalid = false;
        var isLngInvalid = false;

        if (lat <= -90 || lat >= 90)
            isLatInvalid = true;
        if (lat <= -180 || lat >= 80)
            isLngInvalid = true;

        if (err || !data.length || isLatInvalid || isLngInvalid) {
            req.flash('error', 'Invalid address');
            return res.redirect('back');
        }

        var location = data[0].formattedAddress;

        cloudinary.v2.uploader.upload(req.file.path, async function(err, result) {

            if (err) {
                req.flash('error', err.message);
                return res.redirect('back');
            }

            // Add cloudinary url for the image to the campground object under image property
            req.body.campground.image = result.secure_url;
            // Add image's public_id to campground object
            req.body.campground.imageId = result.public_id;
            // Add author to campground
            req.body.campground.author = {
                id: req.user._id,
                username: req.user.username
            };
            req.body.campground.location = location;
            req.body.campground.lat = lat;
            req.body.campground.lng = lng;

            try {
                let campground = await Campground.create(req.body.campground);
                let user = await User.findById(req.user._id).populate('followers').exec();
                let newNotification = {
                    username: req.user.username,
                    campgroundId: campground.id
                }
                for (const follower of user.followers) {
                    let notification = await Notification.create(newNotification);
                    follower.notifications.push(notification);
                    follower.save();
                }
                res.redirect("/campgrounds/" + campground.id);
            } catch (err) {
                req.flash('error', err.message);
                res.redirect('back');
            }

        });
    });

});

// NEW- Show form to create new Campground
router.get('/new', middleware.isLoggedIn, function(req, res) {
    res.render('campgrounds/new');
});

// We need to make sure that this route is posted after campgrounds/new
// Otherwise there will be a clash of Routes

// SHOW- Shows more info about the selected Campground
router.get('/:id', function(req, res) {
    // Find the Campground with the provided ID
    Campground.findById(req.params.id).populate('comments likes').populate({
        path: "reviews",
        options: {
            sort: {
                createdAt: -1
            }
        }
    }).exec(function(err, foundCampground) {
        if (err || !foundCampground) {
            console.log(err);
            req.flash("error", "Sorry, that Campground doesn't exist!");
            res.redirect("back");
        } else {
            res.render('campgrounds/show', {
                campground: foundCampground
            });
        }
    });
});

// LIKE- Campground Like Route
router.post("/:id/like", middleware.isLoggedIn, function(req, res) {
    Campground.findById(req.params.id, function(err, foundCampground) {
        if (err) {
            console.log(err);
            return res.redirect("/campgrounds");
        }

        // Check if req.user._id exists in foundCampground.likes
        var foundUserLike = foundCampground.likes.some(function(like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // User has already liked, so removing the like
            foundCampground.likes.pull(req.user._id);
        } else {
            // Adding the new user like
            foundCampground.likes.push(req.user);
        }

        foundCampground.save(function(err) {
            if (err) {
                console.log(err);
                return res.redirect("/campgrounds");
            }
            return res.redirect("/campgrounds/" + foundCampground._id);
        });
    });
});

// EDIT - Edit a particular campground
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(req, res) {
    Campground.findById(req.params.id, function(err, foundCampground) {
        res.render("campgrounds/edit", {
            campground: foundCampground
        });
    });
});

// UPDATE - Update a particular campground
router.put("/:id", middleware.checkCampgroundOwnership, upload.single('image'), function(req, res) {
    Campground.findById(req.params.id, async function(err, campground) {
        if (err) {
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
                try {
                    await cloudinary.v2.uploader.destroy(campground.imageId);
                    var result = await cloudinary.v2.uploader.upload(req.file.path);
                    campground.imageId = result.public_id;
                    campground.image = result.secure_url;
                } catch (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
            }

            geocoder.geocode(req.body.location, function(err, data) {
                if (err || !data.length) {
                    req.flash('error', 'Invalid address');
                    return res.redirect('back');
                }
                campground.lat = data[0].latitude;
                campground.lng = data[0].longitude;
                campground.location = data[0].formattedAddress;
                campground.name = req.body.name;
                campground.price = req.body.price;
                campground.description = req.body.description;
                campground.save();
                req.flash("success", "Successfully Updated!");
                res.redirect("/campgrounds/" + campground._id);
            });
        }
    });
});

// DESTROY - Destroys the Campground
// Can update this route to Delete the Data associated to the Campground, which is Deleted
// Check out the Reviews Tutorial by Zarko for reference
router.delete('/:id', middleware.checkCampgroundOwnership, function(req, res) {
    Campground.findById(req.params.id, async function(err, campground) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        try {
            await cloudinary.v2.uploader.destroy(campground.imageId);
            campground.remove();
            req.flash('success', 'Campground deleted successfully!');
            res.redirect('/campgrounds');
        } catch (err) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
        }
    });
});

// For Fuzzy Search
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router;