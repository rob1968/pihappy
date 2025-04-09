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

  // Fetch winkels data
  useEffect(() => {
    setLoading(true);
    fetch('/api/winkels') // Assumes proxy or CORS is set up
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        // Filter out winkels without valid coordinates early
        const validWinkels = data.filter(winkel =>
          winkel.google_data &&
          typeof winkel.google_data.latitude === 'number' &&
          typeof winkel.google_data.longitude === 'number'
        );
        setWinkels(validWinkels);
        setError(null);
      })
      .catch(err => {
        console.error("Fout bij laden van winkels:", err);
        setError("Kon winkels niet laden. Probeer het later opnieuw.");
        setWinkels([]); // Clear winkels on error
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Filter winkels when category or winkels list changes
  useEffect(() => {
    if (selectedCategory === 'all') {
      setFilteredWinkels(winkels);
    } else {
      setFilteredWinkels(winkels.filter(w => w.categorie === selectedCategory));
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
            {map && !loading && filteredWinkels.map((winkel) => {
              const gd = winkel.google_data;
              const position = { lat: gd.latitude, lng: gd.longitude };

              // Ensure window.google.maps is available before using it
              const iconSize = window.google && window.google.maps ? new window.google.maps.Size(40, 40) : undefined;

              return (
                <Marker
                  key={winkel.id || `${gd.latitude}-${gd.longitude}`} // Use a stable key
                  position={position}
                  title={winkel.winkelnaam || 'Naam onbekend'}
                  icon={iconSize ? { url: ICON_URL, scaledSize: iconSize } : undefined} // Use iconSize if available
                  onClick={() => handleMarkerClick(winkel)}
                />
              );
            })}

            {/* Render InfoWindow only when map is loaded and a winkel is selected */}
            {map && selectedWinkel && (
              <InfoWindow
                position={{ lat: selectedWinkel.google_data.latitude, lng: selectedWinkel.google_data.longitude }}
                onCloseClick={handleInfoWindowClose}
              >
                <div className="info-window-content">
                  <h3>{selectedWinkel.winkelnaam || "Naam onbekend"}</h3>
                  <p>{selectedWinkel.google_data.adres || "Adres onbekend"}</p>
                  <p>Categorie: {selectedWinkel.categorie || "Onbekend"}</p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWinkel.google_data.latitude},${selectedWinkel.google_data.longitude}`}
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
      </LoadScript>
    </div>
  );
}

export default Pilocations;