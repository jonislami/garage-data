import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, ArrowLeft, MessageCircle, FileCheck2 } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations';
import { useToast } from '../components/ui';
import { formatMoney, formatDate, invoiceNumber } from '../lib/format';
import { vehicleName } from '../lib/vehicle';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline, addToQueue } = useSync();

  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const toast = useToast();
  const al = language === 'al';

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('€');
  const [vatRate, setVatRate] = useState(0);
  const [regular, setRegular] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');

  function applyInvoice(data) {
    setInvoice(data);
    setRegular(!!data.is_regular_invoice);
    setPaymentMethod(data.payment_method || '');
  }

  useEffect(() => {
    async function fetchInvoice() {
      setLoading(true);

      if (!isOnline) {
        const cachedInvoice = localStorage.getItem(`sonic_invoice_${id}`);
        if (cachedInvoice) {
          const parsedData = JSON.parse(cachedInvoice);
          applyInvoice(parsedData);
          setCurrency(parsedData.workshops?.currency || '€');
          setVatRate(Number(parsedData.workshops?.vat_rate || 0));
        } else {
          toast.error(language === 'al' ? 'Jeni offline dhe kjo faturë nuk është ruajtur ende në pajisje.' : "You are offline and this invoice hasn't been cached yet.");
        }
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();

        if (profile) {
          const { data: shop } = await supabase.from('workshops').select('*').eq('id', profile.workshop_id).single();
          setCurrency(shop?.currency || '€');
          setVatRate(Number(shop?.vat_rate || 0)); 

          const { data, error } = await supabase
            .from('services')
            .select(`*, workshops ( * ), cars ( make, model, year, plate, clients ( * ) ), service_items ( description, category, price, quantity, unit )`)
            .eq('id', id).single();

          if (!error && data) {
            applyInvoice(data);
            localStorage.setItem(`sonic_invoice_${id}`, JSON.stringify(data));
          }
        }
      } catch (error) {
        console.error("Fetch error:", error);
      }
      setLoading(false);
    }
    fetchInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isOnline]);

  if (loading) return (
    <div className="page max-w-4xl space-y-3">
      <div className="skeleton h-8 w-40" /><div className="skeleton h-96 w-full" />
    </div>
  );
  if (!invoice) return (
    <div className="page max-w-4xl">
      <div className="card empty-state">{al ? 'Fatura nuk u gjet ose jeni offline.' : 'Invoice not found or you are offline.'}</div>
    </div>
  );

  const shop = invoice.workshops;
  const car = invoice.cars;
  const client = car?.clients;
  const items = invoice.service_items || [];
  const money = v => formatMoney(v, currency);

  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
  const discount = Number(invoice.discount || 0);
  const afterDiscount = subtotal - discount;
  const vatAmount = afterDiscount * (vatRate / 100);
  const total = afterDiscount + vatAmount;

  function sendWhatsApp() {
    if (!client?.phone) return toast.error(al ? 'Ky klient nuk ka numër telefoni.' : 'This client has no phone number saved.');
    const text = al
      ? `Përshëndetje ${client.full_name}, vetura juaj (${vehicleName(car?.make, car?.model)} – ${car?.plate}) është gati. Fatura ${invoiceNumber(invoice)}: ${money(total)}. Faleminderit që zgjodhët ${shop?.name}!`
      : `Hello ${client.full_name}, your vehicle (${vehicleName(car?.make, car?.model)} – ${car?.plate}) is ready. Invoice ${invoiceNumber(invoice)}: ${money(total)}. Thank you for choosing ${shop?.name}!`;
    let phone = client.phone.replace(/\D/g, '');
    if (phone.startsWith('00')) phone = phone.slice(2);
    else if (phone.startsWith('0')) phone = '383' + phone.slice(1); // local Kosovo number
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  // Saves an invoice field (regular flag / payment method) and keeps the offline cache in sync
  async function saveField(field, value) {
    let updated = { ...invoice, [field]: value };
    if (!isOnline) {
      addToQueue('services', 'UPDATE', { id, [field]: value });
    } else {
      // The database assigns the regular number, so read it back
      const { data, error } = await supabase.from('services').update({ [field]: value }).eq('id', id)
        .select('is_regular_invoice, regular_number, regular_seq, regular_period').single();
      if (error) {
        toast.error((al ? 'Gabim gjatë ruajtjes: ' : 'Error saving: ') + error.message);
        return false;
      }
      updated = { ...updated, ...data };
    }
    setInvoice(updated);
    localStorage.setItem(`sonic_invoice_${id}`, JSON.stringify(updated));
    return true;
  }

  async function toggleRegular() {
    if (regular && invoice.regular_number) {
      return toast.error(al
        ? `Fatura e rregullt ${invoice.regular_number} ka numër dhe nuk mund të kthehet në faturë normale.`
        : `Regular invoice ${invoice.regular_number} has a number and cannot be turned back into a normal invoice.`);
    }
    if (!regular && !window.confirm(al
      ? 'Kjo faturë do të marrë numrin e radhës së faturave të rregullta. Pasi të marrë numër, nuk mund të kthehet në normale dhe nuk mund të fshihet. Vazhdo?'
      : 'This invoice will get the next regular invoice number. Once numbered it cannot be turned back into a normal invoice or deleted. Continue?')) return;
    const next = !regular;
    if (await saveField('is_regular_invoice', next)) setRegular(next);
  }

  async function changePayment(e) {
    const value = e.target.value;
    if (await saveField('payment_method', value || null)) setPaymentMethod(value);
  }

  const PAYMENT_LABELS = {
    cash: al ? 'Cash' : 'Cash',
    bank: al ? 'Transfer bankar' : 'Bank transfer',
    card: al ? 'Kartelë' : 'Card',
  };
  const paymentLabel = PAYMENT_LABELS[paymentMethod] || paymentMethod;

  const buyerRows = [
    ...(client?.is_business ? [
      [al ? 'Nr. fiskal' : 'Fiscal no.', client?.fiscal_number, true],
      [al ? 'Nr. unik' : 'Unique no.', client?.unique_number, true],
      [al ? 'Nr. TVSH' : 'VAT no.', client?.vat_number, true],
    ] : []),
    [al ? 'Adresa' : 'Address', client?.address],
    [al ? 'Shteti' : 'Country', client?.country],
    [al ? 'Telefoni' : 'Phone', client?.phone],
  ];

  const unit = u => (al && (u === 'pcs' || !u) ? 'copë' : al && u === 'hr' ? 'orë' : u || 'pcs');

  return (
    <div className="page max-w-4xl print:p-0 print:max-w-none">
      <div className="mb-4 flex flex-col sm:flex-row justify-between gap-2 print:hidden">
        <button onClick={() => navigate(-1)} className="btn btn-ghost -ml-2 self-start">
          <ArrowLeft size={16} /> {al ? 'Kthehu' : 'Back'}
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleRegular} className={`btn ${regular ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={regular}
            title={al ? 'Faturë e rregullt me numrin fiskal dhe të dhënat e biznesit' : 'Regular invoice with fiscal number and business details'}>
            <FileCheck2 size={16} /> {al ? 'Faturë e rregullt' : 'Regular invoice'}
          </button>
          <select className="input !w-auto" value={paymentMethod} onChange={changePayment} aria-label={al ? 'Metoda e pagesës' : 'Payment method'}>
            <option value="">{al ? 'Metoda e pagesës…' : 'Payment method…'}</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button onClick={sendWhatsApp} className="btn btn-secondary"><MessageCircle size={16} /> WhatsApp</button>
          <button onClick={() => window.print()} className="btn btn-primary"><Printer size={16} /> {al ? 'Printo / PDF' : 'Print / PDF'}</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-10 print:border-0 print:rounded-none print:p-0">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-gray-200">
          <div className="flex items-start gap-4">
            {shop?.logo_url && <img src={shop.logo_url} alt="" className="h-14 w-14 object-contain" />}
            <div>
              <p className="text-base font-semibold text-gray-900">{shop?.name}</p>
              {shop?.address && <p className="text-sm text-gray-500">{shop.address}</p>}
              {shop?.phone && <p className="text-sm text-gray-500">{shop.phone}</p>}
              {regular && (
                <>
                  {shop?.website && <p className="text-sm text-gray-500">{shop.website}</p>}
                  {shop?.email && <p className="text-sm text-gray-500">{shop.email}</p>}
                  {shop?.business_name && <p className="text-sm text-gray-500">{al ? 'Emri i biznesit' : 'Business name'}: {shop.business_name}</p>}
                  {shop?.unique_number && <p className="text-sm text-gray-500">{al ? 'Nr. unik' : 'Unique no.'}: <span className="font-code">{shop.unique_number}</span></p>}
                  {shop?.fiscal_number && <p className="text-sm text-gray-500">{al ? 'Nr. fiskal' : 'Fiscal no.'}: <span className="font-code">{shop.fiscal_number}</span></p>}
                  {shop?.vat_number && <p className="text-sm text-gray-500">{al ? 'Nr. TVSH' : 'VAT no.'}: <span className="font-code">{shop.vat_number}</span></p>}
                </>
              )}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold tracking-tight text-gray-900">{al ? 'Faturë' : 'Invoice'}</p>
            {regular && <p className="text-xs uppercase tracking-wide text-gray-500">{al ? 'Faturë e rregullt' : 'Regular invoice'}</p>}
            <dl className="mt-2 grid grid-cols-[auto_auto] sm:justify-end gap-x-4 gap-y-0.5 text-sm">
              <dt className="text-gray-500">{regular ? (al ? 'Fatura #' : 'Invoice #') : (al ? 'Numri' : 'Number')}</dt>
              <dd className="font-code text-gray-900">
                {regular && !invoice.regular_number
                  ? <span className="font-sans text-gray-500">{al ? 'Numri jepet pas sinkronizimit' : 'Number assigned after sync'}</span>
                  : invoiceNumber(invoice)}
              </dd>
              <dt className="text-gray-500">{t.date}</dt>
              <dd className="text-gray-900">{formatDate(invoice.service_date || invoice.created_at)}</dd>
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 keep-cols">
          <div>
            <p className="section-label">{regular ? (al ? 'Blerësi' : 'Buyer') : (al ? 'Faturuar për' : 'Billed to')}</p>
            <p className="font-medium text-gray-900">{client?.full_name || '—'}</p>
            {regular ? (
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                {buyerRows.map(([label, value, code]) => (
                  <div key={label} className="contents">
                    <dt className="text-gray-500">{label}</dt>
                    <dd className={`text-gray-900 ${code ? 'font-code' : ''}`}>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                {client?.phone && <p className="text-sm text-gray-600">{client.phone}</p>}
                {client?.email && <p className="text-sm text-gray-600">{client.email}</p>}
              </>
            )}
          </div>
          <div>
            <p className="section-label">{al ? 'Vetura' : 'Vehicle'}</p>
            <p className="font-medium text-gray-900">{vehicleName(car?.make, car?.model)}{car?.year ? ` (${car.year})` : ''}</p>
            <p className="text-sm text-gray-600">{al ? 'Targa' : 'Plate'}: <span className="font-code">{car?.plate}</span></p>
          </div>
        </div>

        <table className="table border-y border-gray-200">
          <thead>
            <tr>
              <th className="!bg-white">{t.description}</th>
              {regular && <th className="!bg-white">{al ? 'Njësia' : 'Unit'}</th>}
              <th className="!bg-white text-right">{al ? 'Sasia' : 'Qty'}</th>
              <th className="!bg-white text-right">{al ? 'Çmimi' : 'Unit price'}</th>
              <th className="!bg-white text-right">{t.total}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              return (
                <tr key={idx} className="hover:!bg-transparent">
                  <td className="text-gray-900">{item.description}</td>
                  {regular && <td className="text-gray-600 whitespace-nowrap">{unit(item.unit)}</td>}
                  <td className="text-right font-mono whitespace-nowrap">{qty}{!regular && <> <span className="text-xs text-gray-400">{unit(item.unit)}</span></>}</td>
                  <td className="text-right font-mono text-gray-600 whitespace-nowrap">{money(item.price)}</td>
                  <td className="text-right font-mono whitespace-nowrap">{money(qty * Number(item.price))}</td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan={regular ? 5 : 4} className="text-center text-gray-400">—</td></tr>}
          </tbody>
        </table>

        <div className="flex flex-col-reverse md:flex-row justify-between items-start gap-6 pt-6">
          <div className="flex-1 text-sm text-gray-600 max-w-md">
            <p className="section-label">{al ? 'Shënime' : 'Notes'}</p>
            <p className="whitespace-pre-wrap">{invoice.invoice_notes || (al ? 'Faleminderit që zgjodhët shërbimin tonë!' : 'Thank you for your business!')}</p>
            {paymentLabel && (
              <p className="mt-4"><span className="text-gray-500">{al ? 'Metoda e pagesës' : 'Payment method'}:</span> <span className="text-gray-900">{paymentLabel}</span></p>
            )}
            {regular && (shop?.bank_name || shop?.bank_account) && (
              <div className="mt-4">
                <p className="section-label">{al ? 'Detajet e llogarisë' : 'Bank details'}</p>
                {shop.bank_name && <p>{al ? 'Emri i bankës' : 'Bank'}: <span className="text-gray-900">{shop.bank_name}</span></p>}
                {shop.bank_account_name && <p>{al ? 'Emri i llogarisë' : 'Account name'}: <span className="text-gray-900">{shop.bank_account_name}</span></p>}
                {shop.bank_account && <p>{al ? 'Llogaria' : 'Account'}: <span className="font-code text-gray-900">{shop.bank_account}</span></p>}
              </div>
            )}
          </div>

          <dl className="w-full md:w-72 text-sm">
            <div className="flex justify-between py-1.5"><dt className="text-gray-600">{al ? 'Nëntotali' : 'Subtotal'}</dt><dd className="font-mono">{money(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between py-1.5"><dt className="text-gray-600">{al ? 'Zbritja' : 'Discount'}</dt><dd className="font-mono">−{money(discount)}</dd></div>}
            {vatRate > 0 && <div className="flex justify-between py-1.5"><dt className="text-gray-600">{al ? 'TVSH' : 'VAT'} ({vatRate}%)</dt><dd className="font-mono">{money(vatAmount)}</dd></div>}
            <div className="flex justify-between items-baseline mt-2 pt-3 border-t-2 border-gray-900">
              <dt className="font-semibold text-gray-900">{al ? 'Totali për pagesë' : 'Total due'}</dt>
              <dd className="font-mono text-lg font-semibold text-gray-900">{money(total)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
