const express = require("express");
const router = express.Router();
const rideController = require("../controllers/rideController");
const { optionalUser } = require("../middleware/authMiddleware");

// List all rides
router.get("/", rideController.listRides);

// Create a new ride (e.g. Pay Cash flow or guest/authenticated)
router.post("/create", optionalUser, rideController.createRide);

// Get a single ride by reference ID
router.get("/:referenceId", rideController.getRide);

// Cancel a ride
router.post("/:referenceId/cancel", rideController.cancelRide);

// Update ride status (lifecycle state transition)
router.patch("/:referenceId/status", rideController.updateRideStatus);

module.exports = router;
