import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Receipt, Calendar, DollarSign, PieChart, X } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations'; // SHTUAR: Importo fjalorin

const CATEGORIES = [
  'Rent', 'Electricity', 'Water', 'Wifi / Phone', 'Tools & Equipment', 'Food / Meals', 'Marketing', 'Maintenance', 'Other'
];

export default function Expenses() {
  const { isOnline, addToQueue } = useSync();
  
  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currency, setCurrency] = useState('$');

  const [formData, setFormData] = useState({
    category: 'Tools & Equipment',
    amount: '',
    description: '',
    expense_date: new Date().toISOString().split('T')[0] // Defaults to today (YYYY-MM-DD)
  });

  // Fjalor i vogël për të përkthyer kategoritë vizualisht (ruhen në anglisht në DB për uniformitet)
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

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedExpenses = localStorage.getItem('sonic_expenses_cache');
      if (cachedExpenses) {
        setExpenses(JSON.parse(cachedExpenses));
      }
      setLoading(false);
      return; 
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      
      if (profile) {
        const { data: expenseData } = await supabase
          .from('expenses')
          .select('*')
          .eq('workshop_id', profile.workshop_id)
          .order('expense_date', { ascending: false });
        
        setExpenses(expenseData || []);
        localStorage.setItem('sonic_expenses_cache', JSON.stringify(expenseData || []));
      }
    } catch (error) {
      console.error("Fetch error (fallback to cache):", error);
      const cachedExpenses = localStorage.getItem('sonic_expenses_cache');
      if (cachedExpenses) setExpenses(JSON.parse(cachedExpenses));
    }

    setLoading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.amount || formData.amount <= 0) {
      return alert(language === 'al' ? 'Ju lutem shënoni një shumë të vlefshme.' : 'Please enter a valid amount.');
    }

    try {
      let workshopId = localStorage.getItem('sonic_workshop_id');

      if (!workshopId && isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
        
        if (profile?.workshop_id) {
          workshopId = profile.workshop_id;
          localStorage.setItem('sonic_workshop_id', workshopId); 
        }
      }

      if (!workshopId) throw new Error(language === 'al' ? "Nuk u gjet ID e Ofiçinës. Lidhu pak me Wi-Fi." : "Could not find Workshop ID. Please connect to Wi-Fi and refresh the page.");

      const payload = { ...formData, workshop_id: workshopId };

      if (!isOnline) {
        addToQueue('expenses', 'INSERT', payload);
        alert(language === 'al' ? 'Ju jeni offline! 🛜 Shpenzimi u ruajt lokalisht dhe do të ngarkohet kur të vijë interneti.' : 'You are offline! 🛜 Expense saved to local queue and will upload when internet returns.');
        
        const tempExpense = {
          id: 'temp-' + Date.now(), 
          ...payload,
          created_at: new Date().toISOString()
        };

        setExpenses(prevExpenses => [tempExpense, ...prevExpenses]);

        const existingCache = JSON.parse(localStorage.getItem('sonic_expenses_cache') || '[]');
        localStorage.setItem('sonic_expenses_cache', JSON.stringify([tempExpense, ...existingCache]));

        setShowForm(false);
        setFormData({ category: 'Tools & Equipment', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });
        return; 
      }

      const { error } = await supabase.from('expenses').insert([payload]);
      if (error) throw error;

      setShowForm(false);
      setFormData({ category: 'Tools & Equipment', amount: '', description: '', expense_date: new Date().toISOString().split('T')[0] });
      fetchData(); 
    } catch (error) {
      alert((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Error saving expense: ') + error.message);
    }
  }

  async function handleDelete(id) {
    const confirmMsg = language === 'al' 
      ? 'Jeni i sigurt që dëshironi ta fshini këtë shpenzim?' 
      : 'Are you sure you want to delete this expense?';

    if (window.confirm(confirmMsg)) {
      if (!isOnline) {
        setExpenses(prev => prev.filter(e => e.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_expenses_cache') || '[]');
        const updatedCache = existingCache.filter(e => e.id !== id);
        localStorage.setItem('sonic_expenses_cache', JSON.stringify(updatedCache));

        if (!id.toString().startsWith('temp-')) {
          addToQueue('expenses', 'DELETE', { id });
          alert(language === 'al' ? 'Offline: Shpenzimi u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Expense deleted locally. Will sync to cloud when internet returns.');
        }
        return; 
      }

      try {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
      }
    }
  }

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyTotal = expenses
    .filter(exp => {
      const d = new Date(exp.expense_date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, exp) => sum + Number(exp.amount), 0);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t.page_title_expenses || (language === 'al' ? 'Shpenzimet e Biznesit' : 'Business Expenses')}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">{t.page_desc_expenses || (language === 'al' ? 'Gjurmo shpenzimet e përgjithshme, mjetet dhe kostot ditore.' : 'Track overhead, tools, and daily shop costs.')}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="w-full md:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md">
            <Plus size={20} /> {t.add_expense || (language === 'al' ? 'Shto Shpenzim' : 'Add Expense')}
          </button>
        )}
      </div>

      {/* OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-xl shadow-sm border flex items-center gap-4">
          <div className="bg-red-100 p-4 rounded-full text-red-600"><DollarSign size={24} /></div>
          <div>
            <p className="text-gray-500 font-bold text-xs uppercase tracking-wider">{language === 'al' ? 'Totali Këtë Muaj' : 'Total This Month'}</p>
            <p className="text-2xl font-black text-gray-900 font-mono">{currency}{monthlyTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ADD EXPENSE FORM */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 mb-8 overflow-hidden animate-fade-in max-w-4xl">
          <div className="bg-gray-50 p-4 md:p-6 border-b flex justify-between items-center">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <Receipt className="text-blue-600" size={24} /> {language === 'al' ? 'Regjistro Shpenzim të Ri' : 'Log New Expense'}
            </h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-red-500 transition-colors bg-white p-2 rounded-full shadow-sm border"><X size={20}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
              
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t.category || (language === 'al' ? 'Kategoria' : 'Category')}</label>
                <div className="relative">
                  <PieChart className="absolute left-3 top-3 text-gray-400" size={18} />
                  <select required className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 bg-white"
                    value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{categoryTranslations[cat] || cat}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t.amount || (language === 'al' ? 'Shuma' : 'Amount')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-gray-400">{currency}</span>
                  <input required type="number" step="0.01" className="w-full pl-8 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold" 
                    placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t.date || (language === 'al' ? 'Data' : 'Date')}</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-gray-400" size={18} />
                  <input required type="date" className="w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium" 
                    value={formData.expense_date} onChange={e => setFormData({...formData, expense_date: e.target.value})} />
                </div>
              </div>

              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Përshkrimi / Shënime' : 'Description / Note'}</label>
                <input className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                  placeholder={language === 'al' ? "p.sh., Bleva set çelësash të rinj, Paguajta internetin..." : "e.g., Bought new socket set, Paid monthly internet..."} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>

            </div>

            <div className="flex justify-end pt-4 border-t">
              <button type="submit" className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-lg transition-transform hover:scale-105">
                {language === 'al' ? 'Ruaj Shpenzimin' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EXPENSES LIST / TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-bold text-gray-600 text-sm uppercase tracking-wider">{t.date || (language === 'al' ? 'Data' : 'Date')}</th>
                <th className="p-4 font-bold text-gray-600 text-sm uppercase tracking-wider">{t.category || (language === 'al' ? 'Kategoria' : 'Category')}</th>
                <th className="p-4 font-bold text-gray-600 text-sm uppercase tracking-wider">{t.description || (language === 'al' ? 'Përshkrimi' : 'Description')}</th>
                <th className="p-4 font-bold text-gray-600 text-sm uppercase tracking-wider text-right">{t.amount || (language === 'al' ? 'Shuma' : 'Amount')}</th>
                <th className="p-4 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400 italic">{language === 'al' ? 'Nuk ka asnjë shpenzim të regjistruar ende.' : 'No expenses recorded yet.'}</td></tr>
              ) : (
                expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm font-medium text-gray-600">{new Date(exp.expense_date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                        {categoryTranslations[exp.category] || exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-800">{exp.description || '-'}</td>
                    <td className="p-4 text-right font-mono font-black text-red-600">-{currency}{Number(exp.amount).toFixed(2)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleDelete(exp.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}