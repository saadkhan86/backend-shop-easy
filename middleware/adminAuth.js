const jwt = require("jsonwebtoken");
const User = require("../models/user"); // DIRECT IMPORT - Remove getModels()

// Middleware to verify admin
exports.verifyAdmin = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Use User directly (no getModels())
    const user = await User.findById(decoded.userId || decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid token. User not found.",
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

    // Attach user to request
    req.user = {
      id: user._id,
      userId: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    };

    next();
  } catch (error) {
    console.error("Admin auth error:", error);

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token.",
      });
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Check admin status without authentication (for frontend checks)
exports.checkAdminStatus = async (req, res) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return res.status(200).json({
        success: true,
        isAdmin: false,
        message: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId || decoded.id);

    if (!user) {
      return res.status(200).json({
        success: true,
        isAdmin: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      isAdmin: user.isAdmin === true,
      user: user.getUserSummary
        ? user.getUserSummary()
        : {
            _id: user._id,
            name: user.name,
            email: user.email,
            isAdmin: user.isAdmin,
          },
    });
  } catch (error) {
    res.status(200).json({
      success: true,
      isAdmin: false,
      message: error.message,
    });
  }
};
// In your adminController.js

// 1. Get products with low stock
exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({ stock: { $lt: 10 } });
    
    res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// 2. Create order (admin initiated)
exports.createOrder = async (req, res) => {
  try {
    // Implementation for admin creating orders
    const { userId, items, shippingAddress, paymentMethod } = req.body;
    
    // Create order logic here
    
    res.status(201).json({
      success: true,
      message: "Order created successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

// 3. Database backup
exports.backupDatabase = async (req, res) => {
  try {
    // Backup logic here
    
    res.status(200).json({
      success: true,
      message: "Backup initiated successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Backup failed"
    });
  }
};