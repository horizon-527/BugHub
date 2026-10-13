"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createBugAction, updateBugAction } from "@/app/admin/actions";
import { useActionRedirect } from "@/components/admin/useActionRedirect";
import type { AdminBugFormState, AdminCategoryOption } from "@/lib/admin-data";

const MarkdownEditor = dynamic(() => import("@/components/admin/MarkdownEditor"), {
  ssr: false,
  loading: () => <div className="admin-editor-loading">编辑器加载中…</div>,
});

const MARKDOWN_TEMPLATE = `## 现象

（描述问题的具体表现）

## 原因

（分析根本原因）

## 解决方案

（如何修复或规避）

## 测试要点

- （需要重点验证的点）
`;

type AdminBugFormProps = {
  mode: "create" | "edit";
  id?: string;
  initialTitle: string;
  initialMarkdown: string;
  initialStatus: "published" | "draft";
  initialCategoryId: string;
  initialSubcategoryId: string;
  categories: AdminCategoryOption[];
  expectedUpdatedAt?: string;
};

function SaveButton({ mode, redirecting }: { mode: "create" | "edit"; redirecting: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="admin-button admin-button-primary" type="submit" disabled={pending || redirecting}>
      {pending ? "正在保存…" : redirecting ? "已保存，正在跳转…" : mode === "create" ? "创建" : "保存修改"}
    </button>
  );
}

export default function AdminBugForm({
  mode,
  id,
  initialTitle,
  initialMarkdown,
  initialStatus,
  initialCategoryId,
  initialSubcategoryId,
  categories,
  expectedUpdatedAt,
}: AdminBugFormProps) {
  const action = mode === "create" ? createBugAction : updateBugAction;
  const initialState: AdminBugFormState = {};
  const [state, formAction] = useFormState(action, initialState);
  const redirecting = useActionRedirect(state.redirectTo);
  const errors = state.fieldErrors || {};

  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialMarkdown);
  const [status, setStatus] = useState<"published" | "draft">(initialStatus);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId);

  const subcategories = categories.find((category) => category.id === categoryId)?.subcategories ?? [];

  function changeCategory(nextId: string) {
    setCategoryId(nextId);
    // 换一级分类后，子分类必须跟着换，否则会提交一个不属于它的组合。
    setSubcategoryId(categories.find((category) => category.id === nextId)?.subcategories[0]?.id ?? "");
  }

  function insertTemplate() {
    if (body.trim() && !window.confirm("正文已有内容，确定用模板覆盖吗？")) return;
    setBody(MARKDOWN_TEMPLATE);
  }

  return (
    <form className="admin-editor-form" action={formAction} noValidate>
      {mode === "edit" && (
        <>
          <input type="hidden" name="originalId" value={id || ""} />
          <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt || ""} />
        </>
      )}
      <input type="hidden" name="bodyMarkdown" value={body} />
      {state.globalError && <div className="admin-alert admin-alert-error" role="alert">{state.globalError}</div>}

      <section className="admin-form-section">
        <div className="admin-form-grid">
          <label className="admin-field admin-field-wide">
            <span className="admin-label">标题</span>
            <input
              className="admin-input"
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              placeholder="给这条内容起个标题"
              aria-invalid={Boolean(errors.title)}
              required
              autoFocus
            />
            {errors.title && <span className="admin-field-error">{errors.title}</span>}
          </label>

          <label className="admin-field">
            <span className="admin-label">状态</span>
            <select
              className="admin-select"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "published" | "draft")}
              aria-invalid={Boolean(errors.status)}
            >
              <option value="published">已发布（公开可见）</option>
              <option value="draft">草稿（不公开）</option>
            </select>
            {errors.status && <span className="admin-field-error">{errors.status}</span>}
          </label>

          <div className="admin-field">
            <span className="admin-label">分类</span>
            <div className="admin-select-pair">
              <select
                className="admin-select"
                name="categoryId"
                aria-label="一级分类"
                value={categoryId}
                onChange={(event) => changeCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <select
                className="admin-select"
                name="subcategoryId"
                aria-label="二级分类"
                value={subcategoryId}
                onChange={(event) => setSubcategoryId(event.target.value)}
                aria-invalid={Boolean(errors.subcategoryId)}
              >
                {subcategories.map((subcategory) => (
                  <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                ))}
              </select>
            </div>
            {errors.subcategoryId && <span className="admin-field-error">{errors.subcategoryId}</span>}
          </div>
        </div>
      </section>

      <section className="admin-markdown-section">
        <div className="admin-section-heading">
          <div>
            <h2>Markdown 正文</h2>
            <p>支持 GFM，工具栏可插入标题、代码、表格等；原始 HTML 会被安全过滤。</p>
          </div>
          <div className="admin-editor-tools">
            <span className="admin-character-count">{body.length.toLocaleString("zh-CN")} 字</span>
            <button type="button" className="admin-button admin-button-secondary" onClick={insertTemplate}>插入模板</button>
          </div>
        </div>
        {errors.bodyMarkdown && <span className="admin-field-error">{errors.bodyMarkdown}</span>}
        <div className="admin-bytemd">
          <MarkdownEditor
            value={body}
            onChange={setBody}
            placeholder="在此输入 Markdown，或点击右上角“插入模板”"
          />
        </div>
      </section>

      <div className="admin-form-actions">
        <SaveButton mode={mode} redirecting={redirecting} />
        <span className="admin-form-hint">
          {status === "published" ? "保存后立即在公开站点可见" : "草稿不会出现在公开站点"}
        </span>
      </div>
    </form>
  );
}
