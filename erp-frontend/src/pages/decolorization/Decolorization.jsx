import { useEffect, useState } from 'react';
import FilterBar from '../../components/common/FilterBar';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import api from '../../api/axios';

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

// ── Safe integer parser — handles Django DecimalField strings like "4800.00" ─
const int = v => Math.round(Number(v) || 0);
const fmt = v => int(v).toLocaleString();

const TANK_STATUS_COLORS = {
  'Empty':      'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-300',
  'Filled':     'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'Processing': 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'Completed':  'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  'Cleaning':   'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
};
const SESSION_STATUS_COLORS = {
  'In Progress': 'bg-blue-100  dark:bg-blue-900/40  text-blue-700  dark:text-blue-300',
  'Completed':   'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  'Failed':      'bg-red-100   dark:bg-red-900/40   text-red-700   dark:text-red-300',
  'On Hold':     'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
};

// ── Tank card ─────────────────────────────────────────────────────────────────
// Reads fabric_quantity as the load (current_load may not exist on all backends)
function TankCard({ tank }) {
  const capacity = int(tank.capacity);
  // Support both field names: current_load (if serializer exposes it) or fabric_quantity
  const load     = int(tank.current_load ?? tank.fabric_quantity ?? 0);
  const fillPct  = capacity > 0 ? Math.min((load / capacity) * 100, 100) : 0;

  const statusColor = {
    'Empty':      '#94a3b8',
    'Filled':     '#3b82f6',
    'Processing': '#a855f7',
    'Completed':  '#10b981',
    'Cleaning':   '#f59e0b',
  };
  const color = statusColor[tank.tank_status] || '#94a3b8';

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{tank.name}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{tank.batch_id}</p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TANK_STATUS_COLORS[tank.tank_status] || ''}`}>
          {tank.tank_status}
        </span>
      </div>

      {/* Circular fill indicator */}
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14 flex-shrink-0">
          <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none"
              stroke="currentColor" strokeWidth="6"
              className="text-slate-100 dark:text-slate-700" />
            <circle cx="28" cy="28" r="22" fill="none"
              stroke={color} strokeWidth="6"
              strokeDasharray={`${(fillPct / 100) * 138.2} 138.2`}
              strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-slate-200">
            {Math.round(fillPct)}%
          </span>
        </div>
        <div className="space-y-0.5">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Load: <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{fmt(load)} kg</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cap: <span className="font-medium text-slate-700 dark:text-slate-200 tabular-nums">{capacity > 0 ? fmt(capacity) : '—'} kg</span>
          </p>
          {tank.fabric_name && (
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[110px]" title={tank.fabric_name}>
              {tank.fabric_name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Chemical consumption bar ───────────────────────────────────────────────────
function ChemicalBar({ chemical }) {
  const total   = int(chemical.total_stock);
  const remain  = int(chemical.remaining_stock);
  const usedPct   = total > 0 ? ((total - remain) / total) * 100 : 0;
  const remainPct = 100 - usedPct;
  const critical  = remainPct < 25;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{chemical.chemical_name}</span>
        <span className={`text-xs font-medium tabular-nums ${critical ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {fmt(remain)} / {fmt(total)} {chemical.unit_of_measure}
          {critical && ' ⚠️'}
        </span>
      </div>
      <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${critical ? 'bg-red-500' : 'bg-teal-500'}`}
          style={{ width: `${remainPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-0.5">
        <span>{Math.round(usedPct)}% consumed</span>
        <span>{Math.round(remainPct)}% remaining</span>
      </div>
    </div>
  );
}

