import { io, Socket } from "socket.io-client";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

let socketInstance: Socket | null = null;

export type SocketConnectionState = "connected" | "connecting" | "reconnecting" | "disconnected";

/**
 * Returns the singleton Socket.io client instance
 * Lazily initialized on the client side only
 */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!socketInstance) {
    socketInstance = io(BACKEND_URL, {
      transports: ["websocket", "polling"], // Prefer WebSockets, fallback to long-polling
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      console.log("⚡ SwiftRide WebSocket connected:", socketInstance?.id);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("🔌 SwiftRide WebSocket disconnected:", reason);
    });

    socketInstance.on("connect_error", (err) => {
      console.warn("⚠️ SwiftRide WebSocket connection warning:", err.message);
    });
  }

  return socketInstance;
}

/**
 * Subscribe to real-time events for a specific ride booking
 * Automatically joins room, dedupes events, and returns cleanup function
 */
export function subscribeToRide(
  referenceId: string,
  onUpdate: (data: { ride: any; eventType: string; metadata?: any }) => void,
  token?: string
): () => void {
  const socket = getSocket();
  if (!socket || !referenceId) {
    return () => {};
  }

  // Deduplication tracker
  let lastStatus: string | null = null;
  let lastTimestamp: string | null = null;

  function handleJoin() {
    socket?.emit("join_ride", { referenceId, token }, (response: any) => {
      if (response && !response.success) {
        console.warn(`[Socket] Could not join ride room ${referenceId}:`, response.error);
      }
    });
  }

  function handleRideUpdated(data: { ride: any; eventType: string; metadata?: any; timestamp?: string }) {
    if (!data || !data.ride || data.ride.referenceId !== referenceId) {
      return;
    }

    // Duplicate event suppression
    if (
      lastStatus === data.ride.status &&
      lastTimestamp &&
      data.timestamp &&
      lastTimestamp === data.timestamp
    ) {
      return;
    }

    lastStatus = data.ride.status;
    lastTimestamp = data.timestamp || null;

    onUpdate(data);
  }

  function handleRideSynced(data: { ride: any }) {
    if (data && data.ride && data.ride.referenceId === referenceId) {
      lastStatus = data.ride.status;
      onUpdate({ ride: data.ride, eventType: "SYNCED" });
    }
  }

  // Join immediately if connected, or when connection is established
  if (socket.connected) {
    handleJoin();
  }
  socket.on("connect", handleJoin);
  socket.on("ride:updated", handleRideUpdated);
  socket.on("ride:synced", handleRideSynced);

  // Return unsubscribe cleanup function
  return () => {
    socket.off("connect", handleJoin);
    socket.off("ride:updated", handleRideUpdated);
    socket.off("ride:synced", handleRideSynced);
    socket.emit("leave_ride", { referenceId });
  };
}

/**
 * Subscribe to Driver pool events (incoming requests, request cancellations, trip assignments)
 */
export function subscribeToDriverStream(
  driverId: string,
  callbacks: {
    onNewRequest?: (ride: any) => void;
    onRequestTaken?: (referenceId: string) => void;
    onRequestCancelled?: (referenceId: string) => void;
    onTripUpdated?: (ride: any) => void;
  },
  token?: string
): () => void {
  const socket = getSocket();
  if (!socket || !driverId) {
    return () => {};
  }

  function handleJoin() {
    socket?.emit("join_driver", { driverId, token });
  }

  function handleNewRequest(data: { ride: any }) {
    if (data && data.ride && callbacks.onNewRequest) {
      callbacks.onNewRequest(data.ride);
    }
  }

  function handleRequestTaken(data: { referenceId: string }) {
    if (data && data.referenceId && callbacks.onRequestTaken) {
      callbacks.onRequestTaken(data.referenceId);
    }
  }

  function handleRequestCancelled(data: { referenceId: string }) {
    if (data && data.referenceId && callbacks.onRequestCancelled) {
      callbacks.onRequestCancelled(data.referenceId);
    }
  }

  function handleTripUpdated(data: { ride: any }) {
    if (data && data.ride && callbacks.onTripUpdated) {
      callbacks.onTripUpdated(data.ride);
    }
  }

  if (socket.connected) {
    handleJoin();
  }
  socket.on("connect", handleJoin);
  socket.on("ride:new_request", handleNewRequest);
  socket.on("ride:request_taken", handleRequestTaken);
  socket.on("ride:request_cancelled", handleRequestCancelled);
  socket.on("driver:trip_assigned", handleTripUpdated);
  socket.on("driver:trip_updated", handleTripUpdated);

  return () => {
    socket.off("connect", handleJoin);
    socket.off("ride:new_request", handleNewRequest);
    socket.off("ride:request_taken", handleRequestTaken);
    socket.off("ride:request_cancelled", handleRequestCancelled);
    socket.off("driver:trip_assigned", handleTripUpdated);
    socket.off("driver:trip_updated", handleTripUpdated);
    socket.emit("leave_driver", { driverId });
  };
}

/**
 * Subscribe to Rider account events (e.g. for customer dashboard)
 */
export function subscribeToRiderStream(
  token: string,
  onRideUpdated: (data: { ride: any; eventType: string }) => void
): () => void {
  const socket = getSocket();
  if (!socket || !token) {
    return () => {};
  }

  function handleJoin() {
    socket?.emit("join_rider", { token });
  }

  function handleUpdate(data: { ride: any; eventType: string }) {
    if (data && data.ride) {
      onRideUpdated(data);
    }
  }

  if (socket.connected) {
    handleJoin();
  }
  socket.on("connect", handleJoin);
  socket.on("ride:updated", handleUpdate);
  socket.on("ride:created", handleUpdate);

  return () => {
    socket.off("connect", handleJoin);
    socket.off("ride:updated", handleUpdate);
    socket.off("ride:created", handleUpdate);
  };
}
