'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang] = useState('ar'); // Force Arabic as only language

  useEffect(() => {
    // Update HTML document attributes for RTL and language code
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    localStorage.setItem('language', 'ar');
  }, []);

  const toggleLanguage = () => {
    // Disabled language switching
  };

  const t = translations['ar'];

  return (
    <LanguageContext.Provider value={{ lang: 'ar', setLang: () => {}, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
