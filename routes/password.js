const express = require("express");
const router = express.Router();
const passwordController = require("../controllers/passwordController");

// Request password reset
router.post("/forgot-password", passwordController.requestPasswordReset);

// Reset password
router.post("/reset-password", passwordController.resetPassword);

// Verify reset token
router.get("/verify-reset-token/:token", passwordController.verifyResetToken);

module.exports = router;
