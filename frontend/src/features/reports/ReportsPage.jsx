import { useEffect, useState } from 'react';
import MainLayout from '../components/layout/MainLayout';
import PageHeader from '../components/common/PageHeader';
import api from '../api/axios';

// ── Helpers ──────────────────────────────────────────────────────────────────
const int = v => Math.round(Number(v) || 0);
const fmt = v => int(v).toLocaleString();
const fmtRs = v => `Rs. ${fmt(v)}`;
const today = () => new Date().toISOString().split('T')[0];
const monthAgo = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split('T')[0];
};
const thisYear  = new Date().getFullYear();
const thisMonth = new Date().getMonth() + 1;

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent = 'text-slate-800 dark:text-slate-100', sub }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Download button ───────────────────────────────────────────────────────────
function DownloadBtn({ onClick, loading, label }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z" />
        </svg>
      )}
      {label || 'Export Excel'}
    </button>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-slate-800 dark:text-slate-100 font-bold text-base">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ── Mini progress bar ─────────────────────────────────────────────────────────
function PctBar({ label, value, total, color = 'bg-blue-500' }) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-slate-500 dark:text-slate-400 tabular-nums">{fmt(value)}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const inputCls = 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Reports() {
  const [activeTab, setActiveTab] = useState('daily');

  // ── Daily Production state ──────────────────────────────────────────────────
  const [dailyDate, setDailyDate]       = useState(today());
  const [dailyData, setDailyData]       = useState(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyExporting, setDailyExporting] = useState(false);

  // ── Monthly Sales state ─────────────────────────────────────────────────────
  const [monthYear, setMonthYear]       = useState(thisYear);
  const [monthMonth, setMonthMonth]     = useState(thisMonth);
  const [monthData, setMonthData]       = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);
  const [monthExporting, setMonthExporting] = useState(false);

  // ── Waste Analysis state ────────────────────────────────────────────────────
  const [wasteStart, setWasteStart]   = useState(monthAgo());
  const [wasteEnd,   setWasteEnd]     = useState(today());
  const [wasteData,  setWasteData]    = useState(null);
  const [wasteLoading, setWasteLoading] = useState(false);
  const [wasteExporting, setWasteExporting] = useState(false);

  // ── Audit Log state ─────────────────────────────────────────────────────────
  const [auditSummary, setAuditSummary]   = useState(null);
  const [auditLogs, setAuditLogs]         = useState([]);
  const [auditLoading, setAuditLoading]   = useState(false);
  const [auditExporting, setAuditExporting] = useState(false);
  const [auditFilter, setAuditFilter]     = useState({ model: '', action: '', start: monthAgo(), end: today() });

  // ── Load daily on mount ────────────────────────────────────────────────────
  useEffect(() => { fetchDaily(); }, []);
  useEffect(() => { if (activeTab === 'monthly') fetchMonthly(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'waste')   fetchWaste();   }, [activeTab]);
  useEffect(() => { if (activeTab === 'audit')   fetchAudit();   }, [activeTab]);

  // ── Fetch functions ──────────────────────────────────────────────────────────

  const fetchDaily = async () => {
    setDailyLoading(true);
    try {
      const res = await api.get(`reports/daily-production/?date=${dailyDate}`);
      setDailyData(res.data);
    } catch (e) { console.error(e); }
    finally { setDailyLoading(false); }
  };

  const fetchMonthly = async () => {
    setMonthLoading(true);
    try {
      const res = await api.get(`reports/monthly-sales/?year=${monthYear}&month=${monthMonth}`);
      setMonthData(res.data);
    } catch (e) { console.error(e); }
    finally { setMonthLoading(false); }
  };

  const fetchWaste = async () => {
    setWasteLoading(true);
    try {
      const res = await api.get(`reports/waste-analysis/?start=${wasteStart}&end=${wasteEnd}`);
      setWasteData(res.data);
    } catch (e) { console.error(e); }
    finally { setWasteLoading(false); }
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (auditFilter.model)  params.append('model',  auditFilter.model);
      if (auditFilter.action) params.append('action', auditFilter.action);
      if (auditFilter.start)  params.append('start',  auditFilter.start);
      if (auditFilter.end)    params.append('end',    auditFilter.end);
      const [logsRes, sumRes] = await Promise.all([
        api.get(`audit/logs/?${params.toString()}`),
        api.get('audit/logs/summary/'),
      ]);
      setAuditLogs(logsRes.data.results || logsRes.data);
      setAuditSummary(sumRes.data);
    } catch (e) { console.error(e); }
    finally { setAuditLoading(false); }
  };

  // ── Export functions (trigger file download) ──────────────────────────────

  const exportFile = async (url, filename, setLoading) => {
    setLoading(true);
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      alert('Export failed. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const exportDaily  = () => exportFile(
    `reports/daily-production/export/?date=${dailyDate}`,
    `daily_production_${dailyDate}.xlsx`, setDailyExporting
  );
  const exportMonthly = () => exportFile(
    `reports/monthly-sales/export/?year=${monthYear}&month=${monthMonth}`,
    `monthly_sales_${monthYear}_${String(monthMonth).padStart(2,'0')}.xlsx`, setMonthExporting
  );
  const exportWaste  = () => exportFile(
    `reports/waste-analysis/export/?start=${wasteStart}&end=${wasteEnd}`,
    `waste_analysis_${wasteStart}_to_${wasteEnd}.xlsx`, setWasteExporting
  );
  const exportAudit  = () => exportFile(
    `audit/logs/export/`, `audit_log_${today()}.xlsx`, setAuditExporting
  );

  const tabs = [
    { key: 'daily',   label: '📦 Daily Production' },
    { key: 'monthly', label: '📈 Monthly Sales'     },
    { key: 'waste',   label: '♻️ Waste Analysis'   },
    { key: 'audit',   label: '🔍 Audit Logs'        },
  ];

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <MainLayout>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Management-level reports, audit logs, and Excel exports."
      />

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-1 mb-6 w-fit transition-colors">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === t.key
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          DAILY PRODUCTION REPORT
      ═══════════════════════════════════════════ */}
      {activeTab === 'daily' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
              <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)} className={inputCls} />
            </div>
            <button onClick={fetchDaily} disabled={dailyLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
              {dailyLoading ? 'Loading...' : 'Generate'}
            </button>
            <DownloadBtn onClick={exportDaily} loading={dailyExporting} label="Export Excel" />
          </div>

          {dailyLoading && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          )}

          {dailyData && !dailyLoading && (
            <>
              <SectionHeader
                title={`Daily Production — ${new Date(dailyDate + 'T12:00:00').toLocaleDateString('en-PK', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`}
                subtitle="All production activity for this date"
              />

              {/* Warehouse */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Warehouse Receipts
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Stock Entries"   value={dailyData.warehouse.stock_entries}  accent="text-blue-600 dark:text-blue-400" />
                  <StatCard label="Total Weight (kg)" value={`${fmt(dailyData.warehouse.total_weight_kg)} kg`} />
                </div>
              </div>

              {/* Sorting */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Sorting
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Sessions"   value={dailyData.sorting.sessions}  accent="text-purple-600 dark:text-purple-400" />
                  <StatCard label="Input (kg)" value={`${fmt(dailyData.sorting.input_kg)} kg`} />
                  <StatCard label="Output (kg)" value={`${fmt(dailyData.sorting.output_kg)} kg`} accent="text-emerald-600 dark:text-emerald-400" />
                  <StatCard label="Efficiency" value={`${dailyData.sorting.efficiency_pct}%`}
                    accent={dailyData.sorting.efficiency_pct >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                </div>
              </div>

              {/* Decolorization */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" /> Decolorization
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="Sessions"   value={dailyData.decolorization.sessions} accent="text-teal-600 dark:text-teal-400" />
                  <StatCard label="Input (kg)" value={`${fmt(dailyData.decolorization.input_kg)} kg`} />
                  <StatCard label="Output (kg)" value={`${fmt(dailyData.decolorization.output_kg)} kg`} accent="text-emerald-600 dark:text-emerald-400" />
                  <StatCard label="Efficiency" value={`${dailyData.decolorization.efficiency_pct}%`}
                    accent={dailyData.decolorization.efficiency_pct >= 85 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          MONTHLY SALES REPORT
      ═══════════════════════════════════════════ */}
      {activeTab === 'monthly' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Month</label>
              <select value={monthMonth} onChange={e => setMonthMonth(Number(e.target.value))} className={inputCls}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Year</label>
              <select value={monthYear} onChange={e => setMonthYear(Number(e.target.value))} className={inputCls}>
                {[thisYear, thisYear-1, thisYear-2].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={fetchMonthly} disabled={monthLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
              {monthLoading ? 'Loading...' : 'Generate'}
            </button>
            <DownloadBtn onClick={exportMonthly} loading={monthExporting} label="Export Excel" />
          </div>

          {monthLoading && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          )}

          {monthData && !monthLoading && (
            <>
              <SectionHeader
                title={`Monthly Sales — ${MONTHS[monthData.month - 1]} ${monthData.year}`}
                subtitle="Revenue, collections, and order breakdown"
              />

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Orders"     value={monthData.total_orders}        accent="text-blue-600 dark:text-blue-400" />
                <StatCard label="Total Revenue"    value={fmtRs(monthData.total_revenue)}  accent="text-emerald-600 dark:text-emerald-400" />
                <StatCard label="Amount Collected" value={fmtRs(monthData.total_collected)} accent="text-blue-600 dark:text-blue-400" />
                <StatCard label="Pending Amount"   value={fmtRs(monthData.pending_amount)}
                  accent={int(monthData.pending_amount) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Order status breakdown */}
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Order Status Breakdown</h3>
                  {Object.entries(monthData.status_breakdown || {}).map(([st, cnt]) => {
                    const colors = { Draft:'bg-slate-400', Confirmed:'bg-blue-500', Dispatched:'bg-purple-500', Completed:'bg-emerald-500', Cancelled:'bg-red-400' };
                    return (
                      <PctBar key={st} label={st} value={cnt} total={monthData.total_orders}
                        color={colors[st] || 'bg-slate-400'} />
                    );
                  })}
                </div>

                {/* Payment method breakdown */}
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Payment Methods</h3>
                  {Object.entries(monthData.payment_method_breakdown || {}).map(([method, data]) => (
                    <div key={method} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                      <span className="text-sm text-slate-600 dark:text-slate-300">{method}</span>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtRs(data.amount)}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{data.count} payments</p>
                      </div>
                    </div>
                  ))}
                  {Object.keys(monthData.payment_method_breakdown || {}).length === 0 && (
                    <p className="text-slate-400 dark:text-slate-500 text-sm">No payments recorded.</p>
                  )}

                  {/* Extra summary */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Total Weight Sold</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{fmt(monthData.total_weight_kg)} kg</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Avg Price / kg</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">Rs. {fmt(monthData.avg_price_per_kg)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Total Dispatches</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{monthData.total_dispatches}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          WASTE ANALYSIS REPORT
      ═══════════════════════════════════════════ */}
      {activeTab === 'waste' && (
        <div className="space-y-5">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From</label>
              <input type="date" value={wasteStart} onChange={e => setWasteStart(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To</label>
              <input type="date" value={wasteEnd} onChange={e => setWasteEnd(e.target.value)} className={inputCls} />
            </div>
            <button onClick={fetchWaste} disabled={wasteLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
              {wasteLoading ? 'Loading...' : 'Generate'}
            </button>
            <DownloadBtn onClick={exportWaste} loading={wasteExporting} label="Export Excel" />
          </div>

          {wasteLoading && (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          )}

          {wasteData && !wasteLoading && (
            <>
              <SectionHeader title="Waste Analysis" subtitle={`${wasteData.start} to ${wasteData.end}`} />

              {/* KPI row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Total Input"   value={`${fmt(wasteData.total.input_kg)} kg`} />
                <StatCard label="Total Waste"   value={`${fmt(wasteData.total.waste_kg)} kg`} accent="text-red-600 dark:text-red-400" />
                <StatCard label="Waste Rate"    value={`${wasteData.total.waste_pct}%`}
                  accent={wasteData.total.waste_pct <= 5 ? 'text-emerald-600 dark:text-emerald-400' : wasteData.total.waste_pct <= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
                <StatCard label="Sessions Analysed" value={wasteData.sorting.sessions + wasteData.decolorization.sessions} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Stage comparison */}
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Waste by Stage</h3>
                  {[
                    { label: 'Sorting',          data: wasteData.sorting,         color: 'bg-purple-500' },
                    { label: 'Decolorization',   data: wasteData.decolorization,  color: 'bg-teal-500'   },
                  ].map(({ label, data, color }) => (
                    <div key={label} className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex justify-between text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">
                        <span>{label}</span>
                        <span className="text-red-600 dark:text-red-400 tabular-nums">{data.waste_pct}% waste</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>Input<br/><span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{fmt(data.input_kg)} kg</span></div>
                        <div>Waste<br/><span className="font-semibold text-red-600 dark:text-red-400 tabular-nums">{fmt(data.waste_kg)} kg</span></div>
                        <div>Sessions<br/><span className="font-semibold text-slate-700 dark:text-slate-200">{data.sessions}</span></div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Top waste by fabric */}
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Highest Waste by Fabric</h3>
                  {(wasteData.by_fabric || []).slice(0, 6).map((row, i) => (
                    <div key={i} className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-600 dark:text-slate-300 truncate max-w-[160px]" title={row.fabric}>{row.fabric}</span>
                        <span className="text-red-600 dark:text-red-400 font-semibold tabular-nums">{row.waste_pct}%</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${row.waste_pct > 10 ? 'bg-red-500' : row.waste_pct > 5 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(row.waste_pct * 5, 100)}%` }} />
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 tabular-nums">{fmt(row.waste_kg)} kg wasted from {fmt(row.input_kg)} kg input</p>
                    </div>
                  ))}
                  {(!wasteData.by_fabric || wasteData.by_fabric.length === 0) && (
                    <p className="text-slate-400 dark:text-slate-500 text-sm">No completed sessions in this range.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          AUDIT LOGS
      ═══════════════════════════════════════════ */}
      {activeTab === 'audit' && (
        <div className="space-y-5">

          {/* Summary cards */}
          {auditSummary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Log Entries" value={fmt(auditSummary.total_logs)} accent="text-blue-600 dark:text-blue-400" />
              <StatCard label="Today"             value={auditSummary.today}           accent="text-emerald-600 dark:text-emerald-400" />
              <StatCard label="This Week"         value={auditSummary.this_week} />
              <StatCard label="This Month"        value={auditSummary.this_month} />
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Model</label>
              <select value={auditFilter.model}
                onChange={e => setAuditFilter(f => ({...f, model: e.target.value}))} className={inputCls}>
                <option value="">All Models</option>
                {['SalesOrder','Payment','DispatchTracking','Stock','FabricStock','SortingSession','Tank','ChemicalStock','ChemicalIssuance','DecolorizationSession'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Action</label>
              <select value={auditFilter.action}
                onChange={e => setAuditFilter(f => ({...f, action: e.target.value}))} className={inputCls}>
                <option value="">All Actions</option>
                {['CREATE','UPDATE','DELETE','RESTORE','LOGIN','EXPORT'].map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From</label>
              <input type="date" value={auditFilter.start}
                onChange={e => setAuditFilter(f => ({...f, start: e.target.value}))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To</label>
              <input type="date" value={auditFilter.end}
                onChange={e => setAuditFilter(f => ({...f, end: e.target.value}))} className={inputCls} />
            </div>
            <button onClick={fetchAudit} disabled={auditLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
              {auditLoading ? 'Loading...' : 'Filter'}
            </button>
            <DownloadBtn onClick={exportAudit} loading={auditExporting} label="Export Excel" />
          </div>

          {/* Action badges */}
          {auditSummary?.by_action?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {auditSummary.by_action.map(({ action, count }) => {
                const colors = { CREATE:'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                  UPDATE:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                  DELETE:'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                  RESTORE:'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
                  LOGIN:'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
                  EXPORT:'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                };
                return (
                  <span key={action} className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[action] || 'bg-slate-100 text-slate-600'}`}>
                    {action}: {count}
                  </span>
                );
              })}
            </div>
          )}

          {/* Audit log table */}
          {auditLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#', 'Timestamp', 'User', 'Role', 'Action', 'Model', 'Record', 'Description'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400 dark:text-slate-500">No audit logs found for this filter.</td></tr>
                    ) : auditLogs.map((log, i) => {
                      const actionColors = {
                        CREATE:  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                        UPDATE:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                        DELETE:  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                        RESTORE: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
                        LOGIN:   'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400',
                        EXPORT:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                      };
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-slate-400 dark:text-slate-500">{i + 1}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs font-mono whitespace-nowrap">{log.timestamp_display}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{log.username}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 capitalize text-xs">{log.user_role?.replace(/_/g,' ')}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${actionColors[log.action] || 'bg-slate-100 text-slate-600'}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{log.model_name}</td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">#{log.object_id}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs max-w-xs truncate" title={log.object_repr}>{log.object_repr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </MainLayout>
  );
}
