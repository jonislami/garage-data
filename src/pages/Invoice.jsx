import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, ArrowLeft, MessageCircle } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations';
import { useToast } from '../components/ui';
import { formatMoney, formatDate, invoiceNumber } from '../lib/format';
import { vehicleName } from '../lib/vehicle';

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useSync(); 

  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const toast = useToast();
  const al = language === 'al';

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('€');
  const [vatRate, setVatRate] = useState(0);

  useEffect(() => {
    async function fetchInvoice() {
      setLoading(true);

      if (!isOnline) {
        const cachedInvoice = localStorage.getItem(`sonic_invoice_${id}`);
        if (cachedInvoice) {
          const parsedData = JSON.parse(cachedInvoice);
          setInvoice(parsedData);
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
            .select(`*, workshops ( name, address, phone, logo_url, currency, vat_rate ), cars ( make, model, year, plate, clients ( full_name, phone, email ) ), service_items ( description, category, price, quantity, unit )`)
            .eq('id', id).single();

          if (!error && data) {
            setInvoice(data);
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

  const unit = u => (al && (u === 'pcs' || !u) ? 'copë' : al && u === 'hr' ? 'orë' : u || 'pcs');

  return (
    <div className="page max-w-4xl print:p-0 print:max-w-none">
      <div className="mb-4 flex flex-col sm:flex-row justify-between gap-2 print:hidden">
        <button onClick={() => navigate(-1)} className="btn btn-ghost -ml-2 self-start">
          <ArrowLeft size={16} /> {al ? 'Kthehu' : 'Back'}
        </button>
        <div className="flex gap-2">
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
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-semibold tracking-tight text-gray-900">{al ? 'Faturë' : 'Invoice'}</p>
            <dl className="mt-2 grid grid-cols-[auto_auto] sm:justify-end gap-x-4 gap-y-0.5 text-sm">
              <dt className="text-gray-500">{al ? 'Numri' : 'Number'}</dt>
              <dd className="font-code text-gray-900">{invoiceNumber(invoice)}</dd>
              <dt className="text-gray-500">{t.date}</dt>
              <dd className="text-gray-900">{formatDate(invoice.service_date || invoice.created_at)}</dd>
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-6 keep-cols">
          <div>
            <p className="section-label">{al ? 'Faturuar për' : 'Billed to'}</p>
            <p className="font-medium text-gray-900">{client?.full_name || '—'}</p>
            {client?.phone && <p className="text-sm text-gray-600">{client.phone}</p>}
            {client?.email && <p className="text-sm text-gray-600">{client.email}</p>}
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
                  <td className="text-right font-mono whitespace-nowrap">{qty} <span className="text-xs text-gray-400">{unit(item.unit)}</span></td>
                  <td className="text-right font-mono text-gray-600 whitespace-nowrap">{money(item.price)}</td>
                  <td className="text-right font-mono whitespace-nowrap">{money(qty * Number(item.price))}</td>
                </tr>
              );
            })}
            {items.length === 0 && <tr><td colSpan="4" className="text-center text-gray-400">—</td></tr>}
          </tbody>
        </table>

        <div className="flex flex-col-reverse md:flex-row justify-between items-start gap-6 pt-6">
          <div className="flex-1 text-sm text-gray-600 max-w-md">
            <p className="section-label">{al ? 'Shënime' : 'Notes'}</p>
            <p className="whitespace-pre-wrap">{invoice.invoice_notes || (al ? 'Faleminderit që zgjodhët shërbimin tonë!' : 'Thank you for your business!')}</p>
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
