import React, { useState, useRef, useCallback } from "react";
import { useJsApiLoader, Autocomplete } from "@react-google-maps/api";

const libraries = ["places"];

const Register = () => {
  const [landen, setLanden] = useState([]);
  const [heeftWinkel, setHeeftWinkel] = useState("nee");
  const [winkelnaam, setWinkelnaam] = useState("");
  const [locatie, setLocatie] = useState("");
  const [gekozenLand, setGekozenLand] = useState("");

  const autocompleteRef = useRef(null);

  // ✅ Load Google Maps script with Autocomplete support
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.formatted_address) {
      setLocatie(place.formatted_address);
    }
  }, []);

  React.useEffect(() => {
    fetch("/api/landen")
      .then((res) => res.json())
      .then((data) => setLanden(data.landen || []))
      .catch((err) => console.error("Fout bij ophalen landen:", err));
  }, []);

  const handleWinkelChange = (e) => {
    setHeeftWinkel(e.target.value);
  };

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
        alert(result.status === "success" ? "Registratie succesvol!" : `Fout: ${result.message}`);
      })
      .catch((err) => {
        console.error("Error submitting form:", err);
        alert("Er is een fout opgetreden. Probeer het later opnieuw.");
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
                <label htmlFor="naam" className="form-label">👤 Naam *</label>
                <input type="text" id="naam" name="naam" className="form-control" required autoFocus />
              </div>

              <div className="mb-3">
                <label htmlFor="email" className="form-label">📧 E-mail *</label>
                <input type="email" id="email" name="email" className="form-control" required />
              </div>

              <div className="mb-3">
                <label htmlFor="wachtwoord" className="form-label">🔑 Wachtwoord</label>
                <input
                type="password"
                id="wachtwoord"
                name="wachtwoord"
                className="form-control"
                required
                minLength="6"
                pattern=".{6,}"
                title="Minstens 6 tekens"
                />
              </div>

              <div className="mb-3">
                <label htmlFor="land" className="form-label">🌍 Kies je land</label>
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

              <div className="mb-3">
                <label htmlFor="heeft_winkel" className="form-label">🏪 Heb je een winkel?</label>
                <select
                  id="heeft_winkel"
                  name="heeft_winkel"
                  className="form-select"
                  value={heeftWinkel}
                  onChange={handleWinkelChange}
                >
                  <option value="nee">Nee</option>
                  <option value="ja">Ja</option>
                </select>
              </div>

              {heeftWinkel === "ja" && (
                <div id="winkelgegevens">
                  <div className="mb-3">
                    <label htmlFor="winkelnaam" className="form-label">🏷️ Naam winkel *</label>
                    <input
                      type="text"
                      id="winkelnaam"
                      name="winkelnaam"
                      className="form-control"
                      value={winkelnaam}
                      onChange={(e) => setWinkelnaam(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="locatie" className="form-label">📍 Locatie *</label>
                    {isLoaded ? (
                      <Autocomplete onLoad={(auto) => (autocompleteRef.current = auto)} onPlaceChanged={onPlaceChanged}>
                        <input
                          type="text"
                          id="locatie"
                          name="locatie"
                          className="form-control"
                          placeholder="Voer je winkeladres in"
                          value={locatie}
                          onChange={(e) => setLocatie(e.target.value)}
                          required
                        />
                      </Autocomplete>
                    ) : (
                      <input
                        type="text"
                        id="locatie"
                        name="locatie"
                        className="form-control"
                        placeholder="Laden Google Maps..."
                        disabled
                      />
                    )}
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary w-100 mt-3">✅ Registreren</button>
            </form>

            <p className="text-center mt-3">
              Heb je al een account? <a href="/auth/login">Inloggen</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
