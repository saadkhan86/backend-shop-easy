const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderNumber: {
    type: String,
    unique: true,
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      image: {
        type: String,
        default: "",
      },
    },
  ],
  shippingAddress: {
    fullName: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    postalCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ["COD", "Credit Card", "Debit Card", "PayPal", "Bank Transfer"],
    default: "COD",
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["Pending", "Paid", "Failed", "Refunded"],
    default: "Pending",
  },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    amount: Number,
  },
  itemsPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  shippingPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  taxPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  totalPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  orderStatus: {
    type: String,
    required: true,
    enum: [
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
      "Returned",
    ],
    default: "Pending",
  },
  shippingDetails: {
    carrier: String,
    trackingNumber: String,
    shippedDate: Date,
    estimatedDelivery: Date,
    deliveredDate: Date,
  },
  notes: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate order number before saving
orderSchema.pre("save", async function (next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
    return next();
  }

  // Generate unique order number: ORD-YYYYMMDD-XXXXX
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(10000 + Math.random() * 90000);

  this.orderNumber = `ORD-${year}${month}${day}-${random}`;
  next();
});

// Virtual for formatted order date
orderSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Method to get order summary
orderSchema.methods.getOrderSummary = function () {
  return {
    _id: this._id,
    orderNumber: this.orderNumber,
    user: this.user,
    totalPrice: this.totalPrice,
    orderStatus: this.orderStatus,
    paymentStatus: this.paymentStatus,
    paymentMethod: this.paymentMethod,
    itemCount: this.items.length,
    createdAt: this.createdAt,
    formattedDate: this.formattedDate,
    shippingAddress: this.shippingAddress,
  };
};

// Method to get detailed order info
orderSchema.methods.getOrderDetails = function () {
  return {
    _id: this._id,
    orderNumber: this.orderNumber,
    user: this.user,
    items: this.items,
    shippingAddress: this.shippingAddress,
    paymentMethod: this.paymentMethod,
    paymentStatus: this.paymentStatus,
    paymentDetails: this.paymentDetails,
    itemsPrice: this.itemsPrice,
    shippingPrice: this.shippingPrice,
    taxPrice: this.taxPrice,
    totalPrice: this.totalPrice,
    orderStatus: this.orderStatus,
    shippingDetails: this.shippingDetails,
    notes: this.notes,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
    formattedDate: this.formattedDate,
  };
};

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
