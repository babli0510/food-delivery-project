// Run with: npm run seed
// Creates a demo admin, two demo regular users (one with order history), sample
// restaurants with menus, sample delivery partners, and enough order/interaction
// history for the recommendation engine to produce visibly personalized results.
// Use ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD in your report — never a real personal password.

require("dotenv").config();
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Restaurant = require("./models/Restaurant");
const DeliveryPartner = require("./models/DeliveryPartner");
const SurgeConfig = require("./models/SurgeConfig");
const Order = require("./models/Order");
const UserInteraction = require("./models/UserInteraction");
const { applyOrderToUserPreferences } = require("./utils/preferenceUpdater");

// Center point used for sample data (Sholapur, Maharashtra) — change if needed
const CENTER = [75.9064, 17.6599];
const jitter = (base, amount = 0.02) => base + (Math.random() - 0.5) * amount;
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const seedUser = async ({ name, email, password, role }) => {
  const normalizedEmail = email.toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    console.log(`User already exists: ${normalizedEmail}`);
    return existing;
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: normalizedEmail, password: hashedPassword, role });
  console.log(`Created ${role} user: ${normalizedEmail}`);
  return user;
};

const sampleRestaurants = [
  {
    name: "Spice Villa",
    cuisine: ["Indian", "North Indian"],
    rating: 4.3,
    avgDeliveryTime: 28,
    isVeg: false,
    priceRange: "medium",
    menu: [
      { name: "Paneer Butter Masala", price: 220, isVeg: true },
      { name: "Butter Naan", price: 40, isVeg: true },
      { name: "Paneer Tikka", price: 200, isVeg: true },
      { name: "Chicken Curry", price: 260, isVeg: false },
    ],
  },
  {
    name: "Green Leaf",
    cuisine: ["Indian", "South Indian"],
    rating: 4.5,
    avgDeliveryTime: 22,
    isVeg: true,
    priceRange: "low",
    menu: [
      { name: "Masala Dosa", price: 120, isVeg: true },
      { name: "Idli Sambar", price: 80, isVeg: true },
      { name: "Paneer Tikka", price: 180, isVeg: true },
    ],
  },
  {
    name: "Pizza Point",
    cuisine: ["Italian", "Fast Food"],
    rating: 4.1,
    avgDeliveryTime: 35,
    isVeg: false,
    priceRange: "medium",
    menu: [
      { name: "Margherita Pizza", price: 250, isVeg: true },
      { name: "Farmhouse Pizza", price: 300, isVeg: true },
      { name: "Chicken Pepperoni Pizza", price: 350, isVeg: false },
    ],
  },
  {
    name: "Dragon Wok",
    cuisine: ["Chinese"],
    rating: 4.0,
    avgDeliveryTime: 30,
    isVeg: false,
    priceRange: "medium",
    menu: [
      { name: "Veg Hakka Noodles", price: 160, isVeg: true },
      { name: "Chicken Manchurian", price: 220, isVeg: false },
    ],
  },
  {
    name: "Sweet Treats",
    cuisine: ["Desserts", "Bakery"],
    rating: 4.6,
    avgDeliveryTime: 20,
    isVeg: true,
    priceRange: "low",
    menu: [
      { name: "Chocolate Pastry", price: 90, isVeg: true },
      { name: "Gulab Jamun", price: 60, isVeg: true },
    ],
  },
  {
    name: "Royal Biryani House",
    cuisine: ["Indian", "Mughlai"],
    rating: 4.4,
    avgDeliveryTime: 32,
    isVeg: false,
    priceRange: "high",
    menu: [
      { name: "Chicken Biryani", price: 250, isVeg: false },
      { name: "Mutton Biryani", price: 320, isVeg: false },
      { name: "Veg Biryani", price: 200, isVeg: true },
    ],
  },
];

const seedRestaurants = async () => {
  const count = await Restaurant.countDocuments();
  if (count > 0) {
    console.log(`Restaurants already seeded (${count} found), skipping.`);
    return Restaurant.find();
  }

  const docs = sampleRestaurants.map((r) => ({
    ...r,
    popularity: Math.floor(Math.random() * 50),
    location: { type: "Point", coordinates: [jitter(CENTER[0]), jitter(CENTER[1])] },
  }));

  const created = await Restaurant.insertMany(docs);
  console.log(`Seeded ${created.length} sample restaurants (with menus).`);
  return created;
};

const seedDeliveryPartners = async () => {
  const count = await DeliveryPartner.countDocuments();
  if (count > 0) {
    console.log(`Delivery partners already seeded (${count} found), skipping.`);
    return;
  }

  const names = ["Ravi Kumar", "Sanjay Patil", "Amit Sharma", "Vikram Singh"];
  const docs = names.map((name, i) => ({
    name,
    phone: `90000000${i}${i}`,
    isAvailable: true,
    currentLoad: 0,
    location: { type: "Point", coordinates: [jitter(CENTER[0]), jitter(CENTER[1])] },
  }));

  await DeliveryPartner.insertMany(docs);
  console.log(`Seeded ${docs.length} sample delivery partners.`);
};

