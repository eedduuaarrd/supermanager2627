import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Oswald } from "next/font/google";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const display = Oswald({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteUrl = "https://supercbb.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Supermanager Balaguer",
  description:
    "Gestor fantasy dels sèniors del Club Bàsquet Balaguer. Alineació, capità i classificacions de jornada i general.",
  applicationName: "Supermanager Balaguer",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SM Balaguer",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "ca_ES",
    url: siteUrl,
    siteName: "Supermanager Balaguer",
    title: "Supermanager Balaguer",
    description:
      "Gestor fantasy dels sèniors del Club Bàsquet Balaguer. Alineació, capità i classificacions de jornada i general.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "Supermanager Balaguer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Supermanager Balaguer",
    description:
      "Gestor fantasy dels sèniors del Club Bàsquet Balaguer. Alineació, capità i classificacions de jornada i general.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Supermanager Balaguer",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
    { color: "#0b0d10" },
  ],
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ca"
      className={`${display.variable} ${sans.variable} h-dvh antialiased`}
    >
      <body className="arena-bg flex h-dvh min-h-0 flex-col overflow-x-hidden overflow-y-hidden font-sans text-bone">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
