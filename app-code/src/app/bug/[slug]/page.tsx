import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { renderMarkdownWithOutline } from "@/lib/markdown";
import "github-markdown-css/github-markdown-light.css";
import "highlight.js/styles/github.css";
import { getBugByRoute, getCatalog } from "@/lib/data";
import DocTree from "@/components/DocTree";
import Outline from "@/components/Outline";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const dynamicParams = true;

type PageProps = { params: { slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const bug = await getBugByRoute(params.slug);
  if (!bug) return { title: "Bug 不存在" };
  const canonical = `/bug/${encodeURIComponent(bug.id)}`;
  return {
    title: { absolute: "BugHub" },
    description: bug.takeaway || bug.title,
    alternates: { canonical },
    keywords: Array.from(new Set([...bug.domains, ...bug.patterns, "Bug 收集", "问题分类"])),
    openGraph: {
      title: bug.title,
      description: bug.takeaway,
      type: "article",
      url: canonical,
      publishedTime: bug.date || undefined,
      tags: [...bug.domains, ...bug.patterns],
    },
    twitter: {
      card: "summary",
      title: bug.title,
      description: bug.takeaway,
    },
  };
}

export default async function BugDetailPage({ params }: PageProps) {
  const bug = await getBugByRoute(params.slug);
  if (!bug) notFound();
  if (params.slug.toLowerCase() !== bug.id.toLowerCase()) {
    permanentRedirect(`/bug/${encodeURIComponent(bug.id)}`);
  }
  const [{ html: bodyHtml, headings }, catalog] = await Promise.all([
    renderMarkdownWithOutline(bug.body),
    getCatalog(),
  ]);
  const schema = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: bug.title,
    description: bug.takeaway || bug.title,
    datePublished: bug.date || undefined,
    dateModified: bug.date || undefined,
    mainEntityOfPage: `https://bughub.vip/bug/${encodeURIComponent(bug.id)}`,
    author: { "@type": "Organization", name: "BugHub", url: "https://bughub.vip" },
    publisher: { "@type": "Organization", name: "BugHub", url: "https://bughub.vip" },
    keywords: [...bug.domains, ...bug.patterns].join(","),
    articleSection: bug.categoryPath.join(" / "),
  };

  return (
    <div className="doc-layout">
      <aside className="doc-col doc-col-left">
        <Link href="/#catalog" className="back-link">← 返回 Bug 库</Link>
        <DocTree data={catalog} currentId={bug.id} />
      </aside>

      <div className="doc-col doc-col-main">
        <article>
          <header className="article-header">
            <h1>{bug.title}</h1>
            {bug.takeaway ? (
              <div className="takeaway-box">
                <strong>问题摘要</strong>
                <p>{bug.takeaway}</p>
              </div>
            ) : null}
          </header>

          <div className="markdown-body article-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        </article>
      </div>

      <aside className="doc-col doc-col-right">
        <Outline headings={headings} />
      </aside>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
