import React from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook
import AuthForm from './AuthForm'; // Import the AuthForm component
import './MainPage.css'; // You might want to create a specific CSS file or reuse an existing one

function WelcomePage() {
  const { t } = useTranslation(); // Get the translation function
  return (
    <div className="container mt-4">
      <div className="card shadow-sm">
        <div className="card-body">
          <h1 className="card-title text-center mb-4">{t('welcome.title')}</h1>

          <p className="lead">
            {t('welcome.description')}
            {/* TODO: Add a more detailed description of the app's purpose and future goals */}
          </p>

          <section className="mt-4">
            <h2>{t('welcome.whatsNextTitle')}</h2>
            <p>
              {t('welcome.featuresIntro')}
            </p>
            <ul>
              <li>{t('welcome.featureProfiles')}</li>
              <li>{t('welcome.featureCommunity')}</li>
              <li>{t('welcome.featureShops')}</li>
              <li>{t('welcome.featureMaps')}</li>
              {/* TODO: Add more specific planned features */}
            </ul>
            <p>
              {t('welcome.stayTuned')}
            </p>
          </section>

          {/* You could add links to other parts of the app if needed */}
          {/* <div className="text-center mt-4">
            <Link to="/login" className="btn btn-primary me-2">Login</Link>
            <Link to="/register" className="btn btn-secondary">Register</Link>
          </div> */}
        </div>
      </div>

      {/* Embed the AuthForm component */}
      <div className="mt-5"> {/* Add some margin top */}
        <AuthForm />
      </div>
    </div>
  );
}

export default WelcomePage;