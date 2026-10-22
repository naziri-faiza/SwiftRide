"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Car,
  Shield,
  Clock,
  MapPin,
  Navigation,
  CheckCircle2,
  Users,
  Sparkles,
  PhoneCall,
  Star,
  Zap,
  CreditCard,
  Banknote,
  Lock,
  User as UserIcon,
  LogOut,
  ArrowRight,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  Award,
  Smartphone,
  Compass,
  Check,
} from "lucide-react";
import AuthModal from "./components/AuthModal";
import FeedbackModal from "./components/FeedbackModal";
import Navbar from "./components/Navbar";
import { getUser, clearAuth, isAuthenticated, UserProfile } from "./utils/auth";

interface RideCategory {
  id: string;
  name: string;
  tagline: string;
  seats: number;
  baseFare: number;
  perKmRate: number;
  icon: typeof Car;
  badge?: string;
  badgeColor?: string;
  features: string[];
}

const RIDE_CATEGORIES: RideCategory[] = [
  {
    id: "swift-go",
    name: "SwiftGo",
    tagline: "Affordable, compact rides for everyday travel",
    seats: 4,
    baseFare: 80,
    perKmRate: 14,
    icon: Car,
    badge: "Most Popular",
    badgeColor: "bg-yellow-400 text-slate-950",
    features: [
      "Compact hatchbacks & sedans",
      "Air-conditioned city commuting",
      "Affordable per-kilometer rates",
      "Ideal for quick solo & duo trips",
    ],
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
    badgeColor: "bg-slate-950 text-yellow-400 border border-yellow-400/30",
    features: [
      "Spacious premium sedans",
      "Top 5% rated commercial drivers",
      "Extra legroom & quiet ride",
      "Complimentary boot space for bags",
    ],
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
    badgeColor: "bg-emerald-600 text-white",
    features: [
      "Full-size 6-seater SUVs",
      "Large luggage boot capacity",
      "Perfect for airport runs & family trips",
      "Dual-zone AC & child-seat friendly",
    ],
  },
];

const WHY_CHOOSE_ITEMS = [
  {
    icon: ShieldCheck,
    title: "100% Verified Drivers",
    description:
      "Every driver undergoes rigorous police background checks, document verification, and regular vehicle fitness inspections.",
  },
  {
    icon: Zap,
    title: "Guaranteed Upfront Fares",
    description:
      "Never worry about surprise surges or arbitrated meter rates. What our server estimates upfront is exactly what you pay.",
  },
  {
    icon: Clock,
    title: "Quick 3-Minute Pickup",
    description:
      "Our smart dispatch engine connects you with the nearest active driver in your sector for rapid arrival times.",
  },
  {
    icon: CreditCard,
    title: "Flexible Payment Options",
    description:
      "Pay seamlessly online with Razorpay (UPI, Cards, Netbanking) or choose Pay Cash on trip arrival.",
  },
  {
    icon: Compass,
    title: "Real-Time Trip Sync",
    description:
      "Bi-directional WebSocket sync keeps you updated on driver arrival, route progress, and trip completion in real time.",
  },
  {
    icon: PhoneCall,
    title: "24/7 Dedicated Support",
    description:
      "Round-the-clock safety monitoring, one-tap emergency helpline, and dedicated customer resolution teams.",
  },
];

const TESTIMONIALS = [
  {
    name: "Priya Menon",
    role: "Product Manager, Gurgaon",
    comment:
      "SwiftRide is my go-to for daily airport and office runs. The upfront fare calculation and clean sedans make it completely stress-free.",
    rating: 5,
  },
  {
    name: "Aman Kapoor",
    role: "Software Engineer, Bengaluru",
    comment:
      "Booking takes literally 10 seconds. Love the SwiftComfort option when I need a quiet space to take calls between meetings.",
    rating: 5,
  },
  {
    name: "Vikram Singhania",
    role: "Consultant, Mumbai",
    comment:
      "No surprise surge pricing at peak hours. Drivers are punctual, polite, and routes are always optimized.",
    rating: 5,
  },
];

