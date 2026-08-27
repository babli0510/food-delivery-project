const mongoose = require("mongoose");

const fraudLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Null when an order was hard-blocked before it could ever be created
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null },
    riskScore: { type: Number, required: true },
    reasons: [{ type: String }],
    // Where in the order lifecycle this evaluation happened
    trigger: {
      type: String,
      enum: ["order_create", "order_blocked", "order_cancel", "refund_request"],
      default: "order_create",
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "user_restricted"],
      default: "pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FraudLog", fraudLogSchema);
