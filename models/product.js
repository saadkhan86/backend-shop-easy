// models/Product.js
const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  reviews: {
    type: String,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  image: {
    type: String,
    trim: true,
  },
  rating: {
    rate: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },
    count: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  stock: {
    type: Number,
    min: 0,
    default: 0,
  },
  features: [
    {
      type: String,
      trim: true,
    },
  ],
  // Add createdBy field
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Add updatedAt field
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

productSchema.methods.getAverageRating = function () {
  return this.rating?.rate || 0;
};

productSchema.methods.getTotalReviews = function () {
  return this.rating?.count || 0;
};

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

module.exports = Product;
