"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PaginationBar({ page, pageCount }: { page: number; pageCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function goTo(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (pageCount <= 1) return null;

  return (
    <div className="flex items-center justify-end gap-2 py-2">
      <span className="text-xs text-on-surface-variant">
        Página {page} de {pageCount}
      </span>
      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => goTo(page - 1)}>
        <ChevronLeft className="size-4" />
      </Button>
      <Button variant="outline" size="icon" disabled={page >= pageCount} onClick={() => goTo(page + 1)}>
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
