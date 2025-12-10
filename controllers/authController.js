const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendOTPEmail, sendWelcomeEmail } = require("../utils/sendEmail");
const User = require("../models/user"); // DIRECT IMPORT

// Store OTPs temporarily
const otpStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Signup - Send OTP
exports.signup = async (req, res) => {
  try {
    const { name, email, password, country, contact } = req.body;

    // Validation
    if (!name || !email || !password || !country || !contact) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Generate and send OTP
    const otp = generateOTP();
    console.log(otp);
    otpStore.set(email, {
      otp,
      name,
      password,
      country,
      contact,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    try {
      await sendOTPEmail(email, otp);
      res.json({
        success: true,
        message:
          "OTP sent to your email. Please verify to complete registration.",
        email: email,
      });
    } catch (emailError) {
      otpStore.delete(email);
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    console.log(req.body)
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const otpData = otpStore.get(email);
    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: "OTP not found or expired",
      });
    }

    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: "OTP has expired",
      });
    }

    if (otpData.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }
    // Create user
    // const hashedPassword = await bcrypt.hash(otpData.password, 12);
    const newUser = new User({
      name: otpData.name,
      email: email,
      password: otpData.password,
      country: otpData.country,
      contact: otpData.contact,
      cart: [],
      emailVerified: true,
      lastLogin: Date.now(),
    });
    await newUser.save();
    console.log("user saved");
    // Generate token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email, isAdmin: newUser.isAdmin },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    // Clean up OTP
    otpStore.delete(email);

    // Send welcome email
    try {
      // console.log("send welcome email");
      await sendWelcomeEmail(email, otpData.name);
    } catch (welcomeError) {
      // Don't fail if welcome email fails
      console.log(welcomeError.message);
    }

    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        country: newUser.country,
        contact: newUser.contact,
        emailVerified: newUser.emailVerified,
        isAdmin: newUser.isAdmin,
      },
      token,
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User does not exist",
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log(isPasswordValid)
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, isAdmin: user.isAdmin },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Login successful!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        country: user.country,
        contact: user.contact,
        emailVerified: user.emailVerified,
        isAdmin: user.isAdmin,
        cart: user.cart,
        lastLogin: user.lastLogin,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId || req.user._id).select(
      "-password -resetPasswordToken -resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Update Profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user.userId || req.user._id;

    // Don't allow email/password/isAdmin updates
    if (updates.email || updates.password || updates.isAdmin !== undefined) {
      return res.status(400).json({
        success: false,
        message: "Cannot update email, password, or admin status here",
      });
    }

    const allowedUpdates = ["name", "country", "contact", "profileImage"];
    const updateData = {};

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) updateData[field] = updates[field];
    });

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const otpData = otpStore.get(email);
    if (!otpData) {
      return res.status(400).json({
        success: false,
        message: "No pending registration found",
      });
    }

    const newOTP = generateOTP();
    otpStore.set(email, {
      ...otpData,
      otp: newOTP,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await sendOTPEmail(email, newOTP);

    res.json({
      success: true,
      message: "New OTP sent to your email",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};
