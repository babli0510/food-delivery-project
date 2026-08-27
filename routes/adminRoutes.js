const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { isAdmin } = require("../middleware/isAdmin");

const {
  getFlaggedOrders,
  reviewFlaggedOrder,
  getRefundRequests,
  reviewRefundRequest,
  getSurgeSettings,
  updateSurgeSettings,
  getUserRecommendationProfile,
  getRecommendationStats,
} = require("../controllers/adminController");

const { createRestaurant, updateRestaurant, addMenuItem } = require("../controllers/restaurantController");
const { createPartner } = require("../controllers/deliveryController");

// All admin routes require auth + admin role
router.use(protect, isAdmin);

// Fraud management
router.get("/fraud/orders", getFlaggedOrders);
router.patch("/fraud/orders/:id", reviewFlaggedOrder);

// Refund management (feeds fraud detection's "excessive refund requests" rule)
router.get("/refunds", getRefundRequests);
router.patch("/refunds/:orderId", reviewRefundRequest);

// Restaurant management
router.post("/restaurants/create", createRestaurant);
router.put("/restaurants/update/:restaurantId", updateRestaurant);
router.post("/restaurants/:restaurantId/menu", addMenuItem);

// Surge pricing
router.get("/surge-settings", getSurgeSettings);
router.put("/surge-settings", updateSurgeSettings);

// Delivery partner management
router.post("/delivery-partners/create", createPartner);

// Recommendation monitoring
// NOTE: /stats must be registered before /:userId or it would be captured as a userId param
router.get("/recommendations/stats", getRecommendationStats);
router.get("/recommendations/:userId", getUserRecommendationProfile);

module.exports = router;
