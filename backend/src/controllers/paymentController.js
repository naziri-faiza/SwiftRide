const crypto = require("crypto");
const { getRazorpayInstance, isRazorpayConfigured } = require("../config/razorpay");
const { calculateFare } = require("../services/pricingService");
const rideStore = require("../services/rideStore");

/**
 * Controller for Razorpay Payments & Verification
 */

// GET /api/payments/status
async function getPaymentConfigStatus(req, res) {
  const configured = isRazorpayConfigured();
  return res.json({
    success: true,
    isRazorpayConfigured: configured,
    keyId: configured ? process.env.RAZORPAY_KEY_ID : null,
    mode: "TEST",
    message: configured
      ? "Razorpay Test Mode is configured and active."
      : "Razorpay Test Mode is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env",
  });
}

// POST /api/create-order and POST /api/payments/create-order
async function createOrder(req, res, next) {
  try {
    const { pickup, destination, rideId, amount, currency = "INR", receipt } = req.body;

    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        error: "RAZORPAY_NOT_CONFIGURED",
        message:
          "Razorpay Test Mode credentials are not configured in backend/.env. Please configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to test online payments.",
      });
    }

    const razorpay = getRazorpayInstance();

    let amountInPaise;
    let fareBreakdown = null;
    let referenceId = receipt || rideStore.generateReferenceId();
    let ride = null;

    // Case 1: SwiftRide Cab Booking request (Calculates fare strictly on server)
    if (rideId && pickup && destination) {
      fareBreakdown = calculateFare(rideId, pickup, destination);
      amountInPaise = fareBreakdown.amountInPaise;

      const riderId = req.user?.id || req.body.riderId || null;
      const customerEmail = req.user?.email || req.body.customerEmail || null;
      const customerName = req.user?.fullName || req.body.customerName || null;

      // Pre-create pending ride in repository with unique reference
      ride = await rideStore.createRide({
        referenceId,
        pickup,
        destination,
        rideId: fareBreakdown.rideId,
        rideName: fareBreakdown.rideName,
        seats: fareBreakdown.seats,
        baseFare: fareBreakdown.baseFare,
        distanceKm: fareBreakdown.distanceKm,
        platformFee: fareBreakdown.platformFee,
        totalFare: fareBreakdown.totalFare,
        paymentMethod: "razorpay",
        paymentStatus: "pending",
        riderId,
        customerEmail,
        customerName,
      });
    } else if (amount) {
      // Case 2: Standard Razorpay order request with explicit amount
      amountInPaise = Math.round(Number(amount));
    } else {
      return res.status(400).json({
        success: false,
        message: "Missing order details. Provide { rideId, pickup, destination } or { amount }.",
      });
    }

    // Minimum amount validation: 100 paise (1 INR)
    if (!amountInPaise || amountInPaise < 100) {
      return res.status(400).json({
        success: false,
        message: "Amount must be at least 100 paise (1 INR).",
      });
    }

    // Create Razorpay order via official SDK
    const options = {
      amount: amountInPaise,
      currency: currency || "INR",
      receipt: receipt || `rcpt_${referenceId}`,
      notes: {
        bookingReference: referenceId,
        ...(pickup && { pickup: pickup.trim() }),
        ...(destination && { destination: destination.trim() }),
      },
    };

    const order = await razorpay.orders.create(options);

    // Link order ID to ride if ride was created and persist immediately
    if (ride) {
      ride.razorpayOrderId = order.id;
      rideStore.saveToDisk();
    }

    return res.status(201).json({
      success: true,
      order_id: order.id,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // Send only public test key ID, never secret!
      bookingReference: referenceId,
      receipt: order.receipt,
      ...(fareBreakdown && { fareBreakdown }),
      ...(ride && { ride }),
    });
  } catch (error) {
    if (error.statusCode === 401 || error.error?.code === "BAD_REQUEST_ERROR") {
      return res.status(error.statusCode || 401).json({
        success: false,
        message: error.description || error.message || "Razorpay authentication failed. Verify your test keys.",
      });
    }
    next(error);
  }
}

// POST /api/verify-payment and POST /api/payments/verify
async function verifyPayment(req, res, next) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingReference,
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required payment verification parameters (razorpay_order_id, razorpay_payment_id, razorpay_signature).",
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "RAZORPAY_KEY_SECRET is not configured on the server.",
      });
    }

    // 1. Verify HMAC SHA-256 signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest("hex");

    const isAuthentic = generatedSignature === razorpay_signature;

    if (!isAuthentic) {
      // Signature mismatch - potential tampering
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Payment signature verification failed. Transaction was not authenticated.",
      });
    }

    // 2. Identify target ride: by direct reference OR by razorpay_order_id lookup
    let targetRef = bookingReference || req.body.referenceId || req.body.ride?.referenceId;
    if (!targetRef && razorpay_order_id) {
      const existingRide = await rideStore.getRideByOrderId(razorpay_order_id);
      if (existingRide) {
        targetRef = existingRide.referenceId;
      }
    }

    // 3. Update booking in repository as PAID only AFTER successful signature verification
    let updatedRide = null;
    if (targetRef) {
      updatedRide = await rideStore.updatePaymentSuccess(targetRef, {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
        paymentMethod: "razorpay",
        paymentStatus: "paid",
      });
    }

    return res.json({
      success: true,
      verified: true,
      message: "Payment verified successfully in Test Mode.",
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      bookingReference: targetRef || bookingReference || null,
      ...(updatedRide && { ride: updatedRide }),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPaymentConfigStatus,
  createOrder,
  verifyPayment,
};
