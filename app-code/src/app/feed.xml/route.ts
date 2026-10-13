import { getAllBugs } from "@/lib/data";
export const dynamic = "force-dynamic";
export const revalidate = 0;
type FeedItem = {
  title: string;
  url: string;
  description: string;
  date: string;
};
function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/\u0027/g, "&apos;");
}
export async function GET() {
 const bugs = await getAllBugs();
 const feedItems: FeedItem[] = bugs.map(bug => ({
 title: bug.title,
 url: `https://bughub.vip/bug/${encodeURIComponent(bug.id)}`,
 description: bug.takeaway,
 date: bug.date
 }));
  feedItems.sort((a, b) => {
    if (a.date !== b.date) return a.date > b.date ? -1 : 1;
    return a.url.localeCompare(b.url);
  });
  const fallbackPubDate = new Date().toUTCString();
  const items = feedItems.map(item => {
    const pubDate = item.date ? new Date(`${item.date}T00:00:00+08:00`).toUTCString() : fallbackPubDate;
    return ["<item>", `<title>${escapeXml(item.title)}</title>`, `<link>${escapeXml(item.url)}</link>`, `<guid isPermaLink=\"true\">${escapeXml(item.url)}</guid>`, `<description>${escapeXml(item.description)}</description>`, `<pubDate>${pubDate}</pubDate>`, "</item>"].join("");
  }).join("");
  const xml = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>", "<rss version=\"2.0\"><channel>", "<title>BugHub</title>", "<link>https://bughub.vip</link>", "<description>常见 Bug 分类、失效本质与测试警惕点</description>", "<language>zh-CN</language>", items, "</channel></rss>"].join("");
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
    }
  });
}
