import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for iOS: the OmniDoc mark on a full-bleed tile (iOS rounds the corners itself). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1014" }}>
        <svg width="132" height="132" viewBox="4 3 24 26">
          <path d="M9.5 6h9.2L23 10.3V25a1 1 0 0 1-1 1H9.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" fill="#f5f2eb" />
          <path d="M18.7 6v3.3a1 1 0 0 0 1 1H23" fill="none" stroke="#0e1014" strokeWidth="1.3" />
          <path d="m11.8 17.6 2.7 2.7 5.3-5.5" fill="none" stroke="#3ddc97" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
