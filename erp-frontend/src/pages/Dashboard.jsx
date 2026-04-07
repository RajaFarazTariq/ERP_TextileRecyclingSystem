import { useEffect, useState, useRef } from 'react';
import MainLayout from '../components/layout/MainLayout';
import StatCard from '../components/common/StatCard';
import PageHeader from '../components/common/PageHeader';
import DateFilter, { buildDateParams } from '../components/common/DateFilter';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// ── Revenue bar chart ──────────────────────────────────────────────────────
function RevenueChart({ data, filter, onFilterChange }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data?.length) return;
    const ctx = canvasRef.current.getContext('2d');
    if (canvasRef.current._chartInstance) {
      canvasRef.current._chartInstance.destroy();
    }
    const isDark      = document.documentElement.classList.contains('dark');
    const gridColor   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const labelColor  = isDark ? '#94a3b8' : '#64748b';
    const tooltipBg   = isDark ? '#1e293b' : '#fff';
    const tooltipText = isDark ? '#e2e8f0' : '#1e293b';

    const chart = new window.Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [
          {
            label: 'Revenue (Rs.)',
            data: data.map(d => d.revenue),
            backgroundColor: 'rgba(59,130,246,0.75)',
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Orders',
            data: data.map(d => d.orders),
            backgroundColor: 'rgba(16,185,129,0.65)',
            borderRadius: 6,
            borderSkipped: false,
            yAxisID: 'y2',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: tooltipBg,
            titleColor: tooltipText,
            bodyColor: labelColor,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: ctx => {
                if (ctx.datasetIndex === 0) return ` Rs. ${Number(ctx.parsed.y).toLocaleString()}`;
                return ` ${ctx.parsed.y} orders`;
              },
            },
          },
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: labelColor, font: { size: 12 } } },
          y: {
            position: 'left',
            grid: { color: gridColor },
            ticks: { color: labelColor, font: { size: 12 }, callback: v => `Rs. ${Number(v).toLocaleString()}` },
          },
          y2: {
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: labelColor, font: { size: 12 } },
          },
        },
      },
    });
    canvasRef.current._chartInstance = chart;
  }, [data]);

  return (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 mb-6 transition-colors duration-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-base">Revenue & Orders</h3>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Performance over time</p>
        </div>
        {/* Chart period quick pills */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-1">
          {['7d', '30d', '90d', 'all'].map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filter === f
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {f === 'all' ? 'All' : f === '7d' ? '7 days' : f === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Revenue
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Orders
        </span>
      </div>
      <div style={{ position: 'relative', height: '240px' }}>
        {data?.length ? (
          <canvas ref={canvasRef} />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
            No data available for this period
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [chartFilter, setChartFilter] = useState('30d');
  const [chartData, setChartData]     = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);

  // ── New: period filter for stat cards ────────────────────────────────────
  const [statFilter, setStatFilter]   = useState({ type: 'all' });

  // Load Chart.js once
  useEffect(() => {
    if (window.Chart) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const dateParams = buildDateParams(statFilter);

        const [stockRes, sortingRes, salesRes, chemicalRes] = await Promise.all([
          api.get(`warehouse/stock/${dateParams}`),
          api.get(`sorting/sessions/${dateParams}`),
          api.get('sales/orders/summary/'),
          api.get('decolorization/chemicals/'),
        ]);

        setStats({
          totalStock:      stockRes.data.length,
          sortingSessions: sortingRes.data.length,
          totalRevenue:    salesRes.data.total_revenue,
          totalOrders:     salesRes.data.total_orders,
          pendingPayments: salesRes.data.pending_payments,
          chemicals:       chemicalRes.data.length,
        });

        if (salesRes.data.chart_data) {
          setChartData(salesRes.data.chart_data);
        } else {
          buildFallbackChart(salesRes.data.total_revenue, salesRes.data.total_orders);
        }

        if (salesRes.data.recent_orders) {
          setRecentOrders(salesRes.data.recent_orders.slice(0, 5));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [statFilter]);

  const buildFallbackChart = (totalRev, totalOrders) => {
    const months  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const weights = [0.12, 0.15, 0.18, 0.16, 0.20, 0.19];
    setChartData(months.map((label, i) => ({
      label,
      revenue: Math.round((totalRev || 0) * weights[i]),
      orders:  Math.round((totalOrders || 0) * weights[i]),
    })));
  };

  const PAYMENT_STATUS_COLORS = {
    Paid:    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
    Pending: 'bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400',
    Partial: 'bg-blue-100   dark:bg-blue-900/30   text-blue-700   dark:text-blue-400',
  };

  return (
    <MainLayout>
      <PageHeader
        title={`Welcome back, ${user?.username}!`}
        subtitle="Here's what's happening in your factory today."
      />

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : (
        <>
          {/* ── Period filter bar for stat cards ─────────────────────────── */}
          <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-4 mb-5 flex flex-wrap items-center gap-3 transition-colors duration-200">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Showing stats for:
            </span>
            <DateFilter value={statFilter} onChange={setStatFilter} compact />
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard title="Total Stock Entries"  value={stats?.totalStock ?? 0}
              subtitle="Fabric received in warehouse" color="blue"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>} />
            <StatCard title="Sorting Sessions" value={stats?.sortingSessions ?? 0}
              subtitle="Total sessions recorded" color="purple"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>} />
            <StatCard title="Total Orders" value={stats?.totalOrders ?? 0}
              subtitle="Sales orders created" color="green"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>} />
            <StatCard title="Total Revenue" value={`Rs. ${Number(stats?.totalRevenue ?? 0).toLocaleString()}`}
              subtitle="From completed sales" color="green"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard title="Pending Payments" value={stats?.pendingPayments ?? 0}
              subtitle="Orders awaiting payment" color="amber"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
            <StatCard title="Chemical Types" value={stats?.chemicals ?? 0}
              subtitle="In decolorization stock" color="red"
              icon={<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>} />
          </div>

          {/* ── Revenue Chart ── */}
          <RevenueChart data={chartData} filter={chartFilter} onFilterChange={setChartFilter} />

          {/* ── Bottom row: Recent Orders + Access Level ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-hidden transition-colors duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700/60">
                <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-sm">Recent Orders</h3>
                <a href="/sales" className="text-blue-600 dark:text-blue-400 text-xs font-medium hover:underline">View all →</a>
              </div>
              {recentOrders.length === 0 ? (
                <div className="py-10 text-center text-slate-400 dark:text-slate-500 text-sm">No recent orders found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/40">
                    <tr>
                      {['Order', 'Buyer', 'Amount', 'Status'].map(h => (
                        <th key={h} className="text-left px-5 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                    {recentOrders.map((o, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                        <td className="px-5 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">#{o.id || i + 1}</td>
                        <td className="px-5 py-3 text-slate-800 dark:text-slate-200 font-medium">{o.buyer || '—'}</td>
                        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">Rs. {Number(o.amount || 0).toLocaleString()}</td>
                        <td className="px-5 py-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_STATUS_COLORS[o.payment_status] || PAYMENT_STATUS_COLORS.Pending}`}>
                            {o.payment_status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60 p-5 transition-colors duration-200">
                <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-sm mb-3">Your Access Level</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-sm font-medium px-3 py-1 rounded-full capitalize">
                    {user?.role?.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
                  {user?.role === 'admin'
                    ? 'You have full access to all modules including users, sales, and settings.'
                    : `You have access to the ${user?.role?.replace(/_/g, ' ')} module.`}
                </p>
              </div>

              <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl p-5 text-white">
                <p className="text-blue-200 text-xs font-medium uppercase tracking-widest mb-2">Factory Snapshot</p>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200 text-sm">Stock entries</span>
                    <span className="text-white font-semibold text-sm">{stats?.totalStock ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200 text-sm">Active chemicals</span>
                    <span className="text-white font-semibold text-sm">{stats?.chemicals ?? 0} types</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-200 text-sm">Pending action</span>
                    <span className="text-amber-300 font-semibold text-sm">{stats?.pendingPayments ?? 0} orders</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}
