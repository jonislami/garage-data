import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Pencil, Users, X, Check, Phone, Mail } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, useToast } from '../components/ui';
import { matches } from '../lib/format';
import { vehicleName } from '../lib/vehicle';

const EMPTY = { full_name: '', phone: '', email: '', address: '' };

export default function Clients() {
  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';
  const toast = useToast();

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(EMPTY);

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem('sonic_clients_cache') || 'null');
      if (c) setClients(c);
    } catch { /* ignore */ }
  }

  async function fetchData() {
    setLoading(true);
    if (!isOnline) { loadCache(); setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        let res = await supabase.from('clients').select('*, cars(id, plate, make, model)')
          .eq('workshop_id', profile.workshop_id).order('full_name');
        if (res.error) {
          // Fallback if the clients→cars relation isn't exposed
          res = await supabase.from('clients').select('*').eq('workshop_id', profile.workshop_id).order('full_name');
        }
        setClients(res.data || []);
        localStorage.setItem('sonic_clients_cache', JSON.stringify(res.data || []));
      }
    } catch (error) {
      console.error('Fetch error (fallback to cache):', error);
      loadCache();
    }
    setLoading(false);
  }

  function handleCancel() {
    setShowForm(false); setEditingId(null); setFormData(EMPTY);
  }

  function handleEdit(client) {
    setFormData({ full_name: client.full_name || '', phone: client.phone || '', email: client.email || '', address: client.address || '' });
    setEditingId(client.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(client) {
    const msg = al ? `Fshi klientin “${client.full_name}”?` : `Delete client “${client.full_name}”?`;
    if (!window.confirm(msg)) return;
    const id = client.id;
    if (!isOnline) {
      setClients(prev => prev.filter(c => c.id !== id));
      const cache = JSON.parse(localStorage.getItem('sonic_clients_cache') || '[]');
      localStorage.setItem('sonic_clients_cache', JSON.stringify(cache.filter(c => c.id !== id)));
      if (!String(id).startsWith('temp-')) {
        addToQueue('clients', 'DELETE', { id });
        toast.info(al ? 'Offline: u fshi lokalisht, do të sinkronizohet.' : 'Offline: deleted locally, will sync.');
      }
      return;
    }
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
      return toast.error(/foreign key/i.test(error.message)
        ? (al ? 'Ky klient ka vetura ose fatura. Fshini ato së pari.' : 'This client still has vehicles or invoices. Remove those first.')
        : (al ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
    }
    toast.success(al ? 'Klienti u fshi.' : 'Client deleted.');
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

      const payload = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        workshop_id: workshopId,
      };

      if (!isOnline) {
        const cache = JSON.parse(localStorage.getItem('sonic_clients_cache') || '[]');
        if (editingId) {
          addToQueue('clients', 'UPDATE', { id: editingId, ...payload });
          const updated = cache.map(c => c.id === editingId ? { ...c, ...payload } : c);
          setClients(updated);
          localStorage.setItem('sonic_clients_cache', JSON.stringify(updated));
        } else {
          addToQueue('clients', 'INSERT', payload);
          const temp = { id: 'temp-' + Date.now(), ...payload, created_at: new Date().toISOString() };
          setClients([temp, ...cache]);
          localStorage.setItem('sonic_clients_cache', JSON.stringify([temp, ...cache]));
        }
        toast.info(al ? 'Offline: u ruajt lokalisht, do të sinkronizohet.' : 'Offline: saved locally, will sync.');
        handleCancel();
        return;
      }

      const { error } = editingId
        ? await supabase.from('clients').update(payload).eq('id', editingId)
        : await supabase.from('clients').insert([payload]);
      if (error) throw error;
      toast.success(editingId ? (al ? 'Klienti u përditësua.' : 'Client updated.') : (al ? 'Klienti u shtua.' : 'Client added.'));
      handleCancel();
      fetchData();
    } catch (error) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Save error: ') + error.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => clients.filter(c => matches(
    search, c.full_name, c.phone, c.email, c.address,
    ...(c.cars || []).map(car => car.plate),
  )), [clients, search]);

  const set = key => e => setFormData({ ...formData, [key]: e.target.value });

  return (
    <div className="page">
      <PageHeader title={t.page_title_clients} subtitle={t.page_desc_clients}>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={16} /> {t.add_client}</button>
        )}
      </PageHeader>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-5 max-w-3xl animate-fade-in">
          <div className="card-header">
            <h2 className="card-title">{editingId ? (al ? 'Ndrysho klientin' : 'Edit client') : (al ? 'Klient i ri' : 'New client')}</h2>
            <button type="button" onClick={handleCancel} className="btn-icon" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">{al ? 'Emri i plotë' : 'Full name'} *</label>
              <input required className="input" value={formData.full_name} onChange={set('full_name')} />
            </div>
            <div>
              <label className="label">{al ? 'Telefoni' : 'Phone'}</label>
              <input type="tel" className="input" placeholder="+383 4x xxx xxx" value={formData.phone} onChange={set('phone')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={formData.email} onChange={set('email')} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">{al ? 'Adresa' : 'Address'}</label>
              <input className="input" value={formData.address} onChange={set('address')} />
            </div>
          </div>
          <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button type="button" onClick={handleCancel} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" disabled={saving} className="btn btn-primary"><Check size={16} /> {al ? 'Ruaj klientin' : 'Save client'}</button>
          </div>
        </form>
      )}

      <SearchInput
        className="mb-3 md:max-w-md"
        value={search}
        onChange={setSearch}
        placeholder={al ? 'Kërko me emër, telefon, email ose targa…' : 'Search by name, phone, email or plate…'}
      />

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={4} /> : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={al ? 'Asnjë klient nuk u gjet' : 'No clients found'}
            description={search ? (al ? `Asgjë nuk përputhet me “${search}”.` : `Nothing matches “${search}”.`) : (al ? 'Shtoni klientin e parë.' : 'Add your first client.')}
          />
        ) : (
          <div className="table-scroll">
            <table className="table min-w-[680px]">
              <thead>
                <tr>
                  <th>{al ? 'Emri' : 'Name'}</th>
                  <th>{al ? 'Kontakti' : 'Contact'}</th>
                  <th>{al ? 'Adresa' : 'Address'}</th>
                  <th>{al ? 'Veturat' : 'Vehicles'}</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium text-gray-900">{c.full_name}</td>
                    <td>
                      <div className="space-y-0.5 text-[13px]">
                        {c.phone ? <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-gray-700 hover:text-blue-700"><Phone size={12} className="text-gray-400" />{c.phone}</a> : null}
                        {c.email ? <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-gray-500 hover:text-blue-700"><Mail size={12} className="text-gray-400" />{c.email}</a> : null}
                        {!c.phone && !c.email && <span className="text-gray-300">—</span>}
                      </div>
                    </td>
                    <td className="text-gray-600">{c.address || <span className="text-gray-300">—</span>}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {(c.cars || []).length === 0
                          ? <span className="text-gray-300">—</span>
                          : c.cars.map(car => <span key={car.id} className="plate" title={vehicleName(car.make, car.model)}>{car.plate}</span>)}
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => handleEdit(c)} className="btn-icon" title={t.edit}><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(c)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && clients.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">{al ? `${filtered.length} nga ${clients.length} klientë` : `Showing ${filtered.length} of ${clients.length} clients`}</p>
      )}
    </div>
  );
}
