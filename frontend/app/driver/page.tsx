"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Car,
  Shield,
  Star,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Power,
  Navigation,
  Clock,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Phone,
  User,
  Radio,
  Sparkles,
} from "lucide-react";
import { subscribeToDriverStream } from "../utils/socket";

interface DriverProfile {
  id: string;
  driverCode: string;
  name: string;
  email: string;
  phone: string;
  car: string;
  plate: string;
  vehicleType: string;
  rating: number;
  totalTrips: number;
  isAvailable: boolean;
  etaMins: number;
}

interface RideRequest {
  referenceId: string;
  pickup: string;
  destination: string;
  rideId: string;
  rideName: string;
  seats: number;
  totalFare: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  bookedAt: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function DriverDashboard() {
  const [driversList, setDriversList] = useState<DriverProfile[]>([]);
  const [activeDriver, setActiveDriver] = useState<DriverProfile | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [availableRides, setAvailableRides] = useState<RideRequest[]>([]);
  const [activeTrip, setActiveTrip] = useState<RideRequest | null>(null);
  const [completedTrips, setCompletedTrips] = useState<RideRequest[]>([]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // 1. Initial Load: Fetch drivers list and restore or auto-select driver
  useEffect(() => {
    fetchDrivers();
  }, []);

  // 2. Real-time WebSocket Stream for Incoming Rides & Trip Sync (with 4s Polling Fallback)
  const [realtimeState, setRealtimeState] = useState<"live" | "polling">("live");

  useEffect(() => {
    if (!activeDriver || !isOnline) return;

    // A. Subscribe to Driver WebSocket events
    const unsubscribe = subscribeToDriverStream(activeDriver.id, {
      onNewRequest: (ride) => {
        setRealtimeState("live");
        setAvailableRides((prev) => {
          if (prev.some((r) => r.referenceId === ride.referenceId)) return prev;
          return [ride, ...prev];
        });
        setNotification({
          type: "info",
          message: `⚡ Live Alert: New ride request from ${ride.pickup} (₹${ride.totalFare})`,
        });
      },
      onRequestTaken: (referenceId) => {
        setAvailableRides((prev) => prev.filter((r) => r.referenceId !== referenceId));
      },
      onRequestCancelled: (referenceId) => {
        setAvailableRides((prev) => prev.filter((r) => r.referenceId !== referenceId));
        setActiveTrip((current) => {
          if (current && current.referenceId === referenceId) {
            setNotification({
              type: "error",
              message: `Ride ${referenceId} was cancelled by the customer.`,
            });
            return null;
          }
          return current;
        });
      },
      onTripUpdated: (ride) => {
        setRealtimeState("live");
        setActiveTrip(ride);
      },
    });

    // B. Initial sync
    fetchDashboardData(activeDriver.id);

    // C. Resilient 4-second polling fallback (keeps data fresh even across network transitions)
    const interval = setInterval(() => {
      fetchDashboardData(activeDriver.id, true);
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [activeDriver, isOnline]);

  async function fetchDrivers() {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/driver/list`);
      const data = await res.json();
      if (res.ok && data.drivers && data.drivers.length > 0) {
        setDriversList(data.drivers);

        // Check if previously selected driver exists in localStorage
        const savedDriverId = typeof window !== "undefined" ? localStorage.getItem("swiftride_active_driver_id") : null;
        const matched = data.drivers.find((d: DriverProfile) => d.id === savedDriverId) || data.drivers[0];
        setActiveDriver(matched);
        setIsOnline(matched.isAvailable !== false);
        fetchDashboardData(matched.id);
      }
    } catch (err) {
      console.warn("Could not load drivers list:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchDashboardData(driverId: string, background = false) {
    if (!background) setIsLoading(true);
    try {
      // 1. Fetch available pending rides
      const availRes = await fetch(`${BACKEND_URL}/api/driver/available-rides?driverId=${driverId}`);
      if (availRes.ok) {
        const availData = await availRes.json();
        if (availData.rides) {
          setAvailableRides(availData.rides);
        }
      }

      // 2. Fetch driver stats & active/completed rides
      const dashRes = await fetch(`${BACKEND_URL}/api/driver/dashboard?driverId=${driverId}`);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setActiveTrip(dashData.activeRide || null);
        setCompletedTrips(dashData.completedRides || []);
        setTotalEarnings(dashData.totalEarnings || 0);
      }
    } catch (err) {
      console.warn("Error fetching dashboard data:", err);
    } finally {
      if (!background) setIsLoading(false);
    }
  }

  function handleSelectDriver(driver: DriverProfile) {
    setActiveDriver(driver);
    setIsOnline(driver.isAvailable !== false);
    if (typeof window !== "undefined") {
      localStorage.setItem("swiftride_active_driver_id", driver.id);
    }
    setNotification({
      type: "info",
      message: `Switched driver profile to ${driver.name} (${driver.car}).`,
    });
    fetchDashboardData(driver.id);
  }

  async function handleToggleAvailability() {
    if (!activeDriver) return;
    const nextState = !isOnline;
    setIsOnline(nextState);

    try {
      await fetch(`${BACKEND_URL}/api/driver/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: activeDriver.id, isAvailable: nextState }),
      });
      setNotification({
        type: nextState ? "success" : "info",
        message: nextState ? "You are now ONLINE. Searching for nearby ride requests." : "You are now OFFLINE.",
      });
    } catch (err) {
      console.warn("Could not toggle availability:", err);
    }
  }

