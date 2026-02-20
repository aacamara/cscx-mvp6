import React from 'react';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'search' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filters, values, onChange, onReset }) => {
  const hasActiveFilters = Object.values(values).some(v => v !== '');

  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {filters.map(f => (
        <div key={f.key}>
          {f.type === 'search' ? (
            <input
              type="text"
              placeholder={f.placeholder || `Search ${f.label.toLowerCase()}...`}
              value={values[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="input text-sm py-1.5 px-3 max-w-[200px]"
            />
          ) : (
            <select
              value={values[f.key] || ''}
              onChange={e => onChange(f.key, e.target.value)}
              className="input text-sm py-1.5 px-3 max-w-[180px] appearance-none"
            >
              <option value="">{f.label}</option>
              {f.options?.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
        </div>
      ))}
      {hasActiveFilters && onReset && (
        <button
          onClick={onReset}
          className="text-xs text-cscx-gray-400 hover:text-white transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};
