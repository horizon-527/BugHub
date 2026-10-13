export default function SiteFooter() {
 return (
 <footer className="site-footer">
 <div className="site-footer-inner">
 <div>
 <strong>BugHub</strong>
 <span>持续收集、分类和整理常见 Bug。</span>
 </div>
 <div className="footer-links">
 <a href="/#catalog">Bug 分类</a>
 <span>© {new Date().getFullYear()}</span>
 </div>
 </div>
 </footer>
 );
}
