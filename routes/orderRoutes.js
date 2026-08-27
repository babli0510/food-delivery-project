const express = require("express");

const router = express.Router();

const {
  protect,
} = require("../middleware/auth");

const {
  createOrder,
  getMyOrders,
  cancelOrder,
  requestRefund,
  updateOrderStatus,
  getOrder,
  previewDeliveryFee,
} = require("../controllers/orderController");

// ======================================================
// GET /api/orders/calculate-delivery-fee?lng=&lat=
// Calculate delivery fee
// ======================================================

router.get(
  "/calculate-delivery-fee",
  previewDeliveryFee
);

// ======================================================
// POST /api/orders/create
// Create order
// ======================================================

router.post(
  "/create",
  protect,
  createOrder
);

// ======================================================
// GET /api/orders/my-orders
// Get logged-in customer's orders
// ======================================================

router.get(
  "/my-orders",
  protect,
  getMyOrders
);

// ======================================================
// POST /api/orders/cancel/:orderId
// Cancel order
// ======================================================

router.post(
  "/cancel/:orderId",
  protect,
  cancelOrder
);

// ======================================================
// POST /api/orders/refund/:orderId
// Request refund
// ======================================================

router.post(
  "/refund/:orderId",
  protect,
  requestRefund
);

// ======================================================
// PATCH /api/orders/update-status/:orderId
// Restaurant/Admin status update
// ======================================================

router.patch(
  "/update-status/:orderId",
  protect,
  updateOrderStatus
);

// ======================================================
// GET /api/orders/:orderId
// Get customer's own order
// ======================================================

router.get(
  "/:orderId",
  protect,
  getOrder
);

module.exports = router;