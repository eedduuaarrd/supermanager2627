import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Oswald } from "next/font/google";
import { AppViewportLock } from "@/components/app-viewport-lock";
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
      className={`${display.variable} ${sans.variable} h-app antialiased`}
      suppressHydrationWarning
    >
      <body className="arena-bg flex h-app min-h-0 flex-col overflow-x-hidden overflow-y-hidden font-sans text-bone">
        <script
          id="app-viewport"
          dangerouslySetInnerHTML={{ __html: APP_VIEWPORT_SCRIPT }}
        />
        {children}
        <AppViewportLock />
        <PwaRegister />
      </body>
    </html>
  );
}

const APP_VIEWPORT_SCRIPT = `(function(){
  if (window.__appViewportBound) return;
  window.__appViewportBound = true;
  function px(el, prop){
    return parseFloat(getComputedStyle(el).getPropertyValue(prop)) || 0;
  }
  function probe(style, read){
    var el = document.createElement("div");
    el.style.cssText = style;
    document.documentElement.appendChild(el);
    var value = read(el);
    el.remove();
    return value;
  }
  function apply(){
    var vv = window.visualViewport;
    var visible = vv && vv.height > 0 ? vv.height : window.innerHeight;
    if (!(visible > 0)) return;
    var dynamic = probe(
      "position:fixed;left:0;top:0;height:100dvh;width:0;visibility:hidden;pointer-events:none;",
      function(el){ return el.getBoundingClientRect().height; }
    );
    var safeTop = probe(
      "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);",
      function(el){ return px(el, "padding-top"); }
    );
    // iOS standalone: the first visualViewport is short by the status bar
    // (safe-area-inset-top, ~47–59px), then it grows into 100dvh. 100dvh is
    // already the full screen on that first frame. The Safari toolbar gap is
    // larger (~70px+); adopting it would make the shell taller than the
    // visible page and clip Equip again. A keyboard shrink is larger still.
    var limit = safeTop > 0 ? safeTop + 2 : 62;
    var height = visible;
    if (dynamic > visible && dynamic - visible <= limit) height = dynamic;
    document.documentElement.style.setProperty("--app-height", height + "px");
    document.documentElement.style.setProperty("--app-top", "0px");
  }
  window.__applyAppViewport = apply;
  apply();
  requestAnimationFrame(function(){
    apply();
    var main = document.querySelector("main");
    if (main) main.scrollTop = 0;
  });
  var vv = window.visualViewport;
  if (vv) vv.addEventListener("resize", apply);
  window.addEventListener("resize", apply);
  window.addEventListener("orientationchange", apply);
  window.addEventListener("pageshow", apply);
})();`;
