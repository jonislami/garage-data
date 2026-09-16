// Backup & restore for a single workshop.
//
// A backup is one JSON file containing every row that belongs to the workshop.
// Restore is a *merge*: rows from the file are inserted, or overwritten if they
// still exist (matched by id). Rows created after the backup are never deleted.

import { supabase } from './supabase';

export const BACKUP_FORMAT = 'garagedata-backup';
export const BACKUP_VERSION = 1;
const PAGE = 1000;
const CHUNK = 400;
const LAST_BACKUP_KEY = 'gd_last_backup_at';

// Groups the user can pick from when restoring. Order matters (foreign keys).
export const RESTORE_GROUPS = [
  { key: 'clients', tables: ['clients', 'cars'] },
  { key: 'inventory', tables: ['inventory'] },
  { key: 'invoices', tables: ['services', 'service_items'] },
  { key: 'expenses', tables: ['expenses'] },
  { key: 'appointments', tables: ['appointments'] },
  { key: 'inspections', tables: ['inspections'] },
];

const WORKSHOP_TABLES = ['clients', 'cars', 'inventory', 'services', 'expenses', 'appointments', 'inspections'];
const RESTORE_ORDER = ['clients', 'cars', 'inventory', 'services', 'service_items', 'expenses', 'appointments', 'inspections'];

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback UUID v4 (older browsers)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// Foreign-key columns and which table's ids they point at. Used when copying a
// backup into a *different* workshop, where every row gets a brand-new id.
const FK_COLUMNS = { client_id: 'clients', car_id: 'cars', service_id: 'services', inventory_id: 'inventory' };

export async function getWorkshop() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data: profile, error } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
  if (error) throw error;
  const { data: shop } = await supabase.from('workshops').select('id, name, currency').eq('id', profile.workshop_id).single();
  return shop || { id: profile.workshop_id };
}

async function fetchAllRows(table, column, value) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select('*').eq(column, value)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchServiceItems(serviceIds) {
  const rows = [];
  for (const ids of chunk(serviceIds, 150)) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('service_items').select('*').in('service_id', ids)
        .range(from, from + PAGE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
  }
  return rows;
}

/** Builds the backup object. onProgress(label) is called as each table loads. */
export async function createBackup(onProgress = () => {}) {
  const workshop = await getWorkshop();
  const data = {};
  const skipped = [];

  for (const table of WORKSHOP_TABLES) {
    onProgress(table);
    try {
      data[table] = await fetchAllRows(table, 'workshop_id', workshop.id);
    } catch (err) {
      // A table that doesn't exist in this project shouldn't break the whole backup
      console.warn(`Backup: skipped ${table}`, err);
      skipped.push(table);
      data[table] = [];
    }
  }

  onProgress('service_items');
  data.service_items = data.services.length ? await fetchServiceItems(data.services.map(s => s.id)) : [];

  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'GarageData',
    created_at: new Date().toISOString(),
    workshop: { id: workshop.id, name: workshop.name, currency: workshop.currency },
    counts,
    skipped,
    data,
  };
}

/**
 * Builds a backup containing ONLY the workshop's stock (inventory).
 * Same file format as a full backup, so Restore accepts it — but small and fast.
 */
export async function createStockBackup(onProgress = () => {}) {
  const workshop = await getWorkshop();
  onProgress('inventory');
  const inventory = await fetchAllRows('inventory', 'workshop_id', workshop.id);
  const data = {
    clients: [], cars: [], inventory, services: [],
    expenses: [], appointments: [], inspections: [], service_items: [],
  };
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'GarageData',
    only: 'inventory',
    created_at: new Date().toISOString(),
    workshop: { id: workshop.id, name: workshop.name, currency: workshop.currency },
    counts: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])),
    skipped: [],
    data,
  };
}

