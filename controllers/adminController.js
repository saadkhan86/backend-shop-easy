const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Product = require("../models/product");
const Order = require("../models/order");
const mongoose=require("mongoose");
// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // Find user with password selected
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin privileges required.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated.",
      });
    }

    // Check password
    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Create token
    const token = jwt.sign(
      {
        id: user._id,
        isAdmin: user.isAdmin,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );

    // Set cookie for web admin panel
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Admin login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    ////console.error("Admin login error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Admin logout
// @route   POST /api/admin/logout
// @access  Private/Admin
exports.adminLogout = async (req, res) => {
  try {
    res.clearCookie("adminToken");
    res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    ////console.error("Admin logout error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all users (for admin)
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const role = req.query.role;

    // Build search query
    let query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { contact: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by role
    if (role === "admin") {
      query.isAdmin = true;
    } else if (role === "user") {
      query.isAdmin = false;
    }

    // Filter by active status
    if (req.query.active === "true") {
      query.isActive = true;
    } else if (req.query.active === "false") {
      query.isActive = false;
    }

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    // Get users with pagination
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-password -resetPasswordToken -resetPasswordExpire");

    res.status(200).json({
      success: true,
      count: users.length,
      totalUsers,
      totalPages,
      currentPage: page,
      users: users.map((user) => user.getUserSummary()),
    });
  } catch (error) {
    ////console.error("Get all users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get user by ID (admin)
// @route   GET /api/admin/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -resetPasswordToken -resetPasswordExpire")
      .populate({
        path: "orders",
        select: "orderNumber totalPrice orderStatus createdAt",
        options: { limit: 10, sort: { createdAt: -1 } },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get user statistics
    const userStats = await Order.aggregate([
      { $match: { user: user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$totalPrice" },
          averageOrder: { $avg: "$totalPrice" },
        },
      },
    ]);

    const stats = userStats[0] || {
      totalOrders: 0,
      totalSpent: 0,
      averageOrder: 0,
    };

    res.status(200).json({
      success: true,
      user: {
        ...user.getUserSummary(),
        stats,
      },
    });
  } catch (error) {
    ////console.error("Get user by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create new user (admin)
// @route   POST /api/admin/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, contact, country, isAdmin, isActive } =
      req.body;

    // Validate required fields
    if (!name || !email || !contact || !country) {
      return res.status(400).json({
        success: false,
        message: "Please provide name, email, contact, and country",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Clean and validate phone number
    const cleanPhoneNumber = (phone) => {
      if (!phone) return "";

      // Remove all non-digit characters except leading +
      let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");

      // If it starts with +, keep it
      const hasPlus = cleaned.startsWith("+");
      if (hasPlus) {
        // Keep the + and ensure only digits follow
        cleaned = "+" + cleaned.substring(1).replace(/\D/g, "");
      } else {
        // No +, just digits
        cleaned = cleaned.replace(/\D/g, "");
      }

      return cleaned;
    };

    const cleanContact = cleanPhoneNumber(contact);

    // Validate phone number length
    const digitLength = cleanContact.startsWith("+")
      ? cleanContact.length - 1 // Don't count the +
      : cleanContact.length;

    if (digitLength < 10 || digitLength > 15) {
      return res.status(400).json({
        success: false,
        message: `Phone number must be 10-15 digits. You provided ${digitLength} digits.`,
        formattedNumber: cleanContact, // Show them what was processed
      });
    }

    // Generate password if not provided
    let userPassword = password;
    let passwordGenerated = false;

    if (!userPassword) {
      // Generate a random 8-character password
      userPassword =
        Math.random().toString(36).slice(-8) +
        Math.floor(Math.random() * 10) +
        Math.random().toString(36).slice(-8).toUpperCase();
      passwordGenerated = true;
    }

    // Create new user
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: userPassword,
      contact: cleanContact, // Use cleaned and validated contact
      country: country.trim(),
      isAdmin: Boolean(isAdmin),
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      emailVerified: true,
      createdByAdmin: true,
    });

    const responseData = {
      success: true,
      message: "User created successfully",
      user: user.getUserSummary(),
      formattedContact: cleanContact, // Show the formatted contact
    };

    // Include generated password in response if it was generated
    if (passwordGenerated) {
      responseData.generatedPassword = userPassword;
      responseData.message += ". Password was auto-generated.";
    }

    res.status(201).json(responseData);
  } catch (error) {
    // ////console.error("Create user error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      // Extract specific validation error messages
      const validationErrors = {};
      for (const field in error.errors) {
        validationErrors[field] = error.errors[field].message;
      }

      return res.status(400).json({
        success: false,
        message: "User validation failed",
        errors: validationErrors,
        help: {
          contact:
            "Phone number must be 10-15 digits. Examples: +923095723247 or 03095723247",
        },
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Email already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while creating user",
      error: error.message,
    });
  }
};

// Also update the updateUser function
exports.updateUser = async (req, res) => {
  try {
    const { name, email, contact, country, isAdmin, isActive, password } =
      req.body;

    // Find user
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from removing their own admin status
    if (req.user.id === req.params.id && isAdmin === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin privileges",
      });
    }

    // Update fields
    const updateFields = {};
    if (name) updateFields.name = name.trim();
    if (email) updateFields.email = email.trim().toLowerCase();
    if (contact) {
      // Clean contact field
      const cleanContact = contact.toString().replace(/\D/g, "");
      if (cleanContact.length < 10 || cleanContact.length > 15) {
        return res.status(400).json({
          success: false,
          message: "Contact number must be 10-15 digits",
        });
      }
      updateFields.contact = cleanContact;
    }
    if (country) updateFields.country = country.trim();
    if (typeof isAdmin !== "undefined") updateFields.isAdmin = Boolean(isAdmin);
    if (typeof isActive !== "undefined")
      updateFields.isActive = Boolean(isActive);

    // Update password if provided
    if (password && password.trim() !== "") {
      updateFields.password = password;
    }

    // Check for duplicate email if email is being updated
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).select("-password -resetPasswordToken -resetPasswordExpire");

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser.getUserSummary(),
    });
  } catch (error) {
    // ////console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// @desc    Update user (admin)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { name, email, contact, isAdmin, isActive, password } = req.body;

    // Find user
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from removing their own admin status
    if (req.user.id === req.params.id && isAdmin === false) {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin privileges",
      });
    }

    // Update fields
    const updateFields = {};
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (contact) updateFields.contact = contact;
    if (typeof isAdmin !== "undefined") updateFields.isAdmin = isAdmin;
    if (typeof isActive !== "undefined") updateFields.isActive = isActive;

    // Update password if provided
    if (password) {
      updateFields.password = password;
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).select("-password -resetPasswordToken -resetPasswordExpire");

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser.getUserSummary(),
    });
  } catch (error) {
    // ////console.error("Update user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete user (admin)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.user.id === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user has orders
    const userOrders = await Order.countDocuments({ user: user._id });
    if (userOrders > 0) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete user with existing orders. Consider deactivating instead.",
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    // ////console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all products (admin)
// @route   GET /api/admin/products
// @access  Private/Admin
exports.getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const category = req.query.category;
    const status = req.query.status;

    // Build search query
    let query = {};

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }

    if (category) {
      query.category = category;
    }

    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }

    // Get total count for pagination
    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    // Get products with pagination
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("reviews", "rating");

    res.status(200).json({
      success: true,
      count: products.length,
      totalProducts,
      totalPages,
      currentPage: page,
      products: products.map((product) => ({
        ...product.toObject(),
        averageRating: product.getAverageRating(),
        totalReviews: product.reviews?.length || 0,
      })),
    });
  } catch (error) {
    // ////console.error("Get all products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get low stock products
// @route   GET /api/admin/products/low-stock
// @access  Private/Admin
exports.getLowStockProducts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const lowStockProducts = await Product.find({
      stock: { $lt: threshold },
      isActive: true,
    })
      .sort({ stock: 1 })
      .limit(50);

    res.status(200).json({
      success: true,
      count: lowStockProducts.length,
      threshold,
      products: lowStockProducts,
    });
  } catch (error) {
    ////console.error("Get low stock products error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create product (admin)
// @route   POST /api/admin/products
// @access  Private/Admin
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      price,
      category,
      description,
      image,
      stock,
      status,
      featured,
    } = req.body;

    // Map frontend field names to backend schema
    const productData = {
      title: name, // Map 'name' to 'title'
      price: parseFloat(price),
      category: category || "uncategorized",
      description: description || "",
      image: image || "",
      rating: {
        rate: 0,
        count: 0,
      },
      stock: parseInt(stock) || 0,
      features: [], // Empty features array by default
    };

    // Add features if provided
    if (req.body.features && Array.isArray(req.body.features)) {
      productData.features = req.body.features;
    }

    const product = await Product.create(productData);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    ////console.error("Create product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
