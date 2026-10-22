const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");
const { getSupabaseClient, isSupabaseConfigured } = require("../config/supabase");

/**
 * SwiftRide Dual-Engine Ride Repository
 * 1. Primary: Supabase PostgreSQL tables ('rides', 'payments', 'drivers', 'ride_status_history')
 * 2. Persistent Local Storage Fallback: 'backend/data/rides.json' ensures bookings persist across server restarts
 *    even when Supabase credentials are yet to be placed in .env.
 */

const DATA_DIR = path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "rides.json");
const REVIEWS_FILE = path.join(DATA_DIR, "reviews.json");
const driverStore = require("./driverStore");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class RideStore extends EventEmitter {
  constructor() {
    super();
    this.rides = new Map();
    this.reviews = new Map();
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((ride) => {
            if (ride && ride.referenceId) {
              this.rides.set(ride.referenceId, ride);
            }
          });
        }
      }

      if (fs.existsSync(REVIEWS_FILE)) {
        const rawReviews = fs.readFileSync(REVIEWS_FILE, "utf-8");
        const reviewList = JSON.parse(rawReviews);
        if (Array.isArray(reviewList)) {
          reviewList.forEach((rev) => {
            if (rev && rev.referenceId) {
              this.reviews.set(rev.referenceId, rev);
              const ride = this.rides.get(rev.referenceId);
              if (ride) ride.review = rev;
            }
          });
        }
      }
    } catch (err) {
      console.warn("[RideStore] Failed to load local persistent storage:", err.message);
    }
  }

  saveToDisk() {
    try {
      const list = Array.from(this.rides.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");

      const reviewList = Array.from(this.reviews.values());
      fs.writeFileSync(REVIEWS_FILE, JSON.stringify(reviewList, null, 2), "utf-8");
    } catch (err) {
      console.warn("[RideStore] Failed to write to local storage:", err.message);
    }
  }

  generateReferenceId() {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    return `SR-${randomDigits}`;
  }

  async createRide({
    referenceId,
    pickup,
    destination,
    rideId,
    rideName,
    seats,
    baseFare,
    distanceKm,
    platformFee,
    totalFare,
    paymentMethod,
    paymentStatus = "PENDING",
    razorpayOrderId = null,
    riderId = null,
    customerEmail = null,
    customerName = null,
    customerPhone = null,
  }) {
    // 1. Accidental Duplicate Submission Prevention:
    // If the exact same ride was created in the last 10 seconds, reuse it rather than duplicating.
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();
    for (const existingRide of this.rides.values()) {
      if (
        existingRide.pickup.toLowerCase() === pickup.trim().toLowerCase() &&
        existingRide.destination.toLowerCase() === destination.trim().toLowerCase() &&
        existingRide.rideId === rideId &&
        existingRide.status !== "CANCELLED" &&
        existingRide.status !== "COMPLETED" &&
        existingRide.createdAt >= tenSecondsAgo
      ) {
        return existingRide;
      }
    }

    const refId = referenceId || this.generateReferenceId();
    const now = new Date();

    const newRide = {
      referenceId: refId,
      pickup: pickup.trim(),
      destination: destination.trim(),
      rideId,
      rideName,
      seats,
      baseFare,
      distanceKm,
      platformFee,
      totalFare,
      status: "REQUESTED", // REQUESTED -> ACCEPTED -> DRIVER_ARRIVING -> IN_PROGRESS -> COMPLETED
      paymentMethod, // 'RAZORPAY_TEST' | 'CASH'
      paymentStatus, // 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'PENDING_CASH'
      razorpayOrderId,
      razorpayPaymentId: null,
      riderId: riderId || null,
      customerId: riderId || null,
      customerEmail: customerEmail ? customerEmail.toLowerCase() : null,
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      driverAssigned: false,
      assignedDriverId: null,
      declinedDriverIds: [],
      bookedAt: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: now.toISOString(),
      driver: {
        name: "Rahul Sharma",
        car: "White Maruti Dzire (CNG/AC)",
        rating: 4.89,
        plate: "DL 01 AB 4291",
        etaMins: 3,
        phone: "+91 98765 43210",
      },
    };

    // 1. In-memory & Persistent Disk Save
    this.rides.set(refId, newRide);
    this.saveToDisk();

    // 2. Supabase Cloud Persistence (when configured)
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { error } = await supabase.from("rides").insert([
            {
              reference_id: newRide.referenceId,
              pickup: newRide.pickup,
              destination: newRide.destination,
              ride_id: newRide.rideId,
              ride_name: newRide.rideName,
              seats: newRide.seats,
              base_fare: newRide.baseFare,
              distance_km: newRide.distanceKm,
              platform_fee: newRide.platformFee,
              total_fare: newRide.totalFare,
              status: newRide.status,
              payment_method: newRide.paymentMethod,
              payment_status: newRide.paymentStatus,
              razorpay_order_id: newRide.razorpayOrderId,
              rider_id: newRide.riderId,
              booked_at: newRide.bookedAt,
            },
          ]);

          if (error) {
            console.warn("[Supabase] Insert ride notice:", error.message);
          }
        }
      } catch (err) {
        console.warn("[Supabase] Error saving ride to Supabase:", err.message);
      }
    }

    // 3. Emit real-time creation event
    this.emit("ride:created", newRide);

    return newRide;
  }

  async getRide(referenceId) {
    if (!referenceId) return null;

    // 1. Check in-memory / local storage cache
    let ride = this.rides.get(referenceId) || null;

    // 2. Check Supabase (if configured and not found or to get latest record)
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("reference_id", referenceId)
            .single();

          if (!error && data) {
            ride = {
              referenceId: data.reference_id,
              pickup: data.pickup,
              destination: data.destination,
              rideId: data.ride_id,
              rideName: data.ride_name,
              seats: data.seats,
              baseFare: Number(data.base_fare),
              distanceKm: Number(data.distance_km),
              platformFee: Number(data.platform_fee),
              totalFare: Number(data.total_fare),
              status: data.status,
              paymentMethod: data.payment_method,
              paymentStatus: data.payment_status,
              razorpayOrderId: data.razorpay_order_id,
              razorpayPaymentId: data.razorpay_payment_id,
              bookedAt: data.booked_at,
              createdAt: data.created_at,
              driver: ride?.driver || {
                name: "Rahul Sharma",
                car: "White Maruti Dzire (CNG/AC)",
                rating: 4.89,
                plate: "DL 01 AB 4291",
                etaMins: 3,
                phone: "+91 98765 43210",
              },
            };
            this.rides.set(referenceId, ride);
            this.saveToDisk();
          }
        }
      } catch (err) {
        console.warn("[Supabase] Error reading ride from Supabase:", err.message);
      }
    }

    if (ride) {
      ride.review = this.reviews.get(referenceId) || null;
    }
    return ride;
  }

  async getRideByOrderId(orderId) {
    if (!orderId) return null;
    for (const ride of this.rides.values()) {
      if (ride.razorpayOrderId === orderId) {
        return ride;
      }
    }
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("rides")
            .select("*")
            .eq("razorpay_order_id", orderId)
            .single();
          if (data && !error) {
            return this.transformDbRide(data);
          }
        }
      } catch (err) {
        console.warn("[RideStore] Error querying ride by order ID from Supabase:", err.message);
      }
    }
    return null;
  }

  async updatePaymentSuccess(referenceId, { paymentId, orderId, signature, paymentMethod = "razorpay", paymentStatus = "paid" }) {
    let ride = await this.getRide(referenceId);
    if (!ride) return null;

    ride.paymentMethod = paymentMethod || "razorpay";
    ride.paymentStatus = paymentStatus || "paid";
    ride.razorpayPaymentId = paymentId;
    ride.razorpayOrderId = orderId || ride.razorpayOrderId;
    ride.razorpaySignature = signature;
    ride.paidAt = new Date().toISOString();

    // Preserve existing trip lifecycle status (do not regress if driver assigned, in progress, or completed)
    if (!ride.status || ride.status === "PENDING") {
      ride.status = "REQUESTED";
    }

    this.rides.set(referenceId, ride);
    this.saveToDisk();

    // Update in Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const updatePayload = {
            payment_method: ride.paymentMethod,
            payment_status: ride.paymentStatus,
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId || ride.razorpayOrderId,
            razorpay_signature: signature,
            paid_at: ride.paidAt,
            updated_at: new Date().toISOString(),
          };
          if (!ride.status || ride.status === "PENDING") {
            updatePayload.status = "REQUESTED";
          }

          await supabase
            .from("rides")
            .update(updatePayload)
            .eq("reference_id", referenceId);

          // Audit log payment record
          await supabase.from("payments").insert([
            {
              reference_id: referenceId,
              amount: ride.totalFare,
              currency: "INR",
              method: ride.paymentMethod || "razorpay",
              status: ride.paymentStatus || "paid",
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentId,
              razorpay_signature: signature,
            },
          ]);
        }
      } catch (err) {
        console.warn("[Supabase] Error updating payment in Supabase:", err.message);
      }
    }

    // Emit real-time payment success event
    this.emit("ride:updated", { ride, eventType: "PAID" });

    return ride;
  }

  async cancelRide(referenceId) {
    let ride = await this.getRide(referenceId);
    if (!ride) return null;

    if (ride.status === "COMPLETED") {
      const error = new Error("Cannot cancel an already completed ride.");
      error.statusCode = 400;
      throw error;
    }

    if (ride.status === "IN_PROGRESS") {
      const error = new Error("Cannot cancel a trip that is currently in progress. Please contact customer support.");
      error.statusCode = 400;
      throw error;
    }

    if (ride.status === "CANCELLED") {
      return ride; // Already cancelled, idempotent response
    }

    const previousStatus = ride.status;
    ride.status = "CANCELLED";

    const isRazorpayPaid =
      String(ride.paymentMethod || "").toLowerCase().includes("razorpay") &&
      String(ride.paymentStatus || "").toLowerCase() === "paid";

    if (isRazorpayPaid) {
      ride.refundStatus = "REFUND_REQUESTED_DEMO";
    } else {
      ride.paymentStatus = "CANCELLED";
    }

    ride.cancelledAt = new Date().toISOString();
    this.rides.set(referenceId, ride);
    this.saveToDisk();

    // Update in Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from("rides")
            .update({
              status: "CANCELLED",
              payment_status: ride.paymentStatus,
              cancelled_at: ride.cancelledAt,
              updated_at: new Date().toISOString(),
            })
            .eq("reference_id", referenceId);

          // Log in history
          await supabase.from("ride_status_history").insert([
            {
              from_status: "REQUESTED",
              to_status: "CANCELLED",
              changed_by: "rider",
              notes: "Booking cancelled by customer",
            },
          ]);
        }
      } catch (err) {
        console.warn("[Supabase] Error updating cancellation in Supabase:", err.message);
      }
    }

    // Emit real-time cancellation event
    this.emit("ride:updated", { ride, eventType: "CANCELLED" });

    return ride;
  }

  async updateRideStatus(referenceId, newStatus, { driver, notes, changedBy = "system" } = {}) {
    let ride = await this.getRide(referenceId);
    if (!ride) return null;

    const currentStatus = ride.status;

    // Strict booking lifecycle state transitions
    const allowedTransitions = {
      PENDING: ["CONFIRMED", "REQUESTED", "CANCELLED"],
      REQUESTED: ["CONFIRMED", "DRIVER_ASSIGNED", "CANCELLED"],
      CONFIRMED: ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "CANCELLED"],
      DRIVER_ASSIGNED: ["DRIVER_ARRIVING", "CANCELLED"],
      DRIVER_ARRIVING: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED"],
      COMPLETED: [],
      CANCELLED: [],
    };

    const validNextStates = allowedTransitions[currentStatus] || [];
    if (!validNextStates.includes(newStatus)) {
      const error = new Error(
        `Invalid ride status transition from '${currentStatus}' to '${newStatus}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    ride.status = newStatus;
    if (driver) {
      ride.driver = { ...ride.driver, ...driver };
    }
    ride.updatedAt = new Date().toISOString();

    this.rides.set(referenceId, ride);
    this.saveToDisk();

    // Update in Supabase
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from("rides")
            .update({
              status: newStatus,
              updated_at: ride.updatedAt,
            })
            .eq("reference_id", referenceId);

          await supabase.from("ride_status_history").insert([
            {
              from_status: currentStatus,
              to_status: newStatus,
              changed_by: changedBy,
              notes: notes || `Status updated from ${currentStatus} to ${newStatus}`,
            },
          ]);
        }
      } catch (err) {
        console.warn("[Supabase] Error updating ride status in Supabase:", err.message);
      }
    }

    // Emit real-time status update event
    this.emit("ride:updated", { ride, eventType: "STATUS_CHANGED", metadata: { notes, changedBy } });

    return ride;
  }

  async listRides() {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase
            .from("rides")
            .select("*")
            .order("created_at", { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            return data.map((d) => ({
              referenceId: d.reference_id,
              pickup: d.pickup,
              destination: d.destination,
              rideId: d.ride_id,
              rideName: d.ride_name,
              seats: d.seats,
              baseFare: Number(d.base_fare),
              distanceKm: Number(d.distance_km),
              platformFee: Number(d.platform_fee),
              totalFare: Number(d.total_fare),
              status: d.status,
              paymentMethod: d.payment_method,
              paymentStatus: d.payment_status,
              bookedAt: d.booked_at,
              createdAt: d.created_at,
            }));
          }
        }
      } catch (err) {
        console.warn("[Supabase] Error listing rides from Supabase:", err.message);
      }
    }

    return Array.from(this.rides.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  async getRidesByCustomer(userId, email) {
    const normalizedEmail = email ? email.toLowerCase() : null;
    const userRides = [];

    // 1. In-memory / local disk search
    for (const ride of this.rides.values()) {
      const matchId = userId && ride.riderId === userId;
      const matchEmail = normalizedEmail && ride.customerEmail && ride.customerEmail.toLowerCase() === normalizedEmail;
      if (matchId || matchEmail) {
        userRides.push(ride);
      }
    }

    // 2. Supabase search if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          let query = supabase.from("rides").select("*");
          if (userId) {
            query = query.eq("rider_id", userId);
          }
          const { data, error } = await query.order("created_at", { ascending: false });
          if (!error && Array.isArray(data)) {
            const existingRefs = new Set(userRides.map((r) => r.referenceId));
            for (const d of data) {
              if (!existingRefs.has(d.reference_id)) {
                userRides.push({
                  referenceId: d.reference_id,
                  riderId: d.rider_id,
                  pickup: d.pickup,
                  destination: d.destination,
                  rideId: d.ride_id,
                  rideName: d.ride_name,
                  seats: d.seats,
                  baseFare: Number(d.base_fare),
                  distanceKm: Number(d.distance_km),
                  platformFee: Number(d.platform_fee),
                  totalFare: Number(d.total_fare),
                  status: d.status,
                  paymentMethod: d.payment_method,
                  paymentStatus: d.payment_status,
                  razorpayOrderId: d.razorpay_order_id,
                  razorpayPaymentId: d.razorpay_payment_id,
                  bookedAt: d.booked_at,
                  createdAt: d.created_at,
                  driver: {
                    name: "Rahul Sharma",
                    car: "White Maruti Dzire (CNG/AC)",
                    rating: 4.89,
                    plate: "DL 01 AB 4291",
                    etaMins: 3,
                    phone: "+91 98765 43210",
                  },
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Supabase] Get customer rides notice:", err.message);
      }
    }

    // Attach reviews and sort newest first
    userRides.forEach((r) => {
      r.review = this.reviews.get(r.referenceId) || null;
    });

    return userRides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async linkRideToCustomer(referenceId, userId, email) {
    const ride = await this.getRide(referenceId);
    if (!ride) {
      const error = new Error(`Booking reference '${referenceId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    ride.riderId = userId;
    if (email) ride.customerEmail = email.toLowerCase();
    ride.updatedAt = new Date().toISOString();

    this.rides.set(referenceId, ride);
    this.saveToDisk();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from("rides")
            .update({
              rider_id: userId,
              updated_at: ride.updatedAt,
            })
            .eq("reference_id", referenceId);
        }
      } catch (err) {
        console.warn("[Supabase] Link ride notice:", err.message);
      }
    }

    // Emit real-time link event
    this.emit("ride:updated", { ride, eventType: "LINKED", metadata: { userId } });

    return ride;
  }

  async getAvailableRidesForDriver(driverId, vehicleType) {
    const available = [];
    for (const ride of this.rides.values()) {
      if (
        (ride.status === "REQUESTED" || ride.status === "CONFIRMED") &&
        !ride.driverAssigned &&
        !(ride.declinedDriverIds && ride.declinedDriverIds.includes(driverId))
      ) {
        if (!vehicleType || ride.rideId === vehicleType) {
          available.push(ride);
        }
      }
    }
    return available.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async acceptRideByDriver(referenceId, driver) {
    const ride = await this.getRide(referenceId);
    if (!ride) {
      const error = new Error(`Ride with reference '${referenceId}' was not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Race-condition guard: prevent two drivers from accepting the same ride
    if (ride.driverAssigned || (ride.status !== "REQUESTED" && ride.status !== "CONFIRMED")) {
      const error = new Error(
        "This ride request has already been accepted by another driver or is no longer available."
      );
      error.statusCode = 409;
      throw error;
    }

    ride.driverAssigned = true;
    ride.assignedDriverId = driver.id;
    ride.status = "DRIVER_ASSIGNED";
    ride.driver = {
      id: driver.id,
      name: driver.name,
      car: driver.car,
      plate: driver.plate,
      rating: driver.rating || 4.89,
      phone: driver.phone,
      etaMins: driver.etaMins || 3,
    };
    ride.acceptedAt = new Date().toISOString();
    ride.updatedAt = new Date().toISOString();

    this.rides.set(referenceId, ride);
    this.saveToDisk();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from("rides")
            .update({
              status: "DRIVER_ASSIGNED",
              driver_id: driver.id,
              updated_at: ride.updatedAt,
            })
            .eq("reference_id", referenceId);
        }
      } catch (err) {
        console.warn("[Supabase] Accept ride update notice:", err.message);
      }
    }

    // Emit real-time ride acceptance event
    this.emit("ride:updated", { ride, eventType: "ACCEPTED", metadata: { driver } });

    return ride;
  }

  async declineRideByDriver(referenceId, driverId) {
    const ride = await this.getRide(referenceId);
    if (!ride) return null;

    if (!ride.declinedDriverIds) {
      ride.declinedDriverIds = [];
    }
    if (!ride.declinedDriverIds.includes(driverId)) {
      ride.declinedDriverIds.push(driverId);
    }
    this.rides.set(referenceId, ride);
    this.saveToDisk();
    return ride;
  }

  async updateDriverTripStatus(referenceId, driverId, newStatus) {
    const ride = await this.getRide(referenceId);
    if (!ride) {
      const error = new Error(`Ride with reference '${referenceId}' was not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Allowed driver trip progression
    const allowed = {
      DRIVER_ASSIGNED: ["DRIVER_ARRIVING", "CANCELLED"],
      DRIVER_ARRIVING: ["IN_PROGRESS", "CANCELLED"],
      IN_PROGRESS: ["COMPLETED"],
    };

    const nextStates = allowed[ride.status] || [];
    if (!nextStates.includes(newStatus)) {
      const error = new Error(
        `Invalid trip status transition from '${ride.status}' to '${newStatus}'.`
      );
      error.statusCode = 400;
      throw error;
    }

    ride.status = newStatus;
    ride.updatedAt = new Date().toISOString();

    if (newStatus === "COMPLETED") {
      ride.completedAt = new Date().toISOString();
      if (String(ride.paymentMethod || "").toLowerCase() === "cash") {
        ride.paymentStatus = ride.paymentMethod === "CASH" ? "PAID" : "paid"; // Cash collected by driver
      }
    }

    this.rides.set(referenceId, ride);
    this.saveToDisk();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from("rides")
            .update({
              status: newStatus,
              payment_status: ride.paymentStatus,
              updated_at: ride.updatedAt,
            })
            .eq("reference_id", referenceId);
        }
      } catch (err) {
        console.warn("[Supabase] Driver status update notice:", err.message);
      }
    }

    // Emit real-time driver trip status progression event
    this.emit("ride:updated", { ride, eventType: "STATUS_CHANGED", metadata: { status: newStatus } });

    return ride;
  }

  async getRidesForDriver(driverId, driverName) {
    const driverRides = [];
    for (const r of this.rides.values()) {
      const matchId = r.assignedDriverId === driverId || r.driver?.id === driverId;
      const matchName = driverName && r.driver?.name?.toLowerCase() === driverName.toLowerCase();
      if (matchId || matchName) {
        driverRides.push(r);
      }
    }

    driverRides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const activeRide =
      driverRides.find((r) =>
        ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(r.status)
      ) || null;

    const completedRides = driverRides.filter((r) => r.status === "COMPLETED");
    const totalEarnings = completedRides.reduce(
      (sum, r) => sum + (Number(r.totalFare) || 0),
      0
    );

    return {
      activeRide,
      completedRides,
      totalEarnings,
      tripsCount: completedRides.length,
    };
  }

  async addReview(referenceId, { riderId, riderEmail, riderName, rating, comment, tags }) {
    const ride = await this.getRide(referenceId);
    if (!ride) {
      const error = new Error(`Ride with reference '${referenceId}' was not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (ride.status !== "COMPLETED") {
      const error = new Error("Reviews can only be submitted for completed trips.");
      error.statusCode = 400;
      throw error;
    }

    // Ownership check: must match riderId or customerEmail if booking belongs to an account
    const matchesUser = riderId && ride.riderId && ride.riderId === riderId;
    const matchesEmail =
      riderEmail && ride.customerEmail && ride.customerEmail.toLowerCase() === riderEmail.toLowerCase();
    if (!matchesUser && !matchesEmail && ride.riderId) {
      const error = new Error("You are not authorized to review this ride. You can only review rides that you booked.");
      error.statusCode = 403;
      throw error;
    }

    // Duplicate review check
    if (this.reviews.has(referenceId) || ride.review) {
      const error = new Error("A review has already been submitted for this ride booking.");
      error.statusCode = 409;
      throw error;
    }

    // Rating validation
    const numRating = Math.round(Number(rating));
    if (!numRating || numRating < 1 || numRating > 5) {
      const error = new Error("Rating must be an integer between 1 and 5.");
      error.statusCode = 400;
      throw error;
    }

    const review = {
      referenceId,
      riderId: riderId || ride.riderId || null,
      riderName: riderName || ride.customerName || "Verified Rider",
      driverId: ride.assignedDriverId || ride.driver?.id || null,
      rating: numRating,
      comment: comment ? String(comment).trim() : "",
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
    };

    this.reviews.set(referenceId, review);
    ride.review = review;
    this.rides.set(referenceId, ride);
    this.saveToDisk();

    // Update driver rating
    if (review.driverId) {
      driverStore.updateDriverRating(review.driverId, numRating);
    }

    // Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.from("reviews").insert([
            {
              reference_id: referenceId,
              rider_id: review.riderId,
              driver_id: review.driverId,
              rating: review.rating,
              comment: review.comment,
              tags: review.tags,
            },
          ]);
        }
      } catch (err) {
        console.warn("[Supabase] Error saving review to Supabase:", err.message);
      }
    }

    this.emit("review:added", { referenceId, review });
    return review;
  }

  getReview(referenceId) {
    if (!referenceId) return null;
    return this.reviews.get(referenceId) || null;
  }
}

// Export singleton instance
module.exports = new RideStore();
