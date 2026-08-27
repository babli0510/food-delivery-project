const mongoose = require("mongoose");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const UserInteraction = require("../models/UserInteraction");
const { normalizeKey } = require("../utils/preferenceUpdater");

/**
 * ─────────────────────────────────────────────────────────────────────────
 * SCORING WEIGHTS (must sum to 100)
 * ─────────────────────────────────────────────────────────────────────────
 * Cuisine Preference    → 30%  (matches user's most-ordered cuisines)
 * Item Preference       → 25%  (restaurant menu overlaps user's most-ordered items)
 * Restaurant Rating     → 20%  (normalized 0-5 rating)
 * Restaurant Popularity → 10%  (normalized against the candidate pool's max)
 * Order Frequency       → 10%  (how often THIS user ordered THIS restaurant)
 * User Interaction      →  5%  (views + orders recorded in UserInteraction)
 *
 * A separate small "exploration bonus" (not part of the 100%) is added for
 * restaurants that match the user's taste but haven't been ordered from yet,
 * so the engine doesn't just keep recommending the same familiar places.
 * ─────────────────────────────────────────────────────────────────────────
 */
const WEIGHTS = {
  cuisine: 30,
  item: 25,
  rating: 20,
  popularity: 10,
  orderFrequency: 10,
  interaction: 5,
};
const EXPLORATION_BONUS = 3;
const MAX_CANDIDATES = 200;
const RESULT_LIMIT = 12;

/**
 * Runs MongoDB aggregation pipelines over the user's real order history
 * (rather than only trusting precomputed User.preferences fields) to
 * determine frequently ordered restaurants, cuisines, items, order counts,
 * and average spend.
 */
const analyzeOrderHistory = async (userId) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [facetResult] = await Order.aggregate([
    { $match: { user: userObjectId, status: { $ne: "cancelled" } } },
    {
      $facet: {
        itemFrequency: [
          { $unwind: "$items" },
          {
            $group: {
              _id: { $toLower: { $trim: { input: "$items.name" } } },
              count: { $sum: "$items.quantity" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 15 },
        ],
        restaurantFrequency: [
          {
            $group: {
              _id: "$restaurant",
              orderCount: { $sum: 1 },
              totalSpent: { $sum: "$totalAmount" },
              lastOrderAt: { $max: "$createdAt" },
            },
          },
          { $sort: { orderCount: -1 } },
        ],
        overallStats: [
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              avgSpend: { $avg: "$totalAmount" },
              lastOrderAt: { $max: "$createdAt" },
            },
          },
        ],
      },
    },
  ]);

  // Cuisine frequency needs a $lookup into restaurants, kept as a second
  // pipeline for readability (still a single aggregation call).
  const cuisineFrequency = await Order.aggregate([
    { $match: { user: userObjectId, status: { $ne: "cancelled" } } },
    {
      $lookup: {
        from: "restaurants",
        localField: "restaurant",
        foreignField: "_id",
        as: "restaurantData",
      },
    },
    { $unwind: "$restaurantData" },
    { $unwind: "$restaurantData.cuisine" },
    {
      $group: {
        _id: { $toLower: "$restaurantData.cuisine" },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $project: { _id: 0, cuisine: "$_id", count: 1 } },
  ]);

  const itemFrequency = facetResult?.itemFrequency || [];
  const restaurantFrequency = facetResult?.restaurantFrequency || [];
  const overallStats = facetResult?.overallStats?.[0] || { totalOrders: 0, avgSpend: 0, lastOrderAt: null };

  return {
    topItems: itemFrequency.map((i) => ({ name: i._id, count: i.count })),
    topCuisines: cuisineFrequency.map((c) => ({ cuisine: c.cuisine, count: c.count })),
    restaurantOrderCounts: restaurantFrequency.map((r) => ({
      restaurantId: r._id.toString(),
      orderCount: r.orderCount,
      totalSpent: r.totalSpent,
      lastOrderAt: r.lastOrderAt,
    })),
    totalOrders: overallStats.totalOrders,
    avgSpend: Math.round((overallStats.avgSpend || 0) * 100) / 100,
    lastOrderAt: overallStats.lastOrderAt,
  };
};

/** Builds a rank-based weight map: most frequent item/cuisine gets weight 1, tapering down. */
const buildRankWeights = (rankedList, keyName) => {
  const map = new Map();
  rankedList.forEach((entry, index) => {
    map.set(entry[keyName], (rankedList.length - index) / rankedList.length);
  });
  return map;
};

const getUserInteractionMap = async (userId) => {
  const interactions = await UserInteraction.find({ user: userId }).lean();
  const map = new Map();
  interactions.forEach((i) => {
    map.set(i.restaurant.toString(), { viewCount: i.viewCount, orderCount: i.orderCount });
  });
  return map;
};

/**
 * Fallback recommendation set for users with no order history:
 * highly rated + popular + cuisine-diverse active restaurants.
 */
