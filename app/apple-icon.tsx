import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        <svg width="72%" height="72%" viewBox="0 0 100 100">
          <path
            d="M50 8 L90 29 L50 51 L10 29 Z"
            fill="#99f6e4"
          />
          <path
            d="M10 29 L50 51 L50 94 L10 72 Z"
            fill="#14b8a6"
          />
          <path
            d="M90 29 L50 51 L50 94 L90 72 Z"
            fill="#0f766e"
          />
          <path
            d="M50 51 V94"
            stroke="#ccfbf1"
            strokeWidth="2"
            fill="none"
          />
        </svg>
      </div>
    ),
    size
  );
}