// @desc    Update product (admin)
// @route   PUT /api/admin/products/:id
// @access  Private/Admin
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    ////console.error("Update product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete product (admin)
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
exports.deleteProduct = async (req, res) => {
  try {
    const { id: productId } = req.params;

    // Validate productId
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
        message: "Product not found",
      });
    }

    // Check if product has orders
    const productOrders = await Order.countDocuments({
      "items.product": productId,
    });

    if (productOrders > 0) {
      // Soft delete instead of hard delete
      product.isActive = false;
      await product.save();

      return res.status(200).json({
        success: true,
        message: "Product deactivated (has existing orders)",
        product,
      });
    }

    // Get the product owner ID before deletion
    const ownerId = product.createdBy;

    // 1. Delete the product
    await Product.findByIdAndDelete(productId);

    // 2. Remove product from owner's listings array
    await User.findByIdAndUpdate(
      ownerId,
      {
        $pull: {
          listings: { productId: productId },
        },
      },
      { new: true }
    );

    // 3. Remove product from ALL users' carts
    await User.updateMany(
      { "cart.productId": productId },
      {
        $pull: {
          cart: { productId: productId },
        },
      }
    );

    // 4. Remove product from ALL users' wishlists
    await User.updateMany(
      { "wishlist.productId": productId },
      {
        $pull: {
          wishlist: { productId: productId },
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Product deleted successfully and cleaned up from all user data",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get all orders (admin)
// @route   GET /api/admin/orders
// @access  Private/Admin
exports.getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const status = req.query.status || "";
    const paymentStatus = req.query.paymentStatus || "";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query
    let query = {};

    if (status) {
      query.orderStatus = status;
    }

    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Get total count
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get orders with pagination
    const orders = await Order.find(query)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Calculate total revenue for the filtered results
    const revenueData = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalPrice" },
          averageOrderValue: { $avg: "$totalPrice" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: orders.length,
      totalOrders,
      totalPages,
      currentPage: page,
      totalRevenue: revenueData[0]?.totalRevenue || 0,
      averageOrderValue: revenueData[0]?.averageOrderValue || 0,
      orders: orders.map((order) => order.getOrderSummary()),
    });
  } catch (error) {
    ////console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get order by ID (admin)
// @route   GET /api/admin/orders/:id
// @access  Private/Admin
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email contact address")
      .populate("items.product", "title price image sku");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.status(200).json({
      success: true,
      order: order.getOrderDetails(),
    });
  } catch (error) {
    ////console.error("Get order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create order (admin)
// @route   POST /api/admin/orders
// @access  Private/Admin
exports.createOrder = async (req, res) => {
  try {
    const { userId, items, shippingAddress, paymentMethod, notes } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Calculate total price and validate products
    let totalPrice = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product ${item.product} not found`,
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.title}`,
        });
      }

      orderItems.push({
        product: product._id,
        name: product.title,
        quantity: item.quantity,
        price: product.price,
        image: product.image,
      });

      totalPrice += item.quantity * product.price;
    }

    // Create order
    const order = await Order.create({
      user: userId,
      items: orderItems,
      totalPrice,
      shippingAddress: shippingAddress || user.address,
      paymentMethod: paymentMethod || "Cash on Delivery",
      notes,
      createdByAdmin: req.user.id,
    });

    // Update product stock
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order: order.getOrderDetails(),
    });
  } catch (error) {
    ////console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update order status (admin)
// @route   PUT /api/admin/orders/:id
// @access  Private/Admin
exports.updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, notes, trackingNumber } = req.body;

    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update fields
    const updateFields = {};
    if (orderStatus) updateFields.orderStatus = orderStatus;
    if (paymentStatus) updateFields.paymentStatus = paymentStatus;
    if (notes) updateFields.notes = notes;

    // Update shipping details if provided
    if (trackingNumber) {
      updateFields["shippingDetails.trackingNumber"] = trackingNumber;
      if (orderStatus === "Shipped" && order.orderStatus !== "Shipped") {
        updateFields["shippingDetails.shippedDate"] = new Date();
      }
    }

    // Set delivered date if status changed to Delivered
    if (orderStatus === "Delivered" && order.orderStatus !== "Delivered") {
      updateFields["shippingDetails.deliveredDate"] = new Date();
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true }
    ).populate("user", "name email");

    res.status(200).json({
      success: true,
      message: "Order updated successfully",
      order: updatedOrder.getOrderSummary(),
    });
  } catch (error) {
    ////console.error("Update order error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Get counts in parallel for better performance
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      newUsersToday,
      newProductsToday,
      activeUsers,
      lowStockProducts,
      pendingOrders,
      completedOrders,
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      Product.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ lastLogin: { $gte: lastMonth } }),
      Product.countDocuments({ stock: { $lt: 10 }, isActive: true }),
      Order.countDocuments({ orderStatus: "Pending" }),
      Order.countDocuments({ orderStatus: "Delivered" }),
    ]);
    // Get revenue data
    const revenueData = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalPrice" },
          todayRevenue: {
            $sum: {
              $cond: [{ $gte: ["$createdAt", today] }, "$totalPrice", 0],
            },
          },
          yesterdayRevenue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$createdAt", yesterday] },
                    { $lt: ["$createdAt", today] },
                  ],
                },
                "$totalPrice",
                0,
              ],
            },
          },
          averageOrderValue: { $avg: "$totalPrice" },
        },
      },
    ]);

    // Get sales trend for last 7 days
    const salesTrend = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastWeek },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const revenue = revenueData[0] || {
      totalRevenue: 0,
      todayRevenue: 0,
      yesterdayRevenue: 0,
      averageOrderValue: 0,
    };

    // Calculate percentage changes
    const revenueChange = revenue.yesterdayRevenue
      ? ((revenue.todayRevenue - revenue.yesterdayRevenue) /
          revenue.yesterdayRevenue) *
        100
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        newUsersToday,
        newProductsToday,
        activeUsers,
        lowStockProducts,
        pendingOrders,
        completedOrders,
        revenue: {
          total: revenue.totalRevenue,
          today: revenue.todayRevenue,
          average: revenue.averageOrderValue,
          change: revenueChange.toFixed(2),
        },
        salesTrend,
      },
    });
  } catch (error) {
    ////console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get analytics data
// @route   GET /api/admin/analytics
// @access  Private/Admin
exports.getAnalytics = async (req, res) => {
  try {
    const period = req.query.period || "month"; // day, week, month, year
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Calculate date range based on period
    let dateRange = {};
    const now = new Date();

    if (startDate && endDate) {
      dateRange.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else {
      const start = new Date();

      switch (period) {
        case "day":
          start.setDate(start.getDate() - 1);
          break;
        case "week":
          start.setDate(start.getDate() - 7);
          break;
        case "month":
          start.setMonth(start.getMonth() - 1);
          break;
        case "year":
          start.setFullYear(start.getFullYear() - 1);
          break;
        default:
          start.setMonth(start.getMonth() - 1);
      }

      dateRange.createdAt = { $gte: start, $lte: now };
    }

    // Run analytics queries in parallel
    const [
      revenueAnalytics,
      orderStatusStats,
      paymentMethodStats,
      topProducts,
      topCustomers,
      categorySales,
    ] = await Promise.all([
      // Revenue analytics
      Order.aggregate([
        { $match: dateRange },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalPrice" },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: "$totalPrice" },
            minOrderValue: { $min: "$totalPrice" },
            maxOrderValue: { $max: "$totalPrice" },
          },
        },
      ]),

      // Order status distribution
      Order.aggregate([
        { $match: dateRange },
        {
          $group: {
            _id: "$orderStatus",
            count: { $sum: 1 },
            revenue: { $sum: "$totalPrice" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Payment method distribution
      Order.aggregate([
        { $match: dateRange },
        {
          $group: {
            _id: "$paymentMethod",
            count: { $sum: 1 },
            revenue: { $sum: "$totalPrice" },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // Top selling products
      Order.aggregate([
        { $match: dateRange },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product",
            name: { $first: "$items.name" },
            quantity: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.quantity", "$items.price"] },
            },
          },
        },
        { $sort: { quantity: -1 } },
        { $limit: 10 },
      ]),

      // Top customers
      Order.aggregate([
        { $match: dateRange },
        {
          $group: {
            _id: "$user",
            orderCount: { $sum: 1 },
            totalSpent: { $sum: "$totalPrice" },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
      ]),

      // Sales by category
      Order.aggregate([
        { $match: dateRange },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: "$productDetails.category",
            orderCount: { $sum: 1 },
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.price" },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    // Get daily/hourly sales breakdown
    const groupFormat = period === "day" ? "%H" : "%Y-%m-%d";
    const salesTrend = await Order.aggregate([
      { $match: dateRange },
      {
        $group: {
          _id: {
            $dateToString: { format: groupFormat, date: "$createdAt" },
          },
          orders: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Populate customer details for top customers
    const topCustomersWithDetails = await User.populate(topCustomers, {
      path: "_id",
      select: "name email",
    });

    res.status(200).json({
      success: true,
      analytics: {
        period,
        dateRange: {
          start: dateRange.createdAt?.$gte || null,
          end: dateRange.createdAt?.$lte || null,
        },
        overview: revenueAnalytics[0] || {
          totalRevenue: 0,
          totalOrders: 0,
          averageOrderValue: 0,
          minOrderValue: 0,
          maxOrderValue: 0,
        },
        orderStatus: orderStatusStats,
        paymentMethods: paymentMethodStats,
        topProducts: await Product.populate(topProducts, {
          path: "_id",
          select: "title image category",
        }),
        topCustomers: topCustomersWithDetails,
        categories: categorySales,
        salesTrend,
      },
    });
  } catch (error) {
    ////console.error("Get analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Export data
// @route   GET /api/admin/export/:type
// @access  Private/Admin
exports.exportData = async (req, res) => {
  try {
    const { type } = req.params;
    const format = req.query.format || "json";

    let data;
    let filename;

    switch (type) {
      case "users":
        data = await User.find().select("-password");
        filename = `users-${Date.now()}`;
        break;
      case "products":
        data = await Product.find().populate("reviews");
        filename = `products-${Date.now()}`;
        break;
      case "orders":
        data = await Order.find()
          .populate("user", "name email")
          .populate("items.product", "title sku");
        filename = `orders-${Date.now()}`;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Invalid export type",
        });
    }

    if (format === "csv") {
      // Convert to CSV (you might want to use a library like json2csv)
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${filename}.csv`
      );
      // Implement CSV conversion logic here
      return res.send("CSV export not implemented yet");
    }

    // Default JSON export
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filename}.json`
    );

    res.status(200).json({
      success: true,
      exportedAt: new Date().toISOString(),
      count: data.length,
      [type]: data,
    });
  } catch (error) {
    ////console.error("Export data error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Backup database (simplified version)
// @route   POST /api/admin/backup
// @access  Private/Admin
exports.backupDatabase = async (req, res) => {
  try {
    // This is a simplified backup - in production, use proper backup strategies
    const backupData = {
      timestamp: new Date().toISOString(),
      users: await User.countDocuments(),
      products: await Product.countDocuments(),
      orders: await Order.countDocuments(),
      stats: await exports.getDashboardStats(req, res),
    };

    // In a real application, you would:
    // 1. Connect to database and dump data
    // 2. Compress the backup
    // 3. Store in cloud storage (S3, Google Cloud, etc.)
    // 4. Log the backup operation

    res.status(200).json({
      success: true,
      message: "Backup initiated successfully",
      backup: {
        id: `backup-${Date.now()}`,
        timestamp: backupData.timestamp,
        summary: backupData,
        downloadUrl: null, // You would generate a signed URL here
      },
    });
  } catch (error) {
    ////console.error("Backup error:", error);
    res.status(500).json({
      success: false,
      message: "Backup failed",
      error: error.message,
    });
  }
};

// @desc    Get admin activity log
// @route   GET /api/admin/activity
// @access  Private/Admin
exports.getAdminActivity = async (req, res) => {
  try {
    // This would typically come from a separate Activity model
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Mock activity data - in production, log admin actions to a database
    const activities = [
      {
        _id: "1",
        admin: req.user.name,
        action: "login",
        description: "Admin logged in",
        timestamp: new Date(),
        ipAddress: req.ip,
      },
    ];

    res.status(200).json({
      success: true,
      activities,
      page,
      limit,
    });
  } catch (error) {
    ////console.error("Get admin activity error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
