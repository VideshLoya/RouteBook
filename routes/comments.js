var express = require("express"),
    router = express.Router({
        mergeParams: true
    }),
    middleware = require("../middleware"), // If we just require a directory, then by default index.js is required...
    Campground = require("../models/campgrounds"),
    Comment = require("../models/comment");

// ==================
// COMMENTS ROUTES
// ==================

// New Comments
router.get('/new', middleware.isLoggedIn, function(req, res) {
    // Fidn campground By Id
    Campground.findById(req.params.id, function(err, campground) {
        if (err) {
            console.log(err);
        } else {
            res.render('comments/new', {
                campground: campground
            });
        }
    });
});

// Create Comments
router.post('/', middleware.isLoggedIn, function(req, res) {
    // Lookup Campground using ID
    Campground.findById(req.params.id, function(err, campground) {
        if (err) {
            console.log(err);
            redirect('/campgrounds');
        } else {
            // Create the new Comment
            Comment.create(req.body.comment, function(err, comment) {
                if (err) {
                    req.flash("error", "Something went wrong!");
                    console.log(err);
                } else {
                    // Add Username and ID to comment
                    comment.author.id = req.user._id;
                    comment.author.username = req.user.username;
                    // Save the Comment
                    comment.save();
                    // Connect new Comment to Campground
                    campground.comments.push(comment);
                    campground.save();
                    // Redirect Campground show page
                    req.flash("success", "Successfully added Comment!");
                    res.redirect('/campgrounds/' + campground._id);
                }
            });
        }
    });
});

// Edit Comments
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(req, res) {
    // We are checking the campground again, in order to prevent app crashes
    // Which may happen, if someone changes the Campground ID,
    // ... before submitting the request to Edit the comment.
    Campground.findById(req.params.id, function(err, foundCampground) {
        if (err || !foundCampground) {
            req.flash("error", "Sorry, that Campground doesn't exist");
            return res.redirect("back");
        }
        Comment.findById(req.params.comment_id, function(err, foundComment) {
            if (err) {
                res.redirect("back");
            } else {
                res.render("comments/edit", {
                    campground_id: req.params.id,
                    comment: foundComment
                });
            }
        });
    });
});

// Update Comments
router.put("/:comment_id", middleware.checkCommentOwnership, function(req, res) {
    Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment) {
        if (err) {
            res.redirect("back");
        } else {
            res.redirect("/campgrounds/" + req.params.id);
        }
    });
});

// Destroy Comments
router.delete("/:comment_id", middleware.checkCommentOwnership, function(req, res) {
    // Find By Id & Remove
    Comment.findByIdAndRemove(req.params.comment_id, function(err) {
        if (err) {
            res.redirect("back");
        } else {
            req.flash("success", "Comment Deleted");
            res.redirect("/campgrounds/" + req.params.id);
        }
    });
});

module.exports = router;