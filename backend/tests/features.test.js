const http = require("http");
const crypto = require("crypto");
const assert = require("assert");
const app = require("../src/app");
const rideStore = require("../src/services/rideStore");
const feedbackStore = require("../src/services/feedbackStore");
const { generateToken } = require("../src/utils/token");

const TEST_PORT = 5066;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

// Helper for making HTTP requests in tests
function request({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runFeatureTests() {
  console.log("=================================================");
  console.log("🧪 SwiftRide Features & Security Integration Tests");
  console.log("=================================================");

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test server running on port ${TEST_PORT}`);

  try {
    // Setup test users and tokens
    const customerA = {
      sub: "cust-uuid-alpha",
      email: "alpha@example.com",
      role: "rider",
    };
    const tokenA = generateToken(customerA);

    const customerB = {
      sub: "cust-uuid-beta",
      email: "beta@example.com",
      role: "rider",
    };
    const tokenB = generateToken(customerB);

    // -------------------------------------------------------------
    // 1. Ride History Ownership & Isolation
    // -------------------------------------------------------------
    console.log("\n[1] Testing Ride History Ownership & Isolation...");

    // Create a ride for Customer A
    const rideARes = await request({
      method: "POST",
      path: "/api/rides/create",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        pickup: "Connaught Place",
        destination: "Indira Gandhi Airport (T3)",
        rideId: "swift-go",
        paymentMethod: "CASH",
      },
    });
    assert.strictEqual(rideARes.status, 201, "Customer A ride creation should succeed");
    const rideA = rideARes.body.ride;
    assert.ok(rideA.referenceId, "Ride A should have referenceId");
    assert.strictEqual(rideA.customerId, customerA.sub, "Ride A customerId matches Customer A");

    // Create a ride for Customer B
    const rideBRes = await request({
      method: "POST",
      path: "/api/rides/create",
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        pickup: "Cyber City DLF",
        destination: "Hauz Khas Village",
        rideId: "swift-comfort",
        paymentMethod: "CASH",
      },
    });
    assert.strictEqual(rideBRes.status, 201, "Customer B ride creation should succeed");
    const rideB = rideBRes.body.ride;
    assert.strictEqual(rideB.customerId, customerB.sub, "Ride B customerId matches Customer B");

    // Customer A queries /api/customer/rides
    const ridesForARes = await request({
      method: "GET",
      path: "/api/customer/rides",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(ridesForARes.status, 200);
    const ridesForA = ridesForARes.body.rides;
    assert.ok(ridesForA.some((r) => r.referenceId === rideA.referenceId), "Customer A sees ride A");
    assert.ok(!ridesForA.some((r) => r.referenceId === rideB.referenceId), "Customer A MUST NOT see Customer B's ride");
    console.log("✓ Customer A sees only their own rides (Isolation verified)");

    // Customer B queries /api/customer/rides
    const ridesForBRes = await request({
      method: "GET",
      path: "/api/customer/rides",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(ridesForBRes.status, 200);
    const ridesForB = ridesForBRes.body.rides;
    assert.ok(ridesForB.some((r) => r.referenceId === rideB.referenceId), "Customer B sees ride B");
    assert.ok(!ridesForB.some((r) => r.referenceId === rideA.referenceId), "Customer B MUST NOT see Customer A's ride");
    console.log("✓ Customer B sees only their own rides (Isolation verified)");

    // Unauthorized query returns 401
    const unauthRes = await request({
      method: "GET",
      path: "/api/customer/rides",
    });
    assert.strictEqual(unauthRes.status, 401, "Unauthenticated customer request returns 401");
    console.log("✓ Unauthenticated ride history request rejected with 401");

    // -------------------------------------------------------------
    // 2. Ride Receipt Data Integrity
    // -------------------------------------------------------------
    console.log("\n[2] Testing Ride Receipt Data Integrity...");
    const receiptRes = await request({
      method: "GET",
      path: `/api/rides/${rideA.referenceId}`,
    });
    assert.strictEqual(receiptRes.status, 200);
    const receiptData = receiptRes.body.ride;
    assert.strictEqual(receiptData.referenceId, rideA.referenceId);
    assert.strictEqual(receiptData.pickup, "Connaught Place");
    assert.strictEqual(receiptData.destination, "Indira Gandhi Airport (T3)");
    assert.strictEqual(receiptData.rideName, "SwiftGo");
    assert.ok(typeof receiptData.baseFare === "number");
    assert.ok(typeof receiptData.distanceKm === "number");
    assert.ok(typeof receiptData.platformFee === "number");
    assert.ok(typeof receiptData.totalFare === "number");
    assert.strictEqual(receiptData.paymentMethod, "CASH");
    assert.ok(receiptData.bookedAt, "Has bookedAt timestamp");
    console.log("✓ Ride receipt contains all required fare breakdown and booking reference fields");

    // -------------------------------------------------------------
    // 3. Driver Ratings & Reviews: Lifecycle & Authorization Restrictions
    // -------------------------------------------------------------
    console.log("\n[3] Testing Ratings & Reviews Restrictions...");

    // 3.1 Attempt review while ride is not COMPLETED (currently REQUESTED)
    const earlyReviewRes = await request({
      method: "POST",
      path: `/api/customer/rides/${rideA.referenceId}/reviews`,
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        rating: 5,
        reviewText: "Great ride before it started!",
        tags: ["Punctual Pickup"],
      },
    });
    assert.strictEqual(earlyReviewRes.status, 400, "Should reject review on non-completed ride");
    assert.ok(earlyReviewRes.body.message.includes("completed"), "Error mentions ride must be completed");
    console.log("✓ Blocked review on non-completed ride (400 Bad Request)");

    // 3.2 Move ride legitimately through state machine to COMPLETED
    await rideStore.updateRideStatus(rideA.referenceId, "DRIVER_ASSIGNED");
    await rideStore.updateRideStatus(rideA.referenceId, "DRIVER_ARRIVING");
    await rideStore.updateRideStatus(rideA.referenceId, "IN_PROGRESS");
    await rideStore.updateRideStatus(rideA.referenceId, "COMPLETED");

    // 3.2 Attempt review by unauthorized customer (Customer B tries to review Customer A's ride)
    const unauthorizedReviewRes = await request({
      method: "POST",
      path: `/api/customer/rides/${rideA.referenceId}/reviews`,
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        rating: 1,
        reviewText: "I did not book this but leaving a bad review",
        tags: [],
      },
    });
    assert.strictEqual(unauthorizedReviewRes.status, 403, "Should reject review by non-owner");
    assert.ok(unauthorizedReviewRes.body.message.includes("only review rides"), "Error mentions ownership");
    console.log("✓ Blocked review from non-owner (403 Forbidden)");

    // 3.3 Invalid rating validation (rating = 6 or 0)
    const invalidRatingRes = await request({
      method: "POST",
      path: `/api/customer/rides/${rideA.referenceId}/reviews`,
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        rating: 6,
        reviewText: "Too good",
      },
    });
    assert.strictEqual(invalidRatingRes.status, 400, "Rating > 5 should be rejected");
    console.log("✓ Blocked out-of-bounds rating > 5 (400 Bad Request)");

    // 3.4 Valid review submission by legitimate owner
    const validReviewRes = await request({
      method: "POST",
      path: `/api/customer/rides/${rideA.referenceId}/reviews`,
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        rating: 5,
        reviewText: "Driver was very polite, car was squeaky clean!",
        tags: ["Safe & Smooth Driving", "Clean & Sanitized Cab"],
      },
    });
    assert.strictEqual(validReviewRes.status, 201, "Legitimate review should be accepted");
    assert.strictEqual(validReviewRes.body.review.rating, 5);
    assert.strictEqual(validReviewRes.body.review.referenceId, rideA.referenceId);
    console.log("✓ Accepted valid review on completed ride (201 Created)");

    // 3.5 Duplicate review prevention on same ride
    const duplicateReviewRes = await request({
      method: "POST",
      path: `/api/customer/rides/${rideA.referenceId}/reviews`,
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        rating: 4,
        reviewText: "Trying to submit another review",
      },
    });
    assert.strictEqual(duplicateReviewRes.status, 409, "Duplicate review should return 409 Conflict");
    assert.ok(duplicateReviewRes.body.message.includes("already"), "Error mentions already submitted");
    console.log("✓ Prevented duplicate review submission (409 Conflict)");

    // 3.6 Verify review persists and is attached to ride queries
    const rideWithReviewRes = await request({
      method: "GET",
      path: `/api/customer/rides/${rideA.referenceId}/reviews`,
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(rideWithReviewRes.status, 200);
    assert.ok(rideWithReviewRes.body.review);
    assert.strictEqual(rideWithReviewRes.body.review.rating, 5);
    console.log("✓ Review verified in customer ride review query");

    // -------------------------------------------------------------
    // 4. Customer Feedback Validation & Persistence
    // -------------------------------------------------------------
    console.log("\n[4] Testing Customer Feedback Form...");

    // 4.1 Missing required message field
    const emptyFeedbackRes = await request({
      method: "POST",
      path: "/api/feedback",
      body: {
        category: "app_experience",
        rating: 4,
        subject: "Great app",
        message: "",
      },
    });
    assert.strictEqual(emptyFeedbackRes.status, 400, "Empty feedback message must be rejected");
    console.log("✓ Empty feedback message rejected with 400 Bad Request");

    // 4.2 Valid feedback submission (authenticated or guest)
    const validFeedbackRes = await request({
      method: "POST",
      path: "/api/feedback",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        category: "feature_request",
        rating: 5,
        subject: "Add scheduled rides feature",
        message: "It would be amazing to book a ride for tomorrow 9 AM in advance!",
      },
    });
    assert.strictEqual(validFeedbackRes.status, 201, "Valid feedback should be accepted");
    assert.ok(validFeedbackRes.body.feedback.ticketId.startsWith("FB-"), "Ticket ID generated with prefix FB-");
    assert.strictEqual(validFeedbackRes.body.feedback.category, "FEATURE_REQUEST");
    console.log(`✓ Feedback successfully saved with ticket ${validFeedbackRes.body.feedback.ticketId} (201 Created)`);

    // -------------------------------------------------------------
    // 5. Razorpay Payment Verification & Database Persistence
    // -------------------------------------------------------------
    console.log("\n[5] Testing Razorpay Payment Verification & Persistence...");

    // 5.1 Create order via POST /api/payments/create-order
    const orderRes = await request({
      method: "POST",
      path: "/api/payments/create-order",
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        pickup: "Connaught Place, Inner Circle",
        destination: "Indira Gandhi Airport (T3)",
        rideId: "swift-go",
      },
    });
    assert.strictEqual(orderRes.status, 201, "Order creation should succeed");
    const orderData = orderRes.body;
    assert.ok(orderData.orderId, "Has orderId");
    assert.ok(orderData.bookingReference, "Has bookingReference");
    assert.ok(orderData.ride, "Returns created ride object");
    assert.strictEqual(orderData.ride.paymentMethod, "razorpay");
    assert.strictEqual(orderData.ride.paymentStatus, "pending");
    console.log(`✓ Razorpay order created (${orderData.orderId}) with pending status and razorpay method`);

    // 5.2 Invalid signature verification attempt must fail and NOT mark ride as paid
    const fakePaymentId = "pay_test_" + Date.now();
    const badVerifyRes = await request({
      method: "POST",
      path: "/api/payments/verify",
      body: {
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: "tampered_invalid_signature_12345",
        bookingReference: orderData.bookingReference,
      },
    });
    assert.strictEqual(badVerifyRes.status, 400, "Bad signature should be rejected with 400");
    const rideAfterBadVerify = await rideStore.getRide(orderData.bookingReference);
    assert.strictEqual(rideAfterBadVerify.paymentStatus, "pending", "Ride remains pending when signature verification fails");
    console.log("✓ Tampered/invalid payment signature rejected (400) without modifying ride status");

    // 5.3 Valid signature verification MUST update ride to paymentMethod: 'razorpay' and paymentStatus: 'paid'
    const secret = (process.env.RAZORPAY_KEY_SECRET || "9NMtxnH96cP9XGyfIj3Cm62A").trim();
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderData.orderId}|${fakePaymentId}`)
      .digest("hex");

    const goodVerifyRes = await request({
      method: "POST",
      path: "/api/payments/verify",
      body: {
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: validSignature,
        bookingReference: orderData.bookingReference,
      },
    });
    assert.strictEqual(goodVerifyRes.status, 200, "Valid signature verification should succeed with 200");
    assert.strictEqual(goodVerifyRes.body.verified, true);
    assert.strictEqual(goodVerifyRes.body.ride.paymentMethod, "razorpay");
    assert.strictEqual(goodVerifyRes.body.ride.paymentStatus, "paid");
    assert.strictEqual(goodVerifyRes.body.ride.razorpayPaymentId, fakePaymentId);

    const verifiedRideInDb = await rideStore.getRide(orderData.bookingReference);
    assert.strictEqual(verifiedRideInDb.paymentMethod, "razorpay");
    assert.strictEqual(verifiedRideInDb.paymentStatus, "paid");
    assert.strictEqual(verifiedRideInDb.razorpayPaymentId, fakePaymentId);
    console.log("✓ Server-side HMAC verified; booking record correctly persisted with paymentMethod: 'razorpay' and paymentStatus: 'paid'");

    // 5.4 Check reconciled ride SR-618545
    const srRide = await rideStore.getRide("SR-618545");
    assert.ok(srRide, "Ride SR-618545 must exist");
    assert.strictEqual(srRide.paymentMethod, "razorpay", "SR-618545 reconciled with razorpay method");
    assert.strictEqual(srRide.paymentStatus, "paid", "SR-618545 reconciled with paid status");
    assert.strictEqual(srRide.razorpayPaymentId, "pay_Tpu8uAhs1Y2LGK", "SR-618545 verified payment ID matches");
    console.log("✓ Existing ride SR-618545 reconciled with verified payment record (pay_Tpu8uAhs1Y2LGK)");

    console.log("\n=================================================");
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (100% Green)");
    console.log("=================================================");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log("✓ Test server closed safely");
  }
}

runFeatureTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