  async function handleAcceptRide(referenceId: string) {
    if (!activeDriver) return;
    setIsActionLoading(true);
    setNotification(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/driver/rides/${referenceId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: activeDriver.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to accept ride request.");
      }

      setActiveTrip(data.ride);
      setNotification({
        type: "success",
        message: `Ride ${referenceId} accepted! Proceed to pickup location.`,
      });

      fetchDashboardData(activeDriver.id);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Could not accept ride.",
      });
      // Refresh list to clear ride if someone else grabbed it
      if (activeDriver) fetchDashboardData(activeDriver.id);
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleDeclineRide(referenceId: string) {
    if (!activeDriver) return;

    try {
      await fetch(`${BACKEND_URL}/api/driver/rides/${referenceId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId: activeDriver.id }),
      });

      setAvailableRides((prev) => prev.filter((r) => r.referenceId !== referenceId));
      setNotification({
        type: "info",
        message: `Request ${referenceId} declined.`,
      });
    } catch (err) {
      console.warn("Error declining ride:", err);
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!activeDriver || !activeTrip) return;
    setIsActionLoading(true);
    setNotification(null);

    try {
      const res = await fetch(`${BACKEND_URL}/api/driver/rides/${activeTrip.referenceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, driverId: activeDriver.id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not update trip status.");
      }

      if (newStatus === "COMPLETED") {
        setNotification({
          type: "success",
          message: `Trip ${activeTrip.referenceId} completed! ₹${activeTrip.totalFare} earned.`,
        });
        setActiveTrip(null);
      } else {
        setActiveTrip(data.ride);
        setNotification({
          type: "success",
          message: `Trip status updated to: ${newStatus.replace("_", " ")}`,
        });
      }

      fetchDashboardData(activeDriver.id);
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update trip status.",
      });
    } finally {
      setIsActionLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-yellow-400 selection:text-slate-950">
      {/* 1. Driver Portal Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-slate-950 shadow">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Swift<span className="text-yellow-400">Driver</span>
                </span>
                <span className="rounded-full bg-yellow-400/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-yellow-300">
                  Partner Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Real-time driver dispatch & trip management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time sync badge */}
            <div className="hidden md:flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-emerald-400 border border-slate-800">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${realtimeState === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${realtimeState === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />
              </span>
              <span>{realtimeState === "live" ? "Live Stream (WebSockets)" : "Backup Polling Active"}</span>
            </div>

            {/* Online / Offline Toggle */}
            <button
              onClick={handleToggleAvailability}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition shadow ${
                isOnline
                  ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <Power className="h-3.5 w-3.5" />
              <span>{isOnline ? "Online (Receiving)" : "Offline"}</span>
            </button>

            {/* Back to Rider App */}
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-sm"
            >
              <User className="h-3.5 w-3.5" />
              <span>Rider App</span>
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Dashboard Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {notification && (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl p-4 text-xs font-bold border transition ${
              notification.type === "success"
                ? "bg-emerald-950/80 text-emerald-200 border-emerald-800"
                : notification.type === "error"
                ? "bg-red-950/80 text-red-200 border-red-800"
                : "bg-slate-800 text-slate-200 border-slate-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : notification.type === "error" ? (
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              ) : (
                <Sparkles className="h-4 w-4 text-yellow-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Driver Profile Switcher & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Active Driver Card */}
          <div className="lg:col-span-2 rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow">
                  {activeDriver?.name?.[0] || "D"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{activeDriver?.name}</h2>
                    <span className="flex items-center gap-1 rounded-md bg-yellow-400/20 px-2 py-0.5 text-xs font-bold text-yellow-300">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span>{activeDriver?.rating}</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{activeDriver?.car}</p>
                  <p className="font-mono text-[11px] font-bold text-yellow-400 mt-0.5">{activeDriver?.plate}</p>
                </div>
              </div>

              {/* Demo Driver Switcher */}
              <div className="text-right">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Switch Demo Driver
                </label>
                <select
                  value={activeDriver?.id}
                  onChange={(e) => {
                    const chosen = driversList.find((d) => d.id === e.target.value);
                    if (chosen) handleSelectDriver(chosen);
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  {driversList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.vehicleType})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
                <span>{isOnline ? "Ready for automatic dispatch" : "Offline"}</span>
              </span>
              <span>Vehicle: {activeDriver?.vehicleType?.toUpperCase()}</span>
            </div>
          </div>

          {/* Stat 1: Total Earnings */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>Shift Earnings</span>
              <div className="p-2 rounded-xl bg-yellow-400/10 text-yellow-400">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black text-yellow-400">₹{totalEarnings}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Across completed trips</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>Instant driver payout ready</span>
            </div>
          </div>

          {/* Stat 2: Completed Trips */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-5 shadow flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>Trips Completed</span>
              <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                <Navigation className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2">
              <div className="text-3xl font-black text-white">{completedTrips.length}</div>
              <p className="text-[11px] text-slate-400 mt-0.5">Lifetime: {activeDriver?.totalTrips || 0}</p>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span>★ {activeDriver?.rating} rating avg</span>
            </div>
          </div>
        </div>

        {/* 3. HERO ACTIVE TRIP CONTROL PANEL */}
        {activeTrip ? (
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-950 border-2 border-yellow-400/80 p-6 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="inline-block rounded-full bg-yellow-400 px-3 py-1 text-xs font-black text-slate-950 uppercase tracking-wider">
                  Active Assigned Trip
                </span>
                <h3 className="text-2xl font-black text-white mt-2 font-mono tracking-tight">
                  {activeTrip.referenceId}
                </h3>
              </div>

              <div className="text-left sm:text-right">
                <div className="text-2xl font-black text-yellow-400">₹{activeTrip.totalFare}</div>
                <span className="text-[11px] text-slate-400 font-bold uppercase">
                  {String(activeTrip.paymentMethod || "").toLowerCase() === "cash" ? "Pay Cash on Arrival" : "Prepaid Online (Razorpay)"}
                </span>
              </div>
            </div>

            {/* Route Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-slate-800/60 p-4 border border-slate-700/60">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 rounded-full bg-emerald-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pickup Address (Head Here)
                    </span>
                    <p className="text-sm font-bold text-white mt-0.5">{activeTrip.pickup}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-800/60 p-4 border border-slate-700/60">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-3 w-3 rounded-full bg-yellow-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Drop-off Destination
                    </span>
                    <p className="text-sm font-bold text-white mt-0.5">{activeTrip.destination}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step-by-Step Status Progression Stepper */}
            <div className="rounded-2xl bg-slate-900 p-5 border border-slate-800 space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Trip Lifecycle Controls:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Step 1 */}
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold transition ${
                    activeTrip.status === "DRIVER_ASSIGNED"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                      : ["DRIVER_ARRIVING", "IN_PROGRESS", "COMPLETED"].includes(activeTrip.status)
                      ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-400"
                      : "border-slate-800 text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">1</span>
                    <span>Assigned to You</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold transition ${
                    activeTrip.status === "DRIVER_ARRIVING"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                      : ["IN_PROGRESS", "COMPLETED"].includes(activeTrip.status)
                      ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-400"
                      : "border-slate-800 text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">2</span>
                    <span>Arrived at Pickup</span>
                  </div>
                </div>

                {/* Step 3 */}
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold transition ${
                    activeTrip.status === "IN_PROGRESS"
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                      : activeTrip.status === "COMPLETED"
                      ? "border-emerald-500/50 bg-emerald-950/20 text-emerald-400"
                      : "border-slate-800 text-slate-500"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">3</span>
                    <span>Trip In Transit</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons based on status */}
              <div className="pt-2">
                {activeTrip.status === "DRIVER_ASSIGNED" && (
                  <button
                    onClick={() => handleUpdateStatus("DRIVER_ARRIVING")}
                    disabled={isActionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-3.5 text-sm font-black text-slate-950 hover:bg-yellow-300 transition shadow-lg"
                  >
                    {isActionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
                    <span>Mark: I Have Arrived at Pickup Location</span>
                  </button>
                )}

                {activeTrip.status === "DRIVER_ARRIVING" && (
                  <button
                    onClick={() => handleUpdateStatus("IN_PROGRESS")}
                    disabled={isActionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-slate-950 hover:bg-emerald-400 transition shadow-lg"
                  >
                    {isActionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Navigation className="h-5 w-5" />}
                    <span>Start Trip (Passenger Onboard)</span>
                  </button>
                )}

                {activeTrip.status === "IN_PROGRESS" && (
                  <button
                    onClick={() => handleUpdateStatus("COMPLETED")}
                    disabled={isActionLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 py-4 text-base font-black text-slate-950 hover:bg-yellow-300 transition shadow-xl"
                  >
                    {isActionLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                    <span>
                      Complete Trip & {String(activeTrip.paymentMethod || "").toLowerCase() === "cash" ? `Collect ₹${activeTrip.totalFare} Cash` : "Finish Trip"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* 4. AVAILABLE RIDE REQUESTS QUEUE */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Radio className="h-5 w-5 text-yellow-400 animate-pulse" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Live Available Requests</h3>
                <p className="text-xs text-slate-400">Incoming rider requests awaiting driver acceptance</p>
              </div>
            </div>

            <button
              onClick={() => activeDriver && fetchDashboardData(activeDriver.id)}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              title="Refresh queue"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {!isOnline ? (
            <div className="py-12 text-center text-slate-500">
              <Power className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-slate-400">You are currently Offline</p>
              <p className="text-xs text-slate-500 mt-1">Switch to Online above to receive live requests.</p>
            </div>
          ) : availableRides.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-yellow-400/80">
                <Radio className="h-6 w-6 animate-spin" />
              </div>
              <p className="text-sm font-bold text-slate-300">Radar active — No pending ride requests</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                When a passenger books a trip from the homepage, it will appear here instantly for you to accept!
              </p>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-block rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white transition"
                >
                  Create Demo Ride on Homepage
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableRides.map((ride) => (
                <div
                  key={ride.referenceId}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4 hover:border-yellow-400/50 transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black bg-slate-800 text-yellow-400 px-2.5 py-1 rounded-lg">
                        {ride.referenceId}
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-black text-white">₹{ride.totalFare}</span>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          {String(ride.paymentMethod || "").toLowerCase() === "cash" ? "Cash Trip" : "Prepaid (Razorpay)"}
                        </span>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                        <span className="text-slate-300 font-semibold">{ride.pickup}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="mt-1 h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
                        <span className="text-slate-300 font-semibold">{ride.destination}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Tier: {ride.rideName}</span>
                      <span>Requested: {ride.bookedAt || "Just now"}</span>
                    </div>
                  </div>

                  {/* Accept / Decline Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => handleAcceptRide(ride.referenceId)}
                      disabled={isActionLoading || Boolean(activeTrip)}
                      className="flex-1 rounded-xl bg-yellow-400 py-2.5 text-xs font-black text-slate-950 hover:bg-yellow-300 transition shadow disabled:opacity-50"
                      title={activeTrip ? "Complete your active trip first" : "Accept Ride"}
                    >
                      {activeTrip ? "Active Trip In Progress" : "Accept Ride"}
                    </button>
                    <button
                      onClick={() => handleDeclineRide(ride.referenceId)}
                      className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-700 hover:text-white transition"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5. DRIVER'S COMPLETED TRIPS HISTORY */}
        {completedTrips.length > 0 && (
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
            <h3 className="text-base font-black text-white">Completed Trips Shift Log</h3>
            <div className="divide-y divide-slate-800">
              {completedTrips.map((trip) => (
                <div key={trip.referenceId} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <span className="font-mono font-bold text-yellow-400 mr-2">{trip.referenceId}</span>
                    <span className="text-slate-300 font-semibold">{trip.pickup} → {trip.destination}</span>
                    <span className="text-slate-500 block text-[11px] mt-0.5">Payment: {trip.paymentStatus} ({trip.paymentMethod})</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-white">₹{trip.totalFare}</span>
                    <span className="block text-[10px] text-emerald-400 font-bold uppercase">Completed</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
