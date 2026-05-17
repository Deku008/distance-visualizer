"use client";

import L, { type LatLngExpression } from "leaflet";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  Clock3,
  Download,
  GitCompare,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Navigation,
  Plus,
  Route,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

type Location = {
  name: string;
  region: string;
  coordinates: [number, number];
  displayName?: string;
  type?: string;
};

type RouteEntry = {
  id: number;
  name: string;
  start: Location;
  end: Location;
  color: string;
  visible: boolean;
  createdAt: number;
  geometry?: [number, number][];
  distanceMeters?: number;
  durationSeconds?: number;
  status: "loading" | "ready" | "error";
  error?: string;
  startLabel: string;
  endLabel: string;
};

type Theme = "light" | "dark";
type Panel = "plan" | "analytics" | "compare";
type TrafficLabel = "Clear" | "Moderate" | "Heavy";
type UserSession = {
  email: string;
  company: string;
};

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.4, 67.5],
  [37.6, 97.4],
];

const LOCATIONS: Location[] = [
  { name: "Delhi", region: "National Capital Territory", coordinates: [28.6139, 77.209] },
  { name: "Mumbai", region: "Maharashtra", coordinates: [19.076, 72.8777] },
  { name: "Bengaluru", region: "Karnataka", coordinates: [12.9716, 77.5946] },
  { name: "Chennai", region: "Tamil Nadu", coordinates: [13.0827, 80.2707] },
  { name: "Hyderabad", region: "Telangana", coordinates: [17.385, 78.4867] },
  { name: "Kolkata", region: "West Bengal", coordinates: [22.5726, 88.3639] },
  { name: "Pune", region: "Maharashtra", coordinates: [18.5204, 73.8567] },
  { name: "Ahmedabad", region: "Gujarat", coordinates: [23.0225, 72.5714] },
  { name: "Jaipur", region: "Rajasthan", coordinates: [26.9124, 75.7873] },
  { name: "Lucknow", region: "Uttar Pradesh", coordinates: [26.8467, 80.9462] },
  { name: "Kanpur", region: "Uttar Pradesh", coordinates: [26.4499, 80.3319] },
  { name: "Nagpur", region: "Maharashtra", coordinates: [21.1458, 79.0882] },
  { name: "Indore", region: "Madhya Pradesh", coordinates: [22.7196, 75.8577] },
  { name: "Bhopal", region: "Madhya Pradesh", coordinates: [23.2599, 77.4126] },
  { name: "Surat", region: "Gujarat", coordinates: [21.1702, 72.8311] },
  { name: "Vadodara", region: "Gujarat", coordinates: [22.3072, 73.1812] },
  { name: "Patna", region: "Bihar", coordinates: [25.5941, 85.1376] },
  { name: "Ranchi", region: "Jharkhand", coordinates: [23.3441, 85.3096] },
  { name: "Bhubaneswar", region: "Odisha", coordinates: [20.2961, 85.8245] },
  { name: "Guwahati", region: "Assam", coordinates: [26.1445, 91.7362] },
  { name: "Chandigarh", region: "Chandigarh", coordinates: [30.7333, 76.7794] },
  { name: "Amritsar", region: "Punjab", coordinates: [31.634, 74.8723] },
  { name: "Dehradun", region: "Uttarakhand", coordinates: [30.3165, 78.0322] },
  { name: "Shimla", region: "Himachal Pradesh", coordinates: [31.1048, 77.1734] },
  { name: "Srinagar", region: "Jammu and Kashmir", coordinates: [34.0837, 74.7973] },
  { name: "Leh", region: "Ladakh", coordinates: [34.1526, 77.5771] },
  { name: "Goa", region: "Goa", coordinates: [15.2993, 74.124] },
  { name: "Kochi", region: "Kerala", coordinates: [9.9312, 76.2673] },
  { name: "Thiruvananthapuram", region: "Kerala", coordinates: [8.5241, 76.9366] },
  { name: "Coimbatore", region: "Tamil Nadu", coordinates: [11.0168, 76.9558] },
  { name: "Madurai", region: "Tamil Nadu", coordinates: [9.9252, 78.1198] },
  { name: "Visakhapatnam", region: "Andhra Pradesh", coordinates: [17.6868, 83.2185] },
  { name: "Vijayawada", region: "Andhra Pradesh", coordinates: [16.5062, 80.648] },
  { name: "Raipur", region: "Chhattisgarh", coordinates: [21.2514, 81.6296] },
  { name: "Varanasi", region: "Uttar Pradesh", coordinates: [25.3176, 82.9739] },
  { name: "Agra", region: "Uttar Pradesh", coordinates: [27.1767, 78.0081] },
  { name: "Jodhpur", region: "Rajasthan", coordinates: [26.2389, 73.0243] },
  { name: "Udaipur", region: "Rajasthan", coordinates: [24.5854, 73.7125] },
];

const COLORS = [
  "#2563eb",
  "#ef4444",
  "#16a34a",
  "#f97316",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
];

