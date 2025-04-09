import React, { useState, useEffect } from 'react';
import MainPage from './MainPage';
import WelcomePage from './WelcomePage';

function HomePageWrapper() {
  const [isLoggedIn, setIsLoggedIn] = useState(null); // null: checking, true: logged in, false: not logged in
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthStatus = async () => {
      setIsLoading(true);
      try {
        // Use the /api/profile endpoint. It returns 200 if logged in, 401 if not.
        const response = await fetch('/api/profile');
        if (response.ok) { // Status 200-299
          setIsLoggedIn(true);
        } else if (response.status === 401) { // Unauthorized
          setIsLoggedIn(false);
        } else {
          // Handle other potential errors (e.g., 500 server error)
          console.error("Error checking auth status:", response.statusText);
          setIsLoggedIn(false); // Default to not logged in on unexpected errors
        }
      } catch (error) {
        console.error("Network error checking auth status:", error);
        setIsLoggedIn(false); // Default to not logged in on network errors
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthStatus();
  }, []); // Empty dependency array means this runs once on mount

  if (isLoading) {
    // Optional: Add a more sophisticated loading spinner/component
    return <div className="container mt-4 text-center"><p>Loading...</p></div>;
  }

  return isLoggedIn ? <MainPage /> : <WelcomePage />;
}

export default HomePageWrapper;