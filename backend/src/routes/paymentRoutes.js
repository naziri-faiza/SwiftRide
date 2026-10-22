const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");

// Payment configuration status
router.get("/status", paymentController.getPaymentConfigStatus);

// Create Razorpay Order (Server-side amount calculation)
router.post("/create-order", paymentController.createOrder);

// Verify Razorpay HMAC SHA-256 signature
router.post("/verify", paymentController.verifyPayment);

module.exports = router;