const LABEL_PRESETS = ["Home", "Factory", "Warehouse", "Shop", "Office"];
const AUTH_STORAGE_KEY = "india-distance-auth";
const ROUTES_STORAGE_KEY = "india-distance-saved-routes";

const INITIAL_ROUTES: RouteEntry[] = [
  {
    id: 1,
    name: "Capital Express",
    start: LOCATIONS[0],
    end: LOCATIONS[8],
    color: COLORS[0],
    visible: true,
    createdAt: 1,
    status: "loading",
    startLabel: "Office",
    endLabel: "Warehouse",
  },
  {
    id: 2,
    name: "Western Corridor",
    start: LOCATIONS[1],
    end: LOCATIONS[6],
    color: COLORS[2],
    visible: true,
    createdAt: 2,
    status: "loading",
    startLabel: "Factory",
    endLabel: "Shop",
  },
  {
    id: 3,
    name: "Golden Quadrilateral",
    start: LOCATIONS[0],
    end: LOCATIONS[1],
    color: COLORS[3],
    visible: true,
    createdAt: 3,
    status: "loading",
    startLabel: "Home",
    endLabel: "Office",
  },
];

type DirectionsResponse = {
  geometry: [number, number][];
  distanceMeters: number | null;
  durationSeconds: number | null;
  error?: string;
};

type PlaceSearchResult = Location & {
  id: number;
  displayName: string;
  type: string;
};

function formatDistance(kilometers: number) {
  if (kilometers < 100) {
    return `${kilometers.toFixed(1)} km`;
  }

  return `${Math.round(kilometers).toLocaleString()} km`;
}

