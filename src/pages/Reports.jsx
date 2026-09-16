import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { formatMoney, formatDate } from '../lib/format';
import { vehicleName } from '../lib/vehicle';
import { CalendarDays, Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Wrench, Receipt, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#2c5698', '#5e8bc9', '#8fb0dc', '#3a424e', '#6b7585', '#98a2b0', '#b45309', '#0f766e', '#cdd3db'];

export default function Reports() {
  const { isOnline } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [services, setServices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('€');
  
  const [viewMode, setViewMode] = useState('daily'); 
  const [targetDate, setTargetDate] = useState(new Date());

  const monthNamesAl = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonths = language === 'al' ? monthNamesAl : monthNamesEn;

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedServices = localStorage.getItem('sonic_services_cache');
      const cachedExpenses = localStorage.getItem('sonic_expenses_cache');
      
      if (cachedServices) setServices(JSON.parse(cachedServices));
      if (cachedExpenses) setExpenses(JSON.parse(cachedExpenses));
      
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();

      if (profile) {
        const { data: shop } = await supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single();
        setCurrency(shop?.currency || '€');

        const { data: srvData } = await supabase.from('services')
          .select('*, cars(make, model, plate)')
          .eq('workshop_id', profile.workshop_id)
          .eq('status', 'Completed')
          .order('created_at', { ascending: false });
        setServices(srvData || []);
        localStorage.setItem('sonic_services_cache', JSON.stringify(srvData || []));

        const { data: expData } = await supabase.from('expenses')
          .select('*')
          .eq('workshop_id', profile.workshop_id)
          .order('expense_date', { ascending: false });
        setExpenses(expData || []);
        localStorage.setItem('sonic_expenses_cache', JSON.stringify(expData || []));
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  }

  const nextPeriod = () => {
    const newDate = new Date(targetDate);
    if (viewMode === 'daily') newDate.setDate(newDate.getDate() + 1);
    else newDate.setMonth(newDate.getMonth() + 1);
    setTargetDate(newDate);
  };

  const prevPeriod = () => {
    const newDate = new Date(targetDate);
    if (viewMode === 'daily') newDate.setDate(newDate.getDate() - 1);
    else newDate.setMonth(newDate.getMonth() - 1);
    setTargetDate(newDate);
  };

  const goToday = () => setTargetDate(new Date());

  const dateTitle = viewMode === 'daily' 
    ? `${targetDate.getDate()} ${currentMonths[targetDate.getMonth()]} ${targetDate.getFullYear()}`
    : `${currentMonths[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

  const filteredServices = services.filter(s => {
    const d = new Date(s.service_date || s.created_at);
    if (viewMode === 'daily') {
      return d.getDate() === targetDate.getDate() && d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
    } else {
      return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
    }
  });

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.expense_date);
    if (viewMode === 'daily') {
      return d.getDate() === targetDate.getDate() && d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
    } else {
      return d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear();
    }
  });

  const totalRevenue = filteredServices.reduce((sum, s) => sum + Number(s.cost || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const expenseCategories = {};
  filteredExpenses.forEach(e => {
    const cat = e.category || 'Other';
    expenseCategories[cat] = (expenseCategories[cat] || 0) + Number(e.amount || 0);
  });
  const pieChartData = Object.keys(expenseCategories).map(key => ({
    name: key,
    value: expenseCategories[key]
  })).filter(data => data.value > 0);

  let barChartData = [];
  if (viewMode === 'monthly') {
    const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      barChartData.push({ name: i.toString(), Revenue: 0, Expenses: 0, day: i });
    }
    
    services.forEach(s => {
      const d = new Date(s.service_date || s.created_at);
      if (d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear()) {
        const dayMatch = barChartData.find(td => td.day === d.getDate());
        if (dayMatch) dayMatch.Revenue += Number(s.cost || 0);
      }
    });
    expenses.forEach(e => {
       const d = new Date(e.expense_date);
       if (d.getMonth() === targetDate.getMonth() && d.getFullYear() === targetDate.getFullYear()) {
        const dayMatch = barChartData.find(td => td.day === d.getDate());
        if (dayMatch) dayMatch.Expenses += Number(e.amount || 0);
      }
    });
  } else {
    for(let i = 6; i >= 0; i--) {
      const d = new Date(targetDate);
      d.setDate(d.getDate() - i);
      barChartData.push({ 
         name: d.toLocaleDateString(language === 'al' ? 'sq-AL' : 'en-US', { weekday: 'short' }), 
         dateStr: d.toDateString(),
         Revenue: 0, 
         Expenses: 0 
      });
    }
    services.forEach(s => {
      const dStr = new Date(s.service_date || s.created_at).toDateString();
      const match = barChartData.find(td => td.dateStr === dStr);
      if(match) match.Revenue += Number(s.cost || 0);
    });
    expenses.forEach(e => {
      const dStr = new Date(e.expense_date).toDateString();
      const match = barChartData.find(td => td.dateStr === dStr);
      if(match) match.Expenses += Number(e.amount || 0);
    });
  }

  const categoryTranslations = {
    'Rent': language === 'al' ? 'Qiraja' : 'Rent',
    'Electricity': language === 'al' ? 'Energjia Elektrike' : 'Electricity',
    'Water': language === 'al' ? 'Uji' : 'Water',
    'Wifi / Phone': language === 'al' ? 'Wifi / Telefoni' : 'Wifi / Phone',
    'Tools & Equipment': language === 'al' ? 'Mjete & Pajisje' : 'Tools & Equipment',
    'Food / Meals': language === 'al' ? 'Ushqim / Vakte' : 'Food / Meals',
    'Marketing': language === 'al' ? 'Marketing' : 'Marketing',
    'Maintenance': language === 'al' ? 'Mirëmbajtje' : 'Maintenance',
    'Other': language === 'al' ? 'Tjetër' : 'Other'
  };

  return (
    <div className="page overflow-x-hidden">
      
      {/* HEADER & TOGGLE */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{language === 'al' ? 'Raportet financiare' : 'Financial reports'}</h1>
          <p className="page-subtitle">{language === 'al' ? 'Pasqyrë e detajuar e të ardhurave dhe shpenzimeve' : 'Detailed overview of income and expenses'}</p>
        </div>
        
        <div className="flex bg-gray-100 border border-gray-200 p-0.5 rounded-md w-full sm:w-auto justify-center">
          <button onClick={() => setViewMode('daily')} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-8 px-3 md:px-4 rounded font-medium text-[13px] transition-colors ${viewMode === 'daily' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <CalendarDays size={15}/> <span>{language === 'al' ? 'Ditor' : 'Daily'}</span>
          </button>
          <button onClick={() => setViewMode('monthly')} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-8 px-3 md:px-4 rounded font-medium text-[13px] transition-colors ${viewMode === 'monthly' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Calendar size={15}/> <span>{language === 'al' ? 'Mujor' : 'Monthly'}</span>
          </button>
        </div>
      </div>

      {/* DATE NAVIGATOR - RREGULLUAR PER RESPONSIVE */}
      <div className="flex flex-col sm:flex-row items-center gap-2 mb-5 w-full md:w-fit">
        <div className="flex items-center justify-between w-full sm:w-auto gap-2 md:gap-4">
          <button onClick={prevPeriod} className="btn btn-secondary px-2"><ChevronLeft size={16}/></button>
          <span className="text-sm font-semibold text-gray-900 min-w-[150px] text-center">{dateTitle}</span>
          <button onClick={nextPeriod} className="btn btn-secondary px-2"><ChevronRight size={16}/></button>
        </div>
        <button onClick={goToday} className="btn btn-secondary w-full sm:w-auto">
          {language === 'al' ? (viewMode === 'daily' ? 'Sot' : 'Ky Muaj') : (viewMode === 'daily' ? 'Today' : 'This Month')}
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="stat">
          <p className="stat-label"><TrendingUp size={14} className="text-gray-400" /> {language === 'al' ? 'Të ardhurat' : 'Revenue'}</p>
          <p className="stat-value">{formatMoney(totalRevenue, currency)}</p>
        </div>
        <div className="stat">
          <p className="stat-label"><TrendingDown size={14} className="text-gray-400" /> {language === 'al' ? 'Shpenzimet' : 'Expenses'}</p>
          <p className="stat-value">{formatMoney(totalExpenses, currency)}</p>
        </div>
        <div className="stat bg-gray-50">
          <p className="stat-label"><DollarSign size={14} className="text-gray-400" /> {language === 'al' ? 'Fitimi neto' : 'Net profit'}</p>
          <p className={`stat-value ${netProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatMoney(netProfit, currency)}</p>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        
        {/* Bar Chart (Trend) */}
        <div className="lg:col-span-2 card p-4 min-w-0">
          <h2 className="card-title mb-4 flex items-center gap-2">
            <BarChart3 className="text-gray-400" size={16}/> 
            {viewMode === 'daily' 
              ? (language === 'al' ? 'Ecuria (7 Ditët e Fundit)' : 'Last 7 days') 
              : (language === 'al' ? 'Ecuria e Muajit' : 'This month by day')}
          </h2>
          <div className="h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e3e7ec" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} width={64} tickFormatter={(value) => formatMoney(value, currency).replace(/,00(?=\s|$)/, '')} />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}} 
                  formatter={(value, name) => [formatMoney(value, currency), language === 'al' && name === 'Revenue' ? 'Të ardhurat' : language === 'al' && name === 'Expenses' ? 'Shpenzimet' : name]} 
                />
                <Bar dataKey="Revenue" fill="#2c5698" radius={[2, 2, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Expenses" fill="#cdd3db" radius={[2, 2, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart (Expense Breakdown) */}
        <div className="card p-4 flex flex-col min-w-0">
          <h2 className="card-title mb-2 flex items-center gap-2">
            <PieChartIcon className="text-gray-400" size={16}/> 
            {language === 'al' ? 'Ndarja e Shpenzimeve' : 'Expenses by category'}
          </h2>
          <div className="flex-1 min-h-[250px] w-full">
            {pieChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">
                {language === 'al' ? 'Nuk ka të dhëna.' : 'No data available.'}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(value, currency)} />
                  <Legend 
                    formatter={(value) => <span className="text-xs text-gray-700 font-medium">{categoryTranslations[value] || value}</span>} 
                    layout="horizontal" 
                    verticalAlign="bottom" 
                    align="center"
                    wrapperStyle={{ paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* DETAILED LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* Tabela e Punëve */}
        <div className="card overflow-hidden min-w-0">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Wrench className="text-gray-400" size={16}/>
              <h2 className="card-title">{language === 'al' ? 'Punët e Përfunduara' : 'Completed jobs'}</h2>
            </div>
            <span className="badge badge-gray font-mono">{filteredServices.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {loading ? <p className="p-4 text-center text-gray-500">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : 
             filteredServices.length === 0 ? <p className="p-8 text-center text-gray-400 italic">{language === 'al' ? 'Nuk ka punë në këtë periudhë.' : 'No jobs in this period.'}</p> :
             filteredServices.map(s => (
              <div key={s.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="font-medium text-gray-900 text-sm truncate">{vehicleName(s.cars?.make, s.cars?.model)}</p>
                  <p className="text-xs text-gray-500 truncate">{s.cars?.plate} • {formatDate(s.service_date || s.created_at)}</p>
                </div>
                <span className="font-mono font-medium text-gray-900 shrink-0">{formatMoney(s.cost, currency)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela e Shpenzimeve */}
        <div className="card overflow-hidden min-w-0">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Receipt className="text-gray-400" size={16}/>
              <h2 className="card-title">{language === 'al' ? 'Lista e Shpenzimeve' : 'Expenses'}</h2>
            </div>
            <span className="badge badge-gray font-mono">{filteredExpenses.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {loading ? <p className="p-4 text-center text-gray-500">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : 
             filteredExpenses.length === 0 ? <p className="p-8 text-center text-gray-400 italic">{language === 'al' ? 'Nuk ka shpenzime në këtë periudhë.' : 'No expenses in this period.'}</p> :
             filteredExpenses.map(e => (
              <div key={e.id} className="px-4 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="font-medium text-gray-900 text-sm truncate">{categoryTranslations[e.category] || e.category}</p>
                  <p className="text-xs text-gray-500 truncate">{e.description || '-'} • {formatDate(e.expense_date)}</p>
                </div>
                <span className="font-mono font-medium text-gray-700 shrink-0">{formatMoney(e.amount, currency)}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}