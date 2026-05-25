"use client";

import dynamic from "next/dynamic";

const LandingMapShowcaseMap = dynamic(() => import("./LandingMapShowcaseMap"), {
  ssr: false,
  loading: () => (
    <div className="landing-map-surface relative mt-5 aspect-[4/3] overflow-hidden rounded-[1.4rem]">
      <div className="grid h-full place-items-center text-sm font-semibold text-slate-600">Loading map preview...</div>
    </div>
  ),
});

export default function LandingMapShowcase() {
  return <LandingMapShowcaseMap />;
}
