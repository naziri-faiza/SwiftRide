const fs = require("fs");
const path = require("path");
const { getSupabaseClient, isSupabaseConfigured } = require("../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const DRIVERS_FILE = path.join(DATA_DIR, "drivers.json");

const SEED_DRIVERS = [
  {
    id: "d1111111-1111-1111-1111-111111111111",
    driverCode: "DRV-RAHUL",
    name: "Rahul Sharma",
    email: "rahul.driver@swiftride.io",
    phone: "+91 98765 43210",
    car: "White Maruti Dzire (CNG/AC)",
    plate: "DL 01 AB 4291",
    vehicleType: "swift-go",
    rating: 4.89,
    totalTrips: 142,
    isAvailable: true,
    etaMins: 3,
  },
  {
    id: "d2222222-2222-2222-2222-222222222222",
    driverCode: "DRV-VIKRAM",
    name: "Vikram Singh",
    email: "vikram.driver@swiftride.io",
    phone: "+91 98111 22334",
    car: "Hyundai Aura Sedan (AC)",
    plate: "DL 03 XY 8812",
    vehicleType: "swift-comfort",
    rating: 4.95,
    totalTrips: 218,
    isAvailable: true,
    etaMins: 4,
  },
  {
    id: "d3333333-3333-3333-3333-333333333333",
    driverCode: "DRV-MANPREET",
    name: "Manpreet Kaur",
    email: "manpreet.driver@swiftride.io",
    phone: "+91 99887 76655",
    car: "Toyota Innova Crysta (6 Seater)",
    plate: "DL 08 CD 5543",
    vehicleType: "swift-xl",
    rating: 4.92,
    totalTrips: 305,
    isAvailable: true,
    etaMins: 6,
  },
];

class DriverStore {
  constructor() {
    this.drivers = new Map();
    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(DRIVERS_FILE)) {
        const raw = fs.readFileSync(DRIVERS_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          list.forEach((d) => this.drivers.set(d.id, d));
          return;
        }
      }
    } catch (err) {
      console.warn("[DriverStore] Notice loading local drivers:", err.message);
    }

    // Default seed
    SEED_DRIVERS.forEach((d) => this.drivers.set(d.id, { ...d }));
    this.saveToDisk();
  }

  saveToDisk() {
    try {
      const list = Array.from(this.drivers.values());
      fs.writeFileSync(DRIVERS_FILE, JSON.stringify(list, null, 2), "utf-8");
    } catch (err) {
      console.warn("[DriverStore] Notice saving local drivers:", err.message);
    }
  }

  async listDrivers() {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data, error } = await supabase.from("drivers").select("*");
          if (!error && Array.isArray(data) && data.length > 0) {
            return data.map((d) => ({
              id: d.id,
              name: d.name,
              email: d.phone ? `${d.name.toLowerCase().split(" ")[0]}.driver@swiftride.io` : "",
              phone: d.phone,
              car: d.car,
              plate: d.plate,
              vehicleType: d.vehicle_type,
              rating: Number(d.rating),
              isAvailable: Boolean(d.is_available),
              etaMins: d.eta_mins || 3,
            }));
          }
        }
      } catch (err) {
        console.warn("[Supabase] Get drivers notice:", err.message);
      }
    }

    return Array.from(this.drivers.values());
  }

  getDriverById(id) {
    if (!id) return null;
    return this.drivers.get(id) || null;
  }

  getDriverByCodeOrEmail(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    for (const d of this.drivers.values()) {
      if (
        d.id.toLowerCase() === clean ||
        d.driverCode.toLowerCase() === clean ||
        d.email.toLowerCase() === clean ||
        d.name.toLowerCase() === clean
      ) {
        return d;
      }
    }
    return null;
  }

  setAvailability(id, isAvailable) {
    const driver = this.drivers.get(id);
    if (!driver) return null;
    driver.isAvailable = Boolean(isAvailable);
    this.drivers.set(id, driver);
    this.saveToDisk();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase
            .from("drivers")
            .update({ is_available: driver.isAvailable })
            .eq("id", id)
            .then(() => {});
        }
      } catch (err) {
        console.warn("[Supabase] Update driver availability notice:", err.message);
      }
    }

    return driver;
  }

  incrementTrip(id) {
    const driver = this.drivers.get(id);
    if (!driver) return;
    driver.totalTrips = (driver.totalTrips || 0) + 1;
    this.drivers.set(id, driver);
    this.saveToDisk();
  }

  updateDriverRating(id, newRating) {
    const driver = this.drivers.get(id);
    if (!driver) return;
    const currentRating = driver.rating || 4.85;
    const currentTrips = driver.totalTrips || 10;
    const updated = ((currentRating * currentTrips) + Number(newRating)) / (currentTrips + 1);
    driver.rating = Number(updated.toFixed(2));
    this.drivers.set(id, driver);
    this.saveToDisk();

    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          supabase.from("drivers").update({ rating: driver.rating }).eq("id", id).then(() => {});
        }
      } catch (err) {
        console.warn("[Supabase] Update driver rating notice:", err.message);
      }
    }
  }
}

module.exports = new DriverStore();
