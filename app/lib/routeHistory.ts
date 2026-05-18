import {
  collection,
  deleteDoc,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseDb } from "@/app/lib/firebase";

export type CoordinateTuple = [number, number];
export type SerializedCoordinate = { lat: number; lng: number };

export type RouteLocation = {
  name: string;
  region: string;
  coordinates: CoordinateTuple;
  displayName?: string;
  type?: string;
};

export type SavedRoute = {
  id: number;
  name: string;
  start: RouteLocation;
  end: RouteLocation;
  color: string;
  visible: boolean;
  createdAt: number;
  createdDate: string;
  createdTime: string;
  geometry?: CoordinateTuple[];
  distanceMeters?: number;
  durationSeconds?: number;
  status: "loading" | "ready" | "error";
  error?: string;
  startLabel: string;
  endLabel: string;
};

export type LabelSuggestion = {
  id: string;
  label: string;
  usageCount: number;
  lastUsedAt: number;
};

const ROUTES_COLLECTION = "routes";
const LABELS_COLLECTION = "labels";
const USERS_COLLECTION = "users";

const FALLBACK_START: RouteLocation = {
  name: "Source",
  region: "",
  coordinates: [22.9734, 78.6569],
};

const FALLBACK_END: RouteLocation = {
  name: "Destination",
  region: "",
  coordinates: [22.9734, 78.6569],
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toFiniteNumber(value: unknown) {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function isLatitude(value: number) {
  return value >= -90 && value <= 90;
}

function isLongitude(value: number) {
  return value >= -180 && value <= 180;
}

function isValidCoordinate(latitude: number, longitude: number) {
  return isLatitude(latitude) && isLongitude(longitude);
}

export function isCoordinateTuple(value: unknown): value is CoordinateTuple {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    isFiniteNumber(value[0]) &&
    isFiniteNumber(value[1]) &&
    isValidCoordinate(value[0], value[1])
  );
}

export function isCoordinateObject(value: unknown): value is SerializedCoordinate {
  if (!value || typeof value !== "object") {
    return false;
  }

  const point = value as Record<string, unknown>;
  return isFiniteNumber(point.lat) && isFiniteNumber(point.lng) && isValidCoordinate(point.lat, point.lng);
}

export function parseCoordinate(value: unknown): CoordinateTuple | undefined {
  if (isCoordinateTuple(value)) {
    return [value[0], value[1]];
  }

  if (isCoordinateObject(value)) {
    return [value.lat, value.lng];
  }

  if (value && typeof value === "object") {
    const point = value as Record<string, unknown>;
    const latitude = toFiniteNumber(point.lat ?? point.latitude);
    const longitude = toFiniteNumber(point.lng ?? point.lon ?? point.longitude);

    if (latitude !== undefined && longitude !== undefined && isValidCoordinate(latitude, longitude)) {
      return [latitude, longitude];
    }
  }

  if (Array.isArray(value) && value.length >= 2) {
    const latitude = toFiniteNumber(value[0]);
    const longitude = toFiniteNumber(value[1]);

    if (latitude !== undefined && longitude !== undefined && isValidCoordinate(latitude, longitude)) {
      return [latitude, longitude];
    }
  }

  return undefined;
}

export function isRouteGeometry(value: unknown): value is Array<CoordinateTuple | SerializedCoordinate> {
  return Array.isArray(value) && value.length >= 2 && value.every((point) => Boolean(parseCoordinate(point)));
}

export function parseGeometry(value: unknown): CoordinateTuple[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const geometry = value
    .map(parseCoordinate)
    .filter((point): point is CoordinateTuple => Boolean(point));

  return geometry.length >= 2 ? geometry : undefined;
}

export function serializeGeometry(value: unknown): SerializedCoordinate[] | undefined {
  return parseGeometry(value)?.map(([lat, lng]) => ({ lat, lng }));
}

export function parseLocation(value: unknown, fallback: RouteLocation): RouteLocation {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const location = value as Record<string, unknown>;
  const coordinates = parseCoordinate(location.coordinates) ?? fallback.coordinates;
  const name = typeof location.name === "string" && location.name.trim() ? location.name : fallback.name;
  const region = typeof location.region === "string" ? location.region : fallback.region;

  return {
    name,
    region,
    coordinates,
    displayName: typeof location.displayName === "string" ? location.displayName : undefined,
    type: typeof location.type === "string" ? location.type : undefined,
  };
}

export function formatRouteDateParts(createdAt: number) {
  const date = new Date(createdAt);

  return {
    createdDate: date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }),
    createdTime: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };
}

export function normalizeLabel(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) {
        return word;
      }

      if (word.length <= 4 && word === word.toUpperCase()) {
        return word;
      }

      return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function labelDocId(label: string) {
  return normalizeLabel(label).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "label";
}

