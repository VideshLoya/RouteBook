var Campground = require("../models/campgrounds"),
    Comment = require("../models/comment"),
    Review = require("../models/review");

// All the middleware goes here
var middlewareObj = {};

// For the Authorisation of the LoggedIn User
middlewareObj.checkCampgroundOwnership = function(req, res, next) {
    // Is User Logged In At All
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id, function(err, foundCampground) {
            // Added this block, to check if foundCampground exists
            if (err || !foundCampground) {
                req.flash("error", "Campground Not Found!");
                res.redirect("back");
            } else {

                // Does User own the Campground
                // i.e. we need to compare foundCampground.author.id & req.user._id
                // However, the first one is a Mongoose Object & the second one is a String
                // But if we print them out, they will look the same
                if (foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that!");
        res.redirect("back");
    }
};

// For the Authorisation of the LoggedIn User
middlewareObj.checkCommentOwnership = function(req, res, next) {
    // Is User Logged In At All
    if (req.isAuthenticated()) {
        Comment.findById(req.params.comment_id, function(err, foundComment) {
            if (err || !foundComment) {
                // req.flash("error", "Comment Not Found!");
                res.redirect("back", {
                    "error": "Comment Not Found!"
                });
            } else {
                // Does User own the Comment
                // i.e. we need to compare foundComment.author.id & req.user._id
                // However, the first one is a Mongoose Object & the second one is a String
                // But if we print them out, they will look the same
                if (foundComment.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that!");
        res.redirect("back");
    }
};

// For the Authorisation of the LoggedIn User
middlewareObj.checkReviewOwnership = function(req, res, next) {
    if (req.isAuthenticated()) {
        Review.findById(req.params.review_id, function(err, foundReview) {
            if (err || !foundReview) {
                req.flash("error", "Review Not Found!");
                res.redirect("back");
            } else {
                if (foundReview.author.id.equals(req.user._id) || req.user.isAdmin) {
                    next();
                } else {
                    req.flash("error", "You don't have permission to do that!");
                    res.redirect("back");
                }
            }
        });
    } else {
        req.flash("error", "You need to be logged in to do that!");
        res.redirect("back");
    }
};

// To Check if the Review already exists or not
middlewareObj.checkReviewExistence = function(req, res, next) {
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id).populate("reviews").exec(function(err, foundCampground) {
            if (err || !foundCampground) {
                req.flash("error", "Campground not found.");
                res.redirect("back");
            } else {
                // Check if req.user._id exists in foundCampground.reviews
                var foundUserReview = foundCampground.reviews.some(function(review) {
                    return review.author.id.equals(req.user._id);
                });
                if (foundUserReview) {
                    req.flash("error", "You already wrote a review.");
                    return res.redirect("/campgrounds/" + foundCampground._id);
                }
                // If the review was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error", "You need to login first.");
        res.redirect("back");
    }
};

// Middleware Function
middlewareObj.isLoggedIn = function(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "You need to be Logged In to do that!");
    res.redirect('/login');
};

module.exports = middlewareObj;