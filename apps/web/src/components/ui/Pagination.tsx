import { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const isMobile = useMediaQuery('(max-width: 479px)');

  return (
    <div className="flex items-center justify-between mt-4 flex-wrap gap-2">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Página {page} de {totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isMobile ? '←' : 'Anterior'}
        </button>
        {!isMobile && (
          Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  'px-3 py-1 text-sm rounded-md border',
                  p === page
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {p}
              </button>
            );
          })
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isMobile ? '→' : 'Siguiente'}
        </button>
      </div>
    </div>
  );
}