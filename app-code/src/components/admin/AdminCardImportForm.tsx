"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { importCardAction, type ImportFormState } from "@/app/admin/actions";
import { useActionRedirect } from "@/components/admin/useActionRedirect";

const initialState: ImportFormState = {};

const CARD_SAMPLE = `---
id: "BH-XXXX"
title: "触发条件，导致错误结果"
severity: "P2"
stage: "线上"
date: "YYYY-MM-DD"
status: "published"
domains: ["功能逻辑缺陷", "流程与状态错误"]
patterns: ["模式标签1", "模式标签2"]
impact: "一句话说清具体后果"
source: "real-anonymized"
takeaway: "一句话可执行的核心教训"
category: "cat01"
subcategory: "cat01-2"
sortOrder: 1
---

## 问题现象
## 背景
## 根本原因
## 解决方案
## 测试建议
## 经验总结`;

function ImportSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button admin-button-primary" type="submit" disabled={disabled || pending}>
      {pending ? "正在导入…" : "导入"}
    </button>
  );
}

export default function AdminCardImportForm({ publicBaseUrl }: { publicBaseUrl: string }) {
  const [state, formAction] = useFormState(importCardAction, initialState);
  useActionRedirect(state.redirectTo);
  const [text, setText] = useState("");
  const [asDraft, setAsDraft] = useState(false);

  // 导入成功后清空输入框，方便直接贴下一张；失败时保留，方便按提示修改后重试。
  useEffect(() => {
    if (state.created) setText("");
  }, [state]);

  const created = state.created;

  return (
    <form className="admin-editor-form" action={formAction}>
      {state.globalError && <div className="admin-alert admin-alert-error" role="alert">{state.globalError}</div>}

      {state.errors && state.errors.length > 0 && (
        <div className="admin-alert admin-alert-error" role="alert">
          <strong>导入失败，请修正后重试（共 {state.errors.length} 个问题）</strong>
          <ul className="admin-error-list">
            {state.errors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}

      {created && (
        <div className="admin-alert admin-alert-success" role="status">
          <strong>
            已导入 {created.id}（{created.status === "published" ? "已发布" : "草稿"}）：{created.title}
          </strong>
          <span className="admin-import-links">
            <a href={created.editHref}>去编辑</a>
            {created.status === "published" && (
              <a href={`${publicBaseUrl}/bug/${encodeURIComponent(created.id)}`} target="_blank" rel="noopener noreferrer">查看公开页面 ↗</a>
            )}
            <span>输入框已清空，可以继续粘贴下一张。</span>
          </span>
        </div>
      )}

      <label className="admin-field">
        <span className="admin-label">卡片内容</span>
        <textarea
          className="admin-textarea admin-card-textarea"
          name="card"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={"把 AI 按提示词输出的整张卡片粘贴到这里（包含 --- 包裹的头信息和六段正文）"}
          spellCheck={false}
          required
        />
        <span className="admin-character-count">{text.length.toLocaleString("zh-CN")} 字</span>
      </label>

      <div className="admin-form-actions">
        <ImportSubmit disabled={!text.trim()} />
        <label className="admin-checkbox">
          <input type="checkbox" name="asDraft" checked={asDraft} onChange={(event) => setAsDraft(event.target.checked)} />
          先导入为草稿（不公开，检查脱敏后再发布）
        </label>
      </div>

      <details className="admin-details">
        <summary>查看卡片格式</summary>
        <p>
          必填：title、severity、stage、impact、takeaway、category、subcategory，以及六段正文。
          id 留空或写 BH-XXXX 会自动分配编号；title 不超过 30 字；category 与 subcategory 使用提示词里的 catXX 编号。
          只新增，不会覆盖已有内容。
        </p>
        <pre className="admin-code-sample">{CARD_SAMPLE}</pre>
      </details>
    </form>
  );
}
