import { supabase } from '../lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useState } from 'react'
import { useLanguage } from '../LanguageContext'

export default function AuthForm() {
  const { language } = useLanguage();
  const isAl = language === 'al';
  const [view, setView] = useState('sign_in');

  // Ky funksion e detyron faqen të shkojë te "Kontakt" dhe ta mbyllë formën e logimit
  const handleContactClick = (e) => {
    e.preventDefault();
    window.location.href = '/#contact';
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 px-4 w-full">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <img src="/applogo.png" alt="" className="h-9 w-9 object-contain" />
          <span className="text-xl font-semibold tracking-tight text-gray-900">Garage<span className="text-blue-600">Data</span></span>
        </div>
      <div className="w-full p-6 sm:p-8 bg-white rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">{isAl ? 'Kyçu' : 'Sign in'}</h2>
        <p className="mb-5 text-sm text-gray-500">
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
                  brand: '#2c5698',
                  brandAccent: '#25467b',
                  inputBorder: '#cdd3db',
                  inputBorderFocus: '#3d6db4',
                  inputBorderHover: '#98a2b0',
                },
                radii: {
                  borderRadiusButton: '5px',
                  buttonBorderRadius: '5px',
                  inputBorderRadius: '5px',
                },
                fonts: {
                  bodyFontFamily: 'Inter, system-ui, sans-serif',
                  buttonFontFamily: 'Inter, system-ui, sans-serif',
                  inputFontFamily: 'Inter, system-ui, sans-serif',
                  labelFontFamily: 'Inter, system-ui, sans-serif',
                },
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
              },
              forgotten_password: {
                email_label: isAl ? 'Email Adresa' : 'Email Address',
                email_input_placeholder: isAl ? 'emri@garazhi.com' : 'Your email address',
                button_label: isAl ? 'Dërgo linkun për fjalëkalim të ri' : 'Send reset link',
                loading_button_label: isAl ? 'Duke dërguar...' : 'Sending...',
                confirmation_text: isAl ? 'Kontrolloni email-in për linkun e fjalëkalimit të ri.' : 'Check your email for the reset link.',
              }
            }
          }}
          providers={[]} 
          theme="light"
          view={view}
          redirectTo={window.location.origin}
          showLinks={false}     // Fsheh butonin "Sign Up"
        />

        <button type="button" onClick={() => setView(view === 'sign_in' ? 'forgotten_password' : 'sign_in')}
          className="mt-1 text-sm text-blue-700 hover:underline">
          {view === 'sign_in'
            ? (isAl ? 'Keni harruar fjalëkalimin?' : 'Forgot your password?')
            : (isAl ? '← Kthehu te kyçja' : '← Back to sign in')}
        </button>

        {/* Pjesa ku ftojmë klientët të na kontaktojnë */}
        <div className="mt-6 pt-5 border-t border-gray-200 text-center">
          <p className="text-gray-500 text-sm mb-3">
            {isAl ? 'Nuk keni ende llogari për ofiçinën tuaj?' : 'Don\'t have an account for your workshop yet?'}
          </p>
          <button 
            onClick={handleContactClick} 
            className="btn btn-secondary w-full"
          >
            {isAl ? 'Kontaktoni për të marrë akses' : 'Contact us to get access'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}