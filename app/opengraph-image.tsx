import { ImageResponse } from "next/og";

export const alt = "hantverkare — KI-gestützte Angebote für Handwerker";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background: "#020617",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "radial-gradient(circle at 20% 20%, rgba(96,165,250,0.35), transparent 55%), radial-gradient(circle at 85% 75%, rgba(29,78,216,0.45), transparent 55%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 108,
              height: 108,
              borderRadius: 30,
              background: "linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              viewBox="0 0 32 32"
              width="64"
              height="64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M11 8v16M21 8v16M11 16h10"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            style={{
              fontSize: 88,
              fontWeight: 600,
              color: "white",
              letterSpacing: "-0.02em",
            }}
          >
            hantverkare
          </span>
        </div>
        <p
          style={{
            position: "relative",
            marginTop: 28,
            fontSize: 32,
            color: "#94a3b8",
            maxWidth: 880,
            textAlign: "center",
          }}
        >
          KI-gestützte Angebote für Handwerker — in unter einer Minute
        </p>
      </div>
    ),
    { ...size }
  );
}
