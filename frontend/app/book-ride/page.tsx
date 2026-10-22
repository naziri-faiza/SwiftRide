"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Shield,
  Clock,
  MapPin,
  Navigation,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Users,
  Sparkles,
  PhoneCall,
  Star,
  RotateCcw,
  Zap,
  Share2,
  CreditCard,
  Banknote,
  Lock,
  AlertCircle,
  User as UserIcon,
  LogOut,
  FileText,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { loadRazorpayScript } from "../utils/razorpay";
import AuthModal from "../components/AuthModal";
import RouteMap from "../components/RouteMap";
import ReceiptModal from "../components/ReceiptModal";
import ReviewModal from "../components/ReviewModal";
import FeedbackModal from "../components/FeedbackModal";
import Navbar from "../components/Navbar";
import { getUser, getToken, clearAuth, getAuthHeaders, UserProfile } from "../utils/auth";
import { subscribeToRide } from "../utils/socket";

interface RideOption {
  id: string;
  name: string;
  tagline: string;
  seats: number;
  baseFare: number;
  perKmRate: number;
  icon: typeof Car;
  badge?: string;
  estimatedArrival: string;
}

const RIDE_OPTIONS: RideOption[] = [
  {
    id: "swift-go",
    name: "SwiftGo",
    tagline: "Affordable, compact rides for everyday travel",
    seats: 4,
    baseFare: 80,
    perKmRate: 14,
    icon: Car,
    badge: "Most Popular",
    estimatedArrival: "3 mins away",
  },
  {
    id: "swift-comfort",
    name: "SwiftComfort",
    tagline: "Top-rated drivers with spacious sedans & AC",
    seats: 4,
    baseFare: 130,
    perKmRate: 18,
    icon: Sparkles,
    badge: "Top Rated",
    estimatedArrival: "4 mins away",
  },
  {
    id: "swift-xl",
    name: "SwiftXL",
    tagline: "Spacious SUVs for groups, family & extra luggage",
    seats: 6,
    baseFare: 210,
    perKmRate: 24,
    icon: Users,
    badge: "Extra Space",
    estimatedArrival: "6 mins away",
  },
];

