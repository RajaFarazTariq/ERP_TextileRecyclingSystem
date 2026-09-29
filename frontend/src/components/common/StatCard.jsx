export default function StatCard({ title, value, subtitle, icon, color = 'blue' }) {
  const colors = {
    blue:   { bg: 'bg-blue-50   dark:bg-blue-900/20',   icon: 'bg-blue-600',   text: 'text-blue-600   dark:text-blue-400'   },
    green:  { bg: 'bg-green-50  dark:bg-green-900/20',  icon: 'bg-green-600',  text: 'text-green-600  dark:text-green-400'  },
    amber:  { bg: 'bg-amber-50  dark:bg-amber-900/20',  icon: 'bg-amber-600',  text: 'text-amber-600  dark:text-amber-400'  },
    red:    { bg: 'bg-red-50    dark:bg-red-900/20',    icon: 'bg-red-600',    text: 'text-red-600    dark:text-red-400'    },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'bg-purple-600', text: 'text-purple-600 dark:text-purple-400' },
  };
  const c = colors[color] || colors.blue;

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 p-5 flex items-center gap-4 transition-colors duration-200">
      <div className={`${c.icon} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
        <span className="text-white">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-slate-500 dark:text-slate-400 text-sm">{title}</p>
        <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
        {subtitle && (
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
