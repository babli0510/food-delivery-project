const normalizeKey = (str) => String(str).trim().toLowerCase();

/**
 * Mutates `user.preferences` in place to reflect a newly placed order.
 * Does NOT save the document — caller is responsible for calling user.save().
 *
 * - cuisineFrequency: +1 per unique cuisine on the restaurant (matches prior behavior)
 * - itemFrequency: += quantity per ordered item (case-insensitive key)
 * - avgOrderValue: running average, recalculated from previous avg + previous count
 * - totalOrders: incremented by 1
 */
const applyOrderToUserPreferences = (user, { restaurant, items, totalAmount }) => {
  if (!user.preferences) {
    user.preferences = { cuisineFrequency: new Map(), itemFrequency: new Map(), avgOrderValue: 0, totalOrders: 0 };
  }
  if (!user.preferences.itemFrequency) user.preferences.itemFrequency = new Map();
  if (!user.preferences.cuisineFrequency) user.preferences.cuisineFrequency = new Map();

  // --- Cuisine frequency ---
  (restaurant.cuisine || []).forEach((c) => {
    const key = normalizeKey(c);
    const current = user.preferences.cuisineFrequency.get(key) || 0;
    user.preferences.cuisineFrequency.set(key, current + 1);
  });

  // --- Item frequency (quantity-aware, not just "1 occurrence per order") ---
  (items || []).forEach((item) => {
    const key = normalizeKey(item.name);
    const qty = Number(item.quantity) || 1;
    const current = user.preferences.itemFrequency.get(key) || 0;
    user.preferences.itemFrequency.set(key, current + qty);
  });

  // --- Average order value (running average, division-by-zero safe) ---
  const prevAvg = user.preferences.avgOrderValue || 0;
  const prevTotal = user.preferences.totalOrders || 0;
  const newTotal = prevTotal + 1;
  const newAvg = (prevAvg * prevTotal + totalAmount) / newTotal;

  user.preferences.avgOrderValue = Math.round(newAvg * 100) / 100;
  user.preferences.totalOrders = newTotal;

  return user;
};

module.exports = { applyOrderToUserPreferences, normalizeKey };
