"use client";

import { useState } from "react";
import { Star, Shield, Car, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { getToken } from "../utils/auth";

interface ReviewModalProps {
  isOpen: boolean;
  ride: {
    referenceId: string;
    rideName: string;
    pickup: string;
    destination: string;
    totalFare: number;
    driver?: {
      name: string;
      car: string;
      plate: string;
      rating: number;
    };
  } | null;
  onClose: () => void;
  onSuccess: (review: any) => void;
}

const REVIEW_TAGS = [
  "Safe & Smooth Driving",
  "Clean & Sanitized Cab",
  "Polite & Professional",
  "Punctual Pickup",
  "Great AC & Music",
  "Comfortable Ride",
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function ReviewModal({
  isOpen,
  ride,
  onClose,
  onSuccess,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !ride) return null;

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const token = getToken();
    if (!token) {
      setErrorMessage("Please sign in to submit a driver review.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_URL}/api/customer/rides/${ride?.referenceId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          comment: comment.trim(),
          tags: selectedTags,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to submit driver review.");
      }

      onSuccess(data.review);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error submitting review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-slate-950 font-black">
              ★
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Rate &amp; Review Your Driver</h3>
              <p className="text-[11px] text-slate-400">Booking Reference: {ride.referenceId}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Driver Summary Card */}
        <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-slate-950 font-black text-lg shadow-sm">
              {ride.driver?.name
                ? ride.driver.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "DR"}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">{ride.driver?.name || "Rahul Sharma"}</h4>
              <p className="text-xs text-slate-500">{ride.driver?.car || "Maruti Dzire (CNG/AC)"}</p>
              <p className="font-mono text-[10px] text-slate-400 mt-0.5">{ride.driver?.plate || "DL 01 AB 4291"}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Fare</span>
            <p className="text-base font-black text-yellow-600">₹{ride.totalFare}</p>
          </div>
        </div>

        {/* Review Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Star Rating Interactive */}
          <div className="text-center py-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
              How was your trip with {ride.driver?.name?.split(" ")[0] || "your driver"}?
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="p-1 hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        active
                          ? "fill-yellow-400 text-yellow-400 drop-shadow"
                          : "text-slate-300 fill-transparent"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-bold text-slate-700 mt-1">
              {rating === 5
                ? "⭐⭐⭐⭐⭐ Outstanding Experience!"
                : rating === 4
                ? "⭐⭐⭐⭐ Very Good"
                : rating === 3
                ? "⭐⭐⭐ Average Trip"
                : rating === 2
                ? "⭐⭐ Needs Improvement"
                : "⭐ Poor"}
            </p>
          </div>

          {/* Compliments / Tags */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Compliments (Select all that apply)
            </label>
            <div className="flex flex-wrap gap-2">
              {REVIEW_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition border ${
                      isSelected
                        ? "bg-yellow-400 text-slate-950 border-yellow-500 font-bold shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Written Review */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
              Written Review (Optional)
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share details about the driving, vehicle condition, or route..."
              className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 p-3 text-xs text-slate-900 outline-none focus:bg-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100 transition resize-none"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-2xl bg-yellow-400 px-6 py-2.5 text-xs font-bold text-slate-950 shadow hover:bg-yellow-300 transition active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Review →</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
