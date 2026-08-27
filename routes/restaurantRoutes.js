const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");
const {
  searchRestaurants,
  getRestaurantById,
  getRecommendations,
} = require("../controllers/restaurantController");

// NOTE: order matters — specific paths must come before the generic /:restaurantId
router.get("/search", searchRestaurants);
router.get("/recommendations/:userId", protect, getRecommendations);
router.get("/:restaurantId", optionalAuth, getRestaurantById);

module.exports = router;
