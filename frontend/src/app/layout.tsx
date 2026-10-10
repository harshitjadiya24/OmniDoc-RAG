import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import { Providers } from "@/components/providers/providers";
import { INTRO_BOOT_SCRIPT } from "@/lib/film";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const display = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "OmniDoc — answers that show their work", template: "%s · OmniDoc" },
  description:
    "Upload PDFs and ask questions in plain English. Every statement cites its page, every citation is checked against that page, and missing evidence gets a refusal instead of a guess.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2eb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="min-h-dvh overflow-x-clip antialiased">
        <Script id="intro-boot" strategy="beforeInteractive">
          {INTRO_BOOT_SCRIPT}
        </Script>
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[80] focus:rounded-md focus:bg-verified focus:px-4 focus:py-3 focus:text-on-verified"
          >
            Skip to content
          </a>
          <div className="app-root flex min-h-dvh flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
