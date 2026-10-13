import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import seed from "../../db/seeds/common-bugs.json";

export type BugSeverity = "P0" | "P1" | "P2" | "P3";
export type BugStatus = "published" | "draft";
export type BugSource = "real-anonymized" | "scenario-reconstruction";

export type SeedCategory = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  subcategories: Array<{ id: string; name: string; sortOrder: number }>;
};

export type SeedBug = {
  id: string;
  slug: string;
  title: string;
  severity: BugSeverity;
  stage: string;
  date: string;
  status: BugStatus;
  domains: string[];
  patterns: string[];
  impact: string;
  source: BugSource;
  takeaway: string;
  bodyMarkdown: string;
  categoryId: string;
  subcategoryId: string;
  sortOrder: number;
};

type SeedData = {
  version: number;
  categories: SeedCategory[];
  bugs: SeedBug[];
};

export type CategoryRow = {
  id: string;
  name: string;
  description: string;
  sort_order: number;
};

export type SubcategoryRow = {
  id: string;
  category_id: string;
  name: string;
  sort_order: number;
};

export type BugRow = {
  id: string;
  slug: string;
  title: string;
  severity: BugSeverity;
  stage: string;
  date: string;
  status: BugStatus;
  domains_json: string;
  patterns_json: string;
  impact: string;
  source: BugSource;
  takeaway: string;
  body_markdown: string;
  category_id: string;
  subcategory_id: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const SCHEMA_VERSION = 1;
const severityValues = new Set<BugSeverity>(["P0", "P1", "P2", "P3"]);
const statusValues = new Set<BugStatus>(["published", "draft"]);
const sourceValues = new Set<BugSource>(["real-anonymized", "scenario-reconstruction"]);

const schemaSql = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS subcategories (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE(category_id, name),
  UNIQUE(category_id, sort_order)
);
CREATE TABLE IF NOT EXISTS bugs (
  id TEXT PRIMARY KEY CHECK (id GLOB 'BH-[0-9][0-9][0-9][0-9]'),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL UNIQUE,
  severity TEXT NOT NULL CHECK (severity IN ('P0', 'P1', 'P2', 'P3')),
  stage TEXT NOT NULL,
  date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  status TEXT NOT NULL CHECK (status IN ('published', 'draft')),
  domains_json TEXT NOT NULL CHECK (json_valid(domains_json)),
  patterns_json TEXT NOT NULL CHECK (json_valid(patterns_json)),
  impact TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('real-anonymized', 'scenario-reconstruction')),
  takeaway TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  subcategory_id TEXT NOT NULL REFERENCES subcategories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bugs_publication ON bugs(status, date DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_bugs_category ON bugs(category_id, subcategory_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_bugs_slug ON bugs(slug);
CREATE TRIGGER IF NOT EXISTS bugs_category_match_insert
BEFORE INSERT ON bugs
WHEN NOT EXISTS (
  SELECT 1 FROM subcategories
  WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'subcategory does not belong to category');
END;
CREATE TRIGGER IF NOT EXISTS bugs_category_match_update
BEFORE UPDATE OF category_id, subcategory_id ON bugs
WHEN NOT EXISTS (
  SELECT 1 FROM subcategories
  WHERE id = NEW.subcategory_id AND category_id = NEW.category_id
)
BEGIN
  SELECT RAISE(ABORT, 'subcategory does not belong to category');
END;
`;

function databasePath(): string {
  const configured = process.env.BUGHUB_DATABASE_PATH?.trim();
  return configured ? path.resolve(configured) : path.join(process.cwd(), ".data", "bughub.sqlite");
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} 必须是非空字符串数组`);
  }
  return Array.from(new Set(value.map((item) => item.trim())));
}

function validateSeed(data: SeedData): void {
  if (!Number.isInteger(data.version) || data.version < 1) throw new Error("seed.version 必须是正整数");
  if (!Array.isArray(data.categories) || !Array.isArray(data.bugs)) throw new Error("seed categories/bugs 必须是数组");
  const categoryIds = new Set<string>();
  const subcategoryIds = new Set<string>();
  const subcategoryParents = new Map<string, string>();
  const bugIds = new Set<string>();
  const titles = new Set<string>();
  const slugs = new Set<string>();
  for (const category of data.categories) {
    if (!category.id || !category.name || !category.description || !Number.isInteger(category.sortOrder)) throw new Error("分类字段不完整");
    if (categoryIds.has(category.id)) throw new Error(`重复分类 ID: ${category.id}`);
    categoryIds.add(category.id);
    for (const subcategory of category.subcategories) {
      if (!subcategory.id || !subcategory.name || !Number.isInteger(subcategory.sortOrder)) throw new Error(`分类 ${category.id} 的子分类字段不完整`);
      if (subcategoryIds.has(subcategory.id)) throw new Error(`重复子分类 ID: ${subcategory.id}`);
      subcategoryIds.add(subcategory.id);
      subcategoryParents.set(subcategory.id, category.id);
    }
  }
  for (const bug of data.bugs) {
    if (!/^BH-\d{4}$/.test(bug.id)) throw new Error(`非法 Bug ID: ${bug.id}`);
    if (!bug.slug || !bug.title || !bug.stage || !/^\d{4}-\d{2}-\d{2}$/.test(bug.date)) throw new Error(`Bug ${bug.id} 基础字段不完整`);
    if (!severityValues.has(bug.severity) || !statusValues.has(bug.status) || !sourceValues.has(bug.source)) throw new Error(`Bug ${bug.id} 枚举值非法`);
    if (!categoryIds.has(bug.categoryId) || !subcategoryIds.has(bug.subcategoryId) || subcategoryParents.get(bug.subcategoryId) !== bug.categoryId) throw new Error(`Bug ${bug.id} 分类引用不存在或不匹配`);
    if (!bug.impact || !bug.takeaway || !bug.bodyMarkdown || !Number.isInteger(bug.sortOrder)) throw new Error(`Bug ${bug.id} 内容字段不完整`);
    stringArray(bug.domains, `${bug.id}.domains`);
    stringArray(bug.patterns, `${bug.id}.patterns`);
    if (bugIds.has(bug.id) || titles.has(bug.title) || slugs.has(bug.slug)) throw new Error(`Bug ${bug.id} 的 ID、标题或 slug 重复`);
    bugIds.add(bug.id);
    titles.add(bug.title);
    slugs.add(bug.slug);
  }
}

