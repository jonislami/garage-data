import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LayoutDashboard, Zap, Users, Car, FileText, LogOut, Wrench, Package, Settings, ClipboardCheck, Menu, X, Globe, Receipt, ShieldAlert, CalendarIcon,Wifi, WifiOff, CloudLightning, PieChart } from 'lucide-react';
import { useLanguage } from '../LanguageContext'; 
import { useSync } from '../contexts/SyncContext';

// CHANGE THIS TO YOUR EXACT EMAIL!
const SUPER_ADMIN_EMAIL = 'trilon1234@gmail.com';

export default function Sidebar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { t, language, setLanguage } = useLanguage();
  const { isOnline, syncQueue, isSyncing } = useSync();

  useEffect(() => {
    // Check if the logged-in user is the Super Admin
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && user.email === SUPER_ADMIN_EMAIL) {
        setIsAdmin(true);
      }
    });
  }, []);

  // Normal Garage Menu
  const mechanicMenu = [
    { name: t('dashboard') || 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: t('appointments'), icon: CalendarIcon, path: '/appointments' },
    { name: t('clients') || 'Clients', icon: Users, path: '/clients' },
    { name: t('cars') || 'Cars', icon: Car, path: '/cars' },
    { name: t('services') || 'Services', icon: Wrench, path: '/services' },
    { name: t('inspections') || 'Inspections', icon: ClipboardCheck, path: '/inspections' },
    { name: t('inventory') || 'Inventory', icon: Package, path: '/inventory' },
    { name: t('expenses') || 'Expenses', icon: Receipt, path: '/expenses' },
    { name: t('invoices') || 'Invoices', icon: FileText, path: '/invoices' },
    { name: t('Reports') || 'Reports', icon: PieChart, path: '/reports' },
    { name: t('settings') || 'Settings', icon: Settings, path: '/settings' },
  ];

  // SaaS Admin Menu (Only sees the Admin portal)
  const adminMenu = [
    { name: 'Admin Portal', icon: ShieldAlert, path: '/admin' }
  ];

  // Decide which menu to show
  const menuItems = isAdmin ? adminMenu : mechanicMenu;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  function toggleLanguage() {
    setLanguage(language === 'en' ? 'al' : 'en');
  }

  return (
    <>
      <div className="md:hidden print:hidden bg-gray-900 text-white flex justify-between items-center p-4 shadow-md w-full shrink-0 z-50 relative">
        <h1 className="text-xl font-black tracking-wider">GARAGE<span className="text-blue-500">DATA</span></h1>
        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-300 hover:text-white p-1">
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {isOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden print:hidden" onClick={() => setIsOpen(false)} />}

      <div className={`print:hidden fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 text-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden md:flex items-center justify-center h-20 border-b border-gray-800 shrink-0">
          <h1 className="text-2xl font-black tracking-wider">GARAGE<span className="text-blue-500">DATA</span></h1>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto mt-2 md:mt-0">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors font-semibold ${
                  isActive ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>
        {/* NETWORK STATUS INDICATOR */}
       <div className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm border ${!isOnline ? 'bg-red-900/30 border-red-800 text-red-400' : syncQueue.length > 0 ? 'bg-orange-900/30 border-orange-800 text-orange-400' : 'bg-gray-800 border-gray-700 text-green-400'}`}>
         {!isOnline ? (
           <><WifiOff size={18} /> Offline Mode Active</>
         ) : isSyncing ? (
           <><CloudLightning className="animate-pulse" size={18} /> Syncing Data...</>
         ) : syncQueue.length > 0 ? (
           <><CloudLightning size={18} /> {syncQueue.length} items pending sync</>
         ) : (
           <><Wifi size={18} /> Online & Synced</>
         )}
       </div>

        <div className="p-4 border-t border-gray-800 shrink-0 flex flex-col gap-2">
          {!isAdmin && (
            <button onClick={toggleLanguage} className="flex items-center gap-3 w-full px-4 py-3 text-blue-400 hover:bg-gray-800 hover:text-blue-300 rounded-xl transition-colors font-semibold">
              <Globe size={20} /> {t('switch_lang') || 'Change Language'}
            </button>
          )}

          <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-gray-800 hover:text-red-300 rounded-xl transition-colors font-semibold">
            <LogOut size={20} /> {t('logout') || 'Logout'}
          </button>
        </div>
      </div>
    </>
  );
}