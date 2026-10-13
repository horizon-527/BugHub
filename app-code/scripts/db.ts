import fs from "node:fs";
import path from "node:path";
import {
  getDatabase,
  getDatabasePath,
  resetDatabaseFromSeed,
  upsertBugRecord,
  type BugSeverity,
  type BugSource,
  type BugStatus,
  type SeedBug,
} from "../src/lib/database";

type Frontmatter = Record<string, unknown>;

function usage(): never {
  console.error(`用法：
  npm run db:init
  npm run db:stats
  npm run db:reset
  npm run db:export -- [输出目录]
  npm run db:import -- <Markdown 文件>
  npm run db:delete -- <BH-XXXX>`);
  process.exit(1);
}

function parseValue(raw: string): unknown {
  const value = raw.trim();
  try {
    return JSON.parse(value);
  } catch {
    return value.replace(/^"|"$/g, "");
  }
}

function parseMarkdown(file: string): { data: Frontmatter; body: string } {
  const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) throw new Error("Markdown 缺少合法 frontmatter");
  const data: Frontmatter = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!field) throw new Error(`无法解析 frontmatter 行: ${line}`);
    data[field[1]] = parseValue(field[2]);
  }
  return { data, body: text.slice(match[0].length).trim() };
}

function requiredString(data: Frontmatter, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`缺少字符串字段 ${key}`);
  return value.trim();
}

function stringArray(data: Frontmatter, key: string): string[] {
  const value = data[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string") || value.length === 0) {
    throw new Error(`${key} 必须是非空字符串数组`);
  }
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function stats(): void {
  const db = getDatabase();
  const counts = db.prepare(`SELECT
    (SELECT COUNT(*) FROM categories) AS categories,
    (SELECT COUNT(*) FROM subcategories) AS subcategories,
    (SELECT COUNT(*) FROM bugs) AS bugs,
    (SELECT COUNT(*) FROM bugs WHERE status = 'published') AS published,
    (SELECT COUNT(*) FROM bugs WHERE status = 'draft') AS drafts`).get() as Record<string, number>;
  console.log(JSON.stringify({ database: getDatabasePath(), ...counts }, null, 2));
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

function exportMarkdown(outputArg?: string): void {
  const db = getDatabase();
  const output = path.resolve(outputArg || path.join(process.cwd(), ".data", "exports"));
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const rows = db.prepare(`SELECT b.*, c.name AS category_name, s.name AS subcategory_name
    FROM bugs b
    JOIN categories c ON c.id = b.category_id
    JOIN subcategories s ON s.id = b.subcategory_id
    ORDER BY c.sort_order, s.sort_order, b.sort_order, b.id`).all() as Array<Record<string, string | number>>;
  for (const row of rows) {
    const directory = path.join(output, safeName(String(row.category_name)), safeName(String(row.subcategory_name)));
    fs.mkdirSync(directory, { recursive: true });
    const lines = [
      "---",
      `id: ${JSON.stringify(row.id)}`,
      `slug: ${JSON.stringify(row.slug)}`,
      `title: ${JSON.stringify(row.title)}`,
      `severity: ${JSON.stringify(row.severity)}`,
      `stage: ${JSON.stringify(row.stage)}`,
      `date: ${JSON.stringify(row.date)}`,
      `status: ${JSON.stringify(row.status)}`,
      `domains: ${row.domains_json}`,
      `patterns: ${row.patterns_json}`,
      `impact: ${JSON.stringify(row.impact)}`,
      `source: ${JSON.stringify(row.source)}`,
      `takeaway: ${JSON.stringify(row.takeaway)}`,
      `category: ${JSON.stringify(row.category_id)}`,
      `subcategory: ${JSON.stringify(row.subcategory_id)}`,
      `sortOrder: ${row.sort_order}`,
      "---",
      "",
      String(row.body_markdown).trim(),
      "",
    ];
    fs.writeFileSync(path.join(directory, `${row.id}-${safeName(String(row.title))}.md`), lines.join("\n"), "utf8");
  }
  console.log(`已导出 ${rows.length} 篇 Markdown 到 ${output}`);
}

function importMarkdown(fileArg?: string): void {
  if (!fileArg) usage();
  const file = path.resolve(fileArg);
  const { data, body } = parseMarkdown(file);
  if (!body) throw new Error("Markdown 正文不能为空");
  const id = requiredString(data, "id");
  const bug: SeedBug = {
    id,
    slug: typeof data.slug === "string" && data.slug.trim() ? data.slug.trim() : id,
    title: requiredString(data, "title"),
    severity: requiredString(data, "severity") as BugSeverity,
    stage: requiredString(data, "stage"),
    date: requiredString(data, "date"),
    status: requiredString(data, "status") as BugStatus,
    domains: stringArray(data, "domains"),
    patterns: stringArray(data, "patterns"),
    impact: requiredString(data, "impact"),
    source: requiredString(data, "source") as BugSource,
    takeaway: requiredString(data, "takeaway"),
    bodyMarkdown: body,
    categoryId: requiredString(data, "category"),
    subcategoryId: requiredString(data, "subcategory"),
    sortOrder: Number(data.sortOrder ?? 0),
  };
  if (!Number.isInteger(bug.sortOrder)) throw new Error("sortOrder 必须是整数");
  upsertBugRecord(bug);
  console.log(`已写入 ${bug.id}：${bug.title}`);
}

function deleteBug(idArg?: string): void {
  if (!idArg) usage();
  const result = getDatabase().prepare("DELETE FROM bugs WHERE id = ?").run(idArg.trim());
  if (result.changes === 0) throw new Error(`未找到 ${idArg}`);
  console.log(`已删除 ${idArg}`);
}

function main(): void {
  const [command, argument] = process.argv.slice(2);
  switch (command) {
    case "init":
      getDatabase();
      stats();
      break;
    case "stats":
      stats();
      break;
    case "reset":
      resetDatabaseFromSeed();
      stats();
      break;
    case "export":
      exportMarkdown(argument);
      break;
    case "import":
      importMarkdown(argument);
      break;
    case "delete":
      deleteBug(argument);
      break;
    default:
      usage();
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
