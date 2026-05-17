"use client";

import dynamic from "next/dynamic";

const DistanceVisualizerMap = dynamic(() => import("./DistanceVisualizerMap"), {
  ssr: false,
  loading: () => (
    <main className="grid h-dvh w-full place-items-center bg-slate-100 text-slate-950">
      <div className="rounded-lg bg-white px-5 py-4 text-sm font-medium shadow-xl shadow-slate-950/10 ring-1 ring-slate-200">
        Loading map...
      </div>
    </main>
  ),
});

export default function DistanceVisualizer() {
  return <DistanceVisualizerMap />;
}
