import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { FileText, Trash2, Eye } from 'lucide-react';
import { useSync } from '../contexts/SyncContext';
import { useLanguage } from '../LanguageContext';
import { translations } from '../translations';
import { PageHeader, SearchInput, EmptyState, TableSkeleton, StatusBadge, useToast } from '../components/ui';
import { formatMoney, formatDate, invoiceNumber, matches, rowDate } from '../lib/format';
import { vehicleName } from '../lib/vehicle';

const TAB_KEY = 'sonic_invoices_tab';

function readTab() {
  try { return localStorage.getItem(TAB_KEY) === 'regular' ? 'regular' : 'normal'; } catch { return 'normal'; }
}

export default function InvoicesList() {
  const navigate = useNavigate();
  const { isOnline, addToQueue } = useSync();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const al = language === 'al';
  const toast = useToast();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('all');
  const [tab, setTab] = useState(readTab);

  function changeTab(next) {
    setTab(next);
    try { localStorage.setItem(TAB_KEY, next); } catch { /* ignore */ }
  }
  const [currency, setCurrency] = useState('€');

  const money = v => formatMoney(v, currency);

  useEffect(() => { fetchInvoices(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function loadCache() {
    try {
      const c = JSON.parse(localStorage.getItem('sonic_invoicelist_cache') || 'null');
      if (c) setInvoices(c);
    } catch { /* ignore */ }
  }

  async function fetchInvoices() {
    setLoading(true);
    if (!isOnline) { loadCache(); setLoading(false); return; }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const [shop, res] = await Promise.all([
          supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single(),
          supabase.from('services')
            .select('*, cars ( plate, make, model, clients ( full_name, phone ) )')
            .eq('workshop_id', profile.workshop_id)
            .order('service_date', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false }),
        ]);
        setCurrency(shop.data?.currency || '€');
        setInvoices(res.data || []);
        localStorage.setItem('sonic_invoicelist_cache', JSON.stringify(res.data || []));
      }
    } catch (error) {
      console.error('Fetch error:', error);
      loadCache();
    }
    setLoading(false);
  }

  async function handleDelete(inv) {
    if (inv.regular_number) {
      return toast.error(al
        ? `Fatura e rregullt ${inv.regular_number} nuk mund të fshihet.`
        : `Regular invoice ${inv.regular_number} cannot be deleted.`);
    }
    const msg = al
      ? `Fshi faturën ${invoiceNumber(inv)}? Ky veprim nuk mund të zhbëhet.`
      : `Delete invoice ${invoiceNumber(inv)}? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    const id = inv.id;

    if (!isOnline) {
      setInvoices(prev => prev.filter(i => i.id !== id));
      const cache = JSON.parse(localStorage.getItem('sonic_invoicelist_cache') || '[]');
      localStorage.setItem('sonic_invoicelist_cache', JSON.stringify(cache.filter(i => i.id !== id)));
      if (!String(id).startsWith('temp-')) {
        addToQueue('services', 'DELETE', { id });
        toast.info(al ? 'Offline: u fshi lokalisht, do të sinkronizohet.' : 'Offline: deleted locally, will sync.');
      }
      return;
    }
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) return toast.error((al ? 'Gabim gjatë fshirjes: ' : 'Error deleting invoice: ') + error.message);
    toast.success(al ? 'Fatura u fshi.' : 'Invoice deleted.');
    fetchInvoices();
  }

  const filtered = useMemo(() => {
    const now = new Date();
    const list = invoices.filter(inv => {
      if (!!inv.is_regular_invoice !== (tab === 'regular')) return false;
      if (period !== 'all') {
        const d = rowDate(inv, 'service_date') || now;
        if (period === 'month' && !(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())) return false;
        if (period === 'year' && d.getFullYear() !== now.getFullYear()) return false;
      }
      return matches(search,
        inv.cars?.clients?.full_name, inv.cars?.plate, inv.cars?.make, inv.cars?.model, vehicleName(inv.cars?.make, inv.cars?.model),
        invoiceNumber(inv), inv.description, inv.cars?.clients?.phone);
    });
    // Regular invoices in their number order (newest month and number first)
    if (tab === 'regular') {
      list.sort((a, b) => (b.regular_period || '9999').localeCompare(a.regular_period || '9999')
        || (b.regular_seq ?? Infinity) - (a.regular_seq ?? Infinity));
    }
    return list;
  }, [invoices, search, period, tab]);

  const counts = useMemo(() => {
    const regular = invoices.filter(i => i.is_regular_invoice).length;
    return { regular, normal: invoices.length - regular };
  }, [invoices]);

  const sum = filtered.reduce((a, i) => a + (Number(i.cost) || 0), 0);

  return (
    <div className="page">
      <PageHeader title={t.page_title_invoices} subtitle={t.page_desc_invoices} />

      <div className="mb-3 flex gap-1 border-b border-gray-200" role="tablist">
        {[
          ['normal', al ? 'Fatura normale' : 'Normal invoices'],
          ['regular', al ? 'Fatura të rregullta' : 'Regular invoices'],
        ].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => changeTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === key ? 'border-blue-600 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label} <span className="ml-1 text-xs text-gray-400">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-2 mb-3">
        <SearchInput
          className="md:flex-1 md:max-w-md"
          value={search}
          onChange={setSearch}
          placeholder={al ? 'Kërko: klienti, targa, nr. faturës…' : 'Search: client, plate, invoice no.…'}
        />
        <select className="input md:w-36" value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="all">{al ? 'Çdo kohë' : 'All time'}</option>
          <option value="month">{al ? 'Ky muaj' : 'This month'}</option>
          <option value="year">{al ? 'Ky vit' : 'This year'}</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={5} /> : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={al ? 'Asnjë faturë nuk u gjet' : 'No invoices found'}
            description={search ? (al ? `Asgjë nuk përputhet me “${search}”.` : `Nothing matches “${search}”.`)
              : tab === 'regular'
                ? (al ? 'Hapni një faturë dhe klikoni “Faturë e rregullt”. Faturat për klientë biznes bëhen të rregullta automatikisht.' : 'Open an invoice and click “Regular invoice”. Invoices for business clients become regular automatically.')
                : (al ? 'Faturat krijohen nga faqja e punëve.' : 'Invoices are created from the Jobs page.')}
          />
        ) : (
          <div className="table-scroll">
            <table className="table min-w-[720px]">
              <thead>
                <tr>
                  <th>{tab === 'regular' ? (al ? 'Fatura #' : 'Invoice #') : (al ? 'Nr.' : 'No.')}</th>
                  <th>{t.date}</th>
                  <th>{al ? 'Klienti' : 'Client'}</th>
                  <th>{al ? 'Vetura' : 'Vehicle'}</th>
                  <th>{al ? 'Statusi' : 'Status'}</th>
                  <th className="text-right">{t.total}</th>
                  <th className="w-32"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${inv.id}`)}>
                    <td className={`font-code text-[13px] ${tab === 'regular' ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                      {tab === 'regular' && !inv.regular_number
                        ? <span className="font-sans text-xs text-gray-400">{al ? 'pas sinkronizimit' : 'after sync'}</span>
                        : invoiceNumber(inv)}
                    </td>
                    <td className="whitespace-nowrap text-gray-600">{formatDate(inv.service_date || inv.created_at)}</td>
                    <td className="text-gray-900">{inv.cars?.clients?.full_name || <span className="text-gray-400">{al ? 'Klient i panjohur' : 'Unknown client'}</span>}</td>
                    <td>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {inv.cars?.plate && <span className="plate">{inv.cars.plate}</span>}
                        <span className="text-gray-600">{vehicleName(inv.cars?.make, inv.cars?.model)}</span>
                      </div>
                    </td>
                    <td><StatusBadge status={inv.status} language={language} /></td>
                    <td className="text-right font-mono font-medium text-gray-900 whitespace-nowrap">{money(inv.cost)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/invoices/${inv.id}`)} className="btn btn-secondary btn-sm">
                          <Eye size={14} /> {t.view_pdf}
                        </button>
                        {!inv.regular_number && (
                          <button onClick={() => handleDelete(inv)} className="btn-icon-danger" title={al ? 'Fshi' : 'Delete'}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && filtered.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          {tab === 'regular' ? (al ? 'Të rregullta: ' : 'Regular: ') : (al ? 'Normale: ' : 'Normal: ')}
          {al ? `${filtered.length} fatura · Totali ${money(sum)}` : `${filtered.length} invoice${filtered.length === 1 ? '' : 's'} · Total ${money(sum)}`}
        </p>
      )}
    </div>
  );
}
