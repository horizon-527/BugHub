import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import AdminBugForm from "@/components/admin/AdminBugForm";
import AdminDeleteButton from "@/components/admin/AdminDeleteButton";
import { getAdminBugById, getAdminCategories } from "@/lib/admin-data";
import { formatAdminTime, STATUS_LABELS } from "@/lib/admin-format";
import { adminHref } from "@/lib/admin-routing";
import { publicSiteOrigin } from "@/lib/public-site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type EditAdminBugPageProps = { params: { id: string } };

function publicBugUrl(id: string): string {
  return `${publicSiteOrigin()}/bug/${encodeURIComponent(id)}`;
}

export default function EditAdminBugPage({ params }: EditAdminBugPageProps) {
  noStore();
  const id = params.id.toUpperCase();
  const bug = getAdminBugById(id);
  if (!bug) notFound();
  const categories = getAdminCategories();

  return (
    <div className="admin-page">
      <div className="admin-page-heading admin-page-heading-with-actions">
        <div>
          <Link className="admin-back-link" href={adminHref("/")}>← 返回内容列表</Link>
          <h1>
            编辑 {bug.id}{" "}
            <span className={`admin-status admin-status-${bug.status}`}>{STATUS_LABELS[bug.status]}</span>
          </h1>
          <p>最后更新：{formatAdminTime(bug.updatedAt)}</p>
        </div>
        {bug.status === "published" ? (
          <a className="admin-button admin-button-secondary" href={publicBugUrl(bug.id)} target="_blank" rel="noopener noreferrer">预览公开页面 ↗</a>
        ) : (
          <span className="admin-form-hint">草稿未公开，没有公开页面可预览</span>
        )}
      </div>
      <AdminBugForm
        mode="edit"
        id={bug.id}
        initialTitle={bug.title}
        initialMarkdown={bug.bodyMarkdown}
        initialStatus={bug.status}
        initialCategoryId={bug.categoryId}
        initialSubcategoryId={bug.subcategoryId}
        categories={categories}
        expectedUpdatedAt={bug.updatedAt}
      />
      <section className="admin-danger-zone">
        <div>
          <h2>删除内容</h2>
          <p>删除后无法恢复，公开页面也会立即失效。只是想暂时隐藏的话，请把状态改为“草稿”。</p>
        </div>
        <AdminDeleteButton id={bug.id} expectedUpdatedAt={bug.updatedAt} />
      </section>
    </div>
  );
}
