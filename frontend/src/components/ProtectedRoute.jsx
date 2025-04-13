import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
    const { t } = useTranslation(); // Get the translation function
    const [isAuthenticated, setIsAuthenticated] = useState(null); // null = loading, true = authenticated, false = not authenticated
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Use an endpoint that requires authentication.
                // The '/' route already returns 401 if not logged in.
                const response = await fetch('/', {
                    credentials: 'include',
                    headers: {
                        // Indicate we prefer JSON, though the check is mainly status code based
                        'Accept': 'application/json'
                    }
                 });

                if (response.ok) {
                    // User is logged in (received 2xx status)
                    setIsAuthenticated(true);
                } else if (response.status === 401) {
                    // User is not logged in
                    setIsAuthenticated(false);
                } else {
                    // Handle other potential errors (e.g., 500) - treat as not authenticated for safety
                    console.error("Auth check failed with status:", response.status);
                    setIsAuthenticated(false);
                }
            } catch (error) {
                console.error("Error during authentication check:", error);
                setIsAuthenticated(false); // Treat network errors as not authenticated
            }
        };

        checkAuth();
    }, []); // Run only once on component mount

    if (isAuthenticated === null) {
        // Show a loading indicator while checking authentication
        // You can replace this with a proper spinner component later
        return <div>{t('protectedRoute.loading')}</div>;
    }

    if (!isAuthenticated) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to in case you want to redirect them back after login.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If authenticated, render the child component (the protected page)
    return children;
};

export default ProtectedRoute;