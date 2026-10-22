"use client";

import { useState } from "react";
import { X, Mail, Lock, User, Phone, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { setToken, setUser, UserProfile } from "../utils/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
  initialMode?: "login" | "register";
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  initialMode = "login",
}: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === "register" && !fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "register"
          ? { email: email.trim(), password, fullName: fullName.trim(), phone: phone.trim() }
          : { email: email.trim(), password };

      const res = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Authentication failed. Please check your details.");
      }

      // Save token and profile to localStorage
      setToken(data.token);
      setUser(data.user);

      setSuccessMsg(data.message || (mode === "register" ? "Account created!" : "Signed in!"));

      setTimeout(() => {
        setIsLoading(false);
        onSuccess(data.user);
        onClose();
      }, 700);
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(err instanceof Error ? err.message : "Network error. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
        {/* Header Bar */}
        <div className="bg-slate-950 px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight">
                Swift<span className="text-yellow-400">Ride</span> Account
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === "login"
                  ? "Sign in to manage your rides and booking history"
                  : "Create your rider account in seconds"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="mt-4 flex rounded-xl bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                mode === "login"
                  ? "bg-yellow-400 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMsg(null);
              }}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
                mode === "register"
                  ? "bg-yellow-400 text-slate-950 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Create Account
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs font-medium text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === "register" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rider@example.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
              />
            </div>
          </div>

          {mode === "register" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Password {mode === "register" && <span className="text-slate-400 font-normal">(min 6 chars)</span>}
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-yellow-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-yellow-400/20"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-yellow-400 py-3 text-sm font-bold text-slate-950 shadow-md transition hover:bg-yellow-300 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>{mode === "login" ? "Signing In..." : "Creating Account..."}</span>
              </>
            ) : mode === "login" ? (
              "Sign In to SwiftRide"
            ) : (
              "Complete Registration"
            )}
          </button>

          <div className="pt-2 text-center text-xs text-slate-500">
            {mode === "login" ? (
              <p>
                Don&apos;t have an account yet?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMsg(null);
                  }}
                  className="font-bold text-slate-900 underline hover:text-yellow-600"
                >
                  Create one now
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg(null);
                  }}
                  className="font-bold text-slate-900 underline hover:text-yellow-600"
                >
                  Sign in instead
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
