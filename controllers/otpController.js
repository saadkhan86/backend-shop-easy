const OTP = require("../models/otp");
const generateOTP = require("../utils/generateOTP");
const { sendOTPEmail } = require("../utils/sendEmail");

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const otp = generateOTP();
    console.log(otp);
    // Save OTP to database
    await OTP.create({ email, otp });
    // Send email
    await sendOTPEmail(email, otp);
    console.log(otp);

    res.json({ success: true, message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "OTP verification failed" });
  }
};
