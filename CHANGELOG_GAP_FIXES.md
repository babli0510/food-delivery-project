# Changelog — Closing the 3 Gap Areas

This covers the three areas that were previously partial: fraud/refund detection,
fuzzy restaurant search, and delivery-partner decline/reassignment. Surge pricing,
real-time status, and recommendations were already complete and are unchanged.

## 1. Fraud Detection & Order Validation

**Files added:** none (extended existing files)
**Files changed:** `models/User.js`, `models/Order.js`, `models/FraudLog.js`, `utils/riskScore.js`,
`controllers/orderController.js`, `controllers/adminController.js`, `routes/orderRoutes.js`, `routes/adminRoutes.js`

- Added refund tracking to `Order` (`refundRequested`, `refundRequestedAt`, `refundReason`,
  `refundAmount`, `refundStatus`, `refundReviewedBy/At`) and `User.refundRequestCount`.
- New rule in `calculateRiskScore`: 3+ refund requests in 7 days adds to the risk score.
- New endpoint `POST /api/orders/refund/:orderId` — user requests a refund on a
  delivered/cancelled order; triggers a fresh risk evaluation.
- New admin endpoints `GET /api/admin/refunds` and `PATCH /api/admin/refunds/:orderId`
  (`approve`/`reject`), mirroring the existing fraud-review pattern.
- `cancelOrder` now re-evaluates risk **immediately after cancellation** (previously
  cancellation counts were only checked on the user's *next* order creation).
- Added a hard-block threshold (`HARD_BLOCK_THRESHOLD = 80`, above the existing
  flag threshold of 50): orders at or above this score are rejected outright
  (`403`) instead of merely flagged, actually **preventing** misuse rather than
  only detecting it after the fact. The attempt is still logged to `FraudLog`
  (`order: null`, `trigger: "order_blocked"`) so admins can see blocked attempts.
- `FraudLog.order` is no longer required, since blocked orders never get created.

## 2. Advanced Restaurant Search & Filtering — Fuzzy Search

**Files added:** `utils/fuzzySearch.js`
**Files changed:** `controllers/restaurantController.js`

- `utils/fuzzySearch.js` implements Levenshtein edit-distance matching with no
  external dependency, tolerant of typos and partial keywords
  (`biryani` / `biriyani` / `biryni` / `biryaniii` all match `"Biryani House"`).
- `searchRestaurants` now runs an **aggregation pipeline** (`$match/$sort/$limit`,
  plus `$addFields`+`$meta:"textScore"` for the text-search path) instead of a
  plain `find()`. When a `q` param is present, it merges MongoDB's indexed
  `$text` search (fast, exact/stemmed) with an in-memory fuzzy pass over the
  filtered candidate pool, re-ranks, and dedupes — so both exact and
  typo/partial queries return results.

## 3. Smart Delivery Partner Assignment — Decline & Reassignment

**Files added:** `utils/deliveryAssignment.js`
**Files changed:** `models/Order.js`, `controllers/orderController.js`,
`controllers/deliveryController.js`, `routes/deliveryRoutes.js`

- Extracted partner-assignment logic (previously inline in `orderController`)
  into a shared `utils/deliveryAssignment.js` (`assignPartner`, `releasePartner`,
  `findNearestPartner`, `estimateDeliveryMinutes`) reused by both order creation
  and the new decline flow.
- Added `Order.declinedPartners` (excluded from re-assignment for that order) and
  `Order.estimatedDeliveryMinutes` (haversine-distance-based ETA, addressing the
  "estimated delivery time" factor from the task description).
- New endpoint `PATCH /api/delivery/decline/:orderId` (`{ partnerId }`): frees the
  declining partner's load slot, excludes them from re-search, finds the next
  nearest available partner, reassigns the order, and emits a
  `partner_reassigned` Socket.io event to the order's room.

## Not changed

`utils/surgePricing.js`, `services/recommendation.service.js`, Socket.io setup in
`server.js`, auth, and seed data are unchanged — those features were already complete.
