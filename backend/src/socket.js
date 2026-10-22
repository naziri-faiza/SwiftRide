const { Server } = require("socket.io");
const { verifyToken } = require("./utils/token");
const rideStore = require("./services/rideStore");
const driverStore = require("./services/driverStore");

let io = null;

/**
 * Initializes the Socket.io WebSocket server
 * Configured with CORS, heartbeat settings, and authorized room subscriptions.
 */
function initSocket(httpServer) {
  const allowedOrigins = [
    process.env.CLIENT_URL || "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Dev-friendly permissive
      },
      methods: ["GET", "POST", "PATCH", "DELETE"],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 15000,
  });

  io.on("connection", (socket) => {
    // 1. Join a specific Ride Room with Authorization Guard
    socket.on("join_ride", async (data, ack) => {
      try {
        const { referenceId, token } = data || {};
        if (!referenceId) {
          if (typeof ack === "function") ack({ success: false, error: "Missing referenceId" });
          return;
        }

        const ride = await rideStore.getRide(referenceId);
        if (!ride) {
          socket.emit("ride:error", { code: "RIDE_NOT_FOUND", message: `Ride ${referenceId} not found.` });
          if (typeof ack === "function") ack({ success: false, error: "RIDE_NOT_FOUND" });
          return;
        }

        // Authorization check:
        let authorized = true;
        if (ride.riderId) {
          if (token) {
            const user = verifyToken(token);
            if (!user) {
              authorized = false;
            } else if (
              user.sub !== ride.riderId &&
              user.sub !== ride.assignedDriverId &&
              user.role !== "driver" &&
              user.role !== "admin"
            ) {
              authorized = false;
            }
          } else {
            // Guest or customer viewing booking with valid referenceId
            authorized = true;
          }
        }

        if (!authorized) {
          socket.emit("ride:unauthorized", {
            code: "FORBIDDEN",
            message: "You are not authorized to subscribe to real-time updates for this ride.",
          });
          if (typeof ack === "function") ack({ success: false, error: "FORBIDDEN" });
          return;
        }

        const roomName = `ride:${referenceId}`;
        socket.join(roomName);

        if (typeof ack === "function") {
          ack({ success: true, room: roomName, status: ride.status });
        }

        // Emit current synchronized state to the newly joined client
        socket.emit("ride:synced", { ride });
      } catch (err) {
        if (typeof ack === "function") ack({ success: false, error: err.message });
      }
    });

    socket.on("leave_ride", (data) => {
      const { referenceId } = data || {};
      if (referenceId) {
        socket.leave(`ride:${referenceId}`);
      }
    });

    // 2. Rider joins their personal room for account-level updates
    socket.on("join_rider", (data, ack) => {
      const { token } = data || {};
      if (!token) {
        if (typeof ack === "function") ack({ success: false, error: "Missing token" });
        return;
      }
      const user = verifyToken(token);
      if (!user || !user.sub) {
        socket.emit("auth:error", { message: "Invalid or expired rider token." });
        if (typeof ack === "function") ack({ success: false, error: "INVALID_TOKEN" });
        return;
      }

      socket.join(`rider:${user.sub}`);
      if (typeof ack === "function") ack({ success: true, room: `rider:${user.sub}` });
    });

    // 3. Driver joins drivers pool for incoming live requests
    socket.on("join_driver", (data, ack) => {
      const { token, driverId } = data || {};
      let authorizedDriverId = driverId;

      if (token) {
        const user = verifyToken(token);
        if (user && (user.role === "driver" || user.sub)) {
          authorizedDriverId = user.sub;
        }
      }

      if (authorizedDriverId) {
        socket.join("drivers");
        socket.join(`driver:${authorizedDriverId}`);
        if (typeof ack === "function") ack({ success: true, driverId: authorizedDriverId });
      } else {
        if (typeof ack === "function") ack({ success: false, error: "Driver authorization required" });
      }
    });

    socket.on("leave_driver", (data) => {
      const { driverId } = data || {};
      socket.leave("drivers");
      if (driverId) socket.leave(`driver:${driverId}`);
    });
  });

  // Attach event listeners to RideStore events for real-time broadcasts
  rideStore.on("ride:created", (ride) => {
    if (!io) return;
    // 1. Alert all online drivers about the new incoming request
    io.to("drivers").emit("ride:new_request", {
      ride,
      timestamp: new Date().toISOString(),
    });

    // 2. Alert the specific rider if logged in
    if (ride.riderId) {
      io.to(`rider:${ride.riderId}`).emit("ride:created", { ride });
    }

    // 3. Alert any listener on the ride room
    io.to(`ride:${ride.referenceId}`).emit("ride:created", { ride });
  });

  rideStore.on("ride:updated", ({ ride, eventType, metadata }) => {
    if (!io) return;
    const payload = {
      ride,
      eventType,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    };

    // 1. Send update to the specific ride's room
    io.to(`ride:${ride.referenceId}`).emit("ride:updated", payload);

    // 2. Send update to the rider's personal room
    if (ride.riderId) {
      io.to(`rider:${ride.riderId}`).emit("ride:updated", payload);
    }

    // 3. If accepted, inform drivers room to remove this card
    if (eventType === "ACCEPTED") {
      io.to("drivers").emit("ride:request_taken", {
        referenceId: ride.referenceId,
        driverId: ride.assignedDriverId,
      });
      if (ride.assignedDriverId) {
        io.to(`driver:${ride.assignedDriverId}`).emit("driver:trip_assigned", { ride });
      }
    }

    // 4. If cancelled, inform drivers room and assigned driver
    if (eventType === "CANCELLED") {
      io.to("drivers").emit("ride:request_cancelled", {
        referenceId: ride.referenceId,
      });
      if (ride.assignedDriverId) {
        io.to(`driver:${ride.assignedDriverId}`).emit("driver:trip_cancelled", {
          referenceId: ride.referenceId,
        });
      }
    }

    // 5. If driver status changed (e.g. ARRIVING, IN_PROGRESS, COMPLETED)
    if (eventType === "STATUS_CHANGED") {
      if (ride.assignedDriverId) {
        io.to(`driver:${ride.assignedDriverId}`).emit("driver:trip_updated", { ride });
      }
    }
  });

  return io;
}

function getIO() {
  return io;
}

function getConnectedClientsCount() {
  return io ? io.engine?.clientsCount || 0 : 0;
}

module.exports = {
  initSocket,
  getIO,
  getConnectedClientsCount,
};
