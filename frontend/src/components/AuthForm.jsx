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
  const [gekozenTaal, setGekozenTaal] = useState(""); // Register only - Preferred Language

  const navigate = useNavigate();
  // Removed autocompleteRef and useJsApiLoader hook

  // Fetch landen (only needed for Register)
  useEffect(() => {
    if (!isLoginMode) {
      fetch("/api/landen")
        .then((res) => res.json())
        .then((data) => {
            console.log("Received countries data:", data); // Log received data
            setLanden(data.landen || []); // Update state
        })
        .catch((err) => {
            console.error("Error fetching countries:", err); // Log error
            setLanden([]); // Set to empty array on error
        });
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
          alert(`Login Error: ${result.message}`);
        }
      } catch (error) {
        console.error("Error during login:", error);
        alert("An error occurred during login. Please try again later.");
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
        language: gekozenTaal, // Add chosen language
        // Removed shop-related fields from registration data
        browser_lang: browserLang.split('-')[0], // Send primary language code (e.g., 'en' from 'en-US')
        timestamp: new Date().toISOString(),
      };

      if (!name || !email || !password || !gekozenLand || !gekozenTaal) { // Add language validation
          alert("Please fill in all required fields (Name, Email, Password, Country, Language).");
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
            alert("Registration successful! You can now log in.");
            // Switch to login mode after successful registration
            setIsLoginMode(true);
            // Clear registration-specific fields (optional)
            setName("");
            setPassword(""); // Clear password for login
            setGekozenLand("");
            setGekozenTaal(""); // Clear language on success
            // Removed clearing of shop state
          } else {
             alert(`Registration Error: ${result.message}`);
          }
        })
        .catch((err) => {
          console.error("Error submitting registration:", err);
          alert("An error occurred during registration. Please try again later.");
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
    setGekozenTaal(""); // Clear language on mode toggle
    // Removed clearing of shop state
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="card shadow-lg">
          <div className="card-body">
            <h2 className="text-center">🔐 {isLoginMode ? "Login" : "Register"}</h2>
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
                  🔑 Password <span className="text-danger">*</span>
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
                  title={isLoginMode ? undefined : "At least 6 characters"}
                />
              </div>

              {/* --- Fields for Register Mode Only --- */}
              {!isLoginMode && (
                <>
                  <div className="mb-3">
                    <label htmlFor="naam" className="form-label">
                      👤 Name <span className="text-danger">*</span>
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
                      🌍 Choose your country <span className="text-danger">*</span>
                    </label>
                    <select
                      id="land"
                      name="land"
                      className="form-select"
                      value={gekozenLand}
                      onChange={(e) => setGekozenLand(e.target.value)}
                      required
                    >
                      <option value="" disabled>🌐 Select a country...</option>
                      {landen.map((land) => (
                        <option key={land.code} value={land.code.toLowerCase()}>
                          {land.naam}
                        </option>
                      ))}
                      <option value="other">🌎 Other</option>
                    </select>
                  </div>

                  {/* --- Preferred Language Dropdown --- */}
                  <div className="mb-3">
                    <label htmlFor="language" className="form-label">
                      🗣️ Preferred Language <span className="text-danger">*</span>
                    </label>
                    <select
                      id="language"
                      name="language"
                      className="form-select"
                      value={gekozenTaal}
                      onChange={(e) => setGekozenTaal(e.target.value)}
                      required
                    >
                      <option value="" disabled>🌐 Select a language...</option>
                      {/* Reuse language map from ProfilePage or define here */}
                      {Object.entries({
                        "en": "English", "nl": "Dutch", "es": "Spanish", "de": "German",
                        "fr": "French", "zh": "Chinese", "hi": "Hindi", "id": "Indonesian",
                        "ur": "Urdu", "pt": "Portuguese", "bn": "Bengali", "ru": "Russian",
                        "ja": "Japanese", "tl": "Tagalog", "vi": "Vietnamese", "am": "Amharic",
                        "ar": "Arabic", "fa": "Persian", "tr": "Turkish", "ko": "Korean",
                        "th": "Thai",
                      }).map(([code, name]) => (
                        <option key={code} value={code}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Removed "Heb je een winkel?" dropdown and conditional shop details form */}
                </>
              )}

              {/* --- Submit Button --- */}
              <button type="submit" className="btn btn-primary w-100 mt-3">
                ✅ {isLoginMode ? "Login" : "Register"}
              </button>
            </form>

            {/* --- Toggle Link --- */}
            <p className="text-center mt-3">
              {isLoginMode ? "Don't have an account yet?" : "Already have an account?"}{" "}
              <button type="button" className="btn btn-link p-0" onClick={toggleMode}>
                {isLoginMode ? "Register" : "Login"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;