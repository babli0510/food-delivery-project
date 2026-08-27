const mongoose = require("mongoose");

// One document per (user, restaurant) pair — counts are incremented in place
// rather than storing an unbounded event log, per the "avoid unnecessary
// unlimited data" requirement.
const userInteractionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    restaurant: { type: mongoose.Schema.Types.ObjectId, ref: "Restaurant", required: true },
    viewCount: { type: Number, default: 0 },
    orderCount: { type: Number, default: 0 },
    lastInteractionAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userInteractionSchema.index({ user: 1, restaurant: 1 }, { unique: true });

module.exports = mongoose.model("UserInteraction", userInteractionSchema);
