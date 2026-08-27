const mongoose = require("mongoose");

const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    isVeg: { type: Boolean, default: false },
  },
  { _id: true }
);

const restaurantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    cuisine: [{ type: String, required: true }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    avgDeliveryTime: { type: Number, required: true }, // in minutes
    isVeg: { type: Boolean, default: false },
    priceRange: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    popularity: { type: Number, default: 0 }, // increments on each order

    // Menu is optional/additive — existing restaurants without a menu still work
    // everywhere else; recommendation item-matching just treats them as having none.
    menu: { type: [menuItemSchema], default: [] },

    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

restaurantSchema.index({ location: "2dsphere" });
restaurantSchema.index({ name: "text", cuisine: "text" });

module.exports = mongoose.model("Restaurant", restaurantSchema);
