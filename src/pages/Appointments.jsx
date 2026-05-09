import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Calendar as CalendarIcon, Clock, CheckCircle, Car, User, X, Pencil, ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import { useSync } from '../contexts/SyncContext'; 
import { useLanguage } from '../LanguageContext'; 
import { translations } from '../translations'; 

export default function Appointments() {
  const { isOnline, addToQueue } = useSync(); 
  
  const { language } = useLanguage();
  const t = translations[language] || translations.en;

  const [appointments, setAppointments] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('calendar'); 

  const [formData, setFormData] = useState({
    car_id: '',
    appointment_date: '',
    description: '',
    status: 'Scheduled'
  });

  const monthNamesEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesAl = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
  
  // Përdorim ditë të shkurtra për t'u përshtatur mirë në telefon
  const dayNamesEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayNamesAl = ["Hën", "Mar", "Mër", "Enj", "Pre", "Sht", "Die"];

  const currentMonths = language === 'al' ? monthNamesAl : monthNamesEn;
  const currentDays = language === 'al' ? dayNamesAl : dayNamesEn;

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);

    if (!isOnline) {
      const cachedApts = localStorage.getItem('sonic_appointments_cache');
      const cachedCars = localStorage.getItem('sonic_cars_cache');
      
      if (cachedApts) setAppointments(JSON.parse(cachedApts));
      if (cachedCars) setCars(JSON.parse(cachedCars));
      
      setLoading(false);
      return; 
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();
      
      if (profile) {
        const { data: aptData } = await supabase.from('appointments')
          .select('*, cars(make, model, plate, clients(full_name, phone))')
          .eq('workshop_id', profile.workshop_id)
          .order('appointment_date', { ascending: true }); 
        
        setAppointments(aptData || []);
        localStorage.setItem('sonic_appointments_cache', JSON.stringify(aptData || []));

        const { data: carData } = await supabase.from('cars')
          .select('id, make, model, plate, client_id, clients(full_name, phone)')
          .eq('workshop_id', profile.workshop_id)
          .order('make');
        
        setCars(carData || []);
        localStorage.setItem('sonic_cars_cache', JSON.stringify(carData || []));
      }
    } catch (error) {
      console.error("Fetch error (fallback to cache):", error);
      const cachedApts = localStorage.getItem('sonic_appointments_cache');
      if (cachedApts) setAppointments(JSON.parse(cachedApts));
    }
    setLoading(false);
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ car_id: '', appointment_date: '', description: '', status: 'Scheduled' });
  }

  function handleEdit(apt) {
    const formattedDate = new Date(apt.appointment_date).toISOString().slice(0, 16);
    setFormData({
      car_id: apt.car_id || '',
      appointment_date: formattedDate,
      description: apt.description || '',
      status: apt.status || 'Scheduled'
    });
    setEditingId(apt.id);
    setShowForm(true);
    setCurrentDate(new Date(apt.appointment_date));
  }

  function openFormForDay(day) {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day, 9, 0);
    const tzOffset = newDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(newDate - tzOffset)).toISOString().slice(0, 16);
    
    setFormData({ car_id: '', appointment_date: localISOTime, description: '', status: 'Scheduled' });
    setEditingId(null);
    setShowForm(true);
  }

  async function handleDelete(id) {
    const confirmMsg = language === 'al' 
      ? 'Jeni i sigurt që dëshironi ta fshini këtë takim?' 
      : 'Are you sure you want to delete this appointment?';
      
    if (window.confirm(confirmMsg)) {
      if (!isOnline) {
        setAppointments(prev => prev.filter(apt => apt.id !== id));
        
        const existingCache = JSON.parse(localStorage.getItem('sonic_appointments_cache') || '[]');
        const updatedCache = existingCache.filter(apt => apt.id !== id);
        localStorage.setItem('sonic_appointments_cache', JSON.stringify(updatedCache));

        if (!id.toString().startsWith('temp-')) {
          addToQueue('appointments', 'DELETE', { id });
          alert(language === 'al' ? 'Offline: Takimi u fshi lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Appointment deleted locally. Will sync to cloud when internet returns.');
        }
        setShowForm(false);
        return; 
      }

      try {
        const { error } = await supabase.from('appointments').delete().eq('id', id);
        if (error) throw error;
        setShowForm(false);
        fetchData();
      } catch (error) {
        alert((language === 'al' ? 'Gabim gjatë fshirjes: ' : 'Error deleting appointment: ') + error.message);
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.car_id) return alert(language === 'al' ? 'Ju lutem zgjidhni një automjet.' : 'Please select a vehicle.');

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

      const selectedCar = cars.find(c => c.id === formData.car_id) || {};
      
      const payload = { 
        ...formData, 
        client_id: selectedCar?.client_id,
        workshop_id: workshopId 
      };

      if (!isOnline) {
        const existingCache = JSON.parse(localStorage.getItem('sonic_appointments_cache') || '[]');
        
        const optimisticAptData = {
          ...payload,
          cars: {
            make: selectedCar.make,
            model: selectedCar.model,
            plate: selectedCar.plate,
            clients: {
              full_name: selectedCar.clients?.full_name,
              phone: selectedCar.clients?.phone
            }
          }
        };

        if (editingId) {
          addToQueue('appointments', 'UPDATE', { id: editingId, ...payload });
          const updatedApts = existingCache.map(apt => apt.id === editingId ? { ...apt, ...optimisticAptData } : apt);
          setAppointments(updatedApts);
          localStorage.setItem('sonic_appointments_cache', JSON.stringify(updatedApts));
          alert(language === 'al' ? 'Offline: Takimi u përditësua lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: Appointment updated locally. Will sync when internet returns.');
        } else {
          addToQueue('appointments', 'INSERT', payload);
          const tempApt = { id: 'temp-' + Date.now(), ...optimisticAptData, created_at: new Date().toISOString() };
          
          const newAptsList = [tempApt, ...existingCache].sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
          
          setAppointments(newAptsList);
          localStorage.setItem('sonic_appointments_cache', JSON.stringify(newAptsList));
          alert(language === 'al' ? 'Offline: Takimi i ri u ruajt lokalisht. Do të sinkronizohet kur të kthehet interneti.' : 'Offline: New appointment saved locally. Will sync when internet returns.');
        }

        handleCancel();
        return; 
      }

      if (editingId) {
        const { error } = await supabase.from('appointments').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('appointments').insert([payload]);
        if (error) throw error;
      }
      
      handleCancel(); 
      fetchData();
    } catch (error) { alert((language === 'al' ? 'Gabim: ' : 'Error: ') + error.message); }
  }

  function formatDateTime(isoString) {
    const d = new Date(isoString);
    return {
      date: d.toLocaleDateString(),
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  }

  const currentYear = currentDate.getFullYear();
  const currentMonthIndex = currentDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonthIndex, 1).getDay();
  const startDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonthIndex - 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const getAppointmentsForDay = (day) => {
    return appointments.filter(apt => {
      const d = new Date(apt.appointment_date);
      return d.getDate() === day && d.getMonth() === currentMonthIndex && d.getFullYear() === currentYear;
    });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{t.page_title_appointments || (language === 'al' ? 'Takimet' : 'Appointments')}</h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">{t.page_desc_appointments || (language === 'al' ? 'Planifiko dhe menaxho vizitat e ardhshme në garazh' : 'Schedule and manage upcoming garage visits')}</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Calendar/List Toggle */}
          <div className="flex bg-gray-200 p-1 rounded-lg w-full sm:w-auto justify-center">
            <button onClick={() => setViewMode('calendar')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <CalendarDays size={18}/> <span>{language === 'al' ? 'Kalendar' : 'Calendar'}</span>
            </button>
            <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-md font-bold text-sm transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <List size={18}/> <span>{language === 'al' ? 'Listë' : 'List'}</span>
            </button>
          </div>

          {!showForm && (
            <button onClick={() => { setEditingId(null); setShowForm(true); }} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex justify-center items-center gap-2 font-bold shadow-md">
              <Plus size={20} /> {language === 'al' ? 'Takim i Ri' : 'New Appointment'}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-xl shadow-xl border border-gray-200 mb-8 max-w-3xl animate-fade-in mx-auto">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
              <CalendarIcon size={24} className="text-blue-600"/> 
              {editingId 
                ? (language === 'al' ? 'Ndrysho Takimin' : 'Edit Appointment') 
                : (language === 'al' ? 'Planifiko Vizitë' : 'Schedule Visit')}
            </h2>
            <button type="button" onClick={handleCancel} className="text-gray-400 hover:text-red-500 p-2"><X size={20}/></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Automjeti & Pronari' : 'Vehicle & Owner'}</label>
              <select required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={formData.car_id} onChange={e => setFormData({...formData, car_id: e.target.value})}>
                 <option value="">{language === 'al' ? '-- Zgjidh Veturën --' : '-- Select Car --'}</option>
                 {cars.map(c => <option key={c.id} value={c.id}>{c.clients?.full_name} - {c.make} {c.model} [{c.plate}]</option>)}
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Data & Ora' : 'Date & Time'}</label>
                <input type="datetime-local" required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-medium" value={formData.appointment_date} onChange={e => setFormData({...formData, appointment_date: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Statusi' : 'Status'}</label>
                <select className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white font-bold" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="Scheduled" className="text-blue-600">📅 {language === 'al' ? 'E Planifikuar' : 'Scheduled'}</option>
                  <option value="In Progress" className="text-orange-600">⏳ {language === 'al' ? 'Në Proces' : 'In Progress'}</option>
                  <option value="Completed" className="text-green-600">✅ {language === 'al' ? 'Përfunduar' : 'Completed'}</option>
                  <option value="Cancelled" className="text-red-600">❌ {language === 'al' ? 'Anuluar' : 'Cancelled'}</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{language === 'al' ? 'Përshkrimi i Shërbimit / Shënime' : 'Service Description / Notes'}</label>
              <textarea 
                required 
                placeholder={language === 'al' ? 'psh. Ndërrim vaji dhe kontroll frene...' : 'e.g. Oil change and brake inspection...'} 
                rows="3" 
                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm" 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})}
              ></textarea>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              {editingId && (
                <button type="button" onClick={() => handleDelete(editingId)} className="bg-red-50 text-red-600 px-4 py-3 rounded-xl font-bold hover:bg-red-100 flex items-center gap-2">
                  <Trash2 size={18}/> <span className="hidden sm:inline">{language === 'al' ? 'Fshi' : 'Delete'}</span>
                </button>
              )}
              <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-md">
                {language === 'al' ? 'Ruaj Takimin' : 'Save Appointment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PAMJA KALENDAR (RESPONSIVE) */}
      {!showForm && viewMode === 'calendar' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8 animate-fade-in w-full">
          {/* Calendar Header */}
          <div className="p-3 md:p-4 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="text-lg md:text-xl font-black text-gray-800">
              {currentMonths[currentMonthIndex]} {currentYear}
            </h2>
            <div className="flex gap-1 md:gap-2">
              <button onClick={prevMonth} className="p-1.5 md:p-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-600"><ChevronLeft size={20}/></button>
              <button onClick={goToday} className="px-3 md:px-4 py-1.5 md:py-2 bg-white border border-gray-300 rounded font-bold text-xs md:text-sm hover:bg-gray-100 text-gray-700">
                {language === 'al' ? 'Sot' : 'Today'}
              </button>
              <button onClick={nextMonth} className="p-1.5 md:p-2 bg-white border border-gray-300 rounded hover:bg-gray-100 text-gray-600"><ChevronRight size={20}/></button>
            </div>
          </div>
          
          {/* Calendar Grid Container (Fluid width, no horizontal scroll) */}
          <div className="w-full border-b border-gray-200">
            {/* Days Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 bg-white">
              {currentDays.map((dayName, i) => (
                <div key={i} className="p-1 md:p-3 text-center text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider border-r last:border-r-0">
                  {dayName}
                </div>
              ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 bg-gray-100 gap-px">
              {/* Pad empty days at start of month */}
              {Array.from({ length: startDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-gray-50 min-h-[80px] md:min-h-[120px] p-1 md:p-2"></div>
              ))}
              
              {/* Render Actual Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dayApts = getAppointmentsForDay(dayNum);
                const isToday = new Date().getDate() === dayNum && new Date().getMonth() === currentMonthIndex && new Date().getFullYear() === currentYear;

                return (
                  <div 
                    key={dayNum} 
                    onClick={(e) => {
                      if(e.target === e.currentTarget || e.target.tagName === 'DIV') openFormForDay(dayNum);
                    }}
                    className={`bg-white min-h-[80px] md:min-h-[120px] p-1 md:p-2 flex flex-col gap-1 border-r border-b cursor-pointer hover:bg-blue-50/30 transition-colors ${isToday ? 'bg-blue-50/50' : ''}`}
                  >
                    <span className={`text-xs md:text-sm font-bold w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full mb-1 ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500'}`}>
                      {dayNum}
                    </span>
                    
                    {dayApts.map(apt => {
                      const { time } = formatDateTime(apt.appointment_date);
                      
                      let badgeColor = "bg-gray-100 text-gray-700 border-gray-200";
                      if (apt.status === "Scheduled") badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                      if (apt.status === "In Progress") badgeColor = "bg-orange-50 text-orange-700 border-orange-200";
                      if (apt.status === "Completed") badgeColor = "bg-green-50 text-green-700 border-green-200";
                      if (apt.status === "Cancelled") badgeColor = "bg-red-50 text-red-700 border-red-200";

                      return (
                        <div 
                          key={apt.id} 
                          onClick={(e) => { e.stopPropagation(); handleEdit(apt); }}
                          className={`text-[9px] md:text-xs p-1 md:p-1.5 rounded border md:border-l-4 cursor-pointer hover:brightness-95 transition-all mb-1 ${badgeColor} shadow-sm`}
                        >
                          <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis leading-tight">
                            {time} <span className="hidden md:inline">- {apt.cars?.make}</span>
                          </div>
                          {/* Emri i klientit shfaqet vetëm në kompjuter/tablet (md) */}
                          <div className="hidden md:block whitespace-nowrap overflow-hidden text-ellipsis opacity-80 text-[10px]">
                            {apt.cars?.clients?.full_name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PAMJA LISTË */}
      {!showForm && viewMode === 'list' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in">
          {loading ? <p>{language === 'al' ? 'Duke ngarkuar...' : 'Loading...'}</p> : appointments.map(apt => {
            const { date, time } = formatDateTime(apt.appointment_date);
            
            let statusColor = "bg-gray-100 text-gray-700";
            if (apt.status === "Scheduled") statusColor = "bg-blue-100 text-blue-700";
            if (apt.status === "In Progress") statusColor = "bg-orange-100 text-orange-700";
            if (apt.status === "Completed") statusColor = "bg-green-100 text-green-700";
            if (apt.status === "Cancelled") statusColor = "bg-red-100 text-red-700";

            const displayStatus = {
              'Scheduled': language === 'al' ? 'E Planifikuar' : 'Scheduled',
              'In Progress': language === 'al' ? 'Në Proces' : 'In Progress',
              'Completed': language === 'al' ? 'Përfunduar' : 'Completed',
              'Cancelled': language === 'al' ? 'Anuluar' : 'Cancelled'
            }[apt.status] || apt.status;

            return (
              <div key={apt.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 text-gray-800 font-black mb-1">
                      <CalendarIcon size={16} className="text-blue-500"/> {date}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600 text-sm font-bold">
                      <Clock size={16} className="text-blue-500"/> {time}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusColor}`}>
                    {displayStatus}
                  </span>
                </div>
                
                <div className="p-4 flex-1">
                  <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2"><Car size={16} className="text-gray-400"/> {apt.cars?.make} {apt.cars?.model}</h3>
                  <p className="text-sm font-mono text-gray-500 mb-3">{apt.cars?.plate}</p>
                  <p className="text-sm text-gray-700 flex items-center gap-2 mb-4"><User size={14} className="text-gray-400"/> {apt.cars?.clients?.full_name} ({apt.cars?.clients?.phone})</p>
                  
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-600">
                    <p className="font-bold text-xs uppercase tracking-wider text-gray-400 mb-1">{language === 'al' ? 'Arsyeja e vizitës' : 'Reason for visit'}</p>
                    {apt.description}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-100 flex gap-2 bg-white">
                  <button onClick={() => handleEdit(apt)} className="flex-1 text-sm text-blue-600 bg-blue-50 py-2 rounded font-bold hover:bg-blue-100 flex justify-center items-center gap-1">
                    <Pencil size={16}/> {t.edit || (language === 'al' ? 'Ndrysho' : 'Edit')}
                  </button>
                  <button onClick={() => handleDelete(apt.id)} className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded font-bold hover:bg-red-100"><Trash2 size={16}/></button>
                </div>
              </div>
            )
          })}
          {!loading && appointments.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-500 italic bg-white rounded-xl border border-dashed">
              {t.no_appointments || (language === 'al' ? 'Nuk ka takime të planifikuara.' : 'No appointments scheduled.')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}