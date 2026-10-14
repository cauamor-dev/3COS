import { ImageResponse } from "next/og";

export function renderAppIcon(size: number, { maskable = false } = {}) {
  const mark = maskable ? size * 0.6 : size * 0.78;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 50% 20%, #2a1b52 0%, #07060b 70%)",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <svg width={mark} height={mark} viewBox="0 0 32 32" fill="none">
          <path d="M10 11.5 16 21.5 22 11.5Z" stroke="#a78bfa" strokeWidth="1.1" strokeLinejoin="round" opacity="0.8" />
          <circle cx="10" cy="11.5" r="2.8" fill="#f0a875" />
          <circle cx="22" cy="11.5" r="2.8" fill="#7ee0b0" />
          <circle cx="16" cy="21.5" r="2.8" fill="#a78bfa" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
