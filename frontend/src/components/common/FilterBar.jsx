// src/components/common/FilterBar.jsx
/**
 * FilterBar — single-row filter bar matching ERP system theme.
 * Works correctly in BOTH light and dark mode.
 *
 * The date filter uses the full DateFilter component internally,
 * so Custom Range / By Month / By Year all show their secondary inputs.
 *
 * Layout: [🔍 Search — left/wide]  |  [Type ▼]  [Status ▼]  [Date ▼ (+extras)]  [↺]
 *
 * Props:
 *   statusLabel       string      Placeholder for status dropdown
 *   statuses          string[]    Status option values
 *   statusFilter      string      Currently selected status
 *   onStatusChange    fn(string)
 *
 *   typeLabel         string      Placeholder for optional second dropdown
 *   types             string[]    Type option values
 *   typeFilter        string
 *   onTypeChange      fn(string)
 *
 *   dateValue         { type, year, month, start, end }
 *   onDateChange      fn(filter)
 *   showDate          bool  default true
 *
 *   searchValue       string
 *   onSearchChange    fn(string)
 *   searchPlaceholder string
 *   showSearch        bool  default true
 *
 *   onRefresh         fn()  shows refresh icon when provided
 */

const selectCls =
  'border border-slate-300 dark:border-slate-600 ' +
  'bg-white dark:bg-slate-700 ' +
  'text-slate-700 dark:text-slate-200 ' +
  'rounded-lg px-3 py-2 text-sm h-9 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'transition-colors cursor-pointer flex-shrink-0';

const inputCls =
  'border border-slate-300 dark:border-slate-600 ' +
  'bg-white dark:bg-slate-700 ' +
  'text-slate-700 dark:text-slate-200 ' +
  'rounded-lg px-3 py-2 text-sm h-9 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'transition-colors';

const DATE_OPTIONS = [
  { value: 'all',        label: 'All Time'    },
  { value: 'today',      label: 'Today'       },
  { value: 'this_week',  label: 'This Week'   },
  { value: 'this_month', label: 'This Month'  },
  { value: 'this_year',  label: 'This Year'   },
  { value: 'year',       label: 'By Year'     },
  { value: 'month',      label: 'By Month'    },
  { value: 'custom',     label: 'Custom Range'},
];

// ── Inline date extras — appear to the right of the date dropdown ─────────────
function DateExtras({ value, onChange }) {
  const set = patch => onChange({ ...value, ...patch });
  const currentYear  = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  if (value.type === 'year') {
    return (
      <select
        value={value.year || currentYear}
        onChange={e => set({ year: e.target.value })}
        className={selectCls}
      >
        {Array.from({ length: 6 }, (_, i) => currentYear - i).map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    );
  }

  if (value.type === 'month') {
    return (
      <input
        type="month"
        value={value.month || currentMonth}
        onChange={e => set({ month: e.target.value })}
        className={inputCls}
      />
    );
  }

  if (value.type === 'custom') {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          type="date"
          value={value.start || ''}
          onChange={e => set({ start: e.target.value })}
          className={inputCls}
        />
        <span className="text-slate-400 dark:text-slate-500 text-xs">to</span>
        <input
          type="date"
          value={value.end || ''}
          onChange={e => set({ end: e.target.value })}
          className={inputCls}
        />
      </div>
    );
  }

  return null;
}

export default function FilterBar({
  statusLabel       = 'All status',
  statuses          = [],
  statusFilter      = '',
  onStatusChange,

  typeLabel         = 'All types',
  types             = [],
  typeFilter        = '',
  onTypeChange,

  dateValue         = { type: 'all' },
  onDateChange,
  showDate          = true,

  searchValue       = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  showSearch        = true,

  onRefresh,
}) {
  const hasRightControls = types.length > 0 || statuses.length > 0 || showDate || onRefresh;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 px-4 py-2.5 flex flex-wrap items-center gap-2 transition-colors duration-200">

      {/* ── Search input ── */}
      {showSearch && (
        <div className="relative flex-1 min-w-[160px]">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"
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
            className="w-full pl-9 pr-7 py-2 bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none"
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange?.('') }
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* ── Divider ── */}
      {showSearch && hasRightControls && (
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
      )}

      {/* ── Type dropdown ── */}
      {types.length > 0 && (
        <select value={typeFilter} onChange={e => onTypeChange?.(e.target.value)} className={selectCls}>
          <option value="">{typeLabel}</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}

      {/* ── Status dropdown ── */}
      {statuses.length > 0 && (
        <select value={statusFilter} onChange={e => onStatusChange?.(e.target.value)} className={selectCls}>
          <option value="">{statusLabel}</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      )}

      {/* ── Date dropdown + secondary inputs ── */}
      {showDate && (
        <>
          <select
            value={dateValue?.type || 'all'}
            onChange={e => onDateChange?.({ ...dateValue, type: e.target.value })}
            className={selectCls}
          >
            {DATE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Secondary inputs appear inline when needed */}
          <DateExtras value={dateValue || { type: 'all' }} onChange={onDateChange} />

          {/* Clear badge — only when a filter is active */}
          {dateValue?.type && dateValue.type !== 'all' && (
            <button
              onClick={() => onDateChange?.({ type: 'all' })}
              className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 px-2 py-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors flex-shrink-0"
              title="Clear date filter"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
        </>
      )}

      {/* ── Refresh button ── */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          title="Refresh"
          className="flex-shrink-0 p-2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
}