export default function Decolorization() {
  const [activeTab, setActiveTab]         = useState('kpi');
  const [tanks, setTanks]                 = useState([]);
  const [chemicals, setChemicals]         = useState([]);
  const [issuances, setIssuances]         = useState([]);
  const [sessions, setSessions]           = useState([]);
  const [fabricStock, setFabricStock]     = useState([]);
  const [users, setUsers]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [modalType, setModalType]         = useState('tank');
  const [form, setForm]                   = useState({});
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [completeModal, setCompleteModal] = useState(null);
  const [completeForm, setCompleteForm]   = useState({});

  // ── Filter states ────────────────────────────────────────────────────────
  const [sessionStatusFilter, setSessionStatusFilter] = useState('');
  const [sessionDateFilter,   setSessionDateFilter]   = useState({ type: 'all' });
  const [sessionSearch,       setSessionSearch]       = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [t, c, iss, sess, fab, usr] = await Promise.all([
        api.get('decolorization/tanks/'),
        api.get('decolorization/chemicals/'),
        api.get('decolorization/issuances/'),
        api.get('decolorization/sessions/'),
        api.get('decolorization/fabric-stock/'),
        api.get('users/list/'),
      ]);
      setTanks(t.data); setChemicals(c.data);
      setIssuances(iss.data); setSessions(sess.data);
      setFabricStock(fab.data); setUsers(usr.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Filtered sessions ────────────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s => {
    const matchStatus = !sessionStatusFilter || s.status === sessionStatusFilter;
    const matchSearch = !sessionSearch ||
      (s.tank_name    || '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
      (s.fabric_material || '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
      (s.supervisor_name || '').toLowerCase().includes(sessionSearch.toLowerCase());
    const matchDate = (() => {
      if (sessionDateFilter.type === 'all') return true;
      const dateStr = s.start_date || s.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();
      if (sessionDateFilter.type === 'today') return d.toDateString() === now.toDateString();
      if (sessionDateFilter.type === 'week')  { const w=new Date(now); w.setDate(now.getDate()-7); return d>=w; }
      if (sessionDateFilter.type === 'month') { const m=new Date(now); m.setMonth(now.getMonth()-1); return d>=m; }
      if (sessionDateFilter.type === 'year')  return d.getFullYear() === now.getFullYear();
      return true;
    })();
    return matchStatus && matchSearch && matchDate;
  });

  // ── KPI calculations — all parsed through int() ───────────────────────────
  const activeTanks    = tanks.filter(t => t.tank_status === 'Processing').length;
  const completedTanks = tanks.filter(t => t.tank_status === 'Completed').length;
  const utilizationPct = tanks.length > 0 ? (activeTanks / tanks.length) * 100 : 0;

  const completedSessions   = sessions.filter(s => s.status === 'Completed');
  const totalInput          = sessions.reduce((a, s) => a + int(s.input_quantity),  0);
  const totalOutput         = completedSessions.reduce((a, s) => a + int(s.output_quantity), 0);
  const outputEff           = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
  const totalChemicalIssued = issuances.reduce((a, i) => a + int(i.quantity), 0);

  const criticalChemicals = chemicals.filter(c => {
    const total  = int(c.total_stock);
    const remain = int(c.remaining_stock);
    return total > 0 && (remain / total) < 0.25;
  });

  const openModal    = (type, item = {}) => { setModalType(type); setForm(item); setError(''); setShowModal(true); };
  const closeModal   = () => { setShowModal(false); setForm({}); setError(''); };
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    const urls = { tank: 'decolorization/tanks/', chemical: 'decolorization/chemicals/', issuance: 'decolorization/issuances/', session: 'decolorization/sessions/' };
    try {
      const url = urls[modalType];
      // For tanks: the form uses "current_load" for display but the model
      // field is "fabric_quantity". Send both so the backend can use either.
      let payload = { ...form };
      if (modalType === 'tank' && payload.current_load !== undefined) {
        payload.fabric_quantity = payload.current_load;
      }
      form.id ? await api.put(`${url}${form.id}/`, payload) : await api.post(url, payload);
      await fetchAll(); closeModal();
    } catch (e) {
      setError(e.response?.data ? Object.values(e.response.data).flat().join(' ') : 'Something went wrong.');
    } finally { setSaving(false); }
  };

  const handleTankAction = async (id, action) => {
    try { await api.post(`decolorization/tanks/${id}/${action}/`); fetchAll(); }
    catch { alert('Action failed.'); }
  };

  const handleCompleteSession = async () => {
    try {
      await api.post(`decolorization/sessions/${completeModal}/complete/`, completeForm);
      await fetchAll(); setCompleteModal(null); setCompleteForm({});
    } catch { alert('Could not complete session.'); }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure?')) return;
    const urls = { tank: 'decolorization/tanks/', chemical: 'decolorization/chemicals/', issuance: 'decolorization/issuances/', session: 'decolorization/sessions/' };
    try { await api.delete(`${urls[type]}${id}/`); fetchAll(); }
    catch { alert('Could not delete.'); }
  };

  const tabs = [
    { key: 'kpi',       label: '📊 Dashboard'  },
    { key: 'tanks',     label: 'Tanks'              },
    { key: 'chemicals', label: 'Chemical Stock'     },
    { key: 'issuances', label: 'Chemical Issuances' },
    { key: 'sessions',  label: 'Sessions'           },
  ];
  const addLabel = { tanks: 'Add Tank', chemicals: 'Add Chemical', issuances: 'Issue Chemical', sessions: 'Add Session' };
  const addType  = { tanks: 'tank', chemicals: 'chemical', issuances: 'issuance', sessions: 'session' };

  return (
    <MainLayout>
      <PageHeader
        title="Decolorization"
        subtitle="Manage tanks, chemicals, issuances, and processing sessions."
        action={
          activeTab !== 'kpi' && (
            <button onClick={() => openModal(addType[activeTab])}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {addLabel[activeTab]}
            </button>
          )
        }
      />

      <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-1 mb-5 w-fit transition-colors duration-200">
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
          {/* ── KPI Tab ── */}
          {activeTab === 'kpi' && (
            <div className="space-y-5">

              {/* Critical stock alert */}
              {criticalChemicals.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl px-5 py-4 flex items-start gap-3">
                  <span className="text-red-500 text-xl flex-shrink-0">⚠️</span>
                  <div>
                    <p className="text-red-700 dark:text-red-300 font-semibold text-sm">Critical Stock Alert</p>
                    <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">
                      {criticalChemicals.map(c => c.chemical_name).join(', ')} — below 25% remaining. Restock required.
                    </p>
                  </div>
                </div>
              )}

              {/* KPI stat row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Tanks',       value: tanks.length,                    sub: `${activeTanks} processing`,              accent: 'text-blue-600 dark:text-blue-400'     },
                  { label: 'Tank Utilization',  value: `${Math.round(utilizationPct)}%`, sub: `${completedTanks} completed`,           accent: 'text-purple-600 dark:text-purple-400' },
                  { label: 'Output Efficiency', value: `${Math.round(outputEff)}%`,      sub: `${fmt(totalOutput)} kg out`,            accent: 'text-emerald-600 dark:text-emerald-400'},
                  { label: 'Chemical Issued',   value: `${fmt(totalChemicalIssued)}`,    sub: `${issuances.length} issuances`,         accent: 'text-teal-600 dark:text-teal-400'     },
                ].map(k => (
                  <div key={k.label} className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{k.label}</p>
                    <p className={`text-2xl font-bold tabular-nums ${k.accent}`}>{k.value}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{k.sub}</p>
                  </div>
                ))}
              </div>

              {/* Tank status breakdown */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">Tank Status Overview</h3>
                <div className="grid grid-cols-5 gap-2 mb-5">
                  {['Empty','Filled','Processing','Completed','Cleaning'].map(st => {
                    const count = tanks.filter(t => t.tank_status === st).length;
                    const colors = { Empty:'#94a3b8', Filled:'#3b82f6', Processing:'#a855f7', Completed:'#10b981', Cleaning:'#f59e0b' };
                    return (
                      <div key={st} className="text-center">
                        <div className="text-2xl font-bold" style={{ color: colors[st] }}>{count}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{st}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Tank grid heatmap */}
                <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2">
                  {tanks.map(tank => {
                    const load     = int(tank.current_load ?? tank.fabric_quantity ?? 0);
                    const capacity = int(tank.capacity);
                    const fillPct  = capacity > 0 ? Math.round((load / capacity) * 100) : 0;
                    const bgMap    = { Empty:'bg-slate-200 dark:bg-slate-700', Filled:'bg-blue-400', Processing:'bg-purple-500', Completed:'bg-emerald-500', Cleaning:'bg-amber-400' };
                    return (
                      <div key={tank.id}
                        title={`${tank.name} (${tank.batch_id})\nStatus: ${tank.tank_status}\nLoad: ${fmt(load)} kg / ${fmt(capacity)} kg (${fillPct}%)`}
                        className={`h-8 rounded-md ${bgMap[tank.tank_status] || 'bg-slate-200'} cursor-default transition-transform hover:scale-110`} />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  {[['bg-slate-200 dark:bg-slate-700','Empty'],['bg-blue-400','Filled'],['bg-purple-500','Processing'],['bg-emerald-500','Completed'],['bg-amber-400','Cleaning']].map(([cls, label]) => (
                    <span key={label} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`w-3 h-3 rounded-sm ${cls} inline-block`} />{label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Chemical consumption */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">Chemical Stock Levels</h3>
                {chemicals.length === 0
                  ? <p className="text-slate-400 dark:text-slate-500 text-sm">No chemicals found.</p>
                  : chemicals.map(c => <ChemicalBar key={c.id} chemical={c} />)
                }
              </div>

              {/* Session performance */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
                <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">Session Performance</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'Total',       value: sessions.length,                                         color: 'text-slate-700 dark:text-slate-200'     },
                    { label: 'Completed',   value: completedSessions.length,                                color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'In Progress', value: sessions.filter(s => s.status === 'In Progress').length, color: 'text-blue-600 dark:text-blue-400'       },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4">
                      <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>
                {totalInput > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 text-center">
                      <p className="text-xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{fmt(totalInput)} kg</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Input</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/40 rounded-xl p-4 text-center">
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(totalOutput)} kg</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Output ({Math.round(outputEff)}% eff.)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tanks Tab ── */}
          {activeTab === 'tanks' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {tanks.length === 0
                ? <p className="text-slate-400 dark:text-slate-500 col-span-3 text-center py-10">No tanks found.</p>
                : tanks.map(tank => (
                    <div key={tank.id} className="relative">
                      <TankCard tank={tank} />
                      <div className="absolute top-3 right-3 flex gap-1">
                        <button onClick={() => openModal('tank', tank)}
                          className="text-blue-600 dark:text-blue-400 text-xs font-medium bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">Edit</button>
                        <button onClick={() => handleDelete('tank', tank.id)}
                          className="text-red-500 dark:text-red-400 text-xs font-medium bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">Del</button>
                      </div>
                    </div>
                  ))}
            </div>
          )}

          {/* ── Chemicals Tab ── */}
          {activeTab === 'chemicals' && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#','Chemical','Total Stock','Remaining','Used %','Unit','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {chemicals.length === 0
                      ? <tr><td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">No chemicals found.</td></tr>
                      : chemicals.map((c, i) => {
                          const total    = int(c.total_stock);
                          const remain   = int(c.remaining_stock);
                          const usedPct  = total > 0 ? Math.round(((total - remain) / total) * 100) : 0;
                          const critical = total > 0 && (remain / total) < 0.25;
                          return (
                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{c.chemical_name}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{fmt(c.total_stock)}</td>
                              <td className="px-4 py-3 tabular-nums">
                                <span className={critical ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400'}>
                                  {fmt(c.remaining_stock)} {critical && '⚠️'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{usedPct}%</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{c.unit_of_measure}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => openModal('chemical', c)} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                                  <button onClick={() => handleDelete('chemical', c.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Issuances Tab ── */}
          {activeTab === 'issuances' && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#','Chemical','Tank','Qty','Issued By','Date','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {issuances.length === 0
                      ? <tr><td colSpan={7} className="text-center py-10 text-slate-400 dark:text-slate-500">No issuances found.</td></tr>
                      : issuances.map((iss, i) => (
                          <tr key={iss.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{iss.chemical_name || '—'}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{iss.tank_name || '—'}</td>
                            <td className="px-4 py-3 text-teal-600 dark:text-teal-400 font-medium tabular-nums">{fmt(iss.quantity)}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{iss.issued_by_name || '—'}</td>
                            <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                              {iss.issued_at ? new Date(iss.issued_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button onClick={() => openModal('issuance', iss)} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                                <button onClick={() => handleDelete('issuance', iss.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Sessions Tab ── */}
          {activeTab === 'sessions' && (
            <div className="space-y-3">
              <FilterBar
                statusLabel="STATUS:"
                statuses={['In Progress','Completed','Failed','On Hold']}
                statusFilter={sessionStatusFilter}
                onStatusChange={setSessionStatusFilter}
                dateValue={sessionDateFilter}
                onDateChange={setSessionDateFilter}
                searchValue={sessionSearch}
                onSearchChange={setSessionSearch}
                searchPlaceholder="Search tank / fabric..."
              />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#','Tank','Fabric','Supervisor','Input kg','Output kg','Waste kg','Eff %','Status','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredSessions.length === 0
                      ? <tr><td colSpan={10} className="text-center py-10 text-slate-400 dark:text-slate-500">No sessions found.</td></tr>
                      : filteredSessions.map((s, i) => {
                          const inp  = int(s.input_quantity);
                          const out  = int(s.output_quantity);
                          const eff  = inp > 0 ? Math.round((out / inp) * 100) : null;
                          return (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{s.tank_name || '—'}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.fabric_material || '—'}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.supervisor_name || '—'}</td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{inp > 0 ? fmt(s.input_quantity) : '—'}</td>
                              <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 tabular-nums">{out > 0 ? fmt(s.output_quantity) : '—'}</td>
                              <td className="px-4 py-3 text-amber-600 dark:text-amber-400 tabular-nums">{int(s.waste_quantity) > 0 ? fmt(s.waste_quantity) : '—'}</td>
                              <td className="px-4 py-3">
                                {eff !== null ? (
                                  <span className={`font-semibold ${eff >= 80 ? 'text-emerald-600 dark:text-emerald-400' : eff >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{eff}%</span>
                                ) : '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SESSION_STATUS_COLORS[s.status] || ''}`}>{s.status}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  {s.status === 'In Progress' && (
                                    <button onClick={() => setCompleteModal(s.id)} className="text-green-600 dark:text-green-400 text-xs font-medium">Complete</button>
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
        </>
      )}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {form.id ? 'Edit' : 'Add'} {modalType === 'tank' ? 'Tank' : modalType === 'chemical' ? 'Chemical' : modalType === 'issuance' ? 'Chemical Issuance' : 'Session'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>}

              {modalType === 'tank' && (
                <>
                  <div><label className={labelCls}>Tank Name</label><input name="name" value={form.name || ''} onChange={handleChange} placeholder="e.g. Tank A-01" className={inputCls} /></div>
                  <div><label className={labelCls}>Batch ID</label><input name="batch_id" value={form.batch_id || ''} onChange={handleChange} className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Capacity (kg)</label><input type="number" name="capacity" value={form.capacity || ''} onChange={handleChange} className={inputCls} /></div>
                    <div><label className={labelCls}>Current Load (kg)</label><input type="number" name="current_load" value={form.current_load || ''} onChange={handleChange} className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Fabric</label>
                    <select name="fabric" value={form.fabric || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select fabric</option>
                      {fabricStock.map(f => <option key={f.id} value={f.id}>{f.material_type}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Status</label>
                    <select name="tank_status" value={form.tank_status || 'Empty'} onChange={handleChange} className={inputCls}>
                      {['Empty','Filled','Processing','Completed','Cleaning'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}

              {modalType === 'chemical' && (
                <>
                  <div><label className={labelCls}>Chemical Name</label><input name="chemical_name" value={form.chemical_name || ''} onChange={handleChange} placeholder="e.g. Sodium Hypochlorite" className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Total Stock</label><input type="number" name="total_stock" value={form.total_stock || ''} onChange={handleChange} className={inputCls} /></div>
                    <div><label className={labelCls}>Remaining Stock</label><input type="number" name="remaining_stock" value={form.remaining_stock || ''} onChange={handleChange} className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Unit of Measure</label>
                    <select name="unit_of_measure" value={form.unit_of_measure || 'Liters'} onChange={handleChange} className={inputCls}>
                      {['Liters','Kg','Grams'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </>
              )}

              {modalType === 'issuance' && (
                <>
                  <div><label className={labelCls}>Chemical</label>
                    <select name="chemical" value={form.chemical || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select chemical</option>
                      {chemicals.map(c => <option key={c.id} value={c.id}>{c.chemical_name} ({fmt(c.remaining_stock)} remaining)</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Tank</label>
                    <select name="tank" value={form.tank || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select tank</option>
                      {tanks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.batch_id}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Issued By</label>
                    <select name="issued_by" value={form.issued_by || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select user</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Quantity</label><input type="number" name="quantity" value={form.quantity || ''} onChange={handleChange} className={inputCls} /></div>
                </>
              )}

              {modalType === 'session' && (
                <>
                  <div><label className={labelCls}>Tank</label>
                    <select name="tank" value={form.tank || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select tank</option>
                      {tanks.map(t => <option key={t.id} value={t.id}>{t.name} — {t.batch_id}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Fabric</label>
                    <select name="fabric" value={form.fabric || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select fabric</option>
                      {fabricStock.map(f => <option key={f.id} value={f.id}>{f.material_type}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Supervisor</label>
                    <select name="supervisor" value={form.supervisor || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select supervisor</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Input Quantity (kg)</label><input type="number" name="input_quantity" value={form.input_quantity || ''} onChange={handleChange} className={inputCls} /></div>
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
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">Complete Session</h3>
            </div>
            <div className="p-5 space-y-4">
              <div><label className={labelCls}>Output Quantity (kg)</label>
                <input type="number" value={completeForm.output_quantity || ''}
                  onChange={e => setCompleteForm({...completeForm, output_quantity: e.target.value})} className={inputCls} />
              </div>
              <div><label className={labelCls}>Waste Quantity (kg)</label>
                <input type="number" value={completeForm.waste_quantity || ''}
                  onChange={e => setCompleteForm({...completeForm, waste_quantity: e.target.value})} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={() => setCompleteModal(null)} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleCompleteSession} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition">Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
