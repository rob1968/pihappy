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
  height: '100%' // Ensure parent container (.map-container) has a defined height
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
  const [shopSuggestions, setShopSuggestions] = useState([]); // State for name suggestions

  const mapRef = useRef(); // To store map instance
  const autocompleteRef = useRef(null); // Ref for Autocomplete input

  const onLoad = useCallback(function callback(mapInstance) {
    mapRef.current = mapInstance;
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMap(null);
  }, []);

  // Fetch shops data - runs on initial load and when refreshData changes
  useEffect(() => {
    setLoading(true);
    fetch('/api/shops')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        const validShops = data.filter(shop =>
          typeof shop.latitude === 'number' &&
          typeof shop.longitude === 'number'
        );
        if (validShops.length < data.length) {
            console.warn(`Filtered out ${data.length - validShops.length} shops due to missing/invalid coordinates after API formatting.`);
        }
        setWinkels(validShops);
        setError(null);
      })
      .catch(err => {
        console.error("Error loading shops:", err);
        setError(err.message || "Could not load shops. Please try again later.");
        setWinkels([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [refreshData]);

  // Filter shops when category or shops list changes
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredWinkels(winkels);
    } else {
      setFilteredWinkels(winkels.filter(shop => shop.category === selectedCategory));
    }
    setSelectedWinkel(null);
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
        setAvailableCategories(data);
      })
      .catch(err => {
        console.error("Error fetching categories:", err);
      });
  }, []);

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
      const address = place.formatted_address;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setNewShopLocation(address);
      setNewShopLatitude(lat);
      setNewShopLongitude(lng);
      console.log("Place selected:", address, lat, lng);
      // Location state update will trigger the useEffect below to fetch suggestions
    } else {
      console.log("Autocomplete did not return a place with geometry and address.");
      setNewShopLatitude(null);
      setNewShopLongitude(null);
      setShopSuggestions([]); // Clear suggestions if address becomes invalid
    }
  };

  const handleAddShopSubmit = (event) => {
    event.preventDefault();
    setAddShopLoading(true);
    setAddShopError(null);

    if (newShopLatitude === null || newShopLongitude === null) {
        setAddShopError("Could not determine coordinates for the location. Please select a valid address.");
        setAddShopLoading(false);
        return;
    }

    const shopData = {
      name: newShopName,
      category: newShopCategory,
      location: newShopLocation,
      latitude: newShopLatitude,
      longitude: newShopLongitude,
      type: newShopType,
    };

    fetch('/api/shops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(shopData),
      credentials: 'include'
    })
    .then(response => {
      if (!response.ok) {
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
      setNewShopLatitude(null);
      setNewShopLongitude(null);
      setNewShopType("Shop");
      setShopSuggestions([]); // Clear suggestions list on success
      setShowAddShopForm(false);
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

  // --- Shop Name Suggestion Logic ---
  const fetchShopSuggestions = useCallback(async (address) => {
    if (!address || address.trim().length < 5) {
      setShopSuggestions([]);
      // Keep name as is unless address is cleared/too short
      if (!address || address.trim().length === 0) {
          setNewShopName("");
      }
      return;
    }
    try {
      const response = await fetch(`/api/shops/suggestions?address=${encodeURIComponent(address)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          console.warn("Suggestion API returned an error:", data.error);
          setShopSuggestions([]);
        } else {
          setShopSuggestions(data.suggestions || []);
          // Set name to blank if suggestions appear, forcing user to select
          if (data.suggestions && data.suggestions.length > 0) {
             setNewShopName(""); // Clear name field when suggestions load
          }
        }
      } else {
        console.error("Failed to fetch shop suggestions:", response.statusText);
        setShopSuggestions([]);
      }
    } catch (fetchError) {
      console.error("Error fetching shop suggestions:", fetchError);
      setShopSuggestions([]);
    }
  }, []); // useCallback dependencies are empty

  // Effect to fetch suggestions when location changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (newShopLocation && newShopLocation.trim().length >= 5) {
        if (newShopLatitude !== null && newShopLongitude !== null) {
             fetchShopSuggestions(newShopLocation);
        }
      } else {
        setShopSuggestions([]);
        setNewShopName(""); // Clear name if location is too short or empty
      }
    }, 700);

    return () => {
      clearTimeout(handler);
    };
  }, [newShopLocation, newShopLatitude, newShopLongitude, fetchShopSuggestions]);

  // Removed handleSuggestionSelect as direct onChange on select is used

  // --- End Shop Name Suggestion Logic ---


  if (!MAP_API_KEY) {
    return <div className="pilocations-container error">Google Maps API Key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY.</div>;
  }

  if (loading) {
    return <div className="pilocations-container"><p style={{ textAlign: 'center', marginTop: '20px' }}>Loading...</p></div>;
  }

  if (error) {
      return <div className="pilocations-container"><p className="error">Map Error: {error}</p></div>;
  }

  return (
    <div className="pilocations-container">
      <h1>Pi Coin Accepted Locations</h1>

      <button onClick={() => setShowAddShopForm(!showAddShopForm)} className="btn btn-primary mb-3">
        {showAddShopForm ? 'Cancel Adding Shop' : 'Add New Shop'}
      </button>

      {showAddShopForm && (
        <div className="add-shop-form card mb-4 p-3">
          <h2>Add Your Shop</h2>
          <form onSubmit={handleAddShopSubmit}>

            {/* <<< MODIFIED: Conditionally render Input or Select for Company Name */}
            <div className="mb-3">
              <label htmlFor="newShopName" className="form-label">Company *</label>
              {shopSuggestions.length > 0 ? (
                <select
                  id="newShopName"
                  className="form-select"
                  value={newShopName} // Controlled component
                  onChange={(e) => setNewShopName(e.target.value)} // Update state on change
                  required
                  disabled={addShopLoading}
                >
                  <option value="" disabled>-- Select a company --</option>
                  {shopSuggestions.map((suggestion, index) => (
                    <option key={index} value={suggestion}>
                      {suggestion}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  id="newShopName"
                  className="form-control"
                  placeholder="Company Name (Enter address first for suggestions)"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  required
                  disabled={addShopLoading}
                />
              )}
            </div>

            {/* REMOVED Separate Suggestion Dropdown */}

            {/* Category Dropdown */}
            <div className="mb-3">
               <label htmlFor="newShopCategory" className="form-label">Category *</label>
               <select id="newShopCategory" className="form-select" value={newShopCategory} onChange={(e) => setNewShopCategory(e.target.value)} required disabled={addShopLoading}>
                 <option value="" disabled>-- Select a Category --</option>
                 {availableCategories.map(category => (
                   <option key={category} value={category}>
                     {category.charAt(0).toUpperCase() + category.slice(1)}
                   </option>
                 ))}
               </select>
            </div>

            {/* Location Autocomplete */}
            <div className="mb-3">
              <label htmlFor="newShopLocation" className="form-label">Location *</label>
              <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                <input
                  type="text"
                  id="newShopLocation"
                  className="form-control"
                  placeholder="Enter shop address"
                  value={newShopLocation}
                  onChange={(e) => setNewShopLocation(e.target.value)}
                  required
                  disabled={addShopLoading}
                />
              </Autocomplete>
            </div>

            {/* Type Input */}
             <div className="mb-3">
               <label htmlFor="newShopType" className="form-label">Type</label>
               <input type="text" id="newShopType" className="form-control" value={newShopType} onChange={(e) => setNewShopType(e.target.value)} placeholder="e.g., Shop, Service" disabled={addShopLoading}/>
             </div>

            {addShopError && <p className="error text-danger">Error: {addShopError}</p>}

            <button type="submit" className="btn btn-success" disabled={addShopLoading}>
              {addShopLoading ? 'Adding...' : 'Submit Shop'}
            </button>
          </form>
        </div>
      )}

      {/* Map Container */}
      <div className="map-container">
        <LoadScript googleMapsApiKey={MAP_API_KEY} libraries={LIBRARIES}>
          <>
            <div className="controls">
              <label htmlFor="category-filter">Filter by category:</label>
              <select id="category-filter" className="form-select form-select-sm" value={selectedCategory} onChange={handleCategoryChange}>
                <option value="all">All</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
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
              {map && filteredWinkels.map((shop) => {
                const position = { lat: shop.latitude, lng: shop.longitude };
                const iconSize = window.google && window.google.maps ? new window.google.maps.Size(40, 40) : undefined;
                return (
                  <Marker
                    key={shop._id}
                    position={position}
                    title={shop.name || 'Name unknown'}
                    icon={iconSize ? { url: ICON_URL, scaledSize: iconSize } : undefined}
                    onClick={() => handleMarkerClick(shop)}
                  />
                );
              })}

              {map && selectedWinkel && (
                <InfoWindow
                  position={{ lat: selectedWinkel.latitude, lng: selectedWinkel.longitude }}
                  onCloseClick={handleInfoWindowClose}
                >
                  <div className="info-window-content">
                    <h3>{selectedWinkel.name || "Name unknown"}</h3>
                    <p>{selectedWinkel.location || "Location unknown"}</p>
                    <p>Category: {selectedWinkel.category || "Unknown"}</p>
                    {/* Conditionally display phone */}
                    {selectedWinkel.phone && (
                      <p>Phone: {selectedWinkel.phone}</p>
                    )}
                    {/* Conditionally display website as a link */}
                    {selectedWinkel.website && (
                      <p>Website: <a href={selectedWinkel.website} target="_blank" rel="noopener noreferrer">{selectedWinkel.website}</a></p>
                    )}
                    {selectedWinkel.userId && (
                      <p>Added by: <a href={`/profile/${selectedWinkel.userId}`} target="_blank" rel="noopener noreferrer">View Profile</a></p>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWinkel.latitude},${selectedWinkel.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Plan Route
                    </a>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </>
        </LoadScript>
      </div>
    </div>
  );
}

export default Pilocations;