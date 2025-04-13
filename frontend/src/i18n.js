import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

// Define the supported languages based on your request
const supportedLngs = ['en', 'nl', 'de', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'ru', 'pt', 'ur', 'id', 'ja', 'sw', 'pa']; // All languages restored

i18n
  // Load translation using http -> see /public/locales
  // learn more: https://github.com/i18next/i18next-http-backend
  .use(HttpApi)
  // Detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // Pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // Init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    supportedLngs: supportedLngs,
    fallbackLng: 'en', // Use English as fallback
    debug: process.env.NODE_ENV === 'development', // Enable debug output in development
    detection: {
      // Order and from where user language should be detected
      order: ['querystring', 'cookie', 'localStorage', 'sessionStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
      caches: ['cookie', 'localStorage'], // Cache the language preference
    },
    backend: {
      // Path where resources get loaded from
      loadPath: '/locales/{{lng}}/translation.json',
    },
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
    react: {
      useSuspense: true, // Use Suspense for loading translations
    }
  });

export default i18n;