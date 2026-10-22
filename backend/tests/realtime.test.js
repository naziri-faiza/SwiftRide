const http = require("http");
const assert = require("assert");
const { io: Client } = require("socket.io-client");
const app = require("../src/app");
const { initSocket } = require("../src/socket");
const rideStore = require("../src/services/rideStore");
const { generateToken } = require("../src/utils/token");

const TEST_PORT = 5055;
const SERVER_URL = `http://localhost:${TEST_PORT}`;

async function runTests() {
  console.log("=================================================");
  console.log("🧪 SwiftRide Real-Time WebSocket Test Suite");
  console.log("=================================================");

  // 1. Setup server
  const server = http.createServer(app);
  initSocket(server);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test HTTP & WebSocket server listening on port ${TEST_PORT}`);

  // Test Tokens
  const riderToken = generateToken({
    sub: "rider-test-uuid-123",
    email: "testrider@swiftride.com",
    role: "rider",
  });

  const driverToken = generateToken({
    sub: "drv-rahul-01",
    email: "rahul.driver@swiftride.demo",
    role: "driver",
  });

  const unauthorizedToken = generateToken({
    sub: "unauthorized-stranger-999",
    email: "stranger@other.com",
    role: "rider",
  });

  let riderSocket = null;
  let driverSocket = null;
  let strangerSocket = null;

  try {
    // 2. Connect client sockets
    riderSocket = Client(SERVER_URL, { transports: ["websocket"] });
    driverSocket = Client(SERVER_URL, { transports: ["websocket"] });
    strangerSocket = Client(SERVER_URL, { transports: ["websocket"] });

    await Promise.all([
      new Promise((res) => riderSocket.on("connect", res)),
      new Promise((res) => driverSocket.on("connect", res)),
      new Promise((res) => strangerSocket.on("connect", res)),
    ]);
    console.log("✓ Sockets connected successfully: Rider, Driver, and Third-Party");

    // 3. Driver joins 'drivers' pool
    await new Promise((resolve, reject) => {
      driverSocket.emit(
        "join_driver",
        { driverId: "drv-rahul-01", token: driverToken },
        (ack) => {
          if (ack && ack.success) resolve(ack);
          else reject(new Error("Failed to join drivers pool"));
        }
      );
    });
    console.log("✓ Driver successfully joined 'drivers' pool");

    // 4. Test: Create a new ride and verify driver receives 'ride:new_request' in real time
    const newRidePromise = new Promise((resolve) => {
      driverSocket.once("ride:new_request", (data) => {
        resolve(data);
      });
    });

    const testRide = await rideStore.createRide({
      pickup: "Connaught Place, Inner Circle",
      destination: "Indira Gandhi Airport (T3)",
      rideId: "swift-go",
      rideName: "SwiftGo",
      seats: 4,
      baseFare: 80,
      distanceKm: 8.5,
      platformFee: 25,
      totalFare: 224,
      paymentMethod: "CASH",
      riderId: "rider-test-uuid-123",
      customerEmail: "testrider@swiftride.com",
      customerName: "Test Rider",
    });

    const receivedRideRequest = await newRidePromise;
    assert.strictEqual(
      receivedRideRequest.ride.referenceId,
      testRide.referenceId,
      "Driver should receive the exact referenceId of the new ride"
    );
    console.log(`✓ Real-time 'ride:new_request' received by Driver for ${testRide.referenceId}`);

    // 5. Rider joins their specific ride room
    await new Promise((resolve, reject) => {
      riderSocket.emit(
        "join_ride",
        { referenceId: testRide.referenceId, token: riderToken },
        (ack) => {
          if (ack && ack.success) resolve(ack);
          else reject(new Error("Rider failed to join ride room"));
        }
      );
    });
    console.log(`✓ Authorized Rider joined room 'ride:${testRide.referenceId}'`);

    // 6. Test Authorization Guard: Unauthorized user trying to join someone else's ride
    const unauthorizedErrorPromise = new Promise((resolve) => {
      strangerSocket.once("ride:unauthorized", (data) => {
        resolve(data);
      });
    });

    strangerSocket.emit("join_ride", {
      referenceId: testRide.referenceId,
      token: unauthorizedToken,
    });

    const unauthData = await unauthorizedErrorPromise;
    assert.strictEqual(unauthData.code, "FORBIDDEN", "Unauthorized user must receive FORBIDDEN error");
    console.log("✓ Authorization Guard correctly rejected unauthorized user from ride room");

    // 7. Test: Driver accepts the ride and Rider receives instant real-time update
    const riderUpdateOnAcceptPromise = new Promise((resolve) => {
      riderSocket.once("ride:updated", (data) => {
        resolve(data);
      });
    });

    const driverProfile = {
      id: "drv-rahul-01",
      name: "Rahul Sharma",
      car: "White Maruti Dzire (CNG/AC)",
      plate: "DL 01 AB 4291",
      rating: 4.92,
      phone: "+91 98765 43210",
      etaMins: 3,
    };

    const acceptedRide = await rideStore.acceptRideByDriver(testRide.referenceId, driverProfile);

    const riderAcceptEvent = await riderUpdateOnAcceptPromise;
    assert.strictEqual(riderAcceptEvent.eventType, "ACCEPTED", "Event type should be ACCEPTED");
    assert.strictEqual(riderAcceptEvent.ride.status, "DRIVER_ASSIGNED", "Ride status must be DRIVER_ASSIGNED");
    assert.strictEqual(riderAcceptEvent.ride.driver.name, "Rahul Sharma", "Driver details must be attached");
    console.log(`✓ Rider notified in real time: Driver accepted ride ${testRide.referenceId}`);

    // 8. Test: Driver changes status to DRIVER_ARRIVING
    const riderArrivingPromise = new Promise((resolve) => {
      riderSocket.once("ride:updated", (data) => {
        resolve(data);
      });
    });

    await rideStore.updateDriverTripStatus(testRide.referenceId, "drv-rahul-01", "DRIVER_ARRIVING");

    const arrivingEvent = await riderArrivingPromise;
    assert.strictEqual(arrivingEvent.ride.status, "DRIVER_ARRIVING", "Status should be DRIVER_ARRIVING");
    console.log("✓ Rider notified in real time: Driver status updated to DRIVER_ARRIVING");

    // 9. Test: Driver advances status to IN_PROGRESS
    const riderInProgressPromise = new Promise((resolve) => {
      riderSocket.once("ride:updated", (data) => {
        resolve(data);
      });
    });

    await rideStore.updateDriverTripStatus(testRide.referenceId, "drv-rahul-01", "IN_PROGRESS");

    const inProgressEvent = await riderInProgressPromise;
    assert.strictEqual(inProgressEvent.ride.status, "IN_PROGRESS", "Status should be IN_PROGRESS");
    console.log("✓ Rider notified in real time: Driver status updated to IN_PROGRESS");

    // 10. Test: Driver completes trip
    const riderCompletedPromise = new Promise((resolve) => {
      riderSocket.once("ride:updated", (data) => {
        resolve(data);
      });
    });

    await rideStore.updateDriverTripStatus(testRide.referenceId, "drv-rahul-01", "COMPLETED");

    const completedEvent = await riderCompletedPromise;
    assert.strictEqual(completedEvent.ride.status, "COMPLETED", "Status should be COMPLETED");
    console.log("✓ Rider notified in real time: Trip COMPLETED");

    console.log("=================================================");
    console.log("🎉 ALL REAL-TIME TESTS PASSED SUCCESSFULLY! (10/10)");
    console.log("=================================================");
  } finally {
    // Teardown
    if (riderSocket) riderSocket.disconnect();
    if (driverSocket) driverSocket.disconnect();
    if (strangerSocket) strangerSocket.disconnect();

    await new Promise((resolve) => server.close(resolve));
    console.log("✓ Test server closed cleanly.");
  }
}

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
