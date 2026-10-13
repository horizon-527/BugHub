import Link from "next/link";

export default function SiteHeader() {
 return (
 <header className="site-header">
 <div className="site-header-inner">
 <Link href="/" className="wordmark" aria-label="BugHub 首页">
 <span>Bug</span><strong>Hub</strong>
 </Link>
 </div>
 </header>
 );
}
