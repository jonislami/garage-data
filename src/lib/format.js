// Shared formatting helpers so money and dates look the same everywhere.

export function formatMoney(value, currency = '€') {
  const n = Number(value) || 0;
  const abs = Math.abs(n).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = n < 0 ? '-' : '';
  // "L" (Albanian lek) is normally written after the amount
  if (currency === 'L') return `${sign}${abs} L`;
  return `${sign}${currency}${abs}`;
}

// DD.MM.YYYY – the common format in Kosovo / Albania
export function formatDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

// Local YYYY-MM-DD (toISOString() uses UTC and can shift the day)
export function todayISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Returns a Date for a service/expense row, preferring the business date over created_at
export function rowDate(row, field) {
  const v = row?.[field] || row?.created_at;
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
}

// Regular (fiscal) invoices have their own monthly sequence, e.g. 01/092026
export function invoiceNumber(row) {
  if (row?.regular_number) return row.regular_number;
  if (!row?.id) return '—';
  return `#${String(row.id).split('-')[0].toUpperCase()}`;
}

// Normalises text for searching: lowercase, no accents (ë -> e, ç -> c), no spaces/dashes
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_.\/]/g, '');
}

export function matches(term, ...fields) {
  const q = normalize(term);
  if (!q) return true;
  return fields.some(f => normalize(f).includes(q));
}
