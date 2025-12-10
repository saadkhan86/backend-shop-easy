const Product = require("../models/product");
const User = require("../models/user");
const mongoose = require("mongoose");

// Create a new listing
exports.createListing = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const {
      title,
      price,
      category,
      description,
      image,
      stock,
      features,
      reviews,
    } = req.body;

    // Validation
    if (!title || !price || !category) {
      return res.status(400).json({
        success: false,
        message: "Title, price, and category are required fields",
      });
    }

    if (price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    if (stock && stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock cannot be negative",
      });
    }

    // Create the product
    const newProduct = new Product({
      title,
      price: parseFloat(price),
      category,
      description: description || "",
      image: image || "",
      stock: stock || 0,
      features: features || [],
      reviews: reviews || "",
      rating: {
        rate: 0,
        count: 0,
      },
      createdBy: userId, // Store who created this product
    });

    // Save the product
    const savedProduct = await newProduct.save();

    // Add product to user's listings
    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          listings: {
            productId: savedProduct._id,
            status: "active",
          },
        },
      },
      { new: true }
    );

    res.status(201).json({
      success: true,
      message: "Listing created successfully",
      product: savedProduct,
    });
  } catch (error) {
    console.error("Create listing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create listing",
      error: error.message,
    });
  }
};

// Delete a listing
exports.deleteListing = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const { productId } = req.params;

    // Validate productId
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required",
      });
    }

    // Check if the product exists and belongs to the user
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Optional: Check if the user created this product
    // This depends on whether you want any user to delete or only the creator
    const user = await User.findOne({
      _id: userId,
      "listings.productId": productId,
    });

    if (!user) {
      // If you want to allow admin to delete any product, add admin check here
      // For now, only the creator can delete
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this listing",
      });
    }

    // Delete the product
    await Product.findByIdAndDelete(productId);

    // Remove from user's listings
    await User.findByIdAndUpdate(
      userId,
      {
        $pull: {
          listings: { productId: productId },
        },
      },
      { new: true }
    );

    res.json({
      success: true,
      message: "Listing deleted successfully",
    });
  } catch (error) {
    console.error("Delete listing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete listing",
      error: error.message,
    });
  }
};

// Update a listing
exports.updateListing = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const { productId } = req.params;
    const updates = req.body;

    // Validate productId
    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required",
      });
    }

    // Check if user owns the listing
    const user = await User.findOne({
      _id: userId,
      "listings.productId": productId,
    });

    if (!user) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this listing",
      });
    }

    // Don't allow updating rating or createdBy
    if (updates.rating || updates.createdBy) {
      return res.status(400).json({
        success: false,
        message: "Cannot update rating or createdBy fields",
      });
    }

    // Validate price and stock if provided
    if (updates.price !== undefined && updates.price < 0) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative",
      });
    }

    if (updates.stock !== undefined && updates.stock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock cannot be negative",
      });
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Listing updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Update listing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update listing",
      error: error.message,
    });
  }
};

// Get user's listings
exports.getUserListings = async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;

    // Get user with populated listings
    const user = await User.findById(userId)
      .populate({
        path: "listings.productId",
        model: "Product",
      })
      .select("listings");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Format the listings
    const listings = user.listings.map((item) => ({
      _id: item.productId?._id,
      title: item.productId?.title,
      price: item.productId?.price,
      category: item.productId?.category,
      description: item.productId?.description,
      image: item.productId?.image,
      stock: item.productId?.stock,
      rating: item.productId?.rating,
      status: item.status,
      createdAt: item.createdAt,
      features: item.productId?.features || [],
    }));

    res.json({
      success: true,
      listings,
      count: listings.length,
    });
  } catch (error) {
    console.error("Get user listings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch listings",
      error: error.message,
    });
  }
};

// Get single listing
exports.getListing = async (req, res) => {
  try {
    const { productId } = req.params;

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID is required",
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Listing not found",
      });
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Get listing error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch listing",
      error: error.message,
    });
  }
};

// Admin: Get all listings (with filtering)
exports.getAllListings = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    const {
      page = 1,
      limit = 10,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};

    if (category) {
      filter.category = { $regex: category, $options: "i" };
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    // Execute query
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [listings, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("createdBy", "name email"), // Populate creator info
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      listings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get all listings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch listings",
      error: error.message,
    });
  }
};
