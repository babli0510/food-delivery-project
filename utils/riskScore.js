const Order = require("../models/Order");
const FraudLog = require("../models/FraudLog");

const FIVE_MIN = 5 * 60 * 1000;
const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;

/**
 * Calculates a fraud risk score for a user, based on behavioral patterns:
 * rapid ordering, repeated cancellations, coupon abuse, and excessive refunds.
 * Returns { score, reasons }
 */
const calculateRiskScore = async (user) => {
  const reasons = [];
  let score = 0;

  const now = new Date();

  // Rule 1: multiple orders in a very short window
  const recentOrdersCount = await Order.countDocuments({
    user: user._id,
    createdAt: { $gte: new Date(now - FIVE_MIN) },
  });
  if (recentOrdersCount >= 3) {
    score += 20 * recentOrdersCount;
    reasons.push(`placed_${recentOrdersCount}_orders_in_5_min`);
  }

  // Rule 2: repeated cancellations in last 24h
  const recentCancellations = await Order.countDocuments({
    user: user._id,
    status: "cancelled",
    cancelledAt: { $gte: new Date(now - ONE_DAY) },
  });
  if (recentCancellations >= 3) {
    score += 15 * recentCancellations;
    reasons.push(`${recentCancellations}_cancellations_in_24h`);
  }

  // Rule 3: abnormal coupon usage
  if (user.couponUsageCount >= 5) {
    score += 25;
    reasons.push("excessive_coupon_usage");
  }

  // Rule 4: excessive refund requests in the last 7 days
  const recentRefundRequests = await Order.countDocuments({
    user: user._id,
    refundRequested: true,
    refundRequestedAt: { $gte: new Date(now - SEVEN_DAYS) },
  });
  if (recentRefundRequests >= 3) {
    score += 20 * recentRefundRequests;
    reasons.push(`${recentRefundRequests}_refund_requests_in_7_days`);
  }

  return { score, reasons };
};

// Orders/actions at or above this score are flagged for admin review, but still allowed.
const RISK_THRESHOLD = 50;

// Orders at or above this score are blocked outright (misuse prevention), not just flagged.
const HARD_BLOCK_THRESHOLD = 80;

/**
 * Shared helper: (re)evaluates a user's risk score at a given lifecycle point
 * (order creation, cancellation, refund request, ...) and writes a FraudLog
 * entry if the score crosses the flag threshold. `orderId` may be null when
 * the triggering order was blocked before it could be created.
 */
const evaluateAndLogRisk = async (user, { orderId = null, trigger = "order_create" } = {}) => {
  const { score, reasons } = await calculateRiskScore(user);
  const isFlagged = score >= RISK_THRESHOLD;
  const isBlocked = score >= HARD_BLOCK_THRESHOLD;

  if (isFlagged) {
    await FraudLog.create({
      user: user._id,
      order: orderId,
      riskScore: score,
      reasons,
      trigger,
    });
  }

  return { score, reasons, isFlagged, isBlocked };
};

module.exports = {
  calculateRiskScore,
  evaluateAndLogRisk,
  RISK_THRESHOLD,
  HARD_BLOCK_THRESHOLD,
};