export function downloadFile(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(s) {
  return String(s || 'workshop').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'workshop';
}

function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

export function downloadBackup(backup) {
  const name = `garagedata-backup_${slug(backup.workshop?.name)}_${stamp()}.json`;
  downloadFile(name, JSON.stringify(backup, null, 2), 'application/json');
  try { localStorage.setItem(LAST_BACKUP_KEY, backup.created_at); } catch { /* ignore */ }
  return name;
}

/** Stock-only backup file. Does NOT update the "last full backup" reminder. */
export function downloadStockBackup(backup) {
  const name = `garagedata-stock_${slug(backup.workshop?.name)}_${stamp()}.json`;
  downloadFile(name, JSON.stringify(backup, null, 2), 'application/json');
  return name;
}

export function getLastBackupAt() {
  try { return localStorage.getItem(LAST_BACKUP_KEY); } catch { return null; }
}

/** Reads and validates a backup file chosen by the user. */
export async function readBackupFile(file) {
  const text = await file.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('INVALID_JSON'); }
  if (!json || json.format !== BACKUP_FORMAT || typeof json.data !== 'object') throw new Error('NOT_A_BACKUP');
  if (json.version > BACKUP_VERSION) throw new Error('NEWER_VERSION');
  return json;
}

/**
 * Restores the selected groups from a backup into the CURRENT workshop.
 * @param {object} backup   parsed backup file
 * @param {string[]} groups keys from RESTORE_GROUPS
 * @param {(msg:string)=>void} onProgress
 * @returns {Promise<Record<string, number>>} rows written per table
 */
export async function restoreBackup(backup, groups, onProgress = () => {}) {
  const workshop = await getWorkshop();
  const src = backup.data || {};
  const selected = new Set(RESTORE_GROUPS.filter(g => groups.includes(g.key)).flatMap(g => g.tables));
  const rows = {};

  for (const table of selected) rows[table] = [...(src[table] || [])];

  // Invoices need their vehicles and clients to exist (foreign keys).
  // If clients weren't selected, bring along only the ones the invoices use.
  // (Appointments and inspections also point to vehicles.)
  const carUsers = ['services', 'appointments', 'inspections'].filter(tb => selected.has(tb));
  if (carUsers.length && !selected.has('cars')) {
    const carIds = new Set(carUsers.flatMap(tb => rows[tb].map(r => r.car_id)).filter(Boolean));
    rows.cars = (src.cars || []).filter(c => carIds.has(c.id));
    const clientIds = new Set(rows.cars.map(c => c.client_id).filter(Boolean));
    rows.clients = (src.clients || []).filter(c => clientIds.has(c.id));
  }
  // Only restore line items for invoices that are in the file
  if (rows.service_items && rows.services) {
    const ids = new Set(rows.services.map(s => s.id));
    rows.service_items = rows.service_items.filter(i => ids.has(i.service_id));
  }

  // A backup made by another workshop can't reuse its original row ids: those ids
  // belong to the source account and its rows are invisible/untouchable here (RLS).
  // So when copying across accounts we mint new ids and re-point foreign keys.
  const crossWorkshop = !!backup.workshop?.id && backup.workshop.id !== workshop.id;
  const idMaps = {}; // table -> Map(oldId -> newId)

  const remap = (table, r) => {
    // Drop embedded relations in case a file contains joined data
    const { cars: _c, clients: _k, service_items: _s, workshops: _w, ...row } = r;
    if (WORKSHOP_TABLES.includes(table)) row.workshop_id = workshop.id;
    if (!crossWorkshop) return row;
    row.id = idMaps[table].get(r.id);
    for (const [col, srcTable] of Object.entries(FK_COLUMNS)) {
      if (row[col] != null && idMaps[srcTable]?.has(row[col])) row[col] = idMaps[srcTable].get(row[col]);
    }
    return row;
  };

  const written = {};

  for (const table of RESTORE_ORDER) {
    const list = rows[table];
    if (!list || list.length === 0) continue;
    onProgress(table);

    // Assign fresh ids before writing so later tables can point at them (parents first)
    if (crossWorkshop) {
      const m = new Map();
      list.forEach(r => m.set(r.id, newId()));
      idMaps[table] = m;
    }

    if (table === 'service_items') {
      // Same account: replace each invoice's existing line items with the backup's.
      // Different account: the invoices are brand-new, so there's nothing to replace.
      if (!crossWorkshop) {
        const serviceIds = [...new Set(list.map(i => i.service_id))];
        for (const ids of chunk(serviceIds, 150)) {
          const { error } = await supabase.from('service_items').delete().in('service_id', ids);
          if (error) throw new Error(`service_items: ${error.message}`);
        }
      }
      const prepared = list.map(r => remap('service_items', r));
      for (const part of chunk(prepared, CHUNK)) {
        const { error } = await supabase.from('service_items').insert(part);
        if (error) throw new Error(`service_items: ${error.message}`);
      }
      written[table] = list.length;
      continue;
    }

    const prepared = list.map(r => remap(table, r));
    for (const part of chunk(prepared, CHUNK)) {
      // New ids across accounts -> plain insert; same account -> idempotent upsert
      const { error } = crossWorkshop
        ? await supabase.from(table).insert(part)
        : await supabase.from(table).upsert(part, { onConflict: 'id' });
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    written[table] = list.length;
  }

  // Cached lists are now stale
  ['sonic_services_cache', 'sonic_cars_cache', 'sonic_clients_cache', 'sonic_inventory_cache',
    'sonic_expenses_cache', 'sonic_invoicelist_cache', 'sonic_dashboard_cache']
    .forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });

  return written;
}

