import React, { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  searchable?: boolean;
  searchKeys?: string[];
  pageSize?: number;
  rowKey?: (item: T) => string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  onRowClick,
  emptyMessage = 'No data found',
  searchable = false,
  searchKeys = [],
  pageSize = 20,
  rowKey,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let items = Array.isArray(data) ? [...data] : [];
    if (search && searchKeys.length > 0) {
      const q = search.toLowerCase();
      items = items.filter(item =>
        searchKeys.some(k => String(item[k] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      items.sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortAsc ? cmp : -cmp;
      });
    }
    return items;
  }, [data, search, searchKeys, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-cscx-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {searchable && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="input max-w-xs text-sm py-2"
          />
        </div>
      )}

      <div className="table-container">
        <table className="w-full text-sm">
          <thead className="table-header">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`table-cell text-left font-medium ${col.sortable ? 'cursor-pointer select-none hover:text-white' : ''} ${col.className || ''}`}
                >
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cscx-gray-800/50">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-cell text-center text-cscx-gray-400 py-8">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((item, i) => (
                <tr
                  key={rowKey ? rowKey(item) : i}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`table-row ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  {columns.map(col => (
                    <td key={col.key} className={`table-cell ${col.className || ''}`}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-cscx-gray-400">
          <span>{filtered.length} items</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded hover:bg-cscx-gray-800 disabled:opacity-30"
            >
              Prev
            </button>
            <span>{page + 1} / {totalPages}</span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded hover:bg-cscx-gray-800 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
