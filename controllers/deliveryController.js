const DeliveryPartner = require("../models/DeliveryPartner");
const Order = require("../models/Order");

const {
  assignPartner,
  releasePartner,
  estimateDeliveryMinutes,
} = require("../utils/deliveryAssignment");

// ======================================================
// PATCH /api/delivery/set-status
// Update delivery partner availability and location
// ======================================================

const setStatus = async (req, res) => {
  try {
    const { isAvailable, coordinates } = req.body;

    const update = {};

    // Update availability
    if (typeof isAvailable === "boolean") {
      update.isAvailable = isAvailable;
    }

    // Update location
    if (
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === "number" &&
      typeof coordinates[1] === "number"
    ) {
      update.location = {
        type: "Point",
        coordinates,
      };
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        message: "isAvailable or coordinates are required",
      });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      req.deliveryPartner._id,
      update,
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!partner) {
      return res.status(404).json({
        message: "Delivery partner not found",
      });
    }

    res.json(partner);
  } catch (err) {
    console.error("setStatus error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// GET /api/delivery/orders
// Get logged-in delivery partner's active orders
// ======================================================

const getMyOrders = async (req, res) => {
  try {
    const partnerId = req.deliveryPartner._id;

    console.log("=================================");
    console.log("LOGGED IN PARTNER:");
    console.log("ID:", partnerId.toString());
    console.log("NAME:", req.deliveryPartner.name);
    console.log("EMAIL:", req.deliveryPartner.email);

    const allOrders = await Order.find({})
      .select("_id status deliveryPartner");

    console.log("ALL ORDERS:");

    allOrders.forEach((order) => {
      console.log({
        orderId: order._id.toString(),
        status: order.status,
        deliveryPartner: order.deliveryPartner
          ? order.deliveryPartner.toString()
          : null,
      });
    });

    const orders = await Order.find({
      deliveryPartner: partnerId,
      status: {
        $nin: ["delivered", "cancelled"],
      },
    })
      .populate("user", "name email")
      .populate("restaurant", "name cuisine location")
      .sort({ createdAt: -1 });

    console.log("MATCHING ORDERS:", orders.length);
    console.log("=================================");

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
// PATCH /api/delivery/orders/:orderId/accept
// Accept assigned order
// ======================================================

const acceptOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const partnerId = req.deliveryPartner._id;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Check assignment
    if (
      !order.deliveryPartner ||
      order.deliveryPartner.toString() !== partnerId.toString()
    ) {
      return res.status(403).json({
        message: "This order is not assigned to you",
      });
    }

    // Only placed orders can be accepted
    if (order.status !== "placed") {
      return res.status(400).json({
        message: `Order cannot be accepted because its current status is ${order.status}`,
      });
    }

    order.status = "accepted";

    await order.save();

    // Socket notification
    const io = req.app.get("io");

    if (io) {
      io.to(order._id.toString()).emit("status_update", {
        orderId: order._id,
        status: order.status,
      });
    }

    res.json({
      message: "Order accepted successfully",
      order,
    });
  } catch (err) {
    console.error("acceptOrder error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// PATCH /api/delivery/orders/:orderId/status
// Delivery partner updates order status
// ======================================================

const updateDeliveryOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const partnerId = req.deliveryPartner._id;
    const { status } = req.body;

    const allowedStatuses = [
      "accepted",
      "out_for_delivery",
      "delivered",
    ];

    // Validate status
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message:
          "Invalid status. Allowed statuses: accepted, out_for_delivery, delivered",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Check whether order belongs to this delivery partner
    if (
      !order.deliveryPartner ||
      order.deliveryPartner.toString() !== partnerId.toString()
    ) {
      return res.status(403).json({
        message: "This order is not assigned to you",
      });
    }

    // Cannot update completed/cancelled orders
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        message: `Cannot update an order that is already ${order.status}`,
      });
    }

    // ==================================================
    // STATUS TRANSITIONS
    // ==================================================

    // placed -> accepted
    if (status === "accepted") {
      if (order.status !== "placed") {
        return res.status(400).json({
          message:
            `Order cannot be accepted from current status: ${order.status}`,
        });
      }
    }

    // accepted/preparing -> out_for_delivery
    if (status === "out_for_delivery") {
      if (!["accepted", "preparing"].includes(order.status)) {
        return res.status(400).json({
          message:
            `Order cannot be marked out_for_delivery from current status: ${order.status}`,
        });
      }
    }

    // out_for_delivery -> delivered
    if (status === "delivered") {
      if (order.status !== "out_for_delivery") {
        return res.status(400).json({
          message:
            `Order cannot be delivered from current status: ${order.status}`,
        });
      }
    }

    // Update order status
    order.status = status;

    await order.save();

    // ==================================================
    // RELEASE DELIVERY PARTNER AFTER DELIVERY
    // ==================================================

    if (status === "delivered") {
      await releasePartner(partnerId);
    }

    // ==================================================
    // SOCKET.IO REAL-TIME UPDATE
    // ==================================================

    const io = req.app.get("io");

    if (io) {
      io.to(order._id.toString()).emit("status_update", {
        orderId: order._id,
        status: order.status,
        deliveryPartner: partnerId,
      });
    }

    res.json({
      message: "Order status updated successfully",
      orderId: order._id,
      status: order.status,
    });
  } catch (err) {
    console.error("updateDeliveryOrderStatus error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// PATCH /api/delivery/decline/:orderId
// Decline assigned order
// ======================================================

const declineOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const partnerId = req.deliveryPartner._id;

    const order = await Order.findById(orderId).populate(
      "restaurant",
      "location"
    );

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    // Check assignment
    if (
      !order.deliveryPartner ||
      order.deliveryPartner.toString() !== partnerId.toString()
    ) {
      return res.status(403).json({
        message:
          "This delivery partner is not currently assigned to this order",
      });
    }

    // Cannot decline completed/cancelled order
    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(400).json({
        message: `Cannot decline an order that is already ${order.status}`,
      });
    }

    // Release current partner
    await releasePartner(partnerId);

    // Add partner to declined list
    const alreadyDeclined = order.declinedPartners.some(
      (id) => id.toString() === partnerId.toString()
    );

    if (!alreadyDeclined) {
      order.declinedPartners.push(partnerId);
    }

    // Remove current partner
    order.deliveryPartner = null;

    // Find next available partner
    const newPartner = await assignPartner(
      order.restaurant.location.coordinates,
      order.declinedPartners
    );

    if (newPartner) {
      order.deliveryPartner = newPartner._id;

      order.estimatedDeliveryMinutes = estimateDeliveryMinutes(
        order.restaurant.location.coordinates,
        order.deliveryLocation.coordinates
      );
    } else {
      order.estimatedDeliveryMinutes = null;
    }

    await order.save();

    // Socket notification
    const io = req.app.get("io");

    if (io) {
      io.to(order._id.toString()).emit("partner_reassigned", {
        orderId: order._id,
        previousPartner: partnerId,

        newPartner: newPartner
          ? {
              id: newPartner._id,
              name: newPartner.name,
            }
          : null,
      });
    }

    res.json({
      message: newPartner
        ? "Order declined and reassigned to another delivery partner"
        : "Order declined. No other partner is available nearby yet — it will be retried.",

      order,

      newPartner: newPartner
        ? {
            id: newPartner._id,
            name: newPartner.name,
          }
        : null,
    });
  } catch (err) {
    console.error("declineOrder error:", err);

    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// POST /api/admin/delivery-partners/create
// Create delivery partner
// ======================================================

const createPartner = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      coordinates,
    } = req.body;

    if (
      !name ||
      !phone ||
      !email ||
      !password ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2
    ) {
      return res.status(400).json({
        message:
          "name, phone, email, password and coordinates [lng, lat] are required",
      });
    }

    const partner = await DeliveryPartner.create({
      name,
      phone,
      email,
      password,
      isAvailable: true,
      currentLoad: 0,
      location: {
        type: "Point",
        coordinates,
      },
    });

    // Never return password
    const partnerResponse = partner.toObject();
    delete partnerResponse.password;

    res.status(201).json(partnerResponse);
  } catch (err) {
    console.error("createPartner error:", err);

    res.status(400).json({
      message: "Invalid delivery partner data",
      error: err.message,
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  setStatus,
  getMyOrders,
  acceptOrder,
  updateDeliveryOrderStatus,
  declineOrder,
  createPartner,
};