import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Pencil, Search, User, Phone, Mail, MapPin, X } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations'; // SHTUAR: Importo fjalorin

export default function Clients() {
  const { isOnline, addToQueue } = useSync(); 
  
  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ full_name: '', phone: '', email: '', address: '' });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedClients = localStorage.getItem('sonic_clients_cache');
      if (cachedClients) {
        setClients(JSON.parse(cachedClients));
      }
      setLoading(false);
      return; 
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const { data } = await supabase.from('clients').select('*').eq('workshop_id', profile.workshop_id).order('created_at', { ascending: false });
        setClients(data || []);
        
        localStorage.setItem('sonic_clients_cache', JSON.stringify(data || []));
      }
    } catch (error) {
      console.error("Fetch error (fallback to cache):", error);
      const cachedClients = localStorage.getItem('sonic_clients_cache');
      if (cachedClients) setClients(JSON.parse(cachedClients));
    }
    setLoading(false);
  }

  function handleCancel() {
    setShowForm(false); setEditingId(null);
    setFormData({ full_name: '', phone: '', email: '', address: '' });
  }

  function handleEdit(client) {
    setFormData({ full_name: client.full_name, phone: client.phone || '', email: client.email || '', address: client.address || '' });
    setEditingId(client.id); setShowForm(true);
  }

  async function handleDelete(id) {
    const confirmMsg = language === 'al' 
      ? 'Jeni i sigurt që dëshironi ta fshini këtë klient?' 
      : 'Are you sure you want to delete this client?';

    if (window.confirm(confirmMsg)) {
      if (!isOnline) {
        setClients(prev => prev.filter(c => c.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_clients_cache') || '[]');
        const updatedCache = existingCache.filter(c => c.id !== id);
        localStorage.setItem('sonic_clients_cache', JSON.stringify(updatedCache));

        if (!id.toString().startsWith('temp-')) {
          addToQueue('clients', 'DELETE', { id });
          alert(language === 'al' ? 'Offline: Klienti u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Client deleted locally. Will sync to cloud when internet returns.');
        }
        return; 
      }

      try {
        const { error } = await supabase.from('clients').delete().eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      let workshopId = localStorage.getItem('sonic_workshop_id');

      if (!workshopId && isOnline) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
        if (profile?.workshop_id) {
          workshopId = profile.workshop_id;
          localStorage.setItem('sonic_workshop_id', workshopId); 
        }
      }

      if (!workshopId) throw new Error(language === 'al' ? "Nuk u gjet ID e Ofiçinës. Lidhu pak me Wi-Fi." : "Could not find Workshop ID. Please connect to Wi-Fi briefly.");

      const payload = { ...formData, workshop_id: workshopId };

      if (!isOnline) {
        const existingCache = JSON.parse(localStorage.getItem('sonic_clients_cache') || '[]');
        
        if (editingId) {
          addToQueue('clients', 'UPDATE', { id: editingId, ...payload });
          const updatedClients = existingCache.map(c => c.id === editingId ? { ...c, ...payload } : c);
          setClients(updatedClients);
          localStorage.setItem('sonic_clients_cache', JSON.stringify(updatedClients));
          alert(language === 'al' ? 'Offline: Klienti u përditësua lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Client updated locally. Will sync when internet returns.');
        } else {
          addToQueue('clients', 'INSERT', payload);
          const tempClient = { id: 'temp-' + Date.now(), ...payload, created_at: new Date().toISOString() };
          setClients([tempClient, ...existingCache]);
          localStorage.setItem('sonic_clients_cache', JSON.stringify([tempClient, ...existingCache]));
          alert(language === 'al' ? 'Offline: Klienti i ri u ruajt lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: New client saved locally. Will sync when internet returns.');
        }

        handleCancel();
        return; 
      }

      if (editingId) {
        const { error } = await supabase.from('clients').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clients').insert([payload]);
        if (error) throw error;
      }
      handleCancel(); fetchData();
    } catch (error) { alert((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Save Error: ') + error.message); }
  }

  const filteredClients = clients.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.full_name?.toLowerCase() || '').includes(term) ||
      (c.phone || '').includes(term) ||
      (c.email?.toLowerCase() || '').includes(term)
    );
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t.page_title_clients || (language === 'al' ? 'Klientët' : 'Clients')}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">{t.page_desc_clients || (language === 'al' ? 'Menaxho databazën e klientëve tuaj' : 'Manage your customer database')}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex justify-center items-center gap-2 font-bold shadow-md">
            <Plus size={20} /> {t.add_client || (language === 'al' ? 'Shto Klient' : 'Add Client')}
          </button>
        )}
      </div>

      <div className="mb-6 relative max-w-xl">
        <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder={language === 'al' ? 'Kërko me emër, telefon ose email...' : 'Search by name, phone, or email...'} 
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-gray-700 font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 mb-8 max-w-2xl animate-fade-in">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <User size={24} className="text-blue-600"/> 
              {editingId ? (language === 'al' ? 'Ndrysho Klientin' : 'Edit Client') : (language === 'al' ? 'Klient i Ri' : 'New Client')}
            </h2>
            <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-red-500 p-2"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Emri i Plotë' : 'Full Name'}</label>
              <input required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Telefoni' : 'Phone'}</label>
                <input className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                <input type="email" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Adresa' : 'Address'}</label>
              <input className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md">
                {language === 'al' ? 'Ruaj Klientin' : 'Save Client'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p>{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : filteredClients.map(client => (
          <div key={client.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <h3 className="font-black text-lg text-gray-800 mb-3">{client.full_name}</h3>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-gray-600 flex items-center gap-2"><Phone size={16} className="text-gray-400"/> {client.phone || '-'}</p>
              <p className="text-sm text-gray-600 flex items-center gap-2"><Mail size={16} className="text-gray-400"/> {client.email || '-'}</p>
              <p className="text-sm text-gray-600 flex items-center gap-2"><MapPin size={16} className="text-gray-400"/> {client.address || '-'}</p>
            </div>
            <div className="flex gap-2 pt-4 border-t border-gray-100">
               <button onClick={() => handleEdit(client)} className="flex-1 text-sm text-blue-600 bg-blue-50 py-2 rounded font-bold hover:bg-blue-100 flex justify-center items-center gap-1">
                 <Pencil size={16}/> {t.edit || (language === 'al' ? 'Ndrysho' : 'Edit')}
               </button>
               <button onClick={() => handleDelete(client.id)} className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded font-bold hover:bg-red-100"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
        {!loading && filteredClients.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 italic bg-white rounded-xl border border-dashed">
            {language === 'al' ? 'Nuk u gjet asnjë klient.' : 'No clients found.'}
          </div>
        )}
      </div>
    </div>
  )
}