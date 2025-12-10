const express = require("express");
const Product = require("../models/product");
const User = require("../models/user");
const mongoose = require("mongoose");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all listing management routes
const listingRouter = express.Router();
listingRouter.use(authenticateToken);

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// Get all products (public)
router.get("/", async (req, res) => {
  try {
    const {
      category,
      search,
      page = 1,
      limit = 50,
      minPrice,
      maxPrice,
    } = req.query;

    let query = {};

    // Category filter
    if (category && category !== "all") {
      query.category = { $regex: category, $options: "i" };
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const skip = (page - 1) * limit;

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      data: products,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// Get products by category (public) - Moved before /:id route
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const products = await Product.find({
      category: { $regex: category, $options: "i" },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Product.countDocuments({
      category: { $regex: category, $options: "i" },
    });

    res.json({
      success: true,
      data: products,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get products by category error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ============================================
// LISTING MANAGEMENT ROUTES (Authentication required)
// ============================================

// Create a new listing
listingRouter.post("/create", async (req, res) => {
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

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
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
      features: Array.isArray(features) ? features : [],
      reviews: reviews || "",
      rating: {
        rate: 0,
        count: 0,
      },
      createdBy: userId,
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
});

// Get user's own listings
// Get user's own listings - Add debugging
listingRouter.get("/my-listings", async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const { status, page = 1, limit = 20 } = req.query;

    console.log("=== GET MY-LISTINGS DEBUG ===");
    console.log("Authenticated User ID:", userId);
    console.log("User from token:", req.user);
    console.log("Status filter:", status);

    // First, try to get products directly by createdBy
    const directProducts = await Product.find({ createdBy: userId });
    console.log("Direct products by createdBy:", directProducts.length);
    console.log(
      "Direct product IDs:",
      directProducts.map((p) => p._id)
    );

    // Get user with populated listings
    const user = await User.findById(userId)
      .populate({
        path: "listings.productId",
        model: "Product",
      })
      .select("listings");

    console.log("User found:", user ? "Yes" : "No");
    console.log("User listings array:", user?.listings?.length || 0);

    if (user?.listings?.length > 0) {
      console.log("Listings details:");
      user.listings.forEach((item, index) => {
        console.log(
          `[${index}] ProductId: ${item.productId}, Status: ${item.status}`
        );
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Filter listings by status if provided
    let listings = user.listings || [];
    console.log("Listings before filter:", listings.length);

    if (status && status !== "all") {
      listings = listings.filter((item) => item.status === status);
      console.log("Listings after filter:", listings.length);
    }

    // Format the listings
    const formattedListings = listings.map((item) => ({
      _id: item.productId?._id,
      title: item.productId?.title,
      price: item.productId?.price,
      category: item.productId?.category,
      description: item.productId?.description,
      image: item.productId?.image,
      stock: item.productId?.stock,
      rating: item.productId?.rating,
      features: item.productId?.features || [],
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.productId?.updatedAt,
    }));

    console.log("Formatted listings count:", formattedListings.length);

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedListings = formattedListings.slice(startIndex, endIndex);

    res.json({
      success: true,
      listings: paginatedListings,
      total: formattedListings.length,
      page: parseInt(page),
      totalPages: Math.ceil(formattedListings.length / limit),
      debug: {
        userId,
        directProductsCount: directProducts.length,
        userListingsCount: user.listings?.length || 0,
        formattedCount: formattedListings.length,
      },
    });
  } catch (error) {
    console.error("Get user listings error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch listings",
      error: error.message,
    });
  }
});
// Update a listing
listingRouter.put("/:productId", async (req, res) => {
  console.log("here we go");
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

    // Don't allow updating rating, createdBy, or changing the product owner
    const restrictedFields = ["rating", "createdBy", "_id"];
    for (const field of restrictedFields) {
      if (updates[field] !== undefined) {
        return res.status(400).json({
          success: false,
          message: `Cannot update ${field} field`,
        });
      }
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
      {
        $set: updates,
        updatedAt: Date.now(),
      },
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
});

// Delete a listing
listingRouter.delete("/:productId", async (req, res) => {
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

    // Check if the product exists and get owner info
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check if user owns the listing
    const isOwner = product.createdBy.toString() === userId.toString();

    if (!isOwner) {
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
});
// Get single listing (with authorization check)
listingRouter.get("/listing/:productId", async (req, res) => {
  console.log("get listing");
  try {
    const userId = req.user.userId || req.user._id;
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

    // Check if user owns the listing or is admin
    const user = await User.findOne({
      _id: userId,
      "listings.productId": productId,
    });

    if (!user && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this listing",
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
});

// Update listing status
listingRouter.patch("/:productId/status", async (req, res) => {
  try {
    const userId = req.user.userId || req.user._id;
    const { productId } = req.params;
    const { status } = req.body;

    const validStatuses = ["active", "inactive", "sold", "pending"];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Check if user owns the listing
    const user = await User.findOne({
      _id: userId,
      "listings.productId": productId,
    });

    if (!user && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this listing",
      });
    }

    // Update the listing status in user's listings array
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        "listings.productId": productId,
      },
      {
        $set: { "listings.$.status": status },
      },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "Listing not found in your listings",
      });
    }

    res.json({
      success: true,
      message: `Listing status updated to ${status}`,
      status,
    });
  } catch (error) {
    console.error("Update listing status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update listing status",
      error: error.message,
    });
  }
});

// Admin: Get all listings (with filtering)
listingRouter.get("/admin/all", async (req, res) => {
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
      limit = 20,
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
        .populate("createdBy", "name email"),
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
});

// ============================================
// MOUNT LISTING ROUTES
// ============================================

// Mount listing routes under /listings path
router.use("/listings", listingRouter);

// ============================================
// PUBLIC PARAMETER ROUTES (must come after all specific routes)
// ============================================

// Get single product (public) - This should be LAST
router.get("/:id", async (req, res) => {
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format",
      });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// ============================================
// ADMIN ROUTES (Admin only - for sample data)
// ============================================

// Initialize sample products (Admin only)
router.post("/init-products", async (req, res) => {
  try {
    // You might want to add admin check here
    if (!req.user?.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }
const sampleProducts = [
  {
    title: "iPhone 14 Pro Max",
    price: 1099.99,
    category: "electronics",
    description: "Latest Apple smartphone with advanced camera system",
    image: "https://picsum.photos/400/400?random=1",
    rating: { rate: 4.8, count: 150 },
    stock: 45,
    features: ["5G", "Face ID", "Pro Camera"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "MacBook Pro 16-inch",
    price: 2399.99,
    category: "electronics",
    description: "Professional laptop for creative work",
    image: "https://picsum.photos/400/400?random=2",
    rating: { rate: 4.9, count: 89 },
    stock: 23,
    features: ["M2 Chip", "Retina Display", "Touch Bar"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Samsung Galaxy S23 Ultra",
    price: 1199.99,
    category: "electronics",
    description: "Android flagship with S Pen",
    image: "https://picsum.photos/400/400?random=3",
    rating: { rate: 4.7, count: 210 },
    stock: 67,
    features: ["200MP Camera", "S Pen", "Snapdragon 8 Gen 2"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Sony WH-1000XM5 Headphones",
    price: 399.99,
    category: "electronics",
    description: "Premium noise-canceling wireless headphones",
    image: "https://picsum.photos/400/400?random=4",
    rating: { rate: 4.8, count: 342 },
    stock: 89,
    features: ["Noise Cancelling", "30-hour battery", "Hi-Res Audio"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Apple Watch Series 8",
    price: 429.99,
    category: "electronics",
    description: "Smartwatch with health monitoring features",
    image: "https://picsum.photos/400/400?random=5",
    rating: { rate: 4.6, count: 189 },
    stock: 56,
    features: ["ECG", "Blood Oxygen", "GPS"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Dyson V15 Detect Vacuum",
    price: 749.99,
    category: "electronics",
    description: "Cordless vacuum with laser detection",
    image: "https://picsum.photos/400/400?random=6",
    rating: { rate: 4.7, count: 123 },
    stock: 34,
    features: ["Laser Detection", "60-min runtime", "HEPA filter"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "iPad Pro 12.9-inch",
    price: 1099.99,
    category: "electronics",
    description: "Professional tablet with M2 chip",
    image: "https://picsum.photos/400/400?random=7",
    rating: { rate: 4.8, count: 156 },
    stock: 42,
    features: ["M2 Chip", "Liquid Retina XDR", "Thunderbolt"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "PlayStation 5",
    price: 499.99,
    category: "electronics",
    description: "Next-gen gaming console",
    image: "https://picsum.photos/400/400?random=8",
    rating: { rate: 4.9, count: 456 },
    stock: 15,
    features: ["4K Gaming", "Ray Tracing", "825GB SSD"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Bose SoundLink Revolve+",
    price: 329.99,
    category: "electronics",
    description: "360-degree portable Bluetooth speaker",
    image: "https://picsum.photos/400/400?random=9",
    rating: { rate: 4.6, count: 278 },
    stock: 78,
    features: ["360° Sound", "16-hour battery", "Water Resistant"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "GoPro Hero 11 Black",
    price: 499.99,
    category: "electronics",
    description: "Action camera with 5.3K video",
    image: "https://picsum.photos/400/400?random=10",
    rating: { rate: 4.7, count: 167 },
    stock: 39,
    features: ["5.3K Video", "HyperSmooth 5.0", "Waterproof"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Kindle Paperwhite",
    price: 149.99,
    category: "electronics",
    description: "Waterproof e-reader with adjustable light",
    image: "https://picsum.photos/400/400?random=11",
    rating: { rate: 4.6, count: 312 },
    stock: 91,
    features: ["6.8-inch Display", "Waterproof", "Weeks of battery"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Nintendo Switch OLED",
    price: 349.99,
    category: "electronics",
    description: "Hybrid gaming console with OLED screen",
    image: "https://picsum.photos/400/400?random=12",
    rating: { rate: 4.7, count: 289 },
    stock: 28,
    features: ["OLED Screen", "Handheld/TV Mode", "64GB Storage"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Canon EOS R5",
    price: 3899.99,
    category: "electronics",
    description: "Professional mirrorless camera",
    image: "https://picsum.photos/400/400?random=13",
    rating: { rate: 4.8, count: 89 },
    stock: 12,
    features: ["45MP", "8K Video", "IBIS"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Samsung 85 QLED TV",
    price: 2999.99,
    category: "electronics",
    description: "4K Smart TV with Quantum Dot technology",
    image: "https://picsum.photos/400/400?random=14",
    rating: { rate: 4.7, count: 134 },
    stock: 18,
    features: ["4K QLED", "Smart TV", "Game Mode"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "DJI Mini 3 Pro",
    price: 759.99,
    category: "electronics",
    description: "Compact drone with 4K camera",
    image: "https://picsum.photos/400/400?random=15",
    rating: { rate: 4.7, count: 203 },
    stock: 37,
    features: ["4K HDR Video", "34-min flight", "Under 249g"],
    createdBy: new mongoose.Types.ObjectId(),
  },

  // Fashion (10 items)
  {
    title: "Nike Air Jordan 1 Retro",
    price: 189.99,
    category: "fashion",
    description: "Iconic basketball sneakers",
    image: "https://picsum.photos/400/400?random=16",
    rating: { rate: 4.8, count: 412 },
    stock: 56,
    features: ["Leather Upper", "Air Cushioning", "Classic Design"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Levi's 501 Original Jeans",
    price: 89.99,
    category: "fashion",
    description: "Classic straight fit jeans",
    image: "https://picsum.photos/400/400?random=17",
    rating: { rate: 4.6, count: 567 },
    stock: 123,
    features: ["100% Cotton", "Button Fly", "Straight Fit"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Gucci GG Marmont Bag",
    price: 2499.99,
    category: "fashion",
    description: "Luxury leather shoulder bag",
    image: "https://picsum.photos/400/400?random=18",
    rating: { rate: 4.9, count: 67 },
    stock: 8,
    features: ["Leather", "Gold-tone Hardware", "Adjustable Chain"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Patagonia Nano Puff Jacket",
    price: 229.99,
    category: "fashion",
    description: "Lightweight insulated jacket",
    image: "https://picsum.photos/400/400?random=19",
    rating: { rate: 4.7, count: 289 },
    stock: 45,
    features: ["Water Resistant", "Recycled Materials", "Packable"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Ray-Ban Aviator Sunglasses",
    price: 159.99,
    category: "fashion",
    description: "Classic aviator style sunglasses",
    image: "https://picsum.photos/400/400?random=20",
    rating: { rate: 4.8, count: 456 },
    stock: 89,
    features: ["UV Protection", "Polarized Lenses", "Metal Frame"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Adidas Ultraboost 22",
    price: 189.99,
    category: "fashion",
    description: "Running shoes with Boost technology",
    image: "https://picsum.photos/400/400?random=21",
    rating: { rate: 4.7, count: 378 },
    stock: 67,
    features: ["Boost Midsole", "Primeknit Upper", "Continental Rubber"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Rolex Submariner Date",
    price: 9950.00,
    category: "fashion",
    description: "Luxury dive watch",
    image: "https://picsum.photos/400/400?random=22",
    rating: { rate: 4.9, count: 45 },
    stock: 3,
    features: ["300m Water Resistant", "Ceramic Bezel", "Automatic"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Canada Goose Expedition Parka",
    price: 1495.00,
    category: "fashion",
    description: "Extreme weather winter jacket",
    image: "https://picsum.photos/400/400?random=23",
    rating: { rate: 4.8, count: 156 },
    stock: 14,
    features: ["Down Insulated", "Arctic Tech Fabric", "Fur Trim"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Lululemon Align Leggings",
    price: 98.00,
    category: "fashion",
    description: "Buttery soft yoga leggings",
    image: "https://picsum.photos/400/400?random=24",
    rating: { rate: 4.8, count: 678 },
    stock: 156,
    features: ["Nulu Fabric", "High Waist", "Sweat-wicking"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Burberry Trench Coat",
    price: 1990.00,
    category: "fashion",
    description: "Classic heritage trench coat",
    image: "https://picsum.photos/400/400?random=25",
    rating: { rate: 4.9, count: 89 },
    stock: 9,
    features: ["Gabardine Cotton", "Water Repellent", "Detachable Liner"],
    createdBy: new mongoose.Types.ObjectId(),
  },

  // Home & Kitchen (10 items)
  {
    title: "KitchenAid Stand Mixer",
    price: 429.99,
    category: "home",
    description: "Professional 5-quart stand mixer",
    image: "https://picsum.photos/400/400?random=26",
    rating: { rate: 4.9, count: 234 },
    stock: 38,
    features: ["10 Speeds", "5-Quart Bowl", "Planetary Mixing"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Instant Pot Duo Plus",
    price: 119.99,
    category: "home",
    description: "9-in-1 electric pressure cooker",
    image: "https://picsum.photos/400/400?random=27",
    rating: { rate: 4.7, count: 567 },
    stock: 89,
    features: ["Pressure Cooker", "Slow Cooker", "Yogurt Maker"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Casper Original Mattress",
    price: 895.00,
    category: "home",
    description: "Memory foam mattress",
    image: "https://picsum.photos/400/400?random=28",
    rating: { rate: 4.6, count: 456 },
    stock: 23,
    features: ["Memory Foam", "100-Night Trial", "Free Shipping"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Le Creuset Dutch Oven",
    price: 379.99,
    category: "home",
    description: "Enameled cast iron cookware",
    image: "https://picsum.photos/400/400?random=29",
    rating: { rate: 4.9, count: 189 },
    stock: 17,
    features: ["Cast Iron", "Enamel Finish", "Even Heating"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Roomba i7+ Robot Vacuum",
    price: 999.99,
    category: "home",
    description: "Self-emptying robot vacuum",
    image: "https://picsum.photos/400/400?random=30",
    rating: { rate: 4.6, count: 278 },
    stock: 42,
    features: ["Self-Emptying", "Smart Mapping", "Voice Control"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Vitamix 5200 Blender",
    price: 449.99,
    category: "home",
    description: "Professional-grade blender",
    image: "https://picsum.photos/400/400?random=31",
    rating: { rate: 4.8, count: 345 },
    stock: 29,
    features: ["2.2 HP Motor", "Variable Speed", "Self-Cleaning"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Nespresso VertuoPlus",
    price: 199.99,
    category: "home",
    description: "Coffee and espresso machine",
    image: "https://picsum.photos/400/400?random=32",
    rating: { rate: 4.7, count: 412 },
    stock: 67,
    features: ["Centrifusion Technology", "19oz Reservoir", "Fast Heat-up"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Cuisinart Air Fryer",
    price: 129.99,
    category: "home",
    description: "Digital air fryer with oven",
    image: "https://picsum.photos/400/400?random=33",
    rating: { rate: 4.5, count: 289 },
    stock: 54,
    features: ["Digital Controls", "60-min Timer", "Non-Stick Basket"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "West Elm Sofa",
    price: 1899.99,
    category: "home",
    description: "Modern sectional sofa",
    image: "https://picsum.photos/400/400?random=34",
    rating: { rate: 4.6, count: 123 },
    stock: 8,
    features: ["Performance Fabric", "Down Cushions", "Modular"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "All-Clad Stainless Steel Cookware Set",
    price: 799.99,
    category: "home",
    description: "10-piece professional cookware set",
    image: "https://picsum.photos/400/400?random=35",
    rating: { rate: 4.9, count: 167 },
    stock: 15,
    features: ["Tri-Ply Construction", "Oven Safe", "Dishwasher Safe"],
    createdBy: new mongoose.Types.ObjectId(),
  },

  // Books (8 items)
  {
    title: "Atomic Habits by James Clear",
    price: 16.99,
    category: "books",
    description: "Build good habits and break bad ones",
    image: "https://picsum.photos/400/400?random=36",
    rating: { rate: 4.8, count: 2345 },
    stock: 156,
    features: ["Self-Help", "336 Pages", "Hardcover"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "It Ends With Us by Colleen Hoover",
    price: 13.99,
    category: "books",
    description: "Contemporary romance novel",
    image: "https://picsum.photos/400/400?random=37",
    rating: { rate: 4.7, count: 1890 },
    stock: 234,
    features: ["Fiction", "384 Pages", "Paperback"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "The Hobbit by J.R.R. Tolkien",
    price: 12.99,
    category: "books",
    description: "Fantasy adventure novel",
    image: "https://picsum.photos/400/400?random=38",
    rating: { rate: 4.9, count: 4567 },
    stock: 345,
    features: ["Fantasy", "310 Pages", "Illustrated"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Educated by Tara Westover",
    price: 15.99,
    category: "books",
    description: "Memoir about self-education",
    image: "https://picsum.photos/400/400?random=39",
    rating: { rate: 4.7, count: 1567 },
    stock: 189,
    features: ["Memoir", "352 Pages", "National Book Award"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Dune by Frank Herbert",
    price: 18.99,
    category: "books",
    description: "Science fiction classic",
    image: "https://picsum.photos/400/400?random=40",
    rating: { rate: 4.8, count: 2345 },
    stock: 167,
    features: ["Sci-Fi", "896 Pages", "Special Edition"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Harry Potter Box Set",
    price: 79.99,
    category: "books",
    description: "Complete 7-book collection",
    image: "https://picsum.photos/400/400?random=41",
    rating: { rate: 4.9, count: 6789 },
    stock: 89,
    features: ["Fantasy", "7 Books", "Illustrated Covers"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "The Silent Patient by Alex Michaelides",
    price: 14.99,
    category: "books",
    description: "Psychological thriller",
    image: "https://picsum.photos/400/400?random=42",
    rating: { rate: 4.5, count: 1234 },
    stock: 256,
    features: ["Thriller", "336 Pages", "#1 Bestseller"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Sapiens by Yuval Noah Harari",
    price: 19.99,
    category: "books",
    description: "Brief history of humankind",
    image: "https://picsum.photos/400/400?random=43",
    rating: { rate: 4.8, count: 3456 },
    stock: 178,
    features: ["History", "464 Pages", "Updated Edition"],
    createdBy: new mongoose.Types.ObjectId(),
  },

  // Sports & Outdoors (8 items)
  {
    title: "Yeti Tundra 65 Cooler",
    price: 399.99,
    category: "sports",
    description: "Roto-molded hard cooler",
    image: "https://picsum.photos/400/400?random=44",
    rating: { rate: 4.8, count: 456 },
    stock: 34,
    features: ["Bear Resistant", "5-year Warranty", "Drain Plug"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Peloton Bike+",
    price: 2495.00,
    category: "sports",
    description: "Interactive exercise bike",
    image: "https://picsum.photos/400/400?random=45",
    rating: { rate: 4.7, count: 567 },
    stock: 23,
    features: ["24-inch Touchscreen", "Auto-Follow Resistance", "Speakers"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Oru Kayak Bay ST",
    price: 1299.99,
    category: "sports",
    description: "Foldable kayak",
    image: "https://picsum.photos/400/400?random=46",
    rating: { rate: 4.6, count: 123 },
    stock: 12,
    features: ["Folds in 3 Minutes", "23 lbs", "UV Resistant"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Garmin Fenix 7",
    price: 699.99,
    category: "sports",
    description: "Multisport GPS watch",
    image: "https://picsum.photos/400/400?random=47",
    rating: { rate: 4.8, count: 289 },
    stock: 45,
    features: ["Solar Charging", "Topo Maps", "HR Monitor"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Hydro Flask 32oz Water Bottle",
    price: 44.95,
    category: "sports",
    description: "Insulated stainless steel bottle",
    image: "https://picsum.photos/400/400?random=48",
    rating: { rate: 4.7, count: 789 },
    stock: 156,
    features: ["24-hour Cold", "12-hour Hot", "BPA Free"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Coleman Sundome Tent",
    price: 89.99,
    category: "sports",
    description: "4-person dome tent",
    image: "https://picsum.photos/400/400?random=49",
    rating: { rate: 4.5, count: 456 },
    stock: 67,
    features: ["WeatherTec System", "10-minute Setup", "Windows"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Wilson Evolution Basketball",
    price: 64.99,
    category: "sports",
    description: "Official game basketball",
    image: "https://picsum.photos/400/400?random=50",
    rating: { rate: 4.9, count: 345 },
    stock: 89,
    features: ["Microfiber Cover", "Indoor/Outdoor", "Official Size"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "YETI Hopper Flip 12",
    price: 249.99,
    category: "sports",
    description: "Portable soft cooler",
    image: "https://picsum.photos/400/400?random=51",
    rating: { rate: 4.7, count: 234 },
    stock: 56,
    features: ["Waterproof", "ColdCell Insulation", "Magnetic Closure"],
    createdBy: new mongoose.Types.ObjectId(),
  },

  // Beauty & Health (6 items)
  {
    title: "Dyson Airwrap Complete",
    price: 599.99,
    category: "beauty",
    description: "Hair styling tool with air wrap technology",
    image: "https://picsum.photos/400/400?random=52",
    rating: { rate: 4.6, count: 456 },
    stock: 28,
    features: ["Multiple Attachments", "Heat Control", "Cordless Option"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Philips Sonicare Electric Toothbrush",
    price: 199.99,
    category: "beauty",
    description: "Premium electric toothbrush",
    image: "https://picsum.photos/400/400?random=53",
    rating: { rate: 4.8, count: 789 },
    stock: 123,
    features: ["3 Modes", "Pressure Sensor", "Travel Case"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "La Mer Crème de la Mer",
    price: 385.00,
    category: "beauty",
    description: "Luxury moisturizing cream",
    image: "https://picsum.photos/400/400?random=54",
    rating: { rate: 4.7, count: 234 },
    stock: 45,
    features: ["Miracle Broth", "Hydrating", "Anti-Aging"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Oral-B iO Series 9",
    price: 299.99,
    category: "beauty",
    description: "Smart electric toothbrush",
    image: "https://picsum.photos/400/400?random=55",
    rating: { rate: 4.7, count: 345 },
    stock: 67,
    features: ["AI Recognition", "7 Modes", "Smart Display"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Foreo Luna 3",
    price: 199.00,
    category: "beauty",
    description: "Facial cleansing device",
    image: "https://picsum.photos/400/400?random=56",
    rating: { rate: 4.6, count: 278 },
    stock: 89,
    features: ["Silicone Bristles", "12 Speeds", "Waterproof"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Theragun PRO",
    price: 599.00,
    category: "beauty",
    description: "Professional-grade massage gun",
    image: "https://picsum.photos/400/400?random=57",
    rating: { rate: 4.8, count: 189 },
    stock: 34,
    features: ["5 Speeds", "6 Attachments", "Quiet Force Technology"],
    createdBy: new mongoose.Types.ObjectId(),
  },

  // Toys & Games (4 items)
  {
    title: "LEGO Millennium Falcon",
    price: 849.99,
    category: "toys",
    description: "Ultimate collector series Star Wars set",
    image: "https://picsum.photos/400/400?random=58",
    rating: { rate: 4.9, count: 123 },
    stock: 8,
    features: ["7541 Pieces", "Collector's Edition", "Display Stand"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Play-Doh Fun Factory",
    price: 19.99,
    category: "toys",
    description: "Classic modeling compound set",
    image: "https://picsum.photos/400/400?random=59",
    rating: { rate: 4.6, count: 456 },
    stock: 156,
    features: ["10 Colors", "Extruder", "Non-Toxic"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Barbie Dreamhouse",
    price: 249.99,
    category: "toys",
    description: "Three-story dollhouse with elevator",
    image: "https://picsum.photos/400/400?random=60",
    rating: { rate: 4.7, count: 234 },
    stock: 45,
    features: ["75+ Pieces", "Light & Sound", "Working Elevator"],
    createdBy: new mongoose.Types.ObjectId(),
  },
  {
    title: "Monopoly Ultimate Banking Edition",
    price: 29.99,
    category: "toys",
    description: "Electronic banking board game",
    image: "https://picsum.photos/400/400?random=61",
    rating: { rate: 4.5, count: 189 },
    stock: 89,
    features: ["Electronic Banking", "Fast Gameplay", "Property Cards"],
    createdBy: new mongoose.Types.ObjectId(),
  }
];

    // Clear existing products first
    await Product.deleteMany({});

    // Insert new products
    const products = await Product.insertMany(sampleProducts);

    res.status(201).json({
      success: true,
      message: `${products.length} products initialized successfully`,
      count: products.length,
      products: products.map((product) => ({
        id: product._id,
        title: product.title,
        price: product.price,
        category: product.category,
        image: product.image,
        rating: product.rating,
        stock: product.stock,
      })),
    });
  } catch (error) {
    console.error("Init products error:", error);
    res.status(500).json({
      success: false,
      message: "Error initializing products",
      error: error.message,
    });
  }
});

module.exports = router;
