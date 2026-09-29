import { useEffect, useState, useRef } from 'react';
import FilterBar from '../../components/common/FilterBar';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import api from '../../api/axios';

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

// ── Safe integer parser — handles Django DecimalField strings like "1683.00" ──
const int = v => Math.round(Number(v) || 0);
const fmt = v => int(v).toLocaleString();

const STATUS_COLORS = {
  'In Progress':            'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'Completed':              'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  'On Hold':                'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
  'In Warehouse':           'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-300',
  'In Sorting':             'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'Sorted':                 'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  'Sent to Decolorization': 'bg-teal-100   dark:bg-teal-900/40   text-teal-700   dark:text-teal-300',
  'Pending':                'bg-slate-100  dark:bg-slate-700     text-slate-500  dark:text-slate-400',
};

// ── KPI Gauge (circular arc) ──────────────────────────────────────────────────
function Gauge({ value, max = 100, color, label, unit = '%' }) {
  const pct  = Math.min(Math.max(Number(value) || 0, 0) / max, 1);
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const arc  = circ * 0.75;
  const dash = pct * arc;
  const gap  = circ - dash;
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="80" viewBox="0 0 100 80">
        {/* Track */}
        <circle cx="50" cy="58" r={r} fill="none"
          stroke="currentColor" strokeWidth="8"
          className="text-slate-200 dark:text-slate-700"
          strokeDasharray={`${arc} ${circ * 0.25}`}
          strokeDashoffset={circ * 0.375}
          strokeLinecap="round" transform="rotate(-135 50 58)" />
        {/* Fill */}
        <circle cx="50" cy="58" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${dash} ${gap + circ * 0.25}`}
          strokeDashoffset={circ * 0.375}
          strokeLinecap="round" transform="rotate(-135 50 58)" />
        <text x="50" y="62" textAnchor="middle"
          fill="currentColor" className="text-slate-800 dark:text-slate-100"
          fontSize="15" fontWeight="700">
          {Math.round(Number(value) || 0)}{unit}
        </text>
      </svg>
      <p className="text-xs text-slate-500 dark:text-slate-400 -mt-1 text-center">{label}</p>
    </div>
  );
}

// ── KPI Stat tile ─────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, accent }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Input vs Output bar chart ─────────────────────────────────────────────────
function BarChart({ sessions }) {
  if (!sessions.length) return <p className="text-slate-400 dark:text-slate-500 text-sm text-center py-6">No session data yet.</p>;
  const maxVal = Math.max(...sessions.map(s => int(s.quantity_taken)), 1);
  return (
    <div className="space-y-2.5">
      {sessions.slice(0, 8).map((s) => {
        const input     = int(s.quantity_taken);
        const sorted    = int(s.quantity_sorted);
        const inputPct  = (input  / maxVal) * 100;
        const sortedPct = (sorted / maxVal) * 100;
        return (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                #{s.id} {s.fabric_material || ''}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                {fmt(s.quantity_sorted)} kg / {fmt(s.quantity_taken)} kg
              </span>
            </div>
            <div className="relative h-4 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="absolute left-0 top-0 h-full bg-blue-400/50 rounded-full transition-all"
                style={{ width: `${inputPct}%` }} />
              <div className="absolute left-0 top-0 h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${sortedPct}%` }} />
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-blue-400/50 inline-block" /> Input
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Sorted output
        </span>
      </div>
    </div>
  );
}

