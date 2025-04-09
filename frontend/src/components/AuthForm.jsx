import React, { useState, useEffect } from "react"; // Removed useRef, useCallback
import { useNavigate } from "react-router-dom";
// Removed useJsApiLoader, Autocomplete
import './MainPage.css'; // Import the shared CSS file

// Removed libraries constant

const AuthForm = () => {
  const [isLoginMode, setIsLoginMode] = useState(true); // Start in Login mode

  // Combined State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // Register only
  const [landen, setLanden] = useState([]); // Register only
  // Removed heeftWinkel, winkelnaam, locatie state
  const [gekozenLand, setGekozenLand] = useState(""); // Register only

  const navigate = useNavigate();
  // Removed autocompleteRef and useJsApiLoader hook

  // Fetch landen (only needed for Register)
  useEffect(() => {
    if (!isLoginMode) {
      fetch("/api/landen")
        .then((res) => res.json())
        .then((data) => setLanden(data.landen || []))
        .catch((err) => console.error("Fout bij ophalen landen:", err));
    }
  }, [isLoginMode]); // Re-fetch if mode changes (though unlikely needed)

  // Removed onPlaceChanged and handleWinkelChange handlers

  // Combined Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isLoginMode) {
      // --- Login Logic ---
      const loginData = { email, password };
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(loginData),
        });
        const result = await response.json();
        if (response.ok) {
          // Instead of client-side navigation, force a full page load to '/'
          // This ensures the HomePageWrapper re-evaluates auth status with the new cookie.
          window.location.href = '/';
        } else {
          alert(`Fout bij inloggen: ${result.message}`);
        }
      } catch (error) {
        console.error("Error during login:", error);
        alert("Er is een fout opgetreden bij het inloggen. Probeer het later opnieuw.");
      }
    } else {
      // --- Register Logic ---
      // Use state variables directly instead of FormData
      const browserLang = navigator.language || navigator.userLanguage; // Get browser language
      const registerData = {
        naam: name,
        email,
        wachtwoord: password,
        land: gekozenLand,
        // Removed shop-related fields from registration data
        browser_lang: browserLang.split('-')[0], // Send primary language code (e.g., 'en' from 'en-US')
        timestamp: new Date().toISOString(),
      };

      // Removed shop-related validation
      if (!name || !email || !password || !gekozenLand) {
          alert("Vul a.u.b. alle verplichte velden in.");
          return;
      }


      fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.status === "success") {
            alert("Registratie succesvol! U kunt nu inloggen.");
            // Switch to login mode after successful registration
            setIsLoginMode(true);
            // Clear registration-specific fields (optional)
            setName("");
            setPassword(""); // Clear password for login
            setGekozenLand("");
            // Removed clearing of shop state
          } else {
             alert(`Fout bij registreren: ${result.message}`);
          }
        })
        .catch((err) => {
          console.error("Error submitting registration:", err);
          alert("Er is een fout opgetreden bij het registreren. Probeer het later opnieuw.");
        });
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    // Clear fields when switching modes
    setEmail("");
    setPassword("");
    setName("");
    setGekozenLand("");
    // Removed clearing of shop state
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="card shadow-lg">
          <div className="card-body">
            <h2 className="text-center">🔐 {isLoginMode ? "Login" : "Registreren"}</h2>
            <form onSubmit={handleSubmit}>
              {/* --- Fields for Both Modes --- */}
              <div className="mb-3">
                <label htmlFor="email" className="form-label">
                  📧 E-mail <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={isLoginMode} // Autofocus email in login mode
                />
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label">
                  🔑 Wachtwoord <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name={isLoginMode ? "password" : "wachtwoord"} // Name differs slightly
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={isLoginMode ? undefined : 6} // Min length only for register
                  pattern={isLoginMode ? undefined : ".{6,}"}
                  title={isLoginMode ? undefined : "Minstens 6 tekens"}
                />
              </div>

              {/* --- Fields for Register Mode Only --- */}
              {!isLoginMode && (
                <>
                  <div className="mb-3">
                    <label htmlFor="naam" className="form-label">
                      👤 Naam <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      id="naam"
                      name="naam"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus // Autofocus name in register mode
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="land" className="form-label">
                      🌍 Kies je land <span className="text-danger">*</span>
                    </label>
                    <select
                      id="land"
                      name="land"
                      className="form-select"
                      value={gekozenLand}
                      onChange={(e) => setGekozenLand(e.target.value)}
                      required
                    >
                      <option value="" disabled>🌐 Selecteer een land...</option>
                      {landen.map((land) => (
                        <option key={land.code} value={land.code.toLowerCase()}>
                          {land.naam}
                        </option>
                      ))}
                      <option value="other">🌎 Ander</option>
                    </select>
                  </div>

                  {/* Removed "Heb je een winkel?" dropdown and conditional shop details form */}
                </>
              )}

              {/* --- Submit Button --- */}
              <button type="submit" className="btn btn-primary w-100 mt-3">
                ✅ {isLoginMode ? "Inloggen" : "Registreren"}
              </button>
            </form>

            {/* --- Toggle Link --- */}
            <p className="text-center mt-3">
              {isLoginMode ? "Heb je nog geen account?" : "Heb je al een account?"}{" "}
              <button type="button" className="btn btn-link p-0" onClick={toggleMode}>
                {isLoginMode ? "Registreren" : "Inloggen"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;