const getFallbackRecommendations = async () => {
  const restaurants = await Restaurant.find({ isActive: true })
    .sort({ rating: -1, popularity: -1 })
    .limit(30)
    .lean();

  // Greedy diversity pass: prefer not repeating a cuisine already picked, until we run out.
  const picked = [];
  const seenCuisines = new Set();
  for (const r of restaurants) {
    const newCuisine = (r.cuisine || []).some((c) => !seenCuisines.has(normalizeKey(c)));
    if (newCuisine || picked.length < RESULT_LIMIT / 2) {
      picked.push(r);
      (r.cuisine || []).forEach((c) => seenCuisines.add(normalizeKey(c)));
    }
    if (picked.length >= RESULT_LIMIT) break;
  }
  if (picked.length < RESULT_LIMIT) {
    for (const r of restaurants) {
      if (picked.length >= RESULT_LIMIT) break;
      if (!picked.includes(r)) picked.push(r);
    }
  }

  return picked.slice(0, RESULT_LIMIT).map((r) => ({
    ...r,
    recommendationScore: Math.round(((r.rating || 0) / 5) * 100),
    scoreBreakdown: { note: "new_user_fallback: ranked by rating and popularity only" },
  }));
};

/**
 * Main entry point: returns personalized, ranked restaurant recommendations
 * for a user, along with the analysis used to produce them.
 */
const getRecommendationsForUser = async (userId) => {
  const history = await analyzeOrderHistory(userId);
  const interactionMap = await getUserInteractionMap(userId);

  const hasHistory = history.totalOrders > 0;

  if (!hasHistory && interactionMap.size === 0) {
    const restaurants = await getFallbackRecommendations();
    return {
      basedOn: "new_user_fallback",
      history,
      recommendations: restaurants,
    };
  }

  // Normalize cuisine/item keys already lower-cased by the aggregation.
  const cuisineWeights = buildRankWeights(history.topCuisines, "cuisine");
  const itemWeights = buildRankWeights(history.topItems, "name");

  const familiarOrderCounts = new Map(
    history.restaurantOrderCounts.map((r) => [r.restaurantId, r.orderCount])
  );
  const maxOrderCount = Math.max(1, ...history.restaurantOrderCounts.map((r) => r.orderCount));

  const maxInteractionScore = Math.max(
    1,
    ...[...interactionMap.values()].map((v) => v.viewCount + v.orderCount * 2)
  );

  const candidates = await Restaurant.find({ isActive: true }).limit(MAX_CANDIDATES).lean();
  const maxPopularity = Math.max(1, ...candidates.map((r) => r.popularity || 0));

  const scored = candidates.map((restaurant) => {
    const restaurantId = restaurant._id.toString();
    const cuisines = (restaurant.cuisine || []).map(normalizeKey);
    const menuNames = new Set((restaurant.menu || []).map((m) => normalizeKey(m.name)));

    // --- Cuisine preference (30%) ---
    let cuisineRaw = 0;
    cuisines.forEach((c) => {
      if (cuisineWeights.has(c)) cuisineRaw = Math.max(cuisineRaw, cuisineWeights.get(c));
    });
    const cuisineScore = cuisineRaw * WEIGHTS.cuisine;

    // --- Item preference (25%): does this restaurant's menu cover the user's frequent items? ---
    let itemRaw = 0;
    itemWeights.forEach((weight, itemName) => {
      if (menuNames.has(itemName)) itemRaw = Math.min(1, itemRaw + weight * 0.5);
    });
    const itemScore = itemRaw * WEIGHTS.item;

    // --- Rating (20%) ---
    const ratingScore = ((restaurant.rating || 0) / 5) * WEIGHTS.rating;

    // --- Popularity (10%) ---
    const popularityScore = ((restaurant.popularity || 0) / maxPopularity) * WEIGHTS.popularity;

    // --- Order frequency for THIS restaurant (10%) ---
    const orderCount = familiarOrderCounts.get(restaurantId) || 0;
    const orderFrequencyScore = (orderCount / maxOrderCount) * WEIGHTS.orderFrequency;

    // --- Interaction history (5%) ---
    const interaction = interactionMap.get(restaurantId);
    const interactionRaw = interaction ? interaction.viewCount + interaction.orderCount * 2 : 0;
    const interactionScore = (interactionRaw / maxInteractionScore) * WEIGHTS.interaction;

    // --- Exploration bonus: new-to-user restaurant that still matches taste ---
    const isNewToUser = orderCount === 0;
    const explorationBonus = isNewToUser && cuisineRaw > 0 ? EXPLORATION_BONUS : 0;

    const totalScore =
      cuisineScore + itemScore + ratingScore + popularityScore + orderFrequencyScore + interactionScore + explorationBonus;

    return {
      ...restaurant,
      recommendationScore: Math.round(totalScore * 100) / 100,
      scoreBreakdown: {
        cuisine: Math.round(cuisineScore * 100) / 100,
        item: Math.round(itemScore * 100) / 100,
        rating: Math.round(ratingScore * 100) / 100,
        popularity: Math.round(popularityScore * 100) / 100,
        orderFrequency: Math.round(orderFrequencyScore * 100) / 100,
        interaction: Math.round(interactionScore * 100) / 100,
        explorationBonus,
      },
    };
  });

  scored.sort((a, b) => b.recommendationScore - a.recommendationScore);

  return {
    basedOn: "order_history",
    history,
    recommendations: scored.slice(0, RESULT_LIMIT),
  };
};

module.exports = {
  analyzeOrderHistory,
  getRecommendationsForUser,
  WEIGHTS,
};
