"use client";

import { useState, useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import {
  Compass,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  Loader2,
  Car,
  Navigation,
  MapPin,
  Sparkles,
} from "lucide-react";

interface RouteMapProps {
  pickup: string;
  destination: string;
  rideStatus?: string;
  driver?: {
    name?: string;
    car?: string;
    plate?: string;
    etaMins?: number;
  } | null;
  className?: string;
}

interface LatLng {
  lat: number;
  lng: number;
  label: string;
}

// Known coordinates in Delhi NCR for demo routes & quick presets
const KNOWN_COORDS: Record<string, LatLng> = {
  cp: { lat: 28.6315, lng: 77.2167, label: "Connaught Place, Central Delhi" },
  airport: { lat: 28.5562, lng: 77.1000, label: "IGI Airport T3, New Delhi" },
  cybercity: { lat: 28.4950, lng: 77.0895, label: "DLF Cyber City, Gurugram" },
  hauzkhas: { lat: 28.5535, lng: 77.1945, label: "Hauz Khas Village, South Delhi" },
  noida: { lat: 28.6280, lng: 77.3649, label: "Noida Sector 62" },
  saket: { lat: 28.5283, lng: 77.2191, label: "Select Citywalk, Saket" },
  indiagate: { lat: 28.6129, lng: 77.2295, label: "India Gate, New Delhi" },
  gurgaon: { lat: 28.4595, lng: 77.0266, label: "Gurugram Central" },
};

function resolveLatLng(query: string, isDestination = false): LatLng {
  const q = (query || "").toLowerCase().trim();
  if (q.includes("connaught") || q.includes("cp") || q.includes("inner circle")) return KNOWN_COORDS.cp;
  if (q.includes("airport") || q.includes("t3") || q.includes("igi")) return KNOWN_COORDS.airport;
  if (q.includes("cyber") || q.includes("dlf") || q.includes("gurugram") || q.includes("gurgaon")) return KNOWN_COORDS.cybercity;
  if (q.includes("hauz") || q.includes("khas")) return KNOWN_COORDS.hauzkhas;
  if (q.includes("noida") || q.includes("62")) return KNOWN_COORDS.noida;
  if (q.includes("saket") || q.includes("citywalk")) return KNOWN_COORDS.saket;
  if (q.includes("india gate")) return KNOWN_COORDS.indiagate;

  // Deterministic fallback inside Delhi NCR bounding box
  let hash = 0;
  for (let i = 0; i < q.length; i++) {
    hash = (hash << 5) - hash + q.charCodeAt(i);
  }
  const posHash = Math.abs(hash);
  const latOffset = ((posHash % 120) / 1000) * (isDestination ? -1 : 1);
  const lngOffset = (((posHash >> 2) % 150) / 1000) * (isDestination ? 1 : -1);

  return {
    lat: isDestination ? 28.5355 + latOffset : 28.6250 + latOffset,
    lng: isDestination ? 77.2150 + lngOffset : 77.1850 + lngOffset,
    label: query || (isDestination ? "Drop-off Location" : "Pickup Location"),
  };
}

// Great-circle distance helper in km
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return +(R * c).toFixed(1);
}

// Free OSRM Public Routing API with fallback
async function fetchOsrmRoute(
  start: LatLng,
  end: LatLng
): Promise<{ coordinates: [number, number][]; distanceKm: number; durationMins: number; isOsrm: boolean }> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM returns [longitude, latitude], Leaflet needs [latitude, longitude]
        const coords: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );
        const distanceKm = +(route.distance / 1000).toFixed(1);
        const durationMins = Math.max(1, Math.round(route.duration / 60));
        return { coordinates: coords, distanceKm, durationMins, isOsrm: true };
      }
    }
  } catch (err) {
    console.info("Using direct route geometry fallback:", err);
  }

  // Graceful fallback: generate curved line with intermediate points
  const steps = 12;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const arc = Math.sin(t * Math.PI) * 0.015;
    const lat = start.lat + (end.lat - start.lat) * t + arc;
    const lng = start.lng + (end.lng - start.lng) * t - arc * 0.6;
    coords.push([lat, lng]);
  }

  const directDist = calculateHaversineDistance(start.lat, start.lng, end.lat, end.lng);
  const estDist = +(directDist * 1.3).toFixed(1);
  const estMins = Math.max(5, Math.round((estDist / 25) * 60));

  return { coordinates: coords, distanceKm: estDist, durationMins: estMins, isOsrm: false };
}

