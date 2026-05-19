"use client";

import RazorpayCheckout from "@/app/components/RazorpayCheckout";
import { firebaseConfigError, getFirebaseAuth } from "@/app/lib/firebase";
import {
  deleteUserRoute,
  formatRouteDateParts,
  normalizeLabel,
  parseGeometry,
  recordUserLabels,
  subscribeToUserLabels,
  subscribeToUserRoutes,
  subscribeToUserSubscription,
  type CoordinateTuple,
  type LabelSuggestion,
  type RouteLocation,
  type SavedRoute,
} from "@/app/lib/routeHistory";
import {
  FREE_LANE_LIMIT,
  FREE_SUBSCRIPTION,
  PRO_PRICE_DISPLAY,
  type SubscriptionSnapshot,
} from "@/app/lib/subscription";
import {
  browserLocalPersistence,
  type User as FirebaseUser,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as signOutFirebase,
} from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { toPng } from "html-to-image";
import L from "leaflet";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  Crown,
  Download,
  GitCompare,
  LogOut,
  MapPin,
  Maximize2,
  Menu,
  Minimize2,
  Navigation,
  Plus,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
  Tags,
  Zap,
} from "lucide-react";
import { Fragment, type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Location = RouteLocation;
type RouteEntry = SavedRoute;

type Theme = "light" | "dark";
type Panel = "plan" | "history" | "analytics" | "compare";
type TrafficLabel = "Clear" | "Moderate" | "Heavy";
type CloudSyncStatus = "idle" | "authenticating" | "loading" | "ready" | "saving" | "deleting" | "error";
type BillingStatus = "idle" | "loading" | "redirecting" | "error";
type RouteColorStyle = CSSProperties & Record<"--route-color", string>;
type AppUser = {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
};

const INDIA_BOUNDS: [[number, number], [number, number]] = [
  [6.4, 67.5],
  [37.6, 97.4],
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
const INITIAL_ROUTES: RouteEntry[] = [];
const DASHBOARD_COLLAPSED_SESSION_KEY = "india-distance-dashboard-collapsed";
const AUTH_REDIRECT_PENDING_SESSION_KEY = "routevision-google-redirect-pending";
const FIREBASE_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const springTransition = { type: "spring" as const, stiffness: 300, damping: 28, mass: 0.72 };
const softSpringTransition = { type: "spring" as const, stiffness: 220, damping: 26, mass: 0.8 };
const liquidHover = { y: -4, scale: 1.01 };
const liquidTap = { scale: 0.98 };

type DirectionsResponse = {
  geometry: unknown;
  distanceMeters: number | null;
  durationSeconds: number | null;
  error?: string;
};

type ApiErrorResponse = {
  error?: string;
  code?: string;
};

type PlaceSearchResult = Location & {
  id: number;
  displayName: string;
  type: string;
};

function routePositions(route: Pick<RouteEntry, "geometry" | "start" | "end">): CoordinateTuple[] {
  return parseGeometry(route.geometry) ?? [route.start.coordinates, route.end.coordinates];
}

function filterDeletedRoutes(routes: RouteEntry[], deletedIds: Set<number>) {
  return routes.filter((route) => !deletedIds.has(route.id));
}

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

function laneDisplayName(route: Pick<RouteEntry, "start" | "end" | "startLabel" | "endLabel">) {
  return `${displayLabel(route.startLabel, route.start.name)} → ${displayLabel(route.endLabel, route.end.name)}`;
}

function placeDisplayName(route: Pick<RouteEntry, "start" | "end">) {
  return `${route.start.name} → ${route.end.name}`;
}

function shortRouteName(route: Pick<RouteEntry, "start" | "end" | "name" | "startLabel" | "endLabel">) {
  const name = laneDisplayName(route);
  return name.length > 24 ? `${name.slice(0, 22)}…` : name;
}

function haversineDistance(start: CoordinateTuple, end: CoordinateTuple) {
  const [lat1, lon1] = start;
  const [lat2, lon2] = end;
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

function firebaseAuthCode(error: unknown) {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;
}

function isPopupFallbackError(error: unknown) {
  const code = firebaseAuthCode(error);
  return (
    code === "auth/popup-blocked" ||
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/web-storage-unsupported"
  );
}

function googleAuthMessage(error: unknown) {
  const code = firebaseAuthCode(error);

  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google popup. Redirecting to Google sign-in instead.";
  }

  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "The Google popup was closed. Redirecting to Google sign-in instead.";
  }

  if (code === "auth/operation-not-supported-in-this-environment" || code === "auth/web-storage-unsupported") {
    return "This browser works better with redirect sign-in. Redirecting to Google now.";
  }

  if (code === "auth/network-request-failed") {
    return "Google sign-in needs a network connection. Check your connection and try again.";
  }

  if (code === "auth/unauthorized-domain") {
    return "This domain is not authorized for Firebase Google sign-in.";
  }

  return "Google sign-in failed. Please try again.";
}

function authApiErrorMessage(data: ApiErrorResponse, fallback: string) {
  if (data.code === "INVALID_TOKEN") {
    return "Your sign-in session could not be verified. Please sign in again.";
  }

  if (data.code === "AUTH_REQUIRED") {
    return "Please sign in again to continue.";
  }

  return data.error ?? fallback;
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

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
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

function MapBounds({ routes, fullscreen }: { routes: RouteEntry[]; fullscreen: boolean }) {
  const map = useMap();
  const positions = useMemo(
    () =>
      routes
        .filter((route) => route.visible)
        .flatMap(routePositions),
    [routes],
  );

  useEffect(() => {
    map.setMaxBounds(L.latLngBounds(INDIA_BOUNDS));
    window.setTimeout(() => map.invalidateSize(), fullscreen ? 260 : 160);

    if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: fullscreen ? [88, 88] : [58, 58], maxZoom: fullscreen ? 9 : 8 });
    } else {
      map.fitBounds(L.latLngBounds(INDIA_BOUNDS), { padding: [18, 18] });
    }
  }, [fullscreen, map, positions]);

  return null;
}

function MapCaptureHandle({ onReady }: { onReady: (map: L.Map) => void }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

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
      geometry: parseGeometry(data.geometry),
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

function waitForMapTiles(container: HTMLElement, timeoutMs = 8000) {
  const startedAt = Date.now();

  return new Promise<void>((resolve) => {
    const checkTiles = () => {
      const tiles = [...container.querySelectorAll<HTMLImageElement>(".leaflet-tile")].filter(
        (tile) => tile.offsetParent !== null && !tile.classList.contains("leaflet-tile-error"),
      );
      const loaded = tiles.length > 0 && tiles.every((tile) => tile.complete && tile.naturalWidth > 0);

      if (loaded || Date.now() - startedAt > timeoutMs) {
        resolve();
        return;
      }

      window.setTimeout(checkTiles, 120);
    };

    checkTiles();
  });
}

async function decodeMapImages(container: HTMLElement) {
  const images = [...container.querySelectorAll<HTMLImageElement>("img")].filter(
    (image) => image.complete && image.naturalWidth > 0 && typeof image.decode === "function",
  );

  await Promise.allSettled(images.map((image) => image.decode()));
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
      <div className="relative h-11 overflow-visible">
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
          className="liquid-input h-11 w-full rounded-[1.15rem] px-9 text-sm font-medium text-slate-950 outline-none transition duration-300 focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-400/15 dark:text-white dark:focus:border-cyan-200/40 dark:focus:ring-cyan-300/15"
        />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={softSpringTransition}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "calc(100% + 0.25rem)",
            }}
            className="liquid-panel autocomplete-suggestion-panel z-[900] overflow-hidden rounded-[1.25rem]"
          >
            {loading ? (
              <p className="px-3 py-3 text-sm font-medium text-slate-500 dark:text-slate-400">Searching India...</p>
            ) : results.length > 0 ? (
              <div className="max-h-72 overflow-auto bg-white p-1 dark:bg-slate-950">
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
                    className="grid w-full gap-1 rounded-2xl bg-white px-3 py-2.5 text-left shadow-sm transition duration-200 hover:bg-cyan-50 dark:bg-slate-950 dark:hover:bg-slate-900"
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
          </motion.div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeMatchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function labelMatchScore(label: string, query: string) {
  const normalizedLabel = normalizeMatchText(label);
  const normalizedQuery = normalizeMatchText(query);

  if (!normalizedQuery) {
    return 1;
  }

  if (normalizedLabel === normalizedQuery) {
    return 120;
  }

  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 100;
  }

  if (normalizedLabel.includes(normalizedQuery)) {
    return 82;
  }

  const queryTokens = normalizedQuery.split(" ");
  const labelTokens = normalizedLabel.split(" ");
  const matchedTokens = queryTokens.filter((queryToken) =>
    labelTokens.some((labelToken) => labelToken.startsWith(queryToken) || labelToken.includes(queryToken)),
  );

  return matchedTokens.length ? 58 + matchedTokens.length * 8 : 0;
}

function highlightLabelMatch(label: string, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return label;
  }

  const index = label.toLowerCase().indexOf(normalizedQuery);

  if (index === -1) {
    return label;
  }

  return (
    <>
      {label.slice(0, index)}
      <mark className="rounded bg-cyan-300/25 px-0.5 text-inherit dark:bg-cyan-300/20">
        {label.slice(index, index + normalizedQuery.length)}
      </mark>
      {label.slice(index + normalizedQuery.length)}
    </>
  );
}

