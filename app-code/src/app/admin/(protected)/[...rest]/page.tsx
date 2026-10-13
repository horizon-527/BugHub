import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

// 兜底：后台域名下任何未知路径都落到这里，由同级的 not-found.tsx 渲染后台风格的 404，
// 而不是跳到公开站那个“这个 Bug 没有找到”的页面。
export default function AdminCatchAllPage() {
  notFound();
}
