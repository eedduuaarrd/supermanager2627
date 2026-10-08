import type { MetadataRoute } from "next";

const siteUrl = "https://supercbb.com";

/** Only the public pages; everything else needs a session. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/login`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteUrl}/register`, changeFrequency: "yearly", priority: 0.6 },
  ];
}
