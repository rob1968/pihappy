import React, { useState } from "react";
// Removed useRef, useCallback, useJsApiLoader, Autocomplete imports

const Register = () => {
  const [landen, setLanden] = useState([]);
  // Removed heeftWinkel, winkelnaam, locatie state
  const [gekozenLand, setGekozenLand] = useState("");

  // Removed autocompleteRef and useJsApiLoader hook

  // Removed onPlaceChanged callback
  React.useEffect(() => {
    fetch("/api/landen")
      .then((res) => res.json())
      .then((data) => setLanden(data.landen || []))
      .catch((err) => console.error("Error fetching countries:", err));
  }, []);

  // Removed handleWinkelChange handler
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    data.timestamp = new Date().toISOString();

    fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then((result) => {
        alert(result.status === "success" ? "Registration successful!" : `Error: ${result.message}`);
      })
      .catch((err) => {
        console.error("Error submitting form:", err);
        alert("An error occurred. Please try again later.");
      });
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="card shadow-lg">
          <div className="card-body">
            <h2 className="text-center">🔐 PiHappy</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label htmlFor="naam" className="form-label">👤 Name *</label>
                <input type="text" id="naam" name="naam" className="form-control" required autoFocus />
              </div>

              <div className="mb-3">
                <label htmlFor="email" className="form-label">📧 E-mail *</label>
                <input type="email" id="email" name="email" className="form-control" required />
              </div>

              <div className="mb-3">
                <label htmlFor="wachtwoord" className="form-label">🔑 Password</label>
                <input
                type="password"
                id="wachtwoord"
                name="wachtwoord"
                className="form-control"
                required
                minLength="6"
                pattern=".{6,}"
                title="At least 6 characters"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="land" className="form-label">🌍 Choose your country</label>
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

              {/* Removed "Heb je een winkel?" dropdown and conditional shop details form */}

              <button type="submit" className="btn btn-primary w-100 mt-3">✅ Register</button>
            </form>

            <p className="text-center mt-3">
              Already have an account? <a href="/auth/login">Login</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
