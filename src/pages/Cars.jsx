import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Pencil, Search, Car, X, Check, RefreshCw, Wand2, QrCode } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, useToast } from '../components/ui';
import { matches } from '../lib/format';
import { MAKES, canonicalMake, tidyModel, vehicleName } from '../lib/vehicle';

const EMPTY = { client_id: '', make: '', model: '', year: '', plate: '', vin: '', engine_type: 'Diesel' };

export default function Cars() {
  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';
  const toast = useToast();

  const [cars, setCars] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState(EMPTY);

  useEffect(() => { fetchData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem('sonic_cars_cache') || 'null'); if (c) setCars(c);
      const k = JSON.parse(localStorage.getItem('sonic_clients_cache') || 'null'); if (k) setClients(k);
    } catch { /* ignore */ }
  }

  async function fetchData() {
    setLoading(true);
    if (!isOnline) { loadCache(); setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const [carRes, clientRes] = await Promise.all([
          supabase.from('cars').select('*, clients(full_name, phone)').eq('workshop_id', profile.workshop_id).order('created_at', { ascending: false }),
          supabase.from('clients').select('id, full_name, phone').eq('workshop_id', profile.workshop_id).order('full_name'),
        ]);
        setCars(carRes.data || []);
        setClients(clientRes.data || []);
        localStorage.setItem('sonic_cars_cache', JSON.stringify(carRes.data || []));
        localStorage.setItem('sonic_clients_cache', JSON.stringify(clientRes.data || []));
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

  function handleEdit(car) {
    setFormData({
      client_id: car.client_id || '', make: car.make || '', model: car.model || '',
      year: car.year || '', plate: car.plate || '', vin: car.vin || '', engine_type: car.engine_type || 'Diesel',
    });
    setEditingId(car.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDecodeVIN() {
    if (!formData.vin || formData.vin.length < 11) {
      return toast.error(al ? 'Shënoni një VIN të vlefshëm (të paktën 11 karaktere).' : 'Enter a valid VIN (at least 11 characters).');
    }
    setIsDecoding(true);
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${formData.vin}?format=json`);
      const data = await response.json();
      const get = name => data.Results.find(r => r.Variable === name)?.Value || '';
      const make = get('Make'), model = get('Model'), year = get('Model Year'), fuel = get('Fuel Type - Primary').toLowerCase();

      let engineType = formData.engine_type;
      if (fuel.includes('gasoline') || fuel.includes('petrol')) engineType = 'Petrol';
      else if (fuel.includes('diesel')) engineType = 'Diesel';
      else if (fuel.includes('electric')) engineType = 'Electric';
      else if (fuel.includes('hybrid')) engineType = 'Hybrid';

      if (!make && !model) throw new Error('empty');
      setFormData(prev => ({
        ...prev,
        make: make && make !== 'null' ? canonicalMake(make) : prev.make,
        model: model && model !== 'null' ? tidyModel(model) : prev.model,
        year: year && year !== 'null' ? year : prev.year,
        engine_type: engineType,
      }));
      toast.success(al ? 'VIN u dekodua.' : 'VIN decoded.');
    } catch {
      toast.error(al ? 'Ky VIN nuk u dekodua. Shkruani detajet manualisht.' : 'Could not decode this VIN. Please enter the details manually.');
    }
    setIsDecoding(false);
  }

  async function handleDelete(car) {
    const msg = al ? `Fshi veturën ${car.plate}?` : `Delete vehicle ${car.plate}?`;
    if (!window.confirm(msg)) return;
    const id = car.id;
    if (!isOnline) {
      setCars(prev => prev.filter(c => c.id !== id));
      const cache = JSON.parse(localStorage.getItem('sonic_cars_cache') || '[]');
      localStorage.setItem('sonic_cars_cache', JSON.stringify(cache.filter(c => c.id !== id)));
      if (!String(id).startsWith('temp-')) {
        addToQueue('cars', 'DELETE', { id });
        toast.info(al ? 'Offline: u fshi lokalisht, do të sinkronizohet.' : 'Offline: deleted locally, will sync.');
      }
      return;
    }
    const { error } = await supabase.from('cars').delete().eq('id', id);
    if (error) {
      return toast.error(/foreign key/i.test(error.message)
        ? (al ? 'Kjo veturë ka punë ose fatura. Fshini ato së pari.' : 'This vehicle still has jobs or invoices. Remove those first.')
        : (al ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
    }
    toast.success(al ? 'Vetura u fshi.' : 'Vehicle deleted.');
    fetchData();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.client_id) return toast.error(al ? 'Zgjidhni pronarin.' : 'Please select the owner.');

    const plate = formData.plate.toUpperCase().replace(/\s+/g, '').trim();
    const dup = cars.find(c => c.id !== editingId && (c.plate || '').toUpperCase().replace(/\s+/g, '') === plate);
    if (dup && !window.confirm(al ? `Targa ${plate} ekziston tashmë. Të ruhet gjithsesi?` : `Plate ${plate} already exists. Save anyway?`)) return;

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
        ...formData,
        make: canonicalMake(formData.make),
        model: tidyModel(formData.model),
        plate,
        vin: formData.vin.trim().toUpperCase(),
        year: formData.year === '' ? null : formData.year,
        workshop_id: workshopId,
      };

      if (!isOnline) {
        const cache = JSON.parse(localStorage.getItem('sonic_cars_cache') || '[]');
        const owner = clients.find(c => c.id === formData.client_id) || {};
        const optimistic = { ...payload, clients: { full_name: owner.full_name, phone: owner.phone } };
        if (editingId) {
          addToQueue('cars', 'UPDATE', { id: editingId, ...payload });
          const updated = cache.map(c => c.id === editingId ? { ...c, ...optimistic } : c);
          setCars(updated);
          localStorage.setItem('sonic_cars_cache', JSON.stringify(updated));
        } else {
          addToQueue('cars', 'INSERT', payload);
          const temp = { id: 'temp-' + Date.now(), ...optimistic, created_at: new Date().toISOString() };
          setCars([temp, ...cache]);
          localStorage.setItem('sonic_cars_cache', JSON.stringify([temp, ...cache]));
        }
        toast.info(al ? 'Offline: u ruajt lokalisht, do të sinkronizohet.' : 'Offline: saved locally, will sync.');
        handleCancel();
        return;
      }

      const { error } = editingId
        ? await supabase.from('cars').update(payload).eq('id', editingId)
        : await supabase.from('cars').insert([payload]);
      if (error) throw error;
      toast.success(editingId ? (al ? 'Vetura u përditësua.' : 'Vehicle updated.') : (al ? 'Vetura u shtua.' : 'Vehicle added.'));
      handleCancel();
      fetchData();
    } catch (error) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Save error: ') + error.message);
    } finally {
      setSaving(false);
    }
  }

  const untidy = cars.filter(c => !String(c.id).startsWith('temp-') && (
    (c.make || '') !== canonicalMake(c.make || '') || (c.model || '') !== tidyModel(c.model || '') ||
    (c.plate || '') !== (c.plate || '').toUpperCase().replace(/\s+/g, '')
  ));

  async function handleTidyNames() {
    const msg = al
      ? `Rregullo drejtshkrimin e ${untidy.length} veturave (p.sh. “Wolswagen” → “Volkswagen”, targa me shkronja të mëdha)?`
      : `Fix the spelling of ${untidy.length} vehicle(s) (e.g. “Wolswagen” → “Volkswagen”, upper-case plates)?`;
    if (!window.confirm(msg)) return;
    setSaving(true);
    try {
      for (const c of untidy) {
        const { error } = await supabase.from('cars').update({
          make: canonicalMake(c.make || ''), model: tidyModel(c.model || ''),
          plate: (c.plate || '').toUpperCase().replace(/\s+/g, ''),
        }).eq('id', c.id);
        if (error) throw error;
      }
      toast.success(al ? 'Emrat u rregulluan.' : 'Vehicle names tidied.');
      fetchData();
    } catch (error) {
      toast.error((al ? 'Gabim: ' : 'Error: ') + error.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => cars.filter(c => matches(
    search, c.plate, c.make, c.model, `${c.make} ${c.model}`, c.vin, c.clients?.full_name, c.clients?.phone,
  )), [cars, search]);

  const engineLabel = e => ({
    Diesel: al ? 'Naftë' : 'Diesel', Petrol: al ? 'Benzinë' : 'Petrol', Hybrid: al ? 'Hibrid' : 'Hybrid',
    Electric: al ? 'Elektrik' : 'Electric', Other: al ? 'Tjetër' : 'Other',
  }[e] || e || '—');

  const set = key => e => setFormData({ ...formData, [key]: e.target.value });

  return (
    <div className="page">
      <PageHeader title={t.page_title_cars} subtitle={t.page_desc_cars}>
        {isOnline && untidy.length > 0 && !showForm && (
          <button onClick={handleTidyNames} disabled={saving} className="btn btn-secondary" title={al ? 'Njëso drejtshkrimin e markave dhe targave' : 'Make brand names and plates consistent'}>
            <Wand2 size={16} /> {al ? `Rregullo emrat (${untidy.length})` : `Tidy names (${untidy.length})`}
          </button>
        )}
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={16} /> {t.add_vehicle}</button>
        )}
      </PageHeader>

      {showForm && (
        <form onSubmit={handleSubmit} className="card mb-5 max-w-4xl animate-fade-in">
          <div className="card-header">
            <h2 className="card-title">{editingId ? (al ? 'Ndrysho veturën' : 'Edit vehicle') : (al ? 'Veturë e re' : 'New vehicle')}</h2>
            <button type="button" onClick={handleCancel} className="btn-icon" aria-label="Close"><X size={16} /></button>
          </div>
          <div className="p-4 md:p-5 grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-3">
              <label className="label">{al ? 'Pronari' : 'Owner'} *</label>
              <select required className="input" value={formData.client_id} onChange={set('client_id')}>
                <option value="">{al ? 'Zgjidh pronarin…' : 'Select owner…'}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="label">{al ? 'Targa' : 'License plate'} *</label>
              <input required placeholder="05-242-HA" className="input font-code uppercase" value={formData.plate}
                onChange={e => setFormData({ ...formData, plate: e.target.value.toUpperCase() })} />
            </div>

            <div className="md:col-span-6">
              <label className="label">{al ? 'Numri i shasisë (VIN)' : 'VIN'}</label>
              <div className="flex gap-2">
                <input placeholder={al ? '17 karaktere' : '17 characters'} maxLength={17} className="input font-code uppercase"
                  value={formData.vin} onChange={e => setFormData({ ...formData, vin: e.target.value.toUpperCase() })} />
                <button type="button" onClick={handleDecodeVIN} disabled={isDecoding} className="btn btn-secondary shrink-0">
                  {isDecoding ? <RefreshCw className="animate-spin" size={15} /> : <Search size={15} />} {al ? 'Dekodo' : 'Decode'}
                </button>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="label">{al ? 'Marka' : 'Make'} *</label>
              <input required list="car-makes" placeholder="Volkswagen" className="input" value={formData.make} onChange={set('make')}
                onBlur={e => setFormData(f => ({ ...f, make: canonicalMake(e.target.value) }))} />
              <datalist id="car-makes">{MAKES.map(m => <option key={m} value={m} />)}</datalist>
            </div>
            <div className="md:col-span-2">
              <label className="label">{al ? 'Modeli' : 'Model'} *</label>
              <input required placeholder="Golf" className="input" value={formData.model} onChange={set('model')} />
            </div>
            <div>
              <label className="label">{al ? 'Viti' : 'Year'}</label>
              <input type="number" min="1950" max={new Date().getFullYear() + 1} placeholder="2015" className="input font-mono" value={formData.year} onChange={set('year')} />
            </div>
            <div>
              <label className="label">{al ? 'Motori' : 'Engine'}</label>
              <select className="input" value={formData.engine_type} onChange={set('engine_type')}>
                {['Diesel', 'Petrol', 'Hybrid', 'Electric', 'Other'].map(e => <option key={e} value={e}>{engineLabel(e)}</option>)}
              </select>
            </div>
          </div>
          <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
            <button type="button" onClick={handleCancel} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
            <button type="submit" disabled={saving} className="btn btn-primary"><Check size={16} /> {al ? 'Ruaj veturën' : 'Save vehicle'}</button>
          </div>
        </form>
      )}

      <SearchInput
        className="mb-3 md:max-w-md"
        value={search}
        onChange={setSearch}
        placeholder={al ? 'Kërko me targa, model, VIN ose pronar…' : 'Search by plate, model, VIN or owner…'}
      />

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={5} /> : filtered.length === 0 ? (
          <EmptyState
            icon={Car}
            title={al ? 'Asnjë veturë nuk u gjet' : 'No vehicles found'}
            description={search ? (al ? `Asgjë nuk përputhet me “${search}”.` : `Nothing matches “${search}”.`) : (al ? 'Shtoni veturën e parë.' : 'Add your first vehicle.')}
          />
        ) : (
          <div className="table-scroll">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>{al ? 'Targa' : 'Plate'}</th>
                  <th>{al ? 'Vetura' : 'Vehicle'}</th>
                  <th>{al ? 'Viti' : 'Year'}</th>
                  <th>{al ? 'Motori' : 'Engine'}</th>
                  <th>{al ? 'Pronari' : 'Owner'}</th>
                  <th>VIN</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(car => (
                  <tr key={car.id}>
                    <td><span className="plate">{car.plate || '—'}</span></td>
                    <td className="font-medium text-gray-900 whitespace-nowrap">{vehicleName(car.make, car.model)}</td>
                    <td className="font-mono text-gray-600">{car.year || '—'}</td>
                    <td className="text-gray-600">{engineLabel(car.engine_type)}</td>
                    <td>
                      <div className="text-gray-900">{car.clients?.full_name || <span className="text-gray-400">{al ? 'I panjohur' : 'Unknown'}</span>}</div>
                      {car.clients?.phone && <div className="text-xs text-gray-500">{car.clients.phone}</div>}
                    </td>
                    <td className="font-code text-xs text-gray-500">{car.vin || '—'}</td>
                    <td>
                      <div className="flex justify-end gap-0.5">
                        <Link to={`/maintenance?car=${car.id}`} className="btn-icon" title={al ? 'Servisimi & QR' : 'Maintenance & QR'}><QrCode size={15} /></Link>
                        <button onClick={() => handleEdit(car)} className="btn-icon" title={t.edit}><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(car)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && cars.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">{al ? `${filtered.length} nga ${cars.length} vetura` : `Showing ${filtered.length} of ${cars.length} vehicles`}</p>
      )}
    </div>
  );
}
