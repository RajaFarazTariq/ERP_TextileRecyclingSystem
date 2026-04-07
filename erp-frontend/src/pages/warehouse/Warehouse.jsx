import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import DateFilter, { buildDateParams } from '../../components/common/DateFilter';
import api from '../../api/axios';

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

const STATUS_COLORS = {
  Received: 'bg-blue-100  dark:bg-blue-900/40  text-blue-700  dark:text-blue-300',
  Pending:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  Approved: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  Rejected: 'bg-red-100   dark:bg-red-900/40   text-red-700   dark:text-red-300',
};

export default function Warehouse() {
  const [activeTab, setActiveTab]       = useState('stock');
  const [stock, setStock]               = useState([]);
  const [vendors, setVendors]           = useState([]);
  const [units, setUnits]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [modalType, setModalType]       = useState('stock');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter]   = useState('');
  const [form, setForm]                 = useState({});
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  // Date filter (only applies to stock tab)
  const [dateFilter, setDateFilter]     = useState({ type: 'all' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const dateParams = buildDateParams(dateFilter);
      const [s, v, u] = await Promise.all([
        api.get(`warehouse/stock/${dateParams}`),
        api.get('warehouse/vendors/'),
        api.get('warehouse/units/'),
      ]);
      setStock(s.data);
      setVendors(v.data);
      setUnits(u.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [dateFilter]);

  const openModal  = (type, item = {}) => { setModalType(type); setForm(item); setError(''); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setForm({}); setError(''); };
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const url = modalType === 'stock' ? 'warehouse/stock/'
                : modalType === 'vendor' ? 'warehouse/vendors/'
                : 'warehouse/units/';
      form.id
        ? await api.put(`${url}${form.id}/`, form)
        : await api.post(url, form);
      await fetchAll(); closeModal();
    } catch (e) {
      setError(e.response?.data ? Object.values(e.response.data).flat().join(' ') : 'Something went wrong.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Are you sure?')) return;
    const url = type === 'stock' ? 'warehouse/stock/'
              : type === 'vendor' ? 'warehouse/vendors/'
              : 'warehouse/units/';
    try { await api.delete(`${url}${id}/`); fetchAll(); }
    catch { alert('Could not delete.'); }
  };

  const filteredStock = stock.filter(s => {
    const matchStatus = !statusFilter || s.status === statusFilter;
    const vendorName  = (s.vendor_name || String(s.vendor) || '').toLowerCase();
    const matchVendor = !vendorFilter  || vendorName.includes(vendorFilter.toLowerCase());
    return matchStatus && matchVendor;
  });

  const tabs = [
    { key: 'stock',   label: 'Stock Entries' },
    { key: 'vendors', label: 'Vendors'        },
    { key: 'units',   label: 'Factory Units'  },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Warehouse"
        subtitle="Manage incoming fabric stock, vendors, and factory units."
        action={
          <button
            onClick={() => openModal(activeTab === 'stock' ? 'stock' : activeTab === 'vendors' ? 'vendor' : 'unit')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add {activeTab === 'stock' ? 'Stock' : activeTab === 'vendors' ? 'Vendor' : 'Unit'}
          </button>
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
        <div className="space-y-4">

          {/* ── Stock Tab ── */}
          {activeTab === 'stock' && (
            <>
              {/* ── Single-row filter bar ── */}
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 px-4 py-3 flex flex-wrap items-center gap-3">

                {/* Status pills */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mr-1">
                    STATUS:
                  </span>
                  {['', 'Received', 'Pending', 'Approved', 'Rejected'].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                        statusFilter === s
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}>
                      {s || 'All'}
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 flex-shrink-0" />

                {/* Date dropdown — compact, no "Period:" label */}
                <div className="flex-shrink-0">
                  <select
                    value={dateFilter.type}
                    onChange={e => {
                      const type = e.target.value;
                      if (type === 'all')         setDateFilter({ type: 'all' });
                      else if (type === 'today')  setDateFilter({ type: 'today' });
                      else if (type === 'week')   setDateFilter({ type: 'week' });
                      else if (type === 'month')  setDateFilter({ type: 'month' });
                      else if (type === 'year')   setDateFilter({ type: 'year' });
                      else                        setDateFilter({ type });
                    }}
                    className="border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                </div>

                {/* Spacer pushes vendor search to the right */}
                <div className="flex-1" />

                {/* Vendor search */}
                <div className="relative flex-shrink-0">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Filter by Vendor"
                    value={vendorFilter}
                    onChange={e => setVendorFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-44"
                  />
                  {vendorFilter && (
                    <button
                      onClick={() => setVendorFilter('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

              </div>

              <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                      <tr>
                        {['#', 'Vendor', 'Fabric Type', 'Vehicle No', 'Weight (kg)', 'Unit', 'Status', 'Date', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                      {filteredStock.length === 0 ? (
                        <tr><td colSpan={9} className="text-center py-10 text-slate-400 dark:text-slate-500">No stock entries found.</td></tr>
                      ) : filteredStock.map((s, i) => (
                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{s.vendor_name || s.vendor}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{s.fabric_type}</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.vehicle_no}</td>
                          <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{Number(s.our_weight).toLocaleString()} kg</td>
                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s.unit_name || s.unit}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100 text-gray-600'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                            {s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openModal('stock', s)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-xs font-medium">Edit</button>
                              <button onClick={() => handleDelete('stock', s.id)} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-xs font-medium">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── Vendors Tab ── */}
          {activeTab === 'vendors' && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      {['#', 'Name', 'Contact', 'Address', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {vendors.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-10 text-slate-400 dark:text-slate-500">No vendors found.</td></tr>
                    ) : vendors.map((v, i) => (
                      <tr key={v.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{v.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{v.contact || '—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{v.address || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openModal('vendor', v)} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                            <button onClick={() => handleDelete('vendor', v.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Factory Units Tab ── */}
          {activeTab === 'units' && (
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>
                      {['#', 'Unit Name', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {units.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-10 text-slate-400 dark:text-slate-500">No factory units found.</td></tr>
                    ) : units.map((u, i) => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i + 1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{u.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openModal('unit', u)} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Edit</button>
                            <button onClick={() => handleDelete('unit', u.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/60">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {form.id ? 'Edit' : 'Add'} {modalType === 'stock' ? 'Stock Entry' : modalType === 'vendor' ? 'Vendor' : 'Factory Unit'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              {modalType === 'stock' && (
                <>
                  <div><label className={labelCls}>Vendor</label>
                    <select name="vendor" value={form.vendor || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select vendor</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Fabric Type</label>
                    <input name="fabric_type" value={form.fabric_type || ''} onChange={handleChange} placeholder="e.g. Cotton White" className={inputCls} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Vendor Weight Slip</label>
                      <input name="vendor_weight_slip" value={form.vendor_weight_slip || ''} onChange={handleChange} className={inputCls} />
                    </div>
                    <div><label className={labelCls}>Vehicle No</label>
                      <input name="vehicle_no" value={form.vehicle_no || ''} onChange={handleChange} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Our Weight (kg)</label>
                      <input type="number" name="our_weight" value={form.our_weight || ''} onChange={handleChange} className={inputCls} />
                    </div>
                    <div><label className={labelCls}>Unloading Weight (kg)</label>
                      <input type="number" name="unloading_weight" value={form.unloading_weight || ''} onChange={handleChange} className={inputCls} />
                    </div>
                  </div>
                  <div><label className={labelCls}>Factory Unit</label>
                    <select name="unit" value={form.unit || ''} onChange={handleChange} className={inputCls}>
                      <option value="">Select unit</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div><label className={labelCls}>Status</label>
                    <select name="status" value={form.status || 'Received'} onChange={handleChange} className={inputCls}>
                      {['Received','Pending','Approved','Rejected'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}

              {modalType === 'vendor' && (
                <>
                  <div><label className={labelCls}>Vendor Name</label>
                    <input name="name" value={form.name || ''} onChange={handleChange} placeholder="e.g. Ali Traders" className={inputCls} />
                  </div>
                  <div><label className={labelCls}>Contact</label>
                    <input name="contact" value={form.contact || ''} onChange={handleChange} className={inputCls} />
                  </div>
                  <div><label className={labelCls}>Address</label>
                    <textarea name="address" value={form.address || ''} onChange={handleChange} rows={2} className={inputCls} />
                  </div>
                </>
              )}

              {modalType === 'unit' && (
                <div><label className={labelCls}>Unit Name</label>
                  <input name="name" value={form.name || ''} onChange={handleChange} placeholder="e.g. Unit 1" className={inputCls} />
                </div>
              )}
            </div>

            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={closeModal}
                className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : (form.id ? 'Update' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}


