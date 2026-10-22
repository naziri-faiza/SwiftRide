"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Calendar,
  Clock,
  MapPin,
  Navigation,
  ArrowRight,
  Shield,
  Star,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  LogOut,
  User,
  Phone,
  Mail,
  Receipt,
  RotateCcw,
  PlusCircle,
  Edit2,
  ChevronRight,
  Sparkles,
  Users,
  MessageSquare,
} from "lucide-react";
import { getToken, getUser, setUser, clearAuth, UserProfile } from "../utils/auth";
import { subscribeToRiderStream } from "../utils/socket";
import AuthModal from "../components/AuthModal";
import ReceiptModal from "../components/ReceiptModal";
import ReviewModal from "../components/ReviewModal";
import FeedbackModal from "../components/FeedbackModal";
import Navbar from "../components/Navbar";

interface RideRecord {
  referenceId: string;
  pickup: string;
  destination: string;
  rideId: string;
  rideName: string;
  seats: number;
  baseFare: number;
  distanceKm: number;
  platformFee: number;
  totalFare: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  bookedAt: string;
  createdAt: string;
  driver?: {
    name: string;
    car: string;
    rating: number;
    plate: string;
    etaMins: number;
    phone: string;
  };
  review?: {
    rating: number;
    comment?: string;
    tags?: string[];
    createdAt?: string;
  } | null;
}

