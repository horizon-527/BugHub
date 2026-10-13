import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import AdminStatusToggle from "@/components/admin/AdminStatusToggle";
import {
  getAdminBugList,
  parseStatusFilter,
  type AdminBugListItem,
  type AdminListFilters,
  type AdminStatusFilter,
} from "@/lib/admin-data";
import { formatAdminTime, STATUS_LABELS } from "@/lib/admin-format";
import { adminHref } from "@/lib/admin-routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminHomePageProps = {
  searchParams: { q?: string | string[]; page?: string | string[]; status?: string | string[]; success?: string | string[] };
};

function searchValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) || "";
}

function positivePage(value: string): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function listHref(q: string, status: AdminStatusFilter, page: number): string {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (status !== "all") query.set("status", status);
  if (page > 1) query.set("page", String(page));
  const serialized = query.toString();
  return adminHref(serialized ? `/?${serialized}` : "/");
}

const successMessages: Record<string, string> = { created: "内容已创建", updated: "内容已保存", deleted: "内容已删除" };

function StatusBadge({ status }: { status: AdminBugListItem["status"] }) {
  return <span className={`admin-status admin-status-${status}`}>{STATUS_LABELS[status]}</span>;
}

function categoryLabel(item: AdminBugListItem): string {
  return [item.categoryName, item.subcategoryName].filter(Boolean).join(" / ");
}

export default function AdminHomePage({ searchParams }: AdminHomePageProps) {
  noStore();
  const q = searchValue(searchParams.q).trim().slice(0, 200);
  const status = parseStatusFilter(searchValue(searchParams.status));
  const filters: AdminListFilters = { q, status, page: positivePage(searchValue(searchParams.page)) };
  const result = getAdminBugList(filters);
  const success = successMessages[searchValue(searchParams.success)];
  const newHref = adminHref("/bugs/new");
  const tabs: Array<{ key: AdminStatusFilter; label: string; count: number }> = [
    { key: "all", label: "全部", count: result.stats.total },
    { key: "published", label: "已发布", count: result.stats.published },
    { key: "draft", label: "草稿", count: result.stats.draft },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-heading admin-page-heading-with-actions">
        <div>
          <h1>内容管理</h1>
          <p>管理公开知识库的 Markdown 内容。只有“已发布”的内容会出现在公开站点。</p>
        </div>
        <div className="admin-heading-actions">
          <Link className="admin-button admin-button-secondary" href={newHref}>＋ 新建内容</Link>
          <Link className="admin-button admin-button-primary" href={adminHref("/bugs/import")}>导入卡片</Link>
        </div>
      </div>

      {success && <div className="admin-alert admin-alert-success" role="status">{success}</div>}

      <div className="admin-stats">
        <div className="admin-stat-card"><span>全部内容</span><strong>{result.stats.total}</strong></div>
        <div className="admin-stat-card"><span>已发布</span><strong>{result.stats.published}</strong></div>
        <div className="admin-stat-card"><span>草稿</span><strong>{result.stats.draft}</strong></div>
      </div>

      <section className="admin-content-panel">
        <nav className="admin-tabs" aria-label="按状态筛选">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={listHref(q, tab.key, 1)}
              className={tab.key === status ? "admin-tab admin-tab-active" : "admin-tab"}
              aria-current={tab.key === status ? "page" : undefined}
            >
              {tab.label}<span className="admin-tab-count">{tab.count}</span>
            </Link>
          ))}
        </nav>

        <form className="admin-filters admin-filters-simple" method="get" action={adminHref("/")}>
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <label className="admin-search-field">
            <span className="admin-visually-hidden">搜索内容</span>
            <input className="admin-input" type="search" name="q" defaultValue={q} maxLength={200} placeholder="搜索标题、ID 或正文" />
          </label>
          <button className="admin-button admin-button-secondary" type="submit">搜索</button>
          {q && <Link className="admin-clear-filter" href={listHref("", status, 1)}>清除</Link>}
        </form>

        <div className="admin-list-summary">
          <span>{q || status !== "all" ? `匹配 ${result.total} 条内容` : `共 ${result.total} 条内容`}</span>
          {result.total > 0 && <span>第 {result.page} / {result.totalPages} 页</span>}
        </div>

        {result.items.length === 0 ? (
          <div className="admin-empty-state">
            <strong>没有内容</strong>
            <p>{q || status !== "all" ? "换个关键词或状态试试。" : "点击“新建内容”开始。"}</p>
            {!q && status === "all" && <Link href={newHref}>新建内容</Link>}
          </div>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th><th>标题</th><th>状态</th><th>更新时间</th>
                    <th><span className="admin-visually-hidden">操作</span></th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((item) => (
                    <tr key={item.id}>
                      <td><span className="admin-id">{item.id}</span></td>
                      <td className="admin-col-title">
                        <strong className="admin-row-title" title={item.title}>{item.title}</strong>
                        <small>{categoryLabel(item)}</small>
                      </td>
                      <td><StatusBadge status={item.status} /></td>
                      <td className="admin-col-time"><time dateTime={item.updatedAt}>{formatAdminTime(item.updatedAt)}</time></td>
                      <td>
                        <div className="admin-row-actions">
                          <Link className="admin-edit-link" href={adminHref(`/bugs/${encodeURIComponent(item.id)}/edit`)}>编辑</Link>
                          <AdminStatusToggle id={item.id} status={item.status} expectedUpdatedAt={item.updatedAt} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-mobile-list">
              {result.items.map((item) => (
                <article className="admin-mobile-card" key={item.id}>
                  <div className="admin-mobile-card-top">
                    <span className="admin-id">{item.id}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <h2>{item.title}</h2>
                  <p>{categoryLabel(item)}</p>
                  <div className="admin-mobile-card-meta">
                    <time dateTime={item.updatedAt}>{formatAdminTime(item.updatedAt)}</time>
                    <div className="admin-row-actions">
                      <Link className="admin-edit-link" href={adminHref(`/bugs/${encodeURIComponent(item.id)}/edit`)}>编辑</Link>
                      <AdminStatusToggle id={item.id} status={item.status} expectedUpdatedAt={item.updatedAt} />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {result.totalPages > 1 && (
          <nav className="admin-pagination" aria-label="内容分页">
            {result.page > 1 ? <Link href={listHref(q, status, result.page - 1)}>← 上一页</Link> : <span className="admin-pagination-disabled">← 上一页</span>}
            <span>{result.page} / {result.totalPages}</span>
            {result.page < result.totalPages ? <Link href={listHref(q, status, result.page + 1)}>下一页 →</Link> : <span className="admin-pagination-disabled">下一页 →</span>}
          </nav>
        )}
      </section>
    </div>
  );
}