function formatTime(hours: number) {
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))} min`;
  }

  const fullHours = Math.floor(hours);
  const minutes = Math.round((hours - fullHours) * 60);

  if (fullHours >= 24) {
    const days = Math.floor(fullHours / 24);
    const remainingHours = fullHours % 24;
    return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  return minutes ? `${fullHours}h ${minutes}m` : `${fullHours}h`;
}

function haversineDistance(start: LatLngExpression, end: LatLngExpression) {
  const [lat1, lon1] = start as [number, number];
  const [lat2, lon2] = end as [number, number];
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeMetrics(route: Pick<RouteEntry, "start" | "end" | "distanceMeters" | "durationSeconds">) {
  const airDistance = haversineDistance(route.start.coordinates, route.end.coordinates);
  const travelDistance = route.distanceMeters ? route.distanceMeters / 1000 : airDistance * 1.28;
  const averageSpeed = airDistance > 900 ? 76 : airDistance > 300 ? 64 : 48;
  const travelTime = route.durationSeconds ? route.durationSeconds / 3600 : travelDistance / averageSpeed;

  return { airDistance, travelDistance, travelTime };
}

function trafficProfile(route: Pick<RouteEntry, "start" | "end" | "durationSeconds" | "distanceMeters">): {
  label: TrafficLabel;
  color: string;
  delayRatio: number;
} {
  const metrics = routeMetrics(route);
  const freeFlowHours = metrics.travelDistance / 78;
  const delayRatio = metrics.travelTime / Math.max(freeFlowHours, 0.1);

  if (delayRatio > 1.35) {
    return { label: "Heavy", color: "#ef4444", delayRatio };
  }

  if (delayRatio > 1.15) {
    return { label: "Moderate", color: "#f97316", delayRatio };
  }

  return { label: "Clear", color: "#22c55e", delayRatio };
}

function parseCsvRows(text: string) {
  const [headerLine, ...lines] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!headerLine) {
    return [];
  }

  const headers = headerLine.split(",").map((header) => header.trim().toLowerCase());

  return lines.map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawExportMarker(
  context: CanvasRenderingContext2D,
  [x, y]: [number, number],
  color: string,
  label: string,
  theme: Theme,
) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 13, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = theme === "dark" ? "#020617" : "#ffffff";
  context.stroke();

  context.font = "700 16px Arial";
  const labelWidth = Math.min(160, context.measureText(label).width + 28);
  context.fillStyle = theme === "dark" ? "rgba(15, 23, 42, 0.9)" : "rgba(255, 255, 255, 0.94)";
  roundRect(context, x + 18, y - 18, labelWidth, 36, 18);
  context.fill();
  context.strokeStyle = theme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(15,23,42,0.12)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = theme === "dark" ? "#f8fafc" : "#0f172a";
  context.fillText(label.slice(0, 18), x + 32, y + 5);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function displayLabel(value: string, fallback: string) {
  return value.trim() || fallback;
}

function markerIcon(color: string, pinLabel: string, markerLabel: string, theme: Theme) {
  return L.divIcon({
    className: "",
    html: `<div class="labeled-route-marker"><div class="route-marker ${theme === "dark" ? "route-marker-dark" : ""}" style="--marker-color: ${color}"><span>${escapeHtml(pinLabel)}</span></div><span class="route-marker-label ${theme === "dark" ? "route-marker-label-dark" : ""}">${escapeHtml(markerLabel)}</span></div>`,
    iconSize: [160, 42],
    iconAnchor: [17, 38],
    popupAnchor: [0, -34],
  });
}

function MapBounds({ routes }: { routes: RouteEntry[] }) {
  const map = useMap();
  const positions = useMemo(
    () =>
      routes
        .filter((route) => route.visible)
        .flatMap((route) => route.geometry ?? [route.start.coordinates, route.end.coordinates]),
    [routes],
  );

  useEffect(() => {
    map.setMaxBounds(L.latLngBounds(INDIA_BOUNDS));
    window.setTimeout(() => map.invalidateSize(), 160);

    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [58, 58], maxZoom: 8 });
    } else {
      map.fitBounds(L.latLngBounds(INDIA_BOUNDS), { padding: [18, 18] });
    }
  }, [map, positions]);

  return null;
}

function FocusMap({ location }: { location?: Location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.setView(location.coordinates, 12, { animate: true });
    }
  }, [location, map]);

  return null;
}

async function fetchRoadRoute(route: RouteEntry): Promise<Partial<RouteEntry>> {
  try {
    const response = await fetch("/api/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: route.start.coordinates,
        end: route.end.coordinates,
        profile: "driving-car",
      }),
    });

    const data = (await response.json()) as DirectionsResponse;

    if (!response.ok || data.error) {
      return {
        status: "error",
        error: data.error ?? "OpenRouteService could not calculate this road route.",
      };
    }

    return {
      geometry: data.geometry,
      distanceMeters: data.distanceMeters ?? undefined,
      durationSeconds: data.durationSeconds ?? undefined,
      status: "ready",
      error: undefined,
    };
  } catch {
    return {
      status: "error",
      error: "Unable to reach the route service.",
    };
  }
}

async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = (await response.json()) as { results?: PlaceSearchResult[] };

  if (!response.ok) {
    return [];
  }

  return data.results ?? [];
}

function PlaceSearch({
  id,
  label,
  value,
  onChange,
  selectedPlace,
  onSelect,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  selectedPlace?: Location;
  onSelect: (place: PlaceSearchResult) => void;
}) {
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const query = value.trim();

    if (
      selectedPlace &&
      (query === selectedPlace.displayName || query === `${selectedPlace.name}, ${selectedPlace.region}`)
    ) {
      return;
    }

    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      searchPlaces(query)
        .then((places) => {
          if (!controller.signal.aborted) {
            setResults(places);
            setOpen(focused);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        });
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, selectedPlace, focused]);

  return (
    <div className="relative grid gap-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(event.target.value.trim().length >= 2);
          }}
          onFocus={() => {
            setFocused(true);
            if (results.length > 0) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            setFocused(false);
            window.setTimeout(() => setOpen(false), 140);
          }}
          placeholder="Search city, area, landmark, business..."
          className="h-11 w-full rounded-xl border border-white/70 bg-white/70 px-9 text-sm font-medium text-slate-950 shadow-sm outline-none backdrop-blur transition duration-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.08] dark:text-white dark:focus:border-cyan-300 dark:focus:ring-cyan-300/15"
        />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open ? (
        <div className="absolute left-0 right-0 top-[76px] z-[900] overflow-hidden rounded-xl border border-white/70 bg-white/90 shadow-2xl shadow-slate-950/15 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/92">
          {loading ? (
            <p className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Searching India...</p>
          ) : results.length > 0 ? (
            <div className="max-h-72 overflow-auto p-1">
              {results.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onSelect(place);
                    onChange(place.displayName);
                    setOpen(false);
                  }}
                  className="grid w-full gap-1 rounded-lg px-3 py-2.5 text-left transition duration-200 hover:bg-blue-50 dark:hover:bg-white/10"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-slate-950 dark:text-white">{place.name}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold capitalize text-slate-500 dark:bg-white/10 dark:text-slate-300">
                      {place.type}
                    </span>
                  </span>
                  <span className="text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">
                    {place.displayName}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              No India results found.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function LabelInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Home, Factory, Warehouse..."
        className="h-11 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-sm font-medium text-slate-950 shadow-sm outline-none backdrop-blur transition duration-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.08] dark:text-white dark:focus:border-cyan-300 dark:focus:ring-cyan-300/15"
      />
      <div className="flex flex-wrap gap-2">
        {LABEL_PRESETS.map((preset) => (
          <button
            key={`${id}-${preset}`}
            type="button"
            onClick={() => onChange(preset)}
            className="rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:border-emerald-300/40 dark:hover:bg-emerald-300/10 dark:hover:text-emerald-100"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DistanceVisualizer() {
  const [routes, setRoutes] = useState<RouteEntry[]>(INITIAL_ROUTES);
  const [user, setUser] = useState<UserSession>();
  const [email, setEmail] = useState("planner@fleet.local");
  const [company, setCompany] = useState("Northstar Logistics");
  const [activePanel, setActivePanel] = useState<Panel>("plan");
  const [savedAt, setSavedAt] = useState<string>();
  const [startSearch, setStartSearch] = useState("Delhi, National Capital Territory");
  const [endSearch, setEndSearch] = useState("Mumbai, Maharashtra");
  const [selectedStart, setSelectedStart] = useState<Location>(LOCATIONS[0]);
  const [selectedEnd, setSelectedEnd] = useState<Location>(LOCATIONS[1]);
  const [focusLocation, setFocusLocation] = useState<Location>();
  const [draftRoute, setDraftRoute] = useState<RouteEntry>();
  const [startLabel, setStartLabel] = useState("Home");
  const [endLabel, setEndLabel] = useState("Office");
  const [color, setColor] = useState(COLORS[1]);
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [introVisible, setIntroVisible] = useState(true);
  const requestedRouteIds = useRef(new Set<number>());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY);
    const storedRoutes = window.localStorage.getItem(ROUTES_STORAGE_KEY);
    const timer = window.setTimeout(() => {
      if (storedUser) {
        setUser(JSON.parse(storedUser) as UserSession);
      }

      if (storedRoutes) {
        setRoutes(JSON.parse(storedRoutes) as RouteEntry[]);
        setSavedAt("Loaded saved routes");
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setIntroVisible(false), 1150);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const routesNeedingGeometry = routes.filter(
      (route) => route.status === "loading" && !requestedRouteIds.current.has(route.id),
    );

    if (!routesNeedingGeometry.length) {
      return;
    }

    routesNeedingGeometry.forEach((route) => {
      requestedRouteIds.current.add(route.id);

      fetchRoadRoute(route).then((roadRoute) => {
        setRoutes((currentRoutes) =>
          currentRoutes.map((currentRoute) =>
            currentRoute.id === route.id ? { ...currentRoute, ...roadRoute } : currentRoute,
          ),
        );
      });
    });
  }, [routes]);

  useEffect(() => {
    if (selectedStart.name === selectedEnd.name) {
      const resetTimer = window.setTimeout(() => setDraftRoute(undefined), 0);
      return () => window.clearTimeout(resetTimer);
    }

    const nextDraftRoute: RouteEntry = {
      id: 0,
      name: `${selectedStart.name} to ${selectedEnd.name}`,
      start: selectedStart,
      end: selectedEnd,
      color,
      visible: true,
      createdAt: 0,
      status: "loading",
      startLabel,
      endLabel,
    };

    const loadingTimer = window.setTimeout(() => setDraftRoute(nextDraftRoute), 0);
    let cancelled = false;

    fetchRoadRoute(nextDraftRoute).then((roadRoute) => {
      if (!cancelled) {
        setDraftRoute({ ...nextDraftRoute, ...roadRoute });
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(loadingTimer);
    };
  }, [selectedStart, selectedEnd, startLabel, endLabel, color]);

  const visibleRoutes = routes.filter((route) => route.visible);
  const mapRoutes = draftRoute ? [...routes, draftRoute] : routes;
  const totalTravelDistance = routes.reduce(
    (sum, route) => sum + routeMetrics(route).travelDistance,
    0,
  );
  const totalTravelTime = routes.reduce((sum, route) => sum + routeMetrics(route).travelTime, 0);
  const canAddRoute = Boolean(selectedStart && selectedEnd && selectedStart.name !== selectedEnd.name);
  const routeComparisons = [...routes].sort(
    (firstRoute, secondRoute) => routeMetrics(firstRoute).travelTime - routeMetrics(secondRoute).travelTime,
  );
  const trafficSummary = routes.reduce(
    (summary, route) => {
      const traffic = trafficProfile(route).label;
      return { ...summary, [traffic]: summary[traffic] + 1 };
    },
    { Clear: 0, Moderate: 0, Heavy: 0 },
  );

  const addRoute = () => {
    if (!selectedStart || !selectedEnd || selectedStart.name === selectedEnd.name) {
      return;
    }

    const nextColor = color || COLORS[routes.length % COLORS.length];
    setRoutes((currentRoutes) => [
      ...currentRoutes,
      {
        id: Date.now(),
        name: `${selectedStart.name} to ${selectedEnd.name}`,
        start: selectedStart,
        end: selectedEnd,
        color: nextColor,
        visible: true,
        createdAt: Date.now(),
        geometry: draftRoute?.geometry,
        distanceMeters: draftRoute?.distanceMeters,
        durationSeconds: draftRoute?.durationSeconds,
        status: draftRoute?.status ?? "loading",
        error: draftRoute?.error,
        startLabel,
        endLabel,
      },
    ]);
    setColor(COLORS[(routes.length + 1) % COLORS.length]);
    setSidebarOpen(false);
  };

  const signIn = () => {
    const session = { email, company };
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    setUser(session);
  };

  const signOut = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(undefined);
  };

  const saveRoutes = () => {
    window.localStorage.setItem(ROUTES_STORAGE_KEY, JSON.stringify(routes));
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  };

  const exportMapImage = () => {
    const width = 1600;
    const height = 1000;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, theme === "dark" ? "#020617" : "#f8fafc");
    gradient.addColorStop(0.5, theme === "dark" ? "#0f172a" : "#eef6ff");
    gradient.addColorStop(1, theme === "dark" ? "#082f49" : "#ecfdf5");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.fillStyle = theme === "dark" ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.72)";
    context.strokeStyle = theme === "dark" ? "rgba(255, 255, 255, 0.16)" : "rgba(15, 23, 42, 0.12)";
    context.lineWidth = 2;
    roundRect(context, 56, 56, width - 112, height - 112, 28);
    context.fill();
    context.stroke();

    context.fillStyle = theme === "dark" ? "#f8fafc" : "#0f172a";
    context.font = "700 42px Arial";
    context.fillText("India Route Studio", 96, 126);
    context.font = "600 18px Arial";
    context.fillStyle = theme === "dark" ? "#94a3b8" : "#64748b";
    context.fillText(`${routes.length} lanes · ${formatDistance(totalTravelDistance)} · ${formatTime(totalTravelTime)}`, 96, 160);

    const project = ([latitude, longitude]: [number, number]) => {
      const [southWest, northEast] = INDIA_BOUNDS;
      const x = 140 + ((longitude - southWest[1]) / (northEast[1] - southWest[1])) * (width - 280);
      const y = 220 + ((northEast[0] - latitude) / (northEast[0] - southWest[0])) * (height - 340);
      return [x, y] as [number, number];
    };

    context.strokeStyle = theme === "dark" ? "rgba(148, 163, 184, 0.16)" : "rgba(100, 116, 139, 0.16)";
    context.lineWidth = 1;
    for (let index = 0; index < 8; index += 1) {
      const x = 140 + ((width - 280) / 7) * index;
      context.beginPath();
      context.moveTo(x, 220);
      context.lineTo(x, height - 120);
      context.stroke();
    }
    for (let index = 0; index < 6; index += 1) {
      const y = 220 + ((height - 340) / 5) * index;
      context.beginPath();
      context.moveTo(140, y);
      context.lineTo(width - 140, y);
      context.stroke();
    }

    routes.filter((route) => route.visible).forEach((route) => {
      const positions = route.geometry ?? [route.start.coordinates, route.end.coordinates];
      context.strokeStyle = route.color;
      context.lineWidth = 6;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      positions.forEach((position, index) => {
        const [x, y] = project(position);
        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.stroke();
      drawExportMarker(context, project(route.start.coordinates), route.color, displayLabel(route.startLabel, "Source"), theme);
      drawExportMarker(context, project(route.end.coordinates), route.color, displayLabel(route.endLabel, "Destination"), theme);
    });

    const link = document.createElement("a");
    link.download = "india-route-map.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const importCsv = async (file: File) => {
    const rows = parseCsvRows(await file.text());

    for (const row of rows) {
      const source = row.source ?? row.start ?? "";
      const destination = row.destination ?? row.end ?? "";

      if (!source || !destination) {
        continue;
      }

      const [sourcePlace] = await searchPlaces(source);
      const [destinationPlace] = await searchPlaces(destination);

      if (!sourcePlace || !destinationPlace) {
        continue;
      }

      const importedRoute: RouteEntry = {
        id: Date.now() + Math.round(Math.random() * 10000),
        name: row.name || `${sourcePlace.name} to ${destinationPlace.name}`,
        start: sourcePlace,
        end: destinationPlace,
        color: row.color || COLORS[Math.floor(Math.random() * COLORS.length)],
        visible: true,
        createdAt: Date.now(),
        status: "loading",
        startLabel: row.sourcelabel || row.startlabel || "Source",
        endLabel: row.destinationlabel || row.endlabel || "Destination",
      };

      setRoutes((currentRoutes) => [...currentRoutes, importedRoute]);
    }
  };

  const shellClass =
    theme === "dark"
      ? "dark bg-[linear-gradient(135deg,#020617,#0f172a_48%,#082f49)] text-white"
      : "bg-[linear-gradient(135deg,#f8fafc,#eef6ff_45%,#ecfdf5)] text-slate-950";

  if (!user) {
    return (
      <main className={`grid h-dvh place-items-center overflow-hidden p-6 ${shellClass}`}>
        <section className="w-full max-w-md rounded-2xl border border-white/70 bg-white/75 p-6 shadow-2xl shadow-slate-950/15 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/75">
          <div className="mb-6 grid size-12 place-items-center rounded-xl bg-[linear-gradient(135deg,#2563eb,#06b6d4,#22c55e)] text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-cyan-300">
            Secure workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Sign in to Fleet Intelligence
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Demo authentication keeps saved routes and analytics scoped to this browser.
          </p>
          <div className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Work email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 rounded-xl border border-white/70 bg-white/70 px-3 text-slate-950 outline-none backdrop-blur focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.08] dark:text-white"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              Company
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                className="h-11 rounded-xl border border-white/70 bg-white/70 px-3 text-slate-950 outline-none backdrop-blur focus:ring-4 focus:ring-blue-500/10 dark:border-white/10 dark:bg-white/[0.08] dark:text-white"
              />
            </label>
            <button
              type="button"
              onClick={signIn}
              className="mt-2 flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#2563eb,#06b6d4,#22c55e)] text-sm font-semibold text-white shadow-xl shadow-blue-500/20 transition hover:-translate-y-0.5"
            >
              <User className="size-4" />
              Enter dashboard
            </button>
          </div>
        </section>
      </main>
    );
  }

  const sidebar = (
    <aside className="flex h-full w-full flex-col overflow-hidden border-slate-200/80 bg-white/72 shadow-2xl shadow-slate-950/15 backdrop-blur-2xl transition-colors dark:border-white/10 dark:bg-slate-950/72 lg:m-4 lg:h-[calc(100%-2rem)] lg:w-[430px] lg:rounded-2xl lg:border">
      <div className="relative overflow-hidden border-b border-slate-200/70 px-5 py-5 dark:border-white/10">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#2563eb,#06b6d4,#22c55e)]" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-cyan-300">
              <Sparkles className="size-3.5" />
              Fleet Intelligence
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold leading-tight tracking-tight text-slate-950 dark:text-white">
              India Route Studio
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Plan road lanes, facilities, and ETAs across India.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Save routes"
              onClick={saveRoutes}
              className="grid size-10 place-items-center rounded-xl border border-white/70 bg-white/65 text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
            >
              <Save className="size-5" />
            </button>
            <button
              type="button"
              aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"}
              onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
              className="grid size-10 place-items-center rounded-xl border border-white/70 bg-white/65 text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
            >
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <button
              type="button"
              aria-label="Sign out"
              onClick={signOut}
              className="grid size-10 place-items-center rounded-xl border border-white/70 bg-white/65 text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
            >
              <LogOut className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Close sidebar"
              onClick={() => setSidebarOpen(false)}
              className="grid size-10 place-items-center rounded-xl border border-white/70 bg-white/65 text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14] lg:hidden"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(["plan", "analytics", "compare"] as Panel[]).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => setActivePanel(panel)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${
                activePanel === panel
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "bg-white/60 text-slate-600 hover:bg-white dark:bg-white/8 dark:text-slate-300 dark:hover:bg-white/14"
              }`}
            >
              {panel}
            </button>
          ))}
          <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
            {savedAt ? `Saved: ${savedAt}` : user.company}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 border-b border-slate-200/70 p-5 dark:border-white/10">
        <div className="rounded-xl bg-[linear-gradient(135deg,#020617,#1e293b)] p-4 text-white shadow-lg shadow-slate-950/20 dark:bg-[linear-gradient(135deg,#f8fafc,#bae6fd)] dark:text-slate-950">
          <p className="text-xs font-medium text-slate-300 dark:text-slate-500">Active lanes</p>
          <p className="mt-2 text-3xl font-semibold">{visibleRoutes.length}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/65 p-4 text-blue-950 shadow-sm backdrop-blur dark:border-white/10 dark:bg-cyan-300/10 dark:text-cyan-100">
          <p className="text-xs font-medium text-blue-700 dark:text-cyan-300">Distance</p>
          <p className="mt-2 text-xl font-semibold">{formatDistance(totalTravelDistance)}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/65 p-4 text-emerald-950 shadow-sm backdrop-blur dark:border-white/10 dark:bg-emerald-300/10 dark:text-emerald-100">
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Time</p>
          <p className="mt-2 text-xl font-semibold">{formatTime(totalTravelTime)}</p>
        </div>
      </div>

      <div className={`${activePanel === "plan" ? "flex" : "hidden"} flex-1 flex-col space-y-6 overflow-y-auto p-5`}>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Plus className="size-5 text-blue-600 dark:text-cyan-300" />
              <h2 className="text-base font-semibold">Create lane</h2>
            </div>
            <button
              type="button"
              onClick={() => setRoutes([])}
              disabled={routes.length === 0}
              className="rounded-xl border border-white/70 bg-white/55 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.14]"
            >
              Remove all
            </button>
          </div>

          <div className="grid gap-4">
            <PlaceSearch
              id="source-location"
              label="Source location"
              value={startSearch}
              onChange={setStartSearch}
              selectedPlace={selectedStart}
              onSelect={(place) => {
                setSelectedStart(place);
                setFocusLocation(place);
              }}
            />
            <PlaceSearch
              id="destination-location"
              label="Destination location"
              value={endSearch}
              onChange={setEndSearch}
              selectedPlace={selectedEnd}
              onSelect={(place) => {
                setSelectedEnd(place);
                setFocusLocation(place);
              }}
            />
            <div className="grid gap-4 rounded-xl border border-white/70 bg-white/55 p-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
              <LabelInput id="source-label" label="Source label" value={startLabel} onChange={setStartLabel} />
              <LabelInput id="destination-label" label="Destination label" value={endLabel} onChange={setEndLabel} />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Dynamic color</p>
                <input
                  type="color"
                  aria-label="Choose custom route color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-8 w-12 cursor-pointer rounded-md border border-slate-200 bg-transparent p-1 dark:border-white/10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Use ${swatch} route color`}
                    onClick={() => setColor(swatch)}
                    className="grid size-9 place-items-center rounded-full border border-white/80 shadow-sm transition hover:-translate-y-0.5 dark:border-white/20"
                    style={{ backgroundColor: swatch }}
                  >
                    {color.toLowerCase() === swatch ? <Check className="size-4 text-white" /> : null}
                  </button>
                ))}
              </div>
            </div>

            {selectedStart && selectedEnd && selectedStart.name !== selectedEnd.name ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/70 bg-white/55 p-3 text-sm shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Travel distance</p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {formatDistance(
                      routeMetrics(draftRoute ?? { start: selectedStart, end: selectedEnd }).travelDistance,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Estimated time</p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-white">
                    {formatTime(
                      routeMetrics(draftRoute ?? { start: selectedStart, end: selectedEnd }).travelTime,
                    )}
                  </p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={addRoute}
              disabled={!canAddRoute}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#2563eb,#06b6d4,#22c55e)] px-4 text-sm font-semibold text-white shadow-xl shadow-blue-500/20 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-cyan-500/25 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:bg-none disabled:shadow-none dark:text-white dark:disabled:bg-white/20 dark:disabled:text-white/45"
            >
              <Route className="size-4" />
              Add lane
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/70 bg-white/60 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
              >
                <Upload className="size-4" />
                CSV upload
              </button>
              <button
                type="button"
                onClick={exportMapImage}
                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/70 bg-white/60 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
              >
                <Download className="size-4" />
                Export map
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void importCsv(file);
                  }
                  event.target.value = "";
                }}
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Navigation className="size-5 text-blue-600 dark:text-cyan-300" />
              <h2 className="text-base font-semibold">Live lanes</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">{routes.length} total</span>
          </div>

          <div className="space-y-3">
            {routes.map((route) => {
              const metrics = routeMetrics(route);

              return (
                <article
                  key={route.id}
                  className="relative overflow-hidden rounded-xl border border-white/70 bg-white/72 p-4 shadow-lg shadow-slate-950/10 backdrop-blur transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-950/15 dark:border-white/10 dark:bg-white/[0.07] dark:hover:shadow-black/25"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: route.color }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{ backgroundColor: route.color }}
                        />
                        <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {route.name}
                        </h3>
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                          {displayLabel(route.startLabel, "Source")}
                        </span>
                        <span className="truncate">{route.start.name}</span>
                        <ArrowRight className="size-4 shrink-0 text-slate-400" />
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                          {displayLabel(route.endLabel, "Destination")}
                        </span>
                        <span className="truncate">{route.end.name}</span>
                      </div>
                      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                        {route.status === "loading"
                          ? "Fetching road route..."
                          : route.status === "ready"
                            ? "OpenRouteService road route"
                            : route.error}
                      </p>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        aria-label={route.visible ? "Hide route" : "Show route"}
                        onClick={() =>
                          setRoutes((currentRoutes) =>
                            currentRoutes.map((currentRoute) =>
                              currentRoute.id === route.id
                                ? { ...currentRoute, visible: !currentRoute.visible }
                                : currentRoute,
                            ),
                          )
                        }
                        className="grid size-8 place-items-center rounded-lg border border-white/70 bg-white/55 text-slate-600 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.14]"
                      >
                        <MapPin className={route.visible ? "size-4" : "size-4 opacity-35"} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${route.name}`}
                        onClick={() =>
                          setRoutes((currentRoutes) =>
                            currentRoutes.filter((currentRoute) => currentRoute.id !== route.id),
                          )
                        }
                        className="grid size-8 place-items-center rounded-lg border border-white/70 bg-white/55 text-slate-500 shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Travel distance</p>
                      <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                        {formatDistance(metrics.travelDistance)}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock3 className="size-3" />
                        ETA
                      </p>
                      <p className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
                        {formatTime(metrics.travelTime)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <div className={`${activePanel === "analytics" ? "block" : "hidden"} flex-1 overflow-y-auto p-5`}>
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-950 dark:text-white">
            <BarChart3 className="size-5 text-blue-600 dark:text-cyan-300" />
            <h2 className="text-base font-semibold">Analytics dashboard</h2>
          </div>
          <div className="grid gap-3">
            {[
              ["Total lanes", routes.length.toString()],
              ["Saved network", formatDistance(totalTravelDistance)],
              ["Average ETA", formatTime(totalTravelTime / Math.max(routes.length, 1))],
              ["Traffic clear", trafficSummary.Clear.toString()],
              ["Traffic moderate", trafficSummary.Moderate.toString()],
              ["Traffic heavy", trafficSummary.Heavy.toString()],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/70 bg-white/65 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.08]"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className={`${activePanel === "compare" ? "block" : "hidden"} flex-1 overflow-y-auto p-5`}>
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-slate-950 dark:text-white">
            <GitCompare className="size-5 text-blue-600 dark:text-cyan-300" />
            <h2 className="text-base font-semibold">Route comparison</h2>
          </div>
          <div className="space-y-3">
            {routeComparisons.map((route, index) => {
              const metrics = routeMetrics(route);
              const traffic = trafficProfile(route);

              return (
                <article
                  key={`compare-${route.id}`}
                  className="rounded-xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.08]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Rank {index + 1}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{route.name}</h3>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: traffic.color }}
                    >
                      {traffic.label}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatDistance(metrics.travelDistance)}
                    </p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {formatTime(metrics.travelTime)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </aside>
  );

  return (
    <main className={`relative h-dvh w-full overflow-hidden transition-colors duration-500 ${shellClass}`}>
      {introVisible ? (
        <div className="pointer-events-none fixed inset-0 z-[1000] grid place-items-center bg-slate-950 text-white animate-startup-fade">
          <div className="grid place-items-center gap-5">
            <div className="grid size-20 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-300/30 animate-startup-pulse">
              <Route className="size-9" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
                India Distance Visualizer
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">Trace India by road</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-y-0 left-0 z-[500] hidden lg:block">{sidebar}</div>

      <div
        className={`fixed inset-0 z-[700] bg-slate-950/45 transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      {sidebarOpen ? (
        <div className="fixed inset-y-0 left-0 z-[800] w-[min(92vw,410px)] animate-mobile-sidebar lg:hidden">
          {sidebar}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Open sidebar"
        onClick={() => setSidebarOpen(true)}
        className="absolute left-4 top-4 z-[600] grid size-11 place-items-center rounded-xl border border-white/70 bg-white/75 text-slate-800 shadow-xl shadow-slate-950/15 backdrop-blur transition duration-300 hover:-translate-y-0.5 dark:border-white/10 dark:bg-slate-950/75 dark:text-white lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="pointer-events-none absolute right-4 top-4 z-[520] hidden grid-cols-4 gap-3 lg:grid">
        <div className="rounded-xl border border-white/70 bg-white/72 px-4 py-3 shadow-xl shadow-slate-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Network</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{visibleRoutes.length} lanes</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/72 px-4 py-3 shadow-xl shadow-slate-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">Distance</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatDistance(totalTravelDistance)}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/72 px-4 py-3 shadow-xl shadow-slate-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">ETA</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatTime(totalTravelTime)}</p>
        </div>
        <div className="rounded-xl border border-white/70 bg-white/72 px-4 py-3 shadow-xl shadow-slate-950/10 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/70">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
            <Activity className="size-3" />
            Traffic
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {trafficSummary.Heavy > 0 ? "Heavy" : trafficSummary.Moderate > 0 ? "Moderate" : "Clear"}
          </p>
        </div>
      </div>

      <div className="absolute inset-0 lg:left-[462px]">
        <MapContainer
          center={[22.9734, 78.6569]}
          zoom={5}
          minZoom={4}
          maxBounds={INDIA_BOUNDS}
          maxBoundsViscosity={0.95}
          scrollWheelZoom
          className={`h-full w-full ${theme === "dark" ? "leaflet-dark" : ""}`}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds routes={mapRoutes} />
          <FocusMap location={focusLocation} />
          {draftRoute ? (
            <Fragment>
              <Polyline
                positions={draftRoute.geometry ?? [draftRoute.start.coordinates, draftRoute.end.coordinates]}
                pathOptions={{
                  color,
                  weight: 4,
                  opacity: draftRoute.status === "ready" ? 0.62 : 0.32,
                  className: "animated-route-line preview-route-line",
                }}
              />
              <Marker
                icon={markerIcon(color, "S", displayLabel(startLabel, "Source"), theme)}
                position={draftRoute.start.coordinates}
              >
                <Popup>
                  <strong>{displayLabel(startLabel, "Source")}</strong>
                  <br />
                  {draftRoute.start.displayName ?? draftRoute.start.name}
                </Popup>
              </Marker>
              <Marker
                icon={markerIcon(color, "D", displayLabel(endLabel, "Destination"), theme)}
                position={draftRoute.end.coordinates}
              >
                <Popup>
                  <strong>{displayLabel(endLabel, "Destination")}</strong>
                  <br />
                  {draftRoute.end.displayName ?? draftRoute.end.name}
                </Popup>
              </Marker>
            </Fragment>
          ) : null}
          {routes.map((route) =>
            route.visible ? (
              <Fragment key={route.id}>
                <Polyline
                  positions={route.geometry ?? [route.start.coordinates, route.end.coordinates]}
                  pathOptions={{
                    color: route.color,
                    weight: 5,
                    opacity: route.status === "ready" ? 0.9 : 0.45,
                    className: "animated-route-line",
                  }}
                />
                <Marker
                  icon={markerIcon(route.color, "A", displayLabel(route.startLabel, "Source"), theme)}
                  position={route.start.coordinates}
                >
                  <Popup>
                    <strong>{displayLabel(route.startLabel, "Source")}</strong>
                    <br />
                    {route.start.name}
                    <br />
                    {route.name}
                  </Popup>
                </Marker>
                <Marker
                  icon={markerIcon(route.color, "B", displayLabel(route.endLabel, "Destination"), theme)}
                  position={route.end.coordinates}
                >
                  <Popup>
                    <strong>{displayLabel(route.endLabel, "Destination")}</strong>
                    <br />
                    {route.end.name}
                    <br />
                    {formatDistance(routeMetrics(route).travelDistance)}
                  </Popup>
                </Marker>
              </Fragment>
            ) : null,
          )}
        </MapContainer>
      </div>
    </main>
  );
}
