var express = require('express'),
    router = express.Router({
        mergeParams: true
    }),
    Campground = require('../models/campgrounds'),
    Review = require('../models/review'),
    middleware = require('../middleware');

// Index Route for Reviews
router.get('/', function(req, res) {
    Campground.findById(req.params.id)
        .populate({
            path: 'reviews',
            options: {
                sort: {
                    createdAt: -1 // Sorting the populated reviews array to show the latest first
                }
            }
        })
        .exec(function(err, campground) {
            if (err || !campground) {
                req.flash('error', err.message);
                return res.redirect('back');
            }
            res.render('reviews/index', {
                campground: campground
            });
        });
});

// New Reviews Route
router.get('/new', middleware.isLoggedIn, middleware.checkReviewExistence, function(req, res) {
    // The 2nd middleware checks if a User already reviewed the Campground
    // Only one Review per user is allowed
    Campground.findById(req.params.id, function(err, campground) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('back');
        }
        res.render('reviews/new', {
            campground: campground
        });
    });
});

// Route handling the Review Logic
router.post('/', middleware.isLoggedIn, middleware.checkReviewExistence, function(req, res) {
    Campground.findById(req.params.id).populate('reviews').exec(function(err, campground) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('back');
        }
        Review.create(req.body.review, function(err, review) {
            if (err) {
                req.flash('error', err.message);
                return res.redirect('back');
            }

            // Add author Username/ID & associated campground to the review
            review.author.id = req.user._id;
            review.author.username = req.user.username;
            review.campground = campground;

            // Save Review
            review.save();
            campground.reviews.push(review);

            // Calculate the new average review for the Campground
            campground.rating = calculateAverage(campground.reviews);

            // Save the Campground
            campground.save();
            req.flash('success', 'Your Review has been successfully added!');
            res.redirect('/campgrounds/' + campground._id);
        });
    });
});

// Edit Reviews Route
router.get('/:review_id/edit', middleware.checkReviewOwnership, function(req, res) {
    Review.findById(req.params.review_id, function(err, foundReview) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('back');
        }
        res.render('reviews/edit', { campground_id: req.params.id, review: foundReview });
    });
});

// Handles the logic for Editing a Review
router.put('/:review_id', middleware.checkReviewOwnership, function(req, res) {
    Review.findByIdAndUpdate(req.params.review_id, req.body.review, { new: true }, function(err, updatedReview) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('back');
        }
        Campground.findById(req.params.id).populate('reviews').exec(function(err, campground) {
            if (err) {
                req.flash('error', err.message);
                return res.redirect('back');
            }
            // recalculate campground average
            campground.rating = calculateAverage(campground.reviews);
            //save changes
            campground.save();
            req.flash('success', 'Your review was successfully edited.');
            res.redirect('/campgrounds/' + campground._id);
        });
    });
});

// Delete the Review
router.delete('/:review_id', middleware.checkReviewOwnership, function(req, res) {
    Review.findByIdAndRemove(req.params.review_id, function(err) {
        if (err) {
            req.flash('error', err.message);
            return res.redirect('back');
        }
        Campground.findByIdAndUpdate(req.params.id, { $pull: { reviews: req.params.review_id } }, { new: true })
            .populate('reviews')
            .exec(function(err, campground) {
                if (err) {
                    req.flash('error', err.message);
                    return res.redirect('back');
                }
                // Recalculate campground average
                campground.rating = calculateAverage(campground.reviews);
                // Save changes
                campground.save();
                req.flash('success', 'Your review was deleted successfully.');
                res.redirect('/campgrounds/' + req.params.id);
            });
    });
});

function calculateAverage(reviews) {
    if (reviews.length === 0) {
        return 0;
    }
    var sum = 0;
    reviews.forEach(function(element) {
        sum += element.rating;
    });
    return sum / reviews.length;
}

module.exports = router;