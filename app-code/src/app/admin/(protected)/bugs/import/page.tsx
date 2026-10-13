import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import AdminCardImportForm from "@/components/admin/AdminCardImportForm";
import { adminHref } from "@/lib/admin-routing";
import { publicSiteOrigin } from "@/lib/public-site";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ImportAdminBugPage() {
  noStore();
  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <Link className="admin-back-link" href={adminHref("/")}>← 返回内容列表</Link>
        <h1>导入卡片</h1>
        <p>把 AI 按提示词输出的整张卡片粘贴进来，点“导入”即可入库，严重度、问题摘要、分类等信息一并保存。</p>
      </div>
      <AdminCardImportForm publicBaseUrl={publicSiteOrigin()} />
    </div>
  );
}
