const driverStore = require("../services/driverStore");
const rideStore = require("../services/rideStore");
const { generateToken } = require("../utils/token");

// POST /api/driver/login
async function loginDriver(req, res, next) {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Driver identifier (Email, Name, or Code e.g. DRV-RAHUL) is required.",
      });
    }

    const driver = driverStore.getDriverByCodeOrEmail(identifier);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: `Driver matching '${identifier}' was not found. Please select from available active drivers.`,
      });
    }

    const token = generateToken({
      sub: driver.id,
      email: driver.email,
      fullName: driver.name,
      role: "driver",
      vehicleType: driver.vehicleType,
    });

    return res.json({
      success: true,
      message: `Welcome back, ${driver.name}! Driver Portal ready.`,
      token,
      driver,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/driver/list
async function getDriversList(req, res, next) {
  try {
    const drivers = await driverStore.listDrivers();
    return res.json({
      success: true,
      drivers,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/driver/available-rides
async function getAvailableRides(req, res, next) {
  try {
    const driverId = req.user?.id || req.query.driverId || null;
    const vehicleType = req.query.vehicleType || null;

    const availableRides = await rideStore.getAvailableRidesForDriver(driverId, vehicleType);

    return res.json({
      success: true,
      count: availableRides.length,
      rides: availableRides,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/driver/rides/:referenceId/accept
async function acceptRide(req, res, next) {
  try {
    const { referenceId } = req.params;
    const driverId = req.user?.id || req.body.driverId;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver identification is required to accept a ride.",
      });
    }

    const driver = driverStore.getDriverById(driverId) || driverStore.getDriverByCodeOrEmail(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver profile not found.",
      });
    }

    const ride = await rideStore.acceptRideByDriver(referenceId, driver);
    driverStore.incrementTrip(driver.id);

    return res.json({
      success: true,
      message: `You have accepted ride ${referenceId}. Drive safely to the pickup location!`,
      ride,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/driver/rides/:referenceId/decline
async function declineRide(req, res, next) {
  try {
    const { referenceId } = req.params;
    const driverId = req.user?.id || req.body.driverId;

    if (driverId) {
      await rideStore.declineRideByDriver(referenceId, driverId);
    }

    return res.json({
      success: true,
      message: `Ride ${referenceId} declined. Looking for other requests.`,
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/driver/rides/:referenceId/status
async function updateTripStatus(req, res, next) {
  try {
    const { referenceId } = req.params;
    const { status, driverId } = req.body;
    const activeDriverId = req.user?.id || driverId;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Trip status is required.",
      });
    }

    const updatedRide = await rideStore.updateDriverTripStatus(referenceId, activeDriverId, status);

    return res.json({
      success: true,
      message: `Trip status updated to '${status}'.`,
      ride: updatedRide,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/driver/dashboard
async function getDriverDashboard(req, res, next) {
  try {
    const driverId = req.user?.id || req.query.driverId;
    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required.",
      });
    }

    const driver = driverStore.getDriverById(driverId) || driverStore.getDriverByCodeOrEmail(driverId);
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found.",
      });
    }

    const stats = await rideStore.getRidesForDriver(driver.id, driver.name);

    return res.json({
      success: true,
      driver,
      ...stats,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/driver/availability
async function toggleAvailability(req, res, next) {
  try {
    const driverId = req.user?.id || req.body.driverId;
    const { isAvailable } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID is required.",
      });
    }

    const updatedDriver = driverStore.setAvailability(driverId, isAvailable);

    return res.json({
      success: true,
      isAvailable: updatedDriver.isAvailable,
      message: updatedDriver.isAvailable
        ? "You are now ONLINE and ready to receive ride requests."
        : "You are now OFFLINE.",
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  loginDriver,
  getDriversList,
  getAvailableRides,
  acceptRide,
  declineRide,
  updateTripStatus,
  getDriverDashboard,
  toggleAvailability,
};
