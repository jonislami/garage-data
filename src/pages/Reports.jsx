import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { CalendarDays, Calendar, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Wrench, Receipt, PieChart as PieChartIcon, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#64748b'];

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto overflow-x-hidden">
      
      {/* HEADER & TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{language === 'al' ? 'Raportet Financiare' : 'Financial Reports'}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">{language === 'al' ? 'Pasqyrë e detajuar e të ardhurave dhe shpenzimeve' : 'Detailed overview of income and expenses'}</p>
        </div>
        
        <div className="flex bg-gray-200 p-1 rounded-lg w-full sm:w-auto justify-center">
          <button onClick={() => setViewMode('daily')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 rounded-md font-bold text-sm transition-all ${viewMode === 'daily' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <CalendarDays size={18}/> <span>{language === 'al' ? 'Ditor' : 'Daily'}</span>
          </button>
          <button onClick={() => setViewMode('monthly')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 md:px-6 py-2 rounded-md font-bold text-sm transition-all ${viewMode === 'monthly' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Calendar size={18}/> <span>{language === 'al' ? 'Mujor' : 'Monthly'}</span>
          </button>
        </div>
      </div>

      {/* DATE NAVIGATOR - RREGULLUAR PER RESPONSIVE */}
      <div className="flex flex-col sm:flex-row justify-center items-center gap-3 md:gap-4 mb-8 bg-white p-3 rounded-xl shadow-sm border border-gray-200 w-full md:w-fit mx-auto">
        <div className="flex items-center justify-between w-full sm:w-auto gap-2 md:gap-4">
          <button onClick={prevPeriod} className="p-2 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 text-gray-600 transition-colors"><ChevronLeft size={20}/></button>
          <span className="text-base md:text-lg font-black text-gray-800 min-w-[130px] md:min-w-[160px] text-center">{dateTitle}</span>
          <button onClick={nextPeriod} className="p-2 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 text-gray-600 transition-colors"><ChevronRight size={20}/></button>
        </div>
        <button onClick={goToday} className="w-full sm:w-auto px-4 py-2 bg-blue-50 text-blue-600 border border-blue-100 rounded font-bold text-sm hover:bg-blue-100 transition-colors">
          {language === 'al' ? (viewMode === 'daily' ? 'Sot' : 'Ky Muaj') : (viewMode === 'daily' ? 'Today' : 'This Month')}
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-green-100 p-3 md:p-4 rounded-full text-green-600"><TrendingUp size={24} /></div>
          <div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">{language === 'al' ? 'Të Ardhurat' : 'Revenue'}</p>
            <p className="text-xl md:text-2xl font-black text-gray-900 font-mono">{currency}{totalRevenue.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="bg-red-100 p-3 md:p-4 rounded-full text-red-600"><TrendingDown size={24} /></div>
          <div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">{language === 'al' ? 'Shpenzimet' : 'Expenses'}</p>
            <p className="text-xl md:text-2xl font-black text-gray-900 font-mono">-{currency}{totalExpenses.toFixed(2)}</p>
          </div>
        </div>
        <div className={`p-4 md:p-6 rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition-shadow ${netProfit >= 0 ? 'bg-gray-900 border-gray-800' : 'bg-red-50 border-red-200'}`}>
          <div className={`p-3 md:p-4 rounded-full ${netProfit >= 0 ? 'bg-gray-800 text-blue-400' : 'bg-red-100 text-red-600'}`}><DollarSign size={24} /></div>
          <div>
            <p className={`font-bold text-xs uppercase tracking-wider ${netProfit >= 0 ? 'text-gray-400' : 'text-red-500'}`}>{language === 'al' ? 'Fitimi Neto' : 'Net Profit'}</p>
            <p className={`text-xl md:text-2xl font-black font-mono ${netProfit >= 0 ? 'text-white' : 'text-red-600'}`}>{currency}{netProfit.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Bar Chart (Trend) */}
        <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
            <BarChart3 className="text-blue-600" size={20}/> 
            {viewMode === 'daily' 
              ? (language === 'al' ? 'Ecuria (7 Ditët e Fundit)' : 'Trend (Last 7 Days)') 
              : (language === 'al' ? 'Ecuria e Muajit' : 'Monthly Trend')}
          </h2>
          <div className="h-64 md:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 10}} tickFormatter={(value) => `${currency}${value}`} />
                <Tooltip 
                  cursor={{fill: '#F3F4F6'}} 
                  formatter={(value, name) => [`${currency}${value}`, language === 'al' && name === 'Revenue' ? 'Të ardhurat' : language === 'al' && name === 'Expenses' ? 'Shpenzimet' : name]} 
                />
                <Bar dataKey="Revenue" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart (Expense Breakdown) */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col min-w-0">
          <h2 className="text-base md:text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
            <PieChartIcon className="text-red-500" size={20}/> 
            {language === 'al' ? 'Ndarja e Shpenzimeve' : 'Expense Breakdown'}
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
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${currency}${value}`} />
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        
        {/* Tabela e Punëve */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Wrench className="text-blue-600" size={20}/>
              <h2 className="font-bold text-gray-800 text-sm md:text-base">{language === 'al' ? 'Punët e Përfunduara' : 'Completed Jobs'}</h2>
            </div>
            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-bold">{filteredServices.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {loading ? <p className="p-4 text-center text-gray-500">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : 
             filteredServices.length === 0 ? <p className="p-8 text-center text-gray-400 italic">{language === 'al' ? 'Nuk ka punë në këtë periudhë.' : 'No jobs in this period.'}</p> :
             filteredServices.map(s => (
              <div key={s.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="font-bold text-gray-800 text-sm truncate">{s.cars?.make} {s.cars?.model}</p>
                  <p className="text-xs text-gray-500 truncate">{s.cars?.plate} • {new Date(s.service_date || s.created_at).toLocaleDateString()}</p>
                </div>
                <span className="font-mono font-bold text-green-600 shrink-0">+{currency}{s.cost}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabela e Shpenzimeve */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-w-0">
          <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Receipt className="text-red-500" size={20}/>
              <h2 className="font-bold text-gray-800 text-sm md:text-base">{language === 'al' ? 'Lista e Shpenzimeve' : 'Expenses List'}</h2>
            </div>
            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">{filteredExpenses.length}</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {loading ? <p className="p-4 text-center text-gray-500">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : 
             filteredExpenses.length === 0 ? <p className="p-8 text-center text-gray-400 italic">{language === 'al' ? 'Nuk ka shpenzime në këtë periudhë.' : 'No expenses in this period.'}</p> :
             filteredExpenses.map(e => (
              <div key={e.id} className="p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="font-bold text-gray-800 text-sm truncate">{categoryTranslations[e.category] || e.category}</p>
                  <p className="text-xs text-gray-500 truncate">{e.description || '-'} • {new Date(e.expense_date).toLocaleDateString()}</p>
                </div>
                <span className="font-mono font-bold text-red-500 shrink-0">-{currency}{e.amount}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}