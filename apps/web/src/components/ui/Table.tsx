import { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

interface TableProps {
  headers: string[];
  children?: React.ReactNode;
  className?: string;
  loading?: boolean;
  renderRow?: (item: any, index: number) => React.ReactNode;
  items?: any[];
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

export function Table({ headers, children, className, loading, renderRow, items }: TableProps) {
  const isMobile = useMediaQuery('(max-width: 639px)');

  // Cards view — cuando hay items+renderRow (mobile-first), o siempre si no hay children
  if (items && renderRow && (!children || isMobile)) {
    return (
      <div className="space-y-3" role="list" aria-label="Tabla de datos">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 animate-pulse space-y-2">
              {headers.slice(0, 3).map((_, h) => (
                <div key={h} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              ))}
            </div>
          ))
        ) : (
          items.map((item, index) => (
            <div key={item._id || index} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-2" role="listitem">
              {renderRow(item, index)}
            </div>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn('w-full text-sm', className)}>
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {loading ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-400">
                Cargando...
              </td>
            </tr>
          ) : items && renderRow ? (
            items.map((item, index) => (
              <tr key={item._id || index}>
                {renderRow(item, index)}
              </tr>
            ))
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols }: { rows?: number; cols: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}