import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Wrench, MapPin, Phone, Building, Globe, DollarSign, Upload, Image as ImageIcon } from 'lucide-react';
import { useLanguage } from '../LanguageContext'; 

export default function Onboarding({ onComplete }) {
  const { language } = useLanguage();
  
  const [formData, setFormData] = useState({
    name: '', address: '', phone: '', country: '', currency: '$'
  });
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function createWorkshop(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failed. Please log in again.");

      let logoUrl = null;

      // 1. Ngarko logon nëse ka
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(fileName, logoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName);
          
        logoUrl = publicUrl;
      }

      // 2. Krijo Ofiçinën e Re në tabelën "workshops"
      const { data: workshop, error: shopError } = await supabase
        .from('workshops')
        .insert([{ 
          name: formData.name, 
          address: formData.address,
          phone: formData.phone,
          country: formData.country,
          currency: formData.currency,
          logo_url: logoUrl, 
          owner_id: user.id 
        }])
        .select()
        .single();

      if (shopError) throw shopError;

      // 3. KRIJO OSE PËRDITËSO PROFILIN (LOGJIKË E RE E PATHYESHME)
      // Kontrollojmë fillimisht nëse ekziston ndonjë profil fantazmë
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      let profileError = null;

      if (existingProfile) {
        // Profili ekziston, i bëjmë thjesht Update
        const { error } = await supabase
          .from('profiles')
          .update({ workshop_id: workshop.id, role: 'admin' })
          .eq('id', user.id);
        profileError = error;
      } else {
        // Profili nuk ekziston, e krijojmë nga e para (Insert)
        const { error } = await supabase
          .from('profiles')
          .insert([{ id: user.id, workshop_id: workshop.id, role: 'admin' }]);
        profileError = error;
      }

      if (profileError) throw profileError;

      // Ruajmë workshop_id për ta pasur Offline
      localStorage.setItem('sonic_workshop_id', workshop.id);

      onComplete();
    } catch (error) {
      console.error("Onboarding Error:", error);
      alert((language === 'al' ? 'Gabim gjatë ruajtjes: ' : 'Error saving: ') + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg border border-gray-200 shadow-sm p-6 sm:p-8 animate-fade-in">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">{language === 'al' ? 'Konfiguro Ofiçinën Tënde' : 'Setup Your Workshop'}</h1>
          <p className="text-sm text-gray-500 mt-1">{language === 'al' ? 'Detajet profesionale për faturat e tua.' : 'Professional details for your invoices.'}</p>
        </div>

        <form onSubmit={createWorkshop} className="space-y-4">
          
          <div className="flex justify-center mb-6">
            <label className="cursor-pointer flex flex-col items-center gap-2 border-2 border-dashed border-gray-300 p-4 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all w-full">
                {logoFile ? (
                    <div className="text-green-600 font-bold flex items-center gap-2"><ImageIcon/> {logoFile.name}</div>
                ) : (
                    <>
                        <Upload className="text-gray-400" size={32} />
                        <span className="text-sm text-gray-500 text-center">{language === 'al' ? 'Kliko për të ngarkuar Logon e Ofiçinës' : 'Click to upload Workshop Logo'}</span>
                    </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => setLogoFile(e.target.files[0])} />
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{language === 'al' ? 'Emri i Ofiçinës / Garazhit' : 'Workshop Name'}</label>
            <div className="relative">
                <Building className="absolute left-3 top-3 text-gray-400" size={18} />
                <input required placeholder={language === 'al' ? 'psh. Auto Servis Titi' : 'e.g. Auto Mechanic'} className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-500"
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{language === 'al' ? 'Qyteti/Adresa' : 'City/Address'}</label>
                <div className="relative">
                    <MapPin className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input placeholder={language === 'al' ? 'Qyteti, Rruga' : 'City, Street'} className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{language === 'al' ? 'Shteti' : 'Country'}</label>
                <div className="relative">
                    <Globe className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input placeholder={language === 'al' ? 'psh. Kosovë' : 'e.g. Kosovo'} className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{language === 'al' ? 'Telefoni' : 'Phone'}</label>
                <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input placeholder="+383..." className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>
            </div>
            <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">{language === 'al' ? 'Monedha' : 'Currency'}</label>
                <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-gray-400" size={18} />
                    <select className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none bg-white font-bold text-gray-700 focus:ring-2 focus:ring-blue-500"
                        value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                        <option value="€">EUR (€)</option>
                        <option value="$">USD ($)</option>
                        <option value="£">GBP (£)</option>
                        <option value="L">ALL (L)</option>
                    </select>
                </div>
            </div>
          </div>
          
          <button type="submit" disabled={loading}
            className="btn btn-primary btn-lg w-full mt-6">
            {loading ? (language === 'al' ? 'Po konfigurohet...' : 'Setting up...') : (language === 'al' ? 'Hap Ofiçinën' : 'Launch Workshop')}
          </button>
        </form>
      </div>
    </div>
  );
}