function seedDatabase(db: Database.Database, data: SeedData, replace: boolean): void {
  validateSeed(data);
  const run = db.transaction(() => {
    if (replace) {
      db.prepare("DELETE FROM bugs").run();
      db.prepare("DELETE FROM subcategories").run();
      db.prepare("DELETE FROM categories").run();
    }
    const insertCategory = db.prepare(`INSERT INTO categories (id, name, description, sort_order)
      VALUES (@id, @name, @description, @sortOrder)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description, sort_order=excluded.sort_order`);
    const insertSubcategory = db.prepare(`INSERT INTO subcategories (id, category_id, name, sort_order)
      VALUES (@id, @categoryId, @name, @sortOrder)
      ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id, name=excluded.name, sort_order=excluded.sort_order`);
    const insertBug = db.prepare(`INSERT INTO bugs (
      id, slug, title, severity, stage, date, status, domains_json, patterns_json, impact, source, takeaway,
      body_markdown, category_id, subcategory_id, sort_order, updated_at
    ) VALUES (
      @id, @slug, @title, @severity, @stage, @date, @status, @domainsJson, @patternsJson, @impact, @source,
      @takeaway, @bodyMarkdown, @categoryId, @subcategoryId, @sortOrder, CURRENT_TIMESTAMP
    ) ON CONFLICT(id) DO UPDATE SET
      slug=excluded.slug, title=excluded.title, severity=excluded.severity, stage=excluded.stage, date=excluded.date,
      status=excluded.status, domains_json=excluded.domains_json, patterns_json=excluded.patterns_json,
      impact=excluded.impact, source=excluded.source, takeaway=excluded.takeaway, body_markdown=excluded.body_markdown,
      category_id=excluded.category_id, subcategory_id=excluded.subcategory_id, sort_order=excluded.sort_order,
      updated_at=CURRENT_TIMESTAMP`);
    for (const category of data.categories) {
      insertCategory.run(category);
      for (const subcategory of category.subcategories) insertSubcategory.run({ ...subcategory, categoryId: category.id });
    }
    for (const bug of data.bugs) {
      insertBug.run({ ...bug, domainsJson: JSON.stringify(stringArray(bug.domains, `${bug.id}.domains`)), patternsJson: JSON.stringify(stringArray(bug.patterns, `${bug.id}.patterns`)) });
    }
  });
  run();
}

function createDatabase(): Database.Database {
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.exec(schemaSql);
  db.prepare("INSERT OR IGNORE INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
  const count = (db.prepare("SELECT COUNT(*) AS count FROM bugs").get() as { count: number }).count;
  const seedData = seed as SeedData;
  if (count === 0 && seedData.bugs.length > 0) seedDatabase(db, seedData, false);
  return db;
}

declare global {
  // eslint-disable-next-line no-var
  var __bughubDatabase: Database.Database | undefined;
}

export function getDatabase(): Database.Database {
  if (!globalThis.__bughubDatabase) globalThis.__bughubDatabase = createDatabase();
  return globalThis.__bughubDatabase;
}

export function getDatabasePath(): string {
  return databasePath();
}

export function resetDatabaseFromSeed(): void {
  seedDatabase(getDatabase(), seed as SeedData, true);
}

export function getSeedData(): SeedData {
  return seed as SeedData;
}

export function upsertBugRecord(bug: SeedBug): void {
  const data = seed as SeedData;
  validateSeed({ version: data.version, categories: data.categories, bugs: [bug] });
  const db = getDatabase();
  const subcategory = db.prepare("SELECT category_id FROM subcategories WHERE id = ?").get(bug.subcategoryId) as { category_id: string } | undefined;
  if (!subcategory || subcategory.category_id !== bug.categoryId) throw new Error(`分类引用不存在或不匹配: ${bug.categoryId}/${bug.subcategoryId}`);
  db.prepare(`INSERT INTO bugs (
    id, slug, title, severity, stage, date, status, domains_json, patterns_json, impact, source, takeaway,
    body_markdown, category_id, subcategory_id, sort_order, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, severity=excluded.severity, stage=excluded.stage,
    date=excluded.date, status=excluded.status, domains_json=excluded.domains_json, patterns_json=excluded.patterns_json,
    impact=excluded.impact, source=excluded.source, takeaway=excluded.takeaway, body_markdown=excluded.body_markdown,
    category_id=excluded.category_id, subcategory_id=excluded.subcategory_id, sort_order=excluded.sort_order,
    updated_at=CURRENT_TIMESTAMP`).run(
      bug.id, bug.slug, bug.title, bug.severity, bug.stage, bug.date, bug.status, JSON.stringify(bug.domains),
      JSON.stringify(bug.patterns), bug.impact, bug.source, bug.takeaway, bug.bodyMarkdown, bug.categoryId,
      bug.subcategoryId, bug.sortOrder
    );
}
