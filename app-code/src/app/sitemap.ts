import type { MetadataRoute } from "next";
import { getAllBugs } from "@/lib/data";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
 const bugs = await getAllBugs();
 return [{
 url: "https://bughub.vip",
 lastModified: new Date(),
 changeFrequency: "weekly",
 priority: 1
 }, ...bugs.map(bug => ({
 url: `https://bughub.vip/bug/${encodeURIComponent(bug.id)}`,
 lastModified: bug.date ? new Date(`${bug.date}T00:00:00+08:00`) : new Date(),
 changeFrequency: ("monthly" as const),
 priority: 0.8
 }))];
}
