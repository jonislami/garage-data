import { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  // Check if they already picked a language before, otherwise default to English
  const savedLang = localStorage.getItem('app_lang') || 'en';
  const [language, setLanguage] = useState(savedLang);

  // When language changes, save it to the browser memory
  useEffect(() => {
    localStorage.setItem('app_lang', language);
  }, [language]);

  // The 't' function translates the key based on the current language
  const t = (key) => {
    return translations[language][key] || key; // Falls back to the key if word is missing
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}