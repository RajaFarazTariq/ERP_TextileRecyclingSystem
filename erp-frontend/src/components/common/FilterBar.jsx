// src/components/common/FilterBar.jsx
/**
 * FilterBar — reusable single-row filter bar.
 * Matches the Warehouse filter UI exactly:
 *   STATUS: [All][...pills]  |  [Date ▼]  ←→  [🔍 Search]
 *
 * Props:
 *   statusLabel   string          Label before pills e.g. "STATUS:" or "PAYMENT:"
 *   statuses      string[]        Status pill values (empty string = "All")
 *   statusFilter  string          Current active status
 *   onStatusChange fn(string)
 *
 *   dateValue     { type: string }
 *   onDateChange  fn({ type })
 *   dateOptions   [{ value, label }]  optional override
 *
 *   searchValue   string
 *   onSearchChange fn(string)
 *   searchPlaceholder string
 *
 *   showSearch    bool  default true
 *   showDate      bool  default true
 */

export default function FilterBar({
  statusLabel      = 'STATUS:',
  statuses         = [],
  statusFilter     = '',
  onStatusChange,

  dateValue        = { type: 'all' },
  onDateChange,
  showDate         = true,

  searchValue      = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearch       = true,
}) {
  const dateOptions = [
    { value: 'all',   label: 'All Time'   },
    { value: 'today', label: 'Today'      },
    { value: 'week',  label: 'This Week'  },
    { value: 'month', label: 'This Month' },
    { value: 'year',  label: 'This Year'  },
  ];

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 px-4 py-3 flex flex-wrap items-center gap-3">

      {/* Status pills */}
      {statuses.length > 0 && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mr-1">
            {statusLabel}
          </span>
          {['', ...statuses].map(s => (
            <button
              key={s}
              onClick={() => onStatusChange?.(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      )}

      {/* Divider (only if both pills and date/search exist) */}
      {statuses.length > 0 && (showDate || showSearch) && (
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
      )}

      {/* Date dropdown */}
      {showDate && (
        <div className="flex-shrink-0">
          <select
            value={dateValue.type}
            onChange={e => onDateChange?.({ type: e.target.value })}
            className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            {dateOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Spacer */}
      {showSearch && <div className="flex-1" />}

      {/* Search input */}
      {showSearch && (
        <div className="relative flex-shrink-0">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={e => onSearchChange?.(e.target.value)}
            className="pl-8 pr-7 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-44"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
