import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SUPER_ADMIN_EMAIL } from '../lib/admin';
import {
  LayoutDashboard, Users, Car, FileText, LogOut, Wrench, Package, Settings,
  ClipboardCheck, Menu, X, Languages, Receipt, ShieldAlert, CalendarDays,
  Wifi, WifiOff, RefreshCw, BarChart3, QrCode,
} from 'lucide-react';
import { useLanguage } from '../LanguageContext';
import { useSync } from '../contexts/SyncContext';


function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/applogo.png" alt="" className="h-7 w-7 rounded object-contain bg-white/5" />
      <span className="text-[15px] font-semibold tracking-tight text-white">
        Garage<span className="text-blue-300">Data</span>
      </span>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const { t, language, setLanguage } = useLanguage();
  const { isOnline, syncQueue, isSyncing } = useSync();
  const al = language === 'al';

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email || '');
      if (user && user.email === SUPER_ADMIN_EMAIL) setIsAdmin(true);
    });
  }, []);

  const mechanicMenu = [
    { items: [
      { name: t('dashboard'), icon: LayoutDashboard, path: '/' },
    ] },
    { label: t('nav_workshop'), items: [
      { name: t('appointments'), icon: CalendarDays, path: '/appointments' },
      { name: t('services'), icon: Wrench, path: '/services' },
      { name: t('maintenance'), icon: QrCode, path: '/maintenance' },
      { name: t('inspections'), icon: ClipboardCheck, path: '/inspections' },
      { name: t('inventory'), icon: Package, path: '/inventory' },
    ] },
    { label: t('nav_customers'), items: [
      { name: t('clients'), icon: Users, path: '/clients' },
      { name: t('cars'), icon: Car, path: '/cars' },
    ] },
    { label: t('nav_finance'), items: [
      { name: t('invoices'), icon: FileText, path: '/invoices' },
      { name: t('expenses'), icon: Receipt, path: '/expenses' },
      { name: t('reports'), icon: BarChart3, path: '/reports' },
    ] },
    { label: t('nav_system'), items: [
      { name: t('settings'), icon: Settings, path: '/settings' },
    ] },
  ];

  const adminMenu = [
    { items: [{ name: 'Admin Portal', icon: ShieldAlert, path: '/admin' }] },
  ];

  const groups = isAdmin ? adminMenu : mechanicMenu;

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/');
  }

  let status;
  if (!isOnline) {
    status = { icon: WifiOff, text: al ? 'Offline' : 'Offline', cls: 'text-red-300', dot: 'bg-red-400' };
  } else if (isSyncing) {
    status = { icon: RefreshCw, text: al ? 'Duke sinkronizuar…' : 'Syncing…', cls: 'text-amber-300', dot: 'bg-amber-400', spin: true };
  } else if (syncQueue.length > 0) {
    status = { icon: RefreshCw, text: al ? `${syncQueue.length} në pritje` : `${syncQueue.length} pending sync`, cls: 'text-amber-300', dot: 'bg-amber-400' };
  } else {
    status = { icon: Wifi, text: al ? 'Online · sinkronizuar' : 'Online · synced', cls: 'text-gray-400', dot: 'bg-emerald-400' };
  }

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden print:hidden bg-gray-900 text-white flex justify-between items-center h-14 px-4 border-b border-gray-800 w-full shrink-0 z-50 relative">
        <Logo />
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 -mr-2 rounded text-gray-300 hover:text-white hover:bg-white/5" aria-label="Menu">
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden print:hidden" onClick={() => setIsOpen(false)} />}

      <aside className={`print:hidden fixed inset-y-0 left-0 z-50 w-60 bg-gray-900 text-gray-300 flex flex-col border-r border-gray-800 transition-transform duration-200 md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="hidden md:flex items-center h-14 px-4 border-b border-gray-800 shrink-0">
          <Logo />
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          {groups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-4' : ''}>
              {group.label && (
                <p className="px-2.5 mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-gray-500">{group.label}</p>
              )}
              <div className="space-y-px">
                {group.items.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setIsOpen(false)}
                    className={({ isActive }) =>
                      `relative flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13.5px] transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white font-medium before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-blue-400 before:rounded-sm'
                          : 'text-gray-400 hover:bg-white/5 hover:text-gray-100'
                      }`
                    }
                  >
                    <item.icon size={16} strokeWidth={1.75} />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-800 px-2.5 py-3 shrink-0 space-y-px">
          <div className={`flex items-center gap-2 h-7 px-2.5 text-xs ${status.cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
            <status.icon size={13} className={status.spin ? 'animate-spin' : ''} />
            {status.text}
          </div>

          {!isAdmin && (
            <button onClick={() => setLanguage(al ? 'en' : 'al')} className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13.5px] text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-colors">
              <Languages size={16} strokeWidth={1.75} /> {t('switch_lang')}
            </button>
          )}
          <button onClick={handleLogout} className="w-full flex items-center gap-2.5 h-8 px-2.5 rounded-md text-[13.5px] text-gray-400 hover:bg-white/5 hover:text-gray-100 transition-colors">
            <LogOut size={16} strokeWidth={1.75} /> {t('logout')}
          </button>

          {email && <p className="px-2.5 pt-2 text-[11px] text-gray-500 truncate" title={email}>{email}</p>}
        </div>
      </aside>
    </>
  );
}
