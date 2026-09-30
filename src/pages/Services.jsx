import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Wrench, Package, FileText, X, Check, Pencil } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, StatusBadge, useToast } from '../components/ui';
import { formatMoney, formatDate, todayISO, rowDate, invoiceNumber, matches } from '../lib/format';
import { DeleteRegularDialog } from '../components/RegularInvoiceDialogs';
import { vehicleName } from '../lib/vehicle';

const EMPTY_ITEM = { category: 'labor', description: '', price: '', quantity: 1, unit: 'pcs', cost_price: 0, inventory_id: null };

/* Searchable stock picker – finds parts by name OR part number */
function StockPicker({ inventory, onPick, al, currency }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = inventory.filter(i => matches(q, i.part_name, i.part_number, i.brand)).slice(0, 30);

  return (
    <div ref={ref} className="relative w-full md:w-64">
      <SearchInput
        value={q}
        onChange={v => { setQ(v); setOpen(true); }}
        placeholder={al ? 'Kërko në stok (emri / nr. pjesës)' : 'Search stock (name / part no.)'}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-full md:w-96 max-h-72 overflow-y-auto card shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-gray-500">{al ? 'Asnjë pjesë nuk u gjet.' : 'No matching parts.'}</p>
          ) : results.map(item => (
            <button
              key={item.id}
              type="button"
              disabled={item.quantity <= 0}
              onClick={() => { onPick(item); setQ(''); setOpen(false); }}
              className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed border-b border-gray-100 last:border-0"
            >
              <span className="min-w-0">
                <span className="block text-sm text-gray-900 truncate">{item.part_name}</span>
                {item.part_number && <span className="block text-xs font-code text-gray-500">{item.part_number}</span>}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-sm font-mono">{formatMoney(item.unit_price, currency)}</span>
                <span className={`block text-xs ${item.quantity <= 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {item.quantity} {al ? 'në stok' : 'in stock'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Services() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const wantsNew = searchParams.get('new');
  const toast = useToast();

  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';

  const [services, setServices] = useState([]);
  const [cars, setCars] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(!!wantsNew);
  const [currency, setCurrency] = useState('€');

  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedCarId, setSelectedCarId] = useState('');
  const [jobStatus, setJobStatus] = useState('Pending');
  const [serviceDate, setServiceDate] = useState(todayISO());
  const [lineItems, setLineItems] = useState([]);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [discount, setDiscount] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [deletingRegular, setDeletingRegular] = useState(null);

  const money = v => formatMoney(v, currency);

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (wantsNew && !editId) setShowForm(true);
  }, [wantsNew, editId]);

  useEffect(() => {
    if (editId && services.length > 0) {
      const job = services.find(s => s.id === editId);
      if (job) {
        setShowForm(true);
        setSelectedCarId(job.car_id);
        setJobStatus(job.status);
        setDiscount(job.discount || '');
        setInvoiceNotes(job.invoice_notes || '');
        setServiceDate(job.service_date || job.created_at?.split('T')[0] || todayISO());
        setLineItems((job.service_items || []).map(i => ({
          category: i.category, description: i.description, price: i.price,
          quantity: i.quantity || 1, unit: i.unit || 'pcs',
          cost_price: i.cost_price || 0, inventory_id: null,
        })));
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [editId, services]);

  function loadCache() {
    const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
    const s = read('sonic_services_cache'); if (s) setServices(s);
    const c = read('sonic_cars_cache'); if (c) setCars(c);
    const i = read('sonic_inventory_cache'); if (i) setInventory(i);
  }

  async function fetchData() {
    setLoading(true);
    if (!isOnline) { loadCache(); setLoading(false); return; }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const wid = profile.workshop_id;
        const [shop, serviceRes, carRes, invRes] = await Promise.all([
          supabase.from('workshops').select('currency').eq('id', wid).single(),
          supabase.from('services')
            .select('*, cars ( make, model, plate, clients ( full_name ) ), service_items ( description, category, price, cost_price, quantity, unit )')
            .eq('workshop_id', wid)
            .order('service_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false }),
          supabase.from('cars').select('id, make, model, plate, clients(full_name)').eq('workshop_id', wid).order('make'),
          supabase.from('inventory').select('*').eq('workshop_id', wid).order('part_name'),
        ]);
        setCurrency(shop.data?.currency || '€');
        setServices(serviceRes.data || []);
        setCars(carRes.data || []);
        setInventory(invRes.data || []);
        localStorage.setItem('sonic_services_cache', JSON.stringify(serviceRes.data || []));
        localStorage.setItem('sonic_cars_cache', JSON.stringify(carRes.data || []));
        localStorage.setItem('sonic_inventory_cache', JSON.stringify(invRes.data || []));
      }
    } catch (error) {
      console.error('Fetch error (fallback to cache):', error);
      loadCache();
    }
    setLoading(false);
  }

  function handleAddLineItem() {
    if (!newItem.description || newItem.price === '' || !newItem.quantity) {
      toast.error(al ? 'Plotëso përshkrimin, sasinë dhe çmimin.' : 'Fill in description, quantity and price.');
      return;
    }
    setLineItems([...lineItems, { ...newItem }]);
    setNewItem(EMPTY_ITEM);
  }

  function handleStockPick(item) {
    setNewItem({
      category: 'part',
      description: item.part_number ? `${item.part_name} (${item.part_number})` : item.part_name,
      price: item.unit_price, quantity: 1, unit: 'pcs',
      cost_price: item.cost_price || 0, inventory_id: item.id,
    });
  }

  const subtotal = lineItems.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
  const total = subtotal - Number(discount || 0);

  function handleCancel() {
    setShowForm(false); navigate('/services'); setSelectedCarId(''); setLineItems([]);
    setNewItem(EMPTY_ITEM); setJobStatus('Pending'); setDiscount(''); setInvoiceNotes('');
    setServiceDate(todayISO());
  }

  async function handleDeleteService(id) {
    const job = services.find(s => s.id === id);
    if (job?.regular_number) return setDeletingRegular(job);
    const msg = al
      ? 'Jeni i sigurt që dëshironi ta fshini këtë punë? Ky veprim nuk mund të zhbëhet.'
      : 'Delete this job? This cannot be undone.';
    if (!window.confirm(msg)) return;

    if (!isOnline) {
      setServices(prev => prev.filter(s => s.id !== id));
      const cache = JSON.parse(localStorage.getItem('sonic_services_cache') || '[]');
      localStorage.setItem('sonic_services_cache', JSON.stringify(cache.filter(s => s.id !== id)));
      addToQueue('services', 'DELETE', { id });
      toast.info(al ? 'Offline: u fshi lokalisht, do të sinkronizohet më vonë.' : 'Offline: deleted locally, will sync later.');
      return;
    }
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) return toast.error((al ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
    toast.success(al ? 'Puna u fshi.' : 'Job deleted.');
    fetchData();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCarId) return toast.error(al ? 'Ju lutem zgjidhni një veturë.' : 'Please select a vehicle.');
    if (lineItems.length === 0 && newItem.description) {
      return toast.error(al ? 'Klikoni "Shto" për të shtuar artikullin.' : 'Click "Add" to add the line item first.');
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

      const descTitle = lineItems.length > 0 ? lineItems[0].description : (al ? 'Shërbim i përgjithshëm' : 'General service');
      const payload = {
        car_id: selectedCarId, workshop_id: workshopId, status: jobStatus,
        description: descTitle + (lineItems.length > 1 ? '…' : ''),
        cost: total, discount: Number(discount || 0),
        invoice_notes: invoiceNotes, service_date: serviceDate,
      };
      const selectedCar = cars.find(c => c.id === selectedCarId) || {};
      const carInfo = { make: selectedCar.make, model: selectedCar.model, plate: selectedCar.plate, clients: selectedCar.clients };

      if (!isOnline) {
        const cache = JSON.parse(localStorage.getItem('sonic_services_cache') || '[]');
        if (editId) {
          addToQueue('services', 'UPDATE', { id: editId, ...payload });
          const updated = cache.map(s => s.id === editId ? { ...s, ...payload, cars: carInfo } : s);
          setServices(updated);
          localStorage.setItem('sonic_services_cache', JSON.stringify(updated));
          toast.info(al ? 'Offline: detajet u ruajtën. Ndryshimi i artikujve kërkon internet.' : 'Offline: details saved. Changing line items requires internet.');
        } else {
          const newId = crypto.randomUUID();
          const full = { id: newId, ...payload };
          addToQueue('services', 'INSERT', full);
          lineItems.forEach(item => addToQueue('service_items', 'INSERT', {
            service_id: newId, description: item.description, category: item.category,
            price: item.price, quantity: item.quantity, unit: item.unit, cost_price: item.cost_price,
          }));
          let inv = [...inventory];
          lineItems.forEach(item => {
            if (!item.inventory_id) return;
            const it = inv.find(i => i.id === item.inventory_id);
            if (it && it.quantity > 0) {
              const q = it.quantity - Number(item.quantity);
              addToQueue('inventory', 'UPDATE', { id: item.inventory_id, quantity: q });
              inv = inv.map(i => i.id === item.inventory_id ? { ...i, quantity: q } : i);
            }
          });
          setInventory(inv);
          localStorage.setItem('sonic_inventory_cache', JSON.stringify(inv));
          const optimistic = { ...full, cars: carInfo, service_items: lineItems, created_at: new Date().toISOString() };
          setServices([optimistic, ...cache]);
          localStorage.setItem('sonic_services_cache', JSON.stringify([optimistic, ...cache]));
          toast.info(al ? 'Offline: puna u ruajt lokalisht dhe do të sinkronizohet.' : 'Offline: job saved locally and will sync.');
        }
        handleCancel();
        return;
      }

      let serviceId = editId;
      if (editId) {
        const { error } = await supabase.from('services').update(payload).eq('id', editId);
        if (error) throw error;
        const { error: delErr } = await supabase.from('service_items').delete().eq('service_id', editId);
        if (delErr) throw delErr;
      } else {
        const { data: service, error } = await supabase.from('services').insert([payload]).select().single();
        if (error) throw error;
        serviceId = service.id;
      }

      if (lineItems.length > 0) {
        const { error } = await supabase.from('service_items').insert(lineItems.map(item => ({
          service_id: serviceId, description: item.description, category: item.category,
          price: item.price, quantity: item.quantity, unit: item.unit, cost_price: item.cost_price,
        })));
        if (error) throw error;
      }

      for (const item of lineItems) {
        if (!item.inventory_id) continue;
        const it = inventory.find(i => i.id === item.inventory_id);
        if (it && it.quantity > 0) {
          await supabase.from('inventory').update({ quantity: it.quantity - Number(item.quantity) }).eq('id', item.inventory_id);
        }
      }
      toast.success(editId ? (al ? 'Puna u përditësua.' : 'Job updated.') : (al ? 'Puna u ruajt.' : 'Job saved.'));
      handleCancel();
      fetchData();
    } catch (error) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Error saving job: ') + error.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredServices = useMemo(() => {
    const now = new Date();
    return services.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (timeFilter !== 'all') {
        const d = rowDate(s, 'service_date') || now;
        if (timeFilter === 'today' && d.toDateString() !== now.toDateString()) return false;
        if (timeFilter === 'month' && !(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())) return false;
        if (timeFilter === 'year' && d.getFullYear() !== now.getFullYear()) return false;
      }
      if (!search) return true;
      return matches(
        search,
        s.cars?.make, s.cars?.model, vehicleName(s.cars?.make, s.cars?.model), s.cars?.plate,
        s.cars?.clients?.full_name, s.description, s.invoice_notes,
        invoiceNumber(s), String(s.cost),
        ...(s.service_items || []).map(i => i.description),
      );
    });
  }, [services, search, timeFilter, statusFilter]);

  const editingRegular = editId ? services.find(s => s.id === editId && s.regular_number) : null;
  const unitLabel = u => (al && u === 'pcs' ? 'copë' : al && u === 'hr' ? 'orë' : u);

  return (
    <div className="page">
      {deletingRegular && (
        <DeleteRegularDialog invoice={deletingRegular} al={al} isOnline={isOnline} onClose={() => setDeletingRegular(null)}
          onDeleted={() => { setDeletingRegular(null); fetchData(); }} />
      )}
      <PageHeader
        title={t.page_title_services}
        subtitle={t.page_desc_services}
      >
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary">
            <Plus size={16} /> {t.new_job}
          </button>
        )}
      </PageHeader>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-6 animate-fade-in">
          <div className="card-header">
            <h2 className="card-title flex items-center gap-2">
              <FileText size={16} className="text-gray-400" />
              {editId ? (al ? 'Ndrysho punën' : 'Edit job') : (al ? 'Punë e re' : 'New job')}
            </h2>
            <button type="button" onClick={handleCancel} className="btn-icon" aria-label="Close"><X size={16} /></button>
          </div>

          <div className="p-4 md:p-5 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="label">{al ? 'Vetura' : 'Vehicle'}</label>
                <select className="input" value={selectedCarId} onChange={e => setSelectedCarId(e.target.value)}>
                  <option value="">{al ? 'Zgjidh veturën…' : 'Select vehicle…'}</option>
                  {cars.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.plate} — {vehicleName(c.make, c.model)} · {c.clients?.full_name || (al ? 'Pa emër' : 'No owner')}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">{al ? 'Statusi' : 'Status'}</label>
                <select className="input" value={jobStatus} onChange={e => setJobStatus(e.target.value)}>
                  <option value="Pending">{al ? 'Në pritje' : 'Pending'}</option>
                  <option value="In Progress">{al ? 'Në proces' : 'In progress'}</option>
                  <option value="Completed">{al ? 'Përfunduar' : 'Completed'}</option>
                </select>
              </div>
              <div>
                <label className="label">{al ? 'Data e shërbimit' : 'Service date'}</label>
                <input type="date" className="input" value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
                {editingRegular && serviceDate && serviceDate.slice(0, 7) !== editingRegular.regular_period && (
                  <p className="mt-1 text-xs text-amber-700">
                    {al
                      ? `Kjo është fatura e rregullt ${editingRegular.regular_number}. Në muaj tjetër ajo merr numrin e radhës së atij muaji.`
                      : `This is regular invoice ${editingRegular.regular_number}. In another month it gets that month's next number.`}
                  </p>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-md">
              <div className="table-scroll">
                <table className="table min-w-[640px]">
                  <thead>
                    <tr>
                      <th className="w-24">{al ? 'Lloji' : 'Type'}</th>
                      <th>{t.description}</th>
                      <th className="text-right w-24">{al ? 'Sasia' : 'Qty'}</th>
                      <th className="text-right w-28">{al ? 'Çmimi' : 'Unit price'}</th>
                      <th className="text-right w-28">{t.total}</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 && (
                      <tr><td colSpan="6" className="text-center text-gray-400 !py-6">{al ? 'Nuk ka artikuj ende.' : 'No line items yet.'}</td></tr>
                    )}
                    {lineItems.map((item, i) => (
                      <tr key={i}>
                        <td>
                          {item.category === 'labor'
                            ? <span className="badge badge-gray"><Wrench size={11} /> {al ? 'Punë' : 'Labor'}</span>
                            : <span className="badge badge-blue"><Package size={11} /> {al ? 'Pjesë' : 'Part'}</span>}
                        </td>
                        <td className="text-gray-900">
                          {item.description}
                          {item.inventory_id && <span className="badge badge-green ml-2">{al ? 'Nga stoku' : 'From stock'}</span>}
                        </td>
                        <td className="text-right font-mono">{item.quantity} <span className="text-gray-400 text-xs">{unitLabel(item.unit)}</span></td>
                        <td className="text-right font-mono text-gray-600">{money(item.price)}</td>
                        <td className="text-right font-mono font-medium">{money(Number(item.price) * Number(item.quantity))}</td>
                        <td className="text-right">
                          <button type="button" onClick={() => setLineItems(lineItems.filter((_, idx) => idx !== i))} className="btn-icon-danger" aria-label="Remove"><Trash2 size={15} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 border-t border-gray-200 p-3 flex flex-col md:flex-row md:flex-wrap gap-2 md:items-center">
                <select className="input md:w-32" value={newItem.category}
                  onChange={e => setNewItem({ ...EMPTY_ITEM, category: e.target.value })}>
                  <option value="labor">{al ? 'Punë dore' : 'Labor'}</option>
                  <option value="part">{al ? 'Pjesë' : 'Part'}</option>
                </select>

                {newItem.category === 'part' && (
                  <StockPicker inventory={inventory} onPick={handleStockPick} al={al} currency={currency} />
                )}

                <input
                  placeholder={newItem.category === 'labor' ? (al ? 'Përshkrimi i punës' : 'Work description') : (al ? 'Emri i pjesës' : 'Part name')}
                  className="input md:flex-1 md:min-w-[180px]"
                  value={newItem.description}
                  onChange={e => setNewItem({ ...newItem, description: e.target.value, inventory_id: null })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLineItem(); } }}
                />
                <div className="flex gap-2">
                  <input type="number" step="any" min="0.1" placeholder={al ? 'Sasia' : 'Qty'} className="input w-20 font-mono"
                    value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} />
                  <select className="input w-20" value={newItem.unit} onChange={e => setNewItem({ ...newItem, unit: e.target.value })}>
                    <option value="pcs">{al ? 'copë' : 'pcs'}</option>
                    <option value="L">L</option>
                    <option value="hr">{al ? 'orë' : 'hr'}</option>
                  </select>
                  <input type="number" step="0.01" min="0" placeholder={`${al ? 'Çmimi' : 'Price'} (${currency})`} className="input w-28 font-mono"
                    value={newItem.price} onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddLineItem(); } }} />
                </div>
                <button type="button" onClick={handleAddLineItem} className="btn btn-secondary">
                  <Plus size={15} /> {al ? 'Shto' : 'Add'}
                </button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-5">
              <div className="flex-1">
                <label className="label">{al ? 'Shënime në faturë' : 'Invoice notes'}</label>
                <textarea rows="4" className="input"
                  placeholder={al ? 'p.sh. Garanci 30 ditore për pjesët.' : 'e.g. 30-day warranty on parts.'}
                  value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} />
              </div>
              <div className="w-full md:w-72 border border-gray-200 rounded-md divide-y divide-gray-200 self-start">
                <div className="flex justify-between px-3 py-2.5 text-sm">
                  <span className="text-gray-600">{al ? 'Nëntotali' : 'Subtotal'}</span>
                  <span className="font-mono">{money(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 text-sm">
                  <span className="text-gray-600">{al ? 'Zbritja' : 'Discount'}</span>
                  <input type="number" step="0.01" min="0" className="input h-8 w-28 text-right font-mono"
                    value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0,00" />
                </div>
                <div className="flex justify-between items-center px-3 py-3 bg-gray-50">
                  <span className="text-sm font-semibold text-gray-900">{al ? 'Totali' : 'Total due'}</span>
                  <span className="text-lg font-semibold font-mono text-gray-900">{money(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button type="button" onClick={handleCancel} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Check size={16} /> {saving ? (al ? 'Duke ruajtur…' : 'Saving…') : editId ? (al ? 'Përditëso' : 'Update job') : (al ? 'Ruaj punën' : 'Save job')}
            </button>
          </div>
        </form>
      )}

      {/* Toolbar: search + filters */}
      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <SearchInput
          className="md:flex-1 md:max-w-md"
          value={search}
          onChange={setSearch}
          placeholder={al ? 'Kërko: targa, vetura, klienti, shërbimi, nr. faturës…' : 'Search: plate, vehicle, client, service, invoice no.…'}
        />
        <div className="flex gap-2">
          <select className="input md:w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">{al ? 'Të gjitha statuset' : 'All statuses'}</option>
            <option value="Pending">{al ? 'Në pritje' : 'Pending'}</option>
            <option value="In Progress">{al ? 'Në proces' : 'In progress'}</option>
            <option value="Completed">{al ? 'Përfunduar' : 'Completed'}</option>
          </select>
          <select className="input md:w-36" value={timeFilter} onChange={e => setTimeFilter(e.target.value)}>
            <option value="all">{al ? 'Çdo kohë' : 'All time'}</option>
            <option value="today">{al ? 'Sot' : 'Today'}</option>
            <option value="month">{al ? 'Ky muaj' : 'This month'}</option>
            <option value="year">{al ? 'Ky vit' : 'This year'}</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={5} /> : filteredServices.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title={search ? (al ? 'Asnjë rezultat' : 'No results') : (al ? 'Nuk ka punë' : 'No jobs found')}
            description={search ? (al ? `Asgjë nuk përputhet me “${search}”.` : `Nothing matches “${search}”.`) : (al ? 'Provo një filtër tjetër ose krijo një punë të re.' : 'Try another filter or create a new job.')}
          />
        ) : (
          <div className="table-scroll">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th>{al ? 'Data' : 'Date'}</th>
                  <th>{al ? 'Vetura' : 'Vehicle'}</th>
                  <th>{al ? 'Klienti' : 'Client'}</th>
                  <th>{al ? 'Shërbimi' : 'Work'}</th>
                  <th>{al ? 'Statusi' : 'Status'}</th>
                  <th className="text-right">{t.total}</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filteredServices.map(s => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => navigate(`/services?edit=${s.id}`)}>
                    <td className="whitespace-nowrap text-gray-600">{formatDate(s.service_date || s.created_at)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {s.cars?.plate && <span className="plate">{s.cars.plate}</span>}
                        <span className="text-gray-900 whitespace-nowrap">{vehicleName(s.cars?.make, s.cars?.model)}</span>
                      </div>
                    </td>
                    <td className="text-gray-700">{s.cars?.clients?.full_name || '—'}</td>
                    <td className="text-gray-600 max-w-[260px] truncate" title={(s.service_items || []).map(i => i.description).join(', ')}>
                      {s.description || '—'}
                    </td>
                    <td><StatusBadge status={s.status} language={language} /></td>
                    <td className="text-right font-mono font-medium text-gray-900 whitespace-nowrap">{money(s.cost)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => navigate(`/services?edit=${s.id}`)} className="btn-icon" title={t.edit}><Pencil size={15} /></button>
                        <button onClick={() => navigate(`/invoices/${s.id}`)} className="btn-icon" title={al ? 'Fatura' : 'Invoice'}><FileText size={15} /></button>
                        <button onClick={() => handleDeleteService(s.id)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && services.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {al ? `${filteredServices.length} nga ${services.length} punë` : `Showing ${filteredServices.length} of ${services.length} jobs`}
          {filteredServices.length > 0 && ` · ${al ? 'Totali' : 'Total'} ${money(filteredServices.reduce((a, s) => a + (Number(s.cost) || 0), 0))}`}
        </p>
      )}
    </div>
  );
}
