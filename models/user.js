const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please enter a valid email",
    ],
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false, // Don't return password in queries
  },
  country: {
    type: String,
    required: true,
    maxlength: 100,
  },
  // In models/user.js
  contact: {
    type: String,
    trim: true,
    required: [true, "Contact number is required"],
    validate: {
      validator: function (v) {
        if (!v || v.trim() === "") return false;

        // Remove all non-digit characters except leading +
        let cleaned = v.replace(/[\s\-\(\)\.]/g, "");

        // Check if it starts with +, remove it for digit count check
        let hasPlus = false;
        if (cleaned.startsWith("+")) {
          hasPlus = true;
          cleaned = cleaned.substring(1); // Remove the + for digit counting
        }

        // Now check if it contains only digits and has correct length
        const isValidDigits = /^\d+$/.test(cleaned);
        const isValidLength = cleaned.length >= 10 && cleaned.length <= 15;

        return isValidDigits && isValidLength;
      },
      message:
        "Phone number must be 10-15 digits. Can start with + for international numbers.",
    },
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  // NEW: Admin fields
  isAdmin: {
    type: Boolean,
    default: false,
  },

  // NEW: User status for admin management
  isActive: {
    type: Boolean,
    default: true,
  },

  // NEW: Last login timestamp
  lastLogin: {
    type: Date,
  },

  // NEW: Profile image URL
  profileImage: {
    type: String,
    default: "",
  },

  cart: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],

  // NEW: Wishlist feature
  wishlist: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  listings: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      status: {
        type: String,
        enum: ["active", "inactive", "sold", "pending"],
        default: "active",
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // NEW: Updated at timestamp
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// ✅ FIXED: Hash password before saving (without 'next' parameter issues)
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      throw error;
    }
  }

  // Always update updatedAt
  this.updatedAt = Date.now();
});

// ❌ REMOVED: Separate pre-save hook for updatedAt (now combined above)
// userSchema.pre("save", function (next) {
//   this.updatedAt = Date.now();
//   next();
// });

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Check if user is admin
userSchema.methods.isAdminUser = function () {
  return this.isAdmin === true;
};

// Method to get user summary for admin panel
userSchema.methods.getUserSummary = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    country: this.country,
    contact: this.contact,
    profileImage: this.profileImage,
    isAdmin: this.isAdmin,
    isActive: this.isActive,
    emailVerified: this.emailVerified,
    cartCount: this.cart ? this.cart.length : 0,
    wishlistCount: this.wishlist ? this.wishlist.length : 0,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Remove password when converting to JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.resetPasswordToken;
  delete user.resetPasswordExpires;
  return user;
};

// FIX: Check if model already exists before creating
const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;
