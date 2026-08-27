# Final Report — Dynamic Restaurant Recommendation System Upgrade

## A. Files Created

| File | Purpose |
|---|---|
| `models/UserInteraction.js` | Aggregated (not per-event) view/order interaction tracking per user-restaurant pair |
| `services/recommendation.service.js` | Dedicated recommendation engine — aggregation-based history analysis + weighted scoring |
| `utils/preferenceUpdater.js` | Single shared function (`applyOrderToUserPreferences`) reused by both `orderController.js` and `seed.js`, so the item-frequency/avg-order-value logic exists in exactly one place |
| `middleware/optionalAuth.js` | Attaches `req.user` if a valid token is present, but never blocks the request — used on the public restaurant-detail endpoint |
| `test/manual-verify-recommendations.js` | Stub-based verification script (see Section G — no live MongoDB was reachable in this sandbox) |

## B. Files Modified

| File | Change |
|---|---|
| `models/User.js` | Added `preferences.itemFrequency: Map`. Existing fields untouched. |
| `models/Restaurant.js` | Added `menu: [{ name, price, isVeg }]` (default `[]`, fully additive/backward compatible). |
| `controllers/orderController.js` | `createOrder` now calls `applyOrderToUserPreferences` (item frequency + correct avg order value) and upserts a `UserInteraction` "ordered" record. Order creation, fraud check, surge pricing, and delivery assignment logic is **unchanged**. |
| `controllers/restaurantController.js` | Added `getRestaurantById` (records a view interaction) and `addMenuItem`. Rewrote `getRecommendations` to call the new service and enforce an ownership check. `searchRestaurants` is **unchanged**. |
| `controllers/adminController.js` | Added `getUserRecommendationProfile` and `getRecommendationStats`. Existing fraud/surge functions **unchanged**. |
| `routes/restaurantRoutes.js` | Added `GET /:restaurantId` (after `/search` and `/recommendations/:userId` so route precedence is correct). |
| `routes/adminRoutes.js` | Added menu-item route and two recommendation-monitoring routes, still behind the existing `protect + isAdmin` chain. |
| `seed.js` | Added menu items to every sample restaurant; added a second demo user (`foodie@test.com`) with 5 realistic historical orders + interaction data so personalization is visibly demonstrable; original admin/demo-user seeding **unchanged**. |
| `postman_collection.json` | Added requests for the new endpoints; existing requests untouched. |
| `README.md` | Documented the new endpoints, the scoring formula, and the verification script. |

## C. Features Implemented (mapped to your numbered requirements)

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Recommendations based on order history | ✅ | `analyzeOrderHistory()` — live aggregation, not just cached fields |
| 2 | Preferred cuisines | ✅ | `cuisineFrequency` (User) + aggregation `cuisineFrequency` (live) |
| 3 | Frequently ordered items | ✅ | `itemFrequency` Map, quantity-aware |
| 4 | Restaurant ratings | ✅ | `ratingScore` (20% weight) |
| 5 | Restaurant popularity | ✅ | `popularityScore` (10% weight), normalized against candidate pool max |
| 6 | User interaction patterns | ✅ | `UserInteraction` model + `interactionScore` (5% weight) |
| 7 | Dynamic score + ranking | ✅ | `recommendationScore` computed per-request, sorted descending |
| 8 | Preference profile updates after every order | ✅ | `applyOrderToUserPreferences` called in `createOrder` |
| 9 | MongoDB aggregation-based analysis | ✅ | `$match/$unwind/$group/$sort/$lookup/$project/$facet` in `analyzeOrderHistory` |
| 10 | Admin monitoring | ✅ | `GET /api/admin/recommendations/:userId` and `/stats` |

## D. APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/restaurants/:restaurantId` | Optional (public) | Restaurant detail; records a view interaction if logged in |
| GET | `/api/restaurants/recommendations/:userId` | Required — self or admin | Personalized ranked recommendations |
| POST | `/api/admin/restaurants/:restaurantId/menu` | Admin | Add a menu item (`{ name, price, isVeg }`) |
| GET | `/api/admin/recommendations/:userId` | Admin | Full profile + history analysis + scored recommendations for one user |
| GET | `/api/admin/recommendations/stats` | Admin | Platform-wide top cuisines/items and order-count summary |

All other existing endpoints (`/api/orders/*`, `/api/auth/*`, `/api/admin/fraud/*`, `/api/admin/surge-settings`, `/api/delivery/*`) are **unchanged**.

## E. Recommendation Formula

