import "server-only";
import { getProcessor } from "bytemd";
import { bytemdPlugins } from "@/lib/bytemd-plugins";

export async function renderMarkdown(value: string): Promise<string> {
  const file = await getProcessor({ plugins: bytemdPlugins() }).process(value || "");
  return String(file);
}

export type Heading = { id: string; text: string };

export async function renderMarkdownWithOutline(
  value: string
): Promise<{ html: string; headings: Heading[] }> {
  const raw = await renderMarkdown(value);
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  const html = raw.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (_m, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, "").trim();
    const base = text.replace(/\s+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "") || "section";
    const n = used.get(base) || 0;
    used.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n}`;
    headings.push({ id, text });
    return `<h2 id="${id}"${attrs}>${inner}</h2>`;
  });
  return { html, headings };
}
