import { getAllBugs, type BugDetail } from "@/lib/data";

export type BugSummary = {
  id: string;
  title: string;
  severity: string;
  category: string;
  subcategory: string | null;
  domains: string[];
  patterns: string[];
  impact: string;
  takeaway: string;
  url: string;
};

const SEVERITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export function toSummary(bug: BugDetail): BugSummary {
  return {
    id: bug.id,
    title: bug.title,
    severity: bug.severity,
    category: bug.l1Name,
    subcategory: bug.l2Name,
    domains: bug.domains,
    patterns: bug.patterns,
    impact: bug.impact,
    takeaway: bug.takeaway,
    url: `/bug/${bug.id}`,
  };
}

function bigrams(text: string): string[] {
  const t = text.replace(/\s+/g, "");
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i += 1) out.push(t.slice(i, i + 2));
  return out;
}

export function scoreBug(bug: BugDetail, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  const terms = [...bug.domains, ...bug.patterns, bug.l1Name, bug.l2Name || ""].filter(Boolean);
  for (const term of terms) if (q.includes(term.toLowerCase())) score += 3;
  for (const gram of bigrams(bug.title)) if (q.includes(gram.toLowerCase())) score += 1;
  if (q.length <= 12 && bug.searchText.includes(q)) score += 2;
  return score;
}

export type SearchParams = {
  q?: string;
  domain?: string;
  pattern?: string;
  category?: string;
  severity?: string;
  limit?: number;
};

export async function searchBugs(params: SearchParams): Promise<BugDetail[]> {
  const all = await getAllBugs();
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 30);
  let list = all;
  if (params.domain) list = list.filter((b) => b.domains.some((d) => d.includes(params.domain!)));
  if (params.pattern) list = list.filter((b) => b.patterns.some((p) => p.includes(params.pattern!)));
  if (params.category) list = list.filter((b) => b.l1Name.includes(params.category!) || b.l1Id === params.category);
  if (params.severity) list = list.filter((b) => b.severity.toUpperCase() === params.severity!.toUpperCase());
  if (params.q) {
    const scored = list
      .map((b) => ({ b, s: scoreBug(b, params.q!) }))
      .filter((x) => x.s > 0);
    scored.sort(
      (a, z) =>
        z.s - a.s ||
        (SEVERITY_ORDER[a.b.severity] ?? 9) - (SEVERITY_ORDER[z.b.severity] ?? 9) ||
        a.b.id.localeCompare(z.b.id)
    );
    list = scored.map((x) => x.b);
  } else {
    list = [...list].sort(
      (a, z) =>
        (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[z.severity] ?? 9) ||
        a.id.localeCompare(z.id)
    );
  }
  return list.slice(0, limit);
}
