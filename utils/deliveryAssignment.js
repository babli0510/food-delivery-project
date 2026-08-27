const DeliveryPartner = require("../models/DeliveryPartner");

const SEARCH_RADIUS_METERS = 8000; // 8 km
const AVG_SPEED_KMPH = 20;

// ======================================================
// Distance between two [lng, lat] coordinates
// ======================================================

const distanceKm = ([lng1, lat1], [lng2, lat2]) => {
  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


// ======================================================
// Find nearest available delivery partner
// ======================================================

const findNearestPartner = async (
  coordinates,
  excludeIds = []
) => {
  return DeliveryPartner.findOne({
    isAvailable: true,

    _id: {
      $nin: excludeIds,
    },

    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates,
        },

        $maxDistance: SEARCH_RADIUS_METERS,
      },
    },
  }).sort({
    currentLoad: 1,
  });
};


// ======================================================
// Estimate delivery time
// ======================================================

const estimateDeliveryMinutes = (
  fromCoordinates,
  toCoordinates
) => {
  const km = distanceKm(
    fromCoordinates,
    toCoordinates
  );

  const minutes =
    (km / AVG_SPEED_KMPH) * 60;

  return Math.max(
    10,
    Math.round(minutes)
  );
};


// ======================================================
// Assign partner
// ======================================================

const assignPartner = async (
  coordinates,
  excludeIds = []
) => {
  const partner = await findNearestPartner(
    coordinates,
    excludeIds
  );

  if (!partner) {
    return null;
  }

  const newLoad =
    partner.currentLoad + 1;

  const newAvailability =
    newLoad < 3;

  /*
   * IMPORTANT:
   * Use updateOne/findOneAndUpdate instead of
   * partner.save().
   *
   * This allows older delivery-partner documents
   * that don't contain email/password to still
   * have their currentLoad updated.
   */

  const updatedPartner =
    await DeliveryPartner.findByIdAndUpdate(
      partner._id,
      {
        $set: {
          currentLoad: newLoad,
          isAvailable: newAvailability,
        },
      },
      {
        new: true,
        runValidators: false,
      }
    );

  return updatedPartner;
};


// ======================================================
// Release partner
// ======================================================

const releasePartner = async (
  partnerId
) => {
  const partner =
    await DeliveryPartner.findById(
      partnerId
    );

  if (!partner) {
    return null;
  }

  const newLoad = Math.max(
    0,
    partner.currentLoad - 1
  );

  const updatedPartner =
    await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      {
        $set: {
          currentLoad: newLoad,
          isAvailable: true,
        },
      },
      {
        new: true,
        runValidators: false,
      }
    );

  return updatedPartner;
};


// ======================================================
// Exports
// ======================================================

module.exports = {
  findNearestPartner,
  assignPartner,
  releasePartner,
  estimateDeliveryMinutes,
  distanceKm,
};