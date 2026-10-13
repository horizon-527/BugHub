import Link from "next/link";
import { adminHref } from "@/lib/admin-routing";

export default function AdminNotFound() {
  return (
    <div className="admin-page">
      <div className="admin-empty-state">
        <strong>页面不存在</strong>
        <p>这个后台页面不存在，或者对应的内容已被删除。</p>
        <Link href={adminHref("/")}>返回内容管理</Link>
      </div>
    </div>
  );
}
