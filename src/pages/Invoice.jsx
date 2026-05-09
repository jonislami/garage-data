import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, ArrowLeft, MessageCircle } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations'; // SHTUAR: Importo fjalorin

export default function Invoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isOnline } = useSync(); 

  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

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
          alert(language === 'al' ? "Ju jeni jashtë linje dhe kjo faturë nuk është ruajtur në memorie ende." : "You are offline and this invoice hasn't been cached yet.");
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
  }, [id, isOnline, language]);

  if (loading) return <div className="p-8 text-center font-bold text-gray-500 animate-pulse">{language === 'al' ? 'Duke ngarkuar Faturën...' : 'Loading Invoice...'}</div>;
  if (!invoice) return <div className="p-8 text-center font-bold text-red-500">{language === 'al' ? 'Fatura nuk u gjet ose ju jeni jashtë linje.' : 'Invoice not found or you are offline.'}</div>;

  const shop = invoice.workshops;
  const car = invoice.cars;
  const client = car?.clients;
  const items = invoice.service_items || [];
  
  const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
  const discount = Number(invoice.discount || 0);
  const afterDiscount = subtotal - discount;
  const vatAmount = afterDiscount * (vatRate / 100);
  const total = afterDiscount + vatAmount;

  function sendWhatsApp() {
    if (!client?.phone) return alert(language === 'al' ? "Asnjë numër telefoni nuk është ruajtur për këtë klient!" : "No phone number saved for this client!");
    
    // Zgjedhja e tekstit sipas gjuhës
    const text = language === 'al' 
      ? `Përshëndetje ${client.full_name}, automjeti juaj (${car?.make} ${car?.model} - ${car?.plate}) është gati! Totali i faturës është ${total.toFixed(2)}${currency}. Faleminderit që zgjodhët ${shop?.name}!`
      : `Hello ${client.full_name}, your vehicle (${car?.make} ${car?.model} - ${car?.plate}) is ready! The total invoice amount is ${currency}${total.toFixed(2)}. Thank you for choosing ${shop?.name}!`;
      
    const cleanPhone = client.phone.replace(/\D/g,''); 
    
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row justify-between gap-4 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-bold bg-white px-4 py-2 rounded-lg shadow-sm">
          <ArrowLeft size={20} /> {language === 'al' ? 'Kthehu' : 'Back'}
        </button>
        <div className="flex gap-3">
          <button onClick={sendWhatsApp} className="bg-green-500 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold hover:bg-green-600 shadow-lg">
            <MessageCircle size={20} /> WhatsApp
          </button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold hover:bg-blue-700 shadow-lg">
            <Printer size={20} /> {language === 'al' ? 'Printo' : 'Print'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-10 shadow-xl rounded-xl print:shadow-none print:w-full print:p-0">
        
        <div className="flex justify-between items-start border-b-2 border-gray-200 pb-8 mb-8">
          <div className="flex items-center gap-4">
            {shop?.logo_url && <img src={shop.logo_url} alt="Logo" className="w-16 h-16 object-contain" />}
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">{language === 'al' ? 'Fatura' : 'INVOICE'}</h1>
              <h2 className="text-lg font-bold text-blue-600">{shop?.name}</h2>
              <p className="text-sm text-gray-500">{shop?.address}</p>
              <p className="text-sm text-gray-500">{shop?.phone}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-400 uppercase">{language === 'al' ? 'Numri i Faturës' : 'Invoice Number'}</p>
            <p className="font-mono text-gray-800 mb-4">#{invoice.id.split('-')[0].toUpperCase()}</p>
            <p className="text-sm font-bold text-gray-400 uppercase">{t.date || (language === 'al' ? 'Data' : 'Date')}</p>
            <p className="text-gray-800 font-bold">{new Date(invoice.service_date || invoice.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">{language === 'al' ? 'Faturuar Për' : 'Billed To'}</p>
            <p className="font-bold text-lg text-gray-800">{client?.full_name}</p>
            <p className="text-sm text-gray-600">{client?.phone}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-xs font-bold text-gray-400 uppercase mb-2">{language === 'al' ? 'Informacioni i Veturës' : 'Vehicle Information'}</p>
            <p className="font-bold text-gray-800">{car?.make} {car?.model}</p>
            <p className="text-sm text-gray-600 mt-1">{language === 'al' ? 'Targa:' : 'License Plate:'} <span className="font-mono font-bold">{car?.plate}</span></p>
          </div>
        </div>

        <table className="w-full text-left mb-8">
          <thead className="bg-gray-100 border-b-2 border-gray-200">
            <tr>
              <th className="p-3 text-sm font-bold text-gray-600 uppercase">{t.description || (language === 'al' ? 'Përshkrimi' : 'Description')}</th>
              <th className="p-3 text-sm font-bold text-gray-600 uppercase text-center">{language === 'al' ? 'Sasia' : 'Qty'}</th>
              <th className="p-3 text-sm font-bold text-gray-600 uppercase text-right">{language === 'al' ? 'Çmimi' : 'Price'}</th>
              <th className="p-3 text-sm font-bold text-gray-600 uppercase text-right">{t.total || (language === 'al' ? 'Totali' : 'Total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => {
              const qty = Number(item.quantity || 1);
              const lineTotal = qty * Number(item.price);
              
              // Simple unit translation
              const displayUnit = language === 'al' && item.unit === 'pcs' ? 'copë' : item.unit || (language === 'al' ? 'copë' : 'pcs');
              
              return (
                <tr key={idx}>
                  <td className="p-3 font-medium text-gray-800">{item.description}</td>
                  <td className="p-3 text-center font-mono">{qty} <span className="text-xs text-gray-400">{displayUnit}</span></td>
                  <td className="p-3 text-right font-mono text-gray-500">{currency}{Number(item.price).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono font-bold">{currency}{lineTotal.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          <div className="flex-1 text-sm text-gray-600 bg-gray-50 p-4 rounded border min-h-[100px] w-full">
            <p className="font-bold text-gray-400 uppercase mb-2 text-xs">{language === 'al' ? 'Shënime' : 'Notes'}</p>
            <p className="whitespace-pre-wrap">{invoice.invoice_notes || (language === 'al' ? 'Faleminderit që zgjodhët shërbimin tonë!' : 'Thank you for your business!')}</p>
          </div>

          <div className="w-full md:w-72">
            <div className="flex justify-between p-2 text-gray-600"><span className="font-bold">{language === 'al' ? 'Nëntotali' : 'Subtotal'}</span><span className="font-mono">{currency}{subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="flex justify-between p-2 text-red-500 font-bold"><span>{language === 'al' ? 'Zbritja' : 'Discount'}</span><span className="font-mono">-{currency}{discount.toFixed(2)}</span></div>}
            
            {vatRate > 0 && (
               <div className="flex justify-between p-2 text-gray-600 border-t border-gray-200">
                 <span className="font-bold">TVSH ({vatRate}%)</span>
                 <span className="font-mono">+{currency}{vatAmount.toFixed(2)}</span>
               </div>
            )}
            
            <div className="flex justify-between p-3 mt-2 bg-gray-100 rounded-lg">
              <span className="font-black text-gray-800 text-lg uppercase">{language === 'al' ? 'Totali për t\'u paguar' : 'Total Due'}</span>
              <span className="font-black font-mono text-xl text-gray-900">{currency}{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}