import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Users, Car, DollarSign, Clock, TrendingUp, TrendingDown, Package, AlertCircle, CheckCircle, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR KËTU
import { translations } from '../translations'; 

export default function Dashboard() {
  const navigate = useNavigate();
  const { isOnline } = useSync(); 
  
  // SHTUAR KËTU: Merr gjuhën nga Context-i yt
  const { language } = useLanguage(); 
  const t = translations[language] || translations.en; // Default në anglisht nëse ka ndonjë problem

  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('$');
  
  const [stats, setStats] = useState({
    clientCount: 0, carCount: 0, pendingJobs: 0,
    revenueToday: 0, expensesToday: 0,
    revenueMonth: 0, expensesMonth: 0,
    partsCostMonth: 0, netProfitMonth: 0
  });
  
  const [recentJobs, setRecentJobs] = useState([]);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);

      if (!isOnline) {
        const cachedDash = localStorage.getItem('sonic_dashboard_cache');
        if (cachedDash) {
          const parsedData = JSON.parse(cachedDash);
          setStats(parsedData.stats);
          setChartData(parsedData.chartData);
          setRecentJobs(parsedData.recentJobs);
          setCurrency(parsedData.currency || '$');
        }
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();

        if (profile) {
          const shopId = profile.workshop_id;
          const { data: shop } = await supabase.from('workshops').select('currency').eq('id', shopId).single();
          const currentCurrency = shop?.currency || '$';
          setCurrency(currentCurrency);

          const { count: clientCount } = await supabase.from('clients').select('*', { count: 'exact', head: true }).eq('workshop_id', shopId);
          const { count: carCount } = await supabase.from('cars').select('*', { count: 'exact', head: true }).eq('workshop_id', shopId);
          const { count: pendingJobs } = await supabase.from('services').select('*', { count: 'exact', head: true }).eq('workshop_id', shopId).neq('status', 'Completed');

          const { data: allServices } = await supabase.from('services').select('cost, created_at, service_items(category, price, cost_price, quantity)').eq('workshop_id', shopId);
          const { data: allExpenses } = await supabase.from('expenses').select('amount, expense_date').eq('workshop_id', shopId);
          
          const today = new Date();
          const currentMonthIndex = today.getMonth();
          const currentYear = today.getFullYear();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

          let rToday = 0; let eToday = 0;
          let rMonth = 0; let eMonth = 0; let pCostMonth = 0;

          allServices?.forEach(job => {
            const jobDate = new Date(job.created_at);
            const jobDateStr = job.created_at.split('T')[0]; 
            const cost = Number(job.cost) || 0;
            
            if (jobDateStr === todayStr) { rToday += cost; }

            if (jobDate.getMonth() === currentMonthIndex && jobDate.getFullYear() === currentYear) {
              rMonth += cost;
              job.service_items.forEach(item => {
                if (item.category === 'part') {
                  const qty = Number(item.quantity || 1);
                  pCostMonth += (Number(item.cost_price || 0) * qty); 
                }
              });
            }
          });

          allExpenses?.forEach(exp => {
            const expDate = new Date(exp.expense_date);
            const amt = Number(exp.amount) || 0;

            if (exp.expense_date === todayStr) { eToday += amt; }

            if (expDate.getMonth() === currentMonthIndex && expDate.getFullYear() === currentYear) {
              eMonth += amt;
            }
          });

          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const last6Months = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            last6Months.push({ name: monthNames[d.getMonth()], Revenue: 0, Expenses: 0, monthIndex: d.getMonth(), year: d.getFullYear() });
          }

          allServices?.forEach(job => {
            const d = new Date(job.created_at);
            const match = last6Months.find(m => m.monthIndex === d.getMonth() && m.year === d.getFullYear());
            if (match) match.Revenue += (Number(job.cost) || 0);
          });

          allExpenses?.forEach(exp => {
            const d = new Date(exp.expense_date);
            const match = last6Months.find(m => m.monthIndex === d.getMonth() && m.year === d.getFullYear());
            if (match) match.Expenses += (Number(exp.amount) || 0);
          });

          const { data: recent } = await supabase.from('services').select('id, status, cost, created_at, cars(make, model, plate)').eq('workshop_id', shopId).order('created_at', { ascending: false }).limit(5);

          const finalStats = { 
            clientCount: clientCount || 0, carCount: carCount || 0, pendingJobs: pendingJobs || 0,
            revenueToday: rToday, expensesToday: eToday,
            revenueMonth: rMonth, expensesMonth: eMonth,
            partsCostMonth: pCostMonth, 
            netProfitMonth: (rMonth - pCostMonth - eMonth) 
          };

          const finalRecent = recent || [];

          setStats(finalStats);
          setChartData(last6Months);
          setRecentJobs(finalRecent);

          localStorage.setItem('sonic_dashboard_cache', JSON.stringify({
            stats: finalStats,
            chartData: last6Months,
            recentJobs: finalRecent,
            currency: currentCurrency
          }));
        }
      } catch (error) {
        console.error("Dashboard fetch error (fallback to cache):", error);
        const cachedDash = localStorage.getItem('sonic_dashboard_cache');
        if (cachedDash) {
          const parsedData = JSON.parse(cachedDash);
          setStats(parsedData.stats);
          setChartData(parsedData.chartData);
          setRecentJobs(parsedData.recentJobs);
          setCurrency(parsedData.currency || '$');
        }
      }
      setLoading(false);
    }
    loadDashboardData();
  }, [isOnline]);

  if (loading) return <div className="p-8 flex justify-center items-center h-screen font-bold text-gray-500 animate-pulse">Loading Dashboard...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t.page_title_dashboard}</h1>
          <p className="text-gray-500 text-sm md:text-base mt-1">{t.page_desc_dashboard}</p>
        </div>
        <button onClick={() => navigate('/services')} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold flex justify-center items-center gap-2 shadow-md">
          <TrendingUp size={20} /> {t.new_job}
        </button>
      </div>
      
      {/* --- TODAY'S SNAPSHOT --- */}
      <h2 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">{t.todays_snapshot}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-green-600 mb-1"><TrendingUp size={16}/> <span className="font-bold text-xs uppercase tracking-wider">{t.revenue}</span></div>
          <p className="text-xl md:text-2xl font-black font-mono text-gray-900">{currency}{stats.revenueToday.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-red-500 mb-1"><TrendingDown size={16}/> <span className="font-bold text-xs uppercase tracking-wider">{t.expenses_caps}</span></div>
          <p className="text-xl md:text-2xl font-black font-mono text-gray-900">-{currency}{stats.expensesToday.toFixed(2)}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-orange-500 mb-1"><Clock size={16}/> <span className="font-bold text-xs uppercase tracking-wider">{t.pending_jobs}</span></div>
          <p className="text-xl md:text-2xl font-black text-gray-900">{stats.pendingJobs}</p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-2 text-blue-500 mb-1"><Car size={16}/> <span className="font-bold text-xs uppercase tracking-wider">{t.total_cars}</span></div>
          <p className="text-xl md:text-2xl font-black text-gray-900">{stats.carCount}</p>
        </div>
      </div>

      {/* --- THIS MONTH'S TRUE PROFIT --- */}
      <h2 className="text-sm font-black text-gray-400 uppercase tracking-wider mb-3">{t.this_months_financials}</h2>
      <div className="bg-gray-900 rounded-xl shadow-xl border border-gray-800 p-6 mb-8 flex flex-col lg:flex-row items-center justify-between gap-6 text-white">
        
        <div className="flex items-center gap-4 w-full lg:w-auto">
          <div className="bg-gray-800 p-4 rounded-xl text-green-400"><Wallet size={32} /></div>
          <div>
            <h2 className="text-xl font-black text-white">{t.real_net_profit}</h2>
            <p className="text-sm text-gray-400">{t.real_net_profit_desc}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 w-full lg:w-auto justify-between lg:justify-end sm:text-right">
           <div>
             <p className="text-xs font-bold text-gray-500 uppercase">{language === 'al' ? 'Të Ardhurat Bruto' : 'Gross Revenue'}</p>
             <p className="text-lg font-mono text-gray-300">{currency}{stats.revenueMonth.toFixed(2)}</p>
           </div>
           <div>
             <p className="text-xs font-bold text-red-900 uppercase">{language === 'al' ? 'Kostoja e Pjesëve' : 'Parts Cost'}</p>
             <p className="text-lg font-mono text-red-400">-{currency}{stats.partsCostMonth.toFixed(2)}</p>
           </div>
           <div>
             <p className="text-xs font-bold text-red-900 uppercase">{language === 'al' ? 'Shpenzimet' : 'Shop Expenses'}</p>
             <p className="text-lg font-mono text-red-400">-{currency}{stats.expensesMonth.toFixed(2)}</p>
           </div>
           <div className="sm:pl-6 sm:border-l-2 border-gray-700 pt-4 sm:pt-0">
             <p className="text-xs font-bold text-green-500 uppercase">{t.profit}</p>
             <p className="text-3xl font-mono font-black text-green-400">{currency}{stats.netProfitMonth.toFixed(2)}</p>
           </div>
        </div>
      </div>

      {/* --- CHARTS & RECENT --- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8">
        
        {/* Chart */}
        <div className="xl:col-span-2 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-base md:text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-blue-600" /> {t.revenue_vs_expenses}</h2>
          <div className="h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}} tickFormatter={(value) => `${currency}${value}`} />
                <Tooltip cursor={{fill: '#F3F4F6'}} formatter={(value, name) => [`${currency}${value}`, language === 'al' && name === 'Revenue' ? 'Të ardhurat' : language === 'al' && name === 'Expenses' ? 'Shpenzimet' : name]} />
                <Bar dataKey="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-base md:text-lg font-bold text-gray-800 mb-4 flex items-center gap-2"><Clock size={20} className="text-blue-600" /> {t.recent_jobs}</h2>
          <div className="space-y-3 flex-1 overflow-y-auto">
            {recentJobs.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">{language === 'al' ? 'Nuk ka aktivitet të fundit.' : 'No recent activity.'}</p>
            ) : (
              recentJobs.map(job => (
                <div key={job.id} onClick={() => navigate(`/services?edit=${job.id}`)} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors border border-gray-200">
                  <div className="flex items-center gap-3">
                    {job.status === 'Completed' ? <CheckCircle size={18} className="text-green-500 shrink-0" /> : <AlertCircle size={18} className="text-orange-500 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{job.cars?.make} {job.cars?.model}</p>
                      <p className="text-xs text-gray-500 truncate">{job.cars?.plate}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-mono font-bold text-gray-900">{currency}{job.cost}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}