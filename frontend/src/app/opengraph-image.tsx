import { ImageResponse } from "next/og";

export const alt = "OmniDoc: answers that show their work. Every statement cites a page and every citation is checked.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: the headline beside a stylised answer with three checked citations. */
export default async function Image() {
  const chip = (label: string, bg: string, fg: string) => (
    <span style={{ display: "flex", padding: "2px 10px", borderRadius: 8, background: bg, color: fg, fontSize: 22, margin: "0 6px" }}>{label}</span>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0b0d", color: "#edeef0", padding: 72, fontFamily: "serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "55%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontFamily: "sans-serif", fontWeight: 600 }}>
            <span style={{ display: "flex", width: 44, height: 44, borderRadius: 12, background: "#edeef0", alignItems: "center", justifyContent: "center" }}>
              <svg width="26" height="26" viewBox="0 0 24 24">
                <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#1fa86f" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            OmniDoc
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 92, lineHeight: 0.95, letterSpacing: -2 }}>
            <span>Answers that</span>
            <span style={{ color: "#3ddc97", fontStyle: "italic" }}>show their work.</span>
          </div>
          <span style={{ fontSize: 26, color: "#a3a8b3", fontFamily: "sans-serif" }}>Grounded answers over the PDFs you upload</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "45%", paddingLeft: 40 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 24, padding: 32, background: "#111317", fontFamily: "sans-serif", fontSize: 24, lineHeight: 1.6 }}>
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              Deposit refunded within 30 days {chip("p.4 supported", "rgba(61,220,151,0.15)", "#4be3a2")}
            </span>
            <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              Pets need written consent {chip("p.7 partial", "rgba(245,184,64,0.15)", "#f7c35e")}
            </span>
            <span style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden" }}>
              <span style={{ width: "67%", background: "#3ddc97" }} />
              <span style={{ width: "33%", background: "#f5b840" }} />
            </span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
