const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    items: [orderItemSchema],

    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 0 },
    totalAmount: { type: Number, required: true },

    couponCode: { type: String, default: null },

    status: {
      type: String,
      enum: ["placed", "accepted", "preparing", "out_for_delivery", "delivered", "cancelled"],
      default: "placed",
    },

    deliveryPartner: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryPartner", default: null },

    // Partners who declined this order — excluded from future re-assignment attempts
    declinedPartners: [{ type: mongoose.Schema.Types.ObjectId, ref: "DeliveryPartner" }],
    estimatedDeliveryMinutes: { type: Number, default: null },

    deliveryLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    // Fraud detection
    riskScore: { type: Number, default: 0 },
    isFlagged: { type: Boolean, default: false },

    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },

    // Refund tracking (feeds excessive-refund fraud rule)
    refundRequested: { type: Boolean, default: false },
    refundRequestedAt: { type: Date, default: null },
    refundReason: { type: String, default: null },
    refundAmount: { type: Number, default: null },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "approved", "rejected"],
      default: "none",
    },
    refundReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    refundReviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
