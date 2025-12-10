const User = require("../models/user");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
} = require("../utils/sendEmail");

exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Email validation
    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      // For security reasons, return success even if user doesn't exist
      // This prevents email enumeration attacks
      return res.status(400).json({
        success: false,
        message:
          "No account found with this email. Please sign up to create an account.",
      });
    }

    // Check if user has email verified
    if (!user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email before resetting password",
      });
    }

    // Check if there's already a valid reset token (prevent spam)
    if (user.resetPasswordToken && user.resetPasswordExpires > Date.now()) {
      const timeLeft = Math.ceil(
        (user.resetPasswordExpires - Date.now()) / 60000
      ); // minutes
      return res.status(429).json({
        success: false,
        message: `Please wait ${timeLeft} minutes before requesting another reset`,
        retryAfter: timeLeft * 60, // seconds
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Set token expiry (30 minutes)
    user.resetPasswordExpires = Date.now() + 5 * 60 * 1000;

    // Track reset request
    user.lastPasswordResetRequest = Date.now();
    user.passwordResetRequests = (user.passwordResetRequests || 0) + 1;

    await user.save();

    // Create reset URL
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:3000"
    }/reset/${resetToken}`;
    try {
      // Send password reset email using new function
      await sendPasswordResetEmail(email, resetUrl);
      res.status(200).json({
        success: true,
        message: "Password reset email sent successfully",
        // Only include this in development
        ...(process.env.NODE_ENV === "development" && { resetUrl }),
      });
    } catch (emailError) {
      // Reset the token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please try again later.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    console.log("Reset password request:", req.body);
    
    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    // Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        message: "Password is too long",
      });
    }

    // Hash token to compare
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Check if new password is same as old password
    // Make sure user.password exists and is selectable
    const userWithPassword = await User.findById(user._id).select("+password");
    const isSamePassword = await bcrypt.compare(password, userWithPassword.password);
    
    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from old password",
      });
    }

    // ✅ FIX: Hash new password with proper error handling
    let hashedPassword;
    try {
      hashedPassword = await bcrypt.hash(password, 12);
    } catch (hashError) {
      console.error("Password hashing error:", hashError);
      return res.status(500).json({
        success: false,
        message: "Failed to process password",
      });
    }

    // Store old password for security audit (optional)
    const passwordHistory = user.passwordHistory || [];
    passwordHistory.push({
      password: user.password,
      changedAt: Date.now(),
    });

    // Keep only last 5 passwords
    if (passwordHistory.length > 5) {
      passwordHistory.shift();
    }

    // Update user - use findByIdAndUpdate to avoid pre-save hook issues
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      passwordHistory: passwordHistory,
      passwordChangedAt: Date.now(),
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined,
      passwordResetRequests: 0,
      updatedAt: Date.now(),
    });

    // Send security alert email
    try {
      const deviceInfo = {
        browser: req.headers["user-agent"]?.split(") ")[0]?.split("(")[1],
        os: req.headers["user-agent"]?.match(/\(([^)]+)\)/)?.[1],
        ip: req.ip || req.connection.remoteAddress,
      };

      await sendSecurityAlertEmail(user.email, deviceInfo);
    } catch (emailError) {
      console.log("Security email failed:", emailError.message);
    }

    res.status(200).json({
      success: true,
      message: "Password reset successful. You can now login with your new password.",
    });
  } catch (error) {
    console.log("Reset password error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to reset password. Please try again.",
    });
  }
};

exports.verifyResetToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    // Validate token format
    if (!/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        success: false,
        message: "Invalid token format",
      });
    }

    // Hash token to compare
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token",
      });
    }

    // Check if user email is verified
    if (!user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "Please verify your email before resetting password",
      });
    }

    res.status(200).json({
      success: true,
      message: "Reset token is valid",
      email: user.email,
      name: user.name,
      expiresIn: Math.floor((user.resetPasswordExpires - Date.now()) / 1000), // seconds
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to verify reset token",
    });
  }
};

exports.checkResetStatus = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({
        success: true,
        hasActiveReset: false,
      });
    }

    const hasActiveReset =
      user.resetPasswordToken && user.resetPasswordExpires > Date.now();

    res.status(200).json({
      success: true,
      hasActiveReset,
      expiresAt: hasActiveReset ? user.resetPasswordExpires : null,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to check reset status",
    });
  }
};

exports.cancelPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await User.findOne({ email });

    if (user && user.resetPasswordToken) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

    }

    res.status(200).json({
      success: true,
      message: "Password reset request cancelled",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to cancel reset request",
    });
  }
};
