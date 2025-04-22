import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate

function PiAuth() {
  const [status, setStatus] = useState('Initializing Pi Authentication...');
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Hook for navigation

  useEffect(() => {
    // Ensure Pi SDK is loaded before attempting to use it
    if (typeof window.Pi === 'undefined') {
      setError('Pi SDK not loaded. Please ensure you are in the Pi Browser.');
      setStatus('Error');
      return;
    }

    setStatus('Authenticating with Pi Network...');

    const scopes = ['payments', 'username']; // Request username scope as well
    // const scopes = ['payments']; // Define the required scopes

    // Callback for incomplete payments (using fetch instead of $.post)
    function onIncompletePaymentFound(payment) {
      console.log('Incomplete payment found:', payment);
      setStatus('Handling incomplete payment...');
      const paymentId = payment.identifier;
      const txid = payment.transaction.txid;

      fetch('/api/payment/complete', { // Use /api prefix consistent with other routes
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add any necessary auth headers if your backend requires them for this endpoint
        },
        body: JSON.stringify({
          paymentId: paymentId,
          txid: txid,
          // debug: 'cancel' // Decide if you need this parameter
        }),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
       })
      .then(data => {
        console.log('Incomplete payment processed:', data);
        // Handle response - maybe navigate or update status
        setStatus('Incomplete payment handled.');
      })
      .catch(err => {
        console.error('Error processing incomplete payment:', err);
        setError(`Failed to process incomplete payment: ${err.message}`);
        setStatus('Error');
      });
    };

    // Authenticate the user
    window.Pi.authenticate(scopes, onIncompletePaymentFound)
      .then(auth => {
        console.log('Pi Authentication successful:', auth);
        setStatus('Authentication successful! Verifying with server...');

        // Send the auth object (auth.accessToken, auth.user) to your backend
        fetch('/api/pi_auth_verify', { // New backend endpoint
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(auth), // Send the whole auth object
        })
        .then(response => {
           if (!response.ok) {
             // Attempt to read error message from backend if available
             return response.json().then(errData => {
               throw new Error(errData.message || `Server error: ${response.status}`);
             }).catch(() => {
               // Fallback if response is not JSON or reading fails
               throw new Error(`Server error: ${response.status}`);
             });
           }
           return response.json();
         })
        .then(data => {
          if (data.status === 'success') {
            console.log('Backend verification successful:', data);
            setStatus('Verification successful! Redirecting...');
            // Backend should have set the session cookie
            navigate('/'); // Redirect to home page after successful backend verification
          } else {
            throw new Error(data.message || 'Backend verification failed.');
          }
        })
        .catch(err => {
          console.error('Backend verification failed:', err);
          setError(`Backend verification failed: ${err.message}`);
          setStatus('Error');
        });
      })
      .catch(err => {
        console.error('Pi Authentication failed:', err);
        // Handle specific Pi Network error codes if needed
        setError(`Pi Authentication failed: ${err.message || err}`);
        setStatus('Error');
      });

  }, [navigate]); // Add navigate to dependency array

  return (
    <div>
      <h2>Pi Network Authentication</h2>
      <p>Status: {status}</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {status.startsWith('Authenticating') || status.startsWith('Handling') || status.startsWith('Verification') ? (
        <p>Please follow the prompts in the Pi Browser window...</p>
        // You might show a loading indicator here
      ) : null}
    </div>
  );
}

export default PiAuth;