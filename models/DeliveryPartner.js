const mongoose = require("mongoose");

const deliveryPartnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },

    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    isAvailable: { type: Boolean, default: true },
    currentLoad: { type: Number, default: 0 },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
  },
  { timestamps: true }
);

deliveryPartnerSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("DeliveryPartner", deliveryPartnerSchema);