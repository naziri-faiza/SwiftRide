const rideStore = require("../services/rideStore");
const feedbackStore = require("../services/feedbackStore");

// GET /api/customer/rides
async function getCustomerRides(req, res, next) {
  try {
    const userId = req.user.id;
    const email = req.user.email;

    const rides = await rideStore.getRidesByCustomer(userId, email);

    return res.json({
      success: true,
      count: rides.length,
      rides,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/customer/link-ride
async function linkRideToAccount(req, res, next) {
  try {
    const { referenceId } = req.body;
    if (!referenceId || typeof referenceId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Booking reference (e.g. SR-XXXXXX) is required.",
      });
    }

    const linkedRide = await rideStore.linkRideToCustomer(
      referenceId.trim().toUpperCase(),
      req.user.id,
      req.user.email
    );

    return res.json({
      success: true,
      message: `Booking '${referenceId}' has been linked to your account.`,
      ride: linkedRide,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/customer/rides/:referenceId/review
async function submitRideReview(req, res, next) {
  try {
    const { referenceId } = req.params;
    const { rating, comment, reviewText, tags } = req.body;

    if (!rating) {
      return res.status(400).json({
        success: false,
        message: "Driver star rating (1–5) is required.",
      });
    }

    const review = await rideStore.addReview(referenceId, {
      riderId: req.user.id,
      riderEmail: req.user.email,
      riderName: req.user.fullName,
      rating,
      comment: comment || reviewText || "",
      tags,
    });

    return res.status(201).json({
      success: true,
      message: `Thank you for rating driver ${review.riderName || "your driver"}!`,
      review,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/customer/rides/:referenceId/review
async function getRideReview(req, res, next) {
  try {
    const { referenceId } = req.params;
    const review = rideStore.getReview(referenceId);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: `No review found for ride reference '${referenceId}'.`,
      });
    }

    return res.json({
      success: true,
      review,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/customer/feedback
async function submitFeedback(req, res, next) {
  try {
    const { category, rating, subject, message, contactEmail } = req.body;

    const feedback = await feedbackStore.addFeedback({
      userId: req.user?.id || null,
      category,
      rating,
      subject,
      message,
      contactEmail: contactEmail || req.user?.email || null,
    });

    return res.status(201).json({
      success: true,
      message: `Thank you for your feedback! Ticket #${feedback.id} has been logged.`,
      feedback,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCustomerRides,
  linkRideToAccount,
  submitRideReview,
  getRideReview,
  submitFeedback,
};
