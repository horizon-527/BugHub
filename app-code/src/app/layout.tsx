import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { Inter } from "next/font/google";

const description = "系统整理常见软件 Bug，提炼问题现象、失效本质和测试警惕点，方便检索与分类。";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
 metadataBase: new URL("https://bughub.vip"),
 title: {
 default: "BugHub",
 template: "%s | BugHub",
 },
 description,
 keywords: ["常见 Bug", "问题分类", "测试方法", "缺陷管理", "质量保障"],
 alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
 openGraph: {
 title: "BugHub — 常见 Bug 知识库",
 description,
 url: "https://bughub.vip",
 siteName: "BugHub",
 locale: "zh_CN",
 type: "website",
 },
 twitter: {
 card: "summary",
 title: "BugHub — 常见 Bug 知识库",
 description,
 },
};

export const viewport: Viewport = {
 width: "device-width",
 initialScale: 1,
 themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
 const isAdminRequest = headers().get("x-bughub-admin-request") === "1";
 return (
 <html lang="zh-CN" className={inter.variable}>
 <body>
 {isAdminRequest ? children : (
 <div className="site-frame">
 <SiteHeader />
 <main className="site-main">{children}</main>
 <SiteFooter />
 </div>
 )}
 </body>
 </html>
 );
}
