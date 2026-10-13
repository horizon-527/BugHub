import Link from "next/link";
import type { CatalogBug, CatalogL1, CatalogL2 } from "@/lib/data";

export default function Catalog({ data }: { data: CatalogL1[] }) {
 if (!data.length) {
 return (
 <div className="empty-state">
 <strong>内容暂时不可用</strong>
 <span>本地数据库暂无可展示的 Bug，请先完成数据初始化。</span>
 </div>
 );
 }

 return (
 <section id="catalog" className="catalog-section" aria-label="Bug 分类目录">
 <div className="catalog-list">
 {data.map((category) => (
 <Category key={category.id} category={category} />
 ))}
 </div>
 </section>
 );
}

function Category({ category }: { category: CatalogL1 }) {
 return (
 <details className="catalog-category">
 <summary>
 <span className="summary-chevron" aria-hidden="true">›</span>
 <span className="category-line">
 <strong>{category.name}</strong>
 <span>{category.count}</span>
 </span>
 </summary>
 <div className="category-body">
 {category.directBugs.length ? <BugRows bugs={category.directBugs} /> : null}
 {category.children.map((subcategory) => (
 <Subcategory key={subcategory.id} subcategory={subcategory} />
 ))}
 </div>
 </details>
 );
}

function Subcategory({ subcategory }: { subcategory: CatalogL2 }) {
 return (
 <details className="catalog-subcategory">
 <summary>
 <span className="summary-chevron" aria-hidden="true">›</span>
 <strong>{subcategory.name}</strong>
 <span className="subcategory-count">{subcategory.bugs.length}</span>
 </summary>
 <BugRows bugs={subcategory.bugs} />
 </details>
 );
}

function BugRows({ bugs }: { bugs: CatalogBug[] }) {
 return (
 <ol className="bug-rows">
 {bugs.map((bug, index) => (
 <li key={bug.id}>
 <Link href={`/bug/${bug.id}`} target="_blank" rel="noreferrer">
 <span className="bug-number">{index + 1}.</span>
 <span className="bug-title">{bug.title}</span>
 <span className="bug-arrow" aria-hidden="true">→</span>
 </Link>
 </li>
 ))}
 </ol>
 );
}
