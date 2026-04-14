import { useEffect, useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/common/PageHeader';
import FilterBar from '../../components/common/FilterBar';
// buildDateParams no longer needed — date filtering is client-side
import api from '../../api/axios';

const inputCls = 'w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors';
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';
const int = v => Math.round(Number(v) || 0);
const fmtRs = v => `Rs. ${int(v).toLocaleString()}`;

const ORDER_STATUS_COLORS = {
  'Draft':      'bg-slate-100  dark:bg-slate-700     text-slate-600  dark:text-slate-300',
  'Confirmed':  'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'Dispatched': 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'Completed':  'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
  'Cancelled':  'bg-red-100    dark:bg-red-900/40    text-red-700    dark:text-red-300',
};
const PAYMENT_STATUS_COLORS = {
  'Pending': 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  'Partial': 'bg-blue-100  dark:bg-blue-900/40  text-blue-700  dark:text-blue-300',
  'Paid':    'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
};
const DISPATCH_STATUS_COLORS = {
  'Pending':    'bg-amber-100  dark:bg-amber-900/40  text-amber-700  dark:text-amber-300',
  'Loading':    'bg-blue-100   dark:bg-blue-900/40   text-blue-700   dark:text-blue-300',
  'Dispatched': 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  'Delivered':  'bg-green-100  dark:bg-green-900/40  text-green-700  dark:text-green-300',
};

function MetricCard({ label, value, sub, icon, colorClass, badgeText, badgeColor }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-5 flex flex-col gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colorClass.icon}`}>{icon}</div>
        {badgeText && <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColor}`}>{badgeText}</span>}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-2xl font-bold leading-tight ${colorClass.value}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4 flex items-center gap-4">
      <div className="text-2xl">{icon}</div>
      <div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export default function Sales() {
  const [activeTab, setActiveTab]     = useState('dashboard');
  const [orders, setOrders]           = useState([]);
  const [dispatches, setDispatches]   = useState([]);
  const [payments, setPayments]       = useState([]);
  const [fabricStock, setFabricStock] = useState([]);
  const [users, setUsers]             = useState([]);
  const [summary, setSummary]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [modalType, setModalType]     = useState('order');
  const [form, setForm]               = useState({});
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Per-tab filters
  const [orderDateFilter,      setOrderDateFilter]      = useState({ type: 'all' });
  const [orderStatusFilter,    setOrderStatusFilter]    = useState('');
  const [orderPayFilter,       setOrderPayFilter]       = useState('');
  const [buyerSearch,          setBuyerSearch]          = useState('');
  const [dispatchDateFilter,   setDispatchDateFilter]   = useState({ type: 'all' });
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState('');
  const [paymentDateFilter,    setPaymentDateFilter]    = useState({ type: 'all' });
  const [paymentMethodFilter,  setPaymentMethodFilter]  = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Fetch all data without date params — date filtering is done client-side
      // This makes filter changes instant (no network round-trip)
      const [ord, dis, pay, fab, usr, sum] = await Promise.allSettled([
        api.get('sales/orders/'),
        api.get('sales/dispatch/'),
        api.get('sales/payments/'),
        api.get('sorting/fabric-stock/'),
        api.get('users/list/'),
        api.get('sales/orders/summary/'),
      ]);
      if (ord.status === 'fulfilled') setOrders(ord.value.data);
      if (dis.status === 'fulfilled') setDispatches(dis.value.data);
      if (pay.status === 'fulfilled') setPayments(pay.value.data);
      if (fab.status === 'fulfilled') setFabricStock(fab.value.data);
      if (usr.status === 'fulfilled') setUsers(usr.value.data);
      if (sum.status === 'fulfilled') setSummary(sum.value.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Only fetch once on mount — date/status filters work client-side instantly
  useEffect(() => { fetchAll(); }, []);

  // ── Client-side date filter helper ────────────────────────────────────────
  // Runs in memory — zero network calls — instant response
  const matchDate = (dateStr, filter) => {
    if (!filter || filter.type === 'all') return true;
    if (!dateStr) return false;
    const d   = new Date(dateStr);
    const now = new Date();
    const ymd = s => s.toISOString().slice(0, 10);
    if (filter.type === 'today')      return ymd(d) === ymd(now);
    if (filter.type === 'this_week')  { const w = new Date(now); w.setDate(now.getDate() - 7);  return d >= w; }
    if (filter.type === 'this_month') { const m = new Date(now); m.setMonth(now.getMonth() - 1); return d >= m; }
    if (filter.type === 'this_year')  return d.getFullYear() === now.getFullYear();
    if (filter.type === 'year'  && filter.year)  return d.getFullYear() === parseInt(filter.year);
    if (filter.type === 'month' && filter.month) {
      const [fy, fm] = filter.month.split('-').map(Number);
      return d.getFullYear() === fy && d.getMonth() + 1 === fm;
    }
    if (filter.type === 'custom') {
      const start = filter.start ? new Date(filter.start) : null;
      const end   = filter.end   ? new Date(filter.end + 'T23:59:59') : null;
      if (start && d < start) return false;
      if (end   && d > end)   return false;
      return true;
    }
    return true;
  };

  const filteredOrders = orders.filter(o => {
    const matchStatus = !orderStatusFilter || o.status === orderStatusFilter;
    const matchPay    = !orderPayFilter    || o.payment_status === orderPayFilter;
    const matchBuyer  = !buyerSearch       || o.buyer_name?.toLowerCase().includes(buyerSearch.toLowerCase());
    const matchD      = matchDate(o.created_at, orderDateFilter);
    return matchStatus && matchPay && matchBuyer && matchD;
  });
  const filteredDispatches = dispatches.filter(d =>
    (!dispatchStatusFilter || d.dispatch_status === dispatchStatusFilter) &&
    matchDate(d.dispatch_date, dispatchDateFilter)
  );
  const filteredPayments = payments.filter(p =>
    (!paymentMethodFilter || p.payment_method === paymentMethodFilter) &&
    matchDate(p.payment_date, paymentDateFilter)
  );

  const revenueByMonth = (() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const y = d.getFullYear(), m = d.getMonth() + 1;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const mo = orders.filter(o => { const od = new Date(o.created_at); return od.getFullYear()===y && od.getMonth()+1===m; });
      return { label, revenue: mo.reduce((s,o)=>s+int(o.total_price),0), count: mo.length };
    });
  })();
  const maxRevenue = Math.max(...revenueByMonth.map(m => m.revenue), 1);

  const buyerMap = {};
  orders.forEach(o => { if(!buyerMap[o.buyer_name]) buyerMap[o.buyer_name]={rev:0,count:0}; buyerMap[o.buyer_name].rev+=int(o.total_price); buyerMap[o.buyer_name].count+=1; });
  const topBuyers   = Object.entries(buyerMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);
  const maxBuyerRev = topBuyers[0]?.[1].rev || 1;

  const openModal    = (type, item={}) => { setModalType(type); setForm(type==='order'&&!item.id?{status:'Draft',payment_status:'Pending',...item}:item); setError(''); setShowModal(true); };
  const closeModal   = () => { setShowModal(false); setForm({}); setError(''); };
  const handleChange = e => setForm({...form,[e.target.name]:e.target.value});

  const handleSave = async () => {
    setSaving(true); setError('');
    const urls = { order:'sales/orders/', dispatch:'sales/dispatch/', payment:'sales/payments/' };
    try {
      const payload = {...form};
      if (modalType==='order'&&payload.weight_sold&&payload.price_per_kg)
        payload.total_price = String(Math.round(parseFloat(payload.weight_sold)*parseFloat(payload.price_per_kg)*100)/100);
      if (modalType==='order') { payload.status=payload.status||'Draft'; payload.payment_status=payload.payment_status||'Pending'; }
      form.id ? await api.put(`${urls[modalType]}${form.id}/`,payload) : await api.post(urls[modalType],payload);
      await fetchAll(); closeModal();
    } catch(e) { setError(e.response?.data?Object.values(e.response.data).flat().join(' '):'Something went wrong.'); }
    finally { setSaving(false); }
  };

  const handleOrderAction  = async (id,action) => { try { await api.post(`sales/orders/${id}/${action}/`); fetchAll(); } catch { alert('Action failed.'); } };
  const handleMarkDelivered= async (id) => { try { await api.post(`sales/dispatch/${id}/mark_delivered/`); fetchAll(); } catch { alert('Action failed.'); } };
  const handleDelete       = async (type,id) => {
    if (!window.confirm('Are you sure?')) return;
    const urls={order:'sales/orders/',dispatch:'sales/dispatch/',payment:'sales/payments/'};
    try { await api.delete(`${urls[type]}${id}/`); fetchAll(); } catch { alert('Could not delete.'); }
  };

  const tabs = [
    { key:'dashboard', label:'📊 Dashboard' },
    { key:'orders',    label:'Sales Orders' },
    { key:'dispatch',  label:'Dispatch'     },
    { key:'payments',  label:'Payments'     },
  ];

  return (
    <MainLayout>
      <PageHeader
        title="Sales"
        subtitle="Manage sales orders, dispatch tracking, and payments."
        action={activeTab!=='dashboard' && (
          <button onClick={()=>openModal(activeTab==='orders'?'order':activeTab==='dispatch'?'dispatch':'payment')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
            Add {activeTab==='orders'?'Order':activeTab==='dispatch'?'Dispatch':'Payment'}
          </button>
        )}
      />

      <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 p-1 mb-5 w-fit">
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab===t.key?'bg-blue-600 text-white shadow':'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"/></div>
      ) : (<>

        {/* DASHBOARD */}
        {activeTab==='dashboard' && (
          <div className="space-y-6">
            {summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard label="Total Revenue" value={fmtRs(summary.total_revenue)} sub={`${summary.total_orders} orders total`}
                  badgeText="All Time" badgeColor="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                  colorClass={{icon:'bg-emerald-100 dark:bg-emerald-900/30',value:'text-emerald-600 dark:text-emerald-400'}}
                  icon={<svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                />
                <MetricCard label="Amount Collected" value={fmtRs(summary.total_collected)} sub={`${summary.payment_count||0} payments received`}
                  colorClass={{icon:'bg-blue-100 dark:bg-blue-900/30',value:'text-blue-600 dark:text-blue-400'}}
                  icon={<svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>}
                />
                <MetricCard label="Pending Amount" value={fmtRs(summary.pending_amount)} sub={`${summary.pending_payments} orders unpaid`}
                  badgeText={`${Math.round((int(summary.pending_amount)/Math.max(int(summary.total_revenue),1))*100)}% unpaid`}
                  badgeColor="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                  colorClass={{icon:'bg-amber-100 dark:bg-amber-900/30',value:'text-amber-600 dark:text-amber-400'}}
                  icon={<svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                />
                <MetricCard label="Paid Orders" value={summary.paid_orders||0} sub={`of ${summary.total_orders} total`}
                  badgeText={`${Math.round(((summary.paid_orders||0)/Math.max(summary.total_orders,1))*100)}% fulfilled`}
                  badgeColor="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                  colorClass={{icon:'bg-purple-100 dark:bg-purple-900/30',value:'text-purple-600 dark:text-purple-400'}}
                  icon={<svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Revenue chart */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-6">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h3 className="text-slate-800 dark:text-slate-100 font-bold text-base">Revenue Trend</h3>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Last 6 months &middot; hover for details</p>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2.5 py-1 rounded-full">
                    {new Date(new Date().getFullYear(),new Date().getMonth()-5).toLocaleDateString('en-US',{month:'short'})} &mdash; {new Date().toLocaleDateString('en-US',{month:'short',year:'numeric'})}
                  </span>
                </div>
                <div className="flex items-end gap-2 mt-6" style={{height:'140px'}}>
                  {revenueByMonth.map(m=>(
                    <div key={m.label} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                      <div className="w-full flex flex-col items-center">
                        <div className="w-full bg-blue-500 dark:bg-blue-600 rounded-t-lg hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors relative cursor-default"
                          style={{height:`${Math.max((m.revenue/maxRevenue)*110,m.revenue>0?5:0)}px`,minHeight:m.revenue>0?'5px':'2px'}}
                          title={`${m.label}: Rs. ${m.revenue.toLocaleString()} - ${m.count} orders`}>
                          <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                            <p className="font-semibold">{fmtRs(m.revenue)}</p>
                            <p className="text-slate-300">{m.count} orders</p>
                          </div>
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{m.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block"/>
                  <span className="text-xs text-slate-400 dark:text-slate-500">Monthly Revenue (Rs.)</span>
                </div>
              </div>

              {/* Top buyers */}
              <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-6">
                <h3 className="text-slate-800 dark:text-slate-100 font-bold text-base mb-1">Top Buyers</h3>
                <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">By total revenue</p>
                {topBuyers.length===0
                  ? <p className="text-slate-400 dark:text-slate-500 text-sm">No data yet.</p>
                  : topBuyers.map(([name,d],i)=>(
                    <div key={name} className="mb-3">
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-400 w-4">#{i+1}</span>
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[110px]">{name}</span>
                        </div>
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtRs(d.rev)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full" style={{width:`${(d.rev/maxBuyerRev)*100}%`}}/>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>

            {summary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatBox label="Total Orders"     value={summary.total_orders||0}     icon="📋" color="text-slate-800 dark:text-slate-100"/>
                <StatBox label="Completed Orders" value={summary.completed_orders||0} icon="✅" color="text-emerald-600 dark:text-emerald-400"/>
                <StatBox label="Pending Payments" value={summary.pending_payments||0} icon="⏳" color="text-amber-600 dark:text-amber-400"/>
                <StatBox label="Total Payments"   value={summary.payment_count||0}    icon="💳" color="text-blue-600 dark:text-blue-400"/>
              </div>
            )}

            {/* Order status breakdown */}
            <div className="bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 p-6">
              <h3 className="text-slate-800 dark:text-slate-100 font-bold text-base mb-4">Order Status Breakdown</h3>
              <div className="grid grid-cols-5 gap-3">
                {[
                  {st:'Draft',      bar:'bg-slate-300 dark:bg-slate-600',  txt:'text-slate-600 dark:text-slate-300'},
                  {st:'Confirmed',  bar:'bg-blue-500',                     txt:'text-blue-600 dark:text-blue-400'},
                  {st:'Dispatched', bar:'bg-purple-500',                   txt:'text-purple-600 dark:text-purple-400'},
                  {st:'Completed',  bar:'bg-emerald-500',                  txt:'text-emerald-600 dark:text-emerald-400'},
                  {st:'Cancelled',  bar:'bg-red-400',                      txt:'text-red-600 dark:text-red-400'},
                ].map(({st,bar,txt})=>{
                  const count = orders.filter(o=>o.status===st).length;
                  const pct   = orders.length>0?Math.round((count/orders.length)*100):0;
                  return (
                    <div key={st} className="text-center">
                      <p className={`text-2xl font-bold ${txt}`}>{count}</p>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1 mb-1">
                        <div className={`h-full ${bar} rounded-full`} style={{width:`${pct}%`}}/>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{st}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab==='orders' && (
          <div className="space-y-3">
            <FilterBar
              searchPlaceholder="Search buyer..."
              searchValue={buyerSearch}
              onSearchChange={setBuyerSearch}
              typeLabel="All orders"
              types={['Draft','Confirmed','Dispatched','Completed','Cancelled']}
              typeFilter={orderStatusFilter}
              onTypeChange={setOrderStatusFilter}
              statusLabel="All payment"
              statuses={['Pending','Partial','Paid']}
              statusFilter={orderPayFilter}
              onStatusChange={setOrderPayFilter}
              dateValue={orderDateFilter}
              onDateChange={setOrderDateFilter}
              showDate={true}
            />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#','Buyer','Contact','Quality','Weight','Price/kg','Total','Payment','Status','Actions'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredOrders.length===0?(
                      <tr><td colSpan={10} className="text-center py-10 text-slate-400 dark:text-slate-500">No orders found.</td></tr>
                    ):filteredOrders.map((o,i)=>(
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">#{o.id}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{o.buyer_name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{o.buyer_contact||'—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-xs">{o.fabric_quality||'—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs tabular-nums">{Number(o.weight_sold).toLocaleString()} kg</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 text-xs tabular-nums">Rs. {Number(o.price_per_kg).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200 text-xs tabular-nums">Rs. {Number(o.total_price).toLocaleString()}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_COLORS[o.payment_status]}`}>{o.payment_status}</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status]}`}>{o.status}</span></td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {o.status==='Draft'     && <button onClick={()=>handleOrderAction(o.id,'confirm')} className="text-blue-600 dark:text-blue-400 text-xs font-medium">Confirm</button>}
                            {o.status==='Confirmed' && <button onClick={()=>openModal('dispatch',{sales_order:o.id})} className="text-purple-600 dark:text-purple-400 text-xs font-medium">Dispatch</button>}
                            {o.status==='Confirmed' && <button onClick={()=>handleOrderAction(o.id,'cancel')} className="text-amber-600 dark:text-amber-400 text-xs font-medium">Cancel</button>}
                            <button onClick={()=>openModal('order',o)} className="text-slate-600 dark:text-slate-400 text-xs font-medium">Edit</button>
                            <button onClick={()=>handleDelete('order',o.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
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

        {/* DISPATCH TAB */}
        {activeTab==='dispatch' && (
          <div className="space-y-4">
            <FilterBar
              statusLabel="STATUS:"
              statuses={['Pending','Loading','Dispatched','Delivered']}
              statusFilter={dispatchStatusFilter} onStatusChange={setDispatchStatusFilter}
              dateValue={dispatchDateFilter} onDateChange={setDispatchDateFilter}
              showSearch={false}
            />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#','Order','Vehicle','Driver','Weight','Status','Date','Actions'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredDispatches.length===0?(
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400 dark:text-slate-500">No dispatches found.</td></tr>
                    ):filteredDispatches.map((d,i)=>(
                      <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i+1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{d.order_buyer||`#${d.sales_order}`}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{d.vehicle_number}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.driver_name||'—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300 tabular-nums">{Number(d.dispatched_weight).toLocaleString()} kg</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DISPATCH_STATUS_COLORS[d.dispatch_status]}`}>{d.dispatch_status}</span></td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{new Date(d.dispatch_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {d.dispatch_status!=='Delivered' && <button onClick={()=>handleMarkDelivered(d.id)} className="text-green-600 dark:text-green-400 text-xs font-medium">Delivered</button>}
                            <button onClick={()=>handleDelete('dispatch',d.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button>
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

        {/* PAYMENTS TAB */}
        {activeTab==='payments' && (
          <div className="space-y-4">
            <FilterBar
              statusLabel="METHOD:"
              statuses={['Cash','Bank Transfer','Cheque','Online Transfer']}
              statusFilter={paymentMethodFilter} onStatusChange={setPaymentMethodFilter}
              dateValue={paymentDateFilter} onDateChange={setPaymentDateFilter}
              showSearch={false}
            />
            <div className="bg-white dark:bg-slate-800/80 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700/60 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700/60">
                    <tr>{['#','Order','Amount','Method','Reference','Received By','Date','Actions'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {filteredPayments.length===0?(
                      <tr><td colSpan={8} className="text-center py-10 text-slate-400 dark:text-slate-500">No payments found.</td></tr>
                    ):filteredPayments.map((p,i)=>(
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{i+1}</td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">#{p.sales_order}</td>
                        <td className="px-4 py-3 font-medium text-emerald-600 dark:text-emerald-400 tabular-nums">Rs. {Number(p.amount).toLocaleString()}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.payment_method}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{p.reference_number||'—'}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{p.received_by_name||'—'}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{new Date(p.payment_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3"><button onClick={()=>handleDelete('payment',p.id)} className="text-red-500 dark:text-red-400 text-xs font-medium">Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </>)}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700/60 sticky top-0 bg-white dark:bg-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">
                {form.id?'Edit':'Add'} {modalType==='order'?'Sales Order':modalType==='dispatch'?'Dispatch':'Payment'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/50 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{error}</div>}

              {modalType==='order' && (<>
                <div><label className={labelCls}>Buyer Name <span className="text-red-500">*</span></label><input name="buyer_name" value={form.buyer_name||''} onChange={handleChange} placeholder="e.g. Karachi Textiles" className={inputCls}/></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Buyer Contact</label><input name="buyer_contact" value={form.buyer_contact||''} onChange={handleChange} className={inputCls}/></div>
                  <div><label className={labelCls}>Fabric Quality</label><input name="fabric_quality" value={form.fabric_quality||''} onChange={handleChange} placeholder="e.g. Grade A" className={inputCls}/></div>
                </div>
                <div><label className={labelCls}>Fabric</label>
                  <select name="fabric" value={form.fabric||''} onChange={handleChange} className={inputCls}>
                    <option value="">Select fabric</option>
                    {fabricStock.map(f=><option key={f.id} value={f.id}>{f.material_type}</option>)}
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Weight Sold (kg) <span className="text-red-500">*</span></label><input type="number" name="weight_sold" value={form.weight_sold||''} onChange={handleChange} className={inputCls}/></div>
                  <div><label className={labelCls}>Price per kg (Rs.) <span className="text-red-500">*</span></label><input type="number" name="price_per_kg" value={form.price_per_kg||''} onChange={handleChange} className={inputCls}/></div>
                </div>
                {form.weight_sold&&form.price_per_kg&&(
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700/50 rounded-lg px-3 py-2">
                    <p className="text-sm text-green-700 dark:text-green-300 font-medium">Total: Rs. {(parseFloat(form.weight_sold||0)*parseFloat(form.price_per_kg||0)).toLocaleString()}</p>
                  </div>
                )}
                <div><label className={labelCls}>Created By <span className="text-red-500">*</span></label>
                  <select name="created_by" value={form.created_by||''} onChange={handleChange} className={inputCls}>
                    <option value="">Select user</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Order Status</label>
                    <select name="status" value={form.status||'Draft'} onChange={handleChange} className={inputCls}>
                      {['Draft','Confirmed','Dispatched','Completed','Cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div><label className={labelCls}>Payment Status</label>
                    <select name="payment_status" value={form.payment_status||'Pending'} onChange={handleChange} className={inputCls}>
                      {['Pending','Partial','Paid'].map(s=><option key={s} value={s}>{s}</option>)}
                    </select></div>
                </div>
                <div><label className={labelCls}>Notes</label><textarea name="notes" value={form.notes||''} onChange={handleChange} rows={2} className={inputCls}/></div>
              </>)}

              {modalType==='dispatch' && (<>
                <div><label className={labelCls}>Sales Order <span className="text-red-500">*</span></label>
                  <select name="sales_order" value={form.sales_order||''} onChange={handleChange} className={inputCls}>
                    <option value="">Select order</option>
                    {orders.map(o=><option key={o.id} value={o.id}>#{o.id} — {o.buyer_name}</option>)}
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Vehicle Number <span className="text-red-500">*</span></label><input name="vehicle_number" value={form.vehicle_number||''} onChange={handleChange} className={inputCls}/></div>
                  <div><label className={labelCls}>Driver Name</label><input name="driver_name" value={form.driver_name||''} onChange={handleChange} className={inputCls}/></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Driver Contact</label><input name="driver_contact" value={form.driver_contact||''} onChange={handleChange} className={inputCls}/></div>
                  <div><label className={labelCls}>Dispatched Weight (kg) <span className="text-red-500">*</span></label><input type="number" name="dispatched_weight" value={form.dispatched_weight||''} onChange={handleChange} className={inputCls}/></div>
                </div>
                <div><label className={labelCls}>Dispatched By <span className="text-red-500">*</span></label>
                  <select name="dispatched_by" value={form.dispatched_by||''} onChange={handleChange} className={inputCls}>
                    <option value="">Select user</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}
                  </select></div>
              </>)}

              {modalType==='payment' && (<>
                <div><label className={labelCls}>Sales Order <span className="text-red-500">*</span></label>
                  <select name="sales_order" value={form.sales_order||''} onChange={handleChange} className={inputCls}>
                    <option value="">Select order</option>
                    {orders.map(o=><option key={o.id} value={o.id}>#{o.id} — {o.buyer_name} (Rs. {Number(o.total_price).toLocaleString()})</option>)}
                  </select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Amount (Rs.) <span className="text-red-500">*</span></label><input type="number" name="amount" value={form.amount||''} onChange={handleChange} className={inputCls}/></div>
                  <div><label className={labelCls}>Payment Method</label>
                    <select name="payment_method" value={form.payment_method||'Cash'} onChange={handleChange} className={inputCls}>
                      {['Cash','Bank Transfer','Cheque','Online Transfer'].map(m=><option key={m} value={m}>{m}</option>)}
                    </select></div>
                </div>
                <div><label className={labelCls}>Reference Number</label><input name="reference_number" value={form.reference_number||''} onChange={handleChange} placeholder="Cheque/transfer number" className={inputCls}/></div>
                <div><label className={labelCls}>Received By <span className="text-red-500">*</span></label>
                  <select name="received_by" value={form.received_by||''} onChange={handleChange} className={inputCls}>
                    <option value="">Select user</option>
                    {users.map(u=><option key={u.id} value={u.id}>{u.username}</option>)}
                  </select></div>
              </>)}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200 dark:border-slate-700/60">
              <button onClick={closeModal} className="flex-1 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
                {saving?<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"/>Saving...</>:(form.id?'Update':'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
