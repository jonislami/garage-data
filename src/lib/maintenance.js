// Service items the mechanic can tick, with default intervals (editable per service).
// `details: true` shows brand / type / quantity fields open by default.
export const PRESET_ITEMS = [
  { key: 'engine_oil', al: 'Vaji i motorit', en: 'Engine oil', km: 10000, months: 12, details: true },
  { key: 'oil_filter', al: 'Filteri i vajit', en: 'Oil filter', km: 10000, months: 12 },
  { key: 'air_filter', al: 'Filteri i ajrit', en: 'Air filter', km: 20000, months: 24 },
  { key: 'cabin_filter', al: 'Filteri i kabinës', en: 'Cabin filter', km: 15000, months: 12 },
  { key: 'fuel_filter', al: 'Filteri i karburantit', en: 'Fuel filter', km: 30000, months: 24 },
  { key: 'brake_pads_front', al: 'Pllakat e frenave (para)', en: 'Brake pads (front)', km: 30000, months: null },
  { key: 'brake_pads_rear', al: 'Pllakat e frenave (prapa)', en: 'Brake pads (rear)', km: 40000, months: null },
  { key: 'brake_fluid', al: 'Lëngu i frenave', en: 'Brake fluid', km: null, months: 24, details: true },
  { key: 'spark_plugs', al: 'Qirinjtë', en: 'Spark plugs', km: 40000, months: 48 },
  { key: 'coolant', al: 'Antifrizi', en: 'Coolant', km: null, months: 48, details: true },
  { key: 'gearbox_oil', al: 'Vaji i kutisë', en: 'Gearbox oil', km: 60000, months: 48, details: true },
  { key: 'timing_belt', al: 'Rripi i distribucionit', en: 'Timing belt', km: 90000, months: 60 },
];

export const itemLabel = (preset, al) => (al ? preset.al : preset.en);

// Custom items get a stable key from their name so their history lines up across visits
export function customKey(name) {
  const slug = String(name).trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `custom:${slug || 'item'}`;
}

export const DUE_SOON_KM = 1000;
export const DUE_SOON_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;
function daysUntil(isoDate, today = new Date()) {
  if (!isoDate) return null;
  const d = new Date(`${isoDate}T00:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / DAY);
}

// records: newest first, each with items[]. Returns the latest record of every item with its status.
// currentKm: the car's current mileage if known (defaults to the highest recorded mileage).
export function currentStatus(records, currentKm) {
  const knownKm = Math.max(Number(currentKm) || 0, ...records.map(r => Number(r.mileage) || 0));
  const seen = new Set();
  const out = [];
  for (const r of records) {
    for (const it of r.items || []) {
      if (seen.has(it.item_key)) continue;
      seen.add(it.item_key);
      const kmLeft = it.due_km != null ? it.due_km - knownKm : null;
      const daysLeft = daysUntil(it.due_date);
      let status = 'ok';
      if (kmLeft == null && daysLeft == null) status = 'none';
      else if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft < 0)) status = 'overdue';
      else if ((kmLeft != null && kmLeft <= DUE_SOON_KM) || (daysLeft != null && daysLeft <= DUE_SOON_DAYS)) status = 'soon';
      out.push({ ...it, changed_km: r.mileage, changed_date: r.service_date, kmLeft, daysLeft, status });
    }
  }
  const order = { overdue: 0, soon: 1, ok: 2, none: 3 };
  return { knownKm, items: out.sort((a, b) => order[a.status] - order[b.status]) };
}

export const formatKm = v => (v == null || v === '' ? '—' : `${Number(v).toLocaleString('de-DE')} km`);

export const STATUS_STYLE = {
  overdue: 'bg-red-50 text-red-700 ring-red-600/20',
  soon: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  none: 'bg-gray-50 text-gray-600 ring-gray-500/20',
};

export const statusLabel = (status, al) => ({
  overdue: al ? 'I vonuar' : 'Overdue',
  soon: al ? 'Së shpejti' : 'Due soon',
  ok: al ? 'Në rregull' : 'OK',
  none: al ? 'Pa afat' : 'No interval',
}[status]);

// Public QR link for a vehicle
export const vehicleQrUrl = token => `${window.location.origin}/v/${token}`;
