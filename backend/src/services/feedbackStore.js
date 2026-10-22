const fs = require("fs");
const path = require("path");
const { getSupabaseClient, isSupabaseConfigured } = require("../config/supabase");

/**
 * SwiftRide Dual-Engine Customer Feedback Store
 * Stores app experience, bug reports, and suggestions.
 * 1. Primary: Supabase 'customer_feedback' table (when configured)
 * 2. Fallback: Local persistent storage 'backend/data/feedback.json'
 */

const DATA_DIR = path.join(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "feedback.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class FeedbackStore {
  constructor() {
    this.feedbacks = new Map();
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((item) => {
            if (item && item.id) {
              this.feedbacks.set(item.id, item);
            }
          });
        }
      }
    } catch (err) {
      console.warn("[FeedbackStore] Failed to load local storage:", err.message);
    }
  }

  saveToDisk() {
    try {
      const list = Array.from(this.feedbacks.values());
      fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.warn("[FeedbackStore] Failed to write to local storage:", err.message);
    }
  }

  generateTicketId() {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    return `FB-${randomDigits}`;
  }

  async addFeedback({
    userId = null,
    category,
    rating,
    subject,
    message,
    contactEmail = null,
  }) {
    const validCategories = [
      "GENERAL",
      "BUG_REPORT",
      "FEATURE_REQUEST",
      "PAYMENT",
      "DRIVER_EXPERIENCE",
    ];

    const normalizedCategory = category ? category.toString().toUpperCase() : "GENERAL";

    if (!validCategories.includes(normalizedCategory)) {
      const error = new Error(
        `Invalid feedback category. Allowed categories: ${validCategories.join(", ")}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      const error = new Error("Rating must be an integer between 1 and 5.");
      error.statusCode = 400;
      throw error;
    }

    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      const error = new Error("Subject must be at least 3 characters long.");
      error.statusCode = 400;
      throw error;
    }

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      const error = new Error("Message must be at least 5 characters long.");
      error.statusCode = 400;
      throw error;
    }

    const ticketId = this.generateTicketId();
    const now = new Date().toISOString();

    const newFeedback = {
      id: ticketId,
      ticketId,
      userId: userId || null,
      category: normalizedCategory,
      rating: numRating,
      subject: subject.trim(),
      message: message.trim(),
      contactEmail: contactEmail ? contactEmail.trim().toLowerCase() : null,
      createdAt: now,
    };

    // 1. In-memory and local disk
    this.feedbacks.set(ticketId, newFeedback);
    this.saveToDisk();

    // 2. Supabase if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.from("customer_feedback").insert([
            {
              user_id: newFeedback.userId,
              category: newFeedback.category,
              rating: newFeedback.rating,
              subject: newFeedback.subject,
              message: newFeedback.message,
              contact_email: newFeedback.contactEmail,
            },
          ]);
        }
      } catch (err) {
        console.warn("[Supabase] Error saving feedback to Supabase:", err.message);
      }
    }

    return newFeedback;
  }

  async listFeedback() {
    return Array.from(this.feedbacks.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }
}

module.exports = new FeedbackStore();
