/**
 * Server-side Pricing Service for SwiftRide
 * CRITICAL SECURITY PRINCIPLE:
 * Ride fares must ALWAYS be calculated and validated on the server.
 * Frontend fare estimates cannot be trusted to prevent price tampering.
 */

const VEHICLE_CATEGORIES = {
  "swift-go": {
    id: "swift-go",
    name: "SwiftGo",
    seats: 4,
    baseFare: 80,
    perKmRate: 14,
    estimatedArrival: "3 mins away",
  },
  "swift-comfort": {
    id: "swift-comfort",
    name: "SwiftComfort",
    seats: 4,
    baseFare: 130,
    perKmRate: 18,
    estimatedArrival: "4 mins away",
  },
  "swift-xl": {
    id: "swift-xl",
    name: "SwiftXL",
    seats: 6,
    baseFare: 210,
    perKmRate: 24,
    estimatedArrival: "6 mins away",
  },
};

const PLATFORM_FEE = 25;
const DEFAULT_DEMO_DISTANCE_KM = 8.5;

function getVehicleCategory(rideId) {
  return VEHICLE_CATEGORIES[rideId] || null;
}

/**
 * Calculates authoritative ride fare on the server
 */
function calculateFare(rideId, pickup, destination) {
  if (!pickup || typeof pickup !== "string" || !pickup.trim()) {
    const error = new Error("Pickup location is required.");
    error.statusCode = 400;
    throw error;
  }

  if (!destination || typeof destination !== "string" || !destination.trim()) {
    const error = new Error("Destination is required.");
    error.statusCode = 400;
    throw error;
  }

  const category = getVehicleCategory(rideId);
  if (!category) {
    const error = new Error(`Invalid ride category: '${rideId}'. Available categories: swift-go, swift-comfort, swift-xl.`);
    error.statusCode = 400;
    throw error;
  }

  const distanceKm = DEFAULT_DEMO_DISTANCE_KM;
  const distanceFare = Math.round(distanceKm * category.perKmRate);
  const totalFare = category.baseFare + distanceFare + PLATFORM_FEE;
  const amountInPaise = totalFare * 100; // Razorpay expects amount in paise

  return {
    rideId: category.id,
    rideName: category.name,
    seats: category.seats,
    baseFare: category.baseFare,
    perKmRate: category.perKmRate,
    distanceKm,
    distanceFare,
    platformFee: PLATFORM_FEE,
    totalFare,
    amountInPaise,
    currency: "INR",
  };
}

module.exports = {
  VEHICLE_CATEGORIES,
  calculateFare,
  getVehicleCategory,
};
