const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const FraudLog = require("../models/FraudLog");
const UserInteraction = require("../models/UserInteraction");

const {
  calculateRiskScore,
  evaluateAndLogRisk,
  RISK_THRESHOLD,
  HARD_BLOCK_THRESHOLD,
} = require("../utils/riskScore");

const { calculateDeliveryFee } = require("../utils/surgePricing");
const {
  applyOrderToUserPreferences,
} = require("../utils/preferenceUpdater");

const {
  assignPartner,
  releasePartner,
  estimateDeliveryMinutes,
} = require("../utils/deliveryAssignment");

// ======================================================
// GET /api/orders/calculate-delivery-fee?lng=&lat=
// Preview delivery fee
// ======================================================

const previewDeliveryFee = async (req, res) => {
  try {
    const { lng, lat } = req.query;

    if (!lng || !lat) {
      return res.status(400).json({
        message: "lng and lat are required",
      });
    }

    const longitude = Number(lng);
    const latitude = Number(lat);

    if (
      Number.isNaN(longitude) ||
      Number.isNaN(latitude)
    ) {
      return res.status(400).json({
        message: "lng and lat must be valid numbers",
      });
    }

    const result = await calculateDeliveryFee([
      longitude,
      latitude,
    ]);

    res.json(result);
  } catch (err) {
    console.error("previewDeliveryFee error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// POST /api/orders/create
// Create customer order
// ======================================================

const createOrder = async (req, res) => {
  try {
    const {
      restaurantId,
      items,
      couponCode,
      deliveryLocation,
    } = req.body;

    if (
      !restaurantId ||
      !items?.length ||
      !deliveryLocation?.coordinates
    ) {
      return res.status(400).json({
        message:
          "restaurantId, items, and deliveryLocation are required",
      });
    }

    if (
      !Array.isArray(deliveryLocation.coordinates) ||
      deliveryLocation.coordinates.length !== 2
    ) {
      return res.status(400).json({
        message:
          "deliveryLocation.coordinates must be [lng, lat]",
      });
    }

    const restaurant =
      await Restaurant.findById(restaurantId);

    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({
        message:
          "Restaurant not found or inactive",
      });
    }

    // ==================================================
    // Fraud detection
    // ==================================================

    const {
      score,
      reasons,
    } = await calculateRiskScore(req.user);

    const isFlagged =
      score >= RISK_THRESHOLD;

    const isBlocked =
      score >= HARD_BLOCK_THRESHOLD;

    if (isBlocked) {
      await FraudLog.create({
        user: req.user._id,
        order: null,
        riskScore: score,
        reasons,
        trigger: "order_blocked",
      });

      return res.status(403).json({
        message:
          "This order was blocked due to suspicious account activity. Please contact support.",
        riskScore: score,
        reasons,
      });
    }

    // ==================================================
    // Pricing
    // ==================================================

    const subtotal = items.reduce(
      (sum, item) =>
        sum + item.price * item.quantity,
      0
    );

    const {
      fee: deliveryFee,
    } = await calculateDeliveryFee(
      deliveryLocation.coordinates
    );

    const totalAmount =
      subtotal + deliveryFee;

    // ==================================================
    // Delivery partner assignment
    // ==================================================

    const partner = await assignPartner(
      restaurant.location.coordinates
    );

    const estimatedDeliveryMinutes =
      partner
        ? estimateDeliveryMinutes(
            restaurant.location.coordinates,
            deliveryLocation.coordinates
          )
        : null;

    // ==================================================
    // Create order
    // ==================================================

    const order = await Order.create({
      user: req.user._id,
      restaurant: restaurant._id,
      items,
      subtotal,
      deliveryFee,
      totalAmount,
      couponCode: couponCode || null,
      deliveryLocation,

      deliveryPartner: partner
        ? partner._id
        : null,

      estimatedDeliveryMinutes,

      riskScore: score,
      isFlagged,
    });

    // ==================================================
    // Fraud log
    // ==================================================

    if (isFlagged) {
      await FraudLog.create({
        user: req.user._id,
        order: order._id,
        riskScore: score,
        reasons,
        trigger: "order_create",
      });
    }

    // ==================================================
    // Restaurant popularity
    // ==================================================

    restaurant.popularity += 1;

    await restaurant.save();

    // ==================================================
    // User recommendation preferences
    // ==================================================

    const user = req.user;

    applyOrderToUserPreferences(
      user,
      {
        restaurant,
        items,
        totalAmount,
      }
    );

    if (couponCode) {
      user.couponUsageCount += 1;
    }

    await user.save();

    // ==================================================
    // Recommendation interaction
    // ==================================================

    await UserInteraction.findOneAndUpdate(
      {
        user: user._id,
        restaurant: restaurant._id,
      },
      {
        $inc: {
          orderCount: 1,
        },
        $set: {
          lastInteractionAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
      }
    );

    // ==================================================
    // Socket notification
    // ==================================================

    const io = req.app.get("io");

    if (io) {
      io.to(order._id.toString()).emit(
        "order_created",
        {
          orderId: order._id,
          status: order.status,
          deliveryPartner: partner
            ? {
                id: partner._id,
                name: partner.name,
              }
            : null,
        }
      );
    }

    res.status(201).json({
      order,

      assignedPartner: partner
        ? {
            id: partner._id,
            name: partner.name,
          }
        : null,

      estimatedDeliveryMinutes,

      flaggedForReview: isFlagged,
    });
  } catch (err) {
    console.error("createOrder error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// GET /api/orders/my-orders
// Get logged-in customer's orders
// ======================================================

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      user: req.user._id,
    })
      .populate(
        "restaurant",
        "name cuisine rating"
      )
      .populate(
        "deliveryPartner",
        "name phone location isAvailable"
      )
      .sort({
        createdAt: -1,
      });

    res.json({
      count: orders.length,
      orders,
    });
  } catch (err) {
    console.error("getMyOrders error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// GET /api/orders/:orderId
// Get customer's own order
// ======================================================

const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(
      req.params.orderId
    )
      .populate(
        "restaurant",
        "name cuisine rating location"
      )
      .populate(
        "deliveryPartner",
        "name phone location isAvailable"
      )
      .populate(
        "user",
        "name email"
      );

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // ==================================================
    // SECURITY: Customer can only view own order
    // ==================================================

    if (
      order.user._id.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "You are not allowed to view this order",
      });
    }

    res.json(order);
  } catch (err) {
    console.error("getOrder error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// POST /api/orders/cancel/:orderId
// Cancel customer's order
// ======================================================

const cancelOrder = async (req, res) => {
  try {
    const order =
      await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (
      order.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Not your order",
      });
    }

    if (
      ["delivered", "cancelled"].includes(
        order.status
      )
    ) {
      return res.status(400).json({
        message:
          `Cannot cancel an order that is ${order.status}`,
      });
    }

    // ==================================================
    // Cancel order
    // ==================================================

    order.status = "cancelled";
    order.cancelledAt = new Date();
    order.cancelReason =
      req.body.reason ||
      "No reason provided";

    await order.save();

    // ==================================================
    // Update cancellation count
    // ==================================================

    req.user.cancellationCount += 1;

    await req.user.save();

    // ==================================================
    // Release delivery partner
    // ==================================================

    if (order.deliveryPartner) {
      await releasePartner(
        order.deliveryPartner
      );
    }

    // ==================================================
    // Fraud detection
    // ==================================================

    const {
      score,
      isFlagged,
    } = await evaluateAndLogRisk(
      req.user,
      {
        orderId: order._id,
        trigger: "order_cancel",
      }
    );

    // ==================================================
    // Socket notification
    // ==================================================

    const io = req.app.get("io");

    if (io) {
      io.to(order._id.toString()).emit(
        "status_update",
        {
          orderId: order._id,
          status: "cancelled",
        }
      );
    }

    res.json({
      message: "Order cancelled",
      order,
      riskScore: score,
      flaggedForReview: isFlagged,
    });
  } catch (err) {
    console.error("cancelOrder error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// POST /api/orders/refund/:orderId
// Request refund
// ======================================================

const requestRefund = async (req, res) => {
  try {
    const order =
      await Order.findById(req.params.orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (
      order.user.toString() !==
      req.user._id.toString()
    ) {
      return res.status(403).json({
        message: "Not your order",
      });
    }

    if (
      !["delivered", "cancelled"].includes(
        order.status
      )
    ) {
      return res.status(400).json({
        message:
          "Refunds can only be requested for delivered or cancelled orders",
      });
    }

    if (order.refundRequested) {
      return res.status(400).json({
        message:
          "A refund has already been requested for this order",
      });
    }

    const {
      reason,
      amount,
    } = req.body;

    // ==================================================
    // Validate refund amount
    // ==================================================

    let refundAmount =
      amount !== undefined
        ? Number(amount)
        : order.totalAmount;

    if (
      Number.isNaN(refundAmount) ||
      refundAmount <= 0
    ) {
      return res.status(400).json({
        message:
          "Refund amount must be a valid positive number",
      });
    }

    if (
      refundAmount > order.totalAmount
    ) {
      return res.status(400).json({
        message:
          "Refund amount cannot exceed order total",
      });
    }

    // ==================================================
    // Save refund request
    // ==================================================

    order.refundRequested = true;
    order.refundRequestedAt = new Date();

    order.refundReason =
      reason || "No reason provided";

    order.refundAmount =
      refundAmount;

    order.refundStatus = "pending";

    await order.save();

    // ==================================================
    // Update user's refund count
    // ==================================================

    req.user.refundRequestCount += 1;

    await req.user.save();

    // ==================================================
    // Fraud detection
    // ==================================================

    const {
      score,
      isFlagged,
    } = await evaluateAndLogRisk(
      req.user,
      {
        orderId: order._id,
        trigger: "refund_request",
      }
    );

    res.status(201).json({
      message:
        "Refund requested and pending admin review",

      order,

      riskScore: score,

      flaggedForReview: isFlagged,
    });
  } catch (err) {
    console.error(
      "requestRefund error:",
      err
    );

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// PATCH /api/orders/update-status/:orderId
//
// NOTE:
// This endpoint is kept for existing restaurant/admin
// functionality.
//
// Delivery partners should use:
// /api/delivery/orders/:orderId/status
// ======================================================

const updateOrderStatus = async (
  req,
  res
) => {
  try {
    const { status } = req.body;

    const validStatuses = [
      "placed",
      "accepted",
      "preparing",
      "out_for_delivery",
      "delivered",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid status value",
        validStatuses,
      });
    }

    const order =
      await Order.findById(
        req.params.orderId
      );

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    order.status = status;

    await order.save();

    // ==================================================
    // Socket.io
    // ==================================================

    const io = req.app.get("io");

    if (io) {
      io.to(order._id.toString()).emit(
        "status_update",
        {
          orderId: order._id,
          status: order.status,
        }
      );
    }

    // ==================================================
    // Release partner after delivery
    // ==================================================

    if (
      status === "delivered" &&
      order.deliveryPartner
    ) {
      await releasePartner(
        order.deliveryPartner
      );
    }

    res.json(order);
  } catch (err) {
    console.error(
      "updateOrderStatus error:",
      err
    );

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  createOrder,
  getMyOrders,
  getOrder,
  cancelOrder,
  requestRefund,
  updateOrderStatus,
  previewDeliveryFee,
};