import AiConnect from "@/components/AiConnect";
import Catalog from "@/components/Catalog";
import { getCatalog } from "@/lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
 const catalog = await getCatalog();
 const total = catalog.reduce((sum, category) => sum + category.count, 0);
 return (
 <div className="page-shell home-page">
 <section className="home-intro" aria-labelledby="home-title">
 <h1 id="home-title">从大量 Bug 中，练出风险嗅觉。</h1>
 <div className="home-facts" aria-label="内容概览">
 <span><strong>{total}</strong> 个 Bug</span>
 <span><strong>{catalog.length}</strong> 类问题</span>
 <span>持续收录与整理</span>
 </div>
 </section>

 <Catalog data={catalog} />

 <AiConnect />
 </div>
 );
}
