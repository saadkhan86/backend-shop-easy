const express = require("express");
const { sendOTP, verifyOTP } = require("../controlers/otpController");
const router = express.Router();

router.post("/send", sendOTP);
router.post("/verify", verifyOTP);

module.exports = router;
