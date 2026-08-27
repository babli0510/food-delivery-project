const FraudLog = require("../models/FraudLog");
const User = require("../models/User");
const Order = require("../models/Order");
const SurgeConfig = require("../models/SurgeConfig");
const { getRecommendationsForUser } = require("../services/recommendation.service");

// GET /api/admin/fraud/orders?status=pending
const getFlaggedOrders = async (req, res) => {
  try {
    const status = req.query.status || "pending";
    const logs = await FraudLog.find({ status })
      .populate("user", "name email isRestricted")
      .populate("order")
      .sort({ createdAt: -1 });
    res.json({ count: logs.length, logs });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/admin/fraud/orders/:id
// body: { action: "approve" | "reject" | "restrict" }
const reviewFlaggedOrder = async (req, res) => {
  try {
    const { action } = req.body;
    const log = await FraudLog.findById(req.params.id);
    if (!log) return res.status(404).json({ message: "Fraud log not found" });

    if (action === "approve") {
      log.status = "approved";
    } else if (action === "reject") {
      log.status = "rejected";
    } else if (action === "restrict") {
      log.status = "user_restricted";
      await User.findByIdAndUpdate(log.user, { isRestricted: true });
    } else {
      return res.status(400).json({ message: "action must be approve, reject, or restrict" });
    }

    log.reviewedBy = req.user._id;
    log.reviewedAt = new Date();
    await log.save();

    res.json({ message: `Order ${action}d`, log });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/admin/refunds?status=pending
const getRefundRequests = async (req, res) => {
  try {
    const status = req.query.status || "pending";
    const orders = await Order.find({ refundRequested: true, refundStatus: status })
      .populate("user", "name email isRestricted refundRequestCount")
      .populate("restaurant", "name")
      .sort({ refundRequestedAt: -1 });
    res.json({ count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// PATCH /api/admin/refunds/:orderId
// body: { action: "approve" | "reject" }
const reviewRefundRequest = async (req, res) => {
  try {
    const { action } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "action must be approve or reject" });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.refundRequested) {
      return res.status(400).json({ message: "No refund has been requested for this order" });
    }

    order.refundStatus = action === "approve" ? "approved" : "rejected";
    order.refundReviewedBy = req.user._id;
    order.refundReviewedAt = new Date();
    await order.save();

    res.json({ message: `Refund ${action}d`, order });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/admin/surge-settings
const getSurgeSettings = async (req, res) => {
  const config = await SurgeConfig.getSingleton();
  res.json(config);
};

// PUT /api/admin/surge-settings
const updateSurgeSettings = async (req, res) => {
  try {
    const config = await SurgeConfig.getSingleton();
    Object.assign(config, req.body);
    await config.save();
    res.json(config);
  } catch (err) {
    res.status(400).json({ message: "Invalid surge settings", error: err.message });
  }
};

// GET /api/admin/recommendations/:userId
// Lets an admin inspect a specific user's recommendation profile and current
// recommended restaurants, for demo/verification purposes.
const getUserRecommendationProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const { basedOn, history, recommendations } = await getRecommendationsForUser(req.params.userId);

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        totalOrders: user.preferences?.totalOrders || 0,
        avgOrderValue: user.preferences?.avgOrderValue || 0,
        cuisineFrequency: Object.fromEntries(user.preferences?.cuisineFrequency || new Map()),
        itemFrequency: Object.fromEntries(user.preferences?.itemFrequency || new Map()),
      },
      basedOn,
      historyAnalysis: history,
      recommendedRestaurants: recommendations,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/admin/recommendations/stats
// Aggregate, platform-wide view of recommendation-relevant data (no single
// user's private profile is exposed beyond aggregated counts).
const getRecommendationStats = async (req, res) => {
  try {
    const [userCounts] = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          usersWithOrders: { $sum: { $cond: [{ $gt: ["$preferences.totalOrders", 0] }, 1, 0] } },
          avgOrdersPerUser: { $avg: "$preferences.totalOrders" },
          avgOrderValueAcrossUsers: { $avg: "$preferences.avgOrderValue" },
        },
      },
    ]);

    const topCuisinesPlatformWide = await User.aggregate([
      { $project: { cuisineArr: { $objectToArray: "$preferences.cuisineFrequency" } } },
      { $unwind: "$cuisineArr" },
      { $group: { _id: "$cuisineArr.k", totalCount: { $sum: "$cuisineArr.v" } } },
      { $sort: { totalCount: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, cuisine: "$_id", totalCount: 1 } },
    ]);

    const topItemsPlatformWide = await User.aggregate([
      { $project: { itemArr: { $objectToArray: "$preferences.itemFrequency" } } },
      { $unwind: "$itemArr" },
      { $group: { _id: "$itemArr.k", totalCount: { $sum: "$itemArr.v" } } },
      { $sort: { totalCount: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, item: "$_id", totalCount: 1 } },
    ]);

    res.json({
      summary: userCounts || { totalUsers: 0, usersWithOrders: 0, avgOrdersPerUser: 0, avgOrderValueAcrossUsers: 0 },
      topCuisinesPlatformWide,
      topItemsPlatformWide,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  getFlaggedOrders,
  reviewFlaggedOrder,
  getRefundRequests,
  reviewRefundRequest,
  getSurgeSettings,
  updateSurgeSettings,
  getUserRecommendationProfile,
  getRecommendationStats,
};
