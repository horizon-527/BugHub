import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { parseAndCheckCard } from "@/lib/admin-card";
import { getDatabase, type BugRow, type BugSeverity, type BugSource, type BugStatus } from "@/lib/database";

export const ADMIN_PAGE_SIZE = 20;
export const DEFAULT_CATEGORY_ID = "uncategorized";
export const DEFAULT_SUBCATEGORY_ID = "uncategorized-default";

const BUG_STATUSES: readonly BugStatus[] = ["published", "draft"];

export type AdminStatusFilter = "all" | BugStatus;

export type AdminBug = {
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
  categoryId: string;
  subcategoryId: string;
  sortOrder: number;
  bodyMarkdown: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminBugListItem = {
  id: string;
  slug: string;
  title: string;
  status: BugStatus;
  categoryName: string;
  subcategoryName: string;
  updatedAt: string;
};

export type AdminStats = { total: number; published: number; draft: number };

export type AdminBugListResult = {
  items: AdminBugListItem[];
  total: number;
  page: number;
  totalPages: number;
  stats: AdminStats;
};

export type AdminListFilters = { q?: string; page?: number; status?: AdminStatusFilter };

export type AdminCategoryOption = {
  id: string;
  name: string;
  subcategories: Array<{ id: string; name: string }>;
};

export type AdminBugFormValues = {
  title: string;
  bodyMarkdown: string;
  status: BugStatus;
  categoryId: string;
  subcategoryId: string;
};
export type AdminBugFieldErrors = Partial<Record<keyof AdminBugFormValues, string>>;
export type AdminBugFormState = {
  values?: AdminBugFormValues;
  fieldErrors?: AdminBugFieldErrors;
  globalError?: string;
  /** 动作成功（或会话过期）后由客户端做整页跳转。不要在 Server Action 里用 redirect()，见 actions.ts。 */
  redirectTo?: string;
};
export type AdminBugMutationResult =
  | { ok: true; id: string; slug: string; previousSlug?: string }
  | { ok: false; state: AdminBugFormState };

export type AdminDeleteResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

export type AdminStatusResult =
  | { ok: true; id: string; slug: string; status: BugStatus }
  | { ok: false; error: string };

export function isBugStatus(value: unknown): value is BugStatus {
  return typeof value === "string" && (BUG_STATUSES as readonly string[]).includes(value);
}

export function parseStatusFilter(value: string): AdminStatusFilter {
  return isBugStatus(value) ? value : "all";
}

function parseJsonStrings(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function rowToAdminBug(row: BugRow): AdminBug {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    severity: row.severity,
    stage: row.stage,
    date: row.date,
    status: row.status,
    domains: parseJsonStrings(row.domains_json),
    patterns: parseJsonStrings(row.patterns_json),
    impact: row.impact,
    source: row.source,
    takeaway: row.takeaway,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    sortOrder: row.sort_order,
    bodyMarkdown: row.body_markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAdminStats(): AdminStats {
  noStore();
  const row = getDatabase().prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(status = 'published'), 0) AS published,
      COALESCE(SUM(status = 'draft'), 0) AS draft
    FROM bugs
  `).get() as AdminStats;
  return { total: row.total, published: row.published, draft: row.draft };
}

export function getAdminBugList(filters: AdminListFilters): AdminBugListResult {
  noStore();
  const clauses: string[] = [];
  const parameters: Array<string | number> = [];
  const q = filters.q?.trim().slice(0, 200) || "";
  if (q) {
    clauses.push("instr(lower(b.id || char(10) || b.title || char(10) || b.slug || char(10) || b.body_markdown), lower(?)) > 0");
    parameters.push(q);
  }
  if (filters.status && isBugStatus(filters.status)) {
    clauses.push("b.status = ?");
    parameters.push(filters.status);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const db = getDatabase();
  const count = db.prepare(`SELECT COUNT(*) AS count FROM bugs b ${where}`).get(...parameters) as { count: number };
  const totalPages = Math.max(1, Math.ceil(count.count / ADMIN_PAGE_SIZE));
  const requestedPage = Number.isInteger(filters.page) ? Number(filters.page) : 1;
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * ADMIN_PAGE_SIZE;
  const rows = db.prepare(`
    SELECT b.id, b.slug, b.title, b.status, b.updated_at,
      COALESCE(c.name, '') AS category_name, COALESCE(s.name, '') AS subcategory_name
    FROM bugs b
    LEFT JOIN categories c ON c.id = b.category_id
    LEFT JOIN subcategories s ON s.id = b.subcategory_id
    ${where}
    ORDER BY b.updated_at DESC, b.id ASC
    LIMIT ? OFFSET ?
  `).all(...parameters, ADMIN_PAGE_SIZE, offset) as Array<{
    id: string; slug: string; title: string; status: BugStatus; updated_at: string; category_name: string; subcategory_name: string;
  }>;
  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      categoryName: row.category_name,
      subcategoryName: row.subcategory_name,
      updatedAt: row.updated_at,
    })),
    total: count.count,
    page,
    totalPages,
    stats: getAdminStats(),
  };
}

export function getAdminBugById(id: string): AdminBug | null {
  noStore();
  const row = getDatabase().prepare("SELECT * FROM bugs WHERE id = ?").get(id) as BugRow | undefined;
  return row ? rowToAdminBug(row) : null;
}

/** 供表单下拉使用。只读：库里没有“未分类”时补一个虚拟选项，保存时才真正创建。 */
export function getAdminCategories(): AdminCategoryOption[] {
  noStore();
  const db = getDatabase();
  const categories = db.prepare("SELECT id, name FROM categories ORDER BY sort_order, id").all() as Array<{ id: string; name: string }>;
  const subcategories = db.prepare("SELECT id, category_id, name FROM subcategories ORDER BY category_id, sort_order, id")
    .all() as Array<{ id: string; category_id: string; name: string }>;
  const options: AdminCategoryOption[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    subcategories: subcategories
      .filter((subcategory) => subcategory.category_id === category.id)
      .map((subcategory) => ({ id: subcategory.id, name: subcategory.name })),
  }));
  if (!options.some((option) => option.id === DEFAULT_CATEGORY_ID)) {
    options.push({
      id: DEFAULT_CATEGORY_ID,
      name: "未分类",
      subcategories: [{ id: DEFAULT_SUBCATEGORY_ID, name: "未分类" }],
    });
  }
  return options;
}

export function getNextBugId(): string {
  noStore();
  const rows = getDatabase().prepare("SELECT id FROM bugs").all() as Array<{ id: string }>;
  let max = 0;
  for (const row of rows) {
    const match = /^BH-(\d{4})$/.exec(row.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  const next = max + 1;
  if (next > 9999) throw new Error("内容 ID 已用尽");
  return `BH-${String(next).padStart(4, "0")}`;
}

function ensureDefaultCategory(): void {
  const db = getDatabase();
  const run = db.transaction(() => {
    const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(DEFAULT_CATEGORY_ID) as { id: string } | undefined;
    if (!category) {
      const max = (db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM categories").get() as { value: number }).value;
      db.prepare("INSERT INTO categories (id, name, description, sort_order) VALUES (?, ?, ?, ?)")
        .run(DEFAULT_CATEGORY_ID, "未分类", "未归类的内容", max + 1);
    }
    const subcategory = db.prepare("SELECT id FROM subcategories WHERE id = ?").get(DEFAULT_SUBCATEGORY_ID) as { id: string } | undefined;
    if (!subcategory) {
      const max = (db.prepare("SELECT COALESCE(MAX(sort_order), 0) AS value FROM subcategories WHERE category_id = ?").get(DEFAULT_CATEGORY_ID) as { value: number }).value;
      db.prepare("INSERT INTO subcategories (id, category_id, name, sort_order) VALUES (?, ?, ?, ?)")
        .run(DEFAULT_SUBCATEGORY_ID, DEFAULT_CATEGORY_ID, "未分类", max + 1);
    }
  });
  run();
}

/** 校验分类/子分类归属；选中“未分类”且库里还没有时才会创建。 */
function resolveCategory(
  categoryId: string,
  subcategoryId: string,
): { ok: true; categoryId: string; subcategoryId: string } | { ok: false; error: string } {
  if (categoryId === DEFAULT_CATEGORY_ID && subcategoryId === DEFAULT_SUBCATEGORY_ID) {
    ensureDefaultCategory();
    return { ok: true, categoryId, subcategoryId };
  }
  if (!categoryId || !subcategoryId) return { ok: false, error: "请选择分类和子分类" };
  const match = getDatabase()
    .prepare("SELECT 1 AS ok FROM subcategories WHERE id = ? AND category_id = ?")
    .get(subcategoryId, categoryId);
  return match ? { ok: true, categoryId, subcategoryId } : { ok: false, error: "子分类不属于所选分类" };
}

declare global {
  // eslint-disable-next-line no-var
  var __bughubAdminLastTimestampMicros: number | undefined;
}

function preciseUtcNow(): string {
  let micros = Date.now() * 1000 + Number(process.hrtime.bigint() % BigInt(1000));
  if (globalThis.__bughubAdminLastTimestampMicros !== undefined
      && micros <= globalThis.__bughubAdminLastTimestampMicros) {
    micros = globalThis.__bughubAdminLastTimestampMicros + 1;
  }
  globalThis.__bughubAdminLastTimestampMicros = micros;
  const milliseconds = Math.floor(micros / 1000);
  const microRemainder = String(micros % 1000).padStart(3, "0");
  return `${new Date(milliseconds).toISOString().slice(0, -1)}${microRemainder}Z`;
}

/** 按上海时区取“今天”，避免凌晨新建内容被记成前一天。 */
function todayInShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function sqliteError(error: unknown): { code: string; message: string } | null {
  if (!error || typeof error !== "object") return null;
  const candidate = error as { code?: unknown; message?: unknown };
  return typeof candidate.code === "string" && typeof candidate.message === "string"
    ? { code: candidate.code, message: candidate.message }
    : null;
}

type ValidatedForm = { ok: true; values: AdminBugFormValues } | { ok: false; state: AdminBugFormState };

function validateForm(input: AdminBugFormValues): ValidatedForm {
  const values: AdminBugFormValues = {
    title: input.title.trim(),
    bodyMarkdown: input.bodyMarkdown.trim(),
    status: input.status,
    categoryId: input.categoryId.trim(),
    subcategoryId: input.subcategoryId.trim(),
  };
  const fieldErrors: AdminBugFieldErrors = {};
  if (!values.title) fieldErrors.title = "请输入标题";
  else if (values.title.length > 200) fieldErrors.title = "标题不能超过 200 个字符";
  if (!values.bodyMarkdown) fieldErrors.bodyMarkdown = "请输入 Markdown 正文";
  else if (values.bodyMarkdown.length > 200000) fieldErrors.bodyMarkdown = "Markdown 正文不能超过 200000 个字符";
  if (!isBugStatus(values.status)) fieldErrors.status = "状态无效";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, state: { values, fieldErrors, globalError: "请检查标记的字段" } };
  }
  return { ok: true, values };
}

function mutationError(error: unknown, values: AdminBugFormValues): AdminBugMutationResult {
  const details = sqliteError(error);
  if (details?.code.startsWith("SQLITE_CONSTRAINT")) {
    if (details.message.includes("bugs.title")) {
      return { ok: false, state: { values, fieldErrors: { title: "该标题已存在，请换一个" }, globalError: "保存失败，请修正标记的字段" } };
    }
    return { ok: false, state: { values, globalError: "保存失败，数据不符合约束" } };
  }
  return { ok: false, state: { values, globalError: "保存失败，请稍后重试" } };
}

export function createBug(input: AdminBugFormValues): AdminBugMutationResult {
  noStore();
  const validation = validateForm(input);
  if (!validation.ok) return validation;
  const { values } = validation;
  // 新建时未选分类，默认进“未分类”。
  const wantsDefault = !values.categoryId && !values.subcategoryId;
  const category = resolveCategory(
    wantsDefault ? DEFAULT_CATEGORY_ID : values.categoryId,
    wantsDefault ? DEFAULT_SUBCATEGORY_ID : values.subcategoryId,
  );
  if (!category.ok) return { ok: false, state: { values, fieldErrors: { subcategoryId: category.error }, globalError: "请检查标记的字段" } };

  const id = getNextBugId();
  const timestamp = preciseUtcNow();
  try {
    getDatabase().prepare(`
      INSERT INTO bugs (
        id, slug, title, severity, stage, date, status, domains_json, patterns_json, impact, source,
        takeaway, body_markdown, category_id, subcategory_id, sort_order, created_at, updated_at
      ) VALUES (
        @id, @slug, @title, 'P2', '', @date, @status, '[]', '[]', '', 'scenario-reconstruction',
        '', @bodyMarkdown, @categoryId, @subcategoryId, 0, @timestamp, @timestamp
      )
    `).run({
      id, slug: id, title: values.title, date: todayInShanghai(), status: values.status,
      bodyMarkdown: values.bodyMarkdown, categoryId: category.categoryId, subcategoryId: category.subcategoryId, timestamp,
    });
    return { ok: true, id, slug: id };
  } catch (error) {
    return mutationError(error, values);
  }
}

export type AdminImportResult =
  | { ok: true; id: string; title: string; status: BugStatus }
  | { ok: false; errors: string[] };

/**
 * 导入一整张经验卡片（与 workflow/add_bug.py 等价）。只新增、不覆盖：
 * 标题或 ID 已存在都会报错，要改已有内容请走编辑页。slug 一律等于 id（提示词也要求两者相同）。
 */
export function importCard(raw: string, options: { forceDraft: boolean }): AdminImportResult {
  noStore();
  const parsed = parseAndCheckCard(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const card = parsed.card;
  const db = getDatabase();
  const errors: string[] = [];

  const categoryMatch = db.prepare("SELECT 1 AS ok FROM subcategories WHERE id = ? AND category_id = ?").get(card.subcategory, card.category);
  if (!categoryMatch) errors.push(`分类不存在或不匹配：${card.category} / ${card.subcategory}（请使用提示词里的 catXX 编号）`);

  const sameTitle = db.prepare("SELECT id FROM bugs WHERE title = ?").get(card.title) as { id: string } | undefined;
  if (sameTitle) errors.push(`标题已存在（${sameTitle.id}）：${card.title}`);

  let id = card.id;
  if (id) {
    if (db.prepare("SELECT 1 AS ok FROM bugs WHERE id = ?").get(id)) errors.push(`${id} 已存在。导入只用于新增，要修改已有内容请到编辑页。`);
  } else {
    try {
      id = getNextBugId();
    } catch {
      errors.push("内容 ID 已用尽");
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const status: BugStatus = options.forceDraft ? "draft" : card.status;
  const timestamp = preciseUtcNow();
  try {
    db.transaction(() => {
      const sortOrder = card.sortOrder
        ?? (db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM bugs WHERE category_id = ?").get(card.category) as { value: number }).value;
      db.prepare(`
        INSERT INTO bugs (
          id, slug, title, severity, stage, date, status, domains_json, patterns_json, impact, source,
          takeaway, body_markdown, category_id, subcategory_id, sort_order, created_at, updated_at
        ) VALUES (
          @id, @slug, @title, @severity, @stage, @date, @status, @domainsJson, @patternsJson, @impact, @source,
          @takeaway, @bodyMarkdown, @categoryId, @subcategoryId, @sortOrder, @timestamp, @timestamp
        )
      `).run({
        id,
        slug: id,
        title: card.title,
        severity: card.severity,
        stage: card.stage,
        date: card.date || todayInShanghai(),
        status,
        domainsJson: JSON.stringify(card.domains),
        patternsJson: JSON.stringify(card.patterns),
        impact: card.impact,
        source: card.source,
        takeaway: card.takeaway,
        bodyMarkdown: card.bodyMarkdown,
        categoryId: card.category,
        subcategoryId: card.subcategory,
        sortOrder,
        timestamp,
      });
    })();
    return { ok: true, id, title: card.title, status };
  } catch (error) {
    const details = sqliteError(error);
    if (details?.code.startsWith("SQLITE_CONSTRAINT")) {
      return { ok: false, errors: [details.message.includes("bugs.title") ? `标题已存在：${card.title}` : `写入失败，数据不符合约束：${details.message}`] };
    }
    return { ok: false, errors: ["写入失败，请稍后重试"] };
  }
}

export function updateBug(originalId: string, input: AdminBugFormValues, expectedUpdatedAt: string): AdminBugMutationResult {
  noStore();
  const validation = validateForm(input);
  if (!validation.ok) return validation;
  const { values } = validation;
  const existing = getAdminBugById(originalId);
  if (!existing) return { ok: false, state: { values, globalError: "内容不存在或已被删除" } };
  if (!expectedUpdatedAt || existing.updatedAt !== expectedUpdatedAt) {
    return { ok: false, state: { values, globalError: "内容已被其他操作更新，请刷新后重试" } };
  }
  const category = resolveCategory(values.categoryId || existing.categoryId, values.subcategoryId || existing.subcategoryId);
  if (!category.ok) return { ok: false, state: { values, fieldErrors: { subcategoryId: category.error }, globalError: "请检查标记的字段" } };

  const timestamp = preciseUtcNow();
  try {
    const result = getDatabase().prepare(`
      UPDATE bugs SET title = @title, body_markdown = @bodyMarkdown, status = @status,
        category_id = @categoryId, subcategory_id = @subcategoryId, updated_at = @timestamp
      WHERE id = @id AND updated_at = @expectedUpdatedAt
    `).run({
      id: originalId, title: values.title, bodyMarkdown: values.bodyMarkdown, status: values.status,
      categoryId: category.categoryId, subcategoryId: category.subcategoryId, timestamp, expectedUpdatedAt,
    });
    if (result.changes !== 1) return { ok: false, state: { values, globalError: "内容已被其他操作更新，请刷新后重试" } };
    return { ok: true, id: originalId, slug: existing.slug, previousSlug: existing.slug };
  } catch (error) {
    return mutationError(error, values);
  }
}

/** 列表页的“发布 / 下线”快捷操作，只改状态，同样带乐观锁。 */
export function setBugStatus(id: string, status: BugStatus, expectedUpdatedAt: string): AdminStatusResult {
  noStore();
  if (!/^BH-\d{4}$/.test(id) || !isBugStatus(status) || !expectedUpdatedAt) return { ok: false, error: "参数无效" };
  const existing = getAdminBugById(id);
  if (!existing) return { ok: false, error: "内容不存在或已被删除" };
  if (existing.updatedAt !== expectedUpdatedAt) return { ok: false, error: "内容已被其他操作更新，请刷新后重试" };
  try {
    const result = getDatabase().prepare("UPDATE bugs SET status = ?, updated_at = ? WHERE id = ? AND updated_at = ?")
      .run(status, preciseUtcNow(), id, expectedUpdatedAt);
    if (result.changes !== 1) return { ok: false, error: "内容已被其他操作更新，请刷新后重试" };
    return { ok: true, id, slug: existing.slug, status };
  } catch {
    return { ok: false, error: "操作失败，请稍后重试" };
  }
}

export function deleteAdminBug(id: string, expectedUpdatedAt: string): AdminDeleteResult {
  noStore();
  if (!/^BH-\d{4}$/.test(id) || !expectedUpdatedAt) return { ok: false, error: "删除参数无效" };
  const existing = getAdminBugById(id);
  if (!existing) return { ok: false, error: "内容不存在或已被删除" };
  if (existing.updatedAt !== expectedUpdatedAt) {
    return { ok: false, error: "内容已被其他操作更新，请刷新后重试" };
  }
  try {
    const result = getDatabase().prepare("DELETE FROM bugs WHERE id = ? AND updated_at = ?").run(id, expectedUpdatedAt);
    if (result.changes !== 1) return { ok: false, error: "内容已被其他操作更新，请刷新后重试" };
    return { ok: true, id, slug: existing.slug };
  } catch {
    return { ok: false, error: "删除失败，请稍后重试" };
  }
}
