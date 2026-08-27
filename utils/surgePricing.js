const Order = require("../models/Order");
const SurgeConfig = require("../models/SurgeConfig");

/**
 * Calculates delivery fee based on time-of-day and current demand.
 */
const calculateDeliveryFee = async (coordinates) => {
  const config = await SurgeConfig.getSingleton();

  const now = new Date();
  const hour = now.getHours();

  let multiplier = 1;

  // Check peak hours
  const isPeak = config.peakHourRanges.some(
    ([start, end]) => hour >= start && hour < end
  );

  if (isPeak) {
    multiplier += config.peakMultiplierAdd;
  }

  // Count active orders within 5 km
  const activeOrdersNearby = await Order.countDocuments({
    status: {
      $in: ["placed", "accepted", "preparing", "out_for_delivery"],
    },
    deliveryLocation: {
      $geoWithin: {
        $centerSphere: [
          coordinates,
          5000 / 6378100
        ],
      },
    },
  });

  // Apply high-demand surcharge
  if (activeOrdersNearby >= config.highDemandThreshold) {
    multiplier += config.highDemandMultiplierAdd;
  }

  // Maximum multiplier limit
  multiplier = Math.min(multiplier, config.maxMultiplier);

  const fee = Math.round(config.baseFee * multiplier);

  return {
    fee,
    multiplier,
    isPeak,
    activeOrdersNearby,
  };
};

module.exports = {
  calculateDeliveryFee,
};