"use client";

import { useState } from "react";
import { Star, MessageSquare, CheckCircle2, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { getToken, getUser } from "../utils/auth";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const CATEGORIES = [
  { id: "GENERAL", label: "General Feedback" },
  { id: "BUG_REPORT", label: "Bug Report" },
  { id: "FEATURE_REQUEST", label: "Feature Suggestion" },
  { id: "PAYMENT", label: "Payment Issue" },
  { id: "DRIVER_EXPERIENCE", label: "Driver Experience" },
];

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export default function FeedbackModal({ isOpen, onClose, onSuccess }: FeedbackModalProps) {
  const currentUser = typeof window !== "undefined" ? getUser() : null;
  const token = typeof window !== "undefined" ? getToken() : null;

  const [category, setCategory] = useState("GENERAL");
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState(currentUser?.email || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedTicket, setSubmittedTicket] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (subject.trim().length < 3) {
      setErrorMessage("Please enter a subject of at least 3 characters.");
      return;
    }
    if (message.trim().length < 5) {
      setErrorMessage("Please enter detailed feedback of at least 5 characters.");
      return;
    }

    setIsSubmitting(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          category,
          rating,
          subject: subject.trim(),
          message: message.trim(),
          contactEmail: contactEmail.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to submit feedback.");
      }

      setSubmittedTicket(data.feedback?.id || "FB-CONFIRMED");
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error submitting feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setCategory("GENERAL");
    setRating(5);
    setSubject("");
    setMessage("");
    setErrorMessage(null);
    setSubmittedTicket(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="bg-slate-950 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-slate-950">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">App Feedback &amp; Suggestions</h3>
              <p className="text-[11px] text-slate-400">Help us make SwiftRide better for everyone</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {submittedTicket ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div>
              <h4 className="text-xl font-black text-slate-900">Thank You for Your Feedback!</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Your suggestion has been logged under ticket reference:
              </p>
              <div className="mt-2 inline-block rounded-xl bg-slate-100 px-4 py-1.5 font-mono text-base font-black text-yellow-600">
                {submittedTicket}
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
              Our engineering and operations team reviews every submission to enhance the SwiftRide platform.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="w-full rounded-2xl bg-slate-950 py-3.5 text-xs font-bold text-white hover:bg-slate-800 shadow transition"
              >
                Close &amp; Continue
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Category Select */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Feedback Category
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition border ${
                      category === cat.id
                        ? "bg-slate-950 text-yellow-400 border-slate-950 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Star Rating */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Overall Experience Rating
              </label>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 text-slate-300 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          active
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-slate-300 fill-transparent"
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-xs font-bold text-slate-600">
                  {rating === 5
                    ? "Excellent"
                    : rating === 4
                    ? "Good"
                    : rating === 3
                    ? "Average"
                    : rating === 2
                    ? "Below Average"
                    : "Poor"}
                </span>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Map route clarity, instant driver response"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100 transition"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Your Feedback &amp; Suggestions
              </label>
              <textarea
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you liked or what we can improve..."
                className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 p-3.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100 transition resize-none"
              />
            </div>

            {/* Optional Email */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Contact Email (Optional for Follow-up)
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full rounded-2xl border border-slate-300 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-yellow-500 focus:ring-2 focus:ring-yellow-100 transition"
              />
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleReset}
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
                  <span>Send Feedback →</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