export default function Home() {
  const router = useRouter();

  // Customer authentication state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const [pendingRedirect, setPendingRedirect] = useState<string>("/book-ride");

  // Restore active user session on mount
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        setCurrentUser(getUser());
      }
    } catch {
      // Ignore storage error
    }
  }, []);

  /**
   * Prominent "Book a Ride" Action:
   * - If logged in: navigate immediately to /book-ride (with category if selected)
   * - If not logged in: open the existing login modal; on success redirect to target
   */
  const handleBookRideClick = (categoryRideId?: string) => {
    const target = categoryRideId ? `/book-ride?ride=${categoryRideId}` : "/book-ride";
    if (currentUser || isAuthenticated()) {
      router.push(target);
    } else {
      setPendingRedirect(target);
      setIsAuthModalOpen(true);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-yellow-400 selection:text-slate-950">
      {/* 1. Header / Navbar */}
      <Navbar
        currentPage="home"
        currentUser={currentUser}
        onOpenAuth={() => {
          setPendingRedirect("/book-ride");
          setIsAuthModalOpen(true);
        }}
        onLogout={() => {
          clearAuth();
          setCurrentUser(null);
        }}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        onBookRideClick={() => handleBookRideClick()}
      />

      {/* 2. Modern Hero Section */}
      <section
        id="hero"
        className="relative overflow-hidden bg-gradient-to-b from-white via-amber-50/30 to-slate-50 pt-12 pb-20 sm:pt-16 sm:pb-28 lg:pt-20 lg:pb-32"
      >
        {/* Decorative blur glows */}
        <div className="pointer-events-none absolute -top-40 right-0 h-96 w-96 rounded-full bg-yellow-300/20 blur-3xl" />
        <div className="pointer-events-none absolute top-1/3 -left-32 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left Column: Hero Copy & Main CTA */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3.5 py-1.5 text-xs font-bold text-yellow-900 shadow-sm">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                <span>Fast, Reliable & Modern Cab Booking</span>
                <span className="rounded-full bg-yellow-400/80 px-2 py-0.5 text-[10px] font-extrabold text-slate-950">
                  24/7 Live
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-6xl lg:leading-[1.1]">
                Move freely across your city,{" "}
                <span className="relative whitespace-nowrap text-yellow-500">
                  <span className="relative z-10">on demand.</span>
                  <span
                    className="absolute -bottom-1 left-0 -z-0 h-3 w-full bg-yellow-200/60 rounded"
                    aria-hidden="true"
                  />
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-base text-slate-600 sm:text-lg sm:leading-8">
                Experience seamless urban commuting with guaranteed upfront pricing, verified top-rated drivers, and frictionless digital payments via Razorpay. No surge surprises, just smooth journeys.
              </p>

              {/* Primary Action Buttons */}
              <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
                <button
                  id="book-a-ride-hero-btn"
                  onClick={() => handleBookRideClick()}
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-yellow-400 px-8 py-4 text-base font-extrabold text-slate-950 shadow-xl shadow-yellow-400/25 transition-all hover:bg-yellow-500 hover:shadow-yellow-400/35 active:scale-[0.98]"
                >
                  <span>Book a Ride</span>
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </button>

                <a
                  href="#categories"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Explore Ride Fleet
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </a>
              </div>

              {/* Trust Signals */}
              <div className="mt-10 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-6 sm:grid-cols-4">
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-950 text-lg sm:text-xl">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>4.9 / 5</span>
                  </div>
                  <p className="text-xs text-slate-500">Rider satisfaction</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-950 text-lg sm:text-xl">
                    <Clock className="h-4 w-4 text-yellow-500" />
                    <span>~3 Mins</span>
                  </div>
                  <p className="text-xs text-slate-500">Average pickup ETA</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-950 text-lg sm:text-xl">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span>100%</span>
                  </div>
                  <p className="text-xs text-slate-500">Verified drivers</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-black text-slate-950 text-lg sm:text-xl">
                    <Lock className="h-4 w-4 text-yellow-500" />
                    <span>Secure</span>
                  </div>
                  <p className="text-xs text-slate-500">Razorpay payments</p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive App Preview Showcase Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 text-white shadow-2xl sm:p-7">
                {/* Header of Preview Card */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      SwiftRide Live Fleet
                    </span>
                  </div>
                  <span className="rounded-full bg-yellow-400/10 px-2.5 py-0.5 text-[11px] font-bold text-yellow-400">
                    Active in Delhi NCR
                  </span>
                </div>

                {/* Simulated Trip Route Preview */}
                <div className="my-5 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-emerald-400 ring-4 ring-emerald-950" />
                      <div className="my-1 h-10 w-0.5 border-l-2 border-dashed border-slate-700" />
                      <div className="h-3 w-3 rounded-full bg-yellow-400 ring-4 ring-yellow-950" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Pickup
                        </p>
                        <p className="text-xs font-semibold text-slate-200">
                          Connaught Place, Inner Circle
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Destination
                        </p>
                        <p className="text-xs font-semibold text-slate-200">
                          Indira Gandhi Airport (T3)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-2 text-[11px] text-slate-400">
                    <span>Est. Distance: 16 km</span>
                    <span className="font-semibold text-yellow-400">~28 mins trip</span>
                  </div>
                </div>

                {/* Assigned Top Driver Spotlight */}
                <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-400 font-black text-slate-950 shadow-md">
                        RS
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-white">Rahul Sharma</h4>
                          <span className="flex items-center gap-0.5 rounded bg-yellow-400/20 px-1.5 py-0.2 text-[10px] font-bold text-yellow-400">
                            ★ 4.89
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">White Maruti Dzire (CNG/AC)</p>
                      </div>
                    </div>
                    <span className="rounded-lg bg-slate-800 px-2.5 py-1 font-mono text-[11px] font-bold text-slate-200">
                      DL 01 AB 4291
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900/80 px-3 py-2 text-xs">
                    <span className="text-slate-400">Guaranteed Fare:</span>
                    <span className="font-black text-yellow-400 text-sm">₹416 (Upfront)</span>
                  </div>
                </div>

                {/* Instant CTA inside showcase card */}
                <button
                  id="hero-showcase-book-btn"
                  onClick={() => handleBookRideClick("swift-go")}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3.5 text-xs font-extrabold text-slate-950 shadow-md transition hover:bg-yellow-500 active:scale-[0.98]"
                >
                  <Car className="h-4 w-4" />
                  <span>Book a Ride Now →</span>
                </button>

                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-slate-500">
                  <Lock className="h-3 w-3" />
                  <span>Razorpay 256-bit SSL Test Protection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Ride Categories Section */}
      <section id="categories" className="border-t border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="rounded-full bg-yellow-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-yellow-800">
              Fleet Options
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Choose the perfect ride for every occasion
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              Transparent upfront pricing across compact cars, luxury sedans, and group SUVs. No surprise charges upon drop-off.
            </p>
          </div>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {RIDE_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <div
                  key={cat.id}
                  className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:border-yellow-400 hover:shadow-xl hover:shadow-yellow-400/10"
                >
                  <div>
                    {/* Header with Icon and Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-50 text-slate-950 group-hover:bg-yellow-400 transition-colors">
                        <Icon className="h-7 w-7" />
                      </div>
                      {cat.badge && (
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${cat.badgeColor}`}
                        >
                          {cat.badge}
                        </span>
                      )}
                    </div>

                    <div className="mt-5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-slate-900">{cat.name}</h3>
                        <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          <Users className="h-3 w-3" /> {cat.seats} Seats
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">{cat.tagline}</p>
                    </div>

                    {/* Fare Structure Box */}
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] uppercase font-bold text-slate-400">Base Fare</p>
                          <p className="text-lg font-black text-slate-950">₹{cat.baseFare}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Per Kilometer</p>
                          <p className="text-lg font-black text-yellow-600">₹{cat.perKmRate}/km</p>
                        </div>
                      </div>
                    </div>

                    {/* Features List */}
                    <ul className="mt-5 space-y-2.5">
                      {cat.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2.5 text-xs text-slate-600">
                          <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </div>
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Card Action */}
                  <div className="mt-8 pt-4 border-t border-slate-100">
                    <button
                      id={`book-category-${cat.id}-btn`}
                      onClick={() => handleBookRideClick(cat.id)}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 py-3.5 text-xs font-bold text-white transition hover:bg-yellow-400 hover:text-slate-950 active:scale-[0.99]"
                    >
                      <span>Book {cat.name} Ride</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. How It Works Section */}
      <section id="how-it-works" className="border-t border-slate-200 bg-slate-50 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="rounded-full bg-yellow-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-yellow-800">
              Simple 3-Step Process
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              How SwiftRide Works
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              Booking your daily commute, airport transfer, or weekend getaway takes less than 30 seconds.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {/* Step 1 */}
            <div className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 font-black text-slate-950 shadow-sm text-lg">
                01
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">Enter Your Route</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Specify your exact pickup address and destination or choose from popular airport and tech park presets. Our server immediately maps the route and calculates distance.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 font-black text-yellow-400 shadow-sm text-lg">
                02
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">Choose Fleet & Payment</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Pick SwiftGo, SwiftComfort, or SwiftXL based on your preference. Complete payment securely via Razorpay (Test Mode) or select Pay Cash upon arrival.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 font-black text-slate-950 shadow-sm text-lg">
                03
              </div>
              <h3 className="mt-5 text-lg font-bold text-slate-900">Track & Ride in Comfort</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Get an instant booking reference (`SR-XXXXXX`), follow real-time status updates as your driver arrives, enjoy a smooth ride, and download your tax receipt.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Why Choose SwiftRide Section */}
      <section id="why-choose" className="border-t border-slate-200 bg-slate-950 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <span className="rounded-full bg-slate-800 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-yellow-400">
              The SwiftRide Advantage
            </span>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Engineered for Safety, Reliability & Total Transparency
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">
              From verified background checks to upfront fare locks, see why commuters rely on SwiftRide.
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_CHOOSE_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 transition hover:border-slate-700 hover:bg-slate-900/90"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-slate-950 shadow-md">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{item.description}</p>
                </div>
              );
            })}
          </div>

          {/* Safety Guarantee Highlight Banner */}
          <div className="mt-14 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 p-8 sm:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-8">
                <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Rider Safety & Trust Guarantee</span>
                </div>
                <h3 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                  Every kilometer monitored with complete safety protocols.
                </h3>
                <p className="mt-2 text-xs text-slate-400 sm:text-sm">
                  Over 120,000+ demo kilometers completed across Delhi NCR, Bangalore, and Mumbai with a 4.9★ passenger rating.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  <span className="rounded-full bg-slate-800 px-3 py-1.5">✓ Sanitized Cabs</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1.5">✓ 100% Background Checked</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1.5">✓ 24/7 SOS Helpline</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1.5">✓ Zero Cancellation Penalties</span>
                </div>
              </div>

              <div className="text-left lg:col-span-4 lg:text-right">
                <button
                  onClick={() => handleBookRideClick()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 py-4 text-sm font-extrabold text-slate-950 shadow-lg transition hover:bg-yellow-500 active:scale-95"
                >
                  <Car className="h-4 w-4" />
                  <span>Book Your Next Ride Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Testimonials Section */}
      <section id="reviews" className="border-t border-slate-200 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div>
              <span className="rounded-full bg-yellow-100 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-yellow-800">
                Community Feedback
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                Trusted by daily urban commuters
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-600">
              Verified Passenger Reviews
            </span>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-slate-200/80 bg-slate-50/60 p-6 transition hover:shadow-md"
              >
                <div className="flex items-center gap-1 text-yellow-500">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mt-4 text-xs leading-6 text-slate-700 italic sm:text-sm">
                  &ldquo;{t.comment}&rdquo;
                </p>
                <div className="mt-6 border-t border-slate-200/70 pt-4">
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{t.name}</p>
                  <p className="text-[11px] text-slate-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Bottom High-Impact CTA Banner */}
      <section className="bg-yellow-400 py-16 text-slate-950 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Ready to experience a smoother journey?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold text-slate-900 sm:text-base">
            Join thousands of daily commuters enjoying transparent pricing, instant booking confirmation, and verified drivers.
          </p>
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => handleBookRideClick()}
              className="inline-flex items-center gap-3 rounded-2xl bg-slate-950 px-8 py-4 text-base font-extrabold text-white shadow-xl transition hover:bg-slate-900 hover:scale-105 active:scale-95"
            >
              <span>Book a Ride Now</span>
              <ArrowRight className="h-5 w-5 text-yellow-400" />
            </button>
          </div>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t border-slate-200 bg-white py-12 text-slate-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-yellow-400">
                  <Car className="h-4 w-4" />
                </div>
                <span className="text-xl font-black text-slate-950">
                  Swift<span className="text-yellow-500">Ride</span>
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Modern, reliable, and transparent cab booking platform engineered with Next.js, Express, and Razorpay Test Mode.
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Ride Fleet</h4>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <a href="#categories" className="hover:text-slate-900">
                    SwiftGo City Cabs
                  </a>
                </li>
                <li>
                  <a href="#categories" className="hover:text-slate-900">
                    SwiftComfort Sedans
                  </a>
                </li>
                <li>
                  <a href="#categories" className="hover:text-slate-900">
                    SwiftXL Group SUVs
                  </a>
                </li>
                <li>
                  <button onClick={() => handleBookRideClick("swift-comfort")} className="hover:text-slate-900 text-left">
                    Airport Transfers
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">Company & Safety</h4>
              <ul className="mt-3 space-y-2 text-xs">
                <li>
                  <a href="#why-choose" className="hover:text-slate-900">
                    Why SwiftRide
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-slate-900">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#reviews" className="hover:text-slate-900">
                    Passenger Reviews
                  </a>
                </li>
                <li>
                  <button onClick={() => setIsFeedbackOpen(true)} className="hover:text-slate-900 text-left">
                    Send App Feedback
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Payment & Security
              </h4>
              <div className="mt-3 space-y-2 text-xs">
                <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 font-semibold text-emerald-800">
                  Razorpay Test Mode Ready
                </span>
                <p className="text-[11px] text-slate-500">
                  Supports online payments via official Razorpay SDK & Pay Cash demo option.
                </p>
                <p className="text-[11px] text-slate-400">Support: support@swiftride.demo</p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>© 2026 SwiftRide Technologies India Pvt. Ltd. All rights reserved.</p>
            <p className="mt-2 sm:mt-0">Full-Stack Cab Booking Platform · Razorpay Test Integration</p>
          </div>
        </div>
      </footer>

      {/* Authentication Modal (Handles Login & Register with auto-redirect to /book-ride) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(u) => {
          setCurrentUser(u);
          setIsAuthModalOpen(false);
          router.push(pendingRedirect || "/book-ride");
        }}
      />

      {/* Customer App Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />
    </main>
  );
}