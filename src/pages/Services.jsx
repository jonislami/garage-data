import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Wrench, Package, FileText, X, CheckCircle, Car, Calendar, Filter } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; 
import { translations } from '../translations'; 

export default function Services() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit'); 
  
  const { isOnline, addToQueue } = useSync(); 
  
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [services, setServices] = useState([]);
  const [cars, setCars] = useState([]); 
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [currency, setCurrency] = useState('€');
  
  const [timeFilter, setTimeFilter] = useState('all'); 
  
  const [selectedCarId, setSelectedCarId] = useState('');
  const [jobStatus, setJobStatus] = useState('Pending');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]); 
  
  const [lineItems, setLineItems] = useState([]);
  const [newItem, setNewItem] = useState({ category: 'labor', description: '', price: '', quantity: 1, unit: 'pcs', cost_price: 0, inventory_id: null });
  
  const [discount, setDiscount] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  const statusTranslations = {
    'Pending': language === 'al' ? 'Në Pritje' : 'Pending',
    'In Progress': language === 'al' ? 'Në Proces' : 'In Progress',
    'Completed': language === 'al' ? 'Përfunduar' : 'Completed'
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (editId && services.length > 0) {
      const jobToEdit = services.find(s => s.id === editId);
      if (jobToEdit) {
        setShowForm(true);
        setSelectedCarId(jobToEdit.car_id);
        setJobStatus(jobToEdit.status);
        setDiscount(jobToEdit.discount || '');
        setInvoiceNotes(jobToEdit.invoice_notes || '');
        setServiceDate(jobToEdit.service_date || jobToEdit.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]); 
        
        const items = jobToEdit.service_items?.map(i => ({ 
          category: i.category, description: i.description, price: i.price, 
          quantity: i.quantity || 1, unit: i.unit || 'pcs',
          cost_price: i.cost_price || 0, inventory_id: null 
        })) || [];
        setLineItems(items);
      }
    }
  }, [editId, services]);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedServices = localStorage.getItem('sonic_services_cache');
      const cachedCars = localStorage.getItem('sonic_cars_cache');
      const cachedInv = localStorage.getItem('sonic_inventory_cache');

      if (cachedServices) setServices(JSON.parse(cachedServices));
      if (cachedCars) setCars(JSON.parse(cachedCars));
      if (cachedInv) setInventory(JSON.parse(cachedInv));

      setLoading(false);
      return; 
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      if (profile) {
        const { data: shop } = await supabase.from('workshops').select('currency').eq('id', profile.workshop_id).single();
        setCurrency(shop?.currency || '€');
        
        const { data: serviceData } = await supabase.from('services')
          .select(`*, cars ( make, model, plate ), service_items ( description, category, price, cost_price, quantity, unit )`)
          .eq('workshop_id', profile.workshop_id).order('service_date', { ascending: false });
        setServices(serviceData || []);
        localStorage.setItem('sonic_services_cache', JSON.stringify(serviceData || []));
        
        // NDRYSHIMI KËTU: Shtova clients(full_name) në select për të marrë emrin e klientit
        const { data: carData } = await supabase.from('cars').select('id, make, model, plate, clients(full_name)').eq('workshop_id', profile.workshop_id).order('make');
        setCars(carData || []);
        localStorage.setItem('sonic_cars_cache', JSON.stringify(carData || []));
        
        const { data: invData } = await supabase.from('inventory').select('*').eq('workshop_id', profile.workshop_id).order('part_name');
        setInventory(invData || []);
        localStorage.setItem('sonic_inventory_cache', JSON.stringify(invData || []));
      }
    } catch (error) {
      console.error("Fetch error (fallback to cache):", error);
      const cachedServices = localStorage.getItem('sonic_services_cache');
      if (cachedServices) setServices(JSON.parse(cachedServices));
    }
    setLoading(false);
  }

  function handleAddLineItem() {
    if (!newItem.description || !newItem.price || !newItem.quantity) return;
    setLineItems([...lineItems, { ...newItem }]);
    setNewItem({ category: 'labor', description: '', price: '', quantity: 1, unit: 'pcs', cost_price: 0, inventory_id: null });
  }

  function handleInventorySelect(e) {
    const item = inventory.find(i => i.id === e.target.value);
    if (item) {
      setNewItem({ 
        category: 'part', description: item.part_name, price: item.unit_price, 
        quantity: 1, unit: 'pcs', cost_price: item.cost_price || 0, inventory_id: item.id 
      });
    }
    e.target.value = ""; 
  }

  function calculateSubtotal() { return lineItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0); }
  function calculateTotal() { return calculateSubtotal() - Number(discount || 0); }

  function handleCancel() {
    setShowForm(false); navigate('/services'); setSelectedCarId(''); setLineItems([]); 
    setJobStatus('Pending'); setDiscount(''); setInvoiceNotes(''); 
    setServiceDate(new Date().toISOString().split('T')[0]); 
  }

  async function handleDeleteService(id) {
    const confirmMsg = language === 'al' 
      ? "Jeni i sigurt që dëshironi ta fshini këtë fletë pune? Ky veprim nuk mund të zhbëhet." 
      : "Are you sure you want to delete this job ticket? This cannot be undone.";

    if (window.confirm(confirmMsg)) {
      if (!isOnline) {
        setServices(prev => prev.filter(s => s.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_services_cache') || '[]');
        const updatedCache = existingCache.filter(s => s.id !== id);
        localStorage.setItem('sonic_services_cache', JSON.stringify(updatedCache));

        addToQueue('services', 'DELETE', { id });
        alert(language === 'al' ? 'Offline: Fleta u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Service deleted locally. Will sync to cloud when internet returns.');
        return; 
      }

      try {
        await supabase.from('services').delete().eq('id', id); fetchData();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes: ' : 'Error deleting: ') + error.message);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCarId) return alert(language === 'al' ? 'Ju lutem zgjidhni një veturë.' : 'Please select a car.');
    
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

      const totalCost = calculateTotal();
      const descTitle = lineItems.length > 0 ? lineItems[0].description : (language === 'al' ? 'Shërbim i Përgjithshëm' : 'General Service'); 
      const fullDesc = descTitle + (lineItems.length > 1 ? '...' : '');

      const payload = { 
        car_id: selectedCarId, workshop_id: workshopId, status: jobStatus, 
        description: fullDesc, cost: totalCost, discount: Number(discount || 0), 
        invoice_notes: invoiceNotes, service_date: serviceDate 
      };

      if (!isOnline) {
        const existingCache = JSON.parse(localStorage.getItem('sonic_services_cache') || '[]');
        const selectedCar = cars.find(c => c.id === selectedCarId) || {};

        if (editId) {
          addToQueue('services', 'UPDATE', { id: editId, ...payload });
          
          const updatedServices = existingCache.map(s => s.id === editId ? { ...s, ...payload, cars: { make: selectedCar.make, model: selectedCar.model, plate: selectedCar.plate } } : s);
          setServices(updatedServices);
          localStorage.setItem('sonic_services_cache', JSON.stringify(updatedServices));
          alert(language === 'al' ? 'Offline: Detajet e shërbimit u përditësuan. (Shënim: Modifikimi i artikujve kërkon internet). Do të sinkronizohet më vonë.' : 'Offline: Service details updated. (Note: Modifying line items requires an internet connection). Will sync when internet returns.');
        } else {
          const newServiceId = crypto.randomUUID();
          const fullPayload = { id: newServiceId, ...payload };
          
          addToQueue('services', 'INSERT', fullPayload);

          lineItems.forEach(item => {
            addToQueue('service_items', 'INSERT', { 
              service_id: newServiceId, description: item.description, category: item.category, 
              price: item.price, quantity: item.quantity, unit: item.unit, cost_price: item.cost_price 
            });
          });

          let currentInvCache = [...inventory];
          lineItems.forEach(item => {
            if (item.inventory_id) {
              const invItem = currentInvCache.find(i => i.id === item.inventory_id);
              if (invItem && invItem.quantity > 0) {
                const newQty = invItem.quantity - Number(item.quantity);
                addToQueue('inventory', 'UPDATE', { id: item.inventory_id, quantity: newQty });
                currentInvCache = currentInvCache.map(i => i.id === item.inventory_id ? { ...i, quantity: newQty } : i);
              }
            }
          });
          setInventory(currentInvCache);
          localStorage.setItem('sonic_inventory_cache', JSON.stringify(currentInvCache));

          const optimisticService = {
            ...fullPayload,
            cars: { make: selectedCar.make, model: selectedCar.model, plate: selectedCar.plate },
            service_items: lineItems,
            created_at: new Date().toISOString()
          };

          setServices([optimisticService, ...existingCache]);
          localStorage.setItem('sonic_services_cache', JSON.stringify([optimisticService, ...existingCache]));
          alert(language === 'al' ? 'Offline: Fleta e re e punës u ruajt lokalisht! Do të sinkronizohet kur të kthehet interneti.' : 'Offline: New service ticket and items saved locally! Will sync when internet returns.');
        }

        handleCancel();
        return; 
      }

      let serviceId = editId;
      if (editId) {
        await supabase.from('services').update(payload).eq('id', editId);
        await supabase.from('service_items').delete().eq('service_id', editId); 
      } else {
        const { data: service, error } = await supabase.from('services').insert([payload]).select().single();
        if (error) throw error; serviceId = service.id;
      }

      if (lineItems.length > 0) {
        const itemsPayload = lineItems.map(item => ({ 
          service_id: serviceId, description: item.description, category: item.category, 
          price: item.price, quantity: item.quantity, unit: item.unit, cost_price: item.cost_price 
        }));
        await supabase.from('service_items').insert(itemsPayload);
      }

      for (const item of lineItems) {
        if (item.inventory_id) { 
          const invItem = inventory.find(i => i.id === item.inventory_id);
          if (invItem && invItem.quantity > 0) {
            const newQty = invItem.quantity - Number(item.quantity);
            await supabase.from('inventory').update({ quantity: newQty }).eq('id', item.inventory_id);
          }
        }
      }
      handleCancel(); fetchData(); 
    } catch (error) { alert((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Error saving job: ') + error.message); }
  }

  const filteredServices = services.filter(service => {
    if (timeFilter === 'all') return true;
    
    const sDate = new Date(service.service_date || service.created_at || new Date());
    const now = new Date();
    
    if (timeFilter === 'today') {
      return sDate.toDateString() === now.toDateString();
    }
    if (timeFilter === 'month') {
      return sDate.getMonth() === now.getMonth() && sDate.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'year') {
      return sDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 border-b border-gray-200 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t.page_title_services || (language === 'al' ? 'Fletët e Punës' : 'Job Tickets')}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">{t.page_desc_services || (language === 'al' ? 'Menaxho punët dhe riparimet aktuale' : 'Manage current jobs and repairs')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {!showForm && (
            <div className="relative flex-1 md:w-48">
              <Filter size={16} className="absolute left-3 top-3 text-gray-400" />
              <select 
                className="w-full pl-9 p-2.5 border border-gray-300 rounded-lg outline-none bg-white font-bold text-gray-600 shadow-sm focus:ring-2 focus:ring-blue-500 cursor-pointer"
                value={timeFilter} 
                onChange={e => setTimeFilter(e.target.value)}
              >
                <option value="all">📅 {language === 'al' ? 'Të Gjitha' : 'All Time'}</option>
                <option value="today">🕒 {language === 'al' ? 'Sot' : 'Today'}</option>
                <option value="month">📆 {language === 'al' ? 'Këtë Muaj' : 'This Month'}</option>
                <option value="year">📅 {language === 'al' ? 'Këtë Vit' : 'This Year'}</option>
              </select>
            </div>
          )}

          {!showForm && (
            <button onClick={() => setShowForm(true)} className="flex-1 md:w-auto justify-center bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-bold shadow-md">
              <Plus size={20} /> {t.new_job || (language === 'al' ? 'Punë e Re' : 'New Job')}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 mb-8 overflow-hidden animate-fade-in max-w-5xl mx-auto">
          <div className="bg-gray-50 p-4 md:p-6 border-b flex justify-between items-center">
            <h2 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-2 md:gap-3">
              <FileText className="text-blue-600" size={24} /> {editId ? (language === 'al' ? 'Ndrysho Fletën' : 'Edit Ticket') : (language === 'al' ? 'Fletë Pune e Re' : 'New Service Ticket')}
            </h2>
            <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-red-500 transition-colors bg-white p-2 rounded-full shadow-sm border"><X size={20}/></button>
          </div>
          
          <div className="p-4 md:p-6">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Car size={14}/> {language === 'al' ? 'Vetura' : 'Vehicle'}</label>
                <select className="w-full p-3 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500" value={selectedCarId} onChange={e => setSelectedCarId(e.target.value)}>
                  <option value="">{language === 'al' ? '-- Zgjidh Veturën --' : '-- Choose Car --'}</option>
                  
                  {/* NDRYSHIMI KËTU: Tani shfaq edhe emrin e klientit nëse ekziston */}
                  {cars.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.clients?.full_name || (language === 'al' ? 'Pa Emër' : 'Unknown')} - {c.make} {c.model} • [{c.plate}]
                    </option>
                  ))}
                  
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Statusi i Punës' : 'Job Status'}</label>
                <select className="w-full p-3 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold" value={jobStatus} onChange={e => setJobStatus(e.target.value)}>
                  <option value="Pending" className="text-orange-600">{language === 'al' ? 'Në Pritje' : 'Pending'}</option>
                  <option value="In Progress" className="text-blue-600">{language === 'al' ? 'Në Proces' : 'In Progress'}</option>
                  <option value="Completed" className="text-green-600">{language === 'al' ? 'Përfunduar' : 'Completed'}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Calendar size={14}/> {language === 'al' ? 'Data e Shërbimit' : 'Date of Service'}</label>
                <input type="date" className="w-full p-3 border border-gray-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium text-gray-700" 
                  value={serviceDate} onChange={e => setServiceDate(e.target.value)} />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="p-3 text-sm font-bold text-gray-600 w-24 text-center">{language === 'al' ? 'Lloji' : 'Type'}</th>
                      <th className="p-3 text-sm font-bold text-gray-600">{t.description || (language === 'al' ? 'Përshkrimi' : 'Description')}</th>
                      <th className="p-3 text-sm font-bold text-gray-600 text-center w-24">{language === 'al' ? 'Sasia' : 'Qty'}</th>
                      <th className="p-3 text-sm font-bold text-gray-600 text-right w-24">{language === 'al' ? 'Çmimi' : 'Price'}</th>
                      <th className="p-3 text-sm font-bold text-gray-600 w-32 text-right">{t.total || (language === 'al' ? 'Totali' : 'Total')}</th>
                      <th className="p-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lineItems.length === 0 && ( <tr><td colSpan="6" className="p-8 text-center text-gray-400 italic">{language === 'al' ? 'Nuk ka asnjë artikull të shtuar.' : 'No items added yet.'}</td></tr> )}
                    {lineItems.map((item, i) => {
                      const itemTotal = Number(item.price) * Number(item.quantity);
                      
                      // Përkthimi i Llojit të Artikullit
                      const itemTypeLabel = item.category === 'labor' 
                         ? (language === 'al' ? 'Punë' : 'Labor') 
                         : (language === 'al' ? 'Pjesë' : 'Part');
                         
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="p-3 text-center">
                            {item.category === 'labor' 
                              ? <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold"><Wrench size={12}/> {itemTypeLabel}</span> 
                              : <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold"><Package size={12}/> {itemTypeLabel}</span>}
                          </td>
                          <td className="p-3 font-medium text-gray-800">
                             {item.description} 
                             {item.inventory_id && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{language === 'al' ? 'Nga Stoku' : 'From Stock'}</span>}
                          </td>
                          <td className="p-3 text-center font-mono text-sm">{item.quantity} <span className="text-gray-400">{language === 'al' && item.unit === 'pcs' ? 'copë' : item.unit}</span></td>
                          <td className="p-3 text-right font-mono text-gray-500">{currency}{item.price}</td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">{currency}{itemTotal.toFixed(2)}</td>
                          <td className="p-3 text-center"><button type="button" onClick={() => setLineItems(lineItems.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={18} /></button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 border-t p-3 flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                <select className="p-2 border rounded bg-white text-sm font-bold outline-none" value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value, description: '', price: '', quantity: 1, inventory_id: null, cost_price: 0})}>
                  <option value="labor">🛠️ {language === 'al' ? 'Punë dore' : 'Labor'}</option>
                  <option value="part">📦 {language === 'al' ? 'Pjesë këmbimi' : 'Part'}</option>
                </select>
                
                {newItem.category === 'part' && (
                  <select onChange={handleInventorySelect} className="p-2 border rounded bg-blue-50 text-blue-700 text-sm font-bold outline-none">
                    <option value="">+ {language === 'al' ? 'Merr nga Stoku...' : 'Pull from Stock...'}</option>
                    {inventory.map(item => <option key={item.id} value={item.id} disabled={item.quantity <= 0}>{item.part_name} ({item.quantity} {language === 'al' ? 'mbetur' : 'left'})</option>)}
                  </select>
                )}
                
                <input placeholder={newItem.category === 'labor' ? (language === 'al' ? "Përshkrimi i punës" : "Task description") : (language === 'al' ? "Emri i Pjesës" : "Part Name")} className="flex-1 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500" value={newItem.description} onChange={e => setNewItem({...newItem, description: e.target.value})} />
                
                <div className="flex gap-1 w-full md:w-32 shrink-0">
                  <input type="number" step="any" min="0.1" placeholder="Qty" className="w-16 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})} />
                  <select className="flex-1 p-2 border rounded text-sm outline-none bg-white font-medium" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}>
                    <option value="pcs">pcs</option>
                    <option value="L">L</option>
                    <option value="hr">hr</option>
                  </select>
                </div>

                <input type="number" step="0.01" placeholder={language === 'al' ? `Çmimi (${currency})` : `Unit Price (${currency})`} className="w-full md:w-28 p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono" value={newItem.price} onChange={e => setNewItem({...newItem, price: e.target.value})} />
                
                <button type="button" onClick={handleAddLineItem} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded md:px-4 font-bold flex items-center justify-center gap-1 transition-colors"><Plus size={16}/> {language === 'al' ? 'Shto' : 'Add'}</button>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mt-8 pt-6 border-t border-gray-100">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Shënime për Faturën' : 'Invoice Notes / Description'}</label>
                <textarea className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-gray-50" placeholder={language === 'al' ? "Faleminderit që zgjodhët shërbimin tonë! Garanci 30 ditore..." : "Thank you for your business! 30-day warranty on parts..."} value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows="3"></textarea>
              </div>
              <div className="w-full md:w-72 space-y-3">
                <div className="flex justify-between text-sm font-bold text-gray-600 p-2">
                  <span>{language === 'al' ? 'Nëntotali' : 'Subtotal'}</span>
                  <span className="font-mono">{currency}{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold text-red-500 bg-red-50 p-2 rounded border border-red-100">
                  <span>{language === 'al' ? 'Zbritja' : 'Discount'}</span>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1.5">{currency}</span>
                    <input type="number" step="0.01" className="w-full pl-6 p-1 border border-red-200 rounded outline-none focus:ring-1 focus:ring-red-500 text-right font-mono bg-white" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <div className="flex justify-between items-center bg-gray-900 text-white p-4 rounded-xl mt-2 shadow-inner">
                  <span className="text-sm font-bold uppercase tracking-wider">{language === 'al' ? "Totali për t'u paguar" : 'Total Due'}</span>
                  <span className="text-2xl font-black font-mono">{currency}{calculateTotal().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full justify-end mt-6">
              <button type="button" onClick={handleCancel} className="w-full sm:w-auto px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">{language === 'al' ? 'Anulo' : 'Cancel'}</button>
              <button type="button" onClick={handleSubmit} className="w-full sm:w-auto px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl shadow-lg flex justify-center items-center gap-2 transition-transform hover:scale-105">
                <CheckCircle size={20}/> {editId ? (language === 'al' ? 'Përditëso' : 'Update Ticket') : (language === 'al' ? 'Ruaj' : 'Save Ticket')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JOB CARDS - NOW USING FILTERED LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p>{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : filteredServices.map(service => (
          <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-4 md:p-5 border-b flex justify-between items-start bg-gray-50/50">
              <div>
                <h3 className="font-black text-lg text-gray-800">{service.cars?.make} {service.cars?.model}</h3>
                <p className="text-sm text-gray-500 font-medium flex items-center gap-1 mt-1"><Car size={14}/> {service.cars?.plate}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <span className={`px-2 md:px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${service.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {statusTranslations[service.status] || service.status}
                </span>
                <p className="font-mono font-black text-lg md:text-xl text-gray-900">{currency}{service.cost}</p>
              </div>
            </div>
            <div className="p-4 bg-white flex flex-col gap-3">
               <span className="text-xs text-gray-400 font-medium font-bold">{t.date || (language === 'al' ? 'Data:' : 'Service Date:')} {new Date(service.service_date || service.created_at || new Date()).toLocaleDateString()}</span>
               <div className="flex gap-2 w-full mt-1">
                 <button onClick={() => navigate(`/services?edit=${service.id}`)} className="flex-1 text-sm text-blue-600 bg-blue-50 py-2 rounded hover:bg-blue-100 font-bold flex justify-center items-center gap-1">{t.edit || (language === 'al' ? 'Ndrysho' : 'Edit')}</button>
                 <button onClick={() => navigate(`/invoices/${service.id}`)} className="flex-1 text-sm text-gray-700 border border-gray-200 py-2 rounded hover:bg-gray-50 font-bold flex justify-center items-center gap-1"><FileText size={14}/> PDF</button>
                 <button onClick={() => handleDeleteService(service.id)} className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded hover:bg-red-100 font-bold flex justify-center items-center"><Trash2 size={16}/></button>
               </div>
            </div>
          </div>
        ))}
        {!loading && filteredServices.length === 0 && (
          <div className="col-span-full p-8 text-center text-gray-500 italic bg-white rounded-xl border border-dashed">{language === 'al' ? 'Nuk u gjet asnjë punë për këtë periudhë kohore.' : 'No services found for this time period.'}</div>
        )}
      </div>
    </div>
  );
}