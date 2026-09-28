import type { Metadata } from "next";
import { Bebas_Neue, Manrope } from "next/font/google";
import "./globals.css";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Supermanager Balaguer",
  description:
    "Fantasy bàsquet del sènior del Club Bàsquet Balaguer. Tria alineació, capità i competeix a la lliga amics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ca"
      className={`${display.variable} ${sans.variable} h-full antialiased`}
    >
      <body className="court-bg min-h-full flex flex-col font-sans text-cream">
        {children}
      </body>
    </html>
  );
}
