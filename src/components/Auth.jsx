import { supabase } from '../lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useLanguage } from '../LanguageContext'

export default function AuthForm() {
  const { language } = useLanguage();
  const isAl = language === 'al';

  // Ky funksion e detyron faqen të shkojë te "Kontakt" dhe ta mbyllë formën e logimit
  const handleContactClick = (e) => {
    e.preventDefault();
    window.location.href = '/#contact';
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 relative overflow-hidden w-full">
      
      {/* Background Decor (Për ta bërë të duket i bukur) */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-green-400 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 pointer-events-none"></div>

      <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-gray-100 relative z-10">
        <h2 className="mb-2 text-3xl font-black text-center text-gray-900">
          GarageData
        </h2>
        <p className="mb-8 text-center text-gray-500 font-medium">
          {isAl ? 'Kyçu për të menaxhuar ofiçinën tënde' : 'Sign in to manage your workshop'}
        </p>
        
        {/* Supabase Auth Component me Përkthim (Localization) */}
        <Auth
          supabaseClient={supabase}
          appearance={{ 
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#2563eb', // Blue-600
                  brandAccent: '#1d4ed8', // Blue-700
                }
              }
            }
          }}
          localization={{
            variables: {
              sign_in: {
                email_label: isAl ? 'Email Adresa' : 'Email Address',
                password_label: isAl ? 'Fjalëkalimi' : 'Password',
                email_input_placeholder: isAl ? 'emri@garazhi.com' : 'Your email address',
                password_input_placeholder: isAl ? 'Fjalëkalimi juaj' : 'Your password',
                button_label: isAl ? 'Kyçu në Aplikacion' : 'Sign In',
                loading_button_label: isAl ? 'Duke u kyçur...' : 'Signing in...',
              }
            }
          }}
          providers={[]} 
          theme="light"
          view="sign_in"        
          showLinks={false}     // Fsheh butonin "Sign Up"
        />

        {/* Pjesa ku ftojmë klientët të na kontaktojnë */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <p className="text-gray-500 text-sm mb-3">
            {isAl ? 'Nuk keni ende llogari për ofiçinën tuaj?' : 'Don\'t have an account for your workshop yet?'}
          </p>
          <button 
            onClick={handleContactClick} 
            className="inline-block w-full text-blue-600 font-bold hover:text-blue-800 transition-colors bg-blue-50 hover:bg-blue-100 px-5 py-3 rounded-xl"
          >
            {isAl ? 'Kontaktoni për të marrë akses' : 'Contact us to get access'}
          </button>
        </div>
      </div>
    </div>
  )
}