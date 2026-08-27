const mongoose = require("mongoose");

const surgeConfigSchema = new mongoose.Schema(
  {
    baseFee: { type: Number, default: 30 },
    peakHourRanges: {
      type: [[Number]], // e.g. [[12,14],[19,21]] meaning 12:00-14:00 and 19:00-21:00
      default: [
        [12, 14],
        [19, 21],
      ],
    },
    peakMultiplierAdd: { type: Number, default: 0.5 },
    highDemandThreshold: { type: Number, default: 20 }, // active orders in region
    highDemandMultiplierAdd: { type: Number, default: 0.3 },
    maxMultiplier: { type: Number, default: 2.5 },
  },
  { timestamps: true }
);

// Enforce a single config document
surgeConfigSchema.statics.getSingleton = async function () {
  let config = await this.findOne();
  if (!config) config = await this.create({});
  return config;
};

module.exports = mongoose.model("SurgeConfig", surgeConfigSchema);
