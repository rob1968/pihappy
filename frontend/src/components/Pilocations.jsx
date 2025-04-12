import React, { useState, useEffect, useCallback, useRef } from 'react';
// Import Autocomplete along with other components
import { GoogleMap, LoadScript, Marker, InfoWindow, Autocomplete } from '@react-google-maps/api';
import MainMenu from './MainMenu'; // <<< Import the MainMenu component
import './Pilocations.css'; // Import the CSS

const MAP_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const DEFAULT_MAP_CENTER = { lat: 52.3676, lng: 4.9041 }; // Amsterdam center as fallback
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
  const [selectedSalesChannel, setSelectedSalesChannel] = useState('all'); // <<< State for sales channel filter
  const [selectedWinkel, setSelectedWinkel] = useState(null); // Keep this for InfoWindow
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null); // For map loading errors
  const [loading, setLoading] = useState(true); // For map data loading
  const [availableCategories, setAvailableCategories] = useState([]); // State for categories dropdown
  const [mapCenter, setMapCenter] = useState(null); // <<< Use state for current center

  // State for the "Add Shop" form
  const [showAddShopForm, setShowAddShopForm] = useState(false);
  const [newShopName, setNewShopName] = useState("");
  const [newShopCategory, setNewShopCategory] = useState(""); // Add category state
  const [newShopLocation, setNewShopLocation] = useState("");
  const [newShopLatitude, setNewShopLatitude] = useState(null); // State for latitude
  const [newShopLongitude, setNewShopLongitude] = useState(null); // State for longitude
  const [newShopType, setNewShopType] = useState(""); // <<< Changed default state for dropdown
  const [addShopError, setAddShopError] = useState(null);
  const [newShopPhone, setNewShopPhone] = useState(""); // <<< State for phone
  const [newShopWebsite, setNewShopWebsite] = useState(""); // <<< State for website
  const [addShopLoading, setAddShopLoading] = useState(false);
  const [refreshData, setRefreshData] = useState(0); // Counter to trigger data refresh
  const [shopSuggestions, setShopSuggestions] = useState([]); // State for name suggestions
  const [panToCoords, setPanToCoords] = useState(null); // State to trigger panning { id, lat, lng }
  const [panToShopId, setPanToShopId] = useState(null); // <<< State to trigger panning to a new shop

  const mapRef = useRef(); // To store map instance
  const autocompleteRef = useRef(null); // Ref for Autocomplete input

  const onLoad = useCallback(function callback(mapInstance) {
    mapRef.current = mapInstance; // Store map instance in ref
    setMap(mapInstance); // Also keep in state if needed elsewhere
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMap(null);
  }, []);

  // Fetch user profile to set initial map center
  useEffect(() => {
    fetch('/api/profile', { credentials: 'include' }) // Fetch own profile
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        console.warn(`Failed to fetch profile: ${response.status}`);
        return null;
      })
      .then(profileData => {
        if (profileData && profileData.country_center_lat && profileData.country_center_lng) {
          console.log(`Setting initial map center based on user country: ${profileData.full_land_name || profileData.land}`);
          setMapCenter({ // <<< Set mapCenter
            lat: profileData.country_center_lat,
            lng: profileData.country_center_lng
          });
        } else {
          console.log("Using default map center.");
          setMapCenter(DEFAULT_MAP_CENTER); // <<< Set mapCenter
        }
      })
      .catch(err => {
        console.error("Error fetching profile:", err);
        setMapCenter(DEFAULT_MAP_CENTER); // <<< Set mapCenter
      });
  }, []); // Run only once on mount

  // Fetch shops data - runs on initial load and when refreshData changes
  useEffect(() => {
    // Only fetch shops once the initial center is determined (or defaulted)
    if (!mapCenter) return; // <<< Wait for mapCenter to be set

    setLoading(true);
    fetch('/api/shops', { credentials: 'include' })
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
  }, [refreshData, mapCenter]); // <<< Depend on mapCenter (runs when center is first set, and on refreshData)

  // Filter shops when category, sales channel, or shops list changes
  useEffect(() => {
    let currentlyFiltered = winkels;

    // Filter by category
    if (selectedCategory !== 'all') {
      currentlyFiltered = currentlyFiltered.filter(shop => shop.category === selectedCategory);
    }

    // Filter by sales channel (type)
    if (selectedSalesChannel !== 'all') {
      currentlyFiltered = currentlyFiltered.filter(shop => shop.type === selectedSalesChannel);
    }

    setFilteredWinkels(currentlyFiltered);
    setSelectedWinkel(null); // Reset selected marker on filter change
  }, [selectedCategory, selectedSalesChannel, winkels]); // <<< Add selectedSalesChannel dependency

  // Fetch categories for the dropdown
  useEffect(() => {
    fetch('/api/categories', { credentials: 'include' })
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

    // Store coords locally before fetch clears state
    const submittedLat = newShopLatitude;
    const submittedLng = newShopLongitude;

    const shopData = {
      name: newShopName,
      category: newShopCategory,
      location: newShopLocation,
      latitude: submittedLat, // Use stored coords
      longitude: submittedLng, // Use stored coords
      type: newShopType, // Use the state variable for the dropdown
      phone: newShopPhone, // <<< Add phone
      website: newShopWebsite, // <<< Add website
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
    .then(newShop => { // newShop here is the object returned by the backend
      console.log("Shop added successfully:", newShop);

      // --- Trigger panning/zooming via state update ---
      setPanToCoords({ id: newShop._id, lat: submittedLat, lng: submittedLng }); // Set coords to pan to
      // The useEffect below will handle the actual map movement
      // --- End Trigger ---

      // Clear form and hide it
      setNewShopName("");
      setNewShopCategory("");
      setNewShopLocation("");
      setNewShopLatitude(null);
      setNewShopLongitude(null);
      setNewShopType(""); // Reset dropdown to default
      setNewShopPhone(""); // <<< Clear phone
      setNewShopWebsite(""); // <<< Clear website
      setShopSuggestions([]);
      setShowAddShopForm(false);
      setRefreshData(prev => prev + 1); // Trigger data refresh AFTER panning (or doesn't matter much)
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
      if (!address || address.trim().length === 0) {
          setNewShopName("");
      }
      return;
    }
    try {
      const response = await fetch(`/api/shops/suggestions?address=${encodeURIComponent(address)}`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data.error) {
          console.warn("Suggestion API returned an error:", data.error);
          setShopSuggestions([]);
        } else {
          const suggestions = data.suggestions || [];
          setShopSuggestions(suggestions); // Update the suggestions list
          // If exactly one suggestion is returned, pre-fill the name field
          if (suggestions.length === 1) {
            setNewShopName(suggestions[0]);
            console.log(`Prefilled name with single suggestion: ${suggestions[0]}`);
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
  }, []);

  // Effect to fetch suggestions when location changes (debounced)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (newShopLocation && newShopLocation.trim().length >= 5) {
        if (newShopLatitude !== null && newShopLongitude !== null) {
             fetchShopSuggestions(newShopLocation);
        }
      } else {
        setShopSuggestions([]);
        setNewShopName("");
      }
    }, 700);

    return () => {
      clearTimeout(handler);
    };
  }, [newShopLocation, newShopLatitude, newShopLongitude, fetchShopSuggestions]);

  // --- End Shop Name Suggestion Logic ---

  // Effect to pan and zoom to newly added shop coordinates
  useEffect(() => {
    // Check if we have coordinates to pan to, a map instance, and the map center state is ready
    if (panToCoords && mapRef.current && mapCenter) {
      const targetCoords = { lat: panToCoords.lat, lng: panToCoords.lng };
      console.log(`useEffect: Panning and zooming to new shop coords`, targetCoords);
      mapRef.current.panTo(targetCoords);
      mapRef.current.setZoom(15);
      setMapCenter(targetCoords); // <<< Update the controlled center state
      setPanToCoords(null); // Reset the state variable to prevent re-panning
    }
    // Ensure mapRef and mapCenter are included in dependencies if used inside
  }, [panToCoords, mapRef, mapCenter]); // Dependencies: trigger coords object, map instance, mapCenter state


  if (!MAP_API_KEY) {
    return <div className="pilocations-container error">Google Maps API Key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY.</div>;
  }

  // Use initialMapCenter state for loading check too
  if (loading || !mapCenter) { // <<< Wait for mapCenter
    return <div className="pilocations-container"><p style={{ textAlign: 'center', marginTop: '20px' }}>Loading map data...</p></div>;
  }

  if (error) {
      return <div className="pilocations-container"><p className="error">Map Error: {error}</p></div>;
  }

  return (
    <div className="pilocations-container">
      {/* Render the MainMenu component */}
      <MainMenu />
      <h1>Pi Coin Accepted Locations</h1>

      {/* Map Container */}
      <div className="map-container">
        <LoadScript googleMapsApiKey={MAP_API_KEY} libraries={LIBRARIES}>
          <>
            <div className="controls">
              <label htmlFor="category-filter">Category:</label>
              <select id="category-filter" className="form-select form-select-sm" value={selectedCategory} onChange={handleCategoryChange}>
                <option value="all">All</option>
                {availableCategories.map(category => (
                  <option key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </option>
                ))}
              </select>

              {/* <<< Added Sales Channel Filter >>> */}
              <label htmlFor="sales-channel-filter" style={{ marginLeft: '10px' }}>Sales Channel:</label>
              <select
                id="sales-channel-filter"
                className="form-select form-select-sm"
                value={selectedSalesChannel}
                onChange={(e) => setSelectedSalesChannel(e.target.value)}
              >
                <option value="all">All</option>
                <option value="Offline">Offline</option>
                <option value="Online">Online</option>
                <option value="Offline & Online">Offline & Online</option>
              </select>
            </div>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={mapCenter} // <<< Use controlled mapCenter state
              zoom={6} // Zoom out to show country level
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
                    {selectedWinkel.phone && (
                      <p>Phone: {selectedWinkel.phone}</p>
                    )}
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

      {/* Add Shop Button and Form (Moved below map) */}
      <div style={{ marginTop: '20px' }}> {/* Add some spacing */}
        <button onClick={() => setShowAddShopForm(!showAddShopForm)} className="btn btn-primary mb-3">
          {showAddShopForm ? 'Cancel Adding Pi Location' : 'Add Pay with Pi Location'}
        </button>

        {showAddShopForm && (
          <div className="add-shop-form card mb-4 p-3">
            <h2></h2>
            <form onSubmit={handleAddShopSubmit}>

              {/* Location Autocomplete (Moved to top) */}
              <div className="mb-3">
                <label htmlFor="newShopLocation" className="form-label">Location *</label>
                <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                  <input
                    type="text"
                    id="newShopLocation"
                    className="form-control"
                    placeholder="Enter Location"
                    value={newShopLocation}
                    onChange={(e) => setNewShopLocation(e.target.value)}
                    required
                    disabled={addShopLoading}
                    autoFocus // <<< Added autoFocus
                  />
                </Autocomplete>
              </div>

              {/* Company Name Input + Custom Suggestions */}
              <div className="mb-3">
                <label htmlFor="newShopName" className="form-label">Company *</label>
                <input
                  type="text"
                  id="newShopName"
                  className="form-control"
                  placeholder="Company Name (Suggestions appear after address)"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  required
                  disabled={addShopLoading}
                  autoComplete="off" // Prevent browser autocomplete interfering
                />
                {/* Custom Suggestions Dropdown */}
                {shopSuggestions.length > 0 && (
                  <div className="list-group position-absolute" style={{ zIndex: 1000, width: 'calc(100% - 1rem)' }}> {/* Basic styling for dropdown */}
                    {shopSuggestions.map((suggestion, index) => (
                      <button
                        type="button" // Important: prevent form submission
                        key={index}
                        className="list-group-item list-group-item-action"
                        onClick={() => {
                          setNewShopName(suggestion); // Set input value
                          setShopSuggestions([]); // Clear suggestions to hide dropdown
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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

              {/* <<< Added Phone Input >>> */}
              <div className="mb-3">
                <label htmlFor="newShopPhone" className="form-label">Phone (Optional)</label>
                <input
                  type="tel" // Use type="tel" for phone numbers
                  id="newShopPhone"
                  className="form-control"
                  placeholder="e.g., +31 6 12345678"
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  disabled={addShopLoading}
                />
              </div>

              {/* <<< Added Website Input >>> */}
              <div className="mb-3">
                <label htmlFor="newShopWebsite" className="form-label">Website (Optional)</label>
                <input
                  type="url" // Use type="url" for websites
                  id="newShopWebsite"
                  className="form-control"
                  placeholder="e.g., https://www.example.com"
                  value={newShopWebsite}
                  onChange={(e) => setNewShopWebsite(e.target.value)}
                  disabled={addShopLoading}
                />
              </div>

              {/* Sales Channel Dropdown (Replaced Type Input) */}
               <div className="mb-3">
                 <label htmlFor="newShopSalesChannel" className="form-label">Sales channel</label>
                 <select
                   id="newShopSalesChannel"
                   className="form-select"
                   value={newShopType} // Still uses newShopType state
                   onChange={(e) => setNewShopType(e.target.value)}
                   disabled={addShopLoading}
                   required // Make selection required if needed
                 >
                   <option value="" disabled>-- Select --</option>
                   <option value="Offline">Offline</option>
                   <option value="Online">Online</option>
                   <option value="Offline & Online">Offline & Online</option>
                 </select>
               </div>

              {addShopError && <p className="error text-danger">Error: {addShopError}</p>}

              <button type="submit" className="btn btn-success" disabled={addShopLoading}>
                {addShopLoading ? 'Adding...' : 'Submit Location'}
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

export default Pilocations;