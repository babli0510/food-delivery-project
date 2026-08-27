require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const orderRoutes = require("./routes/orderRoutes");
const deliveryRoutes = require("./routes/deliveryRoutes");
const deliveryAuthRoutes = require("./routes/deliveryAuthRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const server = http.createServer(app);

// ======================================================
// ENVIRONMENT
// ======================================================

const isProduction = process.env.NODE_ENV === "production";

// Frontend URL
const frontendUrl =
  process.env.FRONTEND_URL || "http://localhost:5173";

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
  cors: {
    origin: frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join_order_room", (orderId) => {
    if (orderId) {
      socket.join(orderId);
      console.log(
        `Socket ${socket.id} joined order room: ${orderId}`
      );
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

app.set("io", io);

// ======================================================
// SECURITY MIDDLEWARE
// ======================================================

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },
  })
);

// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json({ limit: "10mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ======================================================
// LOGGER
// ======================================================

app.use(morgan(isProduction ? "combined" : "dev"));

// ======================================================
// RATE LIMITING
// ======================================================

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,

  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use(limiter);

// ======================================================
// DATABASE
// ======================================================

connectDB();

// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "food-delivery-backend",
    environment: process.env.NODE_ENV || "development",
  });
});

// ======================================================
// API HEALTH CHECK
// ======================================================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Food Delivery API is running",
  });
});

// ======================================================
// ROUTES
// ======================================================

// Authentication
app.use("/api/auth", authRoutes);

// Restaurants
app.use("/api/restaurants", restaurantRoutes);

// Orders
app.use("/api/orders", orderRoutes);

// Delivery Partner
app.use("/api/delivery", deliveryRoutes);

// Delivery Partner Authentication
app.use("/api/delivery/auth", deliveryAuthRoutes);

// Admin
app.use("/api/admin", adminRoutes);

// ======================================================
// 404 HANDLER
// ======================================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    errorCode: "ROUTE_NOT_FOUND",
  });
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);

  const statusCode = err.status || 500;

  res.status(statusCode).json({
    success: false,
    message:
      isProduction
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

// ======================================================
// SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on port ${PORT}`
  );

  console.log(
    `Environment: ${
      process.env.NODE_ENV || "development"
    }`
  );

  console.log(
    `Frontend URL: ${frontendUrl}`
  );
});

// ======================================================
// GRACEFUL SHUTDOWN
// ======================================================

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down...");

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down...");

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
});

module.exports = {
  app,
  server,
  io,
};