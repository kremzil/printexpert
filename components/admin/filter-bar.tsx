"use client"

import { Search, Filter, X } from 'lucide-react';
import { AdminButton } from './admin-button';

interface FilterOption {
  id: string;
  label: string;
  value: string;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: {
    label: string;
    options: FilterOption[];
    value?: string;
    onChange?: (value: string) => void;
  }[];
  onClearFilters?: () => void;
  activeFiltersCount?: number;
}

export function FilterBar({
  searchPlaceholder = 'Hľadať...',
  searchValue = '',
  onSearchChange,
  filters = [],
  onClearFilters,
  activeFiltersCount = 0,
}: FilterBarProps) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full rounded-lg border border-border bg-white py-2 pl-10 pr-4 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          />
        </div>

        {/* Filters */}
        {filters.map((filter) => (
          <div key={filter.label} className="relative">
            <select
              value={filter.value || ''}
              onChange={(e) => filter.onChange?.(e.target.value)}
              className="appearance-none rounded-lg border border-border bg-white py-2 pl-10 pr-10 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.id} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        ))}

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <AdminButton variant="ghost" size="sm" icon={X} onClick={onClearFilters}>
            Vyčistiť filtre ({activeFiltersCount})
          </AdminButton>
        )}
      </div>
    </div>
  );
}
