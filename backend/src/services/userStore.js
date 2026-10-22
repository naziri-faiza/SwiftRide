const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getSupabaseClient, isSupabaseConfigured } = require("../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, ...safe } = user;
  return safe;
}

class UserStore {
  constructor() {
    this.users = new Map();
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const raw = fs.readFileSync(USERS_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((u) => {
            if (u && u.id && u.email) {
              this.users.set(u.id, u);
            }
          });
        }
      }
    } catch (err) {
      console.warn("[UserStore] Failed to load local users storage:", err.message);
    }
  }

  saveToDisk() {
    try {
      const list = Array.from(this.users.values());
      fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.warn("[UserStore] Failed to save local users storage:", err.message);
    }
  }

  async createUser({ email, password, fullName, phone, role = "rider" }) {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already registered
    const existing = await this.getUserByEmail(normalizedEmail);
    if (existing) {
      const error = new Error("An account with this email address already exists.");
      error.statusCode = 409;
      throw error;
    }

    const userId = crypto.randomUUID();
    const passwordSalt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, passwordSalt);
    const now = new Date().toISOString();

    const newUser = {
      id: userId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      phone: phone ? phone.trim() : "",
      role: role || "rider",
      passwordHash,
      passwordSalt,
      createdAt: now,
      updatedAt: now,
    };

    // 1. In-memory & Local Disk save
    this.users.set(userId, newUser);
    this.saveToDisk();

    // 2. Supabase profiles sync if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase.from("profiles").insert([
            {
              id: userId,
              email: normalizedEmail,
              full_name: newUser.fullName,
              phone: newUser.phone,
              role: newUser.role,
              created_at: now,
              updated_at: now,
            },
          ]);
        }
      } catch (err) {
        console.warn("[Supabase] Notice when saving profile to Supabase:", err.message);
      }
    }

    return sanitizeUser(newUser);
  }

  async authenticateUser(email, password) {
    const normalizedEmail = email.trim().toLowerCase();
    let foundUser = null;

    for (const u of this.users.values()) {
      if (u.email === normalizedEmail) {
        foundUser = u;
        break;
      }
    }

    // If not found in local store and Supabase configured, check Supabase profiles
    if (!foundUser && isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", normalizedEmail)
            .single();

          if (data) {
            // Note: If user was created via Supabase Auth directly
            foundUser = {
              id: data.id,
              email: data.email,
              fullName: data.full_name,
              phone: data.phone,
              role: data.role,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            };
          }
        }
      } catch (err) {
        console.warn("[Supabase] Check user profile notice:", err.message);
      }
    }

    if (!foundUser || !foundUser.passwordHash || !foundUser.passwordSalt) {
      const error = new Error("Invalid email or password.");
      error.statusCode = 401;
      throw error;
    }

    const calculatedHash = hashPassword(password, foundUser.passwordSalt);
    if (calculatedHash !== foundUser.passwordHash) {
      const error = new Error("Invalid email or password.");
      error.statusCode = 401;
      throw error;
    }

    return sanitizeUser(foundUser);
  }

  async getUserById(id) {
    if (!id) return null;
    const user = this.users.get(id);
    if (user) {
      return sanitizeUser(user);
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", id)
            .single();

          if (data) {
            return {
              id: data.id,
              email: data.email,
              fullName: data.full_name,
              phone: data.phone,
              role: data.role,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            };
          }
        }
      } catch (err) {
        console.warn("[Supabase] Get profile notice:", err.message);
      }
    }

    return null;
  }

  async getUserByEmail(email) {
    if (!email) return null;
    const normalized = email.trim().toLowerCase();
    for (const u of this.users.values()) {
      if (u.email === normalized) {
        return sanitizeUser(u);
      }
    }

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", normalized)
            .single();

          if (data) {
            return {
              id: data.id,
              email: data.email,
              fullName: data.full_name,
              phone: data.phone,
              role: data.role,
              createdAt: data.created_at,
              updatedAt: data.updated_at,
            };
          }
        }
      } catch (err) {
        console.warn("[Supabase] Find profile notice:", err.message);
      }
    }

    return null;
  }

  async updateUserProfile(id, { fullName, phone }) {
    const user = this.users.get(id);
    if (!user) {
      const error = new Error("User profile not found.");
      error.statusCode = 404;
      throw error;
    }

    if (fullName && typeof fullName === "string" && fullName.trim()) {
      user.fullName = fullName.trim();
    }
    if (phone !== undefined) {
      user.phone = phone.trim();
    }
    user.updatedAt = new Date().toISOString();

    this.users.set(id, user);
    this.saveToDisk();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          await supabase
            .from("profiles")
            .update({
              full_name: user.fullName,
              phone: user.phone,
              updated_at: user.updatedAt,
            })
            .eq("id", id);
        }
      } catch (err) {
        console.warn("[Supabase] Update profile notice:", err.message);
      }
    }

    return sanitizeUser(user);
  }
}

module.exports = new UserStore();
