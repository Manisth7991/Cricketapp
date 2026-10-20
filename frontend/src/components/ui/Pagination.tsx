import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@playlocal/shared';
import { Button } from './Button';

export function Pagination({
  meta,
  onPage,
}: {
  meta?: PaginationMeta;
  onPage: (page: number) => void;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total } = meta;
  return (
    <nav className="mt-8 flex items-center justify-between gap-4" aria-label="Pagination">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        leftIcon={<ChevronLeft className="size-4" />}
      >
        Previous
      </Button>
      <p className="text-sm text-ink-soft tabular">
        Page <span className="font-semibold text-ink">{page}</span> of {totalPages}
        <span className="hidden sm:inline"> · {total} results</span>
      </p>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPage(page + 1)}
        rightIcon={<ChevronRight className="size-4" />}
      >
        Next
      </Button>
    </nav>
  );
}
