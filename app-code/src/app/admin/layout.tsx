import type { Metadata, Viewport } from "next";
import { unstable_noStore as noStore } from "next/cache";
import "./admin.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "内容管理",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  noStore();
  return <div className="admin-root">{children}</div>;
}
