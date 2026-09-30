import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Phone, Globe, MapPin, Gauge, CalendarDays, AlertTriangle, CheckCircle2, Clock, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/format';
import { vehicleName } from '../lib/vehicle';
import { currentStatus, formatKm, STATUS_STYLE, statusLabel } from '../lib/maintenance';

// Public, mobile-first page behind the permanent QR sticker. Always shows the newest data.
export default function VehicleQR() {
  const { token } = useParams();
  const [lang, setLang] = useState(() => {
    try { return localStorage.getItem('qr_lang') || 'al'; } catch { return 'al'; }
  });
  const al = lang === 'al';
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | notfound | error
  const [myKm, setMyKm] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: res, error } = await supabase.rpc('get_vehicle_maintenance', { p_token: token });
      if (!alive) return;
      if (error) {
        setState(/invalid input syntax/i.test(error.message) ? 'notfound' : 'error');
        return;
      }
      if (!res) return setState('notfound');
      setData(res);
      setState('ready');
    })();
    return () => { alive = false; };
  }, [token]);

  function switchLang(next) {
    setLang(next);
    try { localStorage.setItem('qr_lang', next); } catch { /* ignore */ }
  }

  const records = useMemo(() => data?.records || [], [data]);
  const status = useMemo(() => currentStatus(records, myKm), [records, myKm]);
  const latest = records[0];
  const attention = status.items.filter(i => i.status === 'overdue' || i.status === 'soon');

  if (state === 'loading') {
    return <Shell><div className="space-y-3"><div className="skeleton h-24 w-full" /><div className="skeleton h-40 w-full" /></div></Shell>;
  }
  if (state !== 'ready') {
    return (
      <Shell>
        <div className="card p-6 text-center text-gray-600">
          {state === 'notfound'
            ? (al ? 'Ky kod QR nuk është i lidhur me asnjë veturë.' : 'This QR code is not linked to a vehicle.')
            : (al ? 'Të dhënat nuk u ngarkuan. Provoni përsëri.' : 'Could not load the data. Please try again.')}
        </div>
      </Shell>
    );
  }

  const { vehicle, workshop } = data;

  return (
    <Shell lang={lang} onLang={switchLang}>
      {/* Garage */}
      <div className="flex items-center gap-3 mb-4">
        {workshop.logo_url && <img src={workshop.logo_url} alt="" className="h-12 w-12 rounded-md object-contain bg-white border border-gray-200" />}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{workshop.name}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
            {workshop.phone && <a href={`tel:${workshop.phone}`} className="inline-flex items-center gap-1 text-blue-700"><Phone size={12} />{workshop.phone}</a>}
            {workshop.address && <span className="inline-flex items-center gap-1"><MapPin size={12} />{workshop.address}</span>}
            {workshop.website && <span className="inline-flex items-center gap-1"><Globe size={12} />{workshop.website}</span>}
          </div>
        </div>
      </div>

      {/* Vehicle */}
      <div className="card p-4 mb-4">
        <p className="text-lg font-semibold text-gray-900">{vehicleName(vehicle.make, vehicle.model)}{vehicle.year ? ` (${vehicle.year})` : ''}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {vehicle.plate && <span className="plate">{vehicle.plate}</span>}
          {vehicle.engine && <span>{vehicle.engine}</span>}
        </div>
        {latest ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat icon={CalendarDays} label={al ? 'Servisi i fundit' : 'Last service'} value={formatDate(latest.service_date)} />
            <Stat icon={Gauge} label={al ? 'Kilometrazhi' : 'Mileage'} value={formatKm(latest.mileage)} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">{al ? 'Ende nuk ka servis të regjistruar.' : 'No service recorded yet.'}</p>
        )}
      </div>

      {latest && (
        <>
          {/* Optional: the driver's current mileage for an exact status */}
          <div className="card p-4 mb-4">
            <label className="label" htmlFor="mykm">{al ? 'Kilometrazhi aktual i veturës (opsional)' : 'Current mileage of the car (optional)'}</label>
            <input id="mykm" type="number" inputMode="numeric" min="0" className="input" placeholder={String(latest.mileage)}
              value={myKm} onChange={e => setMyKm(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500">
              {al ? 'Shkruani kilometrat nga paneli për të parë saktë çfarë ju skadon.' : 'Enter the reading from your dashboard to see exactly what is due.'}
            </p>
          </div>

          {/* Due soon / overdue */}
          {attention.length > 0 ? (
            <div className="card p-4 mb-4 border-amber-300 bg-amber-50/60">
              <p className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle size={18} />
                {al ? 'Kërkojnë vëmendje' : 'Needs attention'}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {attention.map(i => (
                  <li key={i.item_key} className="flex justify-between gap-2">
                    <span className="text-gray-900">{i.item_name}</span>
                    <span className={i.status === 'overdue' ? 'text-red-700 font-medium' : 'text-amber-800'}>{dueText(i, al)}</span>
                  </li>
                ))}
              </ul>
              {workshop.phone && (
                <a href={`tel:${workshop.phone}`} className="btn btn-primary w-full mt-3"><Phone size={16} /> {al ? 'Rezervo servisin' : 'Book a service'}</a>
              )}
            </div>
          ) : (
            <div className="card p-4 mb-4 flex items-center gap-2 text-emerald-800 bg-emerald-50/60 border-emerald-200">
              <CheckCircle2 size={18} /> {al ? 'Asgjë nuk është e vonuar.' : 'Nothing is overdue.'}
            </div>
          )}

          {/* Current status of every item */}
          <h2 className="section-label">{al ? 'Gjendja e mirëmbajtjes' : 'Maintenance status'}</h2>
          <div className="space-y-2 mb-6">
            {status.items.map(i => (
              <div key={i.item_key} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{i.item_name}</p>
                    {(i.brand || i.spec || i.quantity) && (
                      <p className="text-xs text-gray-500">{[i.brand, i.spec, i.quantity].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[i.status]}`}>{statusLabel(i.status, al)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">{al ? 'Ndërruar' : 'Changed'}</p>
                    <p className="text-gray-900">{formatKm(i.changed_km)}</p>
                    <p className="text-gray-600">{formatDate(i.changed_date)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">{al ? 'Servisi i radhës' : 'Next due'}</p>
                    <p className="text-gray-900">{i.due_km != null ? formatKm(i.due_km) : '—'}</p>
                    <p className="text-gray-600">{i.due_date ? formatDate(i.due_date) : '—'}</p>
                  </div>
                </div>
                {i.status !== 'none' && <p className="mt-1 text-xs text-gray-500">{dueText(i, al)}</p>}
              </div>
            ))}
          </div>

          {/* Full history */}
          <h2 className="section-label">{al ? 'Historia e servisit' : 'Service history'}</h2>
          <ol className="space-y-2 mb-6">
            {records.map((r, idx) => (
              <li key={r.id} className="card p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1.5 font-medium text-gray-900">
                    <Wrench size={14} className="text-gray-400" />{formatDate(r.service_date)}
                    {idx === 0 && <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">{al ? 'I fundit' : 'Latest'}</span>}
                  </span>
                  <span className="text-gray-600">{formatKm(r.mileage)}</span>
                </div>
                <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
                  {r.items.map((it, k) => (
                    <li key={k}>
                      • {it.item_name}
                      {(it.brand || it.spec || it.quantity) && <span className="text-gray-500"> — {[it.brand, it.spec, it.quantity].filter(Boolean).join(' · ')}</span>}
                    </li>
                  ))}
                </ul>
                {r.notes && <p className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{r.notes}</p>}
              </li>
            ))}
          </ol>
        </>
      )}
    </Shell>
  );
}

function dueText(i, al) {
  const parts = [];
  if (i.kmLeft != null) {
    parts.push(i.kmLeft <= 0
      ? (al ? `kaloi ${formatKm(-i.kmLeft)}` : `${formatKm(-i.kmLeft)} over`)
      : (al ? `edhe ${formatKm(i.kmLeft)}` : `${formatKm(i.kmLeft)} left`));
  }
  if (i.daysLeft != null) {
    parts.push(i.daysLeft < 0
      ? (al ? `vonuar ${-i.daysLeft} ditë` : `${-i.daysLeft} days late`)
      : (al ? `edhe ${i.daysLeft} ditë` : `${i.daysLeft} days left`));
  }
  return parts.join(' · ');
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <p className="flex items-center gap-1 text-xs text-gray-500"><Icon size={12} />{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function Shell({ children, lang, onLang }) {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-lg px-4 py-5">
        {onLang && (
          <div className="mb-3 flex justify-end gap-1 text-xs">
            {['al', 'en'].map(l => (
              <button key={l} onClick={() => onLang(l)}
                className={`rounded px-2 py-1 font-medium ${lang === l ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        )}
        {children}
        <p className="mt-8 flex items-center justify-center gap-1 text-center text-[11px] text-gray-400">
          <Clock size={11} /> GarageData
        </p>
      </div>
    </div>
  );
}
