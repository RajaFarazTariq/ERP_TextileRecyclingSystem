/**
 * DateFilter.jsx — Clean dropdown date filter.
 * Works in BOTH light and dark mode using ERP system theme.
 *
 * Props:
 *   value      { type, year, month, start, end }
 *   onChange   called with new filter object
 *   className  optional extra wrapper classes
 *   compact    if true, hides the "Period:" label
 */

// Matches existing ERP select/input style
const selectCls =
  'border border-slate-300 dark:border-slate-600 ' +
  'bg-white dark:bg-slate-700 ' +
  'text-slate-700 dark:text-slate-200 ' +
  'rounded-lg px-3 py-2 text-sm h-9 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'transition-colors cursor-pointer';

const inputCls =
  'border border-slate-300 dark:border-slate-600 ' +
  'bg-white dark:bg-slate-700 ' +
  'text-slate-700 dark:text-slate-200 ' +
  'rounded-lg px-3 py-2 text-sm h-9 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 ' +
  'transition-colors';

const OPTIONS = [
  { value: 'all',        label: 'All Time'    },
  { value: 'today',      label: 'Today'       },
  { value: 'this_week',  label: 'This Week'   },
  { value: 'this_month', label: 'This Month'  },
  { value: 'this_year',  label: 'This Year'   },
  { value: 'year',       label: 'By Year'     },
  { value: 'month',      label: 'By Month'    },
  { value: 'custom',     label: 'Custom Range'},
];

export default function DateFilter({
  value = { type: 'all' },
  onChange,
  className = '',
  compact = false,
}) {
  const set = (patch) => onChange({ ...value, ...patch });

  const currentYear  = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>

      {/* Period label — hidden when compact */}
      {!compact && (
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
          Period:
        </span>
      )}

      {/* Main period dropdown */}
      <select
        value={value.type}
        onChange={e => set({ type: e.target.value })}
        className={selectCls}
        style={{ minWidth: '130px' }}
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Year picker — only when type === 'year' */}
      {value.type === 'year' && (
        <select
          value={value.year || currentYear}
          onChange={e => set({ year: e.target.value })}
          className={selectCls}
        >
          {Array.from({ length: 6 }, (_, i) => currentYear - i).map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      )}

      {/* Month picker — only when type === 'month' */}
      {value.type === 'month' && (
        <input
          type="month"
          value={value.month || currentMonth}
          onChange={e => set({ month: e.target.value })}
          className={inputCls}
        />
      )}

      {/* Custom date range — only when type === 'custom' */}
      {value.type === 'custom' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={value.start || ''}
            onChange={e => set({ start: e.target.value })}
            className={inputCls}
          />
          <span className="text-slate-400 dark:text-slate-500 text-xs font-medium">to</span>
          <input
            type="date"
            value={value.end || ''}
            onChange={e => set({ end: e.target.value })}
            className={inputCls}
          />
        </div>
      )}

      {/* Active filter clear badge */}
      {value.type !== 'all' && (
        <button
          onClick={() => onChange({ type: 'all' })}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 px-2 py-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          title="Clear date filter"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}

/**
 * Build query params string from a filter object.
 *
 * Usage:
 *   import DateFilter, { buildDateParams } from '../../components/common/DateFilter';
 *   const params = buildDateParams(dateFilter);
 *   api.get(`warehouse/stock/${params}`)
 */
export function buildDateParams(filter) {
  if (!filter || filter.type === 'all') return '';
  const p = new URLSearchParams();

  if (['today', 'this_week', 'this_month', 'this_year'].includes(filter.type)) {
    p.set('date_filter', filter.type);
  } else if (filter.type === 'year' && filter.year) {
    p.set('year', filter.year);
  } else if (filter.type === 'month' && filter.month) {
    p.set('month', filter.month);
  } else if (filter.type === 'custom') {
    if (filter.start) p.set('start', filter.start);
    if (filter.end)   p.set('end',   filter.end);
  }

  const str = p.toString();
  return str ? `?${str}` : '';
}
