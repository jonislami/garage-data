import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Building, MapPin, Phone, Globe, DollarSign, Upload, Image as ImageIcon, Loader2, Percent } from 'lucide-react';
import { useLanguage } from '../LanguageContext';

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workshopId, setWorkshopId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', address: '', phone: '', country: '', currency: '$', logo_url: '', vat_rate: 0
  });
  const [logoFile, setLogoFile] = useState(null);

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: workshop, error } = await supabase.from('workshops').select('*').eq('owner_id', user.id).single();
      if (error) throw error;

      if (workshop) {
        setWorkshopId(workshop.id);
        setFormData({
          name: workshop.name || '', address: workshop.address || '', phone: workshop.phone || '',
          country: workshop.country || '', currency: workshop.currency || '$', logo_url: workshop.logo_url || '',
          vat_rate: workshop.vat_rate || 0
        });
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let finalLogoUrl = formData.logo_url;
      if (logoFile) {
        const { data: { user } } = await supabase.auth.getUser();
        const fileName = `${user.id}-${Date.now()}.${logoFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile);
        if (uploadError) throw uploadError;
        finalLogoUrl = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl;
      }

      const { error } = await supabase.from('workshops').update({
        name: formData.name, address: formData.address, phone: formData.phone,
        country: formData.country, currency: formData.currency, logo_url: finalLogoUrl, vat_rate: formData.vat_rate
      }).eq('id', workshopId);

      if (error) throw error;
      alert('Settings saved successfully!');
    } catch (error) { alert('Error updating settings: ' + error.message); } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">{t('settings') || 'Workshop Settings'}</h1>
      <p className="text-gray-500 mb-8">Update your business details, branding, and preferences.</p>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 space-y-8">
        
        {/* LANGUAGE */}
        

        {/* BRANDING */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><ImageIcon size={20} className="text-blue-600"/> Branding</h2>
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden relative shrink-0">
              {logoFile ? <img src={URL.createObjectURL(logoFile)} alt="Preview" className="w-full h-full object-contain" /> : formData.logo_url ? <img src={formData.logo_url} alt="Current" className="w-full h-full object-contain" /> : <span className="text-gray-400 text-xs">No Logo</span>}
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Logo</label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Upload size={18} /> <span>Choose File</span>
                  <input type="file" className="hidden" accept="image/*" onChange={e => setLogoFile(e.target.files[0])} />
                </label>
                {logoFile && <span className="text-sm text-gray-500 truncate">{logoFile.name}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100"></div>

        {/* DETAILS */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><Building size={20} className="text-blue-600"/> Business Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Workshop Name</label>
              <div className="relative"><Building className="absolute left-3 top-3.5 text-gray-400" size={18} /><input required className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
              <div className="relative"><Phone className="absolute left-3 top-3.5 text-gray-400" size={18} /><input className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Address</label>
              <div className="relative"><MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} /><input className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
            </div>
            
            {/* TVSH AND CURRENCY */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Currency</label>
              <div className="relative"><DollarSign className="absolute left-3 top-3.5 text-gray-400" size={18} />
                <select className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none bg-white" value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})}>
                  <option value="€">EUR (€)</option><option value="$">USD ($)</option><option value="£">GBP (£)</option><option value="L">ALL (L)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">TVSH / VAT Rate</label>
              <div className="relative"><Percent className="absolute left-3 top-3.5 text-gray-400" size={18} />
                <select className="w-full pl-10 pr-4 py-3 border rounded-lg outline-none bg-white font-bold text-blue-700" value={formData.vat_rate} onChange={e => setFormData({...formData, vat_rate: e.target.value})}>
                  <option value="0">0% (Under €30k Turnover)</option>
                  <option value="18">18% (Standard Kosovo Rate)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex justify-end">
          <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold flex gap-2">
            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}