/**
 * Places a simulated historical order directly in the DB (bypassing the HTTP
 * layer, since this is a one-time seed script) while reusing the exact same
 * preference-update logic that /api/orders/create uses, so seeded users end
 * up in a state indistinguishable from real usage.
 */
const seedHistoricalOrder = async (user, restaurant, itemSpecs, createdAt) => {
  const items = itemSpecs.map(([menuItem, quantity]) => ({
    name: menuItem.name,
    price: menuItem.price,
    quantity,
  }));
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const deliveryFee = 35;
  const totalAmount = subtotal + deliveryFee;

  const order = await Order.create({
    user: user._id,
    restaurant: restaurant._id,
    items,
    subtotal,
    deliveryFee,
    totalAmount,
    status: "delivered",
    deliveryLocation: { type: "Point", coordinates: [jitter(CENTER[0]), jitter(CENTER[1])] },
    createdAt,
  });
  // createdAt is normally auto-set; force it for realistic "recent behavior" analysis
  order.createdAt = createdAt;
  await order.save();

  restaurant.popularity += 1;
  await restaurant.save();

  applyOrderToUserPreferences(user, { restaurant, items, totalAmount });
  await user.save();

  await UserInteraction.findOneAndUpdate(
    { user: user._id, restaurant: restaurant._id },
    { $inc: { orderCount: 1 }, $set: { lastInteractionAt: createdAt } },
    { upsert: true }
  );

  return order;
};

const seedDemoOrderHistory = async (restaurants) => {
  const existingOrders = await Order.countDocuments();
  if (existingOrders > 0) {
    console.log(`Orders already exist (${existingOrders} found), skipping demo history seed.`);
    return;
  }

  const foodie = await seedUser({
    name: "Priya Foodie",
    email: "foodie@test.com",
    password: "Demo@12345",
    role: "user",
  });

  const byName = (name) => restaurants.find((r) => r.name === name);
  const biryaniHouse = byName("Royal Biryani House");
  const greenLeaf = byName("Green Leaf");
  const spiceVilla = byName("Spice Villa");
  const pizzaPoint = byName("Pizza Point");

  const findItem = (restaurant, itemName) => restaurant.menu.find((m) => m.name === itemName);

  // Priya clearly prefers Indian/Mughlai cuisine and Chicken Biryani specifically —
  // this makes the personalization visible when testing GET /recommendations/:userId
  await seedHistoricalOrder(
    foodie,
    biryaniHouse,
    [[findItem(biryaniHouse, "Chicken Biryani"), 2]],
    daysAgo(20)
  );
  await seedHistoricalOrder(
    foodie,
    biryaniHouse,
    [[findItem(biryaniHouse, "Chicken Biryani"), 1], [findItem(biryaniHouse, "Veg Biryani"), 1]],
    daysAgo(14)
  );
  await seedHistoricalOrder(
    foodie,
    biryaniHouse,
    [[findItem(biryaniHouse, "Chicken Biryani"), 1]],
    daysAgo(7)
  );
  await seedHistoricalOrder(
    foodie,
    spiceVilla,
    [[findItem(spiceVilla, "Paneer Tikka"), 1], [findItem(spiceVilla, "Butter Naan"), 2]],
    daysAgo(10)
  );
  await seedHistoricalOrder(
    foodie,
    greenLeaf,
    [[findItem(greenLeaf, "Masala Dosa"), 1]],
    daysAgo(3)
  );

  // A couple of "viewed but never ordered" interactions, to exercise the
  // interaction-score component and the exploration bonus in the recommendation engine
  await UserInteraction.findOneAndUpdate(
    { user: foodie._id, restaurant: pizzaPoint._id },
    { $inc: { viewCount: 3 }, $set: { lastInteractionAt: daysAgo(2) } },
    { upsert: true }
  );

  console.log(`Seeded 5 historical orders + interaction data for demo user: foodie@test.com`);
  console.log("This user should show a strong Indian/Mughlai + 'chicken biryani' bias in recommendations.");
};

const run = async () => {
  await connectDB();

  await seedUser({
    name: process.env.ADMIN_SEED_NAME || "Admin",
    email: process.env.ADMIN_SEED_EMAIL || "admin@test.com",
    password: process.env.ADMIN_SEED_PASSWORD || "Demo@12345",
    role: "admin",
  });

  await seedUser({
    name: "Demo User",
    email: "demouser@test.com",
    password: "Demo@12345",
    role: "user",
  });

  const restaurants = await seedRestaurants();
  await seedDeliveryPartners();
  await seedDemoOrderHistory(restaurants);

  await SurgeConfig.getSingleton();
  console.log("Surge config ready.");

  console.log("\nSeed complete. Demo logins:");
  console.log(`  Admin:            ${process.env.ADMIN_SEED_EMAIL || "admin@test.com"} / (see .env)`);
  console.log(`  User (no history): demouser@test.com / Demo@12345`);
  console.log(`  User (with history/personalized recs): foodie@test.com / Demo@12345`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
