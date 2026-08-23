import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Loader2 } from 'lucide-react';
import { Button } from './Button.js';
import { PaginationMeta } from '@schedulai/shared-types';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  meta?: PaginationMeta;
  isLoading?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onPageChange?: (page: number) => void;
  onSort?: (field: string) => void;
  actions?: React.ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends { _id?: string; id?: string }>({
  columns,
  data,
  meta,
  isLoading = false,
  searchPlaceholder = 'Search records...',
  onSearch,
  onPageChange,
  onSort,
  actions,
  emptyMessage = 'No records found.',
}: DataTableProps<T>) {
  const [searchVal, setSearchVal] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchVal(e.target.value);
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {onSearch && (
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchVal}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-10 pr-4 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition"
            />
          </div>
        )}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">{actions}</div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-xs uppercase tracking-wider">
                {columns.map((col) => (
                  <th key={col.key} className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && onSort && (
                        <button
                          onClick={() => onSort(col.key)}
                          className="text-slate-500 hover:text-slate-300 transition"
                        >
                          <ArrowUpDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-7 h-7 animate-spin text-teal-400" />
                      <span>Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-1">
                      <p className="text-slate-300 font-medium">{emptyMessage}</p>
                      <p className="text-xs text-slate-500">Try adjusting your filters or search terms.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, rowIdx) => (
                  <tr
                    key={item._id || item.id || rowIdx}
                    className="hover:bg-slate-800/40 transition duration-150 text-slate-200"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-5 py-3.5 whitespace-nowrap">
                        {col.render ? col.render(item) : (item as Record<string, unknown>)[col.key] !== undefined ? String((item as Record<string, unknown>)[col.key]) : '-'}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
            <div>
              Showing page <span className="font-semibold text-slate-200">{meta.page}</span> of{' '}
              <span className="font-semibold text-slate-200">{meta.totalPages}</span> ({meta.total} total items)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!meta.hasPrevPage}
                onClick={() => onPageChange && onPageChange(meta.page - 1)}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!meta.hasNextPage}
                onClick={() => onPageChange && onPageChange(meta.page + 1)}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
