"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  User as UserIcon,
  LogOut,
  MessageSquare,
  Menu,
  X,
  ArrowRight,
  Shield,
} from "lucide-react";
import { UserProfile } from "../utils/auth";

interface NavbarProps {
  currentPage: "home" | "book-ride" | "dashboard";
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenFeedback: () => void;
  onBookRideClick?: () => void;
}

export default function Navbar({
  currentPage,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenFeedback,
  onBookRideClick,
}: NavbarProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleBookClick = () => {
    setMobileMenuOpen(false);
    if (onBookRideClick) {
      onBookRideClick();
    } else {
      router.push("/book-ride");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-yellow-400 shadow-sm transition group-hover:scale-105">
              <Car className="h-5 w-5" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-950">
              Swift<span className="text-yellow-500">Ride</span>
            </span>
          </Link>
          <span className="hidden rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 lg:inline-block">
            Razorpay Test Mode
          </span>
        </div>

        {/* Center: Simplified, focused navigation links */}
        <nav className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
          {currentPage === "home" ? (
            <>
              <a href="#categories" className="transition hover:text-slate-950">
                Fleet
              </a>
              <a href="#how-it-works" className="transition hover:text-slate-950">
                How It Works
              </a>
              <a href="#why-choose" className="transition hover:text-slate-950">
                Why SwiftRide
              </a>
              <a href="#reviews" className="transition hover:text-slate-950">
                Reviews
              </a>
            </>
          ) : (
            <>
              <Link href="/" className="transition hover:text-slate-950">
                Home
              </Link>
              <Link href="/#categories" className="transition hover:text-slate-950">
                Ride Fleet
              </Link>
              <Link href="/#how-it-works" className="transition hover:text-slate-950">
                How It Works
              </Link>
            </>
          )}

          {/* Customer Dashboard link if authenticated */}
          {currentUser && currentPage !== "dashboard" && (
            <Link href="/dashboard" className="transition hover:text-slate-950">
              My Trips
            </Link>
          )}
        </nav>

        {/* Right: Actions, Driver Role, Auth & Primary CTA */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Feedback button */}
          <button
            onClick={onOpenFeedback}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            title="Send Feedback"
          >
            <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
            <span>Feedback</span>
          </button>

          {/* Driver Mode switch - clearly separated role link */}
          <Link
            id="nav-driver-portal-btn"
            href="/driver"
            className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Driver Portal
          </Link>

          {/* User state */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <Link
                id="nav-user-dashboard-link"
                href="/dashboard"
                className="flex items-center gap-2 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-900 transition hover:bg-yellow-100"
                title="Open Customer Dashboard"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-[10px] font-black text-slate-950">
                  {currentUser.fullName ? currentUser.fullName[0].toUpperCase() : "U"}
                </div>
                <span className="max-w-[120px] truncate">{currentUser.fullName}</span>
              </Link>
              <button
                id="nav-logout-btn"
                onClick={onLogout}
                className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-700"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              id="nav-signin-btn"
              onClick={onOpenAuth}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              Sign In
            </button>
          )}

          {/* Primary CTA (Shown on Home and Dashboard, omitted on Book-Ride page where form is already present) */}
          {currentPage !== "book-ride" && (
            <button
              id="nav-book-ride-cta"
              onClick={handleBookClick}
              className="flex items-center gap-1.5 rounded-full bg-yellow-400 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-sm transition hover:bg-yellow-500 active:scale-95"
            >
              <span>Book a Ride</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex items-center gap-2 md:hidden">
          {currentPage !== "book-ride" && (
            <button
              onClick={handleBookClick}
              className="rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-sm"
            >
              Book Ride
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden animate-in slide-in-from-top-2">
          <nav className="flex flex-col space-y-3 text-sm font-semibold text-slate-700">
            {currentPage === "home" ? (
              <>
                <a
                  href="#categories"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-slate-950"
                >
                  Ride Fleet
                </a>
                <a
                  href="#how-it-works"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-slate-950"
                >
                  How It Works
                </a>
                <a
                  href="#why-choose"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-slate-950"
                >
                  Why SwiftRide
                </a>
                <a
                  href="#reviews"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-slate-950"
                >
                  Reviews
                </a>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-slate-950"
                >
                  Home
                </Link>
                <Link
                  href="/#categories"
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-1 hover:text-slate-950"
                >
                  Ride Fleet
                </Link>
              </>
            )}

            {currentUser ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-2 py-1 font-bold text-slate-900"
                >
                  <UserIcon className="h-4 w-4 text-yellow-600" />
                  <span>My Account ({currentUser.fullName})</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="flex items-center gap-2 py-1 text-left text-rose-600 font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenAuth();
                }}
                className="flex items-center gap-2 py-1 text-left text-slate-900 font-bold"
              >
                <UserIcon className="h-4 w-4 text-yellow-600" />
                <span>Sign In / Register</span>
              </button>
            )}

            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href="/driver"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span>Switch to Driver Portal</span>
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenFeedback();
                }}
                className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                <span>Submit Feedback</span>
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
