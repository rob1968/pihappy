import React from 'react';
import AuthForm from './AuthForm';
import PiAuth from './PiAuth';

function AuthRouter() {
  const userAgent = navigator.userAgent;
  const isPiBrowser = userAgent.includes("PiBrowser"); // Basic check for Pi Browser

  // Log the user agent for debugging purposes
  console.log("User Agent:", userAgent);
  console.log("Is Pi Browser:", isPiBrowser);

  if (isPiBrowser) {
    // If accessed from Pi Browser, use the PiAuth component
    return <PiAuth />;
  } else {
    // Otherwise, use the standard AuthForm
    return <AuthForm />;
  }
}

export default AuthRouter;