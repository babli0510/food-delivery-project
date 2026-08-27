/**
 * NOT part of the deployed app. Run with: node test/manual-verify-recommendations.js
 *
 * This sandbox has no reachable MongoDB (network egress is restricted), so this
 * script stubs the Mongoose model calls used by services/recommendation.service.js
 * with data shaped exactly like seed.js's "Priya Foodie" scenario, then runs the
 * REAL service code against those stubs to verify the scoring/ranking logic.
 * This is a substitute for a live integration test — run the real thing with
 * `npm run seed` against an actual MongoDB before final submission.
 */
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const UserInteraction = require("../models/UserInteraction");

const chainable = (data) => {
  const obj = {
    sort: () => obj,
    limit: () => obj,
    lean: () => Promise.resolve(data),
    then: (resolve, reject) => Promise.resolve(data).then(resolve, reject),
  };
  return obj;
};

const biryaniHouseId = new mongoose.Types.ObjectId();
const greenLeafId = new mongoose.Types.ObjectId();
const spiceVillaId = new mongoose.Types.ObjectId();
const pizzaPointId = new mongoose.Types.ObjectId();
const dragonWokId = new mongoose.Types.ObjectId();
const noRatingId = new mongoose.Types.ObjectId();

const restaurants = [
  { _id: biryaniHouseId, name: "Royal Biryani House", cuisine: ["Indian", "Mughlai"], rating: 4.4, popularity: 40, isActive: true, menu: [{ name: "Chicken Biryani" }, { name: "Mutton Biryani" }, { name: "Veg Biryani" }] },
  { _id: greenLeafId, name: "Green Leaf", cuisine: ["Indian", "South Indian"], rating: 4.5, popularity: 20, isActive: true, menu: [{ name: "Masala Dosa" }, { name: "Idli Sambar" }, { name: "Paneer Tikka" }] },
  { _id: spiceVillaId, name: "Spice Villa", cuisine: ["Indian", "North Indian"], rating: 4.3, popularity: 15, isActive: true, menu: [{ name: "Paneer Tikka" }, { name: "Butter Naan" }] },
  { _id: pizzaPointId, name: "Pizza Point", cuisine: ["Italian", "Fast Food"], rating: 4.1, popularity: 30, isActive: true, menu: [{ name: "Margherita Pizza" }] },
  { _id: dragonWokId, name: "Dragon Wok", cuisine: ["Chinese"], rating: 4.0, popularity: 10, isActive: true, menu: [{ name: "Veg Hakka Noodles" }] },
  { _id: noRatingId, name: "New Place (edge case)", cuisine: ["Fusion"], rating: 0, popularity: 0, isActive: true, menu: [] },
];

const facetResult = [
  {
    itemFrequency: [
      { _id: "chicken biryani", count: 4 },
      { _id: "veg biryani", count: 1 },
      { _id: "paneer tikka", count: 1 },
      { _id: "butter naan", count: 2 },
      { _id: "masala dosa", count: 1 },
    ],
    restaurantFrequency: [
      { _id: biryaniHouseId, orderCount: 3, totalSpent: 940, lastOrderAt: new Date() },
      { _id: spiceVillaId, orderCount: 1, totalSpent: 315, lastOrderAt: new Date() },
      { _id: greenLeafId, orderCount: 1, totalSpent: 155, lastOrderAt: new Date() },
    ],
    overallStats: [{ _id: null, totalOrders: 5, avgSpend: 300, lastOrderAt: new Date() }],
  },
];
const cuisineFrequency = [
  { cuisine: "indian", count: 5 },
  { cuisine: "mughlai", count: 3 },
  { cuisine: "north indian", count: 1 },
  { cuisine: "south indian", count: 1 },
];

let aggregateCallCount = 0;
Order.aggregate = async () => {
  aggregateCallCount += 1;
  return aggregateCallCount % 2 === 1 ? facetResult : cuisineFrequency;
};

Restaurant.find = () => chainable(restaurants);
UserInteraction.find = () => ({ lean: () => Promise.resolve([{ user: "x", restaurant: pizzaPointId.toString(), viewCount: 3, orderCount: 0 }]) });

const { getRecommendationsForUser } = require("../services/recommendation.service");

(async () => {
  console.log("=== Test 1: Personalized recommendations for a user WITH history ===");
  const result = await getRecommendationsForUser(biryaniHouseId.toString());
  console.log("basedOn:", result.basedOn);
  console.log(
    "Ranking:",
    result.recommendations.map((r) => `${r.name} (score=${r.recommendationScore})`)
  );

  const top = result.recommendations[0];
  console.log(top.name === "Royal Biryani House" ? "PASS: Biryani House ranked #1 as expected" : "FAIL: expected Royal Biryani House to rank #1");

  const noRatingResult = result.recommendations.find((r) => r.name === "New Place (edge case)");
  console.log(
    noRatingResult && !Number.isNaN(noRatingResult.recommendationScore)
      ? `PASS: zero-rating/empty-menu restaurant handled safely (score=${noRatingResult.recommendationScore})`
      : "FAIL: no-rating/no-menu restaurant crashed or produced NaN"
  );

  console.log("\nScore breakdown for #1:", top.scoreBreakdown);

  console.log("\n=== Test 2: New user with NO history (fallback path) ===");
  aggregateCallCount = 0;
  Order.aggregate = async () => [{ itemFrequency: [], restaurantFrequency: [], overallStats: [] }];
  UserInteraction.find = () => ({ lean: () => Promise.resolve([]) });
  const fallback = await getRecommendationsForUser(greenLeafId.toString());
  console.log("basedOn:", fallback.basedOn);
  console.log(fallback.basedOn === "new_user_fallback" && fallback.recommendations.length > 0 ? "PASS: fallback works, non-empty" : "FAIL: fallback broken or empty");

  console.log("\nAll checks complete.");
  process.exit(0);
})().catch((err) => {
  console.error("Test crashed:", err);
  process.exit(1);
});
