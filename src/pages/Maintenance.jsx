import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, QrCode, Trash2, X, Check, ChevronDown, ChevronUp, Wrench, Gauge, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, useToast } from '../components/ui';
import { formatDate, todayISO, matches } from '../lib/format';
import { vehicleName } from '../lib/vehicle';
import {
  PRESET_ITEMS, itemLabel, customKey, currentStatus, formatKm, STATUS_STYLE, statusLabel, vehicleQrUrl,
} from '../lib/maintenance';
import QrStickerDialog from '../components/QrStickerDialog';

const CARS_CACHE = 'sonic_maint_cars_cache';
const historyCacheKey = carId => `sonic_maint_history_${carId}`;

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export default function Maintenance() {
  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const al = language === 'al';
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const carId = params.get('car');

  const [cars, setCars] = useState([]);
  const [loadingCars, setLoadingCars] = useState(true);
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [workshop, setWorkshop] = useState(null);

  const car = cars.find(c => c.id === carId);

  useEffect(() => { loadCars(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    setShowForm(false);
    if (carId) loadHistory(carId); else setRecords([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId]);

  async function loadCars() {
    setLoadingCars(true);
    if (!isOnline) { setCars(readCache(CARS_CACHE) || []); setLoadingCars(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile?.workshop_id) {
        const [carsRes, shopRes] = await Promise.all([
          supabase.from('cars').select('id, make, model, year, plate, engine, qr_token, clients(full_name, phone)')
            .eq('workshop_id', profile.workshop_id).order('plate'),
          supabase.from('workshops').select('name, phone, logo_url, website, address, email').eq('id', profile.workshop_id).single(),
        ]);
        setCars(carsRes.data || []);
        setWorkshop(shopRes.data || null);
        writeCache(CARS_CACHE, carsRes.data || []);
      }
    } catch (e) {
      console.error(e);
      setCars(readCache(CARS_CACHE) || []);
    }
    setLoadingCars(false);
  }

  async function loadHistory(id) {
    setLoadingHistory(true);
    if (!isOnline) { setRecords(readCache(historyCacheKey(id)) || []); setLoadingHistory(false); return; }
    const { data, error } = await supabase.from('maintenance_records')
      .select('id, mileage, service_date, notes, created_at, items:maintenance_items(item_key, item_name, brand, spec, quantity, interval_km, interval_months, due_km, due_date, created_at)')
      .eq('car_id', id)
      .order('service_date', { ascending: false })
      .order('mileage', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      toast.error((al ? 'Gabim: ' : 'Error: ') + error.message);
      setRecords(readCache(historyCacheKey(id)) || []);
    } else {
      const sorted = (data || []).map(r => ({ ...r, items: [...(r.items || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) }));
      setRecords(sorted);
      writeCache(historyCacheKey(id), sorted);
    }
    setLoadingHistory(false);
  }

  async function deleteRecord(r) {
    const msg = al
      ? `Fshi servisin e ${formatDate(r.service_date)} (${formatKm(r.mileage)})? Kjo ndikon edhe në faqen e QR.`
      : `Delete the service of ${formatDate(r.service_date)} (${formatKm(r.mileage)})? This also updates the QR page.`;
    if (!window.confirm(msg)) return;
    if (!isOnline) return toast.error(al ? 'Fshirja kërkon internet.' : 'Deleting requires internet.');
    const { error } = await supabase.from('maintenance_records').delete().eq('id', r.id);
    if (error) return toast.error((al ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
    toast.success(al ? 'Servisi u fshi.' : 'Service deleted.');
    loadHistory(carId);
  }

  const status = useMemo(() => currentStatus(records), [records]);
  const filteredCars = useMemo(() => cars.filter(c => matches(search, c.plate, c.make, c.model, vehicleName(c.make, c.model), c.clients?.full_name)), [cars, search]);

  // ---- Car picker ----
  if (!carId || (!car && !loadingCars)) {
    return (
      <div className="page">
        <PageHeader
          title={al ? 'Servisimi' : 'Maintenance'}
          subtitle={al ? 'Zgjidhni veturën për të regjistruar servisin dhe për QR kodin e saj.' : 'Pick a vehicle to record a service and get its QR code.'}
        />
        <SearchInput className="mb-3 md:max-w-md" value={search} onChange={setSearch}
          placeholder={al ? 'Kërko: targa, vetura, pronari…' : 'Search: plate, vehicle, owner…'} />
        <div className="card overflow-hidden">
          {loadingCars ? <TableSkeleton rows={6} cols={3} /> : filteredCars.length === 0 ? (
            <EmptyState icon={Wrench} title={al ? 'Asnjë veturë' : 'No vehicles'}
              description={al ? 'Shtoni vetura te faqja Veturat.' : 'Add vehicles on the Vehicles page.'} />
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredCars.map(c => (
                <li key={c.id}>
                  <button onClick={() => setParams({ car: c.id })} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    {c.plate && <span className="plate">{c.plate}</span>}
                    <span className="flex-1 min-w-0">
                      <span className="block text-gray-900 truncate">{vehicleName(c.make, c.model)}{c.year ? ` (${c.year})` : ''}</span>
                      <span className="block text-xs text-gray-500 truncate">{c.clients?.full_name || '—'}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  if (!car) return <div className="page"><TableSkeleton rows={4} cols={3} /></div>;

  // ---- One vehicle ----
  return (
    <div className="page max-w-5xl">
      {showQr && <QrStickerDialog car={car} workshop={workshop} al={al} onClose={() => setShowQr(false)} />}

      <button onClick={() => setParams({})} className="btn btn-ghost -ml-2 mb-2">← {al ? 'Të gjitha veturat' : 'All vehicles'}</button>
      <PageHeader
        title={<span className="flex items-center gap-2">{car.plate && <span className="plate">{car.plate}</span>}{vehicleName(car.make, car.model)}{car.year ? ` (${car.year})` : ''}</span>}
        subtitle={car.clients?.full_name || ''}
      >
        <button onClick={() => setShowQr(true)} className="btn btn-secondary"><QrCode size={16} /> {al ? 'QR kodi' : 'QR code'}</button>
        {car.qr_token && (
          <a href={vehicleQrUrl(car.qr_token)} target="_blank" rel="noreferrer" className="btn btn-secondary">
            <ExternalLink size={16} /> {al ? 'Faqja e klientit' : 'Customer page'}
          </a>
        )}
        {!showForm && <button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={16} /> {al ? 'Servis i ri' : 'New service'}</button>}
      </PageHeader>

      {showForm && (
        <ServiceForm
          al={al} car={car} records={records} isOnline={isOnline} addToQueue={addToQueue} toast={toast}
          onCancel={() => setShowForm(false)}
          onSaved={optimistic => {
            setShowForm(false);
            if (optimistic) {
              const next = [optimistic, ...records];
              setRecords(next);
              writeCache(historyCacheKey(carId), next);
            } else {
              loadHistory(carId);
            }
          }}
        />
      )}

      {loadingHistory ? <TableSkeleton rows={4} cols={4} /> : records.length === 0 ? (
        !showForm && (
          <div className="card">
            <EmptyState icon={Wrench} title={al ? 'Ende pa servis' : 'No services yet'}
              description={al ? 'Regjistroni servisin e parë. QR kodi do të tregojë automatikisht të dhënat.' : 'Record the first service. The QR page will show it automatically.'}
              action={<button onClick={() => setShowForm(true)} className="btn btn-primary"><Plus size={16} /> {al ? 'Servis i ri' : 'New service'}</button>} />
          </div>
        )
      ) : (
        <>
          <div className="card overflow-hidden mb-5">
            <div className="card-header">
              <h2 className="card-title">{al ? 'Gjendja aktuale' : 'Current status'}</h2>
              <span className="text-xs text-gray-500 inline-flex items-center gap-1"><Gauge size={13} />{al ? 'Kilometrazhi i fundit:' : 'Last mileage:'} {formatKm(status.knownKm)}</span>
            </div>
            <div className="table-scroll">
              <table className="table min-w-[640px]">
                <thead>
                  <tr>
                    <th>{al ? 'Pjesa' : 'Item'}</th>
                    <th>{al ? 'Ndërruar' : 'Changed'}</th>
                    <th>{al ? 'Servisi i radhës' : 'Next due'}</th>
                    <th>{al ? 'Statusi' : 'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {status.items.map(i => (
                    <tr key={i.item_key} className="hover:!bg-transparent">
                      <td>
                        <p className="text-gray-900">{i.item_name}</p>
                        {(i.brand || i.spec || i.quantity) && <p className="text-xs text-gray-500">{[i.brand, i.spec, i.quantity].filter(Boolean).join(' · ')}</p>}
                      </td>
                      <td className="whitespace-nowrap text-gray-600">{formatKm(i.changed_km)}<br /><span className="text-xs">{formatDate(i.changed_date)}</span></td>
                      <td className="whitespace-nowrap text-gray-900">{i.due_km != null ? formatKm(i.due_km) : '—'}<br /><span className="text-xs text-gray-600">{i.due_date ? formatDate(i.due_date) : '—'}</span></td>
                      <td><span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[i.status]}`}>{statusLabel(i.status, al)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <h2 className="section-label">{al ? 'Historia e servisit' : 'Service history'}</h2>
          <div className="space-y-2">
            {records.map((r, idx) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">{formatDate(r.service_date)}</span>
                    <span className="mx-2 text-gray-300">·</span>
                    <span className="text-gray-700">{formatKm(r.mileage)}</span>
                    {idx === 0 && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{al ? 'I fundit' : 'Latest'}</span>}
                    {String(r.id).startsWith('pending-') && <span className="ml-2 text-xs text-amber-700">{al ? 'në pritje të sinkronizimit' : 'waiting to sync'}</span>}
                  </div>
                  {!String(r.id).startsWith('pending-') && (
                    <button onClick={() => deleteRecord(r)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}><Trash2 size={15} /></button>
                  )}
                </div>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2 text-sm">
                  {r.items.map((it, k) => (
                    <li key={k} className="text-gray-700">
                      • {it.item_name}
                      {(it.brand || it.spec || it.quantity) && <span className="text-gray-500"> — {[it.brand, it.spec, it.quantity].filter(Boolean).join(' · ')}</span>}
                      <span className="block pl-3 text-xs text-gray-500">
                        {al ? 'Radha:' : 'Next:'} {[it.due_km != null && formatKm(it.due_km), it.due_date && formatDate(it.due_date)].filter(Boolean).join(' / ') || '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {r.notes && <p className="mt-2 text-xs text-gray-500 whitespace-pre-wrap">{r.notes}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// New service form
// ---------------------------------------------------------------------------
function addMonths(iso, months) {
  const d = new Date(`${iso}T00:00:00`);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0); // e.g. 31 Jan + 1 month -> 28/29 Feb
  return todayISO(d);
}

function ServiceForm({ al, car, records, isOnline, addToQueue, toast, onCancel, onSaved }) {
  const lastKm = records[0]?.mileage ?? null;

  // Reuse the intervals/details last used on this car for each item
  const lastUsed = useMemo(() => {
    const map = {};
    for (const r of records) for (const it of r.items || []) if (!map[it.item_key]) map[it.item_key] = it;
    return map;
  }, [records]);

  const initialRow = preset => {
    const prev = lastUsed[preset.key];
    return {
      key: preset.key, name: itemLabel(preset, al), selected: false,
      km: prev ? prev.interval_km ?? '' : preset.km ?? '',
      months: prev ? prev.interval_months ?? '' : preset.months ?? '',
      brand: prev?.brand || '', spec: prev?.spec || '', quantity: prev?.quantity || '',
      showDetails: !!preset.details,
    };
  };

  const [mileage, setMileage] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState(() => PRESET_ITEMS.map(initialRow));
  const [customName, setCustomName] = useState('');
  const [saving, setSaving] = useState(false);

  const update = (idx, patch) => setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  function addCustom() {
    const name = customName.trim();
    if (!name) return;
    const key = customKey(name);
    if (rows.some(r => r.key === key)) return toast.error(al ? 'Kjo pjesë është tashmë në listë.' : 'This item is already in the list.');
    const prev = lastUsed[key];
    setRows(rs => [...rs, {
      key, name, selected: true, custom: true,
      km: prev?.interval_km ?? '', months: prev?.interval_months ?? '',
      brand: prev?.brand || '', spec: prev?.spec || '', quantity: prev?.quantity || '', showDetails: false,
    }]);
    setCustomName('');
  }

  // Custom items used on this car before appear in the list too
  useEffect(() => {
    const extra = Object.values(lastUsed).filter(it => it.item_key.startsWith('custom:'));
    if (!extra.length) return;
    setRows(rs => [...rs, ...extra.filter(it => !rs.some(r => r.key === it.item_key)).map(it => ({
      key: it.item_key, name: it.item_name, selected: false, custom: true,
      km: it.interval_km ?? '', months: it.interval_months ?? '',
      brand: it.brand || '', spec: it.spec || '', quantity: it.quantity || '', showDetails: false,
    }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const km = parseInt(mileage, 10);
  const selected = rows.filter(r => r.selected);
  const toInt = v => { const n = parseInt(v, 10); return Number.isInteger(n) && n > 0 ? n : null; };

  async function save(e) {
    e.preventDefault();
    if (!Number.isInteger(km) || km < 0) return toast.error(al ? 'Shkruani kilometrazhin aktual.' : 'Enter the current mileage.');
    if (selected.length === 0) return toast.error(al ? 'Zgjidhni të paktën një pjesë që u ndërrua.' : 'Select at least one item that was changed.');
    if (lastKm != null && km < lastKm && !window.confirm(al
      ? `Kilometrazhi (${formatKm(km)}) është më i vogël se servisi i fundit (${formatKm(lastKm)}). Vazhdo?`
      : `The mileage (${formatKm(km)}) is lower than the last service (${formatKm(lastKm)}). Continue?`)) return;

    setSaving(true);
    try {
      let workshopId = localStorage.getItem('sonic_workshop_id');
      if (!workshopId && isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
        workshopId = profile?.workshop_id;
      }
      if (!workshopId) throw new Error(al ? 'Nuk u gjet ofiçina. Lidhuni me internet.' : 'Workshop not found. Please connect to the internet.');

      const recordId = crypto.randomUUID();
      const record = { id: recordId, workshop_id: workshopId, car_id: car.id, mileage: km, service_date: date, notes: notes.trim() || null };
      const items = selected.map(r => ({
        record_id: recordId, workshop_id: workshopId, item_key: r.key, item_name: r.name.trim(),
        brand: r.brand.trim() || null, spec: r.spec.trim() || null, quantity: r.quantity.trim() || null,
        interval_km: toInt(r.km), interval_months: toInt(r.months),
      }));

      if (!isOnline) {
        addToQueue('maintenance_records', 'INSERT', record);
        items.forEach(it => addToQueue('maintenance_items', 'INSERT', it));
        toast.info(al ? 'Offline: servisi u ruajt dhe do të sinkronizohet.' : 'Offline: service saved and will sync.');
        onSaved({
          ...record, id: `pending-${recordId}`,
          items: items.map(it => ({
            ...it,
            due_km: it.interval_km ? km + it.interval_km : null,
            due_date: it.interval_months ? addMonths(date, it.interval_months) : null,
          })),
        });
        return;
      }

      const { error: recErr } = await supabase.from('maintenance_records').insert(record);
      if (recErr) throw recErr;
      const { error: itemErr } = await supabase.from('maintenance_items').insert(items);
      if (itemErr) {
        await supabase.from('maintenance_records').delete().eq('id', recordId);
        throw itemErr;
      }
      toast.success(al ? 'Servisi u ruajt. Faqja e QR u përditësua.' : 'Service saved. The QR page is updated.');
      onSaved(null);
    } catch (err) {
      toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Save error: ') + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="card mb-5 animate-fade-in">
      <div className="card-header">
        <h2 className="card-title">{al ? 'Servis i ri' : 'New service'}</h2>
        <button type="button" onClick={onCancel} className="btn-icon" aria-label="Close"><X size={16} /></button>
      </div>

      <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-gray-200">
        <div>
          <label className="label">{al ? 'Kilometrazhi aktual' : 'Current mileage'} *</label>
          <input required autoFocus type="number" inputMode="numeric" min="0" className="input font-code" value={mileage}
            placeholder={lastKm != null ? `${al ? 'i fundit' : 'last'}: ${lastKm}` : 'p.sh. 186450'}
            onChange={e => setMileage(e.target.value)} />
        </div>
        <div>
          <label className="label">{al ? 'Data' : 'Date'}</label>
          <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div className="p-4 md:p-5">
        <p className="section-label">{al ? 'Çfarë u ndërrua?' : 'What was changed?'}</p>
        <div className="space-y-2">
          {rows.map((r, idx) => {
            const iKm = toInt(r.km);
            const iMonths = toInt(r.months);
            return (
              <div key={r.key} className={`rounded-md border ${r.selected ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer select-none">
                  <input type="checkbox" className="h-4 w-4" checked={r.selected} onChange={e => update(idx, { selected: e.target.checked })} />
                  <span className="flex-1 text-sm font-medium text-gray-900">{r.name}</span>
                  {!r.selected && (r.km || r.months) && (
                    <span className="text-xs text-gray-400">{[r.km && `${Number(r.km).toLocaleString('de-DE')} km`, r.months && `${r.months} ${al ? 'muaj' : 'mo'}`].filter(Boolean).join(' / ')}</span>
                  )}
                </label>
                {r.selected && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label">{al ? 'Intervali (km)' : 'Interval (km)'}</label>
                        <input type="number" inputMode="numeric" min="1" className="input" value={r.km} onChange={e => update(idx, { km: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">{al ? 'Intervali (muaj)' : 'Interval (months)'}</label>
                        <input type="number" inputMode="numeric" min="1" className="input" value={r.months} onChange={e => update(idx, { months: e.target.value })} />
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">
                      {al ? 'Servisi i radhës:' : 'Next due:'}{' '}
                      <span className="font-medium text-gray-900">
                        {[iKm && Number.isInteger(km) && formatKm(km + iKm), iMonths && date && formatDate(addMonths(date, iMonths))].filter(Boolean).join(al ? ' ose ' : ' or ')
                          || (al ? 'pa afat' : 'no interval')}
                      </span>
                    </p>
                    <button type="button" onClick={() => update(idx, { showDetails: !r.showDetails })} className="inline-flex items-center gap-1 text-xs text-blue-700">
                      {r.showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {al ? 'Detaje (opsionale)' : 'Details (optional)'}
                    </button>
                    {r.showDetails && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input className="input" placeholder={al ? 'Marka (p.sh. Castrol)' : 'Brand (e.g. Castrol)'} value={r.brand} onChange={e => update(idx, { brand: e.target.value })} />
                        <input className="input" placeholder={al ? 'Lloji (p.sh. 5W-30)' : 'Type (e.g. 5W-30)'} value={r.spec} onChange={e => update(idx, { spec: e.target.value })} />
                        <input className="input" placeholder={al ? 'Sasia (p.sh. 4.5 L)' : 'Quantity (e.g. 4.5 L)'} value={r.quantity} onChange={e => update(idx, { quantity: e.target.value })} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <input className="input flex-1" placeholder={al ? 'Pjesë tjetër (p.sh. Amortizatorët)' : 'Other item (e.g. Shock absorbers)'}
            value={customName} onChange={e => setCustomName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} />
          <button type="button" onClick={addCustom} className="btn btn-secondary"><Plus size={16} /> {al ? 'Shto' : 'Add'}</button>
        </div>

        <div className="mt-4">
          <label className="label">{al ? 'Shënime' : 'Notes'}</label>
          <textarea rows={2} className="input" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{selected.length} {al ? 'pjesë të zgjedhura' : 'items selected'}</span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="btn btn-secondary">{al ? 'Anulo' : 'Cancel'}</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} {al ? 'Ruaj servisin' : 'Save service'}
          </button>
        </div>
      </div>
    </form>
  );
}
