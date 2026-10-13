import { unstable_noStore as noStore } from "next/cache";
import { getDatabase, getDatabasePath, type BugRow, type CategoryRow, type SubcategoryRow } from "@/lib/database";


type ContentSource = "sqlite";

type JoinedBugRow = BugRow & {
  l1_name: string;
  l1_description: string;
  l1_sort_order: number;
  l2_name: string;
  l2_sort_order: number;
};

export type CatalogBug = {
  id: string;
  slug: string;
  title: string;
  severity: string;
  stage: string;
  date: string;
  takeaway: string;
  domains: string[];
  patterns: string[];
  tags: string[];
  categoryPath: string[];
  searchText: string;
};

export type CatalogL2 = {
  id: string;
  name: string;
  bugs: CatalogBug[];
};

export type CatalogL1 = {
  id: string;
  name: string;
  description: string;
  count: number;
  directBugs: CatalogBug[];
  children: CatalogL2[];
};

export type BugDetail = CatalogBug & {
  body: string;
  impact: string;
  source: string;
  sourcePath: string;
  githubUrl: string;
  l1Id: string;
  l1Name: string;
  l2Id: string | null;
  l2Name: string | null;
};

export type ContentSnapshot = {
  bugs: BugDetail[];
  commitSha: string;
  source: ContentSource;
  generatedAt: string;
};

function normalizeText(value: string): string {
  return value.normalize("NFC").trim();
}

function decodeRoutePart(value: string): string {
  try {
    return normalizeText(decodeURIComponent(value));
  } catch {
    return normalizeText(value);
  }
}

function stringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map((item) => normalizeText(String(item))).filter(Boolean)))
      : [];
  } catch {
    return [];
  }
}

function plainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~\-|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rowToBug(row: JoinedBugRow): BugDetail {
  const domains = stringArray(row.domains_json);
  const patterns = stringArray(row.patterns_json);
  const categoryPath = [row.l1_name, row.l2_name].filter(Boolean);
  const searchText = plainText([
    row.title,
    row.takeaway,
    row.impact,
    categoryPath.join(" "),
    domains.join(" "),
    patterns.join(" "),
    row.body_markdown,
  ].join(" ")).toLowerCase();
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    severity: row.severity,
    stage: row.stage,
    date: row.date,
    takeaway: row.takeaway,
    domains,
    patterns,
    tags: patterns,
    categoryPath,
    searchText,
    body: row.body_markdown,
    impact: row.impact,
    source: row.source,
    sourcePath: `sqlite:${row.id}`,
    githubUrl: "",
    l1Id: row.category_id,
    l1Name: row.l1_name,
    l2Id: row.subcategory_id || null,
    l2Name: row.l2_name || null,
  };
}

function loadSnapshot(): ContentSnapshot {
  noStore();
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT b.*, c.name AS l1_name, c.description AS l1_description,
      c.sort_order AS l1_sort_order, s.name AS l2_name, s.sort_order AS l2_sort_order
    FROM bugs b
    JOIN categories c ON c.id = b.category_id
    JOIN subcategories s ON s.id = b.subcategory_id AND s.category_id = b.category_id
    WHERE b.status = ?
    ORDER BY c.sort_order ASC, s.sort_order ASC, b.sort_order ASC, b.id ASC
  `).all("published") as JoinedBugRow[];
  const latest = db.prepare("SELECT COALESCE(MAX(updated_at), CURRENT_TIMESTAMP) AS value FROM bugs").get() as { value: string };
  return {
    bugs: rows.map(rowToBug),
    commitSha: `sqlite:${latest.value}`,
    source: "sqlite",
    generatedAt: new Date().toISOString(),
  };
}

function toSummary(bug: BugDetail): CatalogBug {
  const { id, slug, title, severity, stage, date, takeaway, domains, patterns, tags, categoryPath, searchText } = bug;
  return { id, slug, title, severity, stage, date, takeaway, domains, patterns, tags, categoryPath, searchText };
}

function compareBug(a: BugDetail, b: BugDetail): number {
  if (a.date !== b.date) return a.date > b.date ? -1 : 1;
  return a.id.localeCompare(b.id, "zh-CN");
}

export async function getCatalog(): Promise<CatalogL1[]> {
  const snapshot = loadSnapshot();
  const db = getDatabase();
  const categories = db.prepare("SELECT id, name, description, sort_order FROM categories ORDER BY sort_order, id").all() as CategoryRow[];
  const subcategories = db.prepare("SELECT id, category_id, name, sort_order FROM subcategories ORDER BY category_id, sort_order, id").all() as SubcategoryRow[];
  const groups = new Map<string, CatalogL1>();
  const children = new Map<string, CatalogL2>();

  for (const category of categories) {
    groups.set(category.id, {
      id: category.id,
      name: category.name,
      description: category.description,
      count: 0,
      directBugs: [],
      children: [],
    });
  }
  for (const subcategory of subcategories) {
    const parent = groups.get(subcategory.category_id);
    if (!parent) continue;
    const child: CatalogL2 = { id: subcategory.id, name: subcategory.name, bugs: [] };
    children.set(subcategory.id, child);
    parent.children.push(child);
  }
  for (const bug of [...snapshot.bugs].sort(compareBug)) {
    const parent = groups.get(bug.l1Id);
    if (!parent) continue;
    const summary = toSummary(bug);
    if (bug.l2Id) children.get(bug.l2Id)?.bugs.push(summary);
    else parent.directBugs.push(summary);
    parent.count += 1;
  }
  return Array.from(groups.values())
    .map((category) => ({ ...category, children: category.children.filter((child) => child.bugs.length > 0) }))
    .filter((category) => category.count > 0);
}

export async function getAllBugs(): Promise<BugDetail[]> {
  return [...loadSnapshot().bugs].sort(compareBug);
}

export async function getBugByRoute(value: string): Promise<BugDetail | null> {
  const key = decodeRoutePart(value);
  return loadSnapshot().bugs.find((bug) =>
    bug.id.toLowerCase() === key.toLowerCase()
    || bug.slug.toLowerCase() === key.toLowerCase()
    || normalizeText(bug.title) === key
  ) || null;
}

export async function getRelatedBugs(current: BugDetail, limit = 4): Promise<CatalogBug[]> {
  const scored = loadSnapshot().bugs
    .filter((bug) => bug.id !== current.id)
    .map((bug) => {
      const sharedPatterns = bug.patterns.filter((item) => current.patterns.includes(item)).length;
      const sharedDomains = bug.domains.filter((item) => current.domains.includes(item)).length;
      const sameCategory = bug.l1Id === current.l1Id ? 1 : 0;
      return { bug, score: sharedPatterns * 4 + sharedDomains * 2 + sameCategory };
    })
    .filter((item) => item.score > 0);
  scored.sort((a, b) => b.score - a.score || compareBug(a.bug, b.bug));
  return scored.slice(0, limit).map((item) => toSummary(item.bug));
}

export async function getContentStatus() {
  const snapshot = loadSnapshot();
  return {
    count: snapshot.bugs.length,
    source: snapshot.source,
    commitSha: snapshot.commitSha,
    generatedAt: snapshot.generatedAt,
    databasePath: getDatabasePath(),
  };
}

export const getBugBySlug = getBugByRoute;
