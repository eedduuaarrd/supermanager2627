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
    var safeTop = probe(
      "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);",
      function(el){ return px(el, "padding-top"); }
    );
    // On this iPhone visualViewport stays short by the status bar (~47px)
    // and a fixed 100dvh box is clamped to that same viewport, so comparing
    // those two never grows the shell. innerHeight and screen.height include
    // the status bar. Accept a taller candidate only when the extra height is
    // that inset. A Safari toolbar or the keyboard is larger; using it would
    // push Equip below the visible page.
    var limit = safeTop > 0 ? safeTop + 4 : 62;
    var screenH = window.screen && window.screen.height;
    var dpr = window.devicePixelRatio || 1;
    if (screenH > 1400 && dpr > 1) screenH = screenH / dpr;
    var phone = window.matchMedia("(max-width: 520px)").matches;
    var candidates = [
      visible,
      window.innerHeight,
      probe(
        "position:fixed;left:0;top:0;height:100dvh;width:0;visibility:hidden;pointer-events:none;",
        function(el){ return el.getBoundingClientRect().height; }
      ),
      probe(
        "position:absolute;left:0;top:0;height:100lvh;width:0;visibility:hidden;pointer-events:none;",
        function(el){ return el.getBoundingClientRect().height; }
      )
    ];
    // screen.height is the whole phone. On a desktop it is the monitor, so
    // only consider it when the window is phone-sized.
    if (phone && screenH > 0 && screenH < 1400) candidates.push(screenH);
    var height = visible;
    for (var i = 0; i < candidates.length; i++) {
      var candidate = candidates[i];
      if (candidate > height && candidate - visible <= limit) height = candidate;
    }
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
