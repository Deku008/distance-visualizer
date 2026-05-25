import { ImageResponse } from "next/og";
import { homeDescription, siteName } from "./lib/seo";

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
            "radial-gradient(circle at 18% 18%, rgba(14,165,233,0.32), transparent 28%), radial-gradient(circle at 84% 16%, rgba(236,72,153,0.22), transparent 30%), linear-gradient(135deg, #f8fbff 0%, #e0f2fe 42%, #fdf2f8 100%)",
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
            {siteName}
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
            Smart route and lane planning platform
          </div>
          <div
            style={{
              color: "#475569",
              fontSize: 30,
              lineHeight: 1.35,
              maxWidth: 880,
            }}
          >
            {homeDescription}
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
          {["Route planning", "ETA comparison", "Logistics lanes"].map((item) => (
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
