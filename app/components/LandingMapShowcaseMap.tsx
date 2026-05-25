"use client";

import { Building2, Layers, Store, Timer, TrendingUp, Warehouse, ZoomIn, ZoomOut } from "lucide-react";
import L, { DivIcon, LatLngBoundsExpression } from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";

const routeBounds: LatLngBoundsExpression = [
  [12.42, 77.42],
  [13.2, 80.42],
];

const fastestRoute: [number, number][] = [
  [12.9716, 77.5946],
  [13.01, 77.95],
  [12.72, 78.22],
  [12.83, 78.72],
  [12.92, 79.13],
  [12.88, 79.7],
  [13.0827, 80.2707],
];

const alternateRoute: [number, number][] = [
  [12.9716, 77.5946],
  [12.84, 77.9],
  [12.52, 78.21],
  [12.62, 78.88],
  [12.76, 79.42],
  [13.0827, 80.2707],
];

const scenicRoute: [number, number][] = [
  [12.9716, 77.5946],
  [13.12, 78.08],
  [13.08, 78.54],
  [12.96, 79.08],
  [13.02, 79.62],
  [13.0827, 80.2707],
];

function createMapIcon(label: string, className: string): DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="landing-leaflet-pin ${className}"><span>${label}</span></div>`,
    iconSize: [38, 38],
    iconAnchor: [18, 34],
  });
}

function createFacilityIcon(label: string, className: string): DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="landing-leaflet-facility ${className}">${label}</div>`,
    iconSize: [96, 30],
    iconAnchor: [48, 15],
  });
}

function FitShowcaseBounds() {
  const map = useMap();

  useEffect(() => {
    const fitPreviewMap = () => {
      map.invalidateSize();
      map.fitBounds(routeBounds, { padding: [34, 34], animate: false });
    };

    const animationFrame = window.requestAnimationFrame(fitPreviewMap);
    const timeout = window.setTimeout(fitPreviewMap, 320);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
    };
  }, [map]);

  return null;
}

export default function LandingMapShowcaseMap() {
  return (
    <div className="landing-map-surface relative mt-5 aspect-[4/3] overflow-hidden rounded-[1.4rem]">
      <MapContainer
        className="landing-leaflet-map absolute inset-0 z-0"
        style={{ height: "100%", width: "100%" }}
        center={[12.9, 78.95]}
        zoom={8}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          crossOrigin=""
        />
        <FitShowcaseBounds />
        <Polyline positions={alternateRoute} pathOptions={{ color: "#a855f7", weight: 4, opacity: 0.62 }} />
        <Polyline positions={scenicRoute} pathOptions={{ color: "#f97316", weight: 4, opacity: 0.52 }} />
        <Polyline positions={fastestRoute} pathOptions={{ color: "#0284c7", weight: 6, opacity: 0.9 }} />
        <Marker position={[12.9716, 77.5946]} icon={createMapIcon("B", "landing-leaflet-pin-blue")} />
        <Marker position={[13.0827, 80.2707]} icon={createMapIcon("C", "landing-leaflet-pin-pink")} />
        <Marker position={[12.9165, 79.1325]} icon={createMapIcon("H", "landing-leaflet-pin-green")} />
        <Marker position={[12.5186, 78.2137]} icon={createFacilityIcon("Warehouse", "landing-leaflet-facility-blue")} />
        <Marker position={[12.9165, 79.1325]} icon={createFacilityIcon("Delivery Hub", "landing-leaflet-facility-cyan")} />
        <Marker position={[12.8342, 79.7036]} icon={createFacilityIcon("Grocery", "landing-leaflet-facility-pink")} />
      </MapContainer>

      <div className="routevision-real-map-tint absolute inset-0 z-[1]" />

      <div className="routevision-demo-sidebar absolute left-3 top-3 z-[5] w-[42%] rounded-2xl p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">Actual route</p>
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">Live</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-white/75 px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500">Source</p>
            <p className="text-xs font-bold text-slate-950">Bangalore</p>
          </div>
          <div className="rounded-xl bg-white/75 px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500">Destination</p>
            <p className="text-xs font-bold text-slate-950">Chennai</p>
          </div>
        </div>
      </div>

      <div className="routevision-map-controls absolute right-3 top-3 z-[5] overflow-hidden rounded-xl">
        <button type="button" aria-label="Zoom in preview" className="grid size-8 place-items-center border-b border-slate-200 bg-white/85 text-slate-700">
          <ZoomIn className="size-4" />
        </button>
        <button type="button" aria-label="Zoom out preview" className="grid size-8 place-items-center bg-white/85 text-slate-700">
          <ZoomOut className="size-4" />
        </button>
      </div>

      <div className="landing-map-card landing-map-card-fastest absolute right-4 top-[31%] z-[5] rounded-2xl p-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
          <TrendingUp className="size-3.5" />
          Fastest Route
        </p>
        <p className="mt-1 text-lg font-semibold text-white">Bangalore to Chennai</p>
      </div>
      <div className="landing-map-card landing-map-card-eta absolute left-4 bottom-4 z-[5] rounded-2xl p-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          <Timer className="size-3.5" />
          ETA
        </p>
        <p className="mt-1 text-sm font-semibold text-white">~6h 10m</p>
      </div>
      <div className="landing-map-card landing-map-card-facilities absolute bottom-4 right-4 z-[5] rounded-2xl p-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
          <Layers className="size-3.5" />
          Compared
        </p>
        <p className="mt-1 text-sm font-semibold text-white">3 route options</p>
      </div>
      <div className="landing-map-card absolute right-4 top-4 z-[5] hidden rounded-2xl p-3 sm:block">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
          <Warehouse className="size-3.5" />
          Corridor
        </p>
        <p className="mt-1 text-sm font-semibold text-white">NH 48 / Chennai route</p>
      </div>
      <div className="landing-map-card absolute left-[46%] top-4 z-[5] hidden rounded-2xl p-3 sm:block">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fuchsia-200">
          <Building2 className="size-3.5" />
          Hub
        </p>
        <p className="mt-1 text-sm font-semibold text-white">Vellore checkpoint</p>
      </div>
      <div className="landing-map-card absolute left-[42%] bottom-4 z-[5] hidden rounded-2xl p-3 sm:block">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-500">
          <Store className="size-3.5" />
          Facility
        </p>
        <p className="mt-1 text-sm font-semibold text-white">Kanchipuram stop</p>
      </div>
      <div className="routevision-map-attribution absolute bottom-1 right-2 z-[5] text-[9px] font-semibold text-slate-500">
        OpenStreetMap preview
      </div>
    </div>
  );
}
