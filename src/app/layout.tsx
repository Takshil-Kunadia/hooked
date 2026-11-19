import type { Metadata, Viewport } from "next";
import { Caveat, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], axes: ["opsz"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
/* Code and margin-note faces aren't in the hero, so don't preload them. */
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], preload: false });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "600"], preload: false });
const departureMono = localFont({
  variable: "--font-departure-mono",
  src: "./fonts/DepartureMono-Regular.woff2",
  display: "swap",
});

/** Canonical origin for metadata URLs; set NEXT_PUBLIC_SITE_URL in each deployment. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Hooked: how WordPress really works",
    template: "%s · Hooked",
  },
  description:
    "Ride along with one request as it travels through WordPress, stop by stop: hooks, actions, filters and the whole request lifecycle, explained in 3D.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fontVariables = [inter, instrumentSerif, jetbrainsMono, caveat, departureMono].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-svh">{children}</body>
    </html>
  );
}