export default function RouteMap({
  pickup,
  destination,
  rideStatus = "REQUESTED",
  driver,
  className = "",
}: RouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{
    pickup?: any;
    drop?: any;
    driver?: any;
    routeLine?: any;
    tileLayer?: any;
  }>({});

  // Default to standard OpenStreetMap tiles (never requires an API key or external credentials)
  const [mapTheme, setMapTheme] = useState<"standard" | "dark">("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [routeInfo, setRouteInfo] = useState<{
    distanceKm: number;
    durationMins: number;
    isOsrm: boolean;
  }>({ distanceKm: 8.5, durationMins: 18, isOsrm: false });
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [driverProgress, setDriverProgress] = useState(0.2);
  const routeCoordsRef = useRef<[number, number][]>([]);

  // Driver animated progress along the route
  useEffect(() => {
    if (["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(rideStatus)) {
      const interval = setInterval(() => {
        setDriverProgress((prev) => {
          if (rideStatus === "IN_PROGRESS") {
            return prev >= 0.95 ? 0.95 : prev + 0.03;
          }
          return prev >= 0.85 ? 0.85 : prev + 0.02;
        });
      }, 1500);
      return () => clearInterval(interval);
    } else if (rideStatus === "COMPLETED") {
      setDriverProgress(1.0);
    } else {
      setDriverProgress(0.15);
    }
  }, [rideStatus]);

  // Main Leaflet Map Initialization & Route Drawing
  useEffect(() => {
    let isCancelled = false;

    async function setupMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      setIsLoading(true);

      const L = (await import("leaflet")).default;
      if (isCancelled) return;

      const pCoords = resolveLatLng(pickup, false);
      const dCoords = resolveLatLng(destination, true);

      // Fetch road route via free OSRM or fallback
      const routeData = await fetchOsrmRoute(pCoords, dCoords);
      if (isCancelled) return;

      setRouteInfo({
        distanceKm: routeData.distanceKm,
        durationMins: routeData.durationMins,
        isOsrm: routeData.isOsrm,
      });
      routeCoordsRef.current = routeData.coordinates;

      // 1. Initialize Leaflet Map if not already created
      if (!mapInstanceRef.current) {
        const container = mapContainerRef.current;
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        const map = L.map(container, {
          zoomControl: false,
          attributionControl: false, // Attribution rendered cleanly in bottom status bar
        }).setView([pCoords.lat, pCoords.lng], 13);

        mapInstanceRef.current = map;

        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 150);
      }

      const map = mapInstanceRef.current;

      // 2. Set Up Official OpenStreetMap Tile Layer (100% Free, NO API Keys)
      if (markersRef.current.tileLayer) {
        map.removeLayer(markersRef.current.tileLayer);
      }

      // Always use the official OpenStreetMap tile server (no third-party key requirement)
      const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
        className: mapTheme === "dark" ? "osm-dark-tiles" : "osm-standard-tiles",
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      });
      tileLayer.addTo(map);
      markersRef.current.tileLayer = tileLayer;

      // 3. Pickup Marker (Green Pin with custom L.divIcon)
      if (markersRef.current.pickup) {
        map.removeLayer(markersRef.current.pickup);
      }
      const pickupIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:#059669; color:#ffffff; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.5); white-space:nowrap; margin-bottom:3px; border:1px solid #34d399; font-family:system-ui,sans-serif;">
              ● ${pickup ? pickup.split(",")[0] : "Pickup"}
            </div>
            <div style="width:28px; height:28px; border-radius:50%; background:#10b981; color:#ffffff; display:flex; align-items:center; justify-content:center; box-shadow:0 0 16px rgba(16,185,129,0.8); border:2.5px solid #ffffff;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const pickupMarker = L.marker([pCoords.lat, pCoords.lng], { icon: pickupIcon }).addTo(map);
      markersRef.current.pickup = pickupMarker;

      // 4. Drop-off Marker (Yellow Pin with custom L.divIcon)
      if (markersRef.current.drop) {
        map.removeLayer(markersRef.current.drop);
      }
      const dropIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:#0f172a; color:#facc15; font-size:10px; font-weight:800; padding:2px 8px; border-radius:6px; box-shadow:0 4px 12px rgba(0,0,0,0.6); white-space:nowrap; margin-bottom:3px; border:1px solid #facc15; font-family:system-ui,sans-serif;">
              🏁 ${destination ? destination.split(",")[0] : "Drop-off"}
            </div>
            <div style="width:28px; height:28px; border-radius:50%; background:#0f172a; color:#facc15; display:flex; align-items:center; justify-content:center; box-shadow:0 0 16px rgba(250,204,21,0.6); border:2.5px solid #facc15;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      const dropMarker = L.marker([dCoords.lat, dCoords.lng], { icon: dropIcon }).addTo(map);
      markersRef.current.drop = dropMarker;

      // 5. Route Polyline
      if (markersRef.current.routeLine) {
        map.removeLayer(markersRef.current.routeLine);
      }
      const polyline = L.polyline(routeData.coordinates, {
        color: "#10b981",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);
      markersRef.current.routeLine = polyline;

      // 6. Fit Map Bounds to include both Pickup & Drop
      const bounds = L.latLngBounds([
        [pCoords.lat, pCoords.lng],
        [dCoords.lat, dCoords.lng],
      ]);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });

      setIsLoading(false);
    }

    setupMap();

    return () => {
      isCancelled = true;
    };
  }, [pickup, destination, mapTheme]);

  // Update Driver Marker on rideStatus or driverProgress change
  useEffect(() => {
    async function updateDriverMarker() {
      if (!mapInstanceRef.current) return;
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;

      const isDriverActive = ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "IN_PROGRESS"].includes(rideStatus);

      if (!isDriverActive) {
        if (markersRef.current.driver) {
          map.removeLayer(markersRef.current.driver);
          markersRef.current.driver = undefined;
        }
        return;
      }

      // Calculate driver position along route coordinates
      const coords = routeCoordsRef.current;
      let driverLat = 28.6315;
      let driverLng = 77.2167;

      if (coords && coords.length > 0) {
        if (rideStatus === "IN_PROGRESS") {
          const index = Math.min(
            coords.length - 1,
            Math.max(0, Math.floor(driverProgress * (coords.length - 1)))
          );
          driverLat = coords[index][0];
          driverLng = coords[index][1];
        } else {
          // Driver approaching pickup (~80% near pickup start)
          const pCoords = resolveLatLng(pickup, false);
          driverLat = pCoords.lat - 0.005 + 0.005 * driverProgress;
          driverLng = pCoords.lng - 0.004 + 0.004 * driverProgress;
        }
      }

      const driverName = driver?.name?.split(" ")[0] || "Driver";
      const driverEta = rideStatus === "IN_PROGRESS" ? "En route" : "~3m";

      const driverIcon = L.divIcon({
        className: "custom-leaflet-driver-marker",
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
            <div style="background:#facc15; color:#0f172a; font-size:9px; font-weight:900; padding:2px 7px; border-radius:9999px; box-shadow:0 4px 10px rgba(0,0,0,0.6); white-space:nowrap; margin-bottom:3px; display:flex; align-items:center; gap:4px; font-family:system-ui,sans-serif;">
              <span style="width:5px; height:5px; border-radius:50%; background:#0f172a; display:inline-block;"></span>
              ${driverName} (${driverEta})
            </div>
            <div style="width:34px; height:34px; border-radius:12px; background:#facc15; color:#0f172a; display:flex; align-items:center; justify-content:center; box-shadow:0 0 18px rgba(250,204,21,0.8); border:2px solid #0f172a;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      if (markersRef.current.driver) {
        markersRef.current.driver.setLatLng([driverLat, driverLng]);
        markersRef.current.driver.setIcon(driverIcon);
      } else {
        const driverMarker = L.marker([driverLat, driverLng], {
          icon: driverIcon,
          zIndexOffset: 1000,
        }).addTo(map);
        markersRef.current.driver = driverMarker;
      }
    }

    updateDriverMarker();
  }, [rideStatus, driverProgress, driver, pickup]);

  // Teardown map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Map control buttons
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  const handleResetBounds = async () => {
    if (mapInstanceRef.current) {
      const L = (await import("leaflet")).default;
      const pCoords = resolveLatLng(pickup, false);
      const dCoords = resolveLatLng(destination, true);
      const bounds = L.latLngBounds([
        [pCoords.lat, pCoords.lng],
        [dCoords.lat, dCoords.lng],
      ]);
      mapInstanceRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    }
  };

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border ${
        mapTheme === "dark"
          ? "border-slate-800 bg-slate-950 text-white"
          : "border-slate-300 bg-slate-100 text-slate-900"
      } shadow-2xl transition-all ${className}`}
    >
      {/* CSS Dark Mode Filter for OpenStreetMap Tiles (100% Free, No Third-party Servers or Keys) */}
      <style jsx global>{`
        .osm-dark-tiles .leaflet-tile {
          filter: invert(100%) hue-rotate(180deg) brightness(88%) contrast(90%);
        }
      `}</style>

      {/* Top Map Bar */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center gap-1.5 rounded-full bg-slate-900/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-slate-200 border border-slate-700/60 shadow pointer-events-auto">
          <Compass className="h-3.5 w-3.5 text-yellow-400" />
          <span>Leaflet • OpenStreetMap</span>
          <span className="hidden sm:inline-block rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-300">
            {routeInfo.isOsrm ? "OSRM Live Roads" : "Active Route"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowInfoModal(!showInfoModal)}
            title="OpenStreetMap & Routing Info"
            className="rounded-full bg-slate-900/90 backdrop-blur-md p-1.5 text-slate-300 hover:text-yellow-400 border border-slate-700/60 transition shadow"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMapTheme(mapTheme === "dark" ? "standard" : "dark")}
            title={mapTheme === "dark" ? "Switch to Standard View" : "Switch to Dark Night Mode"}
            className="rounded-full bg-slate-900/90 backdrop-blur-md p-1.5 text-slate-300 hover:text-white border border-slate-700/60 transition shadow"
          >
            <Layers className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetBounds}
            title="Fit Route to View"
            className="rounded-full bg-slate-900/90 backdrop-blur-md p-1.5 text-slate-300 hover:text-white border border-slate-700/60 transition shadow"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            title="Zoom In"
            className="rounded-full bg-slate-900/90 backdrop-blur-md p-1.5 text-slate-300 hover:text-white border border-slate-700/60 transition shadow"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            title="Zoom Out"
            className="rounded-full bg-slate-900/90 backdrop-blur-md p-1.5 text-slate-300 hover:text-white border border-slate-700/60 transition shadow"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Info Notice Modal / Dropdown */}
      {showInfoModal && (
        <div className="absolute top-12 left-3 right-3 z-[500] rounded-2xl bg-slate-900/95 backdrop-blur-lg border border-slate-700 p-4 text-xs text-slate-300 shadow-2xl animate-in fade-in">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-yellow-400">
              <Sparkles className="h-4 w-4" />
              <span>OpenStreetMap & Leaflet Integration</span>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="text-slate-400 hover:text-white font-bold px-1"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed">
            SwiftRide is powered by <strong>Leaflet.js</strong> with official <strong>OpenStreetMap (OSM) standard tiles</strong> and real road routing via <strong>OSRM (Open Source Routing Machine)</strong>.
          </p>
          <div className="mt-2.5 rounded-xl bg-slate-950/80 p-2.5 font-mono text-[10px] text-slate-300 border border-slate-800">
            <p className="font-sans font-bold text-emerald-400">✓ 100% Free &amp; Open Source — Zero API Keys Required</p>
            <p className="mt-1">• Tiles: Direct OpenStreetMap standard tiles (no third-party watermarks or keys)</p>
            <p>• Routing: Free driving directions from OSRM demo API with smooth polyline fallback</p>
            <p>• Attribution: Complies with OpenStreetMap tile &amp; data copyright guidelines</p>
          </div>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div className="relative h-72 sm:h-96 w-full bg-slate-900">
        {isLoading && (
          <div className="absolute inset-0 z-[350] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm text-slate-200">
            <Loader2 className="h-7 w-7 animate-spin text-yellow-400" />
            <span className="mt-2 text-xs font-semibold tracking-wide">Loading Leaflet Map &amp; Route...</span>
          </div>
        )}
        <div
          ref={mapContainerRef}
          className="h-full w-full select-none"
          style={{ minHeight: "288px" }}
        />
      </div>

      {/* Bottom Route Status & Attribution Bar */}
      <div className="relative z-[400] border-t border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-semibold text-slate-300">
              {rideStatus === "IN_PROGRESS"
                ? "🚀 Driver en route to drop-off location"
                : rideStatus === "DRIVER_ARRIVING"
                ? "📍 Driver arriving at pickup location"
                : rideStatus === "DRIVER_ASSIGNED"
                ? "🚕 Driver accepted & navigating to pickup"
                : "🗺️ OpenStreetMap Route Active"}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>~{routeInfo.distanceKm} km</span>
            <span>·</span>
            <span>~{routeInfo.durationMins} mins</span>
            <span>·</span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-slate-500 hover:text-slate-300 underline"
            >
              © OpenStreetMap contributors
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
