import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "#0f172a",
          background:
            "linear-gradient(135deg, #f8fbff 0%, #e0f2fe 46%, #ecfdf5 100%)",
          fontFamily: "Arial",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 44,
            border: "2px solid rgba(255,255,255,0.8)",
            borderRadius: 44,
            background: "rgba(255,255,255,0.54)",
            boxShadow: "0 32px 90px rgba(15,23,42,0.16)",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 26, position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              color: "#2563eb",
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 8,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                background: "linear-gradient(135deg,#7dd3fc,#22d3ee,#10b981)",
                boxShadow: "0 0 32px rgba(34,211,238,0.46)",
                border: "2px solid rgba(255,255,255,0.92)",
              }}
            />
            RouteVision
          </div>
          <div
            style={{
              fontSize: 76,
              lineHeight: 1.02,
              fontWeight: 800,
              letterSpacing: -2,
              maxWidth: 860,
            }}
          >
            Route analytics and lane planning platform
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: 30,
              lineHeight: 1.35,
              maxWidth: 880,
            }}
          >
            Save routes, compare distances, analyze travel times, and sync route history across devices.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 18,
            position: "relative",
            color: "#0f172a",
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          {["Route history", "Analytics", "Lane planning"].map((item) => (
            <div
              key={item}
              style={{
                padding: "16px 24px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.76)",
                border: "1px solid rgba(255,255,255,0.9)",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
