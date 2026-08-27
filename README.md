# Food Delivery Backend

Production-style Node.js/Express + MongoDB backend implementing:

1. Fraud Detection & Order Validation
2. Advanced Restaurant Search & Filtering (fuzzy text + filters)
3. Dynamic Surge Pricing for Delivery Fees
4. Smart Delivery Partner Assignment (geo-based, `$near`)
5. Real-Time Order Status & Notifications (Socket.io)
6. Dynamic Restaurant Recommendation System (aggregation pipeline)

---

## 1. Local Setup

```bash
git clone <your-repo-url>
cd food-delivery-backend
npm install
cp .env.example .env
```

Edit `.env`:
- `MONGO_URI` → your MongoDB Atlas connection string
- `JWT_SECRET` → generate with `openssl rand -hex 32`
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` → demo credentials only, used for review/testing

```bash
npm run seed   # creates demo admin + demo user + 6 sample restaurants + 4 delivery partners
npm run dev    # starts server with nodemon on http://localhost:5000
```

After seeding, demo logins are:
- Admin: value of `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` from your `.env`
- Regular user (no order history): `demouser@test.com` / `Demo@12345`
- Regular user (5 seeded orders, strong Indian/Mughlai + "chicken biryani" bias): `foodie@test.com` / `Demo@12345` — use this account to see visibly personalized recommendations.

### Import the Postman collection
Open Postman → Import → select `postman_collection.json` from this repo. Set the `baseUrl` variable (defaults to `http://localhost:5000`), log in via the Auth folder, and paste the returned tokens into the `token`/`adminToken` collection variables. Every endpoint for all 6 features is pre-built with example bodies.

---

## 2. API Reference

### Auth
| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password }` |
| POST | `/api/auth/login` | `{ email, password }` |

All protected routes need header: `Authorization: Bearer <token>`

### Restaurants
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/restaurants/search?cuisine=Indian&rating=4&maxDeliveryTime=30&veg=true&q=biryani` | Public |
| GET | `/api/restaurants/:restaurantId` | Public; records a view interaction if logged in (optional auth) |
| GET | `/api/restaurants/recommendations/:userId` | Protected — only your own userId, or admin |

### Recommendation System — Details

The recommendation engine (`services/recommendation.service.js`) works in two layers:

1. **Live aggregation analysis** (`analyzeOrderHistory`) — runs MongoDB aggregation pipelines (`$match`, `$unwind`, `$group`, `$sort`, `$lookup`, `$project`, `$facet`) directly over the `Order` collection to compute the user's top items, top cuisines, per-restaurant order counts, total orders, and average spend. This does **not** rely only on the precomputed `User.preferences` fields.
2. **Weighted scoring** (`getRecommendationsForUser`) — scores every active restaurant against that analysis plus interaction data:

| Factor | Weight |
|---|---|
| Cuisine preference | 30% |
| Frequently ordered items (menu overlap) | 25% |
| Restaurant rating | 20% |
| Restaurant popularity | 10% |
| Order frequency (this user × this restaurant) | 10% |
| User interaction (views/orders) | 5% |
| **Total** | **100%** |

A small **+3 exploration bonus** is added (outside the 100%) for restaurants that match the user's cuisine taste but haven't been ordered from yet, so recommendations aren't limited to only-already-ordered places. New users with zero history and zero interactions get a rating/popularity/diversity-based fallback list instead of an empty result.

Each returned restaurant includes `recommendationScore` and a `scoreBreakdown` object showing exactly how the score was composed.

