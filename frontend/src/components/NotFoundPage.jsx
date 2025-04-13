import React from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook
import { Link } from 'react-router-dom'; // Import Link for navigation

function NotFoundPage() {
  const { t } = useTranslation(); // Get the translation function
  return (
    <div className="container mt-5 text-center">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <h1 className="display-1 text-danger">404</h1>
              <h2 className="card-title mb-4">{t('notFound.title')}</h2>
              <p className="card-text">
                {t('notFound.message')}
              </p>
              <Link to="/" className="btn btn-primary mt-3">
                {t('notFound.goHomeButton')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;