const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },

    // Fraud detection support
    isRestricted: { type: Boolean, default: false },
    cancellationCount: { type: Number, default: 0 },
    couponUsageCount: { type: Number, default: 0 },
    refundRequestCount: { type: Number, default: 0 },

    // Recommendation engine support
    preferences: {
      cuisineFrequency: { type: Map, of: Number, default: {} },
      itemFrequency: { type: Map, of: Number, default: {} },
      avgOrderValue: { type: Number, default: 0 },
      totalOrders: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
