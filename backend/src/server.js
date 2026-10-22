require("dotenv").config();
const http = require("http");
const app = require("./app");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

// Create standard HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.io real-time WebSocket engine
initSocket(server);

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚕 SwiftRide Backend API running on port ${PORT}`);
  console.log(`⚡ WebSocket Real-Time Gateway active on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`💳 Razorpay Status: http://localhost:${PORT}/api/payments/status`);
  console.log(`===============================================`);
});

// Graceful process shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received. Closing HTTP and WebSocket server...");
  server.close(() => {
    console.log("HTTP server closed.");
  });
});
