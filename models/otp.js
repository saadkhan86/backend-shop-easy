const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: String,
  otp: String,
  expiresAt: { type: Date, default: Date.now, expires: 600 }, // Auto delete after 10 min
});

module.exports = mongoose.model("OTP", otpSchema);
