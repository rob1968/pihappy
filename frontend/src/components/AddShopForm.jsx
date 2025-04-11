import React, { useState } from "react";

function AddShopForm() {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [shopSuggestions, setShopSuggestions] = useState([]); // State for suggestions
  const [error, setError] = useState(null); // State for form errors
  const [successMessage, setSuccessMessage] = useState(null); // State for success message

  // Function to fetch shop suggestions from the backend
  const fetchShopSuggestions = async (address) => {
    if (!address || address.trim().length < 5) { // Don't fetch for very short addresses
      setShopSuggestions([]);
      setName(""); // Clear name if address is too short or cleared
      return;
    }
    setError(null); // Clear previous errors
    try {
      // Use relative path for API call
      const response = await fetch(`/api/shops/suggestions?address=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          console.warn("Suggestion API returned an error:", data.error);
          setShopSuggestions([]);
        } else {
          setShopSuggestions(data.suggestions || []);
          // Optionally pre-select the first suggestion if available
          // if (data.suggestions && data.suggestions.length > 0) {
          //   setName(data.suggestions[0]);
          // } else {
          //   setName(""); // Clear name if no suggestions found
          // }
        }
      } else {
        console.error("Failed to fetch shop suggestions:", response.statusText);
        setShopSuggestions([]);
      }
    } catch (fetchError) {
      console.error("Error fetching shop suggestions:", fetchError);
      setShopSuggestions([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Clear previous errors
    setSuccessMessage(null);
    // setShopSuggestions([]); // Suggestions cleared automatically when location changes or on success

    // --- IMPORTANT ---
    // This shopData is missing latitude and longitude, which the backend now requires.
    // You will need to add logic to get lat/lon (e.g., from a map or geocoding)
    // and include them here for the form submission to succeed with the backend validation.
    const shopData = { name, category, location, type /*, latitude, longitude */ };
    // --- /IMPORTANT ---


    try {
      // Use relative path for API call
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Include credentials if your session/auth requires cookies
          'credentials': 'include'
        },
        body: JSON.stringify(shopData)
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Shop opgeslagen:", data);
        setSuccessMessage(`Shop "${data.name}" added successfully!`);
        // Optionally clear the form
        setName("");
        setCategory("");
        setLocation("");
        setType("");
        setShopSuggestions([]); // Clear suggestions on success
      } else {
         console.error("❌ Fout bij opslaan:", data.error || response.statusText);
         setError(data.error || `Failed to save shop (${response.status})`);
      }

    } catch (submitError) {
      console.error("❌ Fout bij opslaan:", submitError);
      setError("An error occurred while submitting the form.");
    }
  };

  // No longer needed:
  // const handleSuggestionClick = (suggestion) => { ... };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      {/* Conditionally render Input or Select for Name */}
      <div>
        <label htmlFor="shop-name">Name:</label>
        {shopSuggestions.length > 0 ? (
          <select
            id="shop-name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          >
            <option value="">-- Select a shop --</option>
            {shopSuggestions.map((suggestion, index) => (
              <option key={index} value={suggestion}>
                {suggestion}
              </option>
            ))}
          </select>
        ) : (
          <input
            id="shop-name"
            type="text"
            placeholder="Name (Enter address first for suggestions)"
            value={name}
            onChange={e => setName(e.target.value)}
            autoComplete="off"
            required
          />
        )}
      </div>

      {/* Other Form Fields */}
      <div>
        <label htmlFor="shop-category">Category:</label>
        <input
          id="shop-category"
          placeholder="Category"
          value={category}
          onChange={e => setCategory(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="shop-location">Location:</label>
        <input
          id="shop-location"
          placeholder="Location (Address)"
          value={location}
          onChange={e => setLocation(e.target.value)}
          // Fetch suggestions when user clicks out of the field
          onBlur={(e) => fetchShopSuggestions(e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="shop-type">Type:</label>
        <input
          id="shop-type"
          placeholder="Type (e.g., Supermarket, Cafe)"
          value={type}
          onChange={e => setType(e.target.value)}
        />
      </div>

      <button type="submit">Save Shop</button>
    </form>
  );
}

export default AddShopForm;