### Orders
| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/orders/calculate-delivery-fee?lng=&lat=` | Preview surge fee |
| POST | `/api/orders/create` | Protected — runs fraud check (blocks if risk ≥ 80, flags if ≥ 50) + assigns delivery partner + ETA |
| POST | `/api/orders/cancel/:orderId` | Protected — re-evaluates fraud risk immediately after cancelling |
| POST | `/api/orders/refund/:orderId` | Protected — `{ reason, amount? }`, order must be delivered/cancelled; feeds excessive-refund fraud rule |
| PATCH | `/api/orders/update-status/:orderId` | Protected — emits Socket.io event |
| GET | `/api/orders/:orderId` | Protected |

### Delivery Partner
| Method | Endpoint |
|---|---|
| PATCH | `/api/delivery/set-status` — `{ partnerId, isAvailable, coordinates }` |
| PATCH | `/api/delivery/decline/:orderId` — `{ partnerId }`; frees the declining partner and automatically reassigns the order to the next nearest available partner |

### Admin (requires `role: "admin"`)
| Method | Endpoint |
|---|---|
| GET | `/api/admin/fraud/orders?status=pending` |
| PATCH | `/api/admin/fraud/orders/:id` — `{ action: "approve"\|"reject"\|"restrict" }` |
| GET | `/api/admin/refunds?status=pending` — refund requests awaiting review |
| PATCH | `/api/admin/refunds/:orderId` — `{ action: "approve"\|"reject" }` |
| POST | `/api/admin/restaurants/create` |
| PUT | `/api/admin/restaurants/update/:restaurantId` |
| POST | `/api/admin/restaurants/:restaurantId/menu` — `{ name, price, isVeg }` |
| GET / PUT | `/api/admin/surge-settings` |
| POST | `/api/admin/delivery-partners/create` |
| GET | `/api/admin/recommendations/:userId` — full recommendation profile + scored restaurant list for one user |
| GET | `/api/admin/recommendations/stats` — platform-wide aggregated cuisine/item preference stats |

### Fraud Detection — Details

`utils/riskScore.js` scores a user's behavior on every order creation, cancellation, and refund request:

| Rule | Trigger | Score |
|---|---|---|
| Rapid ordering | 3+ orders in 5 minutes | +20 per order |
| Repeated cancellations | 3+ cancellations in 24h | +15 per cancellation |
| Coupon abuse | `couponUsageCount >= 5` | +25 |
| Excessive refunds | 3+ refund requests in 7 days | +20 per request |

- **Score ≥ 50** → order is created but flagged (`isFlagged: true`, `FraudLog` entry, visible in `/api/admin/fraud/orders`).
- **Score ≥ 80** → order creation is **blocked outright** (`403`) — misuse prevention, not just after-the-fact review — and still logged (`trigger: "order_blocked"`, `order: null`) so admins can see blocked attempts.
- Admin actions on a `FraudLog` entry: `approve`, `reject`, or `restrict` (sets `User.isRestricted = true`, which blocks login/all protected routes via `middleware/auth.js`).

### Real-time (Socket.io)
Client connects, then:
```js
socket.emit("join_order_room", orderId);
socket.on("status_update", ({ orderId, status }) => { /* update UI */ });
```

---

## 3. Sample Test Flow (Postman/Thunder Client)

1. `POST /api/auth/register` → create a normal user, save the `token`.
2. `POST /api/auth/login` with seeded admin creds → save admin `token`.
3. As admin: `POST /api/admin/restaurants/create` with a body like:
   ```json
   {
     "name": "Spice Villa",
     "cuisine": ["Indian", "North Indian"],
     "rating": 4.3,
     "avgDeliveryTime": 28,
     "isVeg": false,
     "priceRange": "medium",
     "location": { "type": "Point", "coordinates": [75.9064, 17.6599] }
   }
   ```
4. As admin: `POST /api/admin/delivery-partners/create`:
   ```json
   { "name": "Ravi", "phone": "9999999999", "location": { "type": "Point", "coordinates": [75.9070, 17.6600] } }
   ```
5. As user: `GET /api/restaurants/search?cuisine=Indian`
6. As user: `POST /api/orders/create` with `restaurantId`, `items`, `deliveryLocation.coordinates`.
7. As admin: `PATCH /api/orders/update-status/:orderId` with `{ "status": "accepted" }` → watch it push over Socket.io.

---

## 4. Deployment

### Option A — Render (recommended, free tier, `render.yaml` included)
1. Push this repo to GitHub — **confirm `.env` is NOT committed** (check `.gitignore`).
2. Create a free MongoDB Atlas cluster → Network Access → allow `0.0.0.0/0` → copy the connection string.
3. On [Render](https://render.com): New → **Blueprint** → connect your repo. Render will read `render.yaml` automatically and create the service.
   - Fill in the env vars it prompts for (`MONGO_URI`, `JWT_SECRET`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `CLIENT_ORIGIN`) in the dashboard — never in the repo.
4. After first deploy, open the Shell tab on the service and run: `npm run seed`.
5. Test the live base URL with the Postman collection before submitting.

### Option B — Railway
1. New Project → Deploy from GitHub repo. Railway auto-detects Node and uses the `Procfile`.
2. Add the same environment variables in Railway's Variables tab.
3. Run `npm run seed` from Railway's built-in shell/one-off command after deploy.

### Option C — Docker (any host: Fly.io, AWS, DigitalOcean, etc.)
```bash
docker build -t food-delivery-backend .
docker run -p 5000:5000 --env-file .env food-delivery-backend
```

### After deploying (any option)
- In your report: include the deployed URL, the API table above, and only the **demo admin credentials** from `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` — never a personal or reused password.
- Double check `.env` never got committed: `git log --all --full-history -- .env` should return nothing.

---

## 6. Verifying the Recommendation Engine

```bash
node test/manual-verify-recommendations.js
```
This runs the actual `services/recommendation.service.js` code against stubbed data shaped like the seeded "Priya Foodie" scenario (no live DB required) and prints the ranked output plus PASS/FAIL checks for personalization correctness and edge cases (zero rating, empty menu, new user fallback). Treat it as a sanity check — always also test against a real MongoDB via the Postman collection before submitting.

- Passwords hashed with bcrypt, never stored/returned in plaintext.
- JWT-based auth; admin routes gated by `role` + `isAdmin` middleware.
- `helmet` + rate limiting enabled by default.
- All secrets loaded from environment variables — `.env` is git-ignored.
- Delivery fee is always recalculated server-side on order creation (never trusts a client-sent value).
