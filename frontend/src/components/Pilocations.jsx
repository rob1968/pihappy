import React, { useState, useEffect, useCallback, useRef } from 'react';
// Import Autocomplete along with other components
import { GoogleMap, LoadScript, Marker, InfoWindow, Autocomplete } from '@react-google-maps/api';
import './Pilocations.css'; // Import the CSS

const MAP_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAP_CENTER = { lat: 52.3676, lng: 4.9041 }; // Amsterdam center
const LIBRARIES = ["places"]; // Define libraries for LoadScript, including places for Autocomplete
const ICON_URL = "https://www.pihappy.me/picoin.png";

const containerStyle = {
  width: '100%',
  height: '100%'
};

function Pilocations() {
  const [winkels, setWinkels] = useState([]);
  const [filteredWinkels, setFilteredWinkels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWinkel, setSelectedWinkel] = useState(null); // Keep this for InfoWindow
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null); // For map loading errors
  const [loading, setLoading] = useState(true); // For map data loading
  const [availableCategories, setAvailableCategories] = useState([]); // State for categories dropdown

  // State for the "Add Shop" form
  const [showAddShopForm, setShowAddShopForm] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopCategory, setNewShopCategory] = useState(""); // Add category state
  const [newShopLocation, setNewShopLocation] = useState("");
  const [newShopLatitude, setNewShopLatitude] = useState(null); // State for latitude
  const [newShopLongitude, setNewShopLongitude] = useState(null); // State for longitude
  const [newShopType, setNewShopType] = useState("Shop"); // Default type
  const [addShopError, setAddShopError] = useState(null);
  const [addShopLoading, setAddShopLoading] = useState(false);
  const [refreshData, setRefreshData] = useState(0); // Counter to trigger data refresh

  const mapRef = useRef(); // To store map instance
  const autocompleteRef = useRef(null); // Ref for Autocomplete input

  const onLoad = useCallback(function callback(mapInstance) {
    mapRef.current = mapInstance; // Store the map instance
    setMap(mapInstance); // Also set state if needed elsewhere, though ref is often sufficient
    // You could potentially set bounds here after markers load if needed
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMap(null);
  }, []);

  // Fetch shops data - runs on initial load and when refreshData changes
  useEffect(() => {
    setLoading(true);
    fetch('/api/shops') // Fetch from the new endpoint
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter out shops without valid coordinates returned by the updated API
        const validShops = data.filter(shop =>
          typeof shop.latitude === 'number' &&
          typeof shop.longitude === 'number'
        );
        if (validShops.length < data.length) {
            console.warn(`Filtered out ${data.length - validShops.length} shops due to missing/invalid coordinates after API formatting.`);
        }
        setWinkels(validShops); // Use the filtered shop data
        setError(null); // Clear map loading error
      })
      .catch(err => {
        console.error("Fout bij laden van shops:", err); // Updated error message
        setError("Kon shops niet laden. Probeer het later opnieuw."); // Updated error message
        setWinkels([]); // Clear shops on error
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshData]); // Re-fetch shops when refreshData changes

  // Filter shops when category or shops list changes
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredWinkels(winkels); // Use 'winkels' state which now holds shops data
    } else {
      // Assuming 'shops' data has a 'category' field matching the filter values
      setFilteredWinkels(winkels.filter(shop => shop.category === selectedCategory));
    }
    setSelectedWinkel(null); // Close info window when filter changes
  }, [selectedCategory, winkels]);

  // Fetch categories for the dropdown
  useEffect(() => {
    fetch('/api/categories')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setAvailableCategories(data); // Store fetched categories
      })
      .catch(err => {
        console.error("Error fetching categories:", err);
        // Optionally set an error state here if needed
      });
  }, []); // Runs once on component mount

  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
  };

  const handleMarkerClick = (winkel) => {
    setSelectedWinkel(winkel);
  };

  const handleInfoWindowClose = () => {
    setSelectedWinkel(null);
  };

  // --- Add Shop Form Logic ---
  const onAutocompleteLoad = (autocompleteInstance) => {
    autocompleteRef.current = autocompleteInstance;
  };

  const onPlaceChanged = () => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location && place?.formatted_address) {
      setNewShopLocation(place.formatted_address);
      setNewShopLatitude(place.geometry.location.lat()); // Store latitude
      setNewShopLongitude(place.geometry.location.lng()); // Store longitude
      console.log("Place selected:", place.formatted_address, place.geometry.location.lat(), place.geometry.location.lng());
    } else {
      console.log("Autocomplete did not return a place with geometry and address.");
      // Clear coordinates if address is invalid or cleared
      setNewShopLatitude(null);
      setNewShopLongitude(null);
    }
  };

  const handleAddShopSubmit = (event) => {
    event.preventDefault();
    setAddShopLoading(true);
    setAddShopError(null);

    const shopData = {
      name: newShopName,
      category: newShopCategory,
      location: newShopLocation,
      latitude: newShopLatitude,   // Add latitude
      longitude: newShopLongitude, // Add longitude
      type: newShopType,
    };

    fetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData),
    })
    .then(response => {
      if (!response.ok) {
        // Attempt to read error message from backend if available
        return response.json().then(errData => {
          throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then(newShop => {
      console.log("Shop added successfully:", newShop);
      // Clear form and hide it
      setNewShopName("");
      setNewShopCategory("");
      setNewShopLocation("");
      setNewShopLatitude(null); // Clear coordinates
      setNewShopLongitude(null); // Clear coordinates
      setNewShopType("Shop");
      setShowAddShopForm(false);
      // Trigger data refresh for the map
      setRefreshData(prev => prev + 1);
    })
    .catch(err => {
      console.error("Error adding shop:", err);
      setAddShopError(err.message || "Failed to add shop. Please try again.");
    })
    .finally(() => {
      setAddShopLoading(false);
    });
  };
  // --- End Add Shop Form Logic ---


  if (!MAP_API_KEY) {
    return <div className="pilocations-container error">Google Maps API Key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY.</div>;
  }

  return (
    <div className="pilocations-container">
      <h1>Pi Coin Accepted Locations</h1>
      {error && <p className="error">Map Error: {error}</p>}

      {/* Button to toggle Add Shop form */}
      <button onClick={() => setShowAddShopForm(!showAddShopForm)} className="btn btn-primary mb-3">
        {showAddShopForm ? 'Cancel Adding Shop' : 'Add New Shop'}
      </button>

      {/* LoadScript needs to wrap both map and autocomplete form */}
      <LoadScript googleMapsApiKey={MAP_API_KEY} libraries={LIBRARIES}>
        <> {/* Use Fragment to group elements under LoadScript */}

          {/* Conditionally render Add Shop form */}
          {showAddShopForm && (
            <div className="add-shop-form card mb-4 p-3">
              <h2>Add Your Shop</h2>
              <form onSubmit={handleAddShopSubmit}>
                <div className="mb-3">
                  <label htmlFor="newShopName" className="form-label">Shop Name *</label>
                  <input type="text" id="newShopName" className="form-control" value={newShopName} onChange={(e) => setNewShopName(e.target.value)} required />
                </div>
                <div className="mb-3">
                   <label htmlFor="newShopCategory" className="form-label">Category *</label>
                   <select id="newShopCategory" className="form-select" value={newShopCategory} onChange={(e) => setNewShopCategory(e.target.value)} required>
                     <option value="" disabled>-- Select a Category --</option>
                     {availableCategories.map(category => (
                       <option key={category} value={category}>
                         {/* Capitalize first letter for display */}
                         {category.charAt(0).toUpperCase() + category.slice(1)}
                       </option>
                     ))}
                   </select>
                </div>
                <div className="mb-3">
                  <label htmlFor="newShopLocation" className="form-label">Location *</label>
                  <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                    <input
                      type="text"
                      id="newShopLocation"
                      className="form-control"
                      placeholder="Enter shop address"
                      value={newShopLocation}
                      onChange={(e) => setNewShopLocation(e.target.value)} // Allow manual typing too
                      required
                    />
                  </Autocomplete>
                </div>
                 <div className="mb-3">
                   <label htmlFor="newShopType" className="form-label">Type</label>
                   <input type="text" id="newShopType" className="form-control" value={newShopType} onChange={(e) => setNewShopType(e.target.value)} placeholder="e.g., Shop, Service"/>
                 </div>

                {addShopError && <p className="error text-danger">Error: {addShopError}</p>}

                <button type="submit" className="btn btn-success" disabled={addShopLoading}>
                  {addShopLoading ? 'Adding...' : 'Submit Shop'}
                </button>
              </form>
            </div>
          )}

          {/* Existing Map Container */}
          <div className="map-container">
          <div className="controls">
            <label htmlFor="category-filter">Filter op categorie:</label>
            <select id="category-filter" className="form-select form-select-sm" value={selectedCategory} onChange={handleCategoryChange}>
              <option value="all">Alle</option>
              {/* Populate options dynamically */}
              {availableCategories.map(category => (
                <option key={category} value={category}>
                  {/* Capitalize first letter for display */}
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <GoogleMap
            mapContainerStyle={containerStyle}
            center={MAP_CENTER}
            zoom={10}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            {/* Render Markers only when map is loaded and data fetch is complete */}
            {map && !loading && filteredWinkels.map((shop) => {
              // API should now provide latitude and longitude as numbers
              const position = { lat: shop.latitude, lng: shop.longitude };

              // Ensure window.google.maps is available before using it
              const iconSize = window.google && window.google.maps ? new window.google.maps.Size(40, 40) : undefined;

              return (
                <Marker
                  key={shop._id} // Use MongoDB _id as key
                  position={position}
                  title={shop.name || 'Naam onbekend'} // Use 'name' field
                  icon={iconSize ? { url: ICON_URL, scaledSize: iconSize } : undefined}
                  onClick={() => handleMarkerClick(shop)} // Pass the shop object
                />
              );
            })}

            {/* Render InfoWindow only when map is loaded and a shop is selected */}
            {map && selectedWinkel && (
              <InfoWindow
                position={{ lat: selectedWinkel.latitude, lng: selectedWinkel.longitude }}
                onCloseClick={handleInfoWindowClose}
              >
                <div className="info-window-content">
                  <h3>{selectedWinkel.name || "Naam onbekend"}</h3> {/* Use name */}
                  <p>{selectedWinkel.location || "Locatie onbekend"}</p>
                  <p>Categorie: {selectedWinkel.category || "Onbekend"}</p>
                  {/* Add link to user profile if userId exists */}
                  {selectedWinkel.userId && (
                    <p>Added by: <a href={`/profile/${selectedWinkel.userId}`} target="_blank" rel="noopener noreferrer">View Profile</a></p>
                  )}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWinkel.latitude},${selectedWinkel.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Route plannen
                  </a>
                </div>
              </InfoWindow>
            )}

            {/* Optional: Display loading messages */}
            {!map && <p style={{ textAlign: 'center', marginTop: '20px' }}>Loading Google Maps...</p>}
            {map && loading && <p style={{ textAlign: 'center', marginTop: '20px' }}>Loading shop data...</p>}

          </GoogleMap>
        </div>
        </> {/* Close Fragment */}
      </LoadScript>
    </div>
  );
}

export default Pilocations;