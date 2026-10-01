import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Building2, Users, Wallet, LayoutGrid, RefreshCw, Plus, X, Loader2, Download, Trash2,
  PauseCircle, PlayCircle, Mail, KeyRound, Search, AlertTriangle, Clock, BadgeCheck, Ban, Car, FileText,
  CalendarPlus, Save, UserPlus,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isSuperAdminEmail } from '../lib/admin';
import { useLanguage } from '../LanguageContext';
import { useToast } from '../components/ui';
import { formatDate, formatMoney, matches } from '../lib/format';

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Access status of a garage
// ---------------------------------------------------------------------------
function accessStatus(w) {
  if (w.is_active === false) return 'suspended';
  if (!w.trial_ends_at) return 'unlimited';
  const days = Math.ceil((new Date(w.trial_ends_at) - new Date()) / DAY);
  if (days < 0) return 'expired';
  if (days <= 7) return 'expiring';
  return 'active';
}

const STATUS_STYLE = {
  unlimited: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  active: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  expiring: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  expired: 'bg-red-50 text-red-700 ring-red-600/20',
  suspended: 'bg-gray-100 text-gray-700 ring-gray-500/20',
};

function StatusBadge({ w, al }) {
  const s = accessStatus(w);
  const label = {
    unlimited: al ? 'Pa limit' : 'Unlimited',
    active: `${al ? 'Deri' : 'Until'} ${formatDate(w.trial_ends_at)}`,
    expiring: `${al ? 'Skadon' : 'Expires'} ${formatDate(w.trial_ends_at)}`,
    expired: `${al ? 'Skadoi' : 'Expired'} ${formatDate(w.trial_ends_at)}`,
    suspended: al ? 'Pezulluar' : 'Suspended',
  }[s];
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[s]}`}>{label}</span>;
}

function relative(ts, al) {
  if (!ts) return '—';
  const days = Math.floor((Date.now() - new Date(ts)) / DAY);
  if (days <= 0) return al ? 'sot' : 'today';
  if (days === 1) return al ? 'dje' : 'yesterday';
  return al ? `${days} ditë më parë` : `${days} days ago`;
}

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-md'} my-8 animate-fade-in`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="card-header">
          <h2 className="card-title">{title}</h2>
          <button type="button" onClick={onClose} className="btn-icon" aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