export function normalizeSavedRoute(value: unknown, fallbackIndex = 0): SavedRoute | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const route = value as Record<string, unknown>;
  const id = isFiniteNumber(route.id) ? route.id : Date.now() + fallbackIndex;
  const createdAt = isFiniteNumber(route.createdAt) ? route.createdAt : id;
  const dateParts = formatRouteDateParts(createdAt);
  const start = parseLocation(route.start, FALLBACK_START);
  const end = parseLocation(route.end, FALLBACK_END);

  return {
    id,
    name: typeof route.name === "string" && route.name.trim() ? route.name : `${start.name} to ${end.name}`,
    start,
    end,
    color: typeof route.color === "string" ? route.color : "#2563eb",
    visible: typeof route.visible === "boolean" ? route.visible : true,
    createdAt,
    createdDate: typeof route.createdDate === "string" ? route.createdDate : dateParts.createdDate,
    createdTime: typeof route.createdTime === "string" ? route.createdTime : dateParts.createdTime,
    geometry: parseGeometry(route.geometry),
    distanceMeters: isFiniteNumber(route.distanceMeters) ? route.distanceMeters : undefined,
    durationSeconds: isFiniteNumber(route.durationSeconds) ? route.durationSeconds : undefined,
    status: route.status === "loading" || route.status === "ready" || route.status === "error" ? route.status : "loading",
    error: typeof route.error === "string" ? route.error : undefined,
    startLabel: typeof route.startLabel === "string" ? route.startLabel : "Source",
    endLabel: typeof route.endLabel === "string" ? route.endLabel : "Destination",
  };
}

export function normalizeRouteList(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const routes = value
    .map((route, index) => normalizeSavedRoute(route, index))
    .filter((route): route is SavedRoute => Boolean(route));

  return routes.length > 0 ? routes : undefined;
}

export function serializeRoute(route: SavedRoute) {
  const dateParts = formatRouteDateParts(route.createdAt);

  return {
    id: route.id,
    name: route.name,
    start: route.start,
    end: route.end,
    color: route.color,
    visible: route.visible,
    createdAt: route.createdAt,
    createdDate: route.createdDate || dateParts.createdDate,
    createdTime: route.createdTime || dateParts.createdTime,
    geometry: serializeGeometry(route.geometry),
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    status: route.status,
    error: route.error,
    startLabel: route.startLabel,
    endLabel: route.endLabel,
    timestamp: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function routeFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>) {
  return normalizeSavedRoute({ ...snapshot.data(), id: Number(snapshot.id) || snapshot.data().id });
}

function labelFromSnapshot(snapshot: QueryDocumentSnapshot<DocumentData>): LabelSuggestion | undefined {
  const data = snapshot.data();
  const label = typeof data.label === "string" ? normalizeLabel(data.label) : "";

  if (!label) {
    return undefined;
  }

  return {
    id: snapshot.id,
    label,
    usageCount: isFiniteNumber(data.usageCount) ? data.usageCount : 0,
    lastUsedAt: isFiniteNumber(data.lastUsedAt) ? data.lastUsedAt : 0,
  };
}

export function getUserRoutesCollection(uid: string) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase could not be initialized.");
  }

  return collection(db, USERS_COLLECTION, uid, ROUTES_COLLECTION);
}

export function getUserLabelsCollection(uid: string) {
  const db = getFirebaseDb();

  if (!db) {
    throw new Error("Firebase could not be initialized.");
  }

  return collection(db, USERS_COLLECTION, uid, LABELS_COLLECTION);
}

export function subscribeToUserRoutes(
  uid: string,
  onRoutes: (routes: SavedRoute[], fromCache: boolean) => void,
  onError: (error: Error) => void,
) {
  const routesQuery = query(getUserRoutesCollection(uid), orderBy("createdAt", "desc"));

  return onSnapshot(
    routesQuery,
    (snapshot) => {
      onRoutes(
        snapshot.docs
          .map(routeFromSnapshot)
          .filter((route): route is SavedRoute => Boolean(route)),
        snapshot.metadata.fromCache,
      );
    },
    onError,
  );
}

export function subscribeToUserLabels(
  uid: string,
  onLabels: (labels: LabelSuggestion[], fromCache: boolean) => void,
  onError: (error: Error) => void,
) {
  const labelsQuery = query(getUserLabelsCollection(uid), orderBy("lastUsedAt", "desc"));

  return onSnapshot(
    labelsQuery,
    (snapshot) => {
      onLabels(
        snapshot.docs
          .map(labelFromSnapshot)
          .filter((label): label is LabelSuggestion => Boolean(label)),
        snapshot.metadata.fromCache,
      );
    },
    onError,
  );
}

export async function recordUserLabels(uid: string, labels: string[]) {
  const normalizedLabels = [...new Set(labels.map(normalizeLabel).filter(Boolean))];

  if (normalizedLabels.length === 0) {
    return;
  }

  const labelsCollection = getUserLabelsCollection(uid);
  const now = Date.now();

  await Promise.all(
    normalizedLabels.map((label) =>
      setDoc(
        doc(labelsCollection, labelDocId(label)),
        {
          label,
          normalizedLabel: label.toLowerCase(),
          usageCount: increment(1),
          lastUsedAt: now,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    ),
  );
}

export async function saveUserRoute(uid: string, route: SavedRoute) {
  const routeRef = doc(getUserRoutesCollection(uid), String(route.id));
  await setDoc(routeRef, serializeRoute(route), { merge: true });
}

export async function deleteUserRoute(uid: string, routeId: number) {
  await deleteDoc(doc(getUserRoutesCollection(uid), String(routeId)));
}
