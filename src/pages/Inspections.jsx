import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Plus, X, Car, CheckCircle, AlertTriangle, XCircle, Search, Eraser, Pencil, Trash2, Settings, Save } from 'lucide-react';
import { useLanguage } from '../LanguageContext'; 
import { translations } from '../translations';
import { useToast, EmptyState, CardSkeleton } from '../components/ui';
import { vehicleName } from '../lib/vehicle';
import { formatMoney, formatDate } from '../lib/format'; 

const CAR_DIAGRAMS = {
  'Sedan': '/Sedan.png',
  'SUV': '/SUV.png',
  'Pickup Truck': '/Pickup Truck.png',
  'Hatchback': 'Hatchback.png'
};

const DEFAULT_TEMPLATE = [
  { category: "FRENAT", items: ["Cilindër kryesor i frenave", "Cilindra të rrotave", "Disqe frenash", "JASTIKET E FRENAVE", "Kaliperë", "Tuba dhe gypa frenash"] },
  { category: "NËN KAPAK (UNDER HOOD)", items: ["Filtri i ajrit të motorit", "Nivelet e lëngjeve", "Rripat e motorit", "PER RRJEDHJE TE ULES NE MOTOR"] },
  { category: "PJESA E BRENDSHME (INTERIOR)", items: ["Dritat paralajmëruese në panel", "Ndriçimi i brendshëm", "Rregullatorët e sediljeve", "Rripat e sigurisë", "Tapetet e dyshemesë", "Xhamat dhe xhami i përparmë"] },
  { category: "PJESA E JASHTME", items: ["Amortizatorët", "Boria", "Dritat", "Fshirëset e xhamit", "Gjendja e karrocerisë", "Pasqyrat / Xhamat", "Profili dhe presioni i gomave", "Sistemi i shkarkimit (egzoz)"] }
];

