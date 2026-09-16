import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, ArrowLeft, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useLanguage } from '../LanguageContext'; // SHTUAR: Importo Context-in e gjuhës
import { translations } from '../translations';
import { useToast } from '../components/ui';

// SAME DICTIONARY AS THE EDITOR
const CAR_DIAGRAMS = {
  'Sedan': '/Sedan.png',
  'SUV': '/SUV.png',
  'Pickup Truck': '/Pickup Truck.png',
  'Hatchback': 'Hatchback.png'
};

export default function InspectionReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // SHTUAR: Lexo gjuhën dhe fjalorin
  const { language } = useLanguage();
  const t = translations[language] || translations.en;
  const toast = useToast();

  useEffect(() => {
    async function fetchReport() {
      const { data: insp, error } = await supabase
        .from('inspections')
        .select(`*, workshops ( name, address, phone, logo_url ), cars ( make, model, year, plate, clients ( full_name ) )`)
        .eq('id', id)
        .single();

      if (error) {
        toast.error(language === 'al' ? 'Gabim gjatë ngarkimit të raportit' : 'Error loading report');
        navigate('/inspections');
      } else {
        setData(insp);
      }
      setLoading(false);
    }
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, navigate]);

  if (loading) return <div className="p-8 text-center">{language === 'al' ? 'Duke ngarkuar raportin...' : 'Loading Report...'}</div>;
  if (!data) return <div className="p-8 text-center">{language === 'al' ? 'Raporti nuk u gjet.' : 'Report not found.'}</div>;

  const shop = data.workshops;
  const car = data.cars;
  const client = car?.clients;
  const results = data.results || {};
  
  // Identify the correct background shape
  const backgroundDiagram = CAR_DIAGRAMS[data.body_type || 'Sedan'];

  const categories = {};
  Object.keys(results).forEach(key => {
    const [category, item] = key.split('-');
    if (!categories[category]) categories[category] = [];
    categories[category].push({ item, status: results[key] });
  });

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between print:hidden">
        <button onClick={() => navigate('/inspections')} className="btn btn-ghost -ml-2">
          <ArrowLeft size={20} /> {language === 'al' ? 'Kthehu tek Inspektimet' : 'Back to Inspections'}
        </button>
        <button onClick={() => window.print()} className="btn btn-primary">
          <Printer size={20} /> {language === 'al' ? 'Printo Raportin' : 'Print Report'}
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white p-10 shadow-xl rounded-xl print:shadow-none print:w-full print:p-0">
        
        <div className="flex justify-between items-start border-b-4 border-blue-600 pb-6 mb-6">
          <div className="flex items-center gap-4">
            {shop?.logo_url && <img src={shop.logo_url} alt="Logo" className="w-16 h-16 object-contain" />}
            <div>
              <h1 className="text-3xl font-semibold text-gray-900 tracking-tight uppercase">
                {language === 'al' ? 'Raporti Vizual i Inspektimit të Veturës' : 'Visual Vehicle Inspection Report'}
              </h1>
              <h2 className="text-xl font-bold text-blue-600">{shop?.name}</h2>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{language === 'al' ? 'Data:' : 'Date:'} {new Date(data.created_at).toLocaleDateString()}</p>
            <p>{shop?.phone}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">{language === 'al' ? 'Emri i Klientit' : 'Customer Name'}</p>
            <p className="font-bold text-lg text-gray-800 mb-4">{client?.full_name}</p>
            
            <p className="text-xs font-bold text-gray-400 uppercase">{language === 'al' ? 'Vetura' : 'Vehicle'}</p>
            <p className="font-bold text-lg text-gray-800">{car?.year || ''} {car?.make} {car?.model}</p>
            <p className="text-sm text-gray-600">{language === 'al' ? 'Targa:' : 'Plate:'} {car?.plate}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase">{language === 'al' ? 'Këshilltari i Shërbimit' : 'Service Advisor'}</p>
            <p className="font-bold text-gray-800 mb-4">{data.advisor || (language === 'al' ? 'I padisponueshëm' : 'N/A')}</p>
            
            <p className="text-xs font-bold text-gray-400 uppercase">{language === 'al' ? 'Tekniku' : 'Technician'}</p>
            <p className="font-bold text-gray-800 mb-4">{data.technician || (language === 'al' ? 'I padisponueshëm' : 'N/A')}</p>
            
            <p className="text-xs font-bold text-gray-400 uppercase">{language === 'al' ? 'Kilometrazhi' : 'Odometer'}</p>
            <p className="font-bold text-gray-800">{data.odometer || (language === 'al' ? 'I padisponueshëm' : 'N/A')}</p>
          </div>
        </div>

        {(data.damage_image || data.damage_notes) && (
          <div className="mb-8 border-2 border-gray-200 rounded-lg overflow-hidden page-break-inside-avoid">
            <div className="bg-gray-100 p-3 border-b-2 border-gray-200">
              <h3 className="font-semibold text-gray-800 uppercase tracking-wider">
                {language === 'al' ? 'Dëmtimet e Karrocerisë & Shënime' : 'Body Damage & Notes'}
              </h3>
            </div>
            <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
              {data.damage_image && (
                <div className="flex-1 border rounded bg-gray-50 relative p-4 flex justify-center">
                   {/* DYNAMIC BACKGROUND RENDER */}
                   <img src={backgroundDiagram} className="w-full max-w-[400px] object-contain opacity-20 absolute inset-0 m-auto p-4" alt="Car Layout" />
                   <img src={data.damage_image} alt="Damage Drawing" className="w-full max-w-[400px] relative z-10" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">
                  {language === 'al' ? 'Komentet e Përgjithshme të Inspektimit' : 'General Inspection Comments'}
                </p>
                <p className="text-gray-700 whitespace-pre-wrap">{data.damage_notes || (language === 'al' ? 'Nuk ka shënime specifike.' : 'No specific notes provided.')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-8 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-200">
           <div className="flex items-center gap-2 font-bold text-xs text-gray-700 uppercase tracking-wider"><CheckCircle size={16} className="text-green-500"/> {language === 'al' ? 'Kontrolluar & OK' : 'Checked & OK'}</div>
           <div className="flex items-center gap-2 font-bold text-xs text-gray-700 uppercase tracking-wider"><AlertTriangle size={16} className="text-yellow-500"/> {language === 'al' ? 'Kujdes në të ardhmen' : 'Future Attention'}</div>
           <div className="flex items-center gap-2 font-bold text-xs text-gray-700 uppercase tracking-wider"><XCircle size={16} className="text-red-500"/> {language === 'al' ? 'Kujdes i menjëhershëm' : 'Immediate Attention'}</div>
        </div>

        <div className="space-y-6">
          {Object.keys(categories).map((category, idx) => (
            <div key={idx} className="border-2 border-gray-200 rounded-lg overflow-hidden page-break-inside-avoid">
              <div className="bg-gray-100 p-3 border-b-2 border-gray-200">
                <h3 className="font-semibold text-gray-800 uppercase tracking-wider">{category}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {categories[category].map((info, i) => (
                  <div key={i} className="p-3 px-6 flex justify-between items-center bg-white">
                    <span className="font-semibold text-gray-700">{info.item}</span>
                    <div>
                      {info.status === 'green' && <CheckCircle size={24} className="text-green-500" />}
                      {info.status === 'yellow' && <AlertTriangle size={24} className="text-yellow-500" />}
                      {info.status === 'red' && <XCircle size={24} className="text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t-2 border-gray-200 text-center text-gray-400 text-xs">
          <p>
            {language === 'al' 
              ? 'Ky raport është vetëm për qëllime informative. Ju lutem konsultohuni me këshilltarin tuaj të shërbimit për vlerësimet e riparimit.' 
              : 'This report is for informational purposes only. Please consult your service advisor for repair estimates.'}
          </p>
        </div>
      </div>
    </div>
  );
}