function getPaymentDisplay(paymentMethod?: string, paymentStatus?: string) {
  const method = String(paymentMethod || "").toLowerCase();
  const status = String(paymentStatus || "").toLowerCase();
  const isRazorpay = method.includes("razorpay");
  const isPaid = status === "paid";

  if (status === "cancelled") {
    return {
      badgeText: isRazorpay ? "Razorpay (Cancelled)" : "Cash (Cancelled)",
      badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
      methodLabel: isRazorpay ? "Razorpay Online (Test Mode)" : "Cash on Trip Completion",
      statusLabel: "Cancelled",
    };
  }

  if (isRazorpay) {
    if (isPaid) {
      return {
        badgeText: "Paid Online (Razorpay)",
        badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
        methodLabel: "Razorpay Online (Test Mode)",
        statusLabel: "Paid",
      };
    }
    return {
      badgeText: "Razorpay (Pending Payment)",
      badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
      methodLabel: "Razorpay Online (Test Mode)",
      statusLabel: status ? status.toUpperCase() : "Pending",
    };
  }

  // Cash booking
  if (isPaid) {
    return {
      badgeText: "Paid in Cash",
      badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      methodLabel: "Cash on Trip Completion",
      statusLabel: "Paid",
    };
  }

  return {
    badgeText: "Pay Cash on Arrival",
    badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",
    methodLabel: "Cash on Trip Completion",
    statusLabel: status ? status.replace("_", " ").toUpperCase() : "Pending Cash",
  };
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function CustomerDashboard() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [rides, setRides] = useState<RideRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED">("ALL");
  const [selectedRide, setSelectedRide] = useState<RideRecord | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [linkRefInput, setLinkRefInput] = useState("");
  const [linkStatus, setLinkStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Edit Profile States
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [realtimeState, setRealtimeState] = useState<"live" | "polling">("live");

  // New Modals: Receipts, Reviews, Feedback
  const [receiptRide, setReceiptRide] = useState<RideRecord | null>(null);
  const [reviewingRide, setReviewingRide] = useState<RideRecord | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  function handleReviewSuccess(review: any) {
    if (!reviewingRide) return;
    setRides((prev) =>
      prev.map((r) =>
        r.referenceId === reviewingRide.referenceId ? { ...r, review } : r
      )
    );
    setActionNotice({
      type: "success",
      message: `⭐ Thank you! Your review for driver ${reviewingRide.driver?.name || "partner"} has been saved.`,
    });
  }

  useEffect(() => {
    const localUser = getUser();
    const token = getToken();

    if (!token || !localUser) {
      setIsLoading(false);
      return;
    }

    setUserProfile(localUser);
    setEditName(localUser.fullName || "");
    setEditPhone(localUser.phone || "");

    fetchCustomerData(token);

    // 1. Subscribe to real-time account stream for automatic live updates
    const unsubscribe = subscribeToRiderStream(token, (data) => {
      setRealtimeState("live");
      if (data && data.ride) {
        setRides((prevRides) => {
          const index = prevRides.findIndex((r) => r.referenceId === data.ride.referenceId);
          if (index >= 0) {
            const next = [...prevRides];
            next[index] = data.ride;
            return next;
          }
          return [data.ride, ...prevRides];
        });

        setSelectedRide((current) => {
          if (current && current.referenceId === data.ride.referenceId) {
            return data.ride;
          }
          return current;
        });

        setActionNotice({
          type: "success",
          message: `⚡ Live Update: Ride ${data.ride.referenceId} status changed to ${data.ride.status.replace("_", " ")}!`,
        });
      }
    });

    // 2. Resilient periodic background refresh (every 12 seconds)
    const interval = setInterval(() => {
      fetchCustomerData(token, true);
    }, 12000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  async function fetchCustomerData(token: string, background = false) {
    if (!background) setIsLoading(true);
    try {
      // 1. Fetch live profile
      const profRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profRes.ok) {
        const profData = await profRes.json();
        if (profData.user) {
          setUserProfile(profData.user);
          setUser(profData.user);
          setEditName(profData.user.fullName || "");
          setEditPhone(profData.user.phone || "");
        }
      }

      // 2. Fetch customer rides
      const ridesRes = await fetch(`${BACKEND_URL}/api/customer/rides`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ridesRes.ok) {
        const ridesData = await ridesRes.json();
        if (ridesData.rides && Array.isArray(ridesData.rides)) {
          setRides(ridesData.rides);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch customer data:", err);
      setRealtimeState("polling");
    } finally {
      if (!background) setIsLoading(false);
    }
  }

  function handleLogout() {
    clearAuth();
    setUserProfile(null);
    setRides([]);
  }

  async function handleCancelRide(referenceId: string) {
    if (!confirm(`Are you sure you want to cancel booking ${referenceId}?`)) return;

    setCancellingRef(referenceId);
    setActionNotice(null);

    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/rides/${referenceId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Could not cancel booking.");
      }

      setActionNotice({
        type: "success",
        message: `Booking ${referenceId} has been successfully cancelled.`,
      });

      // Update in local state
      setRides((prev) =>
        prev.map((r) =>
          r.referenceId === referenceId
            ? { ...r, status: "CANCELLED", paymentStatus: "CANCELLED" }
            : r
        )
      );

      if (selectedRide && selectedRide.referenceId === referenceId) {
        setSelectedRide((prev) => (prev ? { ...prev, status: "CANCELLED", paymentStatus: "CANCELLED" } : null));
      }
    } catch (err: unknown) {
      setActionNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to cancel ride.",
      });
    } finally {
      setCancellingRef(null);
    }
  }

  async function handleLinkRide(e: React.FormEvent) {
    e.preventDefault();
    if (!linkRefInput.trim()) return;

    setIsLinking(true);
    setLinkStatus(null);

    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/customer/link-ride`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ referenceId: linkRefInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to link booking.");
      }

      setLinkStatus({
        type: "success",
        message: data.message || "Booking successfully linked to your account!",
      });
      setLinkRefInput("");

      // Refresh rides
      if (token) fetchCustomerData(token);
    } catch (err: unknown) {
      setLinkStatus({
        type: "error",
        message: err instanceof Error ? err.message : "Booking could not be linked.",
      });
    } finally {
      setIsLinking(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const token = getToken();
      const res = await fetch(`${BACKEND_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ fullName: editName, phone: editPhone }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update profile.");
      }

      setUserProfile(data.user);
      setUser(data.user);
      setIsEditProfileOpen(false);
      setActionNotice({ type: "success", message: "Profile updated successfully!" });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Profile update failed.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  // Filter rides logic
  const filteredRides = rides.filter((r) => {
    if (selectedFilter === "ACTIVE") {
      return ["REQUESTED", "CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(r.status);
    }
    if (selectedFilter === "COMPLETED") {
      return r.status === "COMPLETED";
    }
    if (selectedFilter === "CANCELLED") {
      return r.status === "CANCELLED";
    }
    return true;
  });

  const activeRidesCount = rides.filter((r) =>
    ["REQUESTED", "CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(r.status)
  ).length;

  const totalSpent = rides
    .filter((r) => {
      if (r.status === "CANCELLED") return false;
      const ps = String(r.paymentStatus || "").toLowerCase();
      return ps === "paid" || ps === "pending_cash" || ps === "pending";
    })
    .reduce((sum, r) => sum + (Number(r.totalFare) || 0), 0);

  // Unauthenticated screen
  if (!isLoading && !userProfile) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-yellow-400">
                <Car className="h-5 w-5" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-950">
                Swift<span className="text-yellow-500">Ride</span>
              </span>
            </Link>
            <Link
              href="/"
              className="text-sm font-semibold text-slate-600 hover:text-slate-950 transition"
            >
              Back to Home
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-yellow-100 text-yellow-700 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              Customer Dashboard
            </h1>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">
              Sign in with your SwiftRide account to view your booking history, upcoming trips, ride receipts, and personal profile.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full rounded-2xl bg-yellow-400 py-3.5 text-sm font-bold text-slate-950 shadow-md hover:bg-yellow-300 transition"
              >
                Sign In / Register
              </button>
              <Link
                href="/book-ride"
                className="block w-full rounded-2xl border border-slate-200 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Book a Ride →
              </Link>
            </div>
          </div>
        </main>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(u) => {
            setUserProfile(u);
            const token = getToken();
            if (token) fetchCustomerData(token);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* 1. Header */}
      <Navbar
        currentPage="dashboard"
        currentUser={userProfile}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onOpenFeedback={() => setIsFeedbackModalOpen(true)}
        onBookRideClick={() => router.push("/book-ride")}
      />

      {/* 2. Dashboard Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {actionNotice && (
          <div
            className={`mb-6 flex items-center justify-between gap-3 rounded-2xl p-4 text-sm font-medium border ${
              actionNotice.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {actionNotice.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        )}

        {/* User Hero & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Profile Card */}
          <div className="rounded-3xl bg-slate-950 p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow">
                    {userProfile?.fullName?.[0]?.toUpperCase() || "R"}
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight">{userProfile?.fullName}</h2>
                    <span className="inline-block rounded-full bg-yellow-400/20 px-2.5 py-0.5 text-[10px] font-bold text-yellow-300 uppercase tracking-wider">
                      Verified Rider
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditProfileOpen(true)}
                  className="rounded-full bg-slate-800 p-2 text-slate-300 hover:text-white transition"
                  title="Edit Profile"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-6 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Mail className="h-3.5 w-3.5 text-yellow-400" />
                  <span>{userProfile?.email}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="h-3.5 w-3.5 text-yellow-400" />
                  <span>{userProfile?.phone || "No phone linked"}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 relative z-10">
              <span>Account Mode: Protected Rider</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                <span>Active Session</span>
              </span>
            </div>

            {/* Subtle background glow */}
            <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-yellow-500/10 blur-2xl pointer-events-none" />
          </div>

          {/* Stat 1: Total Rides */}
          <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Bookings
              </span>
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <Car className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-black text-slate-950 tracking-tight">{rides.length}</div>
              <p className="text-xs text-slate-500 mt-1">
                {activeRidesCount > 0 ? `${activeRidesCount} active in progress` : "No rides currently active"}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-600">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Full ride history recorded</span>
            </div>
          </div>

          {/* Stat 2: Total Spent */}
          <div className="rounded-3xl bg-white p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Spent
              </span>
              <div className="p-2 rounded-xl bg-yellow-100 text-yellow-800">
                <Receipt className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-4xl font-black text-slate-950 tracking-tight">₹{totalSpent}</div>
              <p className="text-xs text-slate-500 mt-1">Across online and cash trips</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1 text-xs text-slate-600">
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
              <span>Server-verified pricing</span>
            </div>
          </div>
        </div>

        {/* Link Guest Booking Card */}
        <div className="rounded-2xl bg-amber-50/60 border border-amber-200 p-4 sm:p-5 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-amber-950 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>Link a Previous Guest Booking?</span>
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                If you booked a ride as a guest, enter its reference number (e.g. <span className="font-mono font-bold">SR-123456</span>) to link it to your account history.
              </p>
            </div>
            <form onSubmit={handleLinkRide} className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="SR-XXXXXX"
                value={linkRefInput}
                onChange={(e) => setLinkRefInput(e.target.value.toUpperCase())}
                className="w-full sm:w-36 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                disabled={isLinking || !linkRefInput.trim()}
                className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition disabled:opacity-50 whitespace-nowrap"
              >
                {isLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Link Ride"}
              </button>
            </form>
          </div>
          {linkStatus && (
            <p
              className={`text-xs font-semibold mt-2 ${
                linkStatus.type === "success" ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {linkStatus.message}
            </p>
          )}
        </div>

        {/* Rides History Section */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header & Tabs */}
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-black text-slate-950 tracking-tight">My Rides</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filteredRides.length} {selectedFilter.toLowerCase()} booking(s)
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold text-slate-600">
              {(["ALL", "ACTIVE", "COMPLETED", "CANCELLED"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedFilter(tab)}
                  className={`rounded-lg px-3.5 py-1.5 transition capitalize ${
                    selectedFilter === tab
                      ? "bg-white text-slate-950 shadow-sm font-black"
                      : "hover:text-slate-950"
                  }`}
                >
                  {tab === "ALL" ? "All Rides" : tab.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Content List */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
              <p className="text-xs font-semibold">Loading your bookings...</p>
            </div>
          ) : filteredRides.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Car className="h-8 w-8" />
              </div>
              <h4 className="text-base font-bold text-slate-800">No rides found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {selectedFilter === "ALL"
                  ? "You haven't booked any rides yet. Book your first SwiftRide today!"
                  : `You have no ${selectedFilter.toLowerCase()} rides in your account.`}
              </p>
              <div className="mt-5">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-6 py-2.5 text-xs font-bold text-slate-950 shadow hover:bg-yellow-300 transition"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Book Your First Ride</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRides.map((ride) => {
                const isCancellable = [
                  "REQUESTED",
                  "CONFIRMED",
                  "DRIVER_ASSIGNED",
                  "DRIVER_ARRIVING",
                ].includes(ride.status);

                return (
                  <div
                    key={ride.referenceId}
                    className="p-6 transition hover:bg-slate-50/70 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
                  >
                    {/* Left: Ride Info & Route */}
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-black text-slate-950 bg-slate-100 px-3 py-1 rounded-lg">
                          {ride.referenceId}
                        </span>

                        {/* Status badge */}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            ride.status === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : ride.status === "CANCELLED"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-yellow-100 text-yellow-900 animate-pulse"
                          }`}
                        >
                          {ride.status.replace("_", " ")}
                        </span>

                        {/* Payment badge */}
                        {(() => {
                          const paymentInfo = getPaymentDisplay(ride.paymentMethod, ride.paymentStatus);
                          return (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${paymentInfo.badgeClass}`}
                            >
                              {paymentInfo.badgeText}
                            </span>
                          );
                        })()}

                        <span className="text-xs text-slate-400 flex items-center gap-1 ml-auto lg:ml-0">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{ride.bookedAt || "Recent"}</span>
                        </span>
                      </div>

                      {/* Route */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2.5 text-xs text-slate-700">
                          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-bold text-slate-900">{ride.pickup}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs text-slate-700">
                          <div className="h-2 w-2 rounded-full bg-slate-950 shrink-0" />
                          <span className="font-bold text-slate-900">{ride.destination}</span>
                        </div>
                      </div>

                      {/* Driver & Car Summary */}
                      {ride.driver && (
                        <div className="flex items-center gap-4 text-xs text-slate-600 pt-1">
                          <div className="flex items-center gap-1 font-semibold text-slate-900">
                            <Car className="h-3.5 w-3.5 text-yellow-500" />
                            <span>{ride.rideName}</span>
                            <span className="text-slate-400">({ride.driver.car})</span>
                          </div>
                          <div className="flex items-center gap-1 text-slate-500">
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            <span>{ride.driver.rating}</span>
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">
                            {ride.driver.plate}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right: Fare & Action Buttons */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-end justify-between gap-3 w-full lg:w-auto shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <div className="text-2xl font-black text-slate-950">₹{ride.totalFare}</div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">
                          Fare Incl. Taxes
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => setSelectedRide(ride)}
                          className="flex-1 sm:flex-none rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                        >
                          View Details
                        </button>

                        {/* Official Tax Receipt (for Completed Rides) */}
                        {ride.status === "COMPLETED" && (
                          <button
                            onClick={() => setReceiptRide(ride)}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
                          >
                            <Receipt className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Tax Invoice</span>
                          </button>
                        )}

                        {/* Driver Rating & Review Button */}
                        {ride.status === "COMPLETED" && (
                          ride.review ? (
                            <span className="inline-flex items-center gap-1 rounded-xl bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs font-bold text-yellow-900 shadow-sm">
                              <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                              <span>Reviewed ({ride.review.rating}/5)</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => setReviewingRide(ride)}
                              className="rounded-xl bg-yellow-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-yellow-300 shadow transition active:scale-95"
                            >
                              ★ Rate Driver
                            </button>
                          )
                        )}

                        {/* Track Live button for Active Trips */}
                        {["REQUESTED", "CONFIRMED", "DRIVER_ASSIGNED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(ride.status) && (
                          <button
                            onClick={() => {
                              try {
                                localStorage.setItem("swiftride_active_ref", ride.referenceId);
                              } catch {}
                              router.push("/book-ride");
                            }}
                            className="flex items-center gap-1.5 rounded-xl bg-yellow-400 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-yellow-300 transition shadow-sm active:scale-95"
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            <span>Track Live</span>
                          </button>
                        )}

                        {isCancellable && (
                          <button
                            onClick={() => handleCancelRide(ride.referenceId)}
                            disabled={cancellingRef === ride.referenceId}
                            className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50"
                          >
                            {cancellingRef === ride.referenceId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              "Cancel"
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 3. Booking Details Modal */}
      {selectedRide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
            <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
                  SwiftRide Booking Receipt
                </span>
                <h3 className="text-lg font-black tracking-tight">{selectedRide.referenceId}</h3>
              </div>
              <button
                onClick={() => setSelectedRide(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Route */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Pickup Location
                    </span>
                    <p className="text-xs font-bold text-slate-900">{selectedRide.pickup}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-950 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Drop-off Destination
                    </span>
                    <p className="text-xs font-bold text-slate-900">{selectedRide.destination}</p>
                  </div>
                </div>
              </div>

              {/* Fare Breakdown */}
              <div className="space-y-2 text-xs">
                <h4 className="font-bold uppercase tracking-wider text-slate-500 text-[10px]">
                  Price Breakdown
                </h4>
                <div className="flex justify-between text-slate-600">
                  <span>Base Fare ({selectedRide.rideName})</span>
                  <span>₹{selectedRide.baseFare}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Distance Fare (~{selectedRide.distanceKm} km)</span>
                  <span>₹{Math.round(selectedRide.totalFare - selectedRide.baseFare - (selectedRide.platformFee || 25))}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Platform & Safety Fee</span>
                  <span>₹{selectedRide.platformFee || 25}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-950">
                  <span>Total Fare</span>
                  <span className="text-yellow-600">₹{selectedRide.totalFare}</span>
                </div>
              </div>

              {/* Driver Card */}
              {selectedRide.driver && (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Assigned Driver
                  </span>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-950">{selectedRide.driver.name}</div>
                      <div className="text-slate-500">{selectedRide.driver.car}</div>
                      <div className="font-mono text-slate-600 text-[11px] mt-0.5">
                        {selectedRide.driver.plate}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-yellow-50 px-2.5 py-1 text-yellow-800 font-bold">
                      <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                      <span>{selectedRide.driver.rating}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Details */}
              {(() => {
                const paymentInfo = getPaymentDisplay(selectedRide.paymentMethod, selectedRide.paymentStatus);
                return (
                  <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Method:</span>
                      <span className="font-bold text-slate-900">
                        {paymentInfo.methodLabel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Status:</span>
                      <span className={`font-bold ${paymentInfo.statusLabel.toLowerCase() === "paid" ? "text-emerald-700" : "text-slate-900"}`}>
                        {paymentInfo.statusLabel}
                      </span>
                    </div>
                    {selectedRide.razorpayPaymentId && (
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-slate-400">Payment ID:</span>
                        <span className="text-slate-700">{selectedRide.razorpayPaymentId}</span>
                      </div>
                    )}
                    {selectedRide.razorpayOrderId && (
                      <div className="flex justify-between font-mono text-[10px]">
                        <span className="text-slate-400">Order ID:</span>
                        <span className="text-slate-700">{selectedRide.razorpayOrderId}</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              {selectedRide.status === "COMPLETED" ? (
                <button
                  type="button"
                  onClick={() => {
                    const r = selectedRide;
                    setSelectedRide(null);
                    setReceiptRide(r);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Print / Download Tax Receipt</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setSelectedRide(null)}
                className="rounded-xl bg-slate-950 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Official Tax Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(receiptRide)}
        ride={receiptRide}
        onClose={() => setReceiptRide(null)}
      />

      {/* 5. Driver Review Modal */}
      <ReviewModal
        isOpen={Boolean(reviewingRide)}
        ride={reviewingRide}
        onClose={() => setReviewingRide(null)}
        onSuccess={handleReviewSuccess}
      />

      {/* 6. Customer Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      {/* 7. Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
            <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold">Edit Rider Profile</h3>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-xl bg-yellow-400 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-yellow-300 shadow disabled:opacity-50"
                >
                  {isSavingProfile ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
