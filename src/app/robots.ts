import type { MetadataRoute } from "next";

const siteUrl = "https://supercbb.com";

/** Public landing + auth pages are crawlable; the app behind login and the API are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/jornada",
        "/equip",
        "/jugadors",
        "/jugador/",
        "/classificacio",
        "/compte",
        "/dashboard",
        "/onboarding",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
