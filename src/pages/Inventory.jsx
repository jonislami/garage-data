import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Package, Pencil, Trash2, X, Check, AlertTriangle } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, useToast } from '../components/ui';
import { formatMoney, matches, normalize } from '../lib/format';

const LOW_STOCK = 5;
const EMPTY = { part_name: '', part_number: '', quantity: 0, cost_price: 0, unit_price: 0 };

// True when the database has not been migrated yet (no part_number column)
const isMissingPartNumberColumn = err => /part_number/i.test(err?.message || '');

export default function Inventory() {
  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';
  const toast = useToast();

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currency, setCurrency] = useState('€');
  const [formData, setFormData] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  const money = v => formatMoney(v, currency);

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem('sonic_inventory_cache') || 'null');
      if (c) setInventory(c);
    } catch { /* ignore */ }
  }

  async function fetchData() {
    setLoading(true);
    if (!isOnline) { loadCache(); setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const [shop, inv] = await Promise.all([
          supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single(),
          supabase.from('inventory').select('*').eq('workshop_id', profile.workshop_id).order('part_name'),
        ]);
        setCurrency(shop.data?.currency || '€');
        setInventory(inv.data || []);
        localStorage.setItem('sonic_inventory_cache', JSON.stringify(inv.data || []));
      }
    } catch (error) {
      console.error('Fetch error:', error);
      loadCache();
    }
    setLoading(false);
  }

  function handleEdit(item) {
    setFormData({
      part_name: item.part_name || '', part_number: item.part_number || '',
      quantity: item.quantity ?? 0, cost_price: item.cost_price || 0, unit_price: item.unit_price || 0,
    });
    setEditingId(item.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancel() {
    setFormData(EMPTY);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleDelete(item) {
    if (!window.confirm(al ? `Fshi “${item.part_name}”?` : `Delete “${item.part_name}”?`)) return;
    const id = item.id;
    if (!isOnline) {
      setInventory(prev => prev.filter(i => i.id !== id));
      const cache = JSON.parse(localStorage.getItem('sonic_inventory_cache') || '[]');
      localStorage.setItem('sonic_inventory_cache', JSON.stringify(cache.filter(i => i.id !== id)));
      if (!String(id).startsWith('temp-')) {
        addToQueue('inventory', 'DELETE', { id });
        toast.info(al ? 'Offline: u fshi lokalisht, do të sinkronizohet.' : 'Offline: deleted locally, will sync.');
      }
      return;
    }
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) return toast.error((al ? 'Gabim gjatë fshirjes: ' : 'Error deleting part: ') + error.message);
    toast.success(al ? 'Pjesa u fshi.' : 'Part deleted.');
    fetchData();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let workshopId = localStorage.getItem('sonic_workshop_id');
      if (!workshopId && isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
        if (profile?.workshop_id) { workshopId = profile.workshop_id; localStorage.setItem('sonic_workshop_id', workshopId); }
      }
      if (!workshopId) throw new Error(al ? 'Nuk u gjet ID e ofiçinës. Lidhuni me internet.' : 'Workshop ID not found. Please connect to the internet.');

      const partNumber = formData.part_number.trim().toUpperCase();
      if (partNumber) {
        const dup = inventory.find(i => i.id !== editingId && normalize(i.part_number) === normalize(partNumber));
        if (dup && !window.confirm(al
          ? `Numri i pjesës ${partNumber} ekziston tashmë (“${dup.part_name}”). Të ruhet gjithsesi?`
          : `Part number ${partNumber} already exists (“${dup.part_name}”). Save anyway?`)) {
          setSaving(false);
          return;
        }
      }

      const payload = {
        part_name: formData.part_name.trim(),
        part_number: partNumber || null,
        quantity: Number(formData.quantity) || 0,
        cost_price: Number(formData.cost_price) || 0,
        unit_price: Number(formData.unit_price) || 0,
        workshop_id: workshopId,
      };

      if (!isOnline) {
        const cache = JSON.parse(localStorage.getItem('sonic_inventory_cache') || '[]');
        if (editingId) {
          addToQueue('inventory', 'UPDATE', { id: editingId, ...payload });
          const updated = cache.map(i => i.id === editingId ? { ...i, ...payload } : i);
          setInventory(updated);
          localStorage.setItem('sonic_inventory_cache', JSON.stringify(updated));
        } else {
          addToQueue('inventory', 'INSERT', payload);
          const temp = { id: 'temp-' + Date.now(), ...payload, created_at: new Date().toISOString() };
          setInventory([temp, ...cache]);
          localStorage.setItem('sonic_inventory_cache', JSON.stringify([temp, ...cache]));
        }
        toast.info(al ? 'Offline: u ruajt lokalisht, do të sinkronizohet.' : 'Offline: saved locally, will sync.');
        handleCancel();
        return;
      }

      const write = p => editingId
        ? supabase.from('inventory').update(p).eq('id', editingId)
        : supabase.from('inventory').insert([p]);

      let { error } = await write(payload);
      if (error && isMissingPartNumberColumn(error)) {
        // Database not migrated yet – save without the part number and tell the user
        const { part_number: _omit, ...rest } = payload;
        ({ error } = await write(rest));
        if (!error) toast.error(al
          ? 'Pjesa u ruajt, por numri i pjesës jo: databaza duhet përditësuar (shiko supabase/migrations).'
          : 'Part saved, but not the part number: the database needs the migration in supabase/migrations.');
      }
      if (error) throw error;

      toast.success(editingId ? (al ? 'Pjesa u përditësua.' : 'Part updated.') : (al ? 'Pjesa u shtua.' : 'Part added.'));
      handleCancel();
      fetchData();
    } catch (error) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Save error: ') + error.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => inventory.filter(item => {
    if (stockFilter === 'low' && Number(item.quantity) > LOW_STOCK) return false;
    if (stockFilter === 'out' && item.quantity > 0) return false;
    return matches(search, item.part_number, item.part_name);
  }).sort((a, b) => {
    // Exact part-number hits first
    if (!search) return 0;
    const q = normalize(search);
    const ea = normalize(a.part_number) === q ? 0 : 1;
    const eb = normalize(b.part_number) === q ? 0 : 1;
    return ea - eb;
  }), [inventory, search, stockFilter]);

  const totals = useMemo(() => ({
    items: inventory.length,
    units: inventory.reduce((a, i) => a + (Number(i.quantity) > 0 ? Number(i.quantity) : 0), 0),
    value: inventory.reduce((a, i) => a + Math.max(0, Number(i.quantity) || 0) * (Number(i.cost_price) || 0), 0),
    low: inventory.filter(i => i.quantity <= LOW_STOCK).length,
  }), [inventory]);

  return (
    <div className="page">
      <PageHeader title={t.page_title_inventory} subtitle={t.page_desc_inventory}>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus size={16} /> {t.add_part}
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 keep-cols">
        <div className="stat"><p className="stat-label">{al ? 'Artikuj' : 'Items'}</p><p className="stat-value text-xl">{totals.items}</p></div>
        <div className="stat"><p className="stat-label">{al ? 'Njësi në stok' : 'Units in stock'}</p><p className="stat-value text-xl">{totals.units}</p></div>
        <div className="stat"><p className="stat-label">{al ? 'Vlera e stokut (kosto)' : 'Stock value (cost)'}</p><p className="stat-value text-xl">{money(totals.value)}</p></div>
        <button type="button" onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')} className="stat text-left hover:border-gray-300 transition-colors">
          <p className="stat-label"><AlertTriangle size={13} className="text-amber-500" /> {al ? 'Stok i ulët / mbaruar' : 'Low / out of stock'}</p>
          <p className={`stat-value text-xl ${totals.low > 0 ? 'text-amber-700' : ''}`}>{totals.low}</p>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-5 animate-fade-in">
          <div className="card-header">
            <h2 className="card-title">{editingId ? (al ? 'Ndrysho pjesën' : 'Edit part') : (al ? 'Pjesë e re' : 'New part')}</h2>
            <button type="button" onClick={handleCancel} className="btn-icon" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-2">
              <label className="label">{al ? 'Numri i pjesës (OEM / kodi)' : 'Part number (OEM / SKU)'}</label>
              <input className="input font-code uppercase" placeholder="e.g. 06A115561B"
                value={formData.part_number} onChange={e => setFormData({ ...formData, part_number: e.target.value })} />
            </div>
            <div className="md:col-span-4">
              <label className="label">{al ? 'Emri i pjesës' : 'Part name'} *</label>
              <input required className="input" placeholder={al ? 'p.sh. Filtër vaji' : 'e.g. Oil filter'}
                value={formData.part_name} onChange={e => setFormData({ ...formData, part_name: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{al ? 'Sasia në stok' : 'Quantity in stock'}</label>
              <input required type="number" step="any" className="input font-mono"
                value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{al ? 'Kostoja (blerja)' : 'Cost price (you pay)'}</label>
              <input required type="number" step="0.01" min="0" className="input font-mono"
                value={formData.cost_price} onChange={e => setFormData({ ...formData, cost_price: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{al ? 'Çmimi i shitjes' : 'Sell price (client pays)'}</label>
              <input required type="number" step="0.01" min="0" className="input font-mono"
                value={formData.unit_price} onChange={e => setFormData({ ...formData, unit_price: e.target.value })} />
            </div>
          </div>
          <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button type="button" onClick={handleCancel} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" disabled={saving} className="btn btn-primary"><Check size={16} /> {saving ? (al ? 'Duke ruajtur…' : 'Saving…') : (al ? 'Ruaj pjesën' : 'Save part')}</button>
          </div>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <SearchInput
          className="md:flex-1 md:max-w-md"
          value={search}
          onChange={setSearch}
          placeholder={al ? 'Kërko me numër pjese ose emër…' : 'Search by part number or name…'}
        />
        <select className="input md:w-44" value={stockFilter} onChange={e => setStockFilter(e.target.value)}>
          <option value="all">{al ? 'I gjithë stoku' : 'All stock'}</option>
          <option value="low">{al ? `Stok i ulët (≤ ${LOW_STOCK})` : `Low stock (≤ ${LOW_STOCK})`}</option>
          <option value="out">{al ? 'Mbaruar' : 'Out of stock'}</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={6} /> : filtered.length === 0 ? (
          <EmptyState
            icon={Package}
            title={search ? (al ? 'Asnjë pjesë nuk u gjet' : 'No parts found') : t.no_parts}
            description={search ? (al ? `Asgjë nuk përputhet me “${search}”.` : `Nothing matches “${search}”.`) : (al ? 'Shtoni pjesën e parë në stok.' : 'Add your first part to stock.')}
          />
        ) : (
          <div className="table-scroll">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>{al ? 'Nr. pjesës' : 'Part no.'}</th>
                  <th>{al ? 'Emri' : 'Name'}</th>
                  <th className="text-right">{t.stock}</th>
                  <th className="text-right">{t.cost}</th>
                  <th className="text-right">{t.selling_price}</th>
                  <th className="text-right">{al ? 'Marzha' : 'Margin'}</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const cost = Number(item.cost_price) || 0;
                  const price = Number(item.unit_price) || 0;
                  const profit = price - cost;
                  const pct = price > 0 ? (profit / price) * 100 : 0;
                  const qty = Number(item.quantity) || 0;
                  const qtyCls = qty <= 0 ? 'badge-red' : qty <= LOW_STOCK ? 'badge-amber' : 'badge-gray';
                  return (
                    <tr key={item.id}>
                      <td className="font-code text-[13px] text-gray-900 whitespace-nowrap">{item.part_number || <span className="text-gray-300">—</span>}</td>
                      <td className="text-gray-900">{item.part_name}</td>
                      <td className="text-right"><span className={`badge ${qtyCls} font-mono`}>{qty}</span></td>
                      <td className="text-right font-mono text-gray-600">{money(cost)}</td>
                      <td className="text-right font-mono text-gray-900">{money(price)}</td>
                      <td className={`text-right font-mono ${profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {money(profit)} <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => handleEdit(item)} className="btn-icon" title={t.edit}><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(item)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && inventory.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">{al ? `${filtered.length} nga ${inventory.length} artikuj` : `Showing ${filtered.length} of ${inventory.length} items`}</p>
      )}
    </div>
  );
}
