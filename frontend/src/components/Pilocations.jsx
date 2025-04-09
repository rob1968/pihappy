import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import './Pilocations.css'; // Import the CSS

const MAP_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAP_CENTER = { lat: 52.3676, lng: 4.9041 }; // Amsterdam center
const ICON_URL = "https://www.pihappy.me/picoin.png";

const containerStyle = {
  width: '100%',
  height: '100%'
};

function Pilocations() {
  const [winkels, setWinkels] = useState([]);
  const [filteredWinkels, setFilteredWinkels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedWinkel, setSelectedWinkel] = useState(null);
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const mapRef = useRef(); // To store map instance

  const onLoad = useCallback(function callback(mapInstance) {
    mapRef.current = mapInstance; // Store the map instance
    setMap(mapInstance); // Also set state if needed elsewhere, though ref is often sufficient
    // You could potentially set bounds here after markers load if needed
  }, []);

  const onUnmount = useCallback(function callback(map) {
    mapRef.current = null;
    setMap(null);
  }, []);

  // Fetch shops data
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
        setWinkels(validShops); // Use the filtered shop data (state name is still 'winkels')
        setError(null);
      })
      .catch(err => {
        console.error("Fout bij laden van shops:", err); // Updated error message
        setError("Kon shops niet laden. Probeer het later opnieuw."); // Updated error message
        setWinkels([]); // Clear shops on error
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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

  const handleCategoryChange = (event) => {
    setSelectedCategory(event.target.value);
  };

  const handleMarkerClick = (winkel) => {
    setSelectedWinkel(winkel);
  };

  const handleInfoWindowClose = () => {
    setSelectedWinkel(null);
  };

  if (!MAP_API_KEY) {
    return <div className="pilocations-container error">Google Maps API Key is missing. Please configure REACT_APP_GOOGLE_MAPS_API_KEY.</div>;
  }

  return (
    <div className="pilocations-container">
      <h1>Pi Coin Accepted Locations</h1>
      {error && <p className="error">{error}</p>}
      <LoadScript googleMapsApiKey={MAP_API_KEY}>
        <div className="map-container">
          <div className="controls">
            <label htmlFor="category-filter">Filter op categorie:</label>
            <select id="category-filter" value={selectedCategory} onChange={handleCategoryChange}>
              <option value="all">Alle</option>
              <option value="restaurant">Restaurants</option>
              <option value="electronics">Elektronica</option>
              <option value="supermarket">Supermarkten</option>
              <option value="clothing">Kleding</option>
              {/* Add more categories if needed */}
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
                  <p>{selectedWinkel.location || "Locatie onbekend"}</p> {/* Use location */}
                  <p>Categorie: {selectedWinkel.category || "Onbekend"}</p> {/* Use category */}
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWinkel.latitude},${selectedWinkel.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Route plannen (vereist coördinaten)
                  </a>
                </div>
              </InfoWindow>
            )}

            {/* Optional: Display loading messages */}
            {!map && <p style={{ textAlign: 'center', marginTop: '20px' }}>Loading Google Maps...</p>}
            {map && loading && <p style={{ textAlign: 'center', marginTop: '20px' }}>Loading shop data...</p>}

          </GoogleMap>
        </div>
      </LoadScript>
    </div>
  );
}

export default Pilocations;