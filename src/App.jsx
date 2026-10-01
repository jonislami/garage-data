import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, authLinkType } from './lib/supabase';
import { isSuperAdminEmail } from './lib/admin';
import SetPassword from './components/SetPassword';
import AuthForm from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Onboarding from './pages/Onboarding';
import Cars from './pages/Cars'; 
import Services from './pages/Services';
import Invoice from './pages/Invoice';
import InvoicesList from './pages/InvoicesList';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Inspections from './pages/Inspections';
import InspectionReport from './pages/InspectionReport';
import { LanguageProvider, useLanguage } from './LanguageContext';
import Expenses from './pages/Expenses';
import SuperAdmin from './pages/SuperAdmin';
import { ShieldAlert, X } from 'lucide-react';
import Appointments from './pages/Appointments';
import { SyncProvider } from './contexts/SyncContext';
import { ToastProvider } from './components/ui';
import { formatDate } from './lib/format';
import Reports from './pages/Reports';
import Maintenance from './pages/Maintenance';
import VehicleQR from './pages/VehicleQR';

import LandingPage from './pages/LandingPage';


function MainApp() {
  const { language } = useLanguage();
  const isAl = language === 'al';

  const [session, setSession] = useState(null);
  const [hasWorkshop, setHasWorkshop] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [showAuth, setShowAuth] = useState(false);
  // Opened from an invitation / password-reset email: ask for a password first
  const [needsPassword, setNeedsPassword] = useState(authLinkType === 'invite' || authLinkType === 'recovery');

  const [trialEndDate, setTrialEndDate] = useState(null);
  const [showTrialBanner, setShowTrialBanner] = useState(true);

  // Which user we last checked; a token refresh for the same user must not re-check
  const checkedUserRef = useRef(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setNeedsPassword(true);
      setSession(session);
      if (session) {
        setShowAuth(false);
        if (checkedUserRef.current !== session.user.id) {
          checkedUserRef.current = session.user.id;
          // Show the loading screen (not the setup page) until we know whether they have a garage
          setHasWorkshop(null);
          setLoading(true);
          // Run outside the auth callback (calling Supabase inside it can stall the client)
          setTimeout(() => checkWorkshop(session.user), 0);
        }
      } else {
        checkedUserRef.current = null;
        setHasWorkshop(null);
        setIsAdmin(false);
        setIsSuspended(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkWorkshop(user) {
    if (isSuperAdminEmail(user.email)) {
      setIsAdmin(true);
      setHasWorkshop(true); 
      setIsSuspended(false);
      setLoading(false);
      return;
    }

    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Gabim tek profili:", profileError);
        throw profileError; // handled below: offline falls back to the saved garage
      }

      // --- ZGJIDHJA PËR LLOGARITË E FSHIRA ---
      // Nëse nuk ka profil fare, do të thotë që e ke fshirë nga databaza
      if (!profileData) {
        console.log("Llogaria është fshirë nga sistemi. Duke bërë Log Out...");
        await supabase.auth.signOut(); // Kjo e nxjerr jashtë dhe e çon te Login
        return;
      }
      // ----------------------------------------

      if (profileData.workshop_id) {
        localStorage.setItem('sonic_workshop_id', profileData.workshop_id);
        
        const { data: shopData } = await supabase
          .from('workshops')
          .select('is_active, trial_ends_at')
          .eq('id', profileData.workshop_id)
          .maybeSingle();

        if (shopData) {
          if (shopData.trial_ends_at) {
            setTrialEndDate(shopData.trial_ends_at);
          }

          if (shopData.is_active === false) {
            setIsSuspended(true);
          } 
          else if (shopData.trial_ends_at && new Date() > new Date(shopData.trial_ends_at)) {
            setIsSuspended(true);
          } 
          else {
            setIsSuspended(false);
          }
        }
        
        setHasWorkshop(true); 
      } else {
        setHasWorkshop(false);
        setIsSuspended(false);
      }
    } catch (err) {
      console.error("Gabim i përgjithshëm:", err);
      // No connection: keep working with the garage saved on this device instead of
      // sending an existing user to the setup page
      setHasWorkshop(localStorage.getItem('sonic_workshop_id') ? true : false);
    }
    
    setLoading(false);
  }
  
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gray-100">
      <div className="h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{isAl ? 'Duke u ngarkuar…' : 'Loading…'}</p>
    </div>
  );

  if (session && needsPassword) {
    return <SetPassword invited={authLinkType === 'invite'} onDone={() => {
      setNeedsPassword(false);
      window.history.replaceState(null, '', window.location.pathname);
    }} />;
  }

  if (!session) {
    if (showAuth) {
      return (
        <div className="relative min-h-screen bg-gray-50 flex flex-col justify-center">
          <button 
            onClick={() => setShowAuth(false)} 
            className="btn btn-secondary absolute top-6 left-6 z-50"
          >
            &larr; {isAl ? 'Kthehu mbrapa' : 'Go back'}
          </button>
          <AuthForm />
        </div>
      );
    }
    return <LandingPage onLoginClick={() => setShowAuth(true)} />;
  }

  if (isSuspended) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100 text-center p-6">
       <div className="h-14 w-14 mb-5 flex items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600"><ShieldAlert size={28} /></div>
       <h1 className="text-2xl font-semibold text-gray-900 mb-2">
         {isAl ? 'Llogaria është Pezulluar' : 'Account Suspended'}
       </h1>
       <p className="text-gray-600 mb-8 max-w-md">
         {isAl 
           ? 'Koha juaj e provës ka përfunduar ose llogaria juaj është pezulluar përkohësisht. Ju lutemi kontaktoni mbështetjen për të rifituar aksesin.' 
           : 'Your trial period has ended or your account has been temporarily paused. Please contact support to restore access.'}
       </p>
       <button onClick={() => supabase.auth.signOut()} className="btn btn-primary btn-lg">
         {isAl ? 'Dil nga llogaria' : 'Log Out'}
       </button>
    </div>
  );

  if (hasWorkshop === null) return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-gray-100">
      <div className="h-6 w-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{isAl ? 'Duke u ngarkuar…' : 'Loading…'}</p>
    </div>
  );

  if (hasWorkshop === false) return <Onboarding onComplete={() => setHasWorkshop(true)} />;

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      
      {showTrialBanner && trialEndDate && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 flex justify-between items-center text-[13px] z-50 shrink-0 print:hidden">
          <div className="w-6"></div>
          
          <div className="flex-1 text-center">
            {isAl 
              ? `Llogaria juaj e provës skadon më ${formatDate(trialEndDate)}. Na kontaktoni për të aktivizuar abonimin.` 
              : `Your trial expires on ${formatDate(trialEndDate)}. Contact us to activate your subscription.`}
          </div>
          
          <button 
            onClick={() => setShowTrialBanner(false)} 
            className="p-1 rounded hover:bg-amber-100 transition-colors"
            title={isAl ? "Mbyll" : "Close"}
          >
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto w-full">
          <Routes>
            <Route path="/" element={isAdmin ? <Navigate to="/admin" replace /> : <Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/cars" element={<Cars />} />
            <Route path="/services" element={<Services />} />
            <Route path="/invoices/:id" element={<Invoice />} />
            <Route path="/invoices" element={<InvoicesList />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/inspections" element={<Inspections />} />
            <Route path="/inspections/:id" element={<InspectionReport />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/maintenance" element={<Maintenance />} />
            
            <Route path="/admin" element={<SuperAdmin />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
          <SyncProvider>
            <Routes>
              {/* Public page behind the permanent vehicle QR sticker (no login) */}
              <Route path="/v/:token" element={<VehicleQR />} />
              <Route path="/*" element={<MainApp />} />
            </Routes>
          </SyncProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}