const PRESET_LOCATIONS = [
  { pickup: "Connaught Place, Inner Circle", destination: "Indira Gandhi Airport (T3)", label: "CP → Airport T3" },
  { pickup: "Cyber City DLF Phase 2", destination: "Hauz Khas Village", label: "Cyber City → Hauz Khas" },
  { pickup: "Noida Sector 62 Metro Station", destination: "Select Citywalk, Saket", label: "Noida 62 → Saket" },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface ActiveBooking {
  referenceId: string;
  pickup: string;
  destination: string;
  rideName: string;
  seats: number;
  baseFare: number;
  distanceKm: number;
  platformFee: number;
  totalFare: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  razorpayPaymentId?: string | null;
  razorpayOrderId?: string | null;
  bookedAt: string;
  driver: {
    name: string;
    car: string;
    rating: number;
    plate: string;
    etaMins: number;
    phone: string;
  };
}

export default function BookRidePage() {
  const router = useRouter();

  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedRideId, setSelectedRideId] = useState("swift-go");
  const [paymentMethod, setPaymentMethod] = useState<"RAZORPAY_TEST" | "CASH">("RAZORPAY_TEST");
  const [errors, setErrors] = useState<{ pickup?: string; destination?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState<{ type: "error" | "info" | "warning"; message: string } | null>(null);

  // Booking states: 'idle' | 'confirmed' | 'cancelled'
  const [bookingStatus, setBookingStatus] = useState<"idle" | "confirmed" | "cancelled">("idle");
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);

  // Customer authentication state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Modals for Receipts, Reviews, and App Feedback
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [receiptRide, setReceiptRide] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewRide, setReviewRide] = useState<any>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [hasReviewedActiveRide, setHasReviewedActiveRide] = useState(false);

  // Real-time Ride Updates with Resilient 4s Polling Fallback
  const [realtimeState, setRealtimeState] = useState<"live" | "polling">("live");

  // Restore active booking across page refreshes and check URL query
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      setCurrentUser(getUser());

      const params = new URLSearchParams(window.location.search);
      const rideParam = params.get("ride");
      if (rideParam && ["swift-go", "swift-comfort", "swift-xl"].includes(rideParam)) {
        setSelectedRideId(rideParam);
      }

      const savedRef = localStorage.getItem("swiftride_active_ref");
      if (!savedRef) return;

      fetch(`${BACKEND_URL}/api/rides/${savedRef}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.success && data.ride) {
            setActiveBooking(data.ride);
            if (data.ride.status === "CANCELLED") {
              setBookingStatus("cancelled");
            } else {
              setBookingStatus("confirmed");
            }
          }
        })
        .catch(() => {
          // Ignore network err on initial mount
        });
    } catch {
      // Ignore localStorage issues
    }
  }, []);

  // Real-time synchronization
  useEffect(() => {
    if (!activeBooking || !activeBooking.referenceId) return;

    const ref = activeBooking.referenceId;
    const token = getToken();

    // 1. WebSocket Live Stream Subscription
    const unsubscribe = subscribeToRide(
      ref,
      (data) => {
        if (data && data.ride) {
          setRealtimeState("live");
          setActiveBooking(data.ride);
          if (data.ride.status === "CANCELLED") {
            setBookingStatus("cancelled");
          }
        }
      },
      token || undefined
    );

    // 2. Resilient 4-second Polling Fallback
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/rides/${ref}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.success && data.ride) {
            setActiveBooking((current) => {
              if (current && current.status !== data.ride.status) {
                if (data.ride.status === "CANCELLED") {
                  setBookingStatus("cancelled");
                }
              }
              return data.ride;
            });
          }
        }
      } catch {
        setRealtimeState("polling");
      }
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [activeBooking?.referenceId]);

  // Demo distance & pricing calculation
  const demoDistanceKm = 8.5;
  const platformFee = 25;

  const currentRide =
    RIDE_OPTIONS.find((r) => r.id === selectedRideId) || RIDE_OPTIONS[0];
  const estimatedRideFare =
    currentRide.baseFare + Math.round(demoDistanceKm * currentRide.perKmRate);
  const totalEstimatedFare = estimatedRideFare + platformFee;

  // Swap pickup & drop-off
  function handleSwapLocations() {
    setPickup(destination);
    setDestination(pickup);
    setErrors({});
  }

  // 1-Click Demo Preset Populator
  function handleApplyPreset(preset: typeof PRESET_LOCATIONS[0]) {
    setPickup(preset.pickup);
    setDestination(preset.destination);
    setErrors({});
  }

  // Validation & Booking handler with Razorpay / Cash integration
  async function handleBooking(e: React.FormEvent) {
    e.preventDefault();

    // Enforce authentication flow: Book a Ride -> Login if unauthenticated -> Booking
    if (!currentUser && !getUser()) {
      setIsAuthModalOpen(true);
      return;
    }

    const newErrors: { pickup?: string; destination?: string } = {};

    if (!pickup.trim()) {
      newErrors.pickup = "Please enter your pickup location.";
    }
    if (!destination.trim()) {
      newErrors.destination = "Please enter your drop-off destination.";
    } else if (pickup.trim().toLowerCase() === destination.trim().toLowerCase()) {
      newErrors.destination = "Drop-off location cannot be identical to pickup.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setPaymentNotice(null);
    setIsSubmitting(true);

    try {
      const headers = getAuthHeaders();

      // FLOW A: PAY CASH (Instant Booking without payment gateway)
      if (paymentMethod === "CASH") {
        const response = await fetch(`${BACKEND_URL}/api/rides/create`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            pickup: pickup.trim(),
            destination: destination.trim(),
            rideId: currentRide.id,
            paymentMethod: "CASH",
            customerName: currentUser?.fullName,
            customerEmail: currentUser?.email,
            customerPhone: currentUser?.phone,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to create ride booking on server.");
        }

        setActiveBooking(data.ride);
        setBookingStatus("confirmed");
        setIsSubmitting(false);

        try {
          localStorage.setItem("swiftride_active_ref", data.ride.referenceId);
        } catch {}

        const container = document.getElementById("booking-card-container");
        if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      // FLOW B: RAZORPAY TEST MODE ONLINE PAYMENT
      const orderResponse = await fetch(`${BACKEND_URL}/api/payments/create-order`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pickup: pickup.trim(),
          destination: destination.trim(),
          rideId: currentRide.id,
          customerName: currentUser?.fullName,
          customerEmail: currentUser?.email,
          customerPhone: currentUser?.phone,
        }),
      });

      const orderData = await orderResponse.json();

      if (orderResponse.status === 503 || orderData.error === "RAZORPAY_NOT_CONFIGURED") {
        setIsSubmitting(false);
        setPaymentNotice({
          type: "warning",
          message:
            "Razorpay Test Credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured in backend/.env. You can set your test keys or switch to 'Pay Cash' to complete this booking instantly.",
        });
        return;
      }

      if (!orderResponse.ok || !orderData.success) {
        throw new Error(orderData.message || "Failed to create Razorpay payment order on the server.");
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Unable to load Razorpay Checkout script. Check your internet connection.");
      }

      const razorpayOptions = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "SwiftRide Cabs",
        description: `${orderData.fareBreakdown.rideName} Ride (Ref: ${orderData.bookingReference})`,
        image: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png",
        order_id: orderData.orderId,
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifyResponse = await fetch(`${BACKEND_URL}/api/payments/verify`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingReference: orderData.bookingReference,
                referenceId: orderData.bookingReference,
                pickup: pickup.trim(),
                destination: destination.trim(),
                rideId: currentRide.id,
                customerName: currentUser?.fullName,
                customerEmail: currentUser?.email,
                customerPhone: currentUser?.phone,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(verifyData.message || "Payment verification failed on the server.");
            }

            setActiveBooking(verifyData.ride);
            setBookingStatus("confirmed");
            setIsSubmitting(false);

            try {
              localStorage.setItem("swiftride_active_ref", verifyData.ride.referenceId);
            } catch {}

            const container = document.getElementById("booking-card-container");
            if (container) container.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch (err: any) {
            setIsSubmitting(false);
            setPaymentNotice({
              type: "error",
              message: err.message || "Payment verification failed. Please try again.",
            });
          }
        },
        prefill: {
          name: currentUser?.fullName || "Demo Rider",
          email: currentUser?.email || "rider@swiftride.demo",
          contact: currentUser?.phone || "+919876543210",
        },
        theme: {
          color: "#EAB308", // Yellow accent
        },
        modal: {
          ondismiss: function () {
            setIsSubmitting(false);
            setPaymentNotice({
              type: "info",
              message: "Payment was cancelled. You can retry Razorpay or choose 'Pay Cash' to book instantly.",
            });
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(razorpayOptions);
      razorpayInstance.on("payment.failed", function (response: any) {
        setIsSubmitting(false);
        setPaymentNotice({
          type: "error",
          message: `Payment failed: ${response.error?.description || "Transaction was declined."}`,
        });
      });

      razorpayInstance.open();
    } catch (err: any) {
      setIsSubmitting(false);
      setPaymentNotice({
        type: "error",
        message: err.message || "Something went wrong while initiating booking. Please try again.",
      });
    }
  }

  // Cancellation handler
  async function handleCancelBooking() {
    if (!activeBooking) return;
    try {
      await fetch(`${BACKEND_URL}/api/rides/${activeBooking.referenceId}/cancel`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      setBookingStatus("cancelled");
      try {
        localStorage.removeItem("swiftride_active_ref");
      } catch {}
    } catch {
      setBookingStatus("cancelled");
    }
  }

  // Reset to book another ride
  function handleResetBooking() {
    setBookingStatus("idle");
    setActiveBooking(null);
    setPickup("");
    setDestination("");
    setErrors({});
    setPaymentNotice(null);
    setHasReviewedActiveRide(false);
    try {
      localStorage.removeItem("swiftride_active_ref");
    } catch {}
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-yellow-400 selection:text-slate-950">
      {/* 1. Header / Navbar */}
      <Navbar
        currentPage="book-ride"
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={() => {
          clearAuth();
          setCurrentUser(null);
        }}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
      />

      {/* 2. Main Booking Section */}
      <section id="booking-section" className="relative overflow-hidden pt-8 pb-16 lg:pt-10 lg:pb-20">
        <div className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-yellow-300/20 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            
            {/* Left Column: Booking Form or Active Booking View */}
            <div id="booking-card-container" className="lg:col-span-7">
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-800">
                  <Sparkles className="h-3.5 w-3.5 text-yellow-600" />
                  Fast & Seamless Cab Dispatch
                </div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                  Book Your Ride Now
                </h1>
                <p className="mt-2 text-sm text-slate-600 sm:text-base">
                  Upfront guaranteed fares, verified commercial drivers, and safe Razorpay payments.
                </p>
              </div>

              {/* Unauthenticated Quick Banner */}
              {!currentUser && (
                <div className="mb-5 flex items-center justify-between rounded-2xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-900 shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    <span>Sign in with your SwiftRide account to track your trip, receipts, and ratings.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAuthModalOpen(true)}
                    className="font-bold underline text-amber-950 hover:text-black shrink-0 ml-3"
                  >
                    Sign In →
                  </button>
                </div>
              )}

              {/* Payment Alert / Notice Banner */}
              {paymentNotice && (
                <div
                  className={`mb-5 flex items-start gap-3 rounded-2xl p-4 text-xs font-medium ${
                    paymentNotice.type === "error"
                      ? "border border-rose-200 bg-rose-50 text-rose-800"
                      : paymentNotice.type === "warning"
                      ? "border border-amber-200 bg-amber-50 text-amber-800"
                      : "border border-blue-200 bg-blue-50 text-blue-800"
                  }`}
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p>{paymentNotice.message}</p>
                    {paymentNotice.type === "warning" && (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("CASH");
                          setPaymentNotice(null);
                        }}
                        className="mt-2 font-bold text-amber-900 underline underline-offset-2 hover:text-black"
                      >
                        Switch to &quot;Pay Cash&quot; &amp; Book Now →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* A. IDLE STATE: THE INTERACTIVE BOOKING FORM */}
              {bookingStatus === "idle" && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                  <form onSubmit={handleBooking} className="space-y-5">
                    {/* Pickup & Destination Inputs with Swap */}
                    <div className="relative space-y-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                          Pickup Location
                        </label>
                        <div className="relative mt-1.5 flex items-center">
                          <MapPin className="pointer-events-none absolute left-3.5 h-4 w-4 text-emerald-600" />
                          <input
                            id="pickup-input"
                            type="text"
                            value={pickup}
                            onChange={(e) => {
                              setPickup(e.target.value);
                              if (errors.pickup) setErrors((prev) => ({ ...prev, pickup: undefined }));
                            }}
                            placeholder="Enter pickup address or landmark..."
                            className={`w-full rounded-2xl border bg-slate-50/70 py-3.5 pl-10 pr-12 text-sm font-medium text-slate-900 transition focus:bg-white focus:outline-none focus:ring-2 ${
                              errors.pickup
                                ? "border-rose-400 focus:ring-rose-400"
                                : "border-slate-200 focus:border-yellow-400 focus:ring-yellow-400"
                            }`}
                          />
                        </div>
                        {errors.pickup && (
                          <p className="mt-1 text-xs font-semibold text-rose-600">{errors.pickup}</p>
                        )}
                      </div>

                      {/* Swap button */}
                      <div className="flex justify-end pr-2">
                        <button
                          type="button"
                          onClick={handleSwapLocations}
                          title="Swap Pickup & Destination"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-slate-900"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                          Drop-off Destination
                        </label>
                        <div className="relative mt-1.5 flex items-center">
                          <Navigation className="pointer-events-none absolute left-3.5 h-4 w-4 text-yellow-600" />
                          <input
                            id="destination-input"
                            type="text"
                            value={destination}
                            onChange={(e) => {
                              setDestination(e.target.value);
                              if (errors.destination) setErrors((prev) => ({ ...prev, destination: undefined }));
                            }}
                            placeholder="Where are you going?"
                            className={`w-full rounded-2xl border bg-slate-50/70 py-3.5 pl-10 pr-12 text-sm font-medium text-slate-900 transition focus:bg-white focus:outline-none focus:ring-2 ${
                              errors.destination
                                ? "border-rose-400 focus:ring-rose-400"
                                : "border-slate-200 focus:border-yellow-400 focus:ring-yellow-400"
                            }`}
                          />
                        </div>
                        {errors.destination && (
                          <p className="mt-1 text-xs font-semibold text-rose-600">{errors.destination}</p>
                        )}
                      </div>
                    </div>

                    {/* 1-Click Preset Route Quick Buttons */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-600" /> 1-Click Demo Route Presets:
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {PRESET_LOCATIONS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleApplyPreset(preset)}
                            className="rounded-lg border border-slate-200 bg-slate-100/80 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-slate-900"
                          >
                            ⚡ {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Ride Categories Selector */}
                    <div className="pt-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Choose Vehicle Type
                      </label>
                      <div className="mt-2 space-y-2.5">
                        {RIDE_OPTIONS.map((ride) => {
                          const Icon = ride.icon;
                          const isSelected = selectedRideId === ride.id;
                          const rideFare =
                            ride.baseFare + Math.round(demoDistanceKm * ride.perKmRate);

                          return (
                            <button
                              key={ride.id}
                              id={`ride-option-${ride.id}`}
                              type="button"
                              onClick={() => setSelectedRideId(ride.id)}
                              className={`group flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                                isSelected
                                  ? "border-yellow-500 bg-yellow-50/70 ring-2 ring-yellow-400/40 shadow-sm"
                                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                              }`}
                            >
                              <div className="flex items-center gap-3.5">
                                <div
                                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                                    isSelected
                                      ? "bg-yellow-400 text-slate-950 shadow-sm"
                                      : "bg-slate-100 text-slate-700 group-hover:bg-slate-200"
                                  }`}
                                >
                                  <Icon className="h-6 w-6" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{ride.name}</span>
                                    <span className="flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                                      <Users className="h-3 w-3" /> {ride.seats}
                                    </span>
                                    {ride.badge && (
                                      <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                                        {ride.badge}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500">{ride.tagline}</p>
                                  <p className="text-[11px] font-semibold text-emerald-600">
                                    ETA: {ride.estimatedArrival}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-lg font-black text-slate-950">₹{rideFare}</div>
                                <div className="text-[11px] text-slate-500">Base ₹{ride.baseFare}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="pt-3">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                        Select Payment Option
                      </label>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {/* Razorpay Option */}
                        <div
                          id="payment-option-razorpay"
                          onClick={() => setPaymentMethod("RAZORPAY_TEST")}
                          className={`cursor-pointer rounded-2xl border p-4 transition ${
                            paymentMethod === "RAZORPAY_TEST"
                              ? "border-yellow-500 bg-yellow-50/80 ring-2 ring-yellow-400/40 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                  paymentMethod === "RAZORPAY_TEST"
                                    ? "bg-yellow-400 text-slate-950"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                <CreditCard className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">Online Payment</h4>
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Razorpay Test Mode
                                </span>
                              </div>
                            </div>
                            <div className="h-4 w-4 rounded-full border-2 border-yellow-500 p-0.5">
                              {paymentMethod === "RAZORPAY_TEST" && (
                                <div className="h-full w-full rounded-full bg-yellow-500" />
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">
                            UPI, Debit/Credit Cards &amp; Netbanking test simulation.
                          </p>
                        </div>

                        {/* Pay Cash Option */}
                        <div
                          id="payment-option-cash"
                          onClick={() => setPaymentMethod("CASH")}
                          className={`cursor-pointer rounded-2xl border p-4 transition ${
                            paymentMethod === "CASH"
                              ? "border-yellow-500 bg-yellow-50/80 ring-2 ring-yellow-400/40 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                                  paymentMethod === "CASH"
                                    ? "bg-yellow-400 text-slate-950"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                <Banknote className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">Pay Cash</h4>
                                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                                  Demo Friendly
                                </span>
                              </div>
                            </div>
                            <div className="h-4 w-4 rounded-full border-2 border-yellow-500 p-0.5">
                              {paymentMethod === "CASH" && (
                                <div className="h-full w-full rounded-full bg-yellow-500" />
                              )}
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">
                            Pay driver directly upon completion of your trip.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Pre-Payment Review & Fare Summary */}
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span>Selected Category:</span>
                        <span className="font-bold text-slate-900">{currentRide.name}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Base Fare:</span>
                        <span className="font-medium text-slate-800">₹{currentRide.baseFare}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Distance Fare ({demoDistanceKm} km @ ₹{currentRide.perKmRate}/km):</span>
                        <span className="font-medium text-slate-800">
                          ₹{Math.round(demoDistanceKm * currentRide.perKmRate)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Platform &amp; Safety Fee:</span>
                        <span className="font-medium text-slate-800">₹{platformFee}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-600">
                        <span>Payment Method:</span>
                        <span className="font-bold text-slate-900">
                          {paymentMethod === "RAZORPAY_TEST" ? "⚡ Razorpay Online (Test)" : "💵 Cash on Arrival"}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-black text-slate-950">
                        <span>Total Payable Fare:</span>
                        <span className="text-base text-yellow-600">₹{totalEstimatedFare}</span>
                      </div>
                    </div>

                    {/* Submit CTA */}
                    <button
                      id="submit-booking-btn"
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-2xl bg-yellow-400 py-4 text-base font-extrabold text-slate-950 shadow-md transition hover:bg-yellow-500 active:scale-[0.99] disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
                          {paymentMethod === "RAZORPAY_TEST" ? "Opening Razorpay Checkout..." : "Confirming Ride..."}
                        </span>
                      ) : (
                        paymentMethod === "RAZORPAY_TEST"
                          ? `Pay ₹${totalEstimatedFare} via Razorpay (Test Mode) →`
                          : `Confirm ${currentRide.name} Ride (Pay ₹${totalEstimatedFare} Cash) →`
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                      <Lock className="h-3 w-3" />
                      <span>Zero card details stored · Official Razorpay Test Integration</span>
                    </div>
                  </form>
                </div>
              )}

              {/* B. CONFIRMED STATE: ACTIVE BOOKING TICKET */}
              {bookingStatus === "confirmed" && activeBooking && (
                <div id="confirmed-booking-card" className="rounded-3xl border border-emerald-300 bg-white p-6 shadow-2xl ring-2 ring-emerald-100 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          {activeBooking.status === "COMPLETED"
                            ? "🎉 Trip Completed! Hope you enjoyed the ride."
                            : activeBooking.status === "IN_PROGRESS"
                            ? "🚀 Trip in Progress · Safe Travels!"
                            : activeBooking.status === "DRIVER_ARRIVING"
                            ? "📍 Driver Arrived at Pickup Location"
                            : activeBooking.status === "DRIVER_ASSIGNED"
                            ? "🚕 Driver Assigned & Heading Your Way"
                            : "📡 Ride Requested & Searching Drivers..."}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${realtimeState === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${realtimeState === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            {realtimeState === "live" ? "Live Real-Time Sync (WebSockets)" : "Backup Polling Active"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span
                      id="live-booking-status-badge"
                      className={`rounded-full px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider ${
                        activeBooking.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : activeBooking.status === "IN_PROGRESS"
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-300"
                          : activeBooking.status === "DRIVER_ARRIVING"
                          ? "bg-purple-100 text-purple-800 border border-purple-300"
                          : activeBooking.status === "DRIVER_ASSIGNED"
                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                          : "bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                      }`}
                    >
                      {activeBooking.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Reference ID Banner */}
                  <div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Unique Booking Reference
                        </p>
                        <p id="booking-ref-id" className="font-mono text-2xl font-black text-yellow-400">
                          {activeBooking.referenceId}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">Confirmed At</p>
                        <p className="text-xs font-semibold text-slate-200">{activeBooking.bookedAt}</p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Verification Card */}
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    {(() => {
                      const isPaid = String(activeBooking.paymentStatus || "").toLowerCase() === "paid";
                      const isRazorpay = String(activeBooking.paymentMethod || "").toLowerCase().includes("razorpay");
                      return (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                              {isPaid ? (
                                <CreditCard className="h-4 w-4" />
                              ) : (
                                <Banknote className="h-4 w-4" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-emerald-950">
                                {isRazorpay
                                  ? isPaid
                                    ? "Razorpay Online Payment (Test Mode)"
                                    : "Razorpay Payment Pending"
                                  : isPaid
                                  ? "Paid in Cash"
                                  : "Cash on Trip Completion"}
                              </p>
                              <p className="text-[11px] text-emerald-800">
                                Status: <strong className="uppercase">{activeBooking.paymentStatus}</strong>
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-emerald-950">₹{activeBooking.totalFare}</p>
                            <span className="text-[10px] font-semibold text-emerald-700">
                              {isPaid ? "Paid Online" : "Pay to Driver"}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {activeBooking.razorpayPaymentId && (
                      <div className="mt-3 border-t border-emerald-200/80 pt-2 font-mono text-[11px] text-emerald-900">
                        <span>Payment ID: </span>
                        <strong>{activeBooking.razorpayPaymentId}</strong>
                      </div>
                    )}
                  </div>

                  {/* Driver Details Card */}
                  {activeBooking.status === "REQUESTED" ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                        <Car className="h-6 w-6 animate-pulse" />
                      </div>
                      <h4 className="mt-2 text-sm font-bold text-amber-950">Searching for Nearby Drivers...</h4>
                      <p className="mt-1 text-xs text-amber-800">
                        Your request has been broadcasted to all active SwiftRide drivers. When a driver accepts, their details and live ETA will appear here in real time.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 font-black text-slate-950 shadow-sm">
                            {activeBooking.driver?.name
                              ? activeBooking.driver.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()
                              : "DR"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900">{activeBooking.driver?.name || "Assigned Driver"}</h4>
                              <span className="flex items-center gap-0.5 rounded bg-yellow-100 px-1.5 py-0.5 text-[11px] font-bold text-yellow-900">
                                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                                {activeBooking.driver?.rating || 4.89}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">{activeBooking.driver?.car || "Sedan / Hatchback (AC)"}</p>
                          </div>
                        </div>
                        <div className="rounded-lg bg-slate-950 px-3 py-1 font-mono text-xs font-bold text-white shadow-sm">
                          {activeBooking.driver?.plate || "DL 01 AB 4291"}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-3 text-xs font-semibold text-slate-700 shadow-sm">
                        <span className="flex items-center gap-2 text-emerald-700">
                          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500" />
                          {activeBooking.status === "COMPLETED"
                            ? "Trip successfully completed"
                            : activeBooking.status === "IN_PROGRESS"
                            ? "Trip in progress · En route"
                            : activeBooking.status === "DRIVER_ARRIVING"
                            ? "Driver at pickup location"
                            : `Driver arriving in ~${activeBooking.driver?.etaMins || 3} mins`}
                        </span>
                        <button
                          type="button"
                          onClick={() => alert(`Calling driver ${activeBooking.driver?.name || "Driver"}: ${activeBooking.driver?.phone || "+91 98765 43210"} (Demo Call)`)}
                          className="flex items-center gap-1 font-bold text-slate-900 hover:text-yellow-600"
                        >
                          <PhoneCall className="h-3.5 w-3.5" /> Call Driver
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Route & Pricing Breakdown */}
                  <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <MapPin className="h-2.5 w-2.5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Pickup: </span>
                        <span>{activeBooking.pickup}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-100 text-yellow-800">
                        <Navigation className="h-2.5 w-2.5" />
                      </div>
                      <div>
                        <span className="font-bold text-slate-900">Drop-off: </span>
                        <span>{activeBooking.destination}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <span>Vehicle Category:</span>
                      <span className="font-bold text-slate-900">{activeBooking.rideName} ({activeBooking.seats} Seats)</span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 font-bold text-slate-900">
                      <span>Total Fare:</span>
                      <span className="text-lg font-black text-yellow-600">₹{activeBooking.totalFare}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    {activeBooking.status === "COMPLETED" && (
                      <>
                        <button
                          id="view-receipt-btn"
                          type="button"
                          onClick={() => {
                            setReceiptRide(activeBooking);
                            setIsReceiptOpen(true);
                          }}
                          className="flex-1 rounded-xl bg-amber-400 py-3.5 text-xs font-bold text-slate-950 transition hover:bg-amber-500 flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <FileText className="h-4 w-4" /> View Tax Receipt
                        </button>
                        <button
                          id="rate-driver-btn"
                          type="button"
                          disabled={hasReviewedActiveRide}
                          onClick={() => {
                            setReviewRide(activeBooking);
                            setIsReviewOpen(true);
                          }}
                          className={`flex-1 rounded-xl py-3.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                            hasReviewedActiveRide
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
                              : "border border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                        >
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          {hasReviewedActiveRide ? "Driver Reviewed ✓" : "Rate Driver"}
                        </button>
                      </>
                    )}
                    {activeBooking.status !== "COMPLETED" && (
                      <button
                        id="cancel-booking-btn"
                        type="button"
                        onClick={handleCancelBooking}
                        className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-3.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                      >
                        Cancel Booking
                      </button>
                    )}
                    <button
                      id="reset-booking-btn"
                      type="button"
                      onClick={handleResetBooking}
                      className="flex-1 rounded-xl bg-slate-950 py-3.5 text-xs font-bold text-white transition hover:bg-slate-800"
                    >
                      Book Another Ride
                    </button>
                  </div>
                </div>
              )}

              {/* C. CANCELLED STATE */}
              {bookingStatus === "cancelled" && (
                <div id="cancelled-booking-card" className="rounded-3xl border border-rose-200 bg-white p-6 shadow-xl sm:p-8">
                  <div className="flex items-center gap-3 border-b border-slate-100 pb-4 text-rose-600">
                    <XCircle className="h-8 w-8 shrink-0" />
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Ride Cancelled</h3>
                      <p className="text-xs text-slate-500">
                        Your booking {activeBooking?.referenceId} has been successfully cancelled.
                      </p>
                    </div>
                  </div>

                  <div className="my-5 rounded-2xl bg-slate-50 p-4 text-xs text-slate-600">
                    <p className="font-semibold text-slate-800">
                      {String(activeBooking?.paymentMethod || "").toLowerCase().includes("razorpay")
                        ? "Test Payment Cancellation Notice"
                        : "Zero Cancellation Fee"}
                    </p>
                    <p className="mt-1">
                      {String(activeBooking?.paymentMethod || "").toLowerCase().includes("razorpay")
                        ? "This was a Razorpay Test Mode simulation. No real money was charged. (In production, an automated refund request would be submitted to Razorpay)."
                        : "In accordance with demo fair-policy, no cancellation fee applies for pending dispatch."}
                    </p>
                  </div>

                  <button
                    id="rebook-ride-btn"
                    type="button"
                    onClick={handleResetBooking}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-yellow-500"
                  >
                    <RotateCcw className="h-4 w-4" /> Book a New Ride
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Dynamic Vector Route Visualizer & Fleet Radar */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl sm:p-8">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Live Fleet Active
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-yellow-400">14 Drivers in Sector 2</span>
                </div>

                {/* Dynamic Leaflet Route Visualizer with OpenStreetMap & OSRM */}
                <div className="my-6">
                  <RouteMap
                    pickup={pickup}
                    destination={destination}
                    rideStatus={activeBooking?.status}
                    driver={activeBooking?.driver}
                  />
                </div>

                {/* Selected Vehicle Spotlight */}
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400">Selected Vehicle</span>
                      <h3 className="text-lg font-bold text-white">{currentRide.name}</h3>
                      <p className="text-xs text-yellow-400 font-semibold">{currentRide.estimatedArrival}</p>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400 text-slate-950 shadow-md">
                      <Car className="h-7 w-7" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-800/80 pt-3 text-center">
                    <div>
                      <p className="text-[10px] text-slate-400">Base Rate</p>
                      <p className="text-xs font-bold text-slate-200">₹{currentRide.baseFare}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Per Km</p>
                      <p className="text-xs font-bold text-slate-200">₹{currentRide.perKmRate}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Max Capacity</p>
                      <p className="text-xs font-bold text-slate-200">{currentRide.seats} Seats</p>
                    </div>
                  </div>
                </div>

                {/* Safety & Payment Trust Signals */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <Shield className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Verified &amp; police background-checked drivers</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <Lock className="h-4 w-4 text-yellow-400 shrink-0" />
                    <span>Razorpay 256-bit encrypted test payments</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <Clock className="h-4 w-4 text-yellow-400 shrink-0" />
                    <span>24/7 round-the-clock roadside emergency support</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-300">
                    <Share2 className="h-4 w-4 text-yellow-400 shrink-0" />
                    <span>Live trip sharing with friends &amp; family</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500">
        <p>© 2026 SwiftRide Technologies India Pvt. Ltd. · Dedicated Booking Portal</p>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => setCurrentUser(u)}
      />

      {/* Ride Tax Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        ride={receiptRide}
        onClose={() => setIsReceiptOpen(false)}
      />

      {/* Driver Rating & Review Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        ride={reviewRide}
        onClose={() => setIsReviewOpen(false)}
        onSuccess={() => {
          setHasReviewedActiveRide(true);
        }}
      />

      {/* App Feedback & Suggestions Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </main>
  );
}
