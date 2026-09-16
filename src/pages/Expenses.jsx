import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Receipt, X, Check } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, useToast } from '../components/ui';
import { formatMoney, formatDate, todayISO, rowDate, matches } from '../lib/format';

const CATEGORIES = [
  'Rent', 'Electricity', 'Water', 'Wifi / Phone', 'Tools & Equipment', 'Food / Meals', 'Marketing', 'Maintenance', 'Other',
];

const emptyForm = () => ({ category: 'Tools & Equipment', amount: '', description: '', expense_date: todayISO() });

export default function Expenses() {
  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';
  const toast = useToast();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [currency, setCurrency] = useState('€');
  const [formData, setFormData] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const money = v => formatMoney(v, currency);

  const catLabel = c => (al ? {
    'Rent': 'Qiraja', 'Electricity': 'Energjia elektrike', 'Water': 'Uji', 'Wifi / Phone': 'Internet / telefon',
    'Tools & Equipment': 'Vegla & pajisje', 'Food / Meals': 'Ushqim', 'Marketing': 'Marketing',
    'Maintenance': 'Mirëmbajtje', 'Other': 'Tjetër',
  }[c] : c) || c;

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem('sonic_expenses_cache') || 'null');
      if (c) setExpenses(c);
    } catch { /* ignore */ }
  }

  async function fetchData() {
    setLoading(true);
    if (!isOnline) { loadCache(); setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const [shop, res] = await Promise.all([
          supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single(),
          supabase.from('expenses').select('*').eq('workshop_id', profile.workshop_id).order('expense_date', { ascending: false }),
        ]);
        setCurrency(shop.data?.currency || '€');
        setExpenses(res.data || []);
        localStorage.setItem('sonic_expenses_cache', JSON.stringify(res.data || []));
      }
    } catch (error) {
      console.error('Fetch error (fallback to cache):', error);
      loadCache();
    }
    setLoading(false);
  }

  function closeForm() {
    setShowForm(false);
    setFormData(emptyForm());
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      return toast.error(al ? 'Shënoni një shumë të vlefshme.' : 'Please enter a valid amount.');
    }
    setSaving(true);
    try {
      let workshopId = localStorage.getItem('sonic_workshop_id');
      if (!workshopId && isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
        if (profile?.workshop_id) { workshopId = profile.workshop_id; localStorage.setItem('sonic_workshop_id', workshopId); }
      }
      if (!workshopId) throw new Error(al ? 'Nuk u gjet ID e ofiçinës. Lidhuni me internet.' : 'Workshop ID not found. Please connect to the internet.');

      const payload = { ...formData, amount: Number(formData.amount), workshop_id: workshopId };

      if (!isOnline) {
        addToQueue('expenses', 'INSERT', payload);
        const temp = { id: 'temp-' + Date.now(), ...payload, created_at: new Date().toISOString() };
        setExpenses(prev => [temp, ...prev]);
        const cache = JSON.parse(localStorage.getItem('sonic_expenses_cache') || '[]');
        localStorage.setItem('sonic_expenses_cache', JSON.stringify([temp, ...cache]));
        toast.info(al ? 'Offline: u ruajt lokalisht, do të sinkronizohet.' : 'Offline: saved locally, will sync.');
        closeForm();
        return;
      }

      const { error } = await supabase.from('expenses').insert([payload]);
      if (error) throw error;
      toast.success(al ? 'Shpenzimi u ruajt.' : 'Expense saved.');
      closeForm();
      fetchData();
    } catch (error) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Error saving expense: ') + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(exp) {
    if (!window.confirm(al ? 'Fshi këtë shpenzim?' : 'Delete this expense?')) return;
    const id = exp.id;
    if (!isOnline) {
      setExpenses(prev => prev.filter(e => e.id !== id));
      const cache = JSON.parse(localStorage.getItem('sonic_expenses_cache') || '[]');
      localStorage.setItem('sonic_expenses_cache', JSON.stringify(cache.filter(e => e.id !== id)));
      if (!String(id).startsWith('temp-')) {
        addToQueue('expenses', 'DELETE', { id });
        toast.info(al ? 'Offline: u fshi lokalisht, do të sinkronizohet.' : 'Offline: deleted locally, will sync.');
      }
      return;
    }
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) return toast.error((al ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
    toast.success(al ? 'Shpenzimi u fshi.' : 'Expense deleted.');
    fetchData();
  }

  const now = new Date();
  const monthly = expenses.filter(e => {
    const d = rowDate(e, 'expense_date');
    return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthlyTotal = monthly.reduce((s, e) => s + Number(e.amount || 0), 0);
  const yearTotal = expenses.filter(e => rowDate(e, 'expense_date')?.getFullYear() === now.getFullYear())
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const topCategory = Object.entries(monthly.reduce((acc, e) => ({ ...acc, [e.category]: (acc[e.category] || 0) + Number(e.amount || 0) }), {}))
    .sort((a, b) => b[1] - a[1])[0];

  const filtered = useMemo(() => expenses.filter(e =>
    (category === 'all' || e.category === category) && matches(search, e.description, e.category, catLabel(e.category))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [expenses, search, category, language]);

  return (
    <div className="page">
      <PageHeader title={t.page_title_expenses} subtitle={t.page_desc_expenses}>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={16} /> {t.add_expense}</button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="stat"><p className="stat-label">{al ? 'Ky muaj' : 'This month'}</p><p className="stat-value text-xl">{money(monthlyTotal)}</p></div>
        <div className="stat"><p className="stat-label">{al ? 'Ky vit' : 'This year'}</p><p className="stat-value text-xl">{money(yearTotal)}</p></div>
        <div className="stat">
          <p className="stat-label">{al ? 'Kategoria më e madhe (muaji)' : 'Largest category (month)'}</p>
          <p className="stat-value text-xl font-sans">{topCategory ? catLabel(topCategory[0]) : '—'}</p>
          {topCategory && <p className="text-xs text-gray-500 mt-0.5 font-mono">{money(topCategory[1])}</p>}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-5 max-w-4xl animate-fade-in">
          <div className="card-header">
            <h2 className="card-title">{al ? 'Shpenzim i ri' : 'New expense'}</h2>
            <button type="button" onClick={closeForm} className="btn-icon" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">{t.category}</label>
              <select required className="input" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t.amount} ({currency})</label>
              <input required type="number" step="0.01" min="0.01" className="input font-mono" placeholder="0,00"
                value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">{t.date}</label>
              <input required type="date" className="input" value={formData.expense_date} onChange={e => setFormData({ ...formData, expense_date: e.target.value })} />
            </div>
            <div className="sm:col-span-3">
              <label className="label">{al ? 'Përshkrimi' : 'Description'}</label>
              <input className="input" placeholder={al ? 'p.sh. Pagesa mujore e internetit' : 'e.g. Monthly internet bill'}
                value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
          <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" disabled={saving} className="btn btn-primary"><Check size={16} /> {al ? 'Ruaj shpenzimin' : 'Save expense'}</button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <SearchInput className="md:flex-1 md:max-w-md" value={search} onChange={setSearch}
          placeholder={al ? 'Kërko në përshkrime…' : 'Search descriptions…'} />
        <select className="input md:w-52" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">{al ? 'Të gjitha kategoritë' : 'All categories'}</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={4} /> : filtered.length === 0 ? (
          <EmptyState icon={Receipt} title={al ? 'Nuk ka shpenzime' : 'No expenses'}
            description={search || category !== 'all' ? (al ? 'Provo një filtër tjetër.' : 'Try a different filter.') : (al ? 'Regjistro shpenzimin e parë.' : 'Log your first expense.')} />
        ) : (
          <div className="table-scroll">
            <table className="table min-w-[600px]">
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th>{t.category}</th>
                  <th>{t.description}</th>
                  <th className="text-right">{t.amount}</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(exp => (
                  <tr key={exp.id}>
                    <td className="whitespace-nowrap text-gray-600">{formatDate(exp.expense_date)}</td>
                    <td><span className="badge badge-gray">{catLabel(exp.category)}</span></td>
                    <td className="text-gray-800">{exp.description || <span className="text-gray-300">—</span>}</td>
                    <td className="text-right font-mono font-medium text-gray-900 whitespace-nowrap">{money(exp.amount)}</td>
                    <td className="text-right">
                      <button onClick={() => handleDelete(exp)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
