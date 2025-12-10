const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middleware/auth");

// Public routes
router.post("/signup", authController.signup);
router.post("/verify", authController.verifyOTP);
router.post("/login", authController.login);
router.post("/resend", authController.resendOTP);

// Protected routes
router.get("/profile", authenticateToken, authController.getProfile);
router.patch("/profile", authenticateToken, authController.updateProfile);

module.exports = router;
