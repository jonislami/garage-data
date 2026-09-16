import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, Link } from 'react-router-dom';
import { Car, Clock, TrendingUp, TrendingDown, Plus, ArrowRight, Wrench } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, StatusBadge, EmptyState, TableSkeleton } from '../components/ui';
import { formatMoney, formatDate, todayISO, rowDate } from '../lib/format';
import { vehicleName } from '../lib/vehicle';

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  al: ['Jan', 'Shk', 'Mar', 'Pri', 'Maj', 'Qer', 'Kor', 'Gus', 'Sht', 'Tet', 'Nën', 'Dhj'],
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isOnline } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';

  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('€');
  const [stats, setStats] = useState({
    clientCount: 0, carCount: 0, pendingJobs: 0,
    revenueToday: 0, expensesToday: 0, jobsToday: 0,
    revenueMonth: 0, expensesMonth: 0, partsCostMonth: 0, netProfitMonth: 0,
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [chartData, setChartData] = useState([]);

  function applyCache() {
    const cached = localStorage.getItem('sonic_dashboard_cache');
    if (!cached) return;
    try {
      const d = JSON.parse(cached);
      setStats(s => ({ ...s, ...d.stats }));
      setChartData(d.chartData || []);
      setRecentJobs(d.recentJobs || []);
      setCurrency(d.currency || '€');
    } catch { /* ignore broken cache */ }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      if (!isOnline) { applyCache(); setLoading(false); return; }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
        if (!profile) return;
        const shopId = profile.workshop_id;

        const [shopRes, clientsRes, carsRes, pendingRes, servicesRes, expensesRes, recentRes] = await Promise.all([
          supabase.from('workshops').select('currency').eq('id', shopId).single(),
          supabase.from('clients').select('*', { count: 'exact', head: true }).eq('workshop_id', shopId),
          supabase.from('cars').select('*', { count: 'exact', head: true }).eq('workshop_id', shopId),
          supabase.from('services').select('*', { count: 'exact', head: true }).eq('workshop_id', shopId).neq('status', 'Completed'),
          // Revenue = completed jobs only (same rule as the Reports page)
          supabase.from('services').select('cost, service_date, created_at, service_items(category, cost_price, quantity)').eq('workshop_id', shopId).eq('status', 'Completed'),
          supabase.from('expenses').select('amount, expense_date').eq('workshop_id', shopId),
          supabase.from('services')
            .select('id, status, cost, service_date, created_at, cars(make, model, plate, clients(full_name))')
            .eq('workshop_id', shopId)
            .order('service_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })
            .limit(6),
        ]);

        const cur = shopRes.data?.currency || '€';
        setCurrency(cur);

        const now = new Date();
        const todayStr = todayISO(now);
        const sameMonth = d => d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();

        let rToday = 0, eToday = 0, jToday = 0, rMonth = 0, eMonth = 0, pMonth = 0;

        const last6 = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          last6.push({ name: MONTHS[al ? 'al' : 'en'][d.getMonth()], revenue: 0, expenses: 0, m: d.getMonth(), y: d.getFullYear() });
        }
        const bucket = d => d && last6.find(x => x.m === d.getMonth() && x.y === d.getFullYear());

        // Revenue is counted on the job's service date (the date shown on the invoice),
        // not on the date the record was created.
        (servicesRes.data || []).forEach(job => {
          const d = rowDate(job, 'service_date');
          const cost = Number(job.cost) || 0;
          if (d && todayISO(d) === todayStr) { rToday += cost; jToday += 1; }
          if (sameMonth(d)) {
            rMonth += cost;
            (job.service_items || []).forEach(item => {
              if (item.category === 'part') pMonth += Number(item.cost_price || 0) * Number(item.quantity || 1);
            });
          }
          const b = bucket(d); if (b) b.revenue += cost;
        });

        (expensesRes.data || []).forEach(exp => {
          const d = rowDate(exp, 'expense_date');
          const amt = Number(exp.amount) || 0;
          if (exp.expense_date === todayStr) eToday += amt;
          if (sameMonth(d)) eMonth += amt;
          const b = bucket(d); if (b) b.expenses += amt;
        });

        const finalStats = {
          clientCount: clientsRes.count || 0, carCount: carsRes.count || 0, pendingJobs: pendingRes.count || 0,
          revenueToday: rToday, expensesToday: eToday, jobsToday: jToday,
          revenueMonth: rMonth, expensesMonth: eMonth, partsCostMonth: pMonth,
          netProfitMonth: rMonth - pMonth - eMonth,
        };
        const chart = last6.map(({ name, revenue, expenses }) => ({ name, revenue: Math.round(revenue * 100) / 100, expenses: Math.round(expenses * 100) / 100 }));

        setStats(finalStats);
        setChartData(chart);
        setRecentJobs(recentRes.data || []);
        localStorage.setItem('sonic_dashboard_cache', JSON.stringify({
          stats: finalStats, chartData: chart, recentJobs: recentRes.data || [], currency: cur,
        }));
      } catch (error) {
        console.error('Dashboard fetch error (fallback to cache):', error);
        applyCache();
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, language]);

  const money = v => formatMoney(v, currency);
  const hasChartData = chartData.some(m => m.revenue > 0 || m.expenses > 0);

  const tiles = [
    { label: t.revenue, value: money(stats.revenueToday), icon: TrendingUp, hint: al ? `${stats.jobsToday} punë të përfunduara sot` : `${stats.jobsToday} completed job${stats.jobsToday === 1 ? '' : 's'} today`, to: '/services' },
    { label: t.expenses_caps, value: money(stats.expensesToday), icon: TrendingDown, hint: al ? 'Shpenzimet e sotme' : 'Logged today', to: '/expenses' },
    { label: t.pending_jobs, value: stats.pendingJobs, icon: Clock, hint: al ? 'Në pritje ose në proces' : 'Pending or in progress', to: '/services' },
    { label: t.total_cars, value: stats.carCount, icon: Car, hint: al ? `${stats.clientCount} klientë` : `${stats.clientCount} clients`, to: '/cars' },
  ];

  return (
    <div className="page">
      <PageHeader title={t.page_title_dashboard} subtitle={t.page_desc_dashboard}>
        <button onClick={() => navigate('/services?new=1')} className="btn btn-primary">
          <Plus size={16} /> {t.new_job}
        </button>
      </PageHeader>

      <p className="section-label">{t.todays_snapshot}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 keep-cols">
        {tiles.map(tile => (
          <Link key={tile.label} to={tile.to} className="stat group hover:border-gray-300 transition-colors">
            <div className="stat-label"><tile.icon size={14} className="text-gray-400" /> {tile.label}</div>
            <div className="stat-value">{loading ? <span className="skeleton inline-block h-6 w-20 align-middle" /> : tile.value}</div>
            <div className="mt-1 text-xs text-gray-400 group-hover:text-gray-500">{tile.hint}</div>
          </Link>
        ))}
      </div>

      <p className="section-label">{t.this_months_financials}</p>
      <div className="card mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 keep-cols">
          <div className="p-4">
            <p className="stat-label">{al ? 'Të ardhurat bruto' : 'Gross revenue'}</p>
            <p className="stat-value text-xl">{money(stats.revenueMonth)}</p>
          </div>
          <div className="p-4 !border-t-0 lg:!border-t-0">
            <p className="stat-label">{al ? 'Kostoja e pjesëve' : 'Parts cost'}</p>
            <p className="stat-value text-xl text-gray-700">{money(stats.partsCostMonth)}</p>
          </div>
          <div className="p-4">
            <p className="stat-label">{al ? 'Shpenzimet' : 'Shop expenses'}</p>
            <p className="stat-value text-xl text-gray-700">{money(stats.expensesMonth)}</p>
          </div>
          <div className="p-4 bg-gray-50/80">
            <p className="stat-label">{t.real_net_profit}</p>
            <p className={`stat-value text-xl ${stats.netProfitMonth < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{money(stats.netProfitMonth)}</p>
            <p className="mt-1 text-xs text-gray-400">{t.real_net_profit_desc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="card xl:col-span-3">
          <div className="card-header">
            <h2 className="card-title">{t.revenue_vs_expenses}</h2>
          </div>
          <div className="p-4 h-72">
            {!loading && !hasChartData ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                {al ? 'Ende nuk ka të dhëna për këtë periudhë.' : 'No data for this period yet.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="#e3e7ec" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7585', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} width={64} allowDecimals={false}
                    tick={{ fill: '#6b7585', fontSize: 12 }} tickFormatter={v => formatMoney(v, currency).replace(/,00(?=\s|$)/, '')} />
                  <Tooltip
                    cursor={{ fill: '#f1f3f6' }}
                    contentStyle={{ borderRadius: 6, border: '1px solid #e3e7ec', fontSize: 12, boxShadow: '0 4px 12px rgba(16,24,40,.08)' }}
                    formatter={(v, name) => [money(v), name]}
                  />
                  <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar name={al ? 'Të ardhurat' : 'Revenue'} dataKey="revenue" fill="#2c5698" radius={[2, 2, 0, 0]} maxBarSize={28} />
                  <Bar name={al ? 'Shpenzimet' : 'Expenses'} dataKey="expenses" fill="#cdd3db" radius={[2, 2, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card xl:col-span-2 flex flex-col">
          <div className="card-header">
            <h2 className="card-title">{t.recent_jobs}</h2>
            <Link to="/services" className="text-xs font-medium text-blue-700 hover:underline flex items-center gap-1">
              {al ? 'Shiko të gjitha' : 'View all'} <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? <TableSkeleton rows={5} cols={3} /> : recentJobs.length === 0 ? (
            <EmptyState icon={Wrench} title={al ? 'Nuk ka punë ende' : 'No jobs yet'} description={al ? 'Punët e reja do të shfaqen këtu.' : 'New jobs will show up here.'} />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentJobs.map(job => (
                <li key={job.id}>
                  <button onClick={() => navigate(`/services?edit=${job.id}`)} className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{vehicleName(job.cars?.make, job.cars?.model)}</p>
                        {job.cars?.plate && <span className="plate">{job.cars.plate}</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {job.cars?.clients?.full_name || (al ? 'Pa klient' : 'No client')} · {formatDate(job.service_date || job.created_at)}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="text-sm font-mono font-medium text-gray-900">{money(job.cost)}</p>
                      <StatusBadge status={job.status} language={language} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
