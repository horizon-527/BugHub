/**
 * 解析并校验“BugHub 经验卡片”：frontmatter（--- 包裹的头信息）+ 六段正文。
 * 规则与 workflow/add_bug.py 保持一致，区别是这里一次性返回所有问题，而不是遇到第一个就停。
 * 纯函数、不依赖数据库，所以可以单独测试；分类是否存在、标题是否重复等需要查库的检查在 admin-data.ts。
 */
import type { BugSeverity, BugSource, BugStatus } from "@/lib/database";

export const CARD_SEVERITIES: readonly string[] = ["P0", "P1", "P2", "P3"];
export const CARD_STAGES: readonly string[] = ["线上", "灰度发布", "常规测试"];
export const CARD_STATUSES: readonly string[] = ["published", "draft"];
export const CARD_SOURCES: readonly string[] = ["real-anonymized", "scenario-reconstruction"];
export const CARD_SECTIONS: readonly string[] = ["问题现象", "背景", "根本原因", "解决方案", "测试建议", "经验总结"];
export const CARD_TITLE_MAX = 30;
const REQUIRED_FIELDS = ["title", "severity", "stage", "impact", "takeaway", "category", "subcategory"] as const;
const LIST_FIELDS = new Set(["domains", "patterns"]);

export type CardInput = {
  /** 空字符串表示由系统自动分配下一个编号。 */
  id: string;
  title: string;
  severity: BugSeverity;
  stage: string;
  /** 空字符串表示用导入当天（上海时区）。 */
  date: string;
  status: BugStatus;
  source: BugSource;
  domains: string[];
  patterns: string[];
  impact: string;
  takeaway: string;
  category: string;
  subcategory: string;
  /** null 表示取该分类当前最大值 + 1。 */
  sortOrder: number | null;
  bodyMarkdown: string;
};

export type CardParseResult = { ok: true; card: CardInput } | { ok: false; errors: string[] };

/** 去掉 value 后面的 # 注释，引号里的 # 不算。 */
function stripInlineComment(value: string): string {
  let quote: string | null = null;
  let out = "";
  for (const ch of value) {
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
    } else if (ch === "#") {
      break;
    } else {
      out += ch;
    }
  }
  return out.trim();
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' || first === "'") && first === last) return v.slice(1, -1);
    if (first === "“" && last === "”") return v.slice(1, -1);
  }
  return v;
}

/** 解析 ["a", "b"]：只在引号外面按逗号（含中文逗号）切分，所以条目里可以有逗号。 */
function parseList(value: string): string[] {
  let v = value.trim();
  if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1);
  const items: string[] = [];
  let current = "";
  let quote: string | null = null;
  const flush = () => {
    const item = unquote(current.trim());
    if (item) items.push(item);
    current = "";
  };
  for (const ch of v) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
    } else if (ch === "," || ch === "，") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
  return items;
}

/** AI 回复经常把整张卡片包在 ```markdown 围栏里，这里剥掉最外层的围栏（正文里自己的代码块不受影响）。 */
function stripOuterCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```[\w-]*[ \t]*\n([\s\S]*?)\n```[ \t]*$/);
  return match ? match[1] : trimmed;
}

export function parseAndCheckCard(raw: string): CardParseResult {
  const text = stripOuterCodeFence(raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n"));
  // 允许头信息前面有一两句寒暄（“好的，以下是卡片：”）。
  const match = text.match(/(?:^|\n)---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)([\s\S]*)$/);
  if (!match) {
    return { ok: false, errors: ["没有找到头信息：卡片要以单独一行的 --- 开头，头信息结束后再用单独一行的 --- 收尾。"] };
  }
  const bodyMarkdown = match[2].trim();

  const fields: Record<string, string> = {};
  const lists: Record<string, string[]> = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#") || !line.includes(":")) continue;
    const index = line.indexOf(":");
    const key = line.slice(0, index).trim();
    const value = stripInlineComment(line.slice(index + 1));
    if (LIST_FIELDS.has(key)) lists[key] = parseList(value);
    else fields[key] = unquote(value);
  }

  const errors: string[] = [];
  for (const key of REQUIRED_FIELDS) {
    if (!fields[key]) errors.push(`头信息缺少必填字段：${key}`);
  }

  const title = fields.title ?? "";
  const titleLength = Array.from(title).length;
  if (title && titleLength > CARD_TITLE_MAX) errors.push(`title 超过 ${CARD_TITLE_MAX} 字（现在 ${titleLength} 字）：${title}`);
  if (fields.severity && !CARD_SEVERITIES.includes(fields.severity)) errors.push(`severity 只能是 P0/P1/P2/P3，现在是：${fields.severity}`);
  if (fields.stage && !CARD_STAGES.includes(fields.stage)) errors.push(`stage 只能是 ${CARD_STAGES.join(" / ")}，现在是：${fields.stage}`);

  const status = fields.status || "published";
  if (!CARD_STATUSES.includes(status)) errors.push(`status 只能是 published 或 draft，现在是：${status}`);
  const source = fields.source || "real-anonymized";
  if (!CARD_SOURCES.includes(source)) errors.push(`source 只能是 ${CARD_SOURCES.join(" / ")}，现在是：${source}`);

  const date = fields.date ?? "";
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`)))) {
    errors.push(`date 格式应为 YYYY-MM-DD，现在是：${date}`);
  }

  const rawId = (fields.id ?? "").trim();
  const id = !rawId || rawId.toUpperCase() === "BH-XXXX" ? "" : rawId.toUpperCase();
  if (id && !/^BH-\d{4}$/.test(id)) errors.push(`id 应为 BH-0000 的形式，或留空 / BH-XXXX 让系统自动分配，现在是：${rawId}`);

  const sortOrderText = (fields.sortOrder ?? "").trim();
  const sortOrder = /^\d+$/.test(sortOrderText) ? Number(sortOrderText) : null;

  for (const section of CARD_SECTIONS) {
    if (!bodyMarkdown.includes(`## ${section}`)) errors.push(`正文缺少段落：## ${section}`);
  }
  if (bodyMarkdown.length > 200000) errors.push("正文超过 200000 个字符");

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    card: {
      id,
      title,
      severity: fields.severity as BugSeverity,
      stage: fields.stage,
      date,
      status: status as BugStatus,
      source: source as BugSource,
      domains: lists.domains ?? [],
      patterns: lists.patterns ?? [],
      impact: fields.impact,
      takeaway: fields.takeaway,
      category: fields.category,
      subcategory: fields.subcategory,
      sortOrder,
      bodyMarkdown,
    },
  };
}
