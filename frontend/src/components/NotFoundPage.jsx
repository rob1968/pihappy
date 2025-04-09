import React from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation

function NotFoundPage() {
  return (
    <div className="container mt-5 text-center">
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-body">
              <h1 className="display-1 text-danger">404</h1>
              <h2 className="card-title mb-4">Page Not Found</h2>
              <p className="card-text">
                Oops! The page you are looking for does not exist. It might have been moved or deleted.
              </p>
              <Link to="/" className="btn btn-primary mt-3">
                Go Back to Homepage
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;