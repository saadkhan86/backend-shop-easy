const express = require("express");
const cors = require("cors");
require("dotenv").config();
// const User = require("./models/user");

const connectDB = require("./config/database");

// Import routes
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const cartRoutes = require("./routes/cart");
const passwordRoutes = require("./routes/password");
const adminRoutes = require("./routes/admin"); // Admin routes

const app = express()
// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json());
// ========== TEMPORARY ADMIN MAKER ROUTE ==========
// Add this to make yourself admin (remove after use)
app.get("/make-me-admin", async (req, res) => {
  try {
    const User = require("./models/user");

    // ⬇️ CHANGE THIS TO YOUR ACTUAL EMAIL ⬇️
    const YOUR_EMAIL = "sk8613013@gmail.com";

    const user = await User.findOneAndUpdate(
      { email: YOUR_EMAIL },
      { $set: { isAdmin: true, isActive: true } },
      { new: true }
    );

    if (!user) {
      return res.send(`
        <h2>❌ ERROR</h2>
        <p>User with email <strong>${YOUR_EMAIL}</strong> not found.</p>
        <p>Make sure you're using the email you registered with.</p>
      `);
    }

    res.send(`
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .success { background: #28a745; color: white; padding: 20px; border-radius: 10px; }
        .info { background: #17a2b8; color: white; padding: 15px; border-radius: 8px; margin-top: 20px; }
        a { color: #007bff; text-decoration: none; font-weight: bold; }
      </style>
      <div class="success">
        <h2>✅ SUCCESS! You are now admin.</h2>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Admin Status:</strong> ${
          user.isAdmin ? "YES ✅" : "NO ❌"
        }</p>
      </div>
      
      <div class="info">
        <h3>📋 Next Steps:</h3>
        <p>1. Go to: <a href="http://localhost:3000/admin/login" target="_blank">Admin Login</a></p>
        <p>2. Use your normal email/password</p>
        <p>3. After testing, REMOVE this route from server.js</p>
      </div>
    `);
  } catch (error) {
    res.send(`<h2>❌ Error:</h2><p>${error.message}</p>`);
  }
});

// ========== REGULAR ROUTES ==========
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/password", passwordRoutes);
app.use("/api/admin", adminRoutes); // Admin routes

// Remove OTP routes since they're now part of auth
// app.use("/api/otp", otpRoutes); // REMOVE THIS LINE

// Root route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ShopEasy Ecommerce API",
    version: "1.0.0",
    adminPanel: "/api/admin",
    endpoints: {
      auth: {
        signup: "POST /api/auth/signup",
        verify: "POST /api/auth/verify",
        login: "POST /api/auth/login",
        profile: "GET /api/auth/profile (protected)",
      },
      products: "GET /api/products",
      cart: "GET,POST,PUT,DELETE /api/cart",
      password: "/api/password",
      admin: "/api/admin (admin only)",
    },
  });
});

// Admin panel info route
app.get("/admin", (req, res) => {
  res.json({
    success: true,
    message: "ShopEasy Admin Panel",
    quickAccess: "http://localhost:3000/admin/login",
    endpoints: {
      login: "POST /api/admin/login",
      stats: "GET /api/admin/stats",
      users: "GET /api/admin/users",
      products: "GET /api/admin/products",
      orders: "GET /api/admin/orders",
    },
  });
});

// Development route to delete all products (for testing)
app.get("/delete/products/all", async (req, res) => {
  const Product = require("./models/Product");
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      message: "This route is disabled in production",
    });
  }

  const del = await Product.deleteMany({});
  res.json({
    success: true,
    message: "All products deleted",
    deletedCount: del.deletedCount,
  });
});

// Test route
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Test route is working!",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      products: "/api/products",
      cart: "/api/cart",
      admin: "/api/admin",
    },
  });
});

// Admin test route
app.get("/api/admin/test", (req, res) => {
  res.json({
    success: true,
    message: "Admin API is working!",
    timestamp: new Date().toISOString(),
    note: "Use /api/admin/login for actual admin access",
  });
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: "Connected",
    memory: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
  });
});

// Check current admins (temporary)
app.get("/api/check-admins", async (req, res) => {
  try {
    const User = require("./models/user");
    const admins = await User.find({ isAdmin: true }).select(
      "name email isAdmin isActive createdAt"
    );

    res.json({
      success: true,
      adminCount: admins.length,
      admins: admins,
      note: "This is a temporary route for debugging",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 404 handler - Catch all other routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
    availableRoutes: {
      home: "GET /",
      auth: "POST /api/auth/signup, /api/auth/login",
      products: "GET /api/products",
      cart: "/api/cart",
      password: "/api/password",
      admin: "/api/admin",
      health: "GET /api/health",
    },
    adminAccess: "Visit http://localhost:3000/admin/login",
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();

    const PORT = process.env.PORT || 5000;
    const HOST = process.env.HOST || "localhost";

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                   🚀 ShopEasy Server                     ║
╚══════════════════════════════════════════════════════════╝
`);
      console.log(`📡 Server running: http://${HOST}:${PORT}`);
      console.log(`🔗 API Base URL:    http://${HOST}:${PORT}/api`);
      console.log(`
📋 Available Routes:
├── 🔑  Auth:        http://${HOST}:${PORT}/api/auth
├── 🛍️  Products:     http://${HOST}:${PORT}/api/products
├── 🛒  Cart:         http://${HOST}:${PORT}/api/cart
├── 🔐  Password:     http://${HOST}:${PORT}/api/password
├── 👑  Admin:        http://${HOST}:${PORT}/api/admin
├── 🏥  Health:       http://${HOST}:${PORT}/api/health
└── 🏠  Home:         http://${HOST}:${PORT}/
`);

      console.log(`
👑 ADMIN PANEL ACCESS:
├── Frontend: http://localhost:3000/admin/login
├── Make Admin: http://${HOST}:${PORT}/make-me-admin
└── Check Admins: http://${HOST}:${PORT}/api/check-admins
`);

      if (process.env.NODE_ENV === "development") {
        console.log(`
🔧 Development Tools:
├── Test Route: http://${HOST}:${PORT}/api/test
├── Admin Test: http://${HOST}:${PORT}/api/admin/test
└── Delete Products: http://${HOST}:${PORT}/delete/products/all
`);
      }

      console.log(`\n✅ Ready to accept connections...\n`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
