const { calculateFare } = require("../services/pricingService");
const rideStore = require("../services/rideStore");

/**
 * Controller for Ride Bookings and Lifecycle Management
 */

// POST /api/rides/create (for Cash Bookings or Direct Requests)
async function createRide(req, res, next) {
  try {
    const {
      pickup,
      destination,
      rideId,
      paymentMethod = "CASH",
      customerPhone,
    } = req.body;

    const riderId = req.user?.id || req.body.riderId || null;
    const customerEmail = req.user?.email || req.body.customerEmail || null;
    const customerName = req.user?.fullName || req.body.customerName || null;

    // Server-side fare calculation
    const fare = calculateFare(rideId, pickup, destination);

    const isCash = String(paymentMethod || "").toLowerCase() === "cash";
    const finalPaymentMethod = isCash ? (paymentMethod === "CASH" ? "CASH" : "cash") : (paymentMethod || "cash");
    const paymentStatus = isCash ? "pending_cash" : "pending";

    const ride = await rideStore.createRide({
      pickup,
      destination,
      rideId: fare.rideId,
      rideName: fare.rideName,
      seats: fare.seats,
      baseFare: fare.baseFare,
      distanceKm: fare.distanceKm,
      platformFee: fare.platformFee,
      totalFare: fare.totalFare,
      paymentMethod: finalPaymentMethod,
      paymentStatus,
      riderId,
      customerEmail,
      customerName,
      customerPhone,
    });

    return res.status(201).json({
      success: true,
      message: isCash
        ? "Ride booked successfully with Pay Cash on Trip Completion."
        : "Ride created and pending payment.",
      ride,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/rides/:referenceId
async function getRide(req, res, next) {
  try {
    const { referenceId } = req.params;
    const ride = await rideStore.getRide(referenceId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: `Ride with reference '${referenceId}' was not found.`,
      });
    }

    return res.json({
      success: true,
      ride,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/rides/:referenceId/cancel
async function cancelRide(req, res, next) {
  try {
    const { referenceId } = req.params;

    // Verify ride existence and ownership before cancelling
    const existingRide = await rideStore.getRide(referenceId);
    if (!existingRide) {
      return res.status(404).json({
        success: false,
        message: `Ride with reference '${referenceId}' was not found.`,
      });
    }

    // Ownership check: If authenticated user cancels, verify they own the booking
    if (req.user && existingRide.riderId && existingRide.riderId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to cancel this booking.",
      });
    }

    const cancelledRide = await rideStore.cancelRide(referenceId);

    return res.json({
      success: true,
      message: "Ride booking cancelled successfully.",
      ride: cancelledRide,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/rides/:referenceId/status
async function updateRideStatus(req, res, next) {
  try {
    const { referenceId } = req.params;
    const { status, driver, notes, changedBy } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status field is required for status transition update.",
      });
    }

    const updatedRide = await rideStore.updateRideStatus(referenceId, status, {
      driver,
      notes,
      changedBy,
    });

    if (!updatedRide) {
      return res.status(404).json({
        success: false,
        message: `Ride with reference '${referenceId}' was not found.`,
      });
    }

    return res.json({
      success: true,
      message: `Ride status updated to '${status}' successfully.`,
      ride: updatedRide,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/rides
async function listRides(req, res, next) {
  try {
    const rides = await rideStore.listRides();
    return res.json({
      success: true,
      count: rides.length,
      rides,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createRide,
  getRide,
  cancelRide,
  updateRideStatus,
  listRides,
};
