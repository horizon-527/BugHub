
"use client";

import Link from "next/link";
import type { CatalogL1 } from "@/lib/data";

type Props = { data: CatalogL1[]; currentId: string };

export default function DocTree({ data, currentId }: Props) {
  return (
    <nav className="doc-tree" aria-label="文档目录">
      <div className="doc-tree-title">Bug 目录</div>
      {data.map((cat) => {
        const inCat =
          cat.directBugs.some((b) => b.id === currentId) ||
          cat.children.some((s) => s.bugs.some((b) => b.id === currentId));
        return (
          <details key={cat.id} className="tree-cat" open={inCat}>
            <summary>
              <span className="tw-chevron" aria-hidden="true">›</span>
              <span className="tw-name">{cat.name}</span>
              <span className="tw-count">{cat.count}</span>
            </summary>
            <div className="tree-cat-body">
              {cat.directBugs.map((b) => (
                <Link
                  key={b.id}
                  href={`/bug/${b.id}`}
                  className={`tree-bug${b.id === currentId ? " current" : ""}`}
                >
                  {b.title}
                </Link>
              ))}
              {cat.children.map((sub) => {
                const inSub = sub.bugs.some((b) => b.id === currentId);
                return (
                  <details key={sub.id} className="tree-sub" open={inSub}>
                    <summary>
                      <span className="tw-chevron" aria-hidden="true">›</span>
                      <span className="tw-name">{sub.name}</span>
                      <span className="tw-count">{sub.bugs.length}</span>
                    </summary>
                    <div className="tree-sub-body">
                      {sub.bugs.map((b) => (
                        <Link
                          key={b.id}
                          href={`/bug/${b.id}`}
                          className={`tree-bug${b.id === currentId ? " current" : ""}`}
                        >
                          {b.title}
                        </Link>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </details>
        );
      })}
    </nav>
  );
}
