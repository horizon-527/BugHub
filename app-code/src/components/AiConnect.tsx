"use client";

import { useState } from "react";

const API_BASE = "https://bughub.vip";

const MCP_CONFIG = `{
  "mcpServers": {
    "bughub": {
      "command": "node",
      "args": ["/绝对路径/bughub-mcp/server.mjs"],
      "env": { "BUGHUB_API_BASE": "${API_BASE}" }
    }
  }
}`;

const PROMPT = `你可以使用 BugHub 常见 Bug 库（通过 bughub MCP）来提升代码与测试质量。

请在以下时机主动调用：
- 动手写某个功能前：用 review_context 传入这个功能的描述，召回相关的历史坑，对照规避；
- 写测试用例时：用 search_bugs 按功能 / 领域检索，把每条的「测试要点」补进用例；
- 需要某条详情时：用 get_bug 传入编号（如 BH-1017）。

要求：编码和设计前先自查相关失效模式；产出代码或用例后，逐条核对是否已覆盖召回 Bug 的「测试要点」，并在说明里标注参考了哪些 BH 编号。`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  return (
    <button type="button" className="ai-copy" onClick={copy} aria-label={`复制${label}`}>
      {copied ? "已复制" : "复制"}
    </button>
  );
}

export default function AiConnect() {
  return (
    <section id="ai" className="ai-connect" aria-labelledby="ai-title">
      <div className="ai-head">
        <h2 id="ai-title">接入 AI · 让它写代码前先查这个库</h2>
        <p>
          通过 MCP 把这套常见 Bug 库接到你的 AI 编码助手。写代码前自查失效模式，写测试用例时对照「测试要点」，
          从源头规避同类问题。
        </p>
      </div>

      <div className="ai-cards">
        <div className="ai-card">
          <div className="ai-card-top">
            <span className="ai-card-label">① MCP 配置</span>
            <CopyButton text={MCP_CONFIG} label="配置" />
          </div>
          <p className="ai-card-note">
            加入 AI 客户端的 mcp.json，把路径改成 bughub-mcp 的实际位置。
          </p>
          <pre>
            <code>{MCP_CONFIG}</code>
          </pre>
        </div>

        <div className="ai-card">
          <div className="ai-card-top">
            <span className="ai-card-label">② 提示词</span>
            <CopyButton text={PROMPT} label="提示词" />
          </div>
          <p className="ai-card-note">复制给 AI，它就会在写代码 / 测试时主动检索并对照这个库。</p>
          <pre>
            <code>{PROMPT}</code>
          </pre>
        </div>
      </div>

      <p className="ai-foot">
        也可直接调用只读接口：
        <code>{`${API_BASE}/api/mcp/search?q=关键词`}</code>
        、<code>{`${API_BASE}/api/mcp/taxonomy`}</code>
      </p>
    </section>
  );
}