async function callAdmin(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SuperAdmin() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const al = language === 'al';
  const L = (sq, en) => (al ? sq : en);
  const toast = useToast();

  const [tab, setTab] = useState('overview');
  const [data, setData] = useState({ workshops: [], users: [], payments: [] });
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [openShop, setOpenShop] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showInvite, setShowInvite] = useState(null); // workshop id or ''

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isSuperAdminEmail(user.email)) { navigate('/'); return; }
      setAllowed(true);
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data: res, error } = await supabase.rpc('admin_dashboard');
    if (error) toast.error(L('Gabim: ', 'Error: ') + error.message);
    else setData(res);
    setLoading(false);
  }

  const shopsById = useMemo(() => Object.fromEntries(data.workshops.map(w => [w.id, w])), [data.workshops]);
  const shop = openShop ? shopsById[openShop] : null;

  if (!allowed) return <div className="page"><div className="skeleton h-24 w-full" /></div>;

  const tabs = [
    ['overview', LayoutGrid, L('Përmbledhje', 'Overview')],
    ['garages', Building2, L('Garazhet', 'Garages')],
    ['users', Users, L('Përdoruesit', 'Users')],
    ['payments', Wallet, L('Pagesat', 'Payments')],
  ];

  return (
    <div className="page max-w-7xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white"><ShieldAlert size={20} /></span>
          <div>
            <h1 className="page-title">Super Admin</h1>
            <p className="page-subtitle">{L('Menaxhoni garazhet, përdoruesit dhe pagesat', 'Manage garages, users and payments')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="btn btn-secondary" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> {L('Rifresko', 'Refresh')}
          </button>
          <button onClick={() => setShowNewClient(true)} className="btn btn-primary"><Plus size={16} /> {L('Klient i ri', 'New customer')}</button>
        </div>
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
        {tabs.map(([key, Icon, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-blue-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {loading && !data.workshops.length ? (
        <div className="space-y-3"><div className="skeleton h-24 w-full" /><div className="skeleton h-64 w-full" /></div>
      ) : (
        <>
          {tab === 'overview' && <Overview data={data} al={al} L={L} onOpen={setOpenShop} />}
          {tab === 'garages' && <Garages data={data} al={al} L={L} onOpen={setOpenShop} />}
          {tab === 'users' && <UsersTab data={data} shopsById={shopsById} al={al} L={L} toast={toast} reload={load} onInvite={() => setShowInvite('')} />}
          {tab === 'payments' && <Payments data={data} shopsById={shopsById} al={al} L={L} onOpen={setOpenShop} />}
        </>
      )}

      {shop && (
        <GarageDetail key={shop.id} shop={shop} data={data} al={al} L={L} toast={toast}
          onClose={() => setOpenShop(null)} reload={load} onInvite={() => setShowInvite(shop.id)} />
      )}
      {showNewClient && <NewCustomer al={al} L={L} toast={toast} onClose={() => setShowNewClient(false)} reload={load} />}
      {showInvite !== null && (
        <InviteUser workshops={data.workshops} defaultWorkshop={showInvite} al={al} L={L} toast={toast}
          onClose={() => setShowInvite(null)} reload={load} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------
function Overview({ data, al, L, onOpen }) {
  const shops = data.workshops;
  const by = s => shops.filter(w => accessStatus(w) === s);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const thisMonth = data.payments.filter(p => String(p.paid_at).startsWith(monthKey)).reduce((a, p) => a + Number(p.amount), 0);
  const mrr = shops.filter(w => ['active', 'expiring', 'unlimited'].includes(accessStatus(w))).reduce((a, w) => a + Number(w.monthly_price || 0), 0);
  const attention = shops.filter(w => ['expiring', 'expired', 'suspended'].includes(accessStatus(w)));
  const inactive = shops.filter(w => !w.last_activity || Date.now() - new Date(w.last_activity) > 14 * DAY);

  const kpis = [
    [Building2, L('Garazhe', 'Garages'), shops.length, `${by('active').length + by('unlimited').length + by('expiring').length} ${L('aktive', 'active')}`],
    [Clock, L('Skadojnë së shpejti', 'Expiring soon'), by('expiring').length, L('brenda 7 ditëve', 'within 7 days')],
    [Ban, L('Skaduar / pezulluar', 'Expired / suspended'), by('expired').length + by('suspended').length, L('pa akses', 'no access')],
    [Users, L('Përdorues', 'Users'), data.users.length, `${data.users.filter(u => !u.last_sign_in_at).length} ${L('ende pa u kyçur', 'never signed in')}`],
    [Wallet, L('Pagesa këtë muaj', 'Paid this month'), formatMoney(thisMonth, '€'), `${L('Mujore e pritur', 'Expected monthly')}: ${formatMoney(mrr, '€')}`],
    [FileText, L('Fatura gjithsej', 'Invoices total'), shops.reduce((a, w) => a + Number(w.invoices), 0), `${shops.reduce((a, w) => a + Number(w.invoices_30d), 0)} ${L('në 30 ditët e fundit', 'in the last 30 days')}`],
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(([Icon, label, value, sub]) => (
          <div key={label} className="card p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-gray-500"><Icon size={13} /> {label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card overflow-hidden">
          <div className="card-header"><h2 className="card-title flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> {L('Kërkojnë vëmendje', 'Needs attention')}</h2></div>
          {attention.length === 0 ? <p className="p-4 text-sm text-gray-500">{L('Asnjë garazh nuk skadon së shpejti.', 'No garage is about to expire.')}</p> : (
            <ul className="divide-y divide-gray-100">
              {attention.map(w => (
                <li key={w.id}>
                  <button onClick={() => onOpen(w.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{w.name}</span><span className="block truncate text-xs text-gray-500">{w.owner_email || w.phone || '—'}</span></span>
                    <StatusBadge w={w} al={al} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card overflow-hidden">
          <div className="card-header"><h2 className="card-title flex items-center gap-2"><Clock size={16} className="text-gray-500" /> {L('Pa aktivitet 14+ ditë', 'No activity for 14+ days')}</h2></div>
          {inactive.length === 0 ? <p className="p-4 text-sm text-gray-500">{L('Të gjitha garazhet janë aktive.', 'All garages are active.')}</p> : (
            <ul className="divide-y divide-gray-100">
              {inactive.map(w => (
                <li key={w.id}>
                  <button onClick={() => onOpen(w.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
                    <span className="truncate font-medium text-gray-900">{w.name}</span>
                    <span className="shrink-0 text-xs text-gray-500">{L('Aktiviteti i fundit', 'Last activity')}: {relative(w.last_activity, al)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Garages list
// ---------------------------------------------------------------------------
function Garages({ data, al, L, onOpen }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const list = data.workshops.filter(w =>
    (filter === 'all' || accessStatus(w) === filter) && matches(search, w.name, w.owner_email, w.phone, w.address, w.contact_name));

  return (
    <>
      <div className="mb-3 flex flex-col sm:flex-row gap-2">
        <div className="relative sm:max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder={L('Kërko: emri, email, telefoni…', 'Search: name, email, phone…')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">{L('Të gjitha', 'All')}</option>
          <option value="unlimited">{L('Pa limit', 'Unlimited')}</option>
          <option value="active">{L('Aktive (me afat)', 'Active (with end date)')}</option>
          <option value="expiring">{L('Skadojnë së shpejti', 'Expiring soon')}</option>
          <option value="expired">{L('Të skaduara', 'Expired')}</option>
          <option value="suspended">{L('Të pezulluara', 'Suspended')}</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="table min-w-[860px]">
            <thead>
              <tr>
                <th>{L('Garazhi', 'Garage')}</th>
                <th>{L('Aksesi', 'Access')}</th>
                <th>{L('Përdorimi', 'Usage')}</th>
                <th>{L('Aktiviteti i fundit', 'Last activity')}</th>
                <th className="text-right">{L('Çmimi / muaj', 'Price / month')}</th>
                <th className="text-right">{L('Paguar gjithsej', 'Paid total')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map(w => (
                <tr key={w.id} className="cursor-pointer" onClick={() => onOpen(w.id)}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      {w.logo_url ? <img src={w.logo_url} alt="" className="h-8 w-8 rounded object-contain border border-gray-200 bg-white" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-100 text-gray-500"><Building2 size={15} /></span>}
                      <span className="min-w-0">
                        <span className="block font-medium text-gray-900 truncate">{w.name}</span>
                        <span className="block text-xs text-gray-500 truncate">{w.owner_email || '—'}{w.phone ? ` · ${w.phone}` : ''}</span>
                      </span>
                    </div>
                  </td>
                  <td><StatusBadge w={w} al={al} /></td>
                  <td className="whitespace-nowrap text-xs text-gray-600">
                    <span className="mr-3 inline-flex items-center gap-1"><Users size={12} />{w.members}</span>
                    <span className="mr-3 inline-flex items-center gap-1"><Car size={12} />{w.cars}</span>
                    <span className="inline-flex items-center gap-1"><FileText size={12} />{w.invoices}</span>
                  </td>
                  <td className="whitespace-nowrap text-sm text-gray-600">{relative(w.last_activity, al)}</td>
                  <td className="text-right font-mono whitespace-nowrap">{w.monthly_price != null ? formatMoney(w.monthly_price, '€') : '—'}</td>
                  <td className="text-right font-mono whitespace-nowrap">{formatMoney(w.paid_total, '€')}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan="6" className="text-center text-gray-400">—</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// One garage: details, access, payments, users, backup, delete
// ---------------------------------------------------------------------------
function GarageDetail({ shop, data, al, L, toast, onClose, reload, onInvite }) {
  const [info, setInfo] = useState({
    name: shop.name || '', phone: shop.phone || '', address: shop.address || '',
    contact_name: shop.contact_name || '', monthly_price: shop.monthly_price ?? '', notes: shop.notes || '',
  });
  const [busy, setBusy] = useState('');
  const [customDate, setCustomDate] = useState(shop.trial_ends_at ? String(shop.trial_ends_at).slice(0, 10) : '');
  const [pay, setPay] = useState({ months: 1, amount: shop.monthly_price ?? '', paid_at: new Date().toISOString().slice(0, 10), method: 'cash', note: '' });
  const [deleteText, setDeleteText] = useState('');
  const members = data.users.filter(u => u.workshop_id === shop.id);
  const payments = data.payments.filter(p => p.workshop_id === shop.id);
  const set = k => e => setInfo({ ...info, [k]: e.target.value });

  async function run(key, fn, ok) {
    setBusy(key);
    try { await fn(); if (ok) toast.success(ok); await reload(); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(''); }
  }

  const saveInfo = () => run('info', async () => {
    const { error } = await supabase.from('workshops').update({ name: info.name.trim(), phone: info.phone.trim(), address: info.address.trim() }).eq('id', shop.id);
    if (error) throw error;
    const { error: e2 } = await supabase.from('workshop_admin').upsert({
      workshop_id: shop.id, contact_name: info.contact_name.trim() || null,
      monthly_price: info.monthly_price === '' ? null : Number(info.monthly_price),
      notes: info.notes.trim() || null, updated_at: new Date().toISOString(),
    });
    if (e2) throw e2;
  }, L('U ruajt.', 'Saved.'));

  const setAccess = (trial_ends_at, label) => run('access', async () => {
    const { error } = await supabase.from('workshops').update({ trial_ends_at, is_active: true }).eq('id', shop.id);
    if (error) throw error;
  }, label);

  function extend(months) {
    const base = shop.trial_ends_at && new Date(shop.trial_ends_at) > new Date() ? new Date(shop.trial_ends_at) : new Date();
    base.setMonth(base.getMonth() + months);
    setAccess(base.toISOString(), `${L('Aksesi deri', 'Access until')} ${formatDate(base.toISOString())}`);
  }

  const toggleSuspend = () => run('suspend', async () => {
    const { error } = await supabase.from('workshops').update({ is_active: shop.is_active === false }).eq('id', shop.id);
    if (error) throw error;
  }, shop.is_active === false ? L('Garazhi u aktivizua.', 'Garage activated.') : L('Garazhi u pezullua.', 'Garage suspended.'));

  const recordPayment = e => {
    e.preventDefault();
    if (pay.amount === '' || Number(pay.amount) < 0) return toast.error(L('Shkruani shumën.', 'Enter the amount.'));
    run('pay', async () => {
      const { data: end, error } = await supabase.rpc('admin_record_payment', {
        p_workshop_id: shop.id, p_amount: Number(pay.amount), p_months: Number(pay.months) || 0,
        p_paid_at: pay.paid_at, p_method: pay.method, p_note: pay.note.trim() || null,
      });
      if (error) throw error;
      toast.success(`${L('Pagesa u regjistrua', 'Payment recorded')}${end ? ` · ${L('akses deri', 'access until')} ${formatDate(end)}` : ''}`);
      setPay(p => ({ ...p, note: '' }));
    });
  };

  async function backup() {
    setBusy('backup');
    try {
      const q = t => supabase.from(t).select('*').eq('workshop_id', shop.id);
      const [clients, cars, services, inventory, expenses, appointments, inspections, maintenance] = await Promise.all([
        q('clients'), q('cars'), supabase.from('services').select('*, service_items(*)').eq('workshop_id', shop.id),
        q('inventory'), q('expenses'), q('appointments'), q('inspections'),
        supabase.from('maintenance_records').select('*, maintenance_items(*)').eq('workshop_id', shop.id),
      ]);
      const blob = new Blob([JSON.stringify({
        workshop: shop.name, backup_date: new Date().toISOString(),
        clients: clients.data || [], cars: cars.data || [], services_and_invoices: services.data || [],
        inventory: inventory.data || [], expenses: expenses.data || [], appointments: appointments.data || [],
        inspections: inspections.data || [], maintenance: maintenance.data || [],
      }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${shop.name.replace(/\s+/g, '_')}_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  }

  const deleteGarage = () => run('delete', async () => {
    const { error } = await supabase.rpc('admin_delete_workshop', { p_workshop_id: shop.id });
    if (error) throw new Error(/admin_delete_workshop/.test(error.message)
      ? L('Funksioni i fshirjes mungon në databazë. Ekzekutoni skedarin SQL të Super Admin.', 'The delete function is missing in the database. Run the Super Admin SQL file.')
      : error.message);
    onClose();
  }, L('Garazhi u fshi.', 'Garage deleted.'));

  return (
    <Modal title={shop.name} onClose={onClose} wide>
      <div className="divide-y divide-gray-200">
        {/* Summary */}
        <div className="p-4 md:p-5 flex flex-wrap items-center gap-3 text-sm">
          <StatusBadge w={shop} al={al} />
          <span className="text-gray-600">{L('Pronari', 'Owner')}: <span className="text-gray-900">{shop.owner_email || '—'}</span></span>
          <span className="text-gray-600">{L('Krijuar', 'Created')}: {formatDate(shop.created_at)}</span>
          <span className="text-gray-600">{shop.cars} {L('vetura', 'cars')} · {shop.invoices} {L('fatura', 'invoices')} · {shop.clients} {L('klientë', 'clients')}</span>
        </div>

        {/* Access */}
        <section className="p-4 md:p-5">
          <h3 className="section-label">{L('Aksesi / abonimi', 'Access / subscription')}</h3>
          <div className="flex flex-wrap gap-2">
            {[[1, L('+1 muaj', '+1 month')], [3, L('+3 muaj', '+3 months')], [12, L('+1 vit', '+1 year')]].map(([m, label]) => (
              <button key={m} onClick={() => extend(m)} disabled={!!busy} className="btn btn-secondary"><CalendarPlus size={15} /> {label}</button>
            ))}
            <button onClick={() => setAccess(null, L('Akses pa limit.', 'Unlimited access.'))} disabled={!!busy} className="btn btn-secondary"><BadgeCheck size={15} /> {L('Pa limit', 'Unlimited')}</button>
            <button onClick={toggleSuspend} disabled={!!busy} className={`btn ${shop.is_active === false ? 'btn-success' : 'btn-secondary'}`}>
              {shop.is_active === false ? <><PlayCircle size={15} /> {L('Aktivizo', 'Activate')}</> : <><PauseCircle size={15} /> {L('Pezullo', 'Suspend')}</>}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="label">{L('Ose zgjidhni datën e skadimit', 'Or pick the end date')}</label>
              <input type="date" className="input" value={customDate} onChange={e => setCustomDate(e.target.value)} />
            </div>
            <button disabled={!customDate || !!busy} onClick={() => setAccess(new Date(`${customDate}T23:59:59`).toISOString(), `${L('Aksesi deri', 'Access until')} ${formatDate(customDate)}`)} className="btn btn-secondary">{L('Vendos', 'Set')}</button>
          </div>
        </section>

        {/* Record payment */}
        <section className="p-4 md:p-5">
          <h3 className="section-label">{L('Regjistro pagesë', 'Record a payment')}</h3>
          <form onSubmit={recordPayment} className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="label">{L('Muaj', 'Months')}</label>
              <select className="input" value={pay.months} onChange={e => {
                const months = Number(e.target.value);
                setPay(p => ({ ...p, months, amount: shop.monthly_price != null ? (Number(shop.monthly_price) * months).toFixed(2) : p.amount }));
              }}>
                {[0, 1, 2, 3, 6, 12, 24].map(m => <option key={m} value={m}>{m === 0 ? L('Pa zgjatje', 'No extension') : m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{L('Shuma (€)', 'Amount (€)')}</label>
              <input type="number" step="0.01" min="0" className="input" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">{L('Data', 'Date')}</label>
              <input type="date" className="input" value={pay.paid_at} onChange={e => setPay({ ...pay, paid_at: e.target.value })} />
            </div>
            <div>
              <label className="label">{L('Mënyra', 'Method')}</label>
              <select className="input" value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="bank">{L('Bankë', 'Bank')}</option>
                <option value="card">{L('Kartelë', 'Card')}</option>
              </select>
            </div>
            <button type="submit" disabled={!!busy} className="btn btn-primary">{busy === 'pay' ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />} {L('Regjistro', 'Record')}</button>
            <input className="input col-span-2 md:col-span-5" placeholder={L('Shënim (opsional)', 'Note (optional)')} value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} />
          </form>
          <p className="mt-2 text-xs text-gray-500">{L('Pagesa zgjat aksesin automatikisht me numrin e muajve.', 'The payment extends access automatically by the number of months.')}</p>
          {payments.length > 0 && (
            <ul className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
              {payments.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>{formatDate(p.paid_at)} · {p.months ? `${p.months} ${L('muaj', 'mo')}` : L('pa zgjatje', 'no extension')}{p.method ? ` · ${p.method}` : ''}{p.note ? <span className="text-gray-500"> · {p.note}</span> : null}</span>
                  <span className="font-mono">{formatMoney(p.amount, '€')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Details */}
        <section className="p-4 md:p-5">
          <h3 className="section-label">{L('Të dhënat', 'Details')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">{L('Emri i garazhit', 'Garage name')}</label><input className="input" value={info.name} onChange={set('name')} /></div>
            <div><label className="label">{L('Personi kontaktues', 'Contact person')}</label><input className="input" value={info.contact_name} onChange={set('contact_name')} /></div>
            <div><label className="label">{L('Telefoni', 'Phone')}</label><input className="input" value={info.phone} onChange={set('phone')} /></div>
            <div><label className="label">{L('Adresa', 'Address')}</label><input className="input" value={info.address} onChange={set('address')} /></div>
            <div><label className="label">{L('Çmimi mujor (€)', 'Monthly price (€)')}</label><input type="number" step="0.01" min="0" className="input" value={info.monthly_price} onChange={set('monthly_price')} /></div>
            <div className="sm:col-span-2"><label className="label">{L('Shënime private', 'Private notes')}</label><textarea rows={2} className="input" value={info.notes} onChange={set('notes')} /></div>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={saveInfo} disabled={!!busy || !info.name.trim()} className="btn btn-primary">{busy === 'info' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {L('Ruaj', 'Save')}</button>
          </div>
        </section>

        {/* Users */}
        <section className="p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h3 className="section-label !mb-0">{L('Përdoruesit e garazhit', 'Garage users')}</h3>
            <button onClick={onInvite} className="btn btn-secondary btn-sm"><UserPlus size={14} /> {L('Fto përdorues', 'Invite user')}</button>
          </div>
          {members.length === 0 ? <p className="mt-2 text-sm text-gray-500">{L('Asnjë përdorues.', 'No users.')}</p> : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
              {members.map(u => (
                <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="truncate">{u.email}</span>
                  <span className="shrink-0 text-xs text-gray-500">{u.last_sign_in_at ? `${L('Kyçur', 'Signed in')} ${relative(u.last_sign_in_at, al)}` : L('Ende pa u kyçur', 'Not signed in yet')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Backup & delete */}
        <section className="p-4 md:p-5">
          <h3 className="section-label">{L('Të dhënat dhe fshirja', 'Data and deletion')}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <button onClick={backup} disabled={!!busy} className="btn btn-secondary">{busy === 'backup' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} {L('Shkarko kopjen rezervë', 'Download backup')}</button>
            <div className="flex-1" />
            <div>
              <label className="label">{L(`Shkruani "${shop.name}" për ta fshirë`, `Type "${shop.name}" to delete`)}</label>
              <div className="flex gap-2">
                <input className="input" value={deleteText} onChange={e => setDeleteText(e.target.value)} />
                <button onClick={deleteGarage} disabled={deleteText !== shop.name || !!busy} className="btn btn-danger"><Trash2 size={15} /> {L('Fshi', 'Delete')}</button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-red-600">{L('Fshirja heq përgjithmonë garazhin dhe të gjitha të dhënat e tij. Shkarkoni kopjen rezervë më parë.', 'Deleting removes the garage and all its data permanently. Download a backup first.')}</p>
        </section>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
function UsersTab({ data, shopsById, al, L, toast, reload, onInvite }) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const list = data.users.filter(u => matches(search, u.email, shopsById[u.workshop_id]?.name));

  async function act(id, fn, ok) {
    setBusy(id);
    try { await fn(); toast.success(ok); await reload(); } catch (e) { toast.error(e.message); } finally { setBusy(''); }
  }

  return (
    <>
      <div className="mb-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="relative sm:max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder={L('Kërko: email ose garazhi…', 'Search: email or garage…')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={onInvite} className="btn btn-primary"><UserPlus size={16} /> {L('Fto përdorues', 'Invite user')}</button>
      </div>
      <div className="card overflow-hidden">
        <div className="table-scroll">
          <table className="table min-w-[820px]">
            <thead>
              <tr>
                <th>Email</th>
                <th>{L('Garazhi', 'Garage')}</th>
                <th>{L('Kyçja e fundit', 'Last sign-in')}</th>
                <th>{L('Krijuar', 'Created')}</th>
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody>
              {list.map(u => {
                const isAdmin = isSuperAdminEmail(u.email);
                return (
                  <tr key={u.id} className="hover:!bg-transparent">
                    <td className="font-medium text-gray-900">
                      {u.email}
                      {isAdmin && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700">Admin</span>}
                      {!u.last_sign_in_at && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">{L('I ftuar', 'Invited')}</span>}
                    </td>
                    <td>
                      {isAdmin ? <span className="text-gray-400">—</span> : (
                        <select className="input !py-1" value={u.workshop_id || ''} disabled={busy === u.id}
                          onChange={e => act(u.id, () => callAdmin({ action: 'assign', user_id: u.id, workshop_id: e.target.value || null }), L('Garazhi u ndryshua.', 'Garage changed.'))}>
                          <option value="">{L('— Pa garazh (pa akses) —', '— No garage (no access) —')}</option>
                          {data.workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-gray-600">{relative(u.last_sign_in_at, al)}</td>
                    <td className="whitespace-nowrap text-gray-600">{formatDate(u.created_at)}</td>
                    <td>
                      {!isAdmin && (
                        <div className="flex justify-end gap-0.5">
                          <button className="btn-icon" title={L('Dërgo link për fjalëkalim të ri', 'Send password reset link')} disabled={busy === u.id}
                            onClick={() => act(u.id, () => callAdmin({ action: 'reset_password', email: u.email, redirect_to: window.location.origin }), L('Linku u dërgua.', 'Link sent.'))}>
                            <KeyRound size={15} />
                          </button>
                          <button className="btn-icon-danger" title={L('Fshi përdoruesin', 'Delete user')} disabled={busy === u.id}
                            onClick={() => window.confirm(L(`Fshi përdoruesin ${u.email}? Nuk do të mund të kyçet më.`, `Delete user ${u.email}? They will no longer be able to sign in.`))
                              && act(u.id, () => callAdmin({ action: 'delete', user_id: u.id }), L('Përdoruesi u fshi.', 'User deleted.'))}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function InviteUser({ workshops, defaultWorkshop, al, L, toast, onClose, reload }) {
  const [email, setEmail] = useState('');
  const [workshopId, setWorkshopId] = useState(defaultWorkshop || '');
  const [saving, setSaving] = useState(false);

  async function invite(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await callAdmin({ action: 'invite', email, workshop_id: workshopId || null, redirect_to: window.location.origin });
      toast.success(L(`Ftesa u dërgua te ${email}.`, `Invitation sent to ${email}.`));
      await reload();
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={L('Fto përdorues', 'Invite user')} onClose={onClose}>
      <form onSubmit={invite}>
        <div className="p-4 md:p-5 space-y-3">
          <div><label className="label">Email *</label><input required type="email" autoFocus className="input" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div>
            <label className="label">{L('Garazhi', 'Garage')}</label>
            <select className="input" value={workshopId} onChange={e => setWorkshopId(e.target.value)}>
              <option value="">{L('— Le ta krijojë vetë (provë 14 ditë) —', '— Let them create their own (14-day trial) —')}</option>
              {workshops.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500">{L('Përdoruesi merr email me link për të zgjedhur fjalëkalimin.', 'The user gets an email with a link to choose a password.')}</p>
        </div>
        <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">{L('Anulo', 'Cancel')}</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />} {L('Dërgo ftesën', 'Send invitation')}</button>
        </div>
      </form>
    </Modal>
  );
}

// New customer = a garage + its first user invitation, in one step
function NewCustomer({ al, L, toast, onClose, reload }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', months: '1', price: '', currency: '€' });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const end = form.months === 'unlimited' ? null : (() => {
        const d = new Date();
        if (form.months === 'trial') d.setDate(d.getDate() + 14);
        else d.setMonth(d.getMonth() + Number(form.months));
        return d.toISOString();
      })();
      const { data: w, error } = await supabase.from('workshops').insert({
        name: form.name.trim(), phone: form.phone.trim() || null, currency: form.currency,
        owner_id: user.id, is_active: true, trial_ends_at: end,
      }).select('id').single();
      if (error) throw error;
      if (form.price !== '') {
        const { error: e2 } = await supabase.from('workshop_admin').upsert({ workshop_id: w.id, monthly_price: Number(form.price) });
        if (e2) throw e2;
      }
      if (form.email.trim()) {
        await callAdmin({ action: 'invite', email: form.email.trim(), workshop_id: w.id, redirect_to: window.location.origin });
      }
      toast.success(form.email.trim()
        ? L(`Garazhi u krijua dhe ftesa u dërgua te ${form.email.trim()}.`, `Garage created and invitation sent to ${form.email.trim()}.`)
        : L('Garazhi u krijua.', 'Garage created.'));
      await reload();
      onClose();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  }

  return (
    <Modal title={L('Klient i ri', 'New customer')} onClose={onClose}>
      <form onSubmit={create}>
        <div className="p-4 md:p-5 grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">{L('Emri i garazhit', 'Garage name')} *</label><input required autoFocus className="input" value={form.name} onChange={set('name')} /></div>
          <div className="col-span-2"><label className="label">{L('Email-i i pronarit (merr ftesë)', 'Owner email (gets an invitation)')}</label><input type="email" className="input" value={form.email} onChange={set('email')} /></div>
          <div><label className="label">{L('Telefoni', 'Phone')}</label><input className="input" value={form.phone} onChange={set('phone')} /></div>
          <div>
            <label className="label">{L('Monedha', 'Currency')}</label>
            <select className="input" value={form.currency} onChange={set('currency')}><option value="€">EUR (€)</option><option value="L">ALL (L)</option><option value="$">USD ($)</option></select>
          </div>
          <div>
            <label className="label">{L('Aksesi', 'Access')}</label>
            <select className="input" value={form.months} onChange={set('months')}>
              <option value="trial">{L('Provë (14 ditë)', 'Trial (14 days)')}</option>
              <option value="1">{L('1 muaj', '1 month')}</option>
              <option value="3">{L('3 muaj', '3 months')}</option>
              <option value="12">{L('1 vit', '1 year')}</option>
              <option value="unlimited">{L('Pa limit', 'Unlimited')}</option>
            </select>
          </div>
          <div><label className="label">{L('Çmimi mujor (€)', 'Monthly price (€)')}</label><input type="number" step="0.01" min="0" className="input" value={form.price} onChange={set('price')} /></div>
        </div>
        <div className="px-4 md:px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">{L('Anulo', 'Cancel')}</button>
          <button type="submit" disabled={saving} className="btn btn-primary">{saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {L('Krijo', 'Create')}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
function Payments({ data, shopsById, al, L, onOpen }) {
  const months = useMemo(() => {
    const out = [];
    const d = new Date(); d.setDate(1);
    for (let i = 0; i < 12; i++) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({ key, label: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`, total: data.payments.filter(p => String(p.paid_at).startsWith(key)).reduce((a, p) => a + Number(p.amount), 0) });
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, [data.payments]);
  const max = Math.max(1, ...months.map(m => m.total));
  const total = data.payments.reduce((a, p) => a + Number(p.amount), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="card p-4 lg:col-span-1">
        <p className="text-xs font-medium text-gray-500">{L('Të ardhura gjithsej', 'Total received')}</p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">{formatMoney(total, '€')}</p>
        <p className="section-label mt-4">{L('12 muajt e fundit', 'Last 12 months')}</p>
        <ul className="space-y-1.5">
          {months.map(m => (
            <li key={m.key} className="flex items-center gap-2 text-xs">
              <span className="w-16 shrink-0 font-code text-gray-500">{m.label}</span>
              <span className="h-2 flex-1 rounded bg-gray-100"><span className="block h-2 rounded bg-blue-600" style={{ width: `${(m.total / max) * 100}%` }} /></span>
              <span className="w-20 shrink-0 text-right font-mono text-gray-900">{formatMoney(m.total, '€')}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="card overflow-hidden lg:col-span-2">
        <div className="table-scroll">
          <table className="table min-w-[560px]">
            <thead>
              <tr><th>{L('Data', 'Date')}</th><th>{L('Garazhi', 'Garage')}</th><th>{L('Muaj', 'Months')}</th><th>{L('Mënyra', 'Method')}</th><th className="text-right">{L('Shuma', 'Amount')}</th></tr>
            </thead>
            <tbody>
              {data.payments.map(p => (
                <tr key={p.id} className="cursor-pointer" onClick={() => onOpen(p.workshop_id)}>
                  <td className="whitespace-nowrap">{formatDate(p.paid_at)}</td>
                  <td className="text-gray-900">{shopsById[p.workshop_id]?.name || '—'}{p.note && <span className="block text-xs text-gray-500">{p.note}</span>}</td>
                  <td>{p.months || '—'}</td>
                  <td className="text-gray-600">{p.method || '—'}</td>
                  <td className="text-right font-mono">{formatMoney(p.amount, '€')}</td>
                </tr>
              ))}
              {data.payments.length === 0 && <tr><td colSpan="5" className="text-center text-gray-400">{L('Ende pa pagesa. Regjistroni një pagesë nga garazhi.', 'No payments yet. Record one from a garage.')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
