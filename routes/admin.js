const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { verifyAdmin, checkAdminStatus } = require("../middleware/adminAuth");

// @route   POST /api/admin/login
// @desc    Admin login
// @access  Public
router.post("/login", adminController.adminLogin);

// @route   GET /api/admin/check-status
// @desc    Check admin status
// @access  Private
router.get("/check-status", checkAdminStatus);

// @route   GET /api/admin/stats
// @desc    Get dashboard statistics
// @access  Private/Admin
router.get("/stats", verifyAdmin, adminController.getDashboardStats);

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private/Admin
router.get("/users", verifyAdmin, adminController.getAllUsers);

// @route   GET /api/admin/users/:id
// @desc    Get user by ID
// @access  Private/Admin
router.get("/users/:id", verifyAdmin, adminController.getUserById);

// @route   PUT /api/admin/users/:id
// @desc    Update user
// @access  Private/Admin
router.put("/users/:id", verifyAdmin, adminController.updateUser);

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete("/users/:id", verifyAdmin, adminController.deleteUser);
router.post("/users", verifyAdmin, adminController.createUser);

// @route   GET /api/admin/products
// @desc    Get all products
// @access  Private/Admin
router.get("/products", verifyAdmin, adminController.getAllProducts);
router.put("/products/:id", verifyAdmin, adminController.updateProduct);
router.delete("/products/:id", verifyAdmin, adminController.deleteProduct);
router.post("/products", verifyAdmin, adminController.createProduct);
// @route   GET /api/admin/orders
// @desc    Get all orders
// @access  Private/Admin
router.get("/orders", verifyAdmin, adminController.getAllOrders);

// @route   GET /api/admin/orders/:id
// @desc    Get order by ID
// @access  Private/Admin
router.get("/orders/:id", verifyAdmin, adminController.getOrderById);

// @route   PUT /api/admin/orders/:id
// @desc    Update order status
// @access  Private/Admin
router.put("/orders/:id", verifyAdmin, adminController.updateOrderStatus);

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private/Admin
router.get("/analytics", verifyAdmin, adminController.getAnalytics);

// In adminRoutes.js
router.get(
  "/products/low-stock",
  verifyAdmin,
  adminController.getLowStockProducts
);
router.post("/orders/create", verifyAdmin, adminController.createOrder);
router.post("/backup", verifyAdmin, adminController.backupDatabase);
router.get("/activity", verifyAdmin, adminController.getAdminActivity);

module.exports = router;
