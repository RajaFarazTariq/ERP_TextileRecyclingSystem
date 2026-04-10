import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';
import api from '../../api/axios';

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

const int = v => Math.round(Number(v) || 0);
const fmt = v => int(v).toLocaleString();

const STATUS_COLORS = {
  'Available':   'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  'Running':     'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'Cooling':     'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
  'Maintenance': 'bg-red-100    dark:bg-red-900/40    text-red-700    dark:text-red-300',
  'Pending':     'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-300',
  'In Progress': 'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'Completed':   'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  'Failed':      'bg-red-100    dark:bg-red-900/40    text-red-700    dark:text-red-300',
  'On Hold':     'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
};

function KpiTile({ label, value, sub, accent }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Drying() {
  const [activeTab, setActiveTab]     = useState('kpi');
  const [dryers, setDryers]           = useState([]);
  const [sessions, setSessions]       = useState([]);
  const [fabrics, setFabrics]         = useState([]);
  const [decolorSessions, setDecolorSessions] = useState([]);
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [modalType, setModalType]     = useState('session');
  const [form, setForm]               = useState({});
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [completeModal, setCompleteModal] = useState(null);
  const [completeForm, setCompleteForm]   = useState({});

  // Filters
  const [sessionStatusFilter, setSessionStatusFilter] = useState('');
  const [sessionSearch,       setSessionSearch]       = useState('');
  const [sessionDateFilter,   setSessionDateFilter]   = useState({ type: 'all' });
  const [dryerStatusFilter,   setDryerStatusFilter]   = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [dr, sess, fab, dec, usr] = await Promise.all([
        api.get('drying/dryers/'),
        api.get('drying/sessions/'),
        api.get('drying/fabric-ready/'),
        api.get('drying/decolor-sessions-done/'),
        api.get('users/list/'),
      ]);
      setDryers(dr.data);
      setSessions(sess.data);
      setFabrics(fab.data);
      setDecolorSessions(dec.data);
      setUsers(usr.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── KPI calculations ────────────────────────────────────────────────────
  const completedSessions = sessions.filter(s => s.status === 'Completed');
  const activeSessions    = sessions.filter(s => s.status === 'In Progress');
  const totalInput        = sessions.reduce((a, s) => a + int(s.input_quantity),  0);
  const totalOutput       = completedSessions.reduce((a, s) => a + int(s.output_quantity), 0);
  const totalWaste        = completedSessions.reduce((a, s) => a + int(s.waste_quantity),  0);
  const avgEfficiency     = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((a, s) => a + (s.output_efficiency || 0), 0) / completedSessions.length)
    : 0;
  const availableDryers   = dryers.filter(d => d.status === 'Available').length;
  const runningDryers     = dryers.filter(d => d.status === 'Running').length;

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredSessions = sessions.filter(s => {
    const matchStatus = !sessionStatusFilter || s.status === sessionStatusFilter;
    const matchSearch = !sessionSearch ||
      (s.dryer_name     || '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
      (s.fabric_material|| '').toLowerCase().includes(sessionSearch.toLowerCase()) ||
      (s.supervisor_name|| '').toLowerCase().includes(sessionSearch.toLowerCase());
    const matchDate = (() => {
      if (sessionDateFilter.type === 'all') return true;
      const d = new Date(s.created_at);
      const now = new Date();
      if (sessionDateFilter.type === 'today') return d.toDateString() === now.toDateString();
      if (sessionDateFilter.type === 'week')  { const w=new Date(now); w.setDate(now.getDate()-7); return d>=w; }
      if (sessionDateFilter.type === 'month') { const m=new Date(now); m.setMonth(now.getMonth()-1); return d>=m; }
      if (sessionDateFilter.type === 'year')  return d.getFullYear() === now.getFullYear();
      return true;
    })();
    return matchStatus && matchSearch && matchDate;
  });

  const filteredDryers = dryers.filter(d =>
    !dryerStatusFilter || d.status === dryerStatusFilter
  );

  const openModal    = (type, item = {}) => { setModalType(type); setForm(item); setError(''); setShowModal(true); };
  const closeModal   = () => { setShowModal(false); setForm({}); setError(''); };
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    const url = modalType === 'dryer' ? 'drying/dryers/' : 'drying/sessions/';
    try {
      form.id
        ? await api.put(`${url}${form.id}/`, form)
        : await api.post(url, form);
      await fetchAll(); closeModal();
    } catch (e) {
      setError(e.response?.data ? Object.values(e.response.data).flat().join(' ') : 'Something went wrong.');
    } finally { setSaving(false); }
  };

  const handleAction = async (id, action) => {
    try { await api.post(`drying/sessions/${id}/${action}/`); fetchAll(); }
    catch { alert('Action failed.'); }
  };

  const handleDryerAction = async (id, action) => {
    try { await api.post(`drying/dryers/${id}/${action}/`); fetchAll(); }
    catch { alert('Action failed.'); }
  };

  const handleComplete = async () => {
    try {
      await api.post(`drying/sessions/${completeModal}/complete/`, completeForm);
      await fetchAll(); setCompleteModal(null); setCompleteForm({});
    } catch { alert('Could not complete session.'); }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure?')) return;
    const url = type === 'dryer' ? 'drying/dryers/' : 'drying/sessions/';
    try { await api.delete(`${url}${id}/`); fetchAll(); }
    catch { alert('Could not delete.'); }
  };

  const tabs = [
    { key: 'kpi',      label: '📊 Dashboard' },
    { key: 'sessions', label: 'Drying Sessions'  },
    { key: 'dryers',   label: 'Dryers'           },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Drying"
        subtitle="Manage dryers and drying sessions after decolorization."
        action={
          activeTab !== 'kpi' && (
            <button
              onClick={() => openModal(activeTab === 'dryers' ? 'dryer' : 'session')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {activeTab === 'dryers' ? 'Add Dryer' : 'Add Session'}
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-1 mb-5 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === t.key
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (<>

        {/* ── KPI TAB ── */}
        {activeTab === 'kpi' && (
          <div className="space-y-5">

            {/* Stat tiles */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiTile label="Total Sessions"    value={sessions.length}          sub={`${completedSessions.length} completed`}       accent="text-blue-600 dark:text-blue-400" />
              <KpiTile label="Active Sessions"   value={activeSessions.length}    sub={`${runningDryers} dryers running`}             accent="text-purple-600 dark:text-purple-400" />
              <KpiTile label="Avg Efficiency"    value={`${avgEfficiency}%`}      sub="Output / Input (completed)"                   accent="text-emerald-600 dark:text-emerald-400" />
              <KpiTile label="Available Dryers"  value={`${availableDryers} / ${dryers.length}`} sub="Ready for new batches"         accent="text-teal-600 dark:text-teal-400" />
            </div>

            {/* Production summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <KpiTile label="Total Input (kg)"  value={`${fmt(totalInput)} kg`}  sub="Wet fabric received from decolor" accent="text-slate-700 dark:text-slate-200" />
              <KpiTile label="Total Output (kg)" value={`${fmt(totalOutput)} kg`} sub="Dry fabric ready for sale"        accent="text-emerald-600 dark:text-emerald-400" />
              <KpiTile label="Total Waste (kg)"  value={`${fmt(totalWaste)} kg`}  sub="Damaged / discarded during drying" accent="text-amber-600 dark:text-amber-400" />
            </div>

            {/* Dryer status grid */}
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
              <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">Dryer Status Overview</h3>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {['Available','Running','Cooling','Maintenance'].map(st => {
                  const count = dryers.filter(d => d.status === st).length;
                  const colors = { Available:'#10b981', Running:'#3b82f6', Cooling:'#f59e0b', Maintenance:'#ef4444' };
                  return (
                    <div key={st} className="text-center">
                      <div className="text-2xl font-bold" style={{ color: colors[st] }}>{count}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{st}</div>
                    </div>
                  );
                })}
              </div>
              {/* Dryer cards */}
              {dryers.length === 0
                ? <p className="text-slate-400 dark:text-slate-500 text-sm">No dryers configured yet.</p>
                : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {dryers.map(d => (
                      <div key={d.id} className="bg-slate-50 dark:bg-slate-700/40 rounded-lg p-3 border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{d.name}</p>
                          <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || ''}`}>{d.status}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{d.dryer_type}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Cap: {fmt(d.capacity)} kg</p>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Recent sessions */}
            <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5">
              <h3 className="text-slate-700 dark:text-slate-200 font-semibold text-sm mb-4">Recent Sessions</h3>
              {sessions.length === 0
                ? <p className="text-slate-400 dark:text-slate-500 text-sm">No drying sessions yet.</p>
                : (
                  <div className="space-y-2">
                    {sessions.slice(0, 5).map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/40 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.dryer_name} — {s.fabric_material}</p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">
                            {fmt(s.input_quantity)} kg in → {fmt(s.output_quantity)} kg out
                            {s.output_efficiency ? ` (${s.output_efficiency}%)` : ''}
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        )}

        {/* ── SESSIONS TAB ── */}
        {activeTab === 'sessions' && (
          <div className="space-y-3">
            <FilterBar
              statusLabel="STATUS:"
              statuses={['Pending','In Progress','Completed','Failed','On Hold']}
              statusFilter={sessionStatusFilter}
              onStatusChange={setSessionStatusFilter}
              dateValue={sessionDateFilter}
              onDateChange={setSessionDateFilter}
              searchValue={sessionSearch}
              onSearchChange={setSessionSearch}
              searchPlaceholder="Search dryer / fabric..."
            />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      {['#','Dryer','Fabric','Supervisor','Input kg','Output kg','Waste kg','Eff %','Temp °C','Duration','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredSessions.length === 0 ? (
                      <tr><td colSpan={12} className="text-center py-10 text-slate-400 dark:text-slate-500">No drying sessions found.</td></tr>
                    ) : filteredSessions.map((s, i) => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{s.dryer_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.fabric_material || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.supervisor_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{int(s.input_quantity) > 0 ? fmt(s.input_quantity) : '—'}</td>
                        <td className="px-4 py-3 text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">{int(s.output_quantity) > 0 ? fmt(s.output_quantity) : '—'}</td>
                        <td className="px-4 py-3 text-amber-600 dark:text-amber-400 tabular-nums">{int(s.waste_quantity) > 0 ? fmt(s.waste_quantity) : '—'}</td>
                        <td className="px-4 py-3">
                          {s.output_efficiency > 0
                            ? <span className={`font-semibold ${s.output_efficiency >= 85 ? 'text-emerald-600 dark:text-emerald-400' : s.output_efficiency >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                                {s.output_efficiency}%
                              </span>
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{s.temperature_celsius ? `${s.temperature_celsius}°` : '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 tabular-nums">{s.duration_minutes ? `${s.duration_minutes} min` : '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || ''}`}>{s.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {s.status === 'Pending'     && <button onClick={() => handleAction(s.id, 'start')}    className="text-blue-600 dark:text-blue-400 text-xs font-medium">Start</button>}
                            {s.status === 'In Progress' && <button onClick={() => setCompleteModal(s.id)}          className="text-green-600 dark:text-green-400 text-xs font-medium">Complete</button>}
                            <button onClick={() => openModal('session', s)}     className="text-slate-600 dark:text-slate-400 text-xs font-medium">Edit</button>
                            <button onClick={() => handleDelete('session', s.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
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

        {/* ── DRYERS TAB ── */}
        {activeTab === 'dryers' && (
          <div className="space-y-3">
            <FilterBar
              statusLabel="STATUS:"
              statuses={['Available','Running','Cooling','Maintenance']}
              statusFilter={dryerStatusFilter}
              onStatusChange={setDryerStatusFilter}
              showDate={false}
              showSearch={false}
            />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      {['#','Name','Type','Capacity (kg)','Status','Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredDryers.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-slate-400 dark:text-slate-500">No dryers found.</td></tr>
                    ) : filteredDryers.map((d, i) => (
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{d.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.dryer_type}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{fmt(d.capacity)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] || ''}`}>{d.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {d.status !== 'Available'   && <button onClick={() => handleDryerAction(d.id, 'set_available')}   className="text-green-600 dark:text-green-400 text-xs font-medium">Set Available</button>}
                            {d.status !== 'Maintenance' && <button onClick={() => handleDryerAction(d.id, 'set_maintenance')} className="text-amber-600 dark:text-amber-400 text-xs font-medium">Maintenance</button>}
                            <button onClick={() => openModal('dryer', d)}       className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                            <button onClick={() => handleDelete('dryer', d.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
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
      </>)}

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {form.id ? 'Edit' : 'Add'} {modalType === 'dryer' ? 'Dryer' : 'Drying Session'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>}

              {modalType === 'dryer' && (<>
                <div><label className={labelCls}>Dryer Name</label>
                  <input name="name" value={form.name || ''} onChange={handleChange} placeholder="e.g. Dryer D-01" className={inputCls} /></div>
                <div><label className={labelCls}>Type</label>
                  <select name="dryer_type" value={form.dryer_type || 'Tumble'} onChange={handleChange} className={inputCls}>
                    {['Tumble','Conveyor','Chamber'].map(t => <option key={t} value={t}>{t} Dryer</option>)}
                  </select></div>
                <div><label className={labelCls}>Capacity (kg)</label>
                  <input type="number" name="capacity" value={form.capacity || ''} onChange={handleChange} className={inputCls} /></div>
                <div><label className={labelCls}>Status</label>
                  <select name="status" value={form.status || 'Available'} onChange={handleChange} className={inputCls}>
                    {['Available','Running','Cooling','Maintenance'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className={labelCls}>Notes</label>
                  <textarea name="notes" value={form.notes || ''} onChange={handleChange} rows={2} className={inputCls} /></div>
              </>)}

              {modalType === 'session' && (<>
                <div><label className={labelCls}>Dryer</label>
                  <select name="dryer" value={form.dryer || ''} onChange={handleChange} className={inputCls}>
                    <option value="">Select dryer</option>
                    {dryers.filter(d => d.status === 'Available').map(d => (
                      <option key={d.id} value={d.id}>{d.name} — {d.dryer_type} (Cap: {fmt(d.capacity)} kg)</option>
                    ))}
                  </select></div>
                <div><label className={labelCls}>Fabric (from Decolorization)</label>
                  <select name="fabric" value={form.fabric || ''} onChange={handleChange} className={inputCls}>
                    <option value="">Select fabric batch</option>
                    {fabrics.map(f => <option key={f.id} value={f.id}>{f.material_type} ({fmt(f.remaining_quantity)} kg)</option>)}
                  </select></div>
                <div><label className={labelCls}>Decolorization Session (optional)</label>
                  <select name="decolor_session" value={form.decolor_session || ''} onChange={handleChange} className={inputCls}>
                    <option value="">Select session (optional)</option>
                    {decolorSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        Session #{s.id} — {s.fabric__material_type} — {fmt(s.output_quantity)} kg out
                      </option>
                    ))}
                  </select></div>
                <div><label className={labelCls}>Supervisor</label>
                  <select name="supervisor" value={form.supervisor || ''} onChange={handleChange} className={inputCls}>
                    <option value="">Select supervisor</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select></div>
                <div><label className={labelCls}>Input Quantity (kg)</label>
                  <input type="number" name="input_quantity" value={form.input_quantity || ''} onChange={handleChange} className={inputCls} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Temperature (°C)</label>
                    <input type="number" name="temperature_celsius" value={form.temperature_celsius || ''} onChange={handleChange} placeholder="e.g. 80" className={inputCls} /></div>
                  <div><label className={labelCls}>Duration (minutes)</label>
                    <input type="number" name="duration_minutes" value={form.duration_minutes || ''} onChange={handleChange} placeholder="e.g. 90" className={inputCls} /></div>
                </div>
                <div><label className={labelCls}>Status</label>
                  <select name="status" value={form.status || 'Pending'} onChange={handleChange} className={inputCls}>
                    {['Pending','In Progress','Completed','Failed','On Hold'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                <div><label className={labelCls}>Notes</label>
                  <textarea name="notes" value={form.notes || ''} onChange={handleChange} rows={2} className={inputCls} /></div>
              </>)}
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
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">Complete Drying Session</h3>
            </div>
            <div className="p-5 space-y-4">
              <div><label className={labelCls}>Output Quantity (kg)</label>
                <input type="number" value={completeForm.output_quantity || ''}
                  onChange={e => setCompleteForm({ ...completeForm, output_quantity: e.target.value })}
                  placeholder="Dry fabric weight after drying"
                  className={inputCls} /></div>
              <div><label className={labelCls}>Waste Quantity (kg)</label>
                <input type="number" value={completeForm.waste_quantity || ''}
                  onChange={e => setCompleteForm({ ...completeForm, waste_quantity: e.target.value })}
                  placeholder="Damaged / discarded fabric"
                  className={inputCls} /></div>
              <div><label className={labelCls}>Notes</label>
                <textarea value={completeForm.notes || ''}
                  onChange={e => setCompleteForm({ ...completeForm, notes: e.target.value })}
                  rows={2} placeholder="Any observations..."
                  className={inputCls} /></div>
              {completeForm.output_quantity && completeForm.waste_quantity && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-lg px-3 py-2">
                  <p className="text-xs text-blue-600 dark:text-blue-300 font-medium">
                    Moisture loss: ~{fmt(
                      int(sessions.find(s => s.id === completeModal)?.input_quantity || 0)
                      - int(completeForm.output_quantity)
                      - int(completeForm.waste_quantity)
                    )} kg (evaporated)
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={() => { setCompleteModal(null); setCompleteForm({}); }}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleComplete}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition">Mark Complete</button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
