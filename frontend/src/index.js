import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n'; // Import i18next configuration

// Initialize Pi Network SDK
// IMPORTANT: Replace with your actual Sandbox App Identifier from the Pi Developer Portal
// Use { sandbox: false } for mainnet deployment
window.Pi.init({ version: "2.0", sandbox: true });


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Suspense fallback="Loading...">
    {/* // <React.StrictMode> Temporarily removed for debugging map loading */}
      <App />
    {/* // </React.StrictMode> */}
  </Suspense>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