function LabelInput({
  id,
  label,
  value,
  onChange,
  suggestions,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: LabelSuggestion[];
  onCommit: (value: string) => void;
}) {
  const query = value.trim();
  const options = useMemo(() => {
    const defaults: LabelSuggestion[] = LABEL_PRESETS.map((preset, index) => ({
      id: `preset-${preset}`,
      label: preset,
      usageCount: 0,
      lastUsedAt: 1000 - index,
    }));
    const merged = new Map<string, LabelSuggestion>();

    [...suggestions, ...defaults].forEach((suggestion) => {
      const normalized = normalizeLabel(suggestion.label);

      if (!normalized) {
        return;
      }

      const key = normalized.toLowerCase();
      const existing = merged.get(key);

      if (!existing || suggestion.usageCount > existing.usageCount || suggestion.lastUsedAt > existing.lastUsedAt) {
        merged.set(key, { ...suggestion, label: normalized });
      }
    });

    return [...merged.values()]
      .map((suggestion) => ({
        ...suggestion,
        score: labelMatchScore(suggestion.label, query),
      }))
      .filter((suggestion) => !query || suggestion.score > 0)
      .sort((first, second) => {
        if (second.score !== first.score) {
          return second.score - first.score;
        }

        if (second.lastUsedAt !== first.lastUsedAt) {
          return second.lastUsedAt - first.lastUsedAt;
        }

        return second.usageCount - first.usageCount;
      })
      .slice(0, 5);
  }, [query, suggestions]);

  const commitValue = useCallback(
    (nextValue: string) => {
      const normalized = normalizeLabel(nextValue);

      if (!normalized) {
        return;
      }

      onChange(normalized);
      onCommit(normalized);
    },
    [onChange, onCommit],
  );

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor={id}>
        {label}
      </label>
      <div className="relative h-11 overflow-visible">
        <Tags className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            commitValue(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitValue(value);
            }
          }}
          placeholder="Home, Factory, Warehouse..."
          className="liquid-input h-11 w-full rounded-[1.15rem] px-9 text-sm font-medium text-slate-950 outline-none transition duration-300 focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-400/15 dark:text-white dark:focus:border-cyan-200/40 dark:focus:ring-cyan-300/15"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {options.map((preset) => (
            <motion.button
              layout
              key={`${id}-${preset.id}`}
              type="button"
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={softSpringTransition}
              onClick={() => commitValue(preset.label)}
              className="liquid-chip px-3 py-1.5 text-xs font-semibold text-slate-600 transition duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:text-emerald-700 dark:text-slate-300 dark:hover:border-emerald-300/40 dark:hover:text-emerald-100"
            >
              {highlightLabelMatch(preset.label, query)}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function DistanceVisualizer() {
  const [routes, setRoutes] = useState<RouteEntry[]>(INITIAL_ROUTES);
  const [labelSuggestions, setLabelSuggestions] = useState<LabelSuggestion[]>([]);
  const [user, setUser] = useState<AppUser>();
  const [authLoading, setAuthLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<Panel>("plan");
  const [savedAt, setSavedAt] = useState<string>();
  const [startSearch, setStartSearch] = useState("");
  const [endSearch, setEndSearch] = useState("");
  const [selectedStart, setSelectedStart] = useState<Location>();
  const [selectedEnd, setSelectedEnd] = useState<Location>();
  const [focusLocation, setFocusLocation] = useState<Location>();
  const [draftRoute, setDraftRoute] = useState<RouteEntry>();
  const [startLabel, setStartLabel] = useState("Home");
  const [endLabel, setEndLabel] = useState("Office");
  const [color, setColor] = useState(COLORS[1]);
  const [theme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lanesOverviewOpen, setLanesOverviewOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.sessionStorage.getItem(DASHBOARD_COLLAPSED_SESSION_KEY) === "true";
  });
  const [introVisible, setIntroVisible] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>("idle");
  const [cloudError, setCloudError] = useState<string>();
  const [toast, setToast] = useState<{ tone: "success" | "error" | "info"; message: string }>();
  const [deletingRouteIds, setDeletingRouteIds] = useState<Set<number>>(new Set());
  const [exportLoading, setExportLoading] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionSnapshot>(FREE_SUBSCRIPTION);
  const [billingStatus, setBillingStatus] = useState<BillingStatus>("idle");
  const [billingError, setBillingError] = useState<string>();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const requestedRouteIds = useRef(new Set<number>());
  const pendingDeletedRouteIds = useRef(new Set<number>());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routeLinkAppliedRef = useRef(false);
  const authInitializedRef = useRef(false);

  const showToast = useCallback((message: string, tone: "success" | "error" | "info" = "info") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(undefined), 3200);
  }, []);

  const waitForAuthUser = useCallback(async () => {
    const auth = getFirebaseAuth();

    if (!auth) {
      throw new Error("Firebase Authentication could not start.");
    }

    if (authInitializedRef.current) {
      return auth.currentUser;
    }

    console.info("[Firebase Auth] Waiting for auth initialization before protected API request", {
      hasCurrentUser: Boolean(auth.currentUser),
      authLoading,
    });

    return new Promise<FirebaseUser | null>((resolve) => {
      let unsubscribe: () => void = () => undefined;
      const timeout = window.setTimeout(() => {
        unsubscribe();
        authInitializedRef.current = true;
        console.warn("[Firebase Auth] Auth initialization wait timed out", {
          hasCurrentUser: Boolean(auth.currentUser),
        });
        resolve(auth.currentUser);
      }, 8000);

      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        window.clearTimeout(timeout);
        authInitializedRef.current = true;
        console.info("[Firebase Auth] Auth initialization resolved for protected API request", {
          currentUserExists: Boolean(firebaseUser),
          uid: firebaseUser?.uid ?? null,
        });
        resolve(firebaseUser);
      });
    });
  }, [authLoading]);

  const getAuthToken = useCallback(async (forceRefresh = false) => {
    const auth = getFirebaseAuth();
    const currentUser = auth?.currentUser ?? (await waitForAuthUser());

    console.info("[Firebase Auth] Preparing token for protected API request", {
      currentUserExists: Boolean(currentUser),
      hasAuth: Boolean(auth),
      appUserUid: user?.uid ?? null,
      forceRefresh,
    });

    if (!currentUser) {
      console.warn("[Firebase Auth] Protected API token requested without an authenticated user", {
        hasAuth: Boolean(auth),
        appUserUid: user?.uid ?? null,
      });
      throw new Error("Please sign in again to continue.");
    }

    if (user?.uid && currentUser.uid !== user.uid) {
      console.warn("[Firebase Auth] Auth user mismatch before protected API request", {
        appUserUid: user.uid,
        firebaseUserUid: currentUser.uid,
      });
    }

    if (forceRefresh) {
      console.info("[Firebase Auth] Force-refreshing ID token for protected API request", {
        uid: currentUser.uid,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });

      try {
        const refreshedToken = await currentUser.getIdToken(true);
        console.info("[Firebase Auth] Token retrieval succeeded", {
          uid: currentUser.uid,
          forceRefresh: true,
          tokenLength: refreshedToken.length,
        });
        return refreshedToken;
      } catch (error) {
        console.warn("[Firebase Auth] Token retrieval failed", {
          uid: currentUser.uid,
          forceRefresh: true,
          message: error instanceof Error ? error.message : "Unknown token retrieval error.",
        });
        throw error;
      }
    }

    let token: string;
    let tokenResult: Awaited<ReturnType<typeof currentUser.getIdTokenResult>>;

    try {
      token = await currentUser.getIdToken();
      tokenResult = await currentUser.getIdTokenResult();
      console.info("[Firebase Auth] Token retrieval succeeded", {
        uid: currentUser.uid,
        forceRefresh: false,
        tokenLength: token.length,
      });
    } catch (error) {
      console.warn("[Firebase Auth] Token retrieval failed", {
        uid: currentUser.uid,
        forceRefresh: false,
        message: error instanceof Error ? error.message : "Unknown token retrieval error.",
      });
      throw error;
    }

    const expiresAt = Date.parse(tokenResult.expirationTime);
    const shouldRefresh =
      !Number.isFinite(expiresAt) || expiresAt - Date.now() <= FIREBASE_TOKEN_REFRESH_BUFFER_MS;

    console.info("[Firebase Auth] Prepared ID token for protected API request", {
      uid: currentUser.uid,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      expiresAt: tokenResult.expirationTime,
      refreshBuffered: shouldRefresh,
    });

    if (!shouldRefresh) {
      return token;
    }

    console.info("[Firebase Auth] Refreshing ID token before protected API request");
    return currentUser.getIdToken(true);
  }, [user?.uid, waitForAuthUser]);

  const fetchWithFirebaseAuth = useCallback(
    async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const run = async (forceRefresh: boolean) => {
        const token = await getAuthToken(forceRefresh);
        const authorizationHeader = token ? `Bearer ${token}` : undefined;

        if (!authorizationHeader) {
          console.warn("[Firebase Auth] Prevented protected API request without token", {
            forceRefresh,
            tokenLength: token?.length ?? 0,
          });
          throw new Error("Please sign in again to continue.");
        }

        const headers = new Headers(init.headers);
        headers.set("Authorization", authorizationHeader);

        console.info("[Firebase Auth] Sending protected API request", {
          url: typeof input === "string" ? input : input.toString(),
          forceRefresh,
          tokenLength: token.length,
          authorizationHeaderSent: headers.has("Authorization"),
          authorizationFormat: "Bearer <token>",
        });

        return fetch(input, {
          ...init,
          headers,
        });
      };

      let response = await run(true);

      if (response.status !== 401) {
        return response;
      }

      const data = (await response.clone().json().catch(() => ({}))) as ApiErrorResponse;
      const refreshableTokenError =
        data.code === "TOKEN_EXPIRED" || data.code === "INVALID_TOKEN" || data.code === "AUTH_REQUIRED";

      if (!refreshableTokenError) {
        return response;
      }

      console.info("[Firebase Auth] Refreshing ID token after API auth failure", { code: data.code });
      response = await run(true);

      if (response.status === 401) {
        const retryData = (await response.clone().json().catch(() => ({}))) as ApiErrorResponse;

        if (retryData.code === "INVALID_TOKEN" || retryData.code === "AUTH_REQUIRED") {
          const error = new Error(authApiErrorMessage(retryData, "Please sign in again to continue."));
          error.name = retryData.code;
          throw error;
        }
      }

      return response;
    },
    [getAuthToken],
  );

  const openUpgradeModal = useCallback(() => {
    setBillingError(undefined);
    setUpgradeModalOpen(true);
  }, []);

  const resetSignedOutState = useCallback((preserveAuthenticating = false) => {
    setUser(undefined);
    setRoutes(INITIAL_ROUTES);
    setLabelSuggestions([]);
    setCloudStatus((currentStatus) =>
      preserveAuthenticating && currentStatus === "authenticating" ? currentStatus : "idle",
    );
    setSavedAt(undefined);
    setSubscription(FREE_SUBSCRIPTION);
    setUpgradeModalOpen(false);
    setBillingStatus("idle");
    setBillingError(undefined);
    pendingDeletedRouteIds.current = new Set();
    setDeletingRouteIds(new Set());
  }, []);

  const refreshSubscription = useCallback(async () => {
    if (authLoading) {
      console.info("[Firebase Auth] Delaying subscription status request until auth initialization completes");
      return;
    }

    if (!user) {
      setSubscription(FREE_SUBSCRIPTION);
      return;
    }

    setBillingStatus("loading");

    try {
      const response = await fetchWithFirebaseAuth("/api/subscription/status");
      const data = (await response.json()) as {
        subscription?: SubscriptionSnapshot;
        error?: string;
        code?: string;
      };

      if (data.subscription) {
        setSubscription(data.subscription);
      }

      if (response.status === 401 && (data.code === "AUTH_REQUIRED" || data.code === "INVALID_TOKEN")) {
        console.warn("[Firebase Auth] Subscription status request was not authenticated", {
          code: data.code,
          hasAppUser: Boolean(user),
        });
        setBillingStatus("idle");
        setBillingError(undefined);
        return;
      }

      if (!response.ok || !data.subscription) {
        throw new Error(data.error ?? "Unable to load subscription.");
      }

      setBillingStatus("idle");
    } catch (error) {
      setBillingStatus("error");
      setBillingError(error instanceof Error ? error.message : "Unable to load subscription.");
    }
  }, [authLoading, fetchWithFirebaseAuth, user]);

  useEffect(() => {
    window.sessionStorage.setItem(DASHBOARD_COLLAPSED_SESSION_KEY, String(dashboardCollapsed));
  }, [dashboardCollapsed]);

  useEffect(() => {
    if (!mapFullscreen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMapFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mapFullscreen]);

  useEffect(() => {
    if (firebaseConfigError) {
      const timer = window.setTimeout(() => {
        authInitializedRef.current = true;
        setAuthLoading(false);
        setCloudStatus("error");
        setCloudError(`Missing Firebase config: ${firebaseConfigError}`);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const auth = getFirebaseAuth();

    if (!auth) {
      const timer = window.setTimeout(() => {
        authInitializedRef.current = true;
        setAuthLoading(false);
        setCloudStatus("error");
        setCloudError("Firebase Authentication could not be initialized.");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    authInitializedRef.current = false;
    let authStateResolved = false;
    const authReadyFallbackTimer = window.setTimeout(() => {
      if (authStateResolved) {
        return;
      }

      authStateResolved = true;
      authInitializedRef.current = true;
      setAuthLoading(false);

      if (!auth.currentUser) {
        resetSignedOutState();
      }
    }, 8000);

    void setPersistence(auth, browserLocalPersistence).catch(() => undefined);

    if (window.sessionStorage.getItem(AUTH_REDIRECT_PENDING_SESSION_KEY) === "true") {
      setCloudStatus("authenticating");
      setCloudError("Finishing Google sign-in...");
    }

    void getRedirectResult(auth)
      .then((result) => {
        window.sessionStorage.removeItem(AUTH_REDIRECT_PENDING_SESSION_KEY);

        if (result?.user) {
          setCloudStatus("ready");
          setCloudError(undefined);
          showToast("Signed in with Google.", "success");
        } else if (!auth.currentUser) {
          setCloudStatus("idle");
          setCloudError(undefined);
        }
      })
      .catch((error) => {
        window.sessionStorage.removeItem(AUTH_REDIRECT_PENDING_SESSION_KEY);
        setCloudStatus("error");
        setCloudError(googleAuthMessage(error));
        showToast("Google sign-in could not finish.", "error");
      });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      authStateResolved = true;
      authInitializedRef.current = true;
      window.clearTimeout(authReadyFallbackTimer);
      setAuthLoading(false);

      if (!firebaseUser) {
        resetSignedOutState(true);
        return;
      }

      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? "",
        name: firebaseUser.displayName ?? firebaseUser.email ?? "Google user",
        photoURL: firebaseUser.photoURL ?? undefined,
      });
      setAvatarFailed(false);

      void firebaseUser
        .getIdTokenResult(true)
        .then((tokenResult) => {
          console.info("[Firebase Auth] Primed fresh ID token after auth state change", {
            uid: firebaseUser.uid,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            expiresAt: tokenResult.expirationTime,
            signInProvider: tokenResult.signInProvider,
          });
        })
        .catch((error) => {
          console.warn("[Firebase Auth] Could not refresh ID token after auth state change", {
            uid: firebaseUser.uid,
            message: error instanceof Error ? error.message : "Unknown token refresh error.",
          });
        });
    });

    return () => {
      window.clearTimeout(authReadyFallbackTimer);
      unsubscribe();
    };
  }, [resetSignedOutState, showToast]);

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  useEffect(() => {
    const checkoutStatus = new URLSearchParams(window.location.search).get("razorpay");

    if (checkoutStatus === "success") {
      showToast("Payment verified. RouteVision Pro is active.", "success");
      void refreshSubscription();
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (checkoutStatus === "cancelled") {
      showToast("Razorpay checkout closed.", "info");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refreshSubscription, showToast]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const loadingTimer = window.setTimeout(() => {
      setCloudStatus("loading");
      setCloudError(undefined);
    }, 0);

    if (firebaseConfigError) {
      const errorTimer = window.setTimeout(() => {
        setCloudStatus("error");
        setCloudError(`Missing Firebase config: ${firebaseConfigError}`);
      }, 0);

      return () => {
        window.clearTimeout(loadingTimer);
        window.clearTimeout(errorTimer);
      };
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToUserRoutes(
        user.uid,
        (cloudRoutes, fromCache) => {
          const nextRoutes = filterDeletedRoutes(cloudRoutes, pendingDeletedRouteIds.current);
          setRoutes(nextRoutes);
          setSavedAt(fromCache ? "Loaded Firestore cache" : "Cloud synced");
          setCloudStatus("ready");
          setCloudError(undefined);
        },
        (error) => {
          window.setTimeout(() => {
            setRoutes(INITIAL_ROUTES);
            setCloudStatus("error");
            setCloudError(error.message);
            showToast("Could not load route history.", "error");
          }, 0);
        },
      );
    } catch (error) {
      const timer = window.setTimeout(() => {
        setRoutes(INITIAL_ROUTES);
        setCloudStatus("error");
        setCloudError(error instanceof Error ? error.message : "Unable to load route history.");
        showToast("Could not load route history.", "error");
      }, 0);

      return () => {
        window.clearTimeout(loadingTimer);
        window.clearTimeout(timer);
      };
    }

    return () => {
      window.clearTimeout(loadingTimer);
      unsubscribe?.();
    };
  }, [showToast, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToUserSubscription(
        user.uid,
        (nextSubscription) => setSubscription(nextSubscription),
        () => {
          showToast("Could not sync billing status.", "error");
        },
      );
    } catch (error) {
      setBillingStatus("error");
      setBillingError(error instanceof Error ? error.message : "Unable to sync billing status.");
    }

    return () => unsubscribe?.();
  }, [showToast, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToUserLabels(
        user.uid,
        (labels) => setLabelSuggestions(labels),
        () => {
          showToast("Could not sync label suggestions.", "error");
        },
      );
    } catch {
      showToast("Could not sync label suggestions.", "error");
    }

    return () => unsubscribe?.();
  }, [showToast, user]);

  useEffect(() => {
    if (routeLinkAppliedRef.current || routes.length === 0 || typeof window === "undefined") {
      return;
    }

    const routeId = Number(new URLSearchParams(window.location.search).get("route"));

    if (!Number.isFinite(routeId)) {
      return;
    }

    const linkedRoute = routes.find((route) => route.id === routeId);

    if (!linkedRoute) {
      return;
    }

    routeLinkAppliedRef.current = true;
    setRoutes((currentRoutes) =>
      currentRoutes.map((route) => ({ ...route, visible: route.id === routeId })),
    );
    setFocusLocation(linkedRoute.start);
    setActivePanel("plan");
    showToast("Opened linked route only.", "success");
  }, [routes, showToast]);

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
    if (!selectedStart || !selectedEnd || selectedStart.name === selectedEnd.name) {
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
      createdDate: "",
      createdTime: "",
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
  const analyticsRoutes = visibleRoutes;
  const isPro = subscription.isPro;
  const laneCount = routes.length;
  const freeLaneUsage = Math.min(laneCount, FREE_LANE_LIMIT);
  const remainingFreeLanes = isPro ? null : Math.max(FREE_LANE_LIMIT - laneCount, 0);
  const laneUsagePercent = isPro ? 100 : Math.min((laneCount / FREE_LANE_LIMIT) * 100, 100);
  const laneLimitReached = !isPro && laneCount >= FREE_LANE_LIMIT;
  const totalTravelDistance = analyticsRoutes.reduce(
    (sum, route) => sum + routeMetrics(route).travelDistance,
    0,
  );
  const totalTravelTime = analyticsRoutes.reduce((sum, route) => sum + routeMetrics(route).travelTime, 0);
  const canAddRoute = Boolean(user && selectedStart && selectedEnd && selectedStart.name !== selectedEnd.name);
  const routeComparisons = [...analyticsRoutes].sort(
    (firstRoute, secondRoute) => routeMetrics(firstRoute).travelTime - routeMetrics(secondRoute).travelTime,
  );
  const routeHistory = [...routes].sort((firstRoute, secondRoute) => secondRoute.createdAt - firstRoute.createdAt);
  const trafficSummary = analyticsRoutes.reduce(
    (summary, route) => {
      const traffic = trafficProfile(route).label;
      return { ...summary, [traffic]: summary[traffic] + 1 };
    },
    { Clear: 0, Moderate: 0, Heavy: 0 },
  );
  const averageTravelTime = totalTravelTime / Math.max(analyticsRoutes.length, 1);
  const analyticsData = analyticsRoutes.map((route, index) => {
    const metrics = routeMetrics(route);
    return {
      id: route.id,
      name: shortRouteName(route),
      distance: Math.round(metrics.travelDistance),
      time: Number(metrics.travelTime.toFixed(1)),
      color: route.color,
      order: index + 1,
    };
  });
  const longestRoute = [...analyticsRoutes].sort(
    (firstRoute, secondRoute) => routeMetrics(secondRoute).travelDistance - routeMetrics(firstRoute).travelDistance,
  )[0];
  const shortestRoute = [...analyticsRoutes].sort(
    (firstRoute, secondRoute) => routeMetrics(firstRoute).travelDistance - routeMetrics(secondRoute).travelDistance,
  )[0];
  const fastestRoute = [...analyticsRoutes].sort(
    (firstRoute, secondRoute) => routeMetrics(firstRoute).travelTime - routeMetrics(secondRoute).travelTime,
  )[0];
  const slowestRoute = [...analyticsRoutes].sort(
    (firstRoute, secondRoute) => routeMetrics(secondRoute).travelTime - routeMetrics(firstRoute).travelTime,
  )[0];
  const axisColor = theme === "dark" ? "#94a3b8" : "#64748b";
  const gridColor = theme === "dark" ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.18)";

  const commitLabel = useCallback(
    (label: string) => {
      if (!user) {
        return;
      }

      const normalized = normalizeLabel(label);

      if (!normalized) {
        return;
      }

      void recordUserLabels(user.uid, [normalized]).catch(() => {
        showToast("Could not save label suggestion.", "error");
      });
    },
    [showToast, user],
  );

  const focusRouteOnMap = (route: RouteEntry) => {
    setFocusLocation(route.start);
    setLanesOverviewOpen(false);
    setSidebarOpen(false);
  };

  const openSubscriptionStatus = () => {
    void refreshSubscription();
    showToast("Subscription status refreshed.", "info");
  };

  const saveLaneOnServer = async (route: RouteEntry) => {
    const response = await fetchWithFirebaseAuth("/api/lanes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ route }),
    });
    const data = (await response.json()) as {
      subscription?: SubscriptionSnapshot;
      error?: string;
      code?: string;
    };

    if (data.subscription) {
      setSubscription(data.subscription);
    }

    if (!response.ok) {
      const error = new Error(data.error ?? "Unable to save lane.");
      error.name = data.code ?? "LANE_SAVE_ERROR";
      throw error;
    }
  };

  const addRoute = async () => {
    if (!user || !selectedStart || !selectedEnd || selectedStart.name === selectedEnd.name) {
      return;
    }

    if (laneLimitReached) {
      openUpgradeModal();
      showToast("Upgrade to Pro to save more than 10 lanes.", "info");
      return;
    }

    const nextColor = color || COLORS[routes.length % COLORS.length];
    const createdAt = Date.now();
    const dateParts = formatRouteDateParts(createdAt);
    const normalizedStartLabel = normalizeLabel(startLabel) || "Source";
    const normalizedEndLabel = normalizeLabel(endLabel) || "Destination";
    const route: RouteEntry = {
      id: createdAt,
      name: `${selectedStart.name} to ${selectedEnd.name}`,
      start: selectedStart,
      end: selectedEnd,
      color: nextColor,
      visible: true,
      createdAt,
      ...dateParts,
      geometry: draftRoute?.geometry,
      distanceMeters: draftRoute?.distanceMeters,
      durationSeconds: draftRoute?.durationSeconds,
      status: draftRoute?.status ?? "loading",
      error: draftRoute?.error,
      startLabel: normalizedStartLabel,
      endLabel: normalizedEndLabel,
    };

    setStartLabel(normalizedStartLabel);
    setEndLabel(normalizedEndLabel);
    setRoutes((currentRoutes) => [...currentRoutes, route]);
    setColor(COLORS[(routes.length + 1) % COLORS.length]);
    setSidebarOpen(false);
    setCloudStatus("saving");

    try {
      await saveLaneOnServer(route);
      await recordUserLabels(user.uid, [normalizedStartLabel, normalizedEndLabel]).catch(() => undefined);
      setCloudStatus("ready");
      setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      showToast("Route saved to history.", "success");
    } catch (error) {
      setRoutes((currentRoutes) => currentRoutes.filter((currentRoute) => currentRoute.id !== route.id));
      setCloudStatus("error");
      setCloudError(error instanceof Error ? error.message : "Unable to save route.");

      if (error instanceof Error && error.name === "LANE_LIMIT_REACHED") {
        setCloudStatus("ready");
        setCloudError(undefined);
        openUpgradeModal();
        showToast("You have used all 10 free lanes. Upgrade to add more.", "info");
        return;
      }

      showToast("Could not save route.", "error");
    }
  };

  const reopenRoute = async (route: RouteEntry) => {
    if (!user) {
      return;
    }

    const reopenedRoute = { ...route, visible: true };
    setRoutes((currentRoutes) =>
      currentRoutes.map((currentRoute) =>
        currentRoute.id === route.id ? reopenedRoute : currentRoute,
      ),
    );
    setFocusLocation(route.start);
    setActivePanel("plan");
    setSidebarOpen(false);

    try {
      await saveLaneOnServer(reopenedRoute);
      showToast("Route reopened on the map.", "success");
    } catch (error) {
      setCloudStatus("error");
      setCloudError(error instanceof Error ? error.message : "Unable to reopen route.");
      showToast("Could not update route visibility.", "error");
    }
  };

  const updateRouteVisibility = async (route: RouteEntry, visible: boolean) => {
    if (!user) {
      return;
    }

    const previousRoutes = routes;
    const updatedRoute = { ...route, visible };
    setRoutes((currentRoutes) =>
      currentRoutes.map((currentRoute) => (currentRoute.id === route.id ? updatedRoute : currentRoute)),
    );
    setCloudStatus("saving");

    try {
      await saveLaneOnServer(updatedRoute);
      setCloudStatus("ready");
      showToast(visible ? "Route restored to plan." : "Route removed from plan and kept in history.", "success");
    } catch (error) {
      setRoutes(previousRoutes);
      setCloudStatus("error");
      setCloudError(error instanceof Error ? error.message : "Unable to update route.");
      showToast("Could not update route.", "error");
    }
  };

  const deleteRouteFromHistory = async (route: RouteEntry) => {
    if (!user) {
      return;
    }

    const previousRoutes = routes;
    const nextRoutes = previousRoutes.filter((currentRoute) => currentRoute.id !== route.id);
    pendingDeletedRouteIds.current.add(route.id);
    setRoutes(nextRoutes);
    setDeletingRouteIds((currentIds) => new Set(currentIds).add(route.id));
    setCloudStatus("deleting");

    try {
      await deleteUserRoute(user.uid, route.id);
      setCloudStatus("ready");
      showToast("Route deleted from history.", "success");
    } catch (error) {
      pendingDeletedRouteIds.current.delete(route.id);
      setCloudStatus("error");
      setCloudError(error instanceof Error ? error.message : "Unable to delete route.");
      setRoutes(previousRoutes);
      showToast("Could not delete route.", "error");
    } finally {
      setDeletingRouteIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(route.id);
        return nextIds;
      });
    }
  };

  const clearPlanRoutes = async () => {
    if (!user) {
      return;
    }

    const previousRoutes = routes;
    const nextRoutes = routes.map((route) => ({ ...route, visible: false }));
    setRoutes(nextRoutes);
    setCloudStatus("saving");

    try {
      await Promise.all(nextRoutes.map((route) => saveLaneOnServer(route)));
      setCloudStatus("ready");
      showToast("Plan cleared. Routes remain in history.", "success");
    } catch (error) {
      setCloudStatus("error");
      setCloudError(error instanceof Error ? error.message : "Unable to clear plan.");
      setRoutes(previousRoutes);
      showToast("Could not clear plan.", "error");
    }
  };

  const signIn = async () => {
    if (firebaseConfigError) {
      setCloudStatus("error");
      setCloudError(`Missing Firebase config: ${firebaseConfigError}`);
      showToast("Firebase is not configured.", "error");
      return;
    }

    const auth = getFirebaseAuth();

    if (!auth) {
      showToast("Firebase Authentication could not start.", "error");
      return;
    }

    setCloudStatus("authenticating");
    setCloudError(undefined);

    try {
      await setPersistence(auth, browserLocalPersistence);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast("Signed in with Google.", "success");
    } catch (error) {
      const message = googleAuthMessage(error);

      if (isPopupFallbackError(error)) {
        setCloudError(message);
        showToast("Popup blocked. Redirecting to Google sign-in.", "info");

        try {
          window.sessionStorage.setItem(AUTH_REDIRECT_PENDING_SESSION_KEY, "true");
          await signInWithRedirect(auth, new GoogleAuthProvider());
        } catch (redirectError) {
          window.sessionStorage.removeItem(AUTH_REDIRECT_PENDING_SESSION_KEY);
          setCloudStatus("error");
          setCloudError(googleAuthMessage(redirectError));
          showToast("Google redirect sign-in failed.", "error");
        }

        return;
      }

      setCloudStatus("error");
      setCloudError(message);
      showToast(message, "error");
    }
  };

  const signOut = async () => {
    const auth = getFirebaseAuth();

    try {
      if (auth) {
        await signOutFirebase(auth);
      }
      setUser(undefined);
      setSavedAt(undefined);
      setCloudStatus("idle");
      setCloudError(undefined);
      setRoutes(INITIAL_ROUTES);
      setLabelSuggestions([]);
      showToast("Signed out.", "info");
    } catch (error) {
      setCloudStatus("error");
      setCloudError(error instanceof Error ? error.message : "Unable to sign out.");
      showToast("Unable to sign out.", "error");
    }
  };

  const exportMapImage = async () => {
    if (!isPro) {
      openUpgradeModal();
      showToast("Exports are included with RouteVision Pro.", "info");
      return;
    }

    const map = mapInstanceRef.current;

    if (!map || exportLoading) {
      return;
    }

    setExportLoading(true);

    try {
      map.invalidateSize();
      await new Promise((resolve) => window.setTimeout(resolve, 260));

      const container = map.getContainer();
      await waitForMapTiles(container);
      await decodeMapImages(container);

      const dataUrl = await toPng(container, {
        cacheBust: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2.5),
        backgroundColor: theme === "dark" ? "#020617" : "#dbeafe",
        style: {
          transform: "none",
        },
      });

      const link = document.createElement("a");
      link.download = `route-studio-map-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      showToast("Map exported as PNG.", "success");
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : "Unable to export map.");
      showToast("Could not export the rendered map.", "error");
    } finally {
      setExportLoading(false);
    }
  };

  const exportRouteSpreadsheet = () => {
    if (!isPro) {
      openUpgradeModal();
      showToast("Spreadsheet exports are included with RouteVision Pro.", "info");
      return;
    }

    if (routes.length === 0) {
      showToast("No saved routes to export.", "info");
      return;
    }

    const pageUrl = new URL(window.location.href);
    pageUrl.search = "";
    pageUrl.hash = "";

    const header = ["Where to where", "Source label", "Destination label", "Distance", "Time to travel", "Route link"];
    const rows = [...routes]
      .sort((firstRoute, secondRoute) => secondRoute.createdAt - firstRoute.createdAt)
      .map((route) => {
        const metrics = routeMetrics(route);
        const routeUrl = new URL(pageUrl);
        routeUrl.searchParams.set("route", String(route.id));

        return [
          placeDisplayName(route),
          displayLabel(route.startLabel, "Source"),
          displayLabel(route.endLabel, "Destination"),
          formatDistance(metrics.travelDistance),
          formatTime(metrics.travelTime),
          routeUrl.toString(),
        ];
      });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `routevision-routes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("Route spreadsheet exported.", "success");
  };

  const importCsv = async (file: File) => {
    if (!user) {
      return;
    }

    const rows = parseCsvRows(await file.text());
    let importedCount = 0;

    for (const row of rows) {
      if (!isPro && routes.length + importedCount >= FREE_LANE_LIMIT) {
        openUpgradeModal();
        showToast("Upgrade to Pro to import more than 10 lanes.", "info");
        break;
      }

      const source = row.source ?? row.start ?? "";
      const destination = row.destination ?? row.end ?? "";

      if (!source || !destination) {
        continue;
      }

      const [sourcePlace] = await searchPlaces(source);
      const [destinationPlace] = await searchPlaces(destination);
      const importedStartLabel = normalizeLabel(row.sourcelabel || row.startlabel || "Source") || "Source";
      const importedEndLabel = normalizeLabel(row.destinationlabel || row.endlabel || "Destination") || "Destination";

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
        ...formatRouteDateParts(Date.now()),
        status: "loading",
        startLabel: importedStartLabel,
        endLabel: importedEndLabel,
      };

      try {
        await saveLaneOnServer(importedRoute);
        setRoutes((currentRoutes) => [...currentRoutes, importedRoute]);
        importedCount += 1;
        void recordUserLabels(user.uid, [importedStartLabel, importedEndLabel]).catch(() => undefined);
      } catch (error) {
        if (error instanceof Error && error.name === "LANE_LIMIT_REACHED") {
          openUpgradeModal();
          showToast("Upgrade to Pro to import more lanes.", "info");
          break;
        }

        showToast("Could not import one of the lanes.", "error");
      }
    }
  };

  const shellClass =
    theme === "dark"
      ? "dark bg-[linear-gradient(135deg,#020617,#07111f_34%,#082f49_68%,#022c22)] text-white"
      : "bg-[linear-gradient(135deg,#f8fbff,#eef7ff_36%,#f3fbff_62%,#ecfdf5)] text-slate-950";
  const signInButtonLabel =
    cloudStatus === "authenticating"
      ? cloudError?.startsWith("Finishing")
        ? "Finishing Google sign-in..."
        : cloudError?.includes("Redirecting")
          ? "Redirecting to Google..."
          : "Opening Google..."
      : "Continue with Google";

  if (authLoading) {
    return (
      <main className={`grid h-dvh place-items-center overflow-hidden p-6 ${shellClass}`}>
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={softSpringTransition}
          className="liquid-panel rounded-[1.5rem] px-6 py-5 text-sm font-semibold text-slate-600 dark:text-slate-200"
        >
          Loading secure workspace...
        </motion.div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className={`grid h-dvh place-items-center overflow-hidden p-6 ${shellClass}`}>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={springTransition}
            className="liquid-card fixed right-5 top-5 z-[1200] rounded-[1.25rem] px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-200"
          >
            {toast.message}
          </motion.div>
        ) : null}
        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springTransition}
          className="liquid-panel w-full max-w-md overflow-hidden rounded-[2rem] p-6"
        >
          <div className="liquid-button-primary mb-6 grid size-12 place-items-center rounded-[1.15rem] text-white">
            <ShieldCheck className="size-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-cyan-300">
            Secure workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
            Sign in to RouteVision
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            Use Google to keep your route history private and synced across devices.
          </p>
          <div className="mt-6 grid gap-3">
            <motion.button
              type="button"
              onClick={() => void signIn()}
              disabled={cloudStatus === "authenticating"}
              whileHover={cloudStatus === "authenticating" ? undefined : { y: -3, scale: 1.01 }}
              whileTap={cloudStatus === "authenticating" ? undefined : liquidTap}
              transition={springTransition}
              className="liquid-button-primary mt-2 flex h-12 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55"
            >
              <User className="size-4" />
              {signInButtonLabel}
            </motion.button>
            {cloudError ? <p className="text-sm font-medium text-red-600 dark:text-red-300">{cloudError}</p> : null}
          </div>
        </motion.section>
      </main>
    );
  }

  const sidebar = (
    <motion.aside
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={softSpringTransition}
      className="liquid-panel flex h-full w-full flex-col overflow-hidden rounded-none transition-colors lg:m-4 lg:h-[calc(100%-2rem)] lg:w-[430px] lg:rounded-[2rem]"
    >
      <div
        className={`relative overflow-hidden border-b border-slate-200/70 px-5 transition-all duration-300 ease-out dark:border-white/10 ${
          dashboardCollapsed ? "py-3" : "py-5"
        }`}
      >
        <div className="liquid-glow-line absolute inset-x-0 top-0 h-1" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p
              className={`flex items-center gap-2 text-xs font-semibold uppercase text-blue-600 transition-all duration-300 dark:text-cyan-300 ${
                dashboardCollapsed ? "tracking-[0.14em]" : "tracking-[0.24em]"
              }`}
            >
              <Sparkles className="size-3.5" />
              RouteVision
            </p>
            <h1
              className={`font-semibold leading-tight tracking-tight text-slate-950 transition-all duration-300 dark:text-white ${
                dashboardCollapsed ? "mt-1 text-lg" : "mt-2 text-[2rem]"
              }`}
            >
              RouteVision
            </h1>
            <div
              className={`grid transition-all duration-300 ease-out ${
                dashboardCollapsed ? "max-h-0 overflow-hidden opacity-0" : "max-h-40 opacity-100"
              }`}
            >
              <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                Plan road lanes, facilities, and ETAs across India.
              </p>
              <div
                className={`liquid-card mt-4 flex items-center gap-3 rounded-[1.25rem] p-2 ${
                  isPro ? "premium-glass" : ""
                }`}
              >
                {user.photoURL && !avatarFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="size-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid size-9 place-items-center rounded-full bg-slate-950 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{user.name}</p>
                  <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={isPro ? openSubscriptionStatus : openUpgradeModal}
                  className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-[1rem] px-2.5 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 ${
                    isPro
                      ? "premium-badge-glow border border-emerald-300/70 bg-emerald-400/15 text-emerald-700 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-200"
                      : "liquid-chip text-blue-700 dark:text-cyan-200"
                  }`}
                >
                  <Crown className="size-3.5" />
                  {isPro ? "Premium" : "Free"}
                </button>
                <button
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void signOut()}
                  className="liquid-button grid size-9 shrink-0 place-items-center rounded-[1rem] text-slate-600 transition duration-300 hover:-translate-y-0.5 dark:text-slate-200"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="liquid-card flex shrink-0 items-center gap-2 rounded-[1.35rem] p-1.5">
            <button
              type="button"
              aria-label={dashboardCollapsed ? "Expand dashboard panel" : "Minimize dashboard panel"}
              onClick={() => setDashboardCollapsed((currentValue) => !currentValue)}
              className="liquid-button grid size-10 place-items-center rounded-[1.15rem] text-slate-600 transition duration-300 hover:-translate-y-0.5 dark:text-slate-200"
            >
              {dashboardCollapsed ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
            </button>
            <button
              type="button"
              aria-label={mapFullscreen ? "Exit fullscreen map" : "Open fullscreen map"}
              onClick={() => {
                setMapFullscreen((currentValue) => !currentValue);
                setSidebarOpen(false);
              }}
              className="liquid-button grid size-10 place-items-center rounded-[1.15rem] text-slate-600 transition duration-300 hover:-translate-y-0.5 dark:text-slate-200"
            >
              {mapFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
            </button>
          </div>
        </div>
        <div className={`${dashboardCollapsed ? "mt-3" : "mt-4"} flex flex-wrap items-center gap-2 transition-all duration-300`}>
          {(["plan", "history", "analytics", "compare"] as Panel[]).map((panel) => (
            <button
              key={panel}
              type="button"
              onClick={() => setActivePanel(panel)}
              className={`liquid-chip px-3 py-1.5 text-xs font-semibold capitalize transition ${
                activePanel === panel
                  ? "liquid-chip-active"
                  : "text-slate-600 hover:border-cyan-200/80 dark:text-slate-300"
              }`}
            >
              {panel}
            </button>
          ))}
          <span className="ml-auto text-xs font-medium text-slate-500 dark:text-slate-400">
            {savedAt ? `Saved: ${savedAt}` : "Private cloud history"}
          </span>
        </div>
        <div
          className={`rounded-xl border px-3 text-xs font-semibold transition-all duration-300 ${
            dashboardCollapsed ? "mt-0 max-h-0 overflow-hidden border-transparent py-0 opacity-0" : "mt-3 max-h-20 py-2 opacity-100"
          } ${
            cloudStatus === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200"
              : "liquid-card text-slate-600 dark:text-slate-300"
          }`}
        >
          {cloudStatus === "loading"
            ? "Loading saved routes from Firestore..."
            : cloudStatus === "saving"
              ? "Saving routes to Firestore..."
              : cloudStatus === "deleting"
                ? "Deleting route history..."
                : cloudStatus === "error"
                  ? cloudError ?? "Cloud sync is unavailable."
                  : "Cloud sync active across devices"}
        </div>
        <div
          className={`liquid-card rounded-[1.25rem] px-3 transition-all duration-300 ${
            isPro ? "premium-glass" : ""
          } ${
            dashboardCollapsed ? "mt-0 max-h-0 overflow-hidden py-0 opacity-0" : "mt-3 max-h-32 py-3 opacity-100"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-950 dark:text-white">
                {isPro ? (
                  <>
                    <Crown className="size-3.5 text-emerald-600 dark:text-emerald-300" />
                    Unlimited Pro lanes
                  </>
                ) : (
                  <>
                    <Route className="size-3.5 text-blue-600 dark:text-cyan-300" />
                    {freeLaneUsage}/{FREE_LANE_LIMIT} free lanes used
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {isPro
                  ? "Advanced analytics, exports, and priority sync are active."
                  : `${remainingFreeLanes} free ${remainingFreeLanes === 1 ? "lane" : "lanes"} remaining before Pro`}
              </p>
            </div>
            <button
              type="button"
              onClick={isPro ? openSubscriptionStatus : openUpgradeModal}
              className={`flex shrink-0 items-center gap-1.5 rounded-[1rem] px-3 py-2 text-xs font-semibold transition hover:-translate-y-0.5 ${
                isPro
                  ? "liquid-chip text-blue-700 dark:text-cyan-200"
                  : "liquid-button-primary text-white"
              }`}
            >
              {isPro ? <CreditCard className="size-3.5" /> : <Crown className="size-3.5" />}
              {isPro ? "Status" : "Upgrade Pro"}
            </button>
          </div>
          <div
            role="progressbar"
            aria-label={isPro ? "Pro lane usage" : `${freeLaneUsage} of ${FREE_LANE_LIMIT} free lanes used`}
            aria-valuemin={0}
            aria-valuemax={FREE_LANE_LIMIT}
            aria-valuenow={isPro ? FREE_LANE_LIMIT : freeLaneUsage}
            className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10"
          >
            <motion.div
              className={`h-full rounded-full ${
                isPro ? "bg-emerald-400" : laneLimitReached ? "bg-orange-400" : "bg-blue-500"
              }`}
              initial={false}
              animate={{ width: `${laneUsagePercent}%` }}
              transition={springTransition}
            />
          </div>
        </div>
      </div>

      <div
        className={`grid grid-cols-3 gap-3 overflow-hidden border-b border-slate-200/70 transition-all duration-300 ease-out dark:border-white/10 ${
          dashboardCollapsed ? "max-h-0 border-b-0 p-0 opacity-0" : "max-h-40 p-5 opacity-100"
        }`}
      >
        <motion.div
          whileHover={liquidHover}
          transition={springTransition}
          className="liquid-card rounded-[1.35rem] p-4 text-slate-950 dark:text-white"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active lanes</p>
          <p className="mt-2 text-3xl font-semibold">{visibleRoutes.length}</p>
        </motion.div>
        <motion.div
          whileHover={liquidHover}
          transition={springTransition}
          className="liquid-card rounded-[1.35rem] p-4 text-blue-950 dark:text-cyan-100"
        >
          <p className="text-xs font-medium text-blue-700 dark:text-cyan-300">Distance</p>
          <p className="mt-2 text-xl font-semibold">{formatDistance(totalTravelDistance)}</p>
        </motion.div>
        <motion.div
          whileHover={liquidHover}
          transition={springTransition}
          className="liquid-card rounded-[1.35rem] p-4 text-emerald-950 dark:text-emerald-100"
        >
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Time</p>
          <p className="mt-2 text-xl font-semibold">{formatTime(totalTravelTime)}</p>
        </motion.div>
      </div>

      <div
        className={`${activePanel === "plan" ? "flex" : "hidden"} liquid-scroll flex-1 flex-col overflow-y-auto transition-all duration-300 ${
          dashboardCollapsed ? "space-y-4 p-3" : "space-y-6 p-5"
        }`}
      >
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Plus className="size-5 text-blue-600 dark:text-cyan-300" />
              <h2 className="text-base font-semibold">Create lane</h2>
            </div>
            <button
              type="button"
              onClick={() => void clearPlanRoutes()}
              disabled={visibleRoutes.length === 0 || cloudStatus === "saving"}
              className="liquid-button rounded-[1rem] px-3 py-2 text-xs font-semibold text-slate-600 transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300"
            >
              Clear plan
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
            <div className="liquid-card grid gap-4 rounded-[1.35rem] p-3">
              <LabelInput
                id="source-label"
                label="Source label"
                value={startLabel}
                onChange={setStartLabel}
                suggestions={labelSuggestions}
                onCommit={commitLabel}
              />
              <LabelInput
                id="destination-label"
                label="Destination label"
                value={endLabel}
                onChange={setEndLabel}
                suggestions={labelSuggestions}
                onCommit={commitLabel}
              />
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
                    className="liquid-route-dot grid size-9 place-items-center rounded-full border border-white/80 shadow-sm transition hover:-translate-y-0.5 dark:border-white/20"
                    style={{ "--route-color": swatch, backgroundColor: swatch } as RouteColorStyle}
                  >
                    {color.toLowerCase() === swatch ? <Check className="size-4 text-white" /> : null}
                  </button>
                ))}
              </div>
            </div>

            {selectedStart && selectedEnd && selectedStart.name !== selectedEnd.name ? (
              <div className="liquid-card grid grid-cols-2 gap-3 rounded-[1.35rem] p-3 text-sm">
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

            <motion.button
              type="button"
              onClick={() => void addRoute()}
              disabled={!canAddRoute}
              whileHover={!canAddRoute ? undefined : { y: -4, scale: 1.01 }}
              whileTap={!canAddRoute ? undefined : liquidTap}
              transition={springTransition}
              className="liquid-button-primary flex h-12 items-center justify-center gap-2 rounded-[1.15rem] px-4 text-sm font-semibold text-white transition duration-300 disabled:cursor-not-allowed disabled:opacity-45 dark:text-white"
            >
              {laneLimitReached ? <Crown className="size-4" /> : <Route className="size-4" />}
              {laneLimitReached ? "Upgrade to add lane" : "Add lane"}
            </motion.button>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="liquid-button flex h-11 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:text-slate-200"
              >
                <Upload className="size-4" />
                CSV upload
              </button>
              <button
                type="button"
                onClick={() => void exportMapImage()}
                disabled={exportLoading}
                className="liquid-button flex h-11 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 dark:text-slate-200"
              >
                {exportLoading ? (
                  <span className="size-4 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin dark:border-slate-600 dark:border-t-white" />
                ) : (
                  <Download className="size-4" />
                )}
                {exportLoading ? "Exporting..." : isPro ? "Export map" : "Export map Pro"}
              </button>
              <button
                type="button"
                onClick={exportRouteSpreadsheet}
                disabled={routes.length === 0}
                className="liquid-button col-span-2 flex h-11 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-200"
              >
                {isPro ? <Download className="size-4" /> : <Crown className="size-4" />}
                {isPro ? "Export spreadsheet" : "Export spreadsheet Pro"}
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
            {visibleRoutes.length === 0 ? (
              <div className="liquid-card rounded-[1.35rem] border-dashed p-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                No active lanes in this plan.
              </div>
            ) : null}
            {visibleRoutes.map((route) => {
              const metrics = routeMetrics(route);
              const isDeleting = deletingRouteIds.has(route.id);

              return (
                <motion.article
                  key={route.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={liquidHover}
                  transition={springTransition}
                  className="liquid-card relative overflow-hidden rounded-[1.5rem] p-4"
                >
                  <div
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{
                      background: `linear-gradient(90deg, ${route.color}, color-mix(in srgb, ${route.color} 58%, white))`,
                      boxShadow: `0 0 22px ${route.color}55`,
                    }}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="liquid-route-dot size-3 shrink-0 rounded-full"
                          style={{ "--route-color": route.color, backgroundColor: route.color } as RouteColorStyle}
                        />
                        <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {laneDisplayName(route)}
                        </h3>
                      </div>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500/80 dark:text-slate-400/80">
                        {placeDisplayName(route)}
                      </p>
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <span className="liquid-chip px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                          {displayLabel(route.startLabel, "Source")}
                        </span>
                        <span className="truncate">{route.start.name}</span>
                        <ArrowRight className="size-4 shrink-0 text-slate-400" />
                        <span className="liquid-chip px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
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
                        disabled={isDeleting}
                        onClick={() => void updateRouteVisibility(route, !route.visible)}
                        className="liquid-button grid size-8 place-items-center rounded-xl text-slate-600 transition duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200"
                      >
                        <MapPin className={route.visible ? "size-4" : "size-4 opacity-35"} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${route.name} from plan`}
                        disabled={isDeleting}
                        onClick={() => void updateRouteVisibility(route, false)}
                        className="liquid-button grid size-8 place-items-center rounded-xl text-slate-500 transition duration-300 hover:-translate-y-0.5 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:text-red-300"
                      >
                        {isDeleting ? <span className="size-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" /> : <Trash2 className="size-4" />}
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
                </motion.article>
              );
            })}
          </div>
        </section>
      </div>

      <div className={`${activePanel === "history" ? "block" : "hidden"} liquid-scroll flex-1 overflow-y-auto p-5`}>
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-slate-950 dark:text-white">
              <Clock3 className="size-5 text-blue-600 dark:text-cyan-300" />
              <h2 className="text-base font-semibold">Route history</h2>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Newest first
            </span>
          </div>

          {cloudStatus === "loading" ? (
            <div className="liquid-card rounded-[1.35rem] p-4 text-sm font-semibold text-slate-500 dark:text-slate-300">
              Loading route history...
            </div>
          ) : routeHistory.length === 0 ? (
            <div className="liquid-card rounded-[1.35rem] border-dashed p-5 text-sm font-medium text-slate-500 dark:text-slate-400">
              Saved routes will appear here after you create your first lane.
            </div>
          ) : (
            <div className="space-y-3">
              {routeHistory.map((route) => {
                const metrics = routeMetrics(route);
                const isDeleting = deletingRouteIds.has(route.id);

                return (
                  <motion.article
                    key={`history-${route.id}`}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    whileHover={liquidHover}
                    transition={springTransition}
                    className="liquid-card relative overflow-hidden rounded-[1.5rem] p-4"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1.5"
                      style={{
                        background: `linear-gradient(90deg, ${route.color}, color-mix(in srgb, ${route.color} 58%, white))`,
                        boxShadow: `0 0 22px ${route.color}55`,
                      }}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                          {laneDisplayName(route)}
                        </h3>
                        <p className="mt-1 truncate text-xs font-medium text-slate-500/80 dark:text-slate-400/80">
                          {placeDisplayName(route)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          {route.createdDate} at {route.createdTime}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">
                          {formatDistance(metrics.travelDistance)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => void reopenRoute(route)}
                          disabled={isDeleting}
                          className="liquid-button rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-200"
                        >
                          Reopen
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${route.name}`}
                          onClick={() => void deleteRouteFromHistory(route)}
                          disabled={isDeleting}
                          className="liquid-button grid size-8 place-items-center rounded-xl text-slate-500 transition duration-300 hover:-translate-y-0.5 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:text-red-300"
                        >
                          {isDeleting ? <span className="size-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" /> : <Trash2 className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className={`${activePanel === "analytics" ? "block" : "hidden"} liquid-scroll flex-1 overflow-y-auto p-5`}>
        <section className="space-y-5">
          <div
            className={`flex items-start justify-between gap-3 rounded-[1.35rem] p-3 ${
              isPro ? "premium-glass" : ""
            }`}
          >
            <div className="flex items-center gap-2 text-slate-950 dark:text-white">
              <BarChart3 className="size-5 text-blue-600 dark:text-cyan-300" />
              <div>
                <h2 className="text-base font-semibold">Analytics dashboard</h2>
                {isPro ? (
                  <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    Premium analytics unlocked
                  </p>
                ) : null}
              </div>
            </div>
            <span
              className={`px-3 py-1.5 text-xs font-semibold ${
                isPro
                  ? "premium-badge-glow rounded-full border border-emerald-300/60 bg-emerald-400/15 text-emerald-700 dark:border-emerald-300/30 dark:text-emerald-200"
                  : "liquid-chip text-slate-500 dark:text-slate-300"
              }`}
            >
              {isPro ? `${analyticsRoutes.length} active Pro` : "Pro analytics"}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Total distance", value: formatDistance(totalTravelDistance), detail: "Active planned kilometers" },
              { label: "Average time", value: formatTime(averageTravelTime), detail: "Mean travel time" },
              {
                label: "Longest route",
                value: longestRoute ? laneDisplayName(longestRoute) : "No route",
                detail: longestRoute ? placeDisplayName(longestRoute) : "—",
              },
              {
                label: "Shortest route",
                value: shortestRoute ? laneDisplayName(shortestRoute) : "No route",
                detail: shortestRoute ? placeDisplayName(shortestRoute) : "—",
              },
              {
                label: "Fastest route",
                value: fastestRoute ? laneDisplayName(fastestRoute) : "No route",
                detail: fastestRoute ? placeDisplayName(fastestRoute) : "—",
              },
              {
                label: "Slowest route",
                value: slowestRoute ? laneDisplayName(slowestRoute) : "No route",
                detail: slowestRoute ? placeDisplayName(slowestRoute) : "—",
              },
            ].map(({ label, value, detail }) => (
              <motion.div
                key={label}
                whileHover={liquidHover}
                transition={springTransition}
                className={`liquid-card rounded-[1.35rem] p-4 ${isPro ? "premium-glass" : ""}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-2 truncate text-2xl font-semibold text-slate-950 dark:text-white">{value}</p>
                <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">{detail}</p>
              </motion.div>
            ))}
          </div>

          {!isPro ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={softSpringTransition}
              className="liquid-card overflow-hidden rounded-[1.5rem] p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">
                    <Crown className="size-4" />
                    Pro analytics
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                    Unlock charts, exports, and unlimited lanes
                  </h3>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Upgrade when your lane network grows past the free plan.
                  </p>
                </div>
                <span className="liquid-chip shrink-0 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {PRO_PRICE_DISPLAY}
                </span>
              </div>
              <button
                type="button"
                onClick={openUpgradeModal}
                className="liquid-button-primary mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-white transition hover:-translate-y-0.5"
              >
                <Crown className="size-4" />
                Upgrade to Pro
              </button>
            </motion.div>
          ) : analyticsData.length === 0 ? (
            <div className="liquid-card rounded-[1.35rem] border-dashed p-5 text-sm font-medium text-slate-500 dark:text-slate-400">
              Add or reopen routes in the plan to see charts.
            </div>
          ) : (
            <div className="grid gap-4">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={softSpringTransition}
                className={`liquid-card rounded-[1.5rem] p-4 ${isPro ? "premium-glass" : ""}`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Distance comparison</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Kilometers by active route</p>
                  </div>
                  <BarChart3 className="size-5 text-blue-600 dark:text-cyan-300" />
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData} margin={{ top: 10, right: 8, left: -18, bottom: 24 }}>
                      <CartesianGrid stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={48} />
                      <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)" }}
                        contentStyle={{
                          borderRadius: 12,
                          border: theme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
                          background: theme === "dark" ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.96)",
                          color: theme === "dark" ? "#f8fafc" : "#0f172a",
                        }}
                        formatter={(value) => [`${value} km`, "Distance"]}
                      />
                      <Bar dataKey="distance" radius={[8, 8, 2, 2]} animationDuration={900}>
                        {analyticsData.map((entry) => (
                          <Cell key={`distance-${entry.id}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={softSpringTransition}
                className={`liquid-card rounded-[1.5rem] p-4 ${isPro ? "premium-glass" : ""}`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Travel time trend</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">Hours across active routes</p>
                  </div>
                  <Activity className="size-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData} margin={{ top: 12, right: 16, left: -18, bottom: 24 }}>
                      <CartesianGrid stroke={gridColor} vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={48} />
                      <YAxis tick={{ fill: axisColor, fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 12,
                          border: theme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(15,23,42,0.12)",
                          background: theme === "dark" ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.96)",
                          color: theme === "dark" ? "#f8fafc" : "#0f172a",
                        }}
                        formatter={(value) => [`${value} h`, "Travel time"]}
                      />
                      <Line type="monotone" dataKey="time" stroke="#0891b2" strokeWidth={3} dot={{ r: 5, strokeWidth: 2 }} activeDot={{ r: 7 }} animationDuration={900} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          )}
        </section>
      </div>

      <div className={`${activePanel === "compare" ? "block" : "hidden"} liquid-scroll flex-1 overflow-y-auto p-5`}>
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
                <motion.article
                  key={`compare-${route.id}`}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  whileHover={liquidHover}
                  transition={springTransition}
                  className="liquid-card rounded-[1.5rem] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Rank {index + 1}
                      </p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{laneDisplayName(route)}</h3>
                      <p className="mt-1 truncate text-xs font-medium text-slate-500/80 dark:text-slate-400/80">
                        {placeDisplayName(route)}
                      </p>
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
                </motion.article>
              );
            })}
          </div>
        </section>
      </div>
    </motion.aside>
  );

  return (
    <main className={`relative h-dvh w-full overflow-hidden transition-colors duration-500 ${shellClass}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.32),transparent_28%,rgba(14,165,233,0.08)_56%,transparent_78%)] dark:bg-[linear-gradient(120deg,rgba(255,255,255,0.05),transparent_28%,rgba(34,211,238,0.08)_56%,transparent_78%)]" />
      <AnimatePresence>
        {toast ? (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={springTransition}
            className={`liquid-card fixed right-5 top-5 z-[1200] rounded-[1.25rem] px-4 py-3 text-sm font-semibold ${
              toast.tone === "error"
                ? "text-red-700 dark:text-red-200"
                : toast.tone === "success"
                  ? "text-emerald-700 dark:text-emerald-200"
                  : "text-slate-700 dark:text-slate-200"
            }`}
          >
            {toast.message}
          </motion.div>
        ) : null}
      </AnimatePresence>
      {introVisible ? (
        <div className="pointer-events-none fixed inset-0 z-[1000] grid place-items-center bg-slate-950 text-white animate-startup-fade">
          <div className="grid place-items-center gap-5">
            <div className="grid size-20 place-items-center rounded-2xl bg-cyan-300 text-slate-950 shadow-2xl shadow-cyan-300/30 animate-startup-pulse">
              <Route className="size-9" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200">
                RouteVision
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">Route analytics and lane planning</p>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {upgradeModalOpen ? (
          <motion.div
            key="upgrade-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="fixed inset-0 z-[1250] grid place-items-center overflow-y-auto bg-slate-950/62 p-4 backdrop-blur-2xl"
            onClick={() => setUpgradeModalOpen(false)}
          >
            <motion.section
              initial={{ opacity: 0, y: 28, scale: 0.94, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={springTransition}
              className="liquid-modal premium-modal-aura w-full max-w-lg overflow-hidden rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative overflow-hidden border-b border-white/25 px-6 py-5 dark:border-white/10">
                <div className="liquid-glow-line absolute inset-x-0 top-0 h-1" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-cyan-300">
                      <Crown className="size-4" />
                      RouteVision Pro
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
                      Build without lane limits
                    </h2>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      The first {FREE_LANE_LIMIT} saved lanes are free. Pro unlocks unlimited planning for growing route networks.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close upgrade modal"
                    onClick={() => setUpgradeModalOpen(false)}
                    className="liquid-button grid size-10 shrink-0 place-items-center rounded-[1.15rem] text-slate-700 transition hover:-translate-y-0.5 dark:text-slate-200"
                  >
                    <X className="size-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div className="liquid-card rounded-[1.5rem] p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        Monthly plan
                      </p>
                      <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
                        ₹100
                        <span className="text-base font-semibold text-slate-500 dark:text-slate-400">/month</span>
                      </p>
                    </div>
                    <span className="liquid-chip px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-200">
                      UPI, cards, netbanking
                    </span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-emerald-400"
                      initial={{ width: 0 }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["Unlimited lanes", "Save every route you need across devices."],
                    ["Advanced analytics", "Compare distance, ETA, and traffic trends."],
                    ["Exports", "Download map images and route spreadsheets."],
                    ["Priority cloud sync", "Keep planning data current across sessions."],
                    ["Razorpay checkout", "Test-mode upgrade with UPI, cards, and netbanking."],
                  ].map(([label, detail]) => (
                    <div key={label} className="flex gap-3">
                      <span className="liquid-button grid size-9 shrink-0 place-items-center rounded-[1rem] text-blue-600 dark:text-cyan-200">
                        <Zap className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-950 dark:text-white">{label}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {billingError ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                    {billingError}
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <RazorpayCheckout
                    billingStatus={billingStatus}
                    getAuthToken={getAuthToken}
                    userName={user.name}
                    userEmail={user.email}
                    onStart={() => {
                      setBillingStatus("redirecting");
                      setBillingError(undefined);
                    }}
                    onClose={() => {
                      setBillingStatus("idle");
                      showToast("Razorpay checkout closed.", "info");
                    }}
                    onError={(message) => {
                      setBillingStatus("error");
                      setBillingError(message);
                      showToast(message, "error");
                    }}
                    onSuccess={async () => {
                      setBillingStatus("idle");
                      setUpgradeModalOpen(false);
                      showToast("Payment verified. RouteVision Pro is active.", "success");
                      await refreshSubscription();
                    }}
                  />
                  <button
                    type="button"
                    onClick={isPro ? openSubscriptionStatus : () => setUpgradeModalOpen(false)}
                    className="liquid-button flex h-12 items-center justify-center gap-2 rounded-[1.15rem] text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 dark:text-slate-200"
                  >
                    <CreditCard className="size-4" />
                    {isPro ? "View status" : "Keep free plan"}
                  </button>
                </div>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div
        className={`absolute inset-y-0 left-0 z-[500] hidden transition-all duration-300 lg:block ${
          mapFullscreen ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        {sidebar}
      </div>

      {!mapFullscreen ? (
        <div
          className={`fixed inset-0 z-[700] bg-slate-950/45 transition-opacity duration-300 lg:hidden ${
            sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      {sidebarOpen && !mapFullscreen ? (
        <div className="fixed inset-y-0 left-0 z-[800] w-[min(92vw,410px)] animate-mobile-sidebar lg:hidden">
          {sidebar}
        </div>
      ) : null}

      <AnimatePresence>
        {lanesOverviewOpen ? (
          <motion.div
            key="lane-overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[1100] overflow-hidden bg-slate-950/62 p-4 backdrop-blur-2xl sm:p-6"
          >
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={springTransition}
            className="liquid-modal mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[2rem]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/30 px-4 py-4 dark:border-white/10 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-600 dark:text-cyan-300">
                  Lane overview
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  All active lanes
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="liquid-chip px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {visibleRoutes.length} lanes
                </span>
                <motion.button
                  type="button"
                  aria-label="Close lane overview"
                  onClick={() => setLanesOverviewOpen(false)}
                  whileHover={liquidHover}
                  whileTap={liquidTap}
                  transition={springTransition}
                  className="liquid-button grid size-10 place-items-center rounded-[1.15rem] text-slate-700 transition dark:text-slate-200"
                >
                  <X className="size-5" />
                </motion.button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {visibleRoutes.length === 0 ? (
                <div className="liquid-card grid h-full place-items-center rounded-[1.5rem] border-dashed p-6 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  No active lanes to show.
                </div>
              ) : (
                <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {visibleRoutes.map((route) => {
                    const metrics = routeMetrics(route);
                    const statusText =
                      route.status === "loading"
                        ? "Fetching"
                        : route.status === "ready"
                          ? "Ready"
                          : "Needs attention";

                    return (
                      <motion.button
                        key={`overview-${route.id}`}
                        type="button"
                        onClick={() => focusRouteOnMap(route)}
                        whileHover={liquidHover}
                        whileTap={liquidTap}
                        transition={springTransition}
                        className="liquid-card group relative min-h-44 overflow-hidden rounded-[1.5rem] p-4 text-left"
                      >
                        <div
                          className="absolute inset-x-0 top-0 h-1.5"
                          style={{
                            background: `linear-gradient(90deg, ${route.color}, color-mix(in srgb, ${route.color} 58%, white))`,
                            boxShadow: `0 0 22px ${route.color}55`,
                          }}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="liquid-route-dot size-3 shrink-0 rounded-full"
                                style={{ "--route-color": route.color, backgroundColor: route.color } as RouteColorStyle}
                              />
                              <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                                {laneDisplayName(route)}
                              </h3>
                            </div>
                            <p className="mt-2 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                              {placeDisplayName(route)}
                            </p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              route.status === "error"
                                ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                            }`}
                          >
                            {statusText}
                          </span>
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <div className="liquid-card rounded-[1rem] p-3">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Distance</p>
                            <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                              {formatDistance(metrics.travelDistance)}
                            </p>
                          </div>
                          <div className="liquid-card rounded-[1rem] p-3">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Travel time</p>
                            <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
                              {formatTime(metrics.travelTime)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-4 text-xs font-semibold text-blue-600 opacity-0 transition duration-300 group-hover:opacity-100 dark:text-cyan-300">
                          Focus on map
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        aria-label="Open sidebar"
        onClick={() => setSidebarOpen(true)}
        whileHover={liquidHover}
        whileTap={liquidTap}
        transition={springTransition}
        className={`liquid-button absolute left-4 top-4 z-[600] size-11 place-items-center rounded-[1.2rem] text-slate-800 transition duration-300 dark:text-white lg:hidden ${
          mapFullscreen ? "hidden" : "grid"
        }`}
      >
        <Menu className="size-5" />
      </motion.button>

      <motion.button
        type="button"
        aria-label={mapFullscreen ? "Exit fullscreen map" : "Open fullscreen map"}
        onClick={() => {
          setMapFullscreen((currentValue) => !currentValue);
          setSidebarOpen(false);
        }}
        whileHover={liquidHover}
        whileTap={liquidTap}
        transition={springTransition}
        className={`liquid-button absolute z-[640] flex h-11 items-center justify-center gap-2 rounded-[1.2rem] px-3 text-slate-800 transition duration-300 dark:text-white ${
          mapFullscreen ? "left-4 top-4" : "right-4 top-20 lg:hidden"
        }`}
      >
        {mapFullscreen ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        <span className="hidden text-xs font-semibold sm:inline">
          {mapFullscreen ? "Exit map" : "Fullscreen"}
        </span>
      </motion.button>

      {mapFullscreen ? (
        <motion.div
          initial={{ opacity: 0, y: -12, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          transition={springTransition}
          className="liquid-map-stat pointer-events-none absolute left-1/2 top-4 z-[630] hidden rounded-[1.25rem] px-4 py-3 lg:block"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Fullscreen map</p>
          <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">Press Esc to exit</p>
        </motion.div>
      ) : null}

      <div
        className={`pointer-events-none absolute right-4 top-4 z-[520] hidden grid-cols-5 gap-3 transition-all duration-300 lg:grid ${
          mapFullscreen ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        <div className="liquid-map-stat rounded-[1.25rem] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Network</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{visibleRoutes.length} lanes</p>
        </div>
        <div className="liquid-map-stat rounded-[1.25rem] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">Distance</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatDistance(totalTravelDistance)}</p>
        </div>
        <div className="liquid-map-stat rounded-[1.25rem] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">ETA</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{formatTime(totalTravelTime)}</p>
        </div>
        <div className="liquid-map-stat rounded-[1.25rem] px-4 py-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
            <Activity className="size-3" />
            Traffic
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {trafficSummary.Heavy > 0 ? "Heavy" : trafficSummary.Moderate > 0 ? "Moderate" : "Clear"}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={() => setLanesOverviewOpen(true)}
          disabled={visibleRoutes.length === 0}
          whileHover={visibleRoutes.length === 0 ? undefined : liquidHover}
          whileTap={visibleRoutes.length === 0 ? undefined : liquidTap}
          transition={springTransition}
          className="pointer-events-auto liquid-button-primary rounded-[1.25rem] px-4 py-3 text-left text-white transition duration-300 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-70">Overview</p>
          <p className="mt-1 text-sm font-semibold">Show all lanes</p>
        </motion.button>
      </div>

      <div
        className={`absolute inset-0 transition-all duration-500 ease-out ${
          mapFullscreen ? "lg:left-0" : "lg:left-[462px]"
        }`}
      >
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
            crossOrigin="anonymous"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapCaptureHandle onReady={(map) => {
            mapInstanceRef.current = map;
          }} />
          <MapBounds routes={mapRoutes} fullscreen={mapFullscreen} />
          <FocusMap location={focusLocation} />
          {draftRoute ? (
            <Fragment>
              <Polyline
                positions={routePositions(draftRoute)}
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
                  positions={routePositions(route)}
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
