require("dotenv").config();
const express = require("express");
const cors = require("cors");
const paymentRoutes = require("./routes/paymentRoutes");
const rideRoutes = require("./routes/rideRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// CORS configuration - Allow Next.js frontend
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:3000",
  "http://127.0.0.1:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev mode for testing
    },
    credentials: true,
  })
);

app.use(express.json());

const { isSupabaseConfigured } = require("./config/supabase");
const { isRazorpayConfigured } = require("./config/razorpay");
const { getConnectedClientsCount } = require("./socket");

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SwiftRide Backend API",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    realtime: {
      provider: "Socket.io WebSockets",
      enabled: true,
      activeClients: getConnectedClientsCount(),
    },
    database: {
      provider: isSupabaseConfigured() ? "Supabase PostgreSQL" : "Local Persistent Storage (rides.json)",
      isSupabaseConfigured: isSupabaseConfigured(),
    },
    payments: {
      provider: "Razorpay Test Mode",
      isConfigured: isRazorpayConfigured(),
    },
  });
});

const paymentController = require("./controllers/paymentController");
const authRoutes = require("./routes/authRoutes");
const customerRoutes = require("./routes/customerRoutes");
const driverRoutes = require("./routes/driverRoutes");
const { optionalUser } = require("./middleware/authMiddleware");

const customerController = require("./controllers/customerController");

// Mount Authentication, Customer & Driver Routes
app.use("/api/auth", authRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/driver", driverRoutes);

// Public Feedback Endpoint (Guest or Authenticated)
app.post("/api/feedback", optionalUser, customerController.submitFeedback);

// Mount Standard Razorpay Endpoints (with optionalUser for automatic ride tagging)
app.post("/api/create-order", optionalUser, paymentController.createOrder);
app.post("/api/verify-payment", optionalUser, paymentController.verifyPayment);

// Mount Namespaced Routes
app.use("/api/payments", optionalUser, paymentRoutes);
app.use("/api/rides", optionalUser, rideRoutes);

// 404 Not Found Handler
app.use((req, res, next) => {
  const error = new Error(`Endpoint '${req.originalUrl}' not found.`);
  error.statusCode = 404;
  next(error);
});

// Centralized Error Handler
app.use(errorHandler);

module.exports = app;
