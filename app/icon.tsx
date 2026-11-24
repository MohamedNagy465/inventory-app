import { ImageResponse } from "next/og";

export function generateImageMetadata() {
  return [
    {
      id: "192",
      size: { width: 192, height: 192 },
      contentType: "image/png",
      alt: "أيقونة نظام المخزون",
    },
    {
      id: "512",
      size: { width: 512, height: 512 },
      contentType: "image/png",
      alt: "أيقونة نظام المخزون",
    },
  ];
}

export default async function Icon({
  id,
}: {
  id: Promise<string | number>;
}) {
  const iconId = await id;
  const dimension = Number(iconId);

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
    {
      width: dimension,
      height: dimension,
    }
  );
}