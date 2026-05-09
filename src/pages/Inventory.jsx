import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Package, Pencil, Trash2, X, TrendingUp } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations'; // SHTUAR: Importo fjalorin

export default function Inventory() {
  const { isOnline, addToQueue } = useSync(); 
  
  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currency, setCurrency] = useState('$');

  const [formData, setFormData] = useState({
    part_name: '', quantity: 0, cost_price: 0, unit_price: 0
  });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedInventory = localStorage.getItem('sonic_inventory_cache');
      if (cachedInventory) {
        setInventory(JSON.parse(cachedInventory));
      }
      setLoading(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();

      if (profile) {
        const { data: shop } = await supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single();
        setCurrency(shop?.currency || '$');

        const { data } = await supabase
          .from('inventory')
          .select('*')
          .eq('workshop_id', profile.workshop_id)
          .order('part_name');
          
        setInventory(data || []);
        
        localStorage.setItem('sonic_inventory_cache', JSON.stringify(data || []));
      }
    } catch (error) {
      console.error("Fetch error:", error);
      const cachedInventory = localStorage.getItem('sonic_inventory_cache');
      if (cachedInventory) setInventory(JSON.parse(cachedInventory));
    }
    setLoading(false);
  }

  function handleEdit(item) {
    setFormData({ part_name: item.part_name, quantity: item.quantity, cost_price: item.cost_price || 0, unit_price: item.unit_price });
    setEditingId(item.id);
    setShowForm(true);
  }

  function handleCancel() {
    setFormData({ part_name: '', quantity: 0, cost_price: 0, unit_price: 0 });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleDelete(id) {
    const confirmMsg = language === 'al' ? "Fshi këtë pjesë?" : "Delete this part?";
    if (confirm(confirmMsg)) {
      
      if (!isOnline) {
        setInventory(prev => prev.filter(item => item.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_inventory_cache') || '[]');
        const updatedCache = existingCache.filter(item => item.id !== id);
        localStorage.setItem('sonic_inventory_cache', JSON.stringify(updatedCache));

        if (!id.toString().startsWith('temp-')) {
          addToQueue('inventory', 'DELETE', { id });
          alert(language === 'al' ? 'Offline: Pjesa u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Part deleted locally. Will sync to cloud when internet returns.');
        }
        return;
      }

      try {
        await supabase.from('inventory').delete().eq('id', id);
        fetchData();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes: ' : 'Error deleting part: ') + error.message);
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
        const existingCache = JSON.parse(localStorage.getItem('sonic_inventory_cache') || '[]');
        
        if (editingId) {
          addToQueue('inventory', 'UPDATE', { id: editingId, ...payload });
          const updatedInventory = existingCache.map(i => i.id === editingId ? { ...i, ...payload } : i);
          setInventory(updatedInventory);
          localStorage.setItem('sonic_inventory_cache', JSON.stringify(updatedInventory));
          alert(language === 'al' ? 'Offline: Pjesa u përditësua lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Part updated locally. Will sync when internet returns.');
        } else {
          addToQueue('inventory', 'INSERT', payload);
          const tempItem = { id: 'temp-' + Date.now(), ...payload, created_at: new Date().toISOString() };
          setInventory([tempItem, ...existingCache]);
          localStorage.setItem('sonic_inventory_cache', JSON.stringify([tempItem, ...existingCache]));
          alert(language === 'al' ? 'Offline: Pjesa e re u ruajt lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: New part saved locally. Will sync when internet returns.');
        }

        handleCancel();
        return; 
      }

      if (editingId) {
        await supabase.from('inventory').update(payload).eq('id', editingId);
      } else {
        await supabase.from('inventory').insert([payload]);
      }

      handleCancel();
      fetchData();
    } catch (error) {
      alert((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Save Error: ') + error.message);
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{t.page_title_inventory || (language === 'al' ? 'Inventari' : 'Inventory')}</h1>
          <p className="text-gray-500 mt-1">{t.page_desc_inventory || (language === 'al' ? 'Menaxho pjesët, kostot dhe marzhet e fitimit' : 'Manage parts, costs, and profit margins')}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={20} /> {t.add_part || (language === 'al' ? 'Shto Pjesë' : 'Add Part')}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-xl border border-blue-100 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">{editingId ? (language === 'al' ? 'Ndrysho Pjesën' : 'Edit Part') : (language === 'al' ? 'Pjesë e Re' : 'Add New Part')}</h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
          </div>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Emri i Pjesës' : 'Part Name'}</label>
              <input required className="w-full p-3 border rounded-lg bg-gray-50" value={formData.part_name} onChange={e => setFormData({...formData, part_name: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Sasia në Stok' : 'Quantity in Stock'}</label>
              <input required type="number" className="w-full p-3 border rounded-lg bg-gray-50" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Kostoja (Sa paguani ju)' : 'Cost Price (You Pay)'}</label>
              <input required type="number" step="0.01" className="w-full p-3 border rounded-lg bg-gray-50" value={formData.cost_price} onChange={e => setFormData({...formData, cost_price: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Çmimi i Shitjes (Për Klientin)' : 'Selling Price (Client Pays)'}</label>
              <input required type="number" step="0.01" className="w-full p-3 border rounded-lg bg-gray-50" value={formData.unit_price} onChange={e => setFormData({...formData, unit_price: e.target.value})} />
            </div>
            <div className="flex items-end justify-end">
              <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg">
                {language === 'al' ? 'Ruaj Pjesën' : 'Save Part'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-semibold text-gray-600">{language === 'al' ? 'Emri i Pjesës' : 'Part Name'}</th>
              <th className="p-4 font-semibold text-gray-600 text-center">{t.stock || (language === 'al' ? 'Stoku' : 'Stock')}</th>
              <th className="p-4 font-semibold text-gray-600 text-right">{t.cost || (language === 'al' ? 'Kosto' : 'Cost')}</th>
              <th className="p-4 font-semibold text-gray-600 text-right">{t.selling_price || (language === 'al' ? 'Çmimi i Shitjes' : 'Selling Price')}</th>
              <th className="p-4 font-semibold text-green-600 text-right">{language === 'al' ? 'Fitimi' : 'Profit'}</th>
              <th className="p-4 font-semibold text-gray-600 text-center">{t.actions || (language === 'al' ? 'Veprimet' : 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-bold">{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</td></tr>
            ) : inventory.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic font-medium">{t.no_parts || (language === 'al' ? 'Nuk u gjet asnjë pjesë.' : 'No parts found.')}</td></tr>
            ) : inventory.map(item => {
              const profit = item.unit_price - (item.cost_price || 0);
              return (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="p-4 font-medium flex items-center gap-3"><Package size={18} className="text-gray-400"/> {item.part_name}</td>
                <td className="p-4 text-center font-bold">
                  <span className={`px-2 py-1 rounded text-xs ${item.quantity > 5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.quantity}</span>
                </td>
                <td className="p-4 text-right font-mono text-gray-500">{currency}{item.cost_price || 0}</td>
                <td className="p-4 text-right font-mono font-bold text-gray-800">{currency}{item.unit_price}</td>
                <td className="p-4 text-right font-mono font-bold text-green-600">+{currency}{profit.toFixed(2)}</td>
                <td className="p-4 flex justify-center gap-2">
                  <button onClick={() => handleEdit(item)} className="p-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"><Trash2 size={16} /></button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
    </div>
  );
}