/* ---------------- CSV exports (open in Excel) ---------------- */

function toCSV(headers, rows) {
  const esc = v => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(h => esc(h.label)).join(',')];
  rows.forEach(r => lines.push(headers.map(h => esc(typeof h.get === 'function' ? h.get(r) : r[h.get])).join(',')));
  // BOM so Excel shows ë / ç correctly
  return '﻿' + lines.join('\r\n');
}

export function exportCSV(kind, backup, al) {
  const d = backup.data;
  const L = (en, sq) => (al ? sq : en);
  const carsById = Object.fromEntries((d.cars || []).map(c => [c.id, c]));
  const clientsById = Object.fromEntries((d.clients || []).map(c => [c.id, c]));
  let headers, rows;

  if (kind === 'inventory') {
    headers = [
      { label: L('Part number', 'Nr. pjesës'), get: 'part_number' },
      { label: L('Part name', 'Emri'), get: 'part_name' },
      { label: L('Quantity', 'Sasia'), get: 'quantity' },
      { label: L('Cost price', 'Kosto'), get: 'cost_price' },
      { label: L('Sell price', 'Çmimi'), get: 'unit_price' },
    ];
    rows = d.inventory || [];
  } else if (kind === 'clients') {
    headers = [
      { label: L('Name', 'Emri'), get: 'full_name' },
      { label: L('Phone', 'Telefoni'), get: 'phone' },
      { label: 'Email', get: 'email' },
      { label: L('Address', 'Adresa'), get: 'address' },
      { label: L('Vehicles', 'Veturat'), get: c => (d.cars || []).filter(x => x.client_id === c.id).map(x => `${x.plate} ${x.make} ${x.model}`).join(' | ') },
    ];
    rows = d.clients || [];
  } else if (kind === 'invoices') {
    headers = [
      { label: L('Invoice no.', 'Nr. faturës'), get: s => String(s.id).split('-')[0].toUpperCase() },
      { label: L('Date', 'Data'), get: s => s.service_date || String(s.created_at || '').slice(0, 10) },
      { label: L('Client', 'Klienti'), get: s => clientsById[carsById[s.car_id]?.client_id]?.full_name || '' },
      { label: L('Plate', 'Targa'), get: s => carsById[s.car_id]?.plate || '' },
      { label: L('Vehicle', 'Vetura'), get: s => `${carsById[s.car_id]?.make || ''} ${carsById[s.car_id]?.model || ''}`.trim() },
      { label: L('Description', 'Përshkrimi'), get: 'description' },
      { label: L('Status', 'Statusi'), get: 'status' },
      { label: L('Discount', 'Zbritja'), get: 'discount' },
      { label: L('Total', 'Totali'), get: 'cost' },
    ];
    rows = d.services || [];
  } else {
    throw new Error('Unknown export');
  }

  const name = `garagedata-${kind}_${slug(backup.workshop?.name)}_${stamp()}.csv`;
  downloadFile(name, toCSV(headers, rows), 'text/csv;charset=utf-8');
  return name;
}
