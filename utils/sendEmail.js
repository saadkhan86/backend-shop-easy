const nodemailer = require("nodemailer");

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER || "sk8613013@gmail.com",
    pass: process.env.EMAIL_PASS || "uvscnxjyecsbtfqc",
  },
  connectionTimeout: 10000,
  socketTimeout: 10000,
});

// Common HTML template wrapper
const getEmailTemplate = (content, title) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; }
        .email-container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .email-header { background: linear-gradient(135deg, #1DB954, #17a850); color: white; padding: 30px 20px; text-align: center; }
        .email-content { padding: 30px; }
        .email-footer { background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #eee; }
        .button { display: inline-block; background: #1DB954; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 15px 0; transition: background-color 0.3s ease; }
        .otp-display { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; border: 2px dashed #ddd; }
        .otp-code { font-size: 32px; font-weight: 700; color: #1DB954; letter-spacing: 5px; font-family: 'Courier New', monospace; }
        .security-info { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .warning { color: #e74c3c; font-weight: 600; }
        @media (max-width: 600px) { .email-content { padding: 20px; } .otp-code { font-size: 28px; } }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="email-header">
          <h1>ShopEasy</h1>
          <p>Your Ultimate Shopping Destination</p>
        </div>
        <div class="email-content">${content}</div>
        <div class="email-footer">
          <p>&copy; ${new Date().getFullYear()} ShopEasy. All rights reserved.</p>
          <p>This email was sent by ShopEasy. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send OTP Email
const sendOTPEmail = async (email, otp) => {
  const content = `
    <h2 style="color: #333; margin-bottom: 15px;">Email Verification Required</h2>
    <p>Thank you for signing up with ShopEasy! To complete your registration, please verify your email address using the OTP below:</p>
    <div class="otp-display">
      <div class="otp-code">${otp}</div>
      <p style="color: #ff6b6b; font-size: 14px;">⚠️ This OTP will expire in 10 minutes</p>
    </div>
    <p>Enter this code on the verification page to activate your account.</p>
  `;

  const mailOptions = {
    from: `ShopEasy <${process.env.EMAIL_USER || "sk8613013@gmail.com"}>`,
    to: email,
    subject: "Verify Your Email - ShopEasy",
    html: getEmailTemplate(content, "Email Verification"),
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new Error("Failed to send OTP email");
  }
};

// Send Password Reset Email
const sendPasswordResetEmail = async (email, resetUrl) => {
  const content = `
    <h2 style="color: #333; margin-bottom: 15px;">Password Reset Request</h2>
    <p>You recently requested to reset your password for your ShopEasy account. Click the button below to reset it:</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="${resetUrl}" class="button">Reset Your Password</a>
    </div>
    <p>If you didn't request a password reset, you can safely ignore this email.</p>
    <div class="security-info">
      <p class="warning">⚠️ Security Notice:</p>
      <p>This password reset link will expire in 10 minutes for your security.</p>
    </div>
  `;

  const mailOptions = {
    from: `ShopEasy <${process.env.EMAIL_USER || "sk8613013@gmail.com"}>`,
    to: email,
    subject: "Reset Your Password - ShopEasy",
    html: getEmailTemplate(content, "Password Reset"),
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new Error("Failed to send password reset email");
  }
};

// Send Welcome Email
const sendWelcomeEmail = async (email, name) => {
  const content = `
    <h2 style="color: #333; margin-bottom: 15px;">Welcome to ShopEasy, ${name}! 🎉</h2>
    <p>Your account has been successfully created and verified. We're excited to have you onboard!</p>
    <div style="text-align: center; margin: 25px 0;">
      <a href="${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }" class="button">Start Shopping Now</a>
    </div>
    <p>Happy Shopping!<br>The ShopEasy Team</p>
  `;

  const mailOptions = {
    from: `ShopEasy <${process.env.EMAIL_USER || "sk8613013@gmail.com"}>`,
    to: email,
    subject: "Welcome to ShopEasy!",
    html: getEmailTemplate(content, "Welcome to ShopEasy"),
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    throw new Error("Failed to send welcome email");
  }
};

// Send Security Alert Email
const sendSecurityAlertEmail = async (email, deviceInfo) => {
  const content = `
    <h2 style="color: #333; margin-bottom: 15px;">🔒 Security Alert: Password Changed</h2>
    <p>Your ShopEasy account password was recently changed.</p>
    
    <div class="security-info">
      <p class="warning">⚠️ Change Details:</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      ${
        deviceInfo.browser
          ? `<p><strong>Browser:</strong> ${deviceInfo.browser}</p>`
          : ""
      }
      ${
        deviceInfo.os
          ? `<p><strong>Operating System:</strong> ${deviceInfo.os}</p>`
          : ""
      }
      ${
        deviceInfo.ip
          ? `<p><strong>IP Address:</strong> ${deviceInfo.ip}</p>`
          : ""
      }
    </div>
    
    <p>If you made this change, no further action is required.</p>
    
    <p class="warning">If you did NOT make this change:</p>
    <ol>
      <li>Reset your password immediately</li>
      <li>Check your account for any unauthorized activity</li>
      <li>Contact our support team if you need assistance</li>
    </ol>
    
    <div style="text-align: center; margin: 25px 0;">
      <a href="${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/forgot-password" class="button">Reset Password</a>
    </div>
    
    <p>Stay secure,<br>The ShopEasy Security Team</p>
  `;

  const mailOptions = {
    from: `ShopEasy Security <${
      process.env.EMAIL_USER || "sk8613013@gmail.com"
    }>`,
    to: email,
    subject: "🔒 Security Alert: Password Changed - ShopEasy",
    html: getEmailTemplate(content, "Security Alert"),
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Security alert email sent to ${email}`);
    return true;
  } catch (error) {
    console.error("Failed to send security alert email:", error.message);
    throw new Error("Failed to send security alert email");
  }
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendSecurityAlertEmail, // ✅ Added this
  transporter,
};
