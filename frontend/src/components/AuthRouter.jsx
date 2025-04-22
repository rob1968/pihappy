import React from 'react';
import AuthForm from './AuthForm';
import PiAuth from './PiAuth';

function AuthRouter() {
  const userAgent = navigator.userAgent;
  // Log the full user agent string for detailed inspection
  console.log("[AuthRouter] User Agent:", userAgent);

  const isPiBrowser = userAgent.includes("PiBrowser"); // Basic check for Pi Browser
  // Log the result of the check
  console.log("[AuthRouter] Detected Pi Browser:", isPiBrowser);

  if (isPiBrowser) {
    // If accessed from Pi Browser, use the PiAuth component
    console.log("[AuthRouter] Rendering PiAuth component.");
    return <PiAuth />;
  } else {
    // Otherwise, use the standard AuthForm
    console.log("[AuthRouter] Rendering AuthForm component.");
    return <AuthForm />;
  }
}

export default AuthRouter;