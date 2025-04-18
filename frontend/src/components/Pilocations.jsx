import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation, Trans } from 'react-i18next'; // Import hooks and Trans component
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
  const { t } = useTranslation(); // Get the translation function
  const [winkels, setWinkels] = useState([]);
  const [filteredWinkels, setFilteredWinkels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSalesChannel, setSelectedSalesChannel] = useState('all'); // <<< State for sales channel filter
  const [selectedWinkel, setSelectedWinkel] = useState(null); // Keep this for InfoWindow
  const [map, setMap] = useState(null);
  const [error, setError] = useState(null); // For map loading errors
  const [loading, setLoading] = useState(true); // For map data loading
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
  const [paymentAmount, setPaymentAmount] = useState("1.0"); // Example state for amount
  const [paymentStatus, setPaymentStatus] = useState(''); // To show feedback during payment

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

  // Define the fixed category list
  const shopCategories = [
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
  ].sort();

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
        setAddShopError(t('pilocations.errorNoCoords'));
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
      setAddShopError(err.message || t('pilocations.errorAddShopFailed'));
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


  // --- Pi Payment Handling ---
  const handlePayWithPi = async (shop) => {
      setPaymentStatus(`Initiating payment for ${shop.name}...`);
      console.log(`Initiating payment for shop ${shop._id} with amount ${paymentAmount}`);

      try {
          // 1. Call backend to create payment details
          const createResponse = await fetch('/api/payments/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  itemId: shop._id, // Use shop ID as item ID for this example
                  amount: paymentAmount // Get amount from state
              }),
              credentials: 'include'
          });

          if (!createResponse.ok) {
              const errorData = await createResponse.json().catch(() => ({}));
              throw new Error(errorData.error || `Failed to create payment details: ${createResponse.statusText}`);
          }

          const paymentData = await createResponse.json();
          console.log("Received payment data from backend:", paymentData);

          // 2. Define Pi SDK Callbacks
          const callbacks = {
              onReadyForServerApproval: async (paymentId) => {
                  console.log("onReadyForServerApproval", paymentId);
                  setPaymentStatus(`Approving payment ${paymentId} on server...`);
                  try {
                      const approveResponse = await fetch(`/api/payments/approve/${paymentId}`, {
                          method: 'POST',
                          credentials: 'include' // Send cookies if needed for session auth
                      });
                      const approveData = await approveResponse.json();
                      if (!approveResponse.ok) {
                          throw new Error(approveData.error || `Server approval failed: ${approveResponse.statusText}`);
                      }
                      console.log("Server approval successful:", approveData);
                      setPaymentStatus(`Payment ${paymentId} approved by server.`);
                      // Pi SDK proceeds automatically after this callback returns successfully
                  } catch (err) {
                      console.error("Error calling /approve endpoint:", err);
                      const errorMsg = `Server approval failed: ${err.message}`;
                      setPaymentStatus(errorMsg);
                      alert(errorMsg); // Notify user
                      // Note: Pi SDK might not provide a way to explicitly cancel here if server fails.
                      // Consider if you need to throw the error to potentially stop the Pi flow if possible.
                  }
              },
              onReadyForServerCompletion: async (paymentId, txid) => {
                  console.log("onReadyForServerCompletion", paymentId, txid);
                  setPaymentStatus(`Completing payment ${paymentId} on server (TxID: ${txid})...`);
                  try {
                      const completeResponse = await fetch(`/api/payments/complete/${paymentId}`, {
                          method: 'POST',
                          headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({ txid }),
                          credentials: 'include' // Send cookies if needed for session auth
                      });
                      const completeData = await completeResponse.json();
                       if (!completeResponse.ok) {
                          throw new Error(completeData.error || `Server completion failed: ${completeResponse.statusText}`);
                      }
                      console.log("Server completion successful:", completeData);
                      const successMsg = `Payment ${paymentId} completed successfully! TxID: ${txid}`;
                      setPaymentStatus(successMsg);
                      alert(successMsg); // Notify user of final success
                      // TODO: Maybe refresh user balance or order status here by triggering a state update or refetch
                  } catch (err) {
                      console.error("Error calling /complete endpoint:", err);
                      const errorMsg = `Server completion failed: ${err.message}. Please contact support if payment was deducted.`;
                      setPaymentStatus(errorMsg);
                      alert(errorMsg); // Notify user
                      // TODO: Implement reconciliation logic if completion fails server-side
                  }
              },
              onCancel: (paymentId) => {
                  console.log("onCancel", paymentId);
                  setPaymentStatus(`Payment ${paymentId} cancelled.`);
                  alert(`Payment cancelled by user (Payment ID: ${paymentId})`);
              },
              onError: (error, payment) => {
                  console.error("onError", error, payment);
                  setPaymentStatus(`Payment error: ${error.message || 'Unknown error'}`);
                  alert(`Pi SDK Error during payment: ${error.message || 'Unknown error'}`);
              },
          };

          // 3. Call Pi.createPayment
          setPaymentStatus('Waiting for Pi Network confirmation...');
          // --- Call Pi SDK ---
          // Store the orderId before calling createPayment
          const orderId = paymentData.metadata.orderId;
          const payment = await window.Pi.createPayment(paymentData, callbacks);
          // --- Pi SDK call finished (or Pi App took over) ---
          console.log("Pi.createPayment call finished/returned:", payment);

          // --- Associate Pi Payment ID with Order ID ---
          // Check if we have the Pi paymentId from the result and the orderId
          if (payment && payment.identifier && orderId) {
               console.log(`Associating order ${orderId} with Pi payment ${payment.identifier}`);
               try {
                   const assocResponse = await fetch(`/api/payments/associate/${orderId}`, {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({ paymentId: payment.identifier }),
                       credentials: 'include'
                   });
                   if (!assocResponse.ok) {
                       const assocError = await assocResponse.json().catch(() => ({}));
                       console.error(`Failed to associate payment IDs: ${assocError.error || assocResponse.statusText}`);
                       setPaymentStatus(`Payment initiated, but association failed (Order: ${orderId}, Pi ID: ${payment.identifier})`);
                   } else {
                       console.log(`Successfully associated order ${orderId} with Pi payment ${payment.identifier}`);
                   }
               } catch (assocErr) {
                    console.error("Network error during payment ID association:", assocErr);
                    setPaymentStatus(`Payment initiated, network error during association (Order: ${orderId}, Pi ID: ${payment.identifier})`);
               }
          } else {
               console.warn(`Pi payment ID or Order ID not available after createPayment. Association skipped. Payment: ${JSON.stringify(payment)}, OrderID: ${orderId}`);
          }
          // Note: Status might already be updated by callbacks by this point

      } catch (error) {
          console.error("Error in handlePayWithPi:", error);
          setPaymentStatus(`Error: ${error.message}`);
          alert(`Error preparing payment: ${error.message}`); // Keep alert for preparation errors
      }
  };
  // --- End Pi Payment Handling ---


  if (!MAP_API_KEY) {
    return <div className="pilocations-container error">{t('pilocations.errorApiKeyMissing')}</div>;
  }

  // Use initialMapCenter state for loading check too
  if (loading || !mapCenter) { // <<< Wait for mapCenter
    return <div className="pilocations-container"><p style={{ textAlign: 'center', marginTop: '20px' }}>{t('pilocations.loadingMapData')}</p></div>;
  }

  if (error) {
      return <div className="pilocations-container"><p className="error">{t('pilocations.mapError', { error: error })}</p></div>;
  }

  return (
    <div className="pilocations-container">
      {/* Render the MainMenu component */}
      <MainMenu />
      <h1>{t('pilocations.pageTitle')}</h1>

      {/* Map Container */}
      <div className="map-container">
        <LoadScript googleMapsApiKey={MAP_API_KEY} libraries={LIBRARIES}>
          <>
            <div className="controls">
              <label htmlFor="category-filter">{t('pilocations.categoryFilterLabel')}:</label>
              <select id="category-filter" className="form-select form-select-sm" value={selectedCategory} onChange={handleCategoryChange}>
                <option value="all">{t('pilocations.filterAll')}</option>
                {shopCategories.map(category => (
                  <option key={category} value={category}>
                    {category} {/* Use the category name directly */}
                  </option>
                ))}
              </select>

              {/* <<< Added Sales Channel Filter >>> */}
              <label htmlFor="sales-channel-filter" style={{ marginLeft: '10px' }}>{t('pilocations.salesChannelFilterLabel')}:</label>
              <select
                id="sales-channel-filter"
                className="form-select form-select-sm"
                value={selectedSalesChannel}
                onChange={(e) => setSelectedSalesChannel(e.target.value)}
              >
                <option value="all">{t('pilocations.filterAll')}</option>
                <option value="Offline">{t('pilocations.salesChannelOffline')}</option>
                <option value="Online">{t('pilocations.salesChannelOnline')}</option>
                <option value="Offline & Online">{t('pilocations.salesChannelBoth')}</option>
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
                    title={shop.name || t('pilocations.nameUnknown')}
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
                    <h3>{selectedWinkel.name || t('pilocations.nameUnknown')}</h3>
                    <p>{selectedWinkel.location || t('pilocations.locationUnknown')}</p>
                    <p>{t('pilocations.infoWindowCategoryLabel')}: {selectedWinkel.category || t('pilocations.categoryUnknown')}</p>
                    {selectedWinkel.phone && (
                      <p>{t('pilocations.infoWindowPhoneLabel')}: {selectedWinkel.phone}</p>
                    )}
                    {selectedWinkel.website && (
                      <p>
                        <Trans i18nKey="pilocations.infoWindowWebsiteLabel">
                          Website: <a href={selectedWinkel.website} target="_blank" rel="noopener noreferrer">{{website: selectedWinkel.website}}</a>
                        </Trans>
                      </p>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWinkel.latitude},${selectedWinkel.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('pilocations.planRouteLink')}
                    </a>
                    {/* --- Pi Payment Section (Conditional) --- */}
                    {window.Pi && ( // Only render if Pi SDK is loaded
                      <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                          <label htmlFor={`pay-amount-${selectedWinkel._id}`} style={{ marginRight: '5px' }}>Amount (π):</label>
                          <input
                              type="number"
                              id={`pay-amount-${selectedWinkel._id}`}
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              min="0.0000001" // Minimum Pi amount
                              step="0.0000001" // Step for Pi decimals
                              style={{ width: '80px', marginRight: '10px' }}
                          />
                          <button
                              onClick={() => handlePayWithPi(selectedWinkel)}
                              className="btn btn-sm btn-success"
                              disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                          >
                              {t('pilocations.payButton', { amount: paymentAmount })}
                          </button>
                          {paymentStatus && <p style={{ fontSize: '0.8em', marginTop: '5px', color: 'blue' }}>{paymentStatus}</p>}
                      </div>
                    )}
                    {/* --- End Pi Payment Section --- */}
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
          {showAddShopForm ? t('pilocations.cancelAddButton') : t('pilocations.addLocationButton')}
        </button>

        {showAddShopForm && (
          <div className="add-shop-form card mb-4 p-3">
            <h2>{t('pilocations.addFormTitle')}</h2>
            <form onSubmit={handleAddShopSubmit}>

              {/* Location Autocomplete (Moved to top) */}
              <div className="mb-3">
                <label htmlFor="newShopLocation" className="form-label">{t('pilocations.addFormLocationLabel')} *</label>
                <Autocomplete onLoad={onAutocompleteLoad} onPlaceChanged={onPlaceChanged}>
                  <input
                    type="text"
                    id="newShopLocation"
                    className="form-control"
                    placeholder={t('pilocations.addFormLocationPlaceholder')}
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
                <label htmlFor="newShopName" className="form-label">{t('pilocations.addFormCompanyLabel')} *</label>
                <input
                  type="text"
                  id="newShopName"
                  className="form-control"
                  placeholder={t('pilocations.addFormCompanyPlaceholder')}
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
                 <label htmlFor="newShopCategory" className="form-label">{t('pilocations.addFormCategoryLabel')} *</label>
                 <select id="newShopCategory" className="form-select" value={newShopCategory} onChange={(e) => setNewShopCategory(e.target.value)} required disabled={addShopLoading}>
                   <option value="" disabled>{t('pilocations.addFormSelectCategoryPlaceholder')}</option>
                   {shopCategories.map(category => (
                     <option key={category} value={category}>
                       {category} {/* Use the category name directly */}
                     </option>
                   ))}
                 </select>
              </div>

              {/* <<< Added Phone Input >>> */}
              <div className="mb-3">
                <label htmlFor="newShopPhone" className="form-label">{t('pilocations.addFormPhoneLabel')}</label>
                <input
                  type="tel" // Use type="tel" for phone numbers
                  id="newShopPhone"
                  className="form-control"
                  placeholder={t('pilocations.addFormPhonePlaceholder')}
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  disabled={addShopLoading}
                />
              </div>

              {/* <<< Added Website Input >>> */}
              <div className="mb-3">
                <label htmlFor="newShopWebsite" className="form-label">{t('pilocations.addFormWebsiteLabel')}</label>
                <input
                  type="url" // Use type="url" for websites
                  id="newShopWebsite"
                  className="form-control"
                  placeholder={t('pilocations.addFormWebsitePlaceholder')}
                  value={newShopWebsite}
                  onChange={(e) => setNewShopWebsite(e.target.value)}
                  disabled={addShopLoading}
                />
              </div>

              {/* Sales Channel Dropdown (Replaced Type Input) */}
               <div className="mb-3">
                 <label htmlFor="newShopSalesChannel" className="form-label">{t('pilocations.addFormSalesChannelLabel')}</label>
                 <select
                   id="newShopSalesChannel"
                   className="form-select"
                   value={newShopType} // Still uses newShopType state
                   onChange={(e) => setNewShopType(e.target.value)}
                   disabled={addShopLoading}
                   required // Make selection required if needed
                 >
                   <option value="" disabled>{t('pilocations.addFormSelectPlaceholder')}</option>
                   <option value="Offline">{t('pilocations.salesChannelOffline')}</option>
                   <option value="Online">{t('pilocations.salesChannelOnline')}</option>
                   <option value="Offline & Online">{t('pilocations.salesChannelBoth')}</option>
                 </select>
               </div>

              {addShopError && <p className="error text-danger">{t('pilocations.addFormErrorPrefix')}: {addShopError}</p>}

              <button type="submit" className="btn btn-success" disabled={addShopLoading}>
                {addShopLoading ? t('pilocations.addFormAddingButton') : t('pilocations.addFormSubmitButton')}
              </button>
            </form>
          </div>
        )}
      </div>

    </div>
  );
}

export default Pilocations;