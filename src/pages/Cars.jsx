import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Pencil, Search, Car, User, Hash, X, RefreshCw, Fuel } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations'; // SHTUAR: Importo fjalorin

export default function Cars() {
  const { isOnline, addToQueue } = useSync(); 
  
  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [cars, setCars] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isDecoding, setIsDecoding] = useState(false); 
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({ client_id: '', make: '', model: '', year: '', plate: '', vin: '', engine_type: 'Diesel' });

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedCars = localStorage.getItem('sonic_cars_cache');
      const cachedClients = localStorage.getItem('sonic_clients_cache');
      
      if (cachedCars) setCars(JSON.parse(cachedCars));
      if (cachedClients) setClients(JSON.parse(cachedClients));
      
      setLoading(false);
      return; 
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const { data: carData } = await supabase.from('cars').select('*, clients(full_name, phone)').eq('workshop_id', profile.workshop_id).order('created_at', { ascending: false });
        setCars(carData || []);
        localStorage.setItem('sonic_cars_cache', JSON.stringify(carData || []));

        const { data: clientData } = await supabase.from('clients').select('id, full_name, phone').eq('workshop_id', profile.workshop_id).order('full_name');
        setClients(clientData || []);
        localStorage.setItem('sonic_clients_cache', JSON.stringify(clientData || []));
      }
    } catch (error) {
      console.error("Fetch error (fallback to cache):", error);
      const cachedCars = localStorage.getItem('sonic_cars_cache');
      const cachedClients = localStorage.getItem('sonic_clients_cache');
      if (cachedCars) setCars(JSON.parse(cachedCars));
      if (cachedClients) setClients(JSON.parse(cachedClients));
    }
    setLoading(false);
  }

  function handleCancel() {
    setShowForm(false); setEditingId(null);
    setFormData({ client_id: '', make: '', model: '', year: '', plate: '', vin: '', engine_type: 'Diesel' });
  }

  function handleEdit(car) {
    setFormData({ 
      client_id: car.client_id, make: car.make || '', model: car.model || '', 
      year: car.year || '', plate: car.plate || '', vin: car.vin || '', engine_type: car.engine_type || 'Diesel' 
    });
    setEditingId(car.id); setShowForm(true);
  }

  async function handleDecodeVIN() {
    if (!formData.vin || formData.vin.length < 11) {
      return alert(language === 'al' ? "Ju lutem shënoni një VIN të vlefshëm (të paktën 11 karaktere) për të dekoduar." : "Please enter a valid VIN (at least 11 characters) to decode.");
    }
    
    setIsDecoding(true);
    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${formData.vin}?format=json`);
      const data = await response.json();
      
      const make = data.Results.find(r => r.Variable === "Make")?.Value || "";
      const model = data.Results.find(r => r.Variable === "Model")?.Value || "";
      const year = data.Results.find(r => r.Variable === "Model Year")?.Value || "";
      const fuel = data.Results.find(r => r.Variable === "Fuel Type - Primary")?.Value || "";
      
      let engineType = formData.engine_type;
      if (fuel.toLowerCase().includes("gasoline") || fuel.toLowerCase().includes("petrol")) engineType = "Petrol";
      else if (fuel.toLowerCase().includes("diesel")) engineType = "Diesel";
      else if (fuel.toLowerCase().includes("electric")) engineType = "Electric";
      else if (fuel.toLowerCase().includes("hybrid")) engineType = "Hybrid";

      setFormData(prev => ({
        ...prev,
        make: make && make !== "null" ? make : prev.make,
        model: model && model !== "null" ? model : prev.model,
        year: year && year !== "null" ? year : prev.year,
        engine_type: engineType
      }));
      
    } catch (error) {
      alert(language === 'al' ? "Nuk u arrit të dekodohej ky VIN. Ju lutem shkruani detajet manualisht." : "Could not decode this VIN. Please enter the details manually.");
    }
    setIsDecoding(false);
  }

  async function handleDelete(id) {
    const confirmMsg = language === 'al' 
      ? 'Jeni i sigurt që dëshironi ta fshini këtë veturë?' 
      : 'Are you sure you want to delete this car?';

    if (window.confirm(confirmMsg)) {
      if (!isOnline) {
        setCars(prev => prev.filter(c => c.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_cars_cache') || '[]');
        const updatedCache = existingCache.filter(c => c.id !== id);
        localStorage.setItem('sonic_cars_cache', JSON.stringify(updatedCache));

        if (!id.toString().startsWith('temp-')) {
          addToQueue('cars', 'DELETE', { id });
          alert(language === 'al' ? 'Offline: Vetura u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Vehicle deleted locally. Will sync to cloud when internet returns.');
        }
        return; 
      }

      try {
        const { error } = await supabase.from('cars').delete().eq('id', id);
        if (error) throw error;
        fetchData();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.client_id) return alert(language === 'al' ? 'Ju lutem zgjidhni pronarin (klientin).' : 'Please select a client owner.');
    
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
        const existingCache = JSON.parse(localStorage.getItem('sonic_cars_cache') || '[]');
        
        const selectedClient = clients.find(c => c.id === formData.client_id) || {};
        const optimisticCarData = {
          ...payload,
          clients: { full_name: selectedClient.full_name, phone: selectedClient.phone }
        };

        if (editingId) {
          addToQueue('cars', 'UPDATE', { id: editingId, ...payload });
          const updatedCars = existingCache.map(c => c.id === editingId ? { ...c, ...optimisticCarData } : c);
          setCars(updatedCars);
          localStorage.setItem('sonic_cars_cache', JSON.stringify(updatedCars));
          alert(language === 'al' ? 'Offline: Vetura u përditësua lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Vehicle updated locally. Will sync when internet returns.');
        } else {
          addToQueue('cars', 'INSERT', payload);
          const tempCar = { id: 'temp-' + Date.now(), ...optimisticCarData, created_at: new Date().toISOString() };
          setCars([tempCar, ...existingCache]);
          localStorage.setItem('sonic_cars_cache', JSON.stringify([tempCar, ...existingCache]));
          alert(language === 'al' ? 'Offline: Vetura e re u ruajt lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: New vehicle saved locally. Will sync when internet returns.');
        }

        handleCancel();
        return; 
      }

      if (editingId) {
        const { error } = await supabase.from('cars').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cars').insert([payload]);
        if (error) throw error;
      }
      handleCancel(); fetchData();
    } catch (error) { 
      alert((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Save Error: ') + error.message);
    }
  }

  const filteredCars = cars.filter(c => {
    const term = searchTerm.toLowerCase();
    return (
      (c.plate?.toLowerCase() || '').includes(term) ||
      (c.make?.toLowerCase() || '').includes(term) ||
      (c.model?.toLowerCase() || '').includes(term) ||
      (c.clients?.full_name?.toLowerCase() || '').includes(term) ||
      (c.clients?.phone || '').includes(term)
    );
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t.page_title_cars || (language === 'al' ? 'Veturat' : 'Vehicles')}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">{t.page_desc_cars || (language === 'al' ? 'Menaxho veturat e klientëve' : 'Manage customer vehicles')}</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex justify-center items-center gap-2 font-bold shadow-md">
            <Plus size={20} /> {t.add_vehicle || (language === 'al' ? 'Shto Veturë' : 'Add Vehicle')}
          </button>
        )}
      </div>

      <div className="mb-6 relative max-w-xl">
        <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        <input 
          type="text" 
          placeholder={language === 'al' ? 'Kërko me targa, model veture ose pronar...' : 'Search by license plate, car model, or owner name...'} 
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-gray-700 font-medium" 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 mb-8 max-w-3xl animate-fade-in">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <Car size={24} className="text-blue-600"/> 
              {editingId ? (language === 'al' ? 'Ndrysho Veturën' : 'Edit Vehicle') : (language === 'al' ? 'Veturë e Re' : 'New Vehicle')}
            </h2>
            <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-red-500 p-2"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Pronari (Klienti)' : 'Owner (Client)'}</label>
              <select required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})}>
                 <option value="">{language === 'al' ? '-- Zgjidh Pronarin --' : '-- Select Owner --'}</option>
                 {clients.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
              </select>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Numri i Shasisë (VIN)' : 'VIN Number'}</label>
                <input placeholder={language === 'al' ? 'Shëno VIN me 17 karaktere...' : 'Enter 17-digit VIN...'} className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase" value={formData.vin} onChange={e => setFormData({...formData, vin: e.target.value.toUpperCase()})} />
              </div>
              <button type="button" onClick={handleDecodeVIN} disabled={isDecoding} className="w-full md:w-auto bg-gray-900 hover:bg-gray-800 text-white font-bold px-6 py-3 rounded-lg flex justify-center items-center gap-2 transition-colors">
                {isDecoding ? <RefreshCw className="animate-spin" size={18} /> : <Search size={18} />} {language === 'al' ? 'Dekodo VIN' : 'Decode VIN'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Marka' : 'Make'}</label><input required placeholder="e.g. Audi" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modeli</label><input required placeholder="e.g. Q5" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Viti' : 'Year'}</label><input type="number" placeholder="e.g. 2015" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} /></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Targat' : 'License Plate'}</label>
                <input required placeholder="05-242-HA" className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold uppercase" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Lloji i Motorit' : 'Engine Type'}</label>
                <select className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-medium" value={formData.engine_type} onChange={e => setFormData({...formData, engine_type: e.target.value})}>
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Electric">Electric</option>
                  <option value="Other">{language === 'al' ? 'Tjetër' : 'Other'}</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md">
                {language === 'al' ? 'Ruaj Veturën' : 'Save Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p>{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : filteredCars.map(car => (
          <div key={car.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
               <h3 className="font-black text-lg text-gray-800">{car.make} {car.model} <span className="text-sm font-medium text-gray-500">({car.year || 'N/A'})</span></h3>
               <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded border font-mono font-bold text-xs">{car.plate}</span>
            </div>
            <div className="space-y-2 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{language === 'al' ? 'Pronari & Detajet' : 'Owner & Details'}</p>
              <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><User size={14} className="text-blue-500"/> {car.clients?.full_name || (language === 'al' ? 'I panjohur' : 'Unknown')}</p>
              <p className="text-sm text-gray-600 flex items-center gap-2">{car.clients?.phone && <><Hash size={14} className="text-gray-400"/> {car.clients.phone}</>}</p>
              <p className="text-sm text-gray-600 flex items-center gap-2 mt-2 pt-2 border-t border-gray-200"><Fuel size={14} className="text-orange-500"/> {car.engine_type || (language === 'al' ? 'Motor i panjohur' : 'Unknown Engine')}</p>
            </div>
            <div className="flex gap-2 pt-4 border-t border-gray-100">
               <button onClick={() => handleEdit(car)} className="flex-1 text-sm text-blue-600 bg-blue-50 py-2 rounded font-bold hover:bg-blue-100 flex justify-center items-center gap-1">
                 <Pencil size={16}/> {t.edit || (language === 'al' ? 'Ndrysho' : 'Edit')}
               </button>
               <button onClick={() => handleDelete(car.id)} className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded font-bold hover:bg-red-100"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
        {!loading && filteredCars.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 italic bg-white rounded-xl border border-dashed">
            {language === 'al' ? 'Nuk u gjet asnjë veturë.' : 'No vehicles found.'}
          </div>
        )}
      </div>
    </div>
  )
}