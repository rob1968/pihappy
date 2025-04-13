import React from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './LanguageSwitcher'; // Import the switcher
import { Link } from 'react-router-dom';

const MainMenu = () => {
  const { t } = useTranslation(); // Get the translation function
  return (
    <nav style={{ marginBottom: '20px', textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
      <Link to="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>{t('mainMenu.homeMood')}</Link>
      <Link to="/community" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>{t('mainMenu.community')}</Link>
      <Link to="/pilocations" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>{t('mainMenu.map')}</Link>
      <Link to="/profile" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>{t('mainMenu.profile')}</Link>
      {/* Add other links consistently here if needed in the future */}
      <LanguageSwitcher /> {/* Add the switcher component */}
    </nav>
  );
};

export default MainMenu;