```
recommendationScore =
    cuisineScore        (max 30)   — best-matching preferred cuisine, rank-weighted
  + itemScore            (max 25)  — restaurant menu overlap with top ordered items, rank-weighted
  + ratingScore          (max 20)  — (restaurant.rating / 5) × 20
  + popularityScore      (max 10)  — (restaurant.popularity / maxPopularityInPool) × 10
  + orderFrequencyScore  (max 10)  — (timesUserOrderedThisRestaurant / maxAcrossUser'sRestaurants) × 10
  + interactionScore     (max 5)   — (viewCount + orderCount×2) normalized × 5
  + explorationBonus     (+3, outside the 100%) — new-to-user restaurant that still matches taste
```
Weights sum to 100 as specified. Cuisine and item sub-scores are "rank-weighted": the user's #1 most-ordered cuisine/item contributes a full match weight, tapering toward 0 for less-frequent ones, so one dominant preference doesn't automatically max out every restaurant that merely shares a tag.

New users with zero orders **and** zero interactions skip this formula entirely and get a rating/popularity/cuisine-diversity fallback list (`basedOn: "new_user_fallback"`) — never an empty result.

## F. Database Changes

- `User.preferences.itemFrequency` — new `Map<string, number>` field, default `{}`. Additive; existing user documents load fine with an empty map.
- `Restaurant.menu` — new array field, default `[]`. Additive; existing restaurant documents load fine with no menu (item-matching simply contributes 0 for them).
- New collection: `userinteractions`, unique compound index on `{ user, restaurant }` (one row per pair, counters incremented — not one row per event, to keep storage bounded).

No existing field was renamed, retyped, or removed. No existing index was dropped.

## G. Testing

**What I could not do:** this sandbox's network egress is restricted to package registries only (no `mongodb.com`/Atlas access), so I could not run this against a live MongoDB instance here. I want to be upfront about that rather than claim a live end-to-end run happened.

**What I did instead, so the logic is genuinely verified rather than just "looks right":**

1. **Syntax check** — every `.js` file passed `node --check` after each edit, and again after a clean `npm install`.
2. **Unit-level check of `applyOrderToUserPreferences`** — ran it directly with the exact example from your spec (Paneer Pizza ×2, then ×1 → expected 3):
   - `itemFrequency: { 'paneer pizza': 3, biryani: 1 }` — **PASS**
   - `avgOrderValue` running-average formula — **PASS**
   - First-order division-by-zero edge case — **PASS**
3. **Mock-based integration check of the real service code** (`test/manual-verify-recommendations.js`) — stubbed `Order.aggregate`, `Restaurant.find`, `UserInteraction.find` with data shaped exactly like the seeded "Priya Foodie" scenario (3 Chicken Biryani orders, 1 Paneer Tikka, 1 Masala Dosa) and called the real, unmodified `getRecommendationsForUser`:
   - Royal Biryani House ranked #1 — **PASS**
   - Zero-rating, empty-menu restaurant ("New Place") scored safely with no crash/NaN — **PASS**
   - New-user-with-no-history fallback path returns a non-empty list — **PASS**

**What you still need to do before submitting:** run `npm run seed` against your real MongoDB (Atlas or local), then walk the Postman collection's full flow (`foodie@test.com` login → `GET /recommendations/:userId`) to confirm the same behavior end-to-end against a real database and a running Express server. I'm confident in the logic given the checks above, but a live run is the real proof and I don't want to overstate what an offline sandbox can confirm.

## H. Remaining Issues / Honest Limitations

- **Item matching is exact-string (post-normalization), not fuzzy.** "Paneer Pizza" and "paneer  pizza " match; "Panner Pizza" (typo) or "Pizza, Paneer" would not. You told me not to add unnecessary dependencies or ML, so I didn't reach for a fuzzy-matching library — flagging this as a known, deliberate limitation rather than a bug.
- **Order items aren't validated against the restaurant's menu at order time.** A user can still order an item name that isn't in `restaurant.menu`. This matches your instruction not to change order-creation behavior, but it does mean item-preference matching in recommendations is only as good as the item names users/your test data actually use.
- **Cuisine keys are now stored lowercase** in `cuisineFrequency` (previously stored as-typed, e.g. "Indian"). This was necessary so live-aggregation cuisine keys (`$toLower`) and stored preference keys line up consistently. It's backward-compatible in that old capitalized entries won't crash anything — they just won't be matched by the new lowercase lookups going forward. For a class project this is a non-issue since you'll reseed; flagging it in case you have real pre-existing user data you care about preserving exactly.
- **No live database test was performed**, as explained in Section G — please run the seed + Postman flow yourself before your deadline, and tell me if anything doesn't match what's documented here so I can fix it.
