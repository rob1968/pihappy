import React, { useState } from "react";
import { useTranslation } from 'react-i18next'; // Import the hook

// --- IMPORTANT SECURITY NOTE ---
// This component now uses process.env.REACT_APP_GOOGLE_API_KEY directly
// for geocoding in the handleSubmit function. Exposing API keys directly
// in frontend code is generally insecure. Consider creating a dedicated
// backend endpoint to handle geocoding securely if this is a production app.
// Ensure REACT_APP_GOOGLE_API_KEY is set in your .env file for development.
// --- /IMPORTANT SECURITY NOTE ---

function AddShopForm() {
  const { t } = useTranslation(); // Get the translation function
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState("");
  const [shopSuggestions, setShopSuggestions] = useState([]); // State for suggestions
  const [error, setError] = useState(null); // State for form errors
  const [successMessage, setSuccessMessage] = useState(null); // State for success message
  const [isSubmitting, setIsSubmitting] = useState(false); // State to disable button during submit

  // Function to fetch shop suggestions from the backend
  const fetchShopSuggestions = async (address) => {
    if (!address || address.trim().length < 5) { // Don't fetch for very short addresses
      setShopSuggestions([]);
      // Keep name as is, user might be typing manually
      // setName("");
      return;
    }
    setError(null); // Clear previous errors
    try {
      const response = await fetch(`/api/shops/suggestions?address=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          console.warn("Suggestion API returned an error:", data.error);
          setShopSuggestions([]);
        } else {
          setShopSuggestions(data.suggestions || []);
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
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true); // Disable button

    let latitude = null;
    let longitude = null;
    const apiKey = process.env.REACT_APP_GOOGLE_API_KEY; // Get API key from environment

    if (!apiKey) {
        setError(t('addShop.errorApiKeyMissing'));
        setIsSubmitting(false);
        return;
    }

    // --- Step 1: Geocode the location ---
    try {
        console.log(`Geocoding address: ${location}`);
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;
        const geocodeResponse = await fetch(geocodeUrl);
        const geocodeData = await geocodeResponse.json();

        if (geocodeData.status === 'OK' && geocodeData.results && geocodeData.results.length > 0) {
            const coords = geocodeData.results[0].geometry.location;
            latitude = coords.lat;
            longitude = coords.lng;
            console.log(`Geocoding successful: Lat=${latitude}, Lng=${longitude}`);
        } else {
            console.error("Geocoding failed:", geocodeData.status, geocodeData.error_message);
            setError(t('addShop.errorGeocodingFailed', { location: location, status: geocodeData.status }));
            setIsSubmitting(false);
            return; // Stop submission if geocoding fails
        }
    } catch (geocodeError) {
        console.error("Error during geocoding fetch:", geocodeError);
        setError(t('addShop.errorGeocodingFetch'));
        setIsSubmitting(false);
        return; // Stop submission on fetch error
    }

    // --- Step 2: Submit shop data (if geocoding succeeded) ---
    const shopData = { name, category, location, type, latitude, longitude }; // Include coordinates

    try {
      console.log("Submitting shop data:", shopData);
      const response = await fetch("/api/shops", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'credentials': 'include'
        },
        body: JSON.stringify(shopData)
      });

      const data = await response.json();

      if (response.ok) {
        console.log("✅ Shop opgeslagen:", data);
        setSuccessMessage(t('addShop.successMessage', { name: data.name }));
        // Clear the form
        setName("");
        setCategory("");
        setLocation("");
        setType("");
        setShopSuggestions([]);
      } else {
         console.error("❌ Fout bij opslaan:", data.error || response.statusText);
         setError(data.error || t('addShop.errorSaveFailedStatus', { status: response.status }));
      }

    } catch (submitError) {
      console.error("❌ Fout bij opslaan:", submitError);
      setError(t('addShop.errorSubmitGeneric'));
    } finally {
        setIsSubmitting(false); // Re-enable button
    }
  };

  // Handler for selecting from the suggestion dropdown
  const handleSuggestionSelect = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue) {
      setName(selectedValue); // Update the main name input state
    }
  };


  return (
    <form onSubmit={handleSubmit}>
      {error && <p style={{ color: 'red' }}>{t('addShop.errorPrefix')}: {error}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      {/* Name Input Field (Always Text) */}
      <div>
        <label htmlFor="shop-name">{t('addShop.nameLabel')}:</label>
        <input
          id="shop-name"
          type="text"
          placeholder={t('addShop.namePlaceholder')}
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="off"
          required
          disabled={isSubmitting}
        />
      </div>

      {/* Separate Suggestion Dropdown (Conditional) */}
      {shopSuggestions.length > 0 && (
        <div style={{ marginTop: '5px', marginBottom: '10px' }}> {/* Add some spacing */}
          <label htmlFor="shop-suggestions-select" style={{ marginRight: '5px' }}>{t('addShop.suggestionsLabel')}:</label>
          <select
            id="shop-suggestions-select"
            // Let the dropdown trigger the name change via onChange, no need for controlled value prop here
            onChange={handleSuggestionSelect}
            disabled={isSubmitting}
          >
            <option value="">{t('addShop.selectSuggestionPlaceholder')}</option>
            {shopSuggestions.map((suggestion, index) => (
              <option key={index} value={suggestion}>
                {suggestion}
              </option>
            ))}
          </select>
        </div>
      )}


      {/* Other Form Fields */}
      <div>
        <label htmlFor="shop-category">{t('addShop.categoryLabel')}:</label>
        <select
          id="shop-category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          disabled={isSubmitting}
          required // Add required if a category must be selected
        >
          <option value="">{t('addShop.selectCategoryPlaceholder', 'Select a category...')}</option>
          {[
            "Accommodation",
            "Automotive",
            "Construction, Interior, Real Estate",
            "Fashion, Accessories",
            "Food Service, Cafe, Restaurant, Bar",
            "Food, Health Foods",
            "Fortune Telling, Naming, Tarot",
            "Home Appliances, Mobile Phones",
            "Legal and Administrative Services",
            "Manufacturing",
            "Medical",
            "Office Equipment",
            "Others",
            "PC, Notebooks, Games",
            "Pet-related",
            "Skin, Hair, Beauty, Cosmetics",
            "Sports, Hobbies, Health",
          ].sort().map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="shop-location">{t('addShop.locationLabel')}:</label>
        <input
          id="shop-location"
          placeholder={t('addShop.locationPlaceholder')}
          value={location}
          onChange={e => setLocation(e.target.value)}
          onBlur={(e) => fetchShopSuggestions(e.target.value)}
          required
          disabled={isSubmitting}
        />
      </div>

      <div>
        <label htmlFor="shop-type">{t('addShop.typeLabel')}:</label>
        <input
          id="shop-type"
          placeholder={t('addShop.typePlaceholder')}
          value={type}
          onChange={e => setType(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('addShop.savingButton') : t('addShop.saveButton')}
      </button>
    </form>
  );
}

export default AddShopForm;
