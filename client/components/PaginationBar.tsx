import Link from "next/link";
import type { Pagination } from "@/lib/types";

interface Props {
  pagination: Pagination;
  hrefFor: (page: number) => string;
}

export default function PaginationBar({ pagination, hrefFor }: Props) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;

  // pehla, aakhri aur current ke aaspaas ke page; beech ke khali hisse "…"
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);

  const base = "rounded-lg border px-3 py-1.5 text-sm";
  const items: React.ReactNode[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) {
      items.push(
        <span key={`gap-${p}`} className="px-1 text-slate-400">
          …
        </span>
      );
    }
    items.push(
      <Link
        key={p}
        href={hrefFor(p)}
        aria-current={p === page ? "page" : undefined}
        className={`${base} ${
          p === page ? "border-indigo-600 bg-indigo-600 text-white" : "bg-white hover:bg-slate-50"
        }`}
      >
        {p}
      </Link>
    );
  });

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={`${base} bg-white hover:bg-slate-50`}>
          Previous
        </Link>
      )}
      {items}
      {pagination.hasNext && (
        <Link href={hrefFor(page + 1)} className={`${base} bg-white hover:bg-slate-50`}>
          Next
        </Link>
      )}
    </nav>
  );
}