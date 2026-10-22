const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { authenticateUser } = require("../middleware/authMiddleware");

// All customer routes are protected by authenticateUser
router.use(authenticateUser);

// Customer ride history & linking
router.get("/rides", customerController.getCustomerRides);
router.post("/link-ride", customerController.linkRideToAccount);

// Driver Ratings & Reviews (Authenticated customer only)
router.post("/rides/:referenceId/review", customerController.submitRideReview);
router.post("/rides/:referenceId/reviews", customerController.submitRideReview);
router.get("/rides/:referenceId/review", customerController.getRideReview);
router.get("/rides/:referenceId/reviews", customerController.getRideReview);

// Customer Feedback & Suggestions
router.post("/feedback", customerController.submitFeedback);

module.exports = router;
