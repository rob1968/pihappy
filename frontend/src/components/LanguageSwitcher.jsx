import React from 'react';
import { useTranslation } from 'react-i18next';

// Define the languages you support
// Using native names where easily available, otherwise English names
const languages = [
  { code: 'en', name: 'English' },
  { code: 'nl', name: 'Nederlands' }, // Dutch
  { code: 'de', name: 'Deutsch' }, // German
  { code: 'zh', name: '中文' }, // Chinese
  { code: 'hi', name: 'हिन्दी' }, // Hindi
  { code: 'es', name: 'Español' }, // Spanish
  { code: 'fr', name: 'Français' }, // French
  { code: 'ar', name: 'العربية' }, // Arabic
  { code: 'bn', name: 'বাংলা' }, // Bengali
  { code: 'ru', name: 'Русский' }, // Russian
  { code: 'pt', name: 'Português' }, // Portuguese
  { code: 'ur', name: 'اردو' }, // Urdu
  { code: 'id', name: 'Bahasa Indonesia' }, // Indonesian
  { code: 'ja', name: '日本語' }, // Japanese
  { code: 'sw', name: 'Kiswahili' }, // Swahili
  { code: 'pa', name: 'ਪੰਜਾਬੀ' }, // Punjabi
];

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation(); // Get the t function

  const handleLanguageChange = (event) => {
    const langCode = event.target.value;
    i18n.changeLanguage(langCode);
  };

  // Get the current language code (could be 'en-US', so split and take the first part)
  const currentLanguageCode = i18n.language.split('-')[0];

  return (
    <div style={{ display: 'inline-block', marginLeft: '20px' }}>
      <label htmlFor="language-select" style={{ marginRight: '5px', fontSize: '0.9em' }}>{t('languageSwitcher.label')}:</label>
      <select
        id="language-select"
        value={currentLanguageCode}
        onChange={handleLanguageChange}
        style={{ fontSize: '0.9em', padding: '2px 5px' }}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher;