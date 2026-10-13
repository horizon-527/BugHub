#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = (process.env.BUGHUB_API_BASE || "https://bughub.vip").replace(/\/+$/, "");
const TIMEOUT_MS = Number(process.env.BUGHUB_TIMEOUT_MS || 15000);

async function apiGet(path, query) {
  const url = new URL(API_BASE + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`BugHub API ${res.status} ${res.statusText} for ${url.pathname}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function text(value) {
  return { content: [{ type: "text", text: value }] };
}

function fail(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `调用 BugHub 失败：${message}\n数据源：${API_BASE}` }], isError: true };
}

function formatBug(bug, withBody = true) {
  const lines = [];
  lines.push(`### ${bug.id}｜[${bug.severity}] ${bug.title}`);
  lines.push(`分类：${bug.category}${bug.subcategory ? " / " + bug.subcategory : ""}`);
  if (bug.domains?.length) lines.push(`领域：${bug.domains.join("、")}`);
  if (bug.patterns?.length) lines.push(`失效模式：${bug.patterns.join("、")}`);
  if (bug.takeaway) lines.push(`结论：${bug.takeaway}`);
  if (withBody && bug.body) {
    lines.push("");
    lines.push(bug.body);
  }
  lines.push(`详情：${API_BASE}/bug/${bug.id}`);
  return lines.join("\n");
}

const server = new McpServer({ name: "bughub", version: "1.0.0" });

server.registerTool(
  "list_taxonomy",
  {
    title: "列出 Bug 分类体系",
    description: "返回 BugHub 常见 Bug 库的完整分类（一级失效机制与二级模式及数量）。写代码或测试前可先了解有哪些失效维度。",
    inputSchema: {},
  },
  async () => {
    try {
      const data = await apiGet("/api/mcp/taxonomy");
      const lines = [`BugHub 常见 Bug 库：共 ${data.total} 条，${data.categoryCount} 个一级分类。`, ""];
      for (const c of data.categories) {
        lines.push(`## ${c.name}（${c.count}）— ${c.description}`);
        for (const s of c.subcategories) lines.push(`  - ${s.name}（${s.count}）`);
      }
      return text(lines.join("\n"));
    } catch (error) {
      return fail(error);
    }
  }
);

server.registerTool(
  "search_bugs",
  {
    title: "检索常见 Bug",
    description: "按关键词/领域/失效模式/分类/严重度检索常见 Bug，返回场景、根因和测试要点。用于写代码或测试用例时查找相关的历史坑。",
    inputSchema: {
      q: z.string().optional().describe("自由关键词，如“并发扣减库存”“退款金额”"),
      domain: z.string().optional().describe("业务领域过滤，如“并发与时序”"),
      pattern: z.string().optional().describe("失效模式过滤，如“超卖与并发占用”"),
      category: z.string().optional().describe("一级分类名或分类 id"),
      severity: z.string().optional().describe("严重度：P0/P1/P2/P3"),
      limit: z.number().int().min(1).max(30).optional().describe("返回条数，默认 8，最大 30"),
    },
  },
  async (args) => {
    try {
      const data = await apiGet("/api/mcp/search", args);
      if (!data.results?.length) return text(`没有匹配的 Bug。数据源：${API_BASE}`);
      const header = `命中 ${data.count} 条相关 Bug：\n`;
      return text(header + "\n" + data.results.map((b) => formatBug(b)).join("\n\n---\n\n"));
    } catch (error) {
      return fail(error);
    }
  }
);

server.registerTool(
  "get_bug",
  {
    title: "获取单条 Bug 详情",
    description: "按稳定编号（如 BH-1017）获取某条 Bug 的完整场景、根因与测试要点。",
    inputSchema: {
      id: z.string().describe("Bug 编号，形如 BH-1017"),
    },
  },
  async ({ id }) => {
    try {
      const bug = await apiGet(`/api/mcp/bug/${encodeURIComponent(id)}`);
      return text(formatBug(bug));
    } catch (error) {
      return fail(error);
    }
  }
);

server.registerTool(
  "review_context",
  {
    title: "按当前任务自查相关坑",
    description: "输入你正在写的功能或代码意图的自然语言描述，返回最相关的常见 Bug 及其测试要点，用于动手前规避、动手后自查。",
    inputSchema: {
      description: z.string().describe("正在实现或审查的功能/代码意图，如“订单并发扣减库存与释放”"),
      limit: z.number().int().min(1).max(20).optional().describe("返回条数，默认 6"),
    },
  },
  async ({ description, limit }) => {
    try {
      const data = await apiGet("/api/mcp/search", { q: description, limit: limit ?? 6 });
      if (!data.results?.length) {
        return text(`未匹配到相关历史坑，可放宽描述再试。数据源：${API_BASE}`);
      }
      const intro = [
        `针对「${description}」，从 BugHub 库召回 ${data.count} 条最相关的历史坑。`,
        "请在动手前对照每条的「测试要点」规避同类问题，并据此补充测试用例：",
        "",
      ].join("\n");
      return text(intro + data.results.map((b) => formatBug(b)).join("\n\n---\n\n"));
    } catch (error) {
      return fail(error);
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("bughub-mcp failed to start:", error);
  process.exit(1);
});
