import Link from "next/link";

export default function NotFound() {
 return (
 <div className="page-shell not-found">
 <p className="not-found-code">404</p>
 <h1>这个 Bug 没有找到。</h1>
 <p>它可能被重命名、移动，或尚未公开发布。</p>
 <Link href="/#catalog">返回 Bug 库 →</Link>
 </div>
 );
}
