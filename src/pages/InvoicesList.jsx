import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Trash2, Eye } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations'; // SHTUAR: Importo fjalorin

export default function InvoicesList() {
  const navigate = useNavigate();
  const { isOnline, addToQueue } = useSync(); 
  
  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currency, setCurrency] = useState('$');

  useEffect(() => { fetchInvoices(); }, []);

  async function fetchInvoices() {
    setLoading(true);

    if (!isOnline) {
      const cachedList = localStorage.getItem('sonic_invoicelist_cache');
      if (cachedList) setInvoices(JSON.parse(cachedList));
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();

      if (profile) {
        const { data: shop } = await supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single();
        setCurrency(shop?.currency || '$');

        const { data } = await supabase.from('services').select(`
            *, cars ( plate, make, model, clients ( full_name ) )
          `).eq('workshop_id', profile.workshop_id).order('created_at', { ascending: false });
        
        setInvoices(data || []);
        
        localStorage.setItem('sonic_invoicelist_cache', JSON.stringify(data || []));
      }
    } catch (error) {
      console.error("Fetch error:", error);
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    const confirmMsg = language === 'al' 
      ? "Jeni i sigurt që dëshironi ta fshini këtë faturë? Ky veprim nuk mund të zhbëhet." 
      : "Are you sure you want to delete this invoice? This cannot be undone.";

    if (confirm(confirmMsg)) {
      
      if (!isOnline) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_invoicelist_cache') || '[]');
        const updatedCache = existingCache.filter(inv => inv.id !== id);
        localStorage.setItem('sonic_invoicelist_cache', JSON.stringify(updatedCache));

        if (!id.toString().startsWith('temp-')) {
          addToQueue('services', 'DELETE', { id });
          alert(language === 'al' ? 'Offline: Fatura u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Invoice deleted locally. Will sync to cloud when internet returns.');
        }
        return;
      }

      try {
        const { error } = await supabase.from('services').delete().eq('id', id);
        if (error) throw error;
        fetchInvoices();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes së faturës: ' : "Error deleting invoice: ") + error.message);
      }
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    const term = searchTerm.toLowerCase();
    return (
      (inv.cars?.clients?.full_name?.toLowerCase() || '').includes(term) ||
      (inv.cars?.plate?.toLowerCase() || '').includes(term)
    );
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">{t.page_title_invoices || (language === 'al' ? 'Menaxhimi i Faturave' : 'Invoice Management')}</h1>
      <p className="text-gray-500 mb-6">{t.page_desc_invoices || (language === 'al' ? 'Shiko ose printo të dhënat e përfunduara të ofiçinës.' : 'View or print completed workshop records.')}</p>

      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 flex items-center gap-3">
        <Search className="text-gray-400" />
        <input 
          placeholder={language === 'al' ? 'Kërko klientë ose targa...' : "Search clients or plates..."} 
          className="flex-1 outline-none font-medium" 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
        />
      </div>

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-bold text-gray-600 uppercase text-xs">{t.date || (language === 'al' ? 'Data' : 'Date')}</th>
              <th className="p-4 font-bold text-gray-600 uppercase text-xs">{language === 'al' ? 'Klienti / Vetura' : 'Client / Vehicle'}</th>
              <th className="p-4 font-bold text-gray-600 uppercase text-xs text-right">{t.total || (language === 'al' ? 'Totali' : 'Total')}</th>
              <th className="p-4 font-bold text-gray-600 uppercase text-xs text-center">{t.actions || (language === 'al' ? 'Veprimet' : 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               <tr><td colSpan="4" className="p-8 text-center text-gray-500 font-bold">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</td></tr>
            ) : filteredInvoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="p-4 text-sm font-medium">{new Date(inv.service_date || inv.created_at).toLocaleDateString()}</td>
                <td className="p-4">
                  <div className="font-bold text-gray-800">{inv.cars?.clients?.full_name || (language === 'al' ? 'Klient i Panjohur' : 'Unknown Client')}</div>
                  <div className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">{inv.cars?.make} {inv.cars?.model} [{inv.cars?.plate}]</div>
                </td>
                <td className="p-4 text-right font-mono font-black text-lg text-gray-900">{currency}{inv.cost}</td>
                <td className="p-4">
                  <div className="flex justify-center items-center gap-3">
                    
                    {/* View PDF Button */}
                    <button onClick={() => navigate(`/invoices/${inv.id}`)} 
                            className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 flex items-center gap-2 font-bold transition-colors" 
                            title={language === 'al' ? 'Hap PDF-në e Faturës' : "Open Invoice PDF"}>
                      <FileText size={18} /> {t.view_pdf || (language === 'al' ? 'Shiko PDF' : 'View PDF')}
                    </button>
                    
                    {/* Delete Button */}
                    <button onClick={() => handleDelete(inv.id)} 
                            className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" 
                            title={language === 'al' ? 'Fshi Përgjithmonë' : "Delete Permanent"}>
                      <Trash2 size={20} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filteredInvoices.length === 0 && (
               <tr><td colSpan="4" className="p-8 text-center text-gray-400 italic font-medium">{language === 'al' ? 'Nuk u gjet asnjë faturë.' : 'No invoices found.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}