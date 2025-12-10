const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Use your working Atlas connection string directly
    const MONGODB_URI =
      "mongodb+srv://saadkhan:iE2Mot36JW6VMEMi@cluster0.ll5hpbw.mongodb.net/ecommerce?retryWrites=true&w=majority";

    console.log("🔗 Connecting to MongoDB Atlas...");

    await mongoose.connect(MONGODB_URI);

    console.log("✅ Connected to MongoDB Atlas!");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
