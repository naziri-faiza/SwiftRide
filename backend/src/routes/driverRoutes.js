const express = require("express");
const router = express.Router();
const driverController = require("../controllers/driverController");
const { optionalUser } = require("../middleware/authMiddleware");

// Driver authentication & discovery
router.post("/login", driverController.loginDriver);
router.get("/list", driverController.getDriversList);

// Available requests feed
router.get("/available-rides", optionalUser, driverController.getAvailableRides);

// Driver actions
router.post("/rides/:referenceId/accept", optionalUser, driverController.acceptRide);
router.post("/rides/:referenceId/decline", optionalUser, driverController.declineRide);
router.patch("/rides/:referenceId/status", optionalUser, driverController.updateTripStatus);

// Driver dashboard stats & availability
router.get("/dashboard", optionalUser, driverController.getDriverDashboard);
router.post("/availability", optionalUser, driverController.toggleAvailability);

module.exports = router;