export default function Inspections() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const toast = useToast();

  const [inspections, setInspections] = useState([]);
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [inspectionTemplate, setInspectionTemplate] = useState([]);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState([]);
  const [workshopId, setWorkshopId] = useState(null);
  const [editItemState, setEditItemState] = useState({ catIdx: null, itemIdx: null, text: '' });

  const [selectedCarId, setSelectedCarId] = useState('');
  const [advisor, setAdvisor] = useState('');
  const [technician, setTechnician] = useState('');
  const [odometer, setOdometer] = useState('');
  const [damageNotes, setDamageNotes] = useState('');
  const [results, setResults] = useState({});
  const [bodyType, setBodyType] = useState('Sedan'); 

  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [damageImage, setDamageImage] = useState(null);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (showForm && damageImage && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = damageImage;
    }
  }, [showForm, damageImage, bodyType]); 

  // --- FUNKSIONET E VIZATIMIT KANAVACËS (E RREGULLUAR PËR PRECIZION 100%) ---
  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Llogarisim raportin e shkallëzimit midis madhësisë CSS dhe asaj reale të Canvas
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Shumëzojmë koordinatat me shkallëzimin për precizion absolut!
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'red'; 
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.closePath();
      setIsDrawing(false);
      setDamageImage(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDamageImage(null);
  };

  const handleBodyTypeChange = (e) => {
    const confirmMsg = language === 'al' ? "Ndryshimi i formës do të fshijë vizatimin. Vazhdo?" : "Changing car shape clears drawing. Continue?";
    if (damageImage && !window.confirm(confirmMsg)) return;
    setBodyType(e.target.value);
    clearCanvas(); 
  };

  async function fetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('workshop_id').eq('id', user.id).single();

    if (profile) {
      setWorkshopId(profile.workshop_id);
      
      const { data: shopData } = await supabase.from('workshops').select('inspection_template').eq('id', profile.workshop_id).single();
      const template = shopData?.inspection_template || DEFAULT_TEMPLATE;
      setInspectionTemplate(template);
      setEditingTemplate(JSON.parse(JSON.stringify(template))); 

      const { data: inspData } = await supabase.from('inspections')
        .select(`*, cars(make, model, plate, clients(full_name))`)
        .eq('workshop_id', profile.workshop_id).order('created_at', { ascending: false });
      setInspections(inspData || []);

      const { data: carData } = await supabase.from('cars')
        .select('id, make, model, plate, clients(full_name)').eq('workshop_id', profile.workshop_id).order('make');
      setCars(carData || []);
    }
    setLoading(false);
  }

  // --- LOGJIKA PËR EDITORIN E TEMPLATIT ---
  const saveTemplate = async () => {
    try {
      await supabase.from('workshops').update({ inspection_template: editingTemplate }).eq('id', workshopId);
      setInspectionTemplate(editingTemplate);
      setShowTemplateEditor(false);
      toast.success(language === 'al' ? 'Modeli i inspektimit u ruajt me sukses!' : 'Inspection template saved successfully!');
    } catch (error) {
      toast.error("Error: " + error.message);
    }
  };

  const addCategory = () => setEditingTemplate([...editingTemplate, { category: "Kategori e Re", items: [] }]);
  const updateCategoryName = (index, newName) => {
    const updated = [...editingTemplate];
    updated[index].category = newName;
    setEditingTemplate(updated);
  };
  const removeCategory = (index) => {
    const updated = editingTemplate.filter((_, i) => i !== index);
    setEditingTemplate(updated);
  };
  const addItemToCategory = (catIndex) => {
    const updated = [...editingTemplate];
    updated[catIndex].items.push("Pjesë e Re");
    setEditingTemplate(updated);
  };
  const updateItemName = (catIndex, itemIndex, newName) => {
    const updated = [...editingTemplate];
    updated[catIndex].items[itemIndex] = newName;
    setEditingTemplate(updated);
  };
  const removeItemFromCategory = (catIndex, itemIndex) => {
    const updated = [...editingTemplate];
    updated[catIndex].items = updated[catIndex].items.filter((_, i) => i !== itemIndex);
    setEditingTemplate(updated);
  };

  // --- INLINE EDIT PËR FORMËN ---
  const handleEditItemStart = (catIdx, itemIdx, text) => setEditItemState({ catIdx, itemIdx, text });

  const handleEditItemSave = async () => {
    if (editItemState.catIdx === null || editItemState.itemIdx === null) return;
    const { catIdx, itemIdx, text } = editItemState;
    if (!text.trim()) return setEditItemState({ catIdx: null, itemIdx: null, text: '' });

    const updatedTemplate = [...inspectionTemplate];
    const oldText = updatedTemplate[catIdx].items[itemIdx];
    const category = updatedTemplate[catIdx].category;

    updatedTemplate[catIdx].items[itemIdx] = text;

    const oldKey = `${category}-${oldText}`;
    const newKey = `${category}-${text}`;
    if (results[oldKey]) {
       setResults(prev => {
         const newRes = { ...prev };
         newRes[newKey] = newRes[oldKey];
         delete newRes[oldKey];
         return newRes;
       });
    }

    setInspectionTemplate(updatedTemplate);
    setEditItemState({ catIdx: null, itemIdx: null, text: '' });

    if (workshopId) {
      await supabase.from('workshops').update({ inspection_template: updatedTemplate }).eq('id', workshopId);
    }
  };

  const handleDeleteItem = async (catIdx, itemIdx) => {
    if(!window.confirm(language === 'al' ? 'Fshi këtë rresht përgjithmonë?' : 'Delete this item permanently?')) return;
    const updatedTemplate = [...inspectionTemplate];
    updatedTemplate[catIdx].items.splice(itemIdx, 1);
    setInspectionTemplate(updatedTemplate);
    if (workshopId) await supabase.from('workshops').update({ inspection_template: updatedTemplate }).eq('id', workshopId);
  };

  const handleAddItem = async (catIdx) => {
    const newItemName = window.prompt(language === 'al' ? 'Shkruaj emrin e pjesës së re:' : 'Enter new item name:');
    if(!newItemName || !newItemName.trim()) return;

    const updatedTemplate = [...inspectionTemplate];
    updatedTemplate[catIdx].items.push(newItemName.trim());
    setInspectionTemplate(updatedTemplate);
    if (workshopId) await supabase.from('workshops').update({ inspection_template: updatedTemplate }).eq('id', workshopId);
  };

  function handleStatusClick(category, item, status) {
    const key = `${category}-${item}`;
    setResults(prev => ({ ...prev, [key]: status }));
  }

  function handleCancel() {
    setShowForm(false); setEditingId(null); setSelectedCarId(''); setAdvisor('');
    setTechnician(''); setOdometer(''); setDamageNotes(''); setBodyType('Sedan');
    setResults({}); setDamageImage(null);
  }

  function handleEdit(insp) {
    setSelectedCarId(insp.car_id); setAdvisor(insp.advisor || ''); setTechnician(insp.technician || '');
    setOdometer(insp.odometer || ''); setDamageNotes(insp.damage_notes || ''); setBodyType(insp.body_type || 'Sedan'); 
    setResults(insp.results || {}); setDamageImage(insp.damage_image || null); setEditingId(insp.id); setShowForm(true);
  }

  async function handleDelete(id) {
    if (window.confirm(language === 'al' ? "Fshi këtë raport?" : "Delete this report?")) {
      await supabase.from('inspections').delete().eq('id', id); fetchData();
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCarId) return toast.error(language === 'al' ? 'Ju lutem zgjidhni një veturë.' : 'Please select a car.');
    
    try {
      const payload = {
        workshop_id: workshopId, car_id: selectedCarId, advisor, technician,
        odometer, damage_notes: damageNotes, results: results, damage_image: damageImage, body_type: bodyType
      };

      if (editingId) await supabase.from('inspections').update(payload).eq('id', editingId);
      else await supabase.from('inspections').insert([payload]);

      handleCancel(); fetchData(); 
    } catch (error) { toast.error((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Error saving inspection: ') + error.message); }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.inspections || (language === 'al' ? 'Inspektimet e Veturave' : 'Vehicle Inspections')}</h1>
          <p className="page-subtitle">{language === 'al' ? 'Raporte dixhitale të inspektimit të shumëfishtë' : 'Digital multi-point inspection reports'}</p>
        </div>
        {!showForm && !showTemplateEditor && (
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setShowTemplateEditor(true)} className="btn btn-secondary flex-1 md:flex-none">
              <Settings size={16} /> {language === 'al' ? 'Kategoritë' : 'Checklist items'}
            </button>
            <button onClick={() => setShowForm(true)} className="btn btn-primary flex-1 md:flex-none">
              <Plus size={16} /> {language === 'al' ? 'Inspektim i ri' : 'New inspection'}
            </button>
          </div>
        )}
      </div>

      {showTemplateEditor && (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 mb-8 overflow-hidden animate-fade-in max-w-4xl mx-auto">
          <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">{language === 'al' ? 'Menaxho Listën e Inspektimit' : 'Manage Inspection Checklist'}</h2>
              <p className="text-sm text-gray-400 mt-1">{language === 'al' ? 'Krijo listën tënde të personalizuar të pjesëve që duhet të kontrollohen gjithmonë.' : 'Create your custom checklist of items that must be checked.'}</p>
            </div>
            <button onClick={() => setShowTemplateEditor(false)} className="text-gray-400 hover:text-white"><X size={24}/></button>
          </div>
          
          <div className="p-6 bg-gray-50 space-y-6">
            {editingTemplate.map((cat, catIdx) => (
              <div key={catIdx} className="bg-white border rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <input 
                    className="text-lg font-semibold text-blue-800 outline-none border-b-2 border-transparent focus:border-blue-500 bg-transparent"
                    value={cat.category}
                    onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                  />
                  <button onClick={() => removeCategory(catIdx)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
                </div>
                <div className="space-y-2">
                  {cat.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-center gap-2 ml-4">
                      <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                      <input 
                        className="flex-1 p-2 text-sm border rounded outline-none focus:border-blue-500"
                        value={item}
                        onChange={(e) => updateItemName(catIdx, itemIdx, e.target.value)}
                      />
                      <button onClick={() => removeItemFromCategory(catIdx, itemIdx)} className="text-gray-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => addItemToCategory(catIdx)} className="ml-4 mt-2 text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                    <Plus size={14}/> {language === 'al' ? 'Shto Pjesë për Kontroll' : 'Add Item'}
                  </button>
                </div>
              </div>
            ))}
            
            <button onClick={addCategory} className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-bold hover:bg-gray-100 hover:border-gray-400 transition-all flex justify-center items-center gap-2">
              <Plus size={20}/> {language === 'al' ? 'Shto një Kategori të re (psh. Motorri, Gomat)' : 'Add new Category'}
            </button>

            <div className="flex justify-end pt-4 border-t">
              <button onClick={saveTemplate} className="btn btn-primary">
                <Save size={20}/> {language === 'al' ? 'Ruaj Ndryshimet' : 'Save Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm && !showTemplateEditor && (
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 mb-8 overflow-hidden animate-fade-in max-w-5xl mx-auto">
          <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
            <h2 className="text-xl md:text-2xl font-semibold flex items-center gap-3">
              <ClipboardCheck size={28} className="text-blue-400" /> 
              {editingId 
                ? (language === 'al' ? 'Ndrysho Raportin' : 'Edit Inspection Report') 
                : (language === 'al' ? 'Raporti i Inspektimit' : 'Vehicle Inspection Report')}
            </h2>
            <button onClick={handleCancel} className="text-gray-400 hover:text-white transition-colors"><X size={24}/></button>
          </div>
          
          <form onSubmit={handleSubmit} className="p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 border-b pb-8">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Vetura & Klienti' : 'Vehicle & Client'}</label>
                <select required className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedCarId} onChange={e => setSelectedCarId(e.target.value)}>
                  <option value="">{language === 'al' ? '-- Zgjidh Veturën --' : '-- Choose Car --'}</option>
                  {cars.map(c => <option key={c.id} value={c.id}>{c.clients?.full_name} - {c.make} {c.model} [{c.plate}]</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Këshilltari' : 'Advisor'}</label>
                <input className="w-full p-3 border rounded-lg outline-none" placeholder={language === 'al' ? 'Emri' : 'Name'} value={advisor} onChange={e => setAdvisor(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Tekniku' : 'Technician'}</label>
                <input required className="w-full p-3 border rounded-lg outline-none" placeholder={language === 'al' ? 'Emri' : 'Name'} value={technician} onChange={e => setTechnician(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Kilometrazhi' : 'Odometer'}</label>
                <input className="w-full p-3 border rounded-lg outline-none" placeholder="e.g. 150,000 km" value={odometer} onChange={e => setOdometer(e.target.value)} />
              </div>
            </div>

            <div className="mt-8 border rounded-xl overflow-hidden shadow-sm mb-8">
               <div className="bg-gray-100 border-b p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                 <h3 className="text-lg font-semibold text-gray-800">{language === 'al' ? 'Dëmtimet e Karrocerisë (Vizatoni problemet)' : 'Body Damage (Draw to mark issues)'}</h3>
                 
                 <div className="flex items-center gap-4 w-full md:w-auto">
                   <select className="flex-1 md:flex-none p-2 border border-gray-300 rounded text-sm outline-none bg-white font-bold text-gray-700" value={bodyType} onChange={handleBodyTypeChange}>
                     {Object.keys(CAR_DIAGRAMS).map(type => (
                       <option key={type} value={type}>{type}</option>
                     ))}
                   </select>

                   <button type="button" onClick={clearCanvas} className="flex items-center justify-center gap-1 text-sm text-red-600 font-bold bg-red-50 px-3 py-2 rounded hover:bg-red-100 transition-colors">
                     <Eraser size={16}/> {language === 'al' ? 'Fshi' : 'Clear'}
                   </button>
                 </div>
               </div>
               
               <div className="p-4 flex flex-col md:flex-row gap-6">
                 <div className="flex-1 flex justify-center bg-gray-50 border rounded-lg overflow-hidden relative" style={{ touchAction: 'none' }}>
                   <img src={CAR_DIAGRAMS[bodyType]} alt="Car Diagram" className="absolute inset-0 w-full h-full object-contain opacity-20 pointer-events-none p-4" />
                   <canvas
                     ref={canvasRef}
                     width={500}
                     height={300}
                     className="relative z-10 cursor-crosshair w-full max-w-[500px]"
                     onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseOut={stopDrawing}
                     onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
                   />
                 </div>

                 <div className="flex-1">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{language === 'al' ? 'Shënime të Përgjithshme' : 'General Comments'}</label>
                   <textarea 
                     className="w-full p-4 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 min-h-[250px] md:min-h-full"
                     placeholder={language === 'al' ? 'Shëno ndonjë dëmtim specifik ose shënime këtu...' : 'Note any specific damage or notes here...'}
                     value={damageNotes} onChange={e => setDamageNotes(e.target.value)}
                   ></textarea>
                 </div>
               </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-8 bg-gray-50 p-4 rounded-lg border">
               <div className="flex items-center gap-2 font-bold text-xs md:text-sm text-gray-700"><CheckCircle size={18} className="text-green-500"/> {language === 'al' ? 'OK' : 'Checked and OK'}</div>
               <div className="flex items-center gap-2 font-bold text-xs md:text-sm text-gray-700"><AlertTriangle size={18} className="text-yellow-500"/> {language === 'al' ? 'Kujdes / Shënim' : 'Future Attention'}</div>
               <div className="flex items-center gap-2 font-bold text-xs md:text-sm text-gray-700"><XCircle size={18} className="text-red-500"/> {language === 'al' ? 'Duhet Rregulluar' : 'Immediate Attention'}</div>
            </div>

            <div className="space-y-6 md:space-y-8">
              {inspectionTemplate.map((cat, idx) => (
                <div key={idx} className="border rounded-xl overflow-hidden shadow-sm">
                  <div className="bg-blue-50/50 border-b p-3 md:p-4">
                    <h3 className="text-base md:text-lg font-semibold text-blue-900">{cat.category}</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {cat.items.map((item, itemIdx) => {
                      const status = results[`${cat.category}-${item}`];
                      const isEditing = editItemState.catIdx === idx && editItemState.itemIdx === itemIdx;

                      return (
                        <div key={itemIdx} className="p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-colors group">
                          
                          <div className="flex items-center flex-1 gap-3 mb-3 md:mb-0">
                            {isEditing ? (
                              <div className="flex items-center gap-2 w-full max-w-sm">
                                <input
                                  autoFocus
                                  className="flex-1 p-1.5 px-3 border-2 border-blue-400 rounded-lg outline-none font-semibold text-blue-800 bg-white shadow-sm"
                                  value={editItemState.text}
                                  onChange={e => setEditItemState({ ...editItemState, text: e.target.value })}
                                  onBlur={handleEditItemSave}
                                  onKeyDown={e => e.key === 'Enter' && handleEditItemSave()}
                                />
                              </div>
                            ) : (
                              <>
                                <span className="font-semibold text-gray-700 text-sm md:text-base">{item}</span>
                                <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => handleEditItemStart(idx, itemIdx, item)} className="text-gray-400 hover:text-blue-600 p-1.5 bg-white border shadow-sm rounded">
                                    <Pencil size={14} />
                                  </button>
                                  <button type="button" onClick={() => handleDeleteItem(idx, itemIdx)} className="text-gray-400 hover:text-red-600 p-1.5 bg-white border shadow-sm rounded">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex gap-1 md:gap-2">
                            <button type="button" onClick={() => handleStatusClick(cat.category, item, 'green')}
                              className={`flex-1 md:flex-none p-2 md:px-4 md:py-2 rounded-lg border font-bold flex items-center justify-center transition-all
                                ${status === 'green' ? 'bg-green-500 text-white border-green-600 shadow-inner' : 'bg-white text-gray-400 hover:bg-green-50 hover:text-green-500'}`}>
                              <CheckCircle size={18}/>
                            </button>
                            <button type="button" onClick={() => handleStatusClick(cat.category, item, 'yellow')}
                              className={`flex-1 md:flex-none p-2 md:px-4 md:py-2 rounded-lg border font-bold flex items-center justify-center transition-all
                                ${status === 'yellow' ? 'bg-yellow-400 text-yellow-900 border-yellow-500 shadow-inner' : 'bg-white text-gray-400 hover:bg-yellow-50 hover:text-yellow-500'}`}>
                              <AlertTriangle size={18}/>
                            </button>
                            <button type="button" onClick={() => handleStatusClick(cat.category, item, 'red')}
                              className={`flex-1 md:flex-none p-2 md:px-4 md:py-2 rounded-lg border font-bold flex items-center justify-center transition-all
                                ${status === 'red' ? 'bg-red-500 text-white border-red-600 shadow-inner' : 'bg-white text-gray-400 hover:bg-red-50 hover:text-red-500'}`}>
                              <XCircle size={18}/>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="bg-gray-50 border-t p-2">
                     <button type="button" onClick={() => handleAddItem(idx)} className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1 p-2">
                       <Plus size={16}/> {language === 'al' ? 'Shto element të ri' : 'Add new item'}
                     </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={handleCancel} className="btn btn-secondary w-full sm:w-auto">{language === 'al' ? 'Anulo' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary w-full sm:w-auto">
                 {editingId 
                    ? (language === 'al' ? 'Përditëso' : 'Update') 
                    : (language === 'al' ? 'Ruaj' : 'Save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && !showTemplateEditor && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {!loading && inspections.length === 0 && (
            <div className="col-span-full card">
              <EmptyState icon={ClipboardCheck}
                title={language === 'al' ? 'Nuk ka inspektime ende' : 'No inspections yet'}
                description={language === 'al' ? 'Krijoni inspektimin e parë për një veturë.' : 'Create the first inspection for a vehicle.'} />
            </div>
          )}
          {loading ? <CardSkeleton count={3} /> : inspections.map(insp => (
            <div key={insp.id} className="card hover:border-gray-300 transition-colors flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg text-gray-800 leading-tight">{vehicleName(insp.cars?.make, insp.cars?.model)}</h3>
                    <p className="text-sm text-gray-500 font-medium flex items-center gap-1 mt-1"><Car size={14}/> {insp.cars?.plate}</p>
                  </div>
                  <span className="text-[10px] md:text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{new Date(insp.created_at).toLocaleDateString()}</span>
                </div>
                
                <div className="text-xs md:text-sm text-gray-600 bg-gray-50 p-3 rounded border">
                   <p><span className="font-bold">{language === 'al' ? 'Këshilltari:' : 'Advisor:'}</span> {insp.advisor || 'N/A'}</p>
                   <p><span className="font-bold">{language === 'al' ? 'Tekniku:' : 'Tech:'}</span> {insp.technician}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 border-t flex gap-2">
                 <button onClick={() => handleEdit(insp)} className="btn btn-secondary btn-sm flex-1">
                   <Pencil size={16}/> <span className="hidden sm:inline">{t.edit || (language === 'al' ? 'Ndrysho' : 'Edit')}</span>
                 </button>
                 <button onClick={() => navigate(`/inspections/${insp.id}`)} className="btn btn-secondary btn-sm flex-1">
                   <Search size={16}/> <span className="hidden sm:inline">{language === 'al' ? 'Shiko' : 'View'}</span>
                 </button>
                 <button onClick={() => handleDelete(insp.id)} className="btn btn-danger btn-sm">
                   <Trash2 size={16}/>
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}