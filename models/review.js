var mongoose = require("mongoose");

var reviewSchema = new mongoose.Schema({
    rating: {
        type: Number, // Setting the field type
        required: "Please provide a Rating (1-5 Stars) ", // Making the Star Rating required
        min: 1, // Defining the Min Value
        max: 5, // Defining the Max Value
        // Adding Validation to see if the entry is an integer or not
        validate: {
            // Validator accepts a function definition which it uses for Validation
            validator: Number.isInteger,
            message: "{VALUE} is not an Integer Value"
        }
    },
    text: {
        type: String // Review Text
    },
    // Author ID & Username Fields
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    // Campground Associated with the Review
    campground: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Campground"
    }
}, {
    // If timestamps are set to True, mongoose assigns createdAt & updatedAt fields to the Schema
    // The type assigned is Date
    timestamps: true
});

module.exports = mongoose.model("Review", reviewSchema);