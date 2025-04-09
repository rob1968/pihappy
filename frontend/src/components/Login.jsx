import React, { useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate(); // Get navigate function
  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      email,
      password,
    };

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (response.ok) {
        // alert("Login succesvol!"); // Remove alert
        navigate("/"); // Redirect to home page
      } else {
        alert(`Fout bij inloggen: ${result.message}`);
      }
    } catch (error) {
      console.error("Error during login:", error);
      alert("Er is een fout opgetreden. Probeer het later opnieuw.");
    }
  };

  return (
    <div className="row justify-content-center">
      <div className="col-md-6 col-lg-5">
        <div className="card shadow-lg">
          <div className="card-body">
            <h2 className="text-center">🔐 Login</h2>
            <form onSubmit={handleSubmit}>
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
                />
              </div>

              <div className="mb-3">
                <label htmlFor="password" className="form-label">
                  🔑 Wachtwoord <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-100 mt-3">
                ✅ Inloggen
              </button>
            </form>

            <p className="text-center mt-3">
              Heb je nog geen account? <a href="/register">Registreren</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;