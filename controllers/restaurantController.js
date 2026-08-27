const Restaurant = require("../models/Restaurant");
const UserInteraction = require("../models/UserInteraction");
const { getRecommendationsForUser } = require("../services/recommendation.service");
const { fuzzyMatchScore, FUZZY_MATCH_THRESHOLD } = require("../utils/fuzzySearch");

// GET /api/restaurants/search?cuisine=&rating=&maxDeliveryTime=&veg=&price=&q=
//
// Non-text filters (cuisine/rating/maxDeliveryTime/veg/price) are applied via an
// aggregation pipeline. When a free-text query `q` is present, results are ranked
// using BOTH MongoDB's indexed $text search (fast, exact/stemmed) AND an in-memory
// fuzzy (edit-distance) match over the filtered candidates, so minor typos or
// partial keywords ("biriyani", "biryni", "biryani ho") still surface matches.
const searchRestaurants = async (req, res) => {
  try {
    const { cuisine, rating, maxDeliveryTime, veg, price, q } = req.query;
    const trimmedQuery = q && q.trim();

    const baseMatch = { isActive: true };
    if (cuisine) baseMatch.cuisine = { $in: cuisine.split(",") };
    if (rating) baseMatch.rating = { $gte: Number(rating) };
    if (maxDeliveryTime) baseMatch.avgDeliveryTime = { $lte: Number(maxDeliveryTime) };
    if (veg) baseMatch.isVeg = veg === "true";
    if (price) baseMatch.priceRange = price;

    if (!trimmedQuery) {
      // No text query — plain filtered + sorted aggregation.
      const restaurants = await Restaurant.aggregate([
        { $match: baseMatch },
        { $sort: { rating: -1, popularity: -1 } },
        { $limit: 50 },
      ]);
      return res.json({ count: restaurants.length, restaurants });
    }

    // With a text query: run indexed $text search and a fuzzy pass over the
    // (smaller) filtered candidate pool in parallel, then merge + re-rank.
    const [textMatches, candidatePool] = await Promise.all([
      Restaurant.aggregate([
        { $match: { ...baseMatch, $text: { $search: trimmedQuery } } },
        { $addFields: { textScore: { $meta: "textScore" } } },
        { $sort: { textScore: -1 } },
        { $limit: 50 },
      ]),
      Restaurant.aggregate([{ $match: baseMatch }, { $limit: 500 }]),
    ]);

    const byId = new Map();
    // textScore is roughly 0.5-2+, normalize into the same ballpark as fuzzy (0-1)
    for (const r of textMatches) {
      byId.set(String(r._id), { restaurant: r, score: 1 + Math.min(r.textScore, 2) / 2 });
    }

    for (const r of candidatePool) {
      const key = String(r._id);
      if (byId.has(key)) continue; // already ranked via exact/stemmed text search
      const fuzzyScore = fuzzyMatchScore(r, trimmedQuery);
      if (fuzzyScore >= FUZZY_MATCH_THRESHOLD) {
        byId.set(key, { restaurant: r, score: fuzzyScore });
      }
    }

    const ranked = [...byId.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((entry) => entry.restaurant);

    res.json({ count: ranked.length, restaurants: ranked });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/restaurants/:restaurantId
// Public restaurant detail endpoint. If the caller is authenticated (optionalAuth),
// this also records a lightweight view interaction used by the recommendation engine.
const getRestaurantById = async (req, res) => {
  try {
    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant || !restaurant.isActive) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (req.user) {
      await UserInteraction.findOneAndUpdate(
        { user: req.user._id, restaurant: restaurant._id },
        { $inc: { viewCount: 1 }, $set: { lastInteractionAt: new Date() } },
        { upsert: true, new: true }
      );
    }

    res.json(restaurant);
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// GET /api/restaurants/recommendations/:userId
// Requires the caller to be requesting their own recommendations, or to be an admin.
const getRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;

    const isSelf = req.user._id.toString() === userId;
    const isAdmin = req.user.role === "admin";
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: "You can only view your own recommendations" });
    }

    const { basedOn, history, recommendations } = await getRecommendationsForUser(userId);

    res.json({
      basedOn,
      topCuisines: history.topCuisines?.map((c) => c.cuisine) || [],
      topItems: history.topItems?.map((i) => i.name) || [],
      totalOrders: history.totalOrders,
      avgSpend: history.avgSpend,
      count: recommendations.length,
      restaurants: recommendations,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// POST /api/admin/restaurants/create
const createRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.create(req.body);
    res.status(201).json(restaurant);
  } catch (err) {
    res.status(400).json({ message: "Invalid restaurant data", error: err.message });
  }
};

// PUT /api/admin/restaurants/update/:restaurantId
const updateRestaurant = async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(req.params.restaurantId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });
    res.json(restaurant);
  } catch (err) {
    res.status(400).json({ message: "Invalid update data", error: err.message });
  }
};

// POST /api/admin/restaurants/:restaurantId/menu
// body: { name, price, isVeg }
const addMenuItem = async (req, res) => {
  try {
    const { name, price, isVeg } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ message: "name and price are required" });
    }

    const restaurant = await Restaurant.findById(req.params.restaurantId);
    if (!restaurant) return res.status(404).json({ message: "Restaurant not found" });

    restaurant.menu.push({ name, price, isVeg: !!isVeg });
    await restaurant.save();

    res.status(201).json(restaurant);
  } catch (err) {
    res.status(400).json({ message: "Invalid menu item data", error: err.message });
  }
};

module.exports = {
  searchRestaurants,
  getRestaurantById,
  getRecommendations,
  createRestaurant,
  updateRestaurant,
  addMenuItem,
};