export default function Sorting() {
  const [activeTab, setActiveTab]         = useState('kpi');
  const [sessions, setSessions]           = useState([]);
  const [fabric, setFabric]               = useState([]);
  const [warehouseStock, setWarehouseStock] = useState([]);
  const [users, setUsers]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [modalType, setModalType]         = useState('session');
  const [form, setForm]                   = useState({});
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [completeModal, setCompleteModal] = useState(null);
  const [completeForm, setCompleteForm]   = useState({});

  // ── Tab filter states ─────────────────────────────────────────────────────
  const [sessionStatusFilter, setSessionStatusFilter] = useState('');
  const [sessionDateFilter,   setSessionDateFilter]   = useState({ type: 'all' });
  const [sessionSearch,       setSessionSearch]       = useState('');
  const [fabricStatusFilter,  setFabricStatusFilter]  = useState('');
  const [fabricSearch,        setFabricSearch]        = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      // allSettled: a 403 on warehouse/users won't blank sorting data
      const [sess, fab, stock, usr] = await Promise.allSettled([
        api.get('sorting/sessions/'),
        api.get('sorting/fabric-stock/'),
        api.get('warehouse/stock/'),
        api.get('users/list/'),
      ]);
      if (sess.status  === 'fulfilled') setSessions(sess.value.data);
      if (fab.status   === 'fulfilled') setFabric(fab.value.data);
      if (stock.status === 'fulfilled') setWarehouseStock(stock.value.data);
      if (usr.status   === 'fulfilled') setUsers(usr.value.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── KPI calculations — all values parsed through int() to handle "1683.00" strings ──
  const completedSessions = sessions.filter(s => s.status === 'Completed');
  const totalInput   = sessions.reduce((a, s) => a + int(s.quantity_taken),  0);
  const totalSorted  = sessions.reduce((a, s) => a + int(s.quantity_sorted), 0);
  const totalWaste   = sessions.reduce((a, s) => a + int(s.waste_quantity),  0);
  const efficiencyPct  = totalInput > 0 ? (totalSorted / totalInput) * 100 : 0;
  const wastePct       = totalInput > 0 ? (totalWaste  / totalInput) * 100 : 0;
  const completionRate = sessions.length > 0 ? (completedSessions.length / sessions.length) * 100 : 0;

  const bestSession = completedSessions.reduce((best, s) => {
    const eff  = int(s.quantity_taken) > 0 ? (int(s.quantity_sorted) / int(s.quantity_taken)) * 100 : 0;
    const beff = best ? (int(best.quantity_taken) > 0 ? (int(best.quantity_sorted) / int(best.quantity_taken)) * 100 : 0) : 0;
    return eff > beff ? s : best;
  }, null);

  const openModal    = (type, item = {}) => { setModalType(type); setForm(item); setError(''); setShowModal(true); };
  const closeModal   = () => { setShowModal(false); setForm({}); setError(''); };
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = modalType === 'session' ? 'sorting/sessions/' : 'sorting/fabric-stock/';
    try {
      form.id ? await api.put(`${url}${form.id}/`, form) : await api.post(url, form);
      await fetchAll(); closeModal();
    } catch (e) {
      setError(e.response?.data ? Object.values(e.response.data).flat().join(' ') : 'Something went wrong.');
    } finally { setSaving(false); }
  };

  const handleComplete = async () => {
    try {
      await api.post(`sorting/sessions/${completeModal}/complete/`, completeForm);
      await fetchAll(); setCompleteModal(null); setCompleteForm({});
    } catch { alert('Could not complete session.'); }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure?')) return;
    const url = type === 'session' ? 'sorting/sessions/' : 'sorting/fabric-stock/';
    try { await api.delete(`${url}${id}/`); fetchAll(); }
    catch { alert('Could not delete.'); }
  };

  // ── Filtered lists (computed from filter state) ──────────────────────────
  const filteredSessions = sessions.filter(s => {
    const matchStatus = !sessionStatusFilter || s.status === sessionStatusFilter;
    const matchSearch = !sessionSearch ||
      (s.fabric_material || '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
      (s.supervisor_name || '').toLowerCase().includes(sessionSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredFabric = fabric.filter(f => {
    const matchStatus = !fabricStatusFilter || f.status === fabricStatusFilter;
    const matchSearch = !fabricSearch ||
      (f.material_type || '').toLowerCase().includes(fabricSearch.toLowerCase());
    return matchStatus && matchSearch;
  });

  const tabs = [
    { key: 'kpi',      label: '📊 Dashboard' },
    { key: 'sessions', label: 'Sorting Sessions'  },
    { key: 'fabric',   label: 'Fabric Stock'      },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Sorting"
        subtitle="Manage sorting sessions and monitor efficiency KPIs."
        action={
          activeTab !== 'kpi' && (
            <button onClick={() => openModal(activeTab === 'sessions' ? 'session' : 'fabric')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add {activeTab === 'sessions' ? 'Session' : 'Fabric Stock'}
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-1 mb-5 w-fit transition-colors duration-200">
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

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* ── KPI Dashboard Tab ── */}
          {activeTab === 'kpi' && (
            <div className="space-y-5">

              {/* Gauge row */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-6">
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">
                  Sorting Performance Gauges
                </h3>
                <div className="flex flex-wrap justify-around gap-6">
                  <Gauge value={efficiencyPct}  color="#10b981" label="Output Efficiency" />
                  <Gauge value={wastePct}        color="#f59e0b" label="Waste Rate"        />
                  <Gauge value={completionRate}  color="#3b82f6" label="Session Completion" />
                </div>
              </div>

              {/* KPI stat tiles */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiTile label="Total Sessions"
                  value={sessions.length}
                  sub={`${completedSessions.length} completed`}
                  accent="text-blue-600 dark:text-blue-400" />
                <KpiTile label="Total Input (kg)"
                  value={`${fmt(totalInput)} kg`}
                  sub="Fabric taken for sorting"
                  accent="text-slate-800 dark:text-slate-100" />
                <KpiTile label="Total Sorted (kg)"
                  value={`${fmt(totalSorted)} kg`}
                  sub={`${Math.round(efficiencyPct)}% of input`}
                  accent="text-emerald-600 dark:text-emerald-400" />
                <KpiTile label="Total Waste (kg)"
                  value={`${fmt(totalWaste)} kg`}
                  sub={`${Math.round(wastePct)}% of input`}
                  accent="text-amber-600 dark:text-amber-400" />
              </div>

              {/* Two-column bottom row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Input vs Output bars */}
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                  <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">
                    Input vs Output — per Session
                  </h3>
                  <BarChart sessions={sessions} />
                </div>

                {/* Fabric stock status */}
                <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                  <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">
                    Fabric Stock by Status
                  </h3>
                  {['In Warehouse','In Sorting','Sorted','Sent to Decolorization'].map(st => {
                    const count = fabric.filter(f => f.status === st).length;
                    const pct   = fabric.length > 0 ? (count / fabric.length) * 100 : 0;
                    const colors = {
                      'In Warehouse':           'bg-slate-400',
                      'In Sorting':             'bg-purple-500',
                      'Sorted':                 'bg-emerald-500',
                      'Sent to Decolorization': 'bg-teal-500',
                    };
                    return (
                      <div key={st} className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600 dark:text-slate-300">{st}</span>
                          <span className="text-slate-400 dark:text-slate-500">{count} batches ({Math.round(pct)}%)</span>
                        </div>
                        <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className={`h-full ${colors[st]} rounded-full transition-all`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  {bestSession && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/60">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">🏆 Best Session</p>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Session #{bestSession.id} —{' '}
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {int(bestSession.quantity_taken) > 0
                            ? Math.round((int(bestSession.quantity_sorted) / int(bestSession.quantity_taken)) * 100)
                            : 0}% efficiency
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Sessions Tab ── */}
          {activeTab === 'sessions' && (
            <div className="space-y-3">
              <FilterBar
                statusLabel="STATUS:"
                statuses={['In Progress','Completed','On Hold','Pending']}
                statusFilter={sessionStatusFilter}
                onStatusChange={setSessionStatusFilter}
                dateValue={sessionDateFilter}
                onDateChange={setSessionDateFilter}
                searchValue={sessionSearch}
                onSearchChange={setSessionSearch}
                searchPlaceholder="Search fabric / supervisor..."
              />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-colors duration-200">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      {['#','Fabric','Supervisor','Unit','Input kg','Sorted kg','Waste kg','Eff %','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredSessions.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-10 text-slate-400 dark:text-slate-500">No sorting sessions found.</td></tr>
                    ) : filteredSessions.map((s, i) => {
                      const taken  = int(s.quantity_taken);
                      const sorted = int(s.quantity_sorted);
                      const eff    = taken > 0 ? Math.round((sorted / taken) * 100) : null;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{s.fabric_material || s.fabric}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.supervisor_name || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.unit || '—'}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{taken > 0 ? fmt(s.quantity_taken) : '—'}</td>
                          <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{sorted > 0 ? fmt(s.quantity_sorted) : '—'}</td>
                          <td className="px-4 py-3 text-amber-600 dark:text-amber-400 tabular-nums">{int(s.waste_quantity) > 0 ? fmt(s.waste_quantity) : '—'}</td>
                          <td className="px-4 py-3">
                            {eff !== null ? (
                              <span className={`font-semibold ${eff >= 80 ? 'text-emerald-600 dark:text-emerald-400' : eff >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                                {eff}%
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>{s.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              {s.status === 'In Progress' && (
                                <button onClick={() => setCompleteModal(s.id)}
                                  className="text-green-600 dark:text-green-400 hover:text-green-800 text-xs font-medium">Complete</button>
                              )}
                              <button onClick={() => openModal('session', s)} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                              <button onClick={() => handleDelete('session', s.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}

          {/* ── Fabric Tab ── */}
          {activeTab === 'fabric' && (
            <div className="space-y-3">
              <FilterBar
                statusLabel="STATUS:"
                statuses={['In Warehouse','In Sorting','Sorted','Sent to Decolorization']}
                statusFilter={fabricStatusFilter}
                onStatusChange={setFabricStatusFilter}
                showDate={false}
                searchValue={fabricSearch}
                onSearchChange={setFabricSearch}
                searchPlaceholder="Search material..."
              />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-colors duration-200">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      {['#','Material','Initial kg','Sorted kg','Remaining kg','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredFabric.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">No fabric stock found.</td></tr>
                    ) : filteredFabric.map((f, i) => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{f.material_type}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmt(f.initial_quantity)}</td>
                        <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 tabular-nums">{int(f.sorted_quantity) > 0 ? fmt(f.sorted_quantity) : '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmt(f.remaining_quantity)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[f.status] || ''}`}>{f.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openModal('fabric', f)} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                            <button onClick={() => handleDelete('fabric', f.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            </div>
          )}
        </>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {form.id ? 'Edit' : 'Add'} {modalType === 'session' ? 'Sorting Session' : 'Fabric Stock'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>}
              {modalType === 'session' && (
                <>
                  <div><label className={labelCls}>Fabric Stock</label>
                    <select name="fabric" value={form.fabric || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select fabric</option>
                      {fabric.map(f => <option key={f.id} value={f.id}>{f.material_type}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Supervisor</label>
                    <select name="supervisor" value={form.supervisor || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select supervisor</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Unit</label>
                    <select name="unit" value={form.unit || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select unit</option>
                      {['Unit 1','Unit 2','Unit 3','Unit 4','Unit 5'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Quantity Taken (kg)</label>
                    <input type="number" name="quantity_taken" value={form.quantity_taken || ''} onChange={handleChange} className={inputCls} />
                  </div>
                  <div><label className={labelCls}>Notes</label>
                    <textarea name="notes" value={form.notes || ''} onChange={handleChange} rows={2} className={inputCls} />
                  </div>
                </>
              )}
              {modalType === 'fabric' && (
                <>
                  <div><label className={labelCls}>Warehouse Stock</label>
                    <select name="stock" value={form.stock || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select stock</option>
                      {warehouseStock.map(s => <option key={s.id} value={s.id}>{s.fabric_type} — {fmt(s.our_weight)} kg</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Material Type</label>
                    <input name="material_type" value={form.material_type || ''} onChange={handleChange} placeholder="e.g. Cotton White Grade A" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Initial Qty (kg)</label>
                      <input type="number" name="initial_quantity" value={form.initial_quantity || ''} onChange={handleChange} className={inputCls} />
                    </div>
                    <div><label className={labelCls}>Remaining Qty (kg)</label>
                      <input type="number" name="remaining_quantity" value={form.remaining_quantity || ''} onChange={handleChange} className={inputCls} />
                    </div>
                  </div>
                  <div><label className={labelCls}>Status</label>
                    <select name="status" value={form.status || 'In Warehouse'} onChange={handleChange} className={inputCls}>
                      {['In Warehouse','In Sorting','Sorted','Sent to Decolorization'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={closeModal} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : (form.id ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Session Modal ── */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700/60">
            <div className="p-5 border-b border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">Complete Sorting Session</h3>
            </div>
            <div className="p-5 space-y-4">
              <div><label className={labelCls}>Quantity Sorted (kg)</label>
                <input type="number" value={completeForm.quantity_sorted || ''}
                  onChange={e => setCompleteForm({ ...completeForm, quantity_sorted: e.target.value })} className={inputCls} />
              </div>
              <div><label className={labelCls}>Waste Quantity (kg)</label>
                <input type="number" value={completeForm.waste_quantity || ''}
                  onChange={e => setCompleteForm({ ...completeForm, waste_quantity: e.target.value })} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={() => setCompleteModal(null)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleComplete} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition">Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
