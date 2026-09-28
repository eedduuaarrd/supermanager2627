import type { Metadata } from "next";
import { IBM_Plex_Sans, Oswald } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Supermanager Balaguer",
  description:
    "Gestor fantasy dels sèniors del Club Bàsquet Balaguer. Alineació, capità i classificacions de jornada i general.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ca"
      className={`${display.variable} ${sans.variable} h-dvh antialiased`}
    >
      <body className="arena-bg flex h-dvh min-h-0 flex-col overflow-hidden font-sans text-bone">
        {children}
      </body>
    </html>
  );
}
