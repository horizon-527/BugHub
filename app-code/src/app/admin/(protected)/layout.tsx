import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { adminHref } from "@/lib/admin-routing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  noStore();
  const session = await requireAdmin();
  const homeHref = adminHref("/");
  const newHref = adminHref("/bugs/new");
  const importHref = adminHref("/bugs/import");

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link className="admin-brand" href={homeHref}>
            <span className="admin-brand-mark">BH</span>
            <span className="admin-brand-copy"><strong>BugHub</strong><small>内容管理</small></span>
          </Link>
          <nav className="admin-nav" aria-label="后台导航">
            <Link href={homeHref}>内容管理</Link>
            <Link href={importHref}>导入卡片</Link>
            <Link href={newHref}>新建内容</Link>
          </nav>
          <div className="admin-account">
            <span className="admin-account-name">{session.username}</span>
            <form method="post" action={adminHref("/logout")}>
              <button className="admin-logout" type="submit">退出</button>
            </form>
          </div>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
