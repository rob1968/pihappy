import React from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook

function InternalServerErrorPage({ errorInfo }) {
  const { t } = useTranslation(); // Get the translation function
  // You could pass specific error details via props if available
  return (
    <div className="container mt-5 text-center">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm border-danger">
            <div className="card-body">
              <h1 className="display-1 text-danger">500</h1>
              <h2 className="card-title mb-4">{t('serverError.title')}</h2>
              <p className="card-text">
                {t('serverError.message')}
              </p>
              {errorInfo && (
                <pre className="text-start text-muted small mt-3 p-2 bg-light border rounded">
                  <code>{t('serverError.detailsPrefix')}: {JSON.stringify(errorInfo, null, 2)}</code>
                </pre>
              )}
              {/* Optional: Add a button to try reloading or go home */}
              {/* <button onClick={() => window.location.reload()} className="btn btn-warning mt-3 me-2">Try Again</button> */}
              {/* <Link to="/" className="btn btn-primary mt-3">Go Home</Link> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InternalServerErrorPage;