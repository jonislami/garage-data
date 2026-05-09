import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Building, Users, Plus, Trash2, Download, Car, FileText, Activity, PauseCircle, PlayCircle } from 'lucide-react';

// CHANGE THIS TO YOUR EXACT EMAIL!
const SUPER_ADMIN_EMAIL = 'trilon1234@gmail.com'; 

export default function SuperAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [metrics, setMetrics] = useState({ totalCars: 0, totalInvoices: 0 });
  
  const [newWorkshopName, setNewWorkshopName] = useState('');
  const [newWorkshopCurrency, setNewWorkshopCurrency] = useState('€');

  useEffect(() => { checkAdminAndFetchData(); }, []);

  async function checkAdminAndFetchData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      alert("ACCESS DENIED: You are not authorized to view this page.");
      navigate('/');
      return;
    }

    const { data: shopData } = await supabase.from('workshops').select('*').order('created_at', { ascending: false });
    const { data: profileData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    
    const { data: allCars } = await supabase.from('cars').select('id, workshop_id');
    const { data: allServices } = await supabase.from('services').select('id, workshop_id');
    
    setMetrics({ totalCars: allCars?.length || 0, totalInvoices: allServices?.length || 0 });

    const enhancedShops = shopData?.map(shop => ({
      ...shop,
      carCount: allCars?.filter(c => c.workshop_id === shop.id).length || 0,
      invoiceCount: allServices?.filter(s => s.workshop_id === shop.id).length || 0
    })) || [];
    
    setWorkshops(enhancedShops);
    setProfiles(profileData || []);
    setLoading(false);
  }

  async function handleCreateWorkshop(e) {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('workshops').insert([{ 
        name: newWorkshopName, currency: newWorkshopCurrency, owner_id: user.id, is_active: true
      }]);
      if (error) throw error;
      setNewWorkshopName('');
      alert("Workshop Created! You can now assign users to it.");
      checkAdminAndFetchData();
    } catch (error) { alert("Error: " + error.message); }
  }

  // --- NEW: SUSPEND / ACTIVATE GARAGE ---
  async function handleToggleSuspend(id, currentStatus, name) {
    const action = currentStatus ? "SUSPEND" : "REACTIVATE";
    if (window.confirm(`Are you sure you want to ${action} ${name}?`)) {
      try {
        const { error } = await supabase.from('workshops').update({ is_active: !currentStatus }).eq('id', id);
        if (error) throw error;
        checkAdminAndFetchData();
      } catch (error) { alert("Error updating status: " + error.message); }
    }
  }

  // --- DELETE GARAGE (Permanent) ---
  async function handleDeleteWorkshop(id, name) {
    if (window.confirm(`CRITICAL WARNING: Are you sure you want to completely DELETE "${name}"? This is permanent and cannot be undone!`)) {
      try {
        const { error } = await supabase.from('workshops').delete().eq('id', id);
        if (error) throw error;
        alert(`${name} has been permanently deleted.`);
        checkAdminAndFetchData();
      } catch (error) { alert("Error deleting workshop: " + error.message); }
    }
  }

  async function handleAssignUser(profileId, workshopId) {
    try {
      const payload = { workshop_id: workshopId || null };
      const { error } = await supabase.from('profiles').update(payload).eq('id', profileId);
      if (error) throw error;
      alert("User access updated successfully!");
      checkAdminAndFetchData();
    } catch (error) { alert("Error assigning user: " + error.message); }
  }

  async function handleBackupData(workshopId, workshopName) {
    try {
      alert(`Preparing backup for ${workshopName}... Please wait.`);
      const [clients, cars, services, inventory, expenses] = await Promise.all([
        supabase.from('clients').select('*').eq('workshop_id', workshopId),
        supabase.from('cars').select('*').eq('workshop_id', workshopId),
        supabase.from('services').select('*, service_items(*)').eq('workshop_id', workshopId),
        supabase.from('inventory').select('*').eq('workshop_id', workshopId),
        supabase.from('expenses').select('*').eq('workshop_id', workshopId)
      ]);

      const backupObject = {
        workshop_name: workshopName, backup_date: new Date().toISOString(),
        clients: clients.data || [], cars: cars.data || [],
        services_and_invoices: services.data || [], inventory: inventory.data || [],
        expenses: expenses.data || []
      };

      const blob = new Blob([JSON.stringify(backupObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = `${workshopName.replace(/\s+/g, '_')}_Backup.json`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch (error) { alert("Error generating backup: " + error.message); }
  }

  if (loading) return <div className="p-8 text-center font-bold text-gray-500">Verifying Admin Access...</div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-red-500 p-3 rounded-xl"><ShieldAlert size={32} /></div>
          <div><h1 className="text-2xl font-black uppercase tracking-widest">Super Admin</h1><p className="text-sm text-gray-400 font-medium">SaaS Management Platform</p></div>
        </div>
        
        <div className="flex gap-4 sm:gap-8 bg-gray-800 p-4 rounded-xl border border-gray-700 w-full md:w-auto overflow-x-auto">
           <div><p className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1"><Building size={12}/> Garages</p><p className="text-2xl font-black">{workshops.length}</p></div>
           <div><p className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1"><Users size={12}/> Users</p><p className="text-2xl font-black">{profiles.length}</p></div>
           <div><p className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1"><Car size={12}/> Total Cars</p><p className="text-2xl font-black text-blue-400">{metrics.totalCars}</p></div>
           <div><p className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1"><FileText size={12}/> Invoices</p><p className="text-2xl font-black text-green-400">{metrics.totalInvoices}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-4"><Plus className="text-blue-600" /> 1. Create New Garage</h2>
            <form onSubmit={handleCreateWorkshop} className="space-y-4">
              <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Business Name</label><input required className="w-full p-3 border rounded-lg outline-none focus:ring-2" value={newWorkshopName} onChange={e => setNewWorkshopName(e.target.value)} placeholder="e.g. Ferizaj Auto" /></div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Currency</label>
                <select className="w-full p-3 border rounded-lg outline-none bg-white" value={newWorkshopCurrency} onChange={e => setNewWorkshopCurrency(e.target.value)}>
                  <option value="€">EUR (€)</option><option value="$">USD ($)</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg shadow-md transition-colors">Create Database Instance</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-4"><Activity className="text-blue-600" /> Platform Usage by Garage</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {workshops.map(shop => (
                <div key={shop.id} className={`flex flex-col xl:flex-row xl:justify-between xl:items-center p-4 border rounded-xl gap-4 ${shop.is_active === false ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-lg truncate">{shop.name}</p>
                      {shop.is_active === false && <span className="text-[10px] bg-red-600 text-white font-black px-2 py-0.5 rounded uppercase tracking-widest">Suspended</span>}
                    </div>
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border flex items-center gap-1"><Car size={12} className="text-blue-500"/> {shop.carCount} Cars</span>
                      <span className="text-xs font-bold text-gray-500 bg-white px-2 py-1 rounded border flex items-center gap-1"><FileText size={12} className="text-green-500"/> {shop.invoiceCount} Invoices</span>
                    </div>
                  </div>
                  
                  {/* SAAS CONTROLS: BACKUP, SUSPEND, DELETE */}
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button onClick={() => handleBackupData(shop.id, shop.name)} className="px-3 py-2 text-sm font-bold text-blue-600 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors flex items-center gap-1" title="Download Backup">
                      <Download size={16} /> Backup
                    </button>
                    
                    {/* SUSPEND BUTTON */}
                    <button onClick={() => handleToggleSuspend(shop.id, shop.is_active, shop.name)} className={`px-3 py-2 text-sm font-bold rounded-lg transition-colors flex items-center gap-1 ${shop.is_active !== false ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {shop.is_active !== false ? <><PauseCircle size={16} /> Suspend</> : <><PlayCircle size={16} /> Activate</>}
                    </button>

                    {/* DELETE BUTTON */}
                    <button onClick={() => handleDeleteWorkshop(shop.id, shop.name)} className="p-2 text-red-600 bg-red-100 hover:bg-red-200 rounded-lg transition-colors" title="Delete Permanent">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {workshops.length === 0 && <p className="text-sm text-gray-500 italic">No garages created yet.</p>}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 mb-6"><Users className="text-blue-600" /> 2. Link Users to Garages</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead className="bg-gray-50 border-b">
                  <tr><th className="p-3 text-xs font-bold text-gray-500 uppercase">User Email</th><th className="p-3 text-xs font-bold text-gray-500 uppercase">Current Workshop Access</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {profiles.map(profile => (
                    <tr key={profile.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{profile.email || 'No email saved'} {profile.email === SUPER_ADMIN_EMAIL && <span className="ml-2 text-[10px] bg-red-100 text-red-700 font-black px-2 py-0.5 rounded uppercase">Admin</span>}</td>
                      <td className="p-3">
                        <select className={`w-full p-2 border rounded outline-none text-sm font-semibold bg-white ${!profile.workshop_id ? 'border-red-300 text-red-600' : 'border-gray-300'}`} value={profile.workshop_id || ''} onChange={(e) => handleAssignUser(profile.id, e.target.value)}>
                          <option value="">-- NO ACCESS (LOCKED OUT) --</option>
                          {workshops.map(w => <option key={w.id} value={w.id}>{w.name} {w.is_active === false ? '(Suspended)' : ''}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}