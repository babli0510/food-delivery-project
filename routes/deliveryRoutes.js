const express = require("express");

const router = express.Router();

const {
  protectDeliveryPartner,
} = require("../middleware/deliveryAuth");

const {
  setStatus,
  getMyOrders,
  acceptOrder,
  updateDeliveryOrderStatus,
  declineOrder,
} = require("../controllers/deliveryController");

// ======================================================
// GET /api/delivery/orders
// Get logged-in delivery partner's active orders
// ======================================================

router.get(
  "/orders",
  protectDeliveryPartner,
  getMyOrders
);

// ======================================================
// PATCH /api/delivery/orders/:orderId/accept
// Accept assigned order
// ======================================================

router.patch(
  "/orders/:orderId/accept",
  protectDeliveryPartner,
  acceptOrder
);

// ======================================================
// PATCH /api/delivery/orders/:orderId/status
// Update order status
// ======================================================

router.patch(
  "/orders/:orderId/status",
  protectDeliveryPartner,
  updateDeliveryOrderStatus
);

// ======================================================
// PATCH /api/delivery/set-status
// Update availability and location
// ======================================================

router.patch(
  "/set-status",
  protectDeliveryPartner,
  setStatus
);

// ======================================================
// PATCH /api/delivery/decline/:orderId
// Decline assigned order
// ======================================================

router.patch(
  "/decline/:orderId",
  protectDeliveryPartner,
  declineOrder
);

module.exports = router;