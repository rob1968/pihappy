import React, { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next'; // Import hook and Trans component
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import MainMenu from './MainMenu'; // <<< Import the MainMenu component
import './ProfilePage.css'; // We'll create this CSS file later

function ProfilePage() {
  const { t } = useTranslation(); // Get the translation function
  const { userId } = useParams(); // Get userId from URL parameter
  const navigate = useNavigate(); // Get navigate function
  const [profile, setProfile] = useState(null);
  const [userShops, setUserShops] = useState([]); // <<< State for user's shops
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingShops, setLoadingShops] = useState(false); // <<< State for loading shops
  const [error, setError] = useState(null); // General page loading errors
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFormData, setEditFormData] = useState({ naam: '', land: '', full_country_name: '', language: '' });
  const [editError, setEditError] = useState(null); // Profile editing specific errors
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [countries, setCountries] = useState([]); // State for country list

  // <<< State for editing shops >>>
  const [editingShopId, setEditingShopId] = useState(null); // ID of the shop being edited
  // <<< Add phone and website to edit state >>>
  const [editShopFormData, setEditShopFormData] = useState({ name: '', category: '', type: '', phone: '', website: '' });
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [editShopError, setEditShopError] = useState(null);
  const [availableCategories, setAvailableCategories] = useState([]); // For category dropdown in edit

  // <<< Function to fetch profile data >>>
  const fetchProfile = () => {
    setLoadingProfile(true); // Set loading true when fetching
    setError(null); // Clear previous errors
    const profileApiUrl = userId ? `/api/profile/${userId}` : '/api/profile';
    fetch(profileApiUrl, { credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          if (response.status === 401) {
             throw new Error(t('profile.errorNotLoggedIn'));
          }
          return response.json().then(errData => {
             throw new Error(errData.error || `HTTP error! status: ${response.status}`);
          }).catch(() => {
             throw new Error(`HTTP error! status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        setProfile(data);
        // Initialize edit form data only if not currently editing
        // This prevents overwriting user edits if a background fetch occurs
        if (!isEditingProfile) {
            setEditFormData({
                naam: data.naam || '',
                land: data.land || '',
                full_country_name: data.full_land_name || '',
                language: data.language || ''
            });
        }
        setError(null);
      })
      .catch(err => {
        console.error("Error fetching profile:", err);
        setError(err.message || t('profile.errorLoadFailed'));
        setProfile(null);
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  };

  // <<< Function to fetch user's shops >>>
  const fetchUserShops = () => {
    setLoadingShops(true);
    fetch('/api/profile/shops', { credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          // Don't throw critical error if shops fail, profile might still load
          console.error("Failed to fetch user shops:", response.statusText);
          return []; // Return empty array on error
        }
        return response.json();
      })
      .then(data => {
        setUserShops(data || []); // Set shops or empty array
      })
      .catch(err => {
        console.error("Error fetching user shops:", err);
        setUserShops([]); // Set empty array on error
      })
      .finally(() => {
        setLoadingShops(false);
      });
  };

  // Fetch profile data on initial load or when userId changes
  useEffect(() => {
    fetchProfile();
    fetchUserShops(); // <<< Fetch shops on load too
    // Dependency array is correct as fetchProfile/fetchUserShops don't change
  }, [userId]); // Depend only on userId (fetchProfile depends on it)

  // Fetch countries for the dropdown
  useEffect(() => {
    fetch("/api/landen")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch countries: ${res.status}`);
        return res.json();
       })
      .then((data) => {
        if (data && data.landen) {
          setCountries(data.landen);
        } else {
          console.error("Country data is not in the expected format:", data);
          setCountries([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching countries:", err);
        setError(prevError => prevError ? `${prevError}\n${t('profile.errorLoadCountriesFailed')}` : t('profile.errorLoadCountriesFailed'));
        setCountries([]);
      });
  }, []); // Fetch countries only once on mount

  // <<< Fetch available categories for shop editing >>>
  useEffect(() => {
    fetch('/api/categories', { credentials: 'include' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setAvailableCategories(data || []);
      })
      .catch(err => {
        console.error("Error fetching categories:", err);
        // Optionally set an error state for categories
      });
  }, []); // Fetch categories once on mount

  if (loadingProfile) {
    return <div className="profile-container"><p>{t('profile.loadingProfile')}</p></div>;
  }

  if (error && !profile) {
      return <div className="profile-container error"><p>{t('profile.errorPrefix')}: {error}</p></div>;
  }

  if (!profile) {
      return <div className="profile-container"><p>{t('profile.errorLoadProfileCheckLogin')}</p></div>;
  }

  // --- Edit Profile Handlers ---
  const handleProfileEditClick = () => {
    // Initialize form data with current profile values when edit starts
    setEditFormData({
      naam: profile?.naam || '',
      land: profile?.land || '',
      full_country_name: profile?.full_land_name || '',
      language: profile?.language || '',
    });
    setEditError(null);
    setIsEditingProfile(true);
  };

  const handleProfileCancelClick = () => {
    setIsEditingProfile(false);
    setEditError(null);
  };

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;

    if (name === 'land') {
      const selectedLandObject = countries.find(c => c.code.toLowerCase() === value);
      const fullCountryName = selectedLandObject ? selectedLandObject.naam : '';
      setEditFormData(prevData => ({
        ...prevData,
        land: value,
        full_country_name: fullCountryName
      }));
    } else {
      setEditFormData(prevData => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const handleProfileSaveClick = () => {
    setIsSavingProfile(true);
    setEditError(null);

    const dataToSave = {
        naam: editFormData.naam,
        land: editFormData.land,
        full_country_name: editFormData.full_country_name,
        language: editFormData.language,
    };

    if (dataToSave.land && dataToSave.land !== 'other' && !dataToSave.full_country_name) {
        setEditError(t('profile.errorEditCountryName'));
        setIsSavingProfile(false);
        return;
    }

    const profileApiUrl = userId ? `/api/profile/${userId}` : '/api/profile';
    fetch(profileApiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(dataToSave),
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errData => {
           throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      setIsEditingProfile(false); // Exit edit mode first
      fetchProfile(); // <<< Re-fetch profile data to get latest updates >>>
      // Optionally show a success message (could be state or just console log)
      console.log("Profile updated successfully", data);
    })
    .catch(err => {
      console.error("Error updating profile:", err);
      setEditError(err.message || t('profile.errorSaveProfileFailed'));
    })
    .finally(() => {
      setIsSavingProfile(false);
    });
  };

  // --- Logout Handler ---
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      if (response.ok) {
        window.location.href = '/';
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(t('profile.errorLogoutFailed', { message: errorData.message || response.statusText }));
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert(t('profile.errorLogoutGeneric'));
    }
  };

  // --- Edit Shop Handlers ---
  const handleShopEditClick = (shop) => {
    setEditingShopId(shop._id);
    // <<< Initialize phone and website in edit state >>>
    setEditShopFormData({
      name: shop.name || '',
      category: shop.category || '',
      type: shop.type || '', // Use 'type' for sales channel
      phone: shop.phone || '',
      website: shop.website || ''
    });
    setEditShopError(null);
  };

  const handleShopCancelClick = () => {
    setEditingShopId(null);
    setEditShopError(null);
  };

  const handleShopInputChange = (event) => {
    const { name, value } = event.target;
    setEditShopFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  const handleShopSaveClick = (shopId) => {
    setIsSavingShop(true);
    setEditShopError(null);

    // <<< Include phone and website in data to save >>>
    const dataToSave = {
        name: editShopFormData.name,
        category: editShopFormData.category,
        type: editShopFormData.type, // Sales channel
        phone: editShopFormData.phone,
        website: editShopFormData.website,
    };

    fetch(`/api/shops/${shopId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(dataToSave)
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(errData => {
           throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      setEditingShopId(null); // Exit edit mode
      fetchUserShops(); // Re-fetch shops to show updated data
      console.log("Shop updated successfully", data);
    })
    .catch(err => {
      console.error("Error updating shop:", err);
      setEditShopError(err.message || t('profile.errorSaveShopFailed'));
    })
    .finally(() => {
      setIsSavingShop(false);
    });
  };

  // --- Delete Shop Handler ---
  const handleShopDeleteClick = (shopId, shopName) => {
    if (window.confirm(t('profile.confirmDeleteShop', { name: shopName }))) {
      // Consider adding a loading state for delete if needed
      fetch(`/api/shops/${shopId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(errData => {
             throw new Error(errData.error || `HTTP error! status: ${response.status}`);
          });
        }
        // Handle potential 204 No Content response
        if (response.status === 204) {
            return { message: t('profile.shopDeletedSuccessMessage') }; // Simulate success data
        }
        return response.json();
      })
      .then(data => {
        console.log("Shop deleted successfully", data);
        fetchUserShops(); // Refresh the list after deletion
        // Optionally show a success message
        alert(t('profile.alertShopDeletedSuccess', { name: shopName }));
      })
      .catch(err => {
        console.error("Error deleting shop:", err);
        alert(t('profile.alertShopDeleteFailed', { message: err.message }));
      });
    }
  };


  // --- Helper: Map language code to full name ---
  const languageCodeToName = {
    "en": "English", "nl": "Dutch", "es": "Spanish", "de": "German",
    "fr": "French", "zh": "Chinese", "hi": "Hindi", "id": "Indonesian",
    "ur": "Urdu", "pt": "Portuguese", "bn": "Bengali", "ru": "Russian",
    "ja": "Japanese", "tl": "Tagalog", "vi": "Vietnamese", "am": "Amharic",
    "ar": "Arabic", "fa": "Persian", "tr": "Turkish", "ko": "Korean",
    "th": "Thai",
  };

  // --- Render Profile ---
  const displayCountryName = profile?.full_land_name || profile?.land || 'N/A';
  const displayLanguageName = languageCodeToName[profile?.language] || profile?.language || 'N/A';

  return (
    <> {/* Use Fragment to wrap Menu and container */}
      <MainMenu />
    <div className="profile-container container mt-4">
      <h1>{t('profile.pageTitle')}</h1>
      {error && <p className="error text-danger">{t('profile.errorLoadingData', { error: error })}</p>}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          {t('profile.userInfoHeader')}
          <div>
            {!isEditingProfile && (
              <button className="btn btn-sm btn-outline-secondary me-2" onClick={handleProfileEditClick}>{t('profile.editProfileButton')}</button>
            )}
            <button className="btn btn-sm btn-danger" onClick={handleLogout}>{t('profile.logoutButton')}</button>
          </div>
        </div>
        <div className="card-body">
          {editError && <p className="error text-danger">{t('profile.errorPrefix')}: {editError}</p>}
          {isEditingProfile ? (
            <>
              <div className="mb-3 row">
                <label htmlFor="editNaam" className="col-sm-2 col-form-label"><strong>{t('profile.nameLabel')}:</strong></label>
                <div className="col-sm-10">
                  <input
                    type="text"
                    className="form-control"
                    id="editNaam"
                    name="naam"
                    value={editFormData.naam}
                    onChange={handleProfileInputChange}
                  />
                </div>
              </div>
              <div className="mb-3 row">
                 <label className="col-sm-2 col-form-label"><strong>{t('profile.emailLabel')}:</strong></label>
                 <div className="col-sm-10">
                    <p className="form-control-plaintext">{profile.email || t('profile.notAvailable')} ({t('profile.emailCannotBeChanged')})</p>
                 </div>
              </div>
              <div className="mb-3 row">
                <label htmlFor="editLand" className="col-sm-2 col-form-label"><strong>{t('profile.countryLabel')}:</strong></label>
                <div className="col-sm-10">
                   <select
                     className="form-select"
                     id="editLand"
                     name="land"
                     value={editFormData.land}
                     onChange={handleProfileInputChange}
                     required
                   >
                     <option value="" disabled>{t('profile.selectCountryPlaceholder')}</option>
                     {countries.length > 0 ? (
                       countries.map((country) => (
                         <option key={country.code} value={country.code.toLowerCase()}>
                           {country.naam}
                         </option>
                       ))
                     ) : (
                       <option value="" disabled>{t('profile.loadingCountries')}</option>
                     )}
                     {/* <option value="other">Other</option> */}
                   </select>
                </div>
              </div>
              {/* Add Language Dropdown */}
              <div className="mb-3 row">
                <label htmlFor="editLanguage" className="col-sm-2 col-form-label"><strong>{t('profile.languageLabel')}:</strong></label>
                <div className="col-sm-10">
                   <select
                     className="form-select"
                     id="editLanguage"
                     name="language"
                     value={editFormData.language}
                     onChange={handleProfileInputChange}
                   >
                     <option value="" disabled>{t('profile.selectLanguagePlaceholder')}</option>
                     {Object.entries(languageCodeToName).map(([code, name]) => (
                       <option key={code} value={code}>
                         {name}
                       </option>
                     ))}
                   </select>
                </div>
              </div>
              <div className="d-flex justify-content-end">
                 <button className="btn btn-secondary me-2" onClick={handleProfileCancelClick} disabled={isSavingProfile}>{t('profile.cancelButton')}</button>
                 <button className="btn btn-primary" onClick={handleProfileSaveClick} disabled={isSavingProfile}>
                   {isSavingProfile ? t('profile.savingButton') : t('profile.saveChangesButton')}
                 </button>
              </div>
            </>
          ) : (
            <>
              <p><strong>{t('profile.nameLabel')}:</strong> {profile.naam || t('profile.notAvailable')}</p>
              <p><strong>{t('profile.emailLabel')}:</strong> {profile.email || t('profile.notAvailable')}</p>
              <p><strong>{t('profile.countryLabel')}:</strong> {displayCountryName}</p>
              <p><strong>{t('profile.languageLabel')}:</strong> {displayLanguageName}</p>
            </>
          )}
        </div>
      </div>

      {/* <<< Section for User's Shops >>> */}
      <div className="card mt-4">
        <div className="card-header">
          {t('profile.yourLocationsHeader')}
        </div>
        <div className="card-body">
          {loadingShops ? (
            <p>{t('profile.loadingLocations')}</p>
          ) : userShops.length > 0 ? (
            <ul className="list-group list-group-flush">
              {userShops.map(shop => (
                <li key={shop._id} className="list-group-item">
                  {editingShopId === shop._id ? (
                    // <<< Edit Form >>>
                    <div>
                      <div className="mb-2">
                        <label htmlFor={`editShopName-${shop._id}`} className="form-label form-label-sm">{t('profile.shopNameLabel')}:</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          id={`editShopName-${shop._id}`}
                          name="name"
                          value={editShopFormData.name}
                          onChange={handleShopInputChange}
                        />
                      </div>
                      <div className="mb-2">
                         <label htmlFor={`editShopCategory-${shop._id}`} className="form-label form-label-sm">{t('profile.shopCategoryLabel')}:</label>
                         <select
                           className="form-select form-select-sm"
                           id={`editShopCategory-${shop._id}`}
                           name="category"
                           value={editShopFormData.category}
                           onChange={handleShopInputChange}
                         >
                           <option value="" disabled>{t('profile.selectCategoryPlaceholder')}</option>
                           {availableCategories.map(cat => (
                             <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                           ))}
                         </select>
                      </div>
                      <div className="mb-2">
                         <label htmlFor={`editShopType-${shop._id}`} className="form-label form-label-sm">{t('profile.shopSalesChannelLabel')}:</label>
                         <select
                           className="form-select form-select-sm"
                           id={`editShopType-${shop._id}`}
                           name="type"
                           value={editShopFormData.type}
                           onChange={handleShopInputChange}
                         >
                           <option value="" disabled>{t('profile.selectChannelPlaceholder')}</option>
                           <option value="Offline">{t('profile.salesChannelOffline')}</option>
                           <option value="Online">{t('profile.salesChannelOnline')}</option>
                           <option value="Offline & Online">{t('profile.salesChannelBoth')}</option>
                         </select>
                      </div>
                      {/* <<< Add Phone Input >>> */}
                      <div className="mb-2">
                        <label htmlFor={`editShopPhone-${shop._id}`} className="form-label form-label-sm">{t('profile.shopPhoneLabel')}:</label>
                        <input
                          type="tel" // Use tel type for phone numbers
                          className="form-control form-control-sm"
                          id={`editShopPhone-${shop._id}`}
                          name="phone"
                          value={editShopFormData.phone}
                          onChange={handleShopInputChange}
                          placeholder={t('profile.optionalPlaceholder')}
                        />
                      </div>
                      {/* <<< Add Website Input >>> */}
                      <div className="mb-2">
                        <label htmlFor={`editShopWebsite-${shop._id}`} className="form-label form-label-sm">{t('profile.shopWebsiteLabel')}:</label>
                        <input
                          type="url" // Use url type for websites
                          className="form-control form-control-sm"
                          id={`editShopWebsite-${shop._id}`}
                          name="website"
                          value={editShopFormData.website}
                          onChange={handleShopInputChange}
                          placeholder={t('profile.optionalWebsitePlaceholder')}
                        />
                      </div>
                      <div className="mt-2">
                        <button className="btn btn-sm btn-success me-2" onClick={() => handleShopSaveClick(shop._id)} disabled={isSavingShop}>
                          {isSavingShop ? t('profile.savingButton') : t('profile.saveButton')}
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={handleShopCancelClick} disabled={isSavingShop}>{t('profile.cancelButton')}</button>
                      </div>
                      {editShopError && editingShopId === shop._id && <p className="error text-danger small mt-1">{editShopError}</p>}
                    </div>
                  ) : (
                    // <<< Display Mode >>>
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>{shop.name}</strong><br />
                        <small className="text-muted">{shop.location}</small><br/>
                        <small>{t('profile.shopCategoryLabel')}: {shop.category || t('profile.notAvailable')} | {t('profile.shopSalesChannelLabel')}: {shop.type || t('profile.notAvailable')}</small><br/>
                        {shop.phone && <small>{t('profile.shopPhoneLabel')}: {shop.phone} | </small>}
                        {shop.website && <small><Trans i18nKey="profile.shopWebsiteDisplayLabel">Website: <a href={shop.website} target="_blank" rel="noopener noreferrer">{{website: shop.website}}</a></Trans></small>}
                      </div>
                      <div> {/* Wrap buttons */}
                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleShopEditClick(shop)}>{t('profile.editButton')}</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleShopDeleteClick(shop._id, shop.name)}>{t('profile.deleteButton')}</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>{t('profile.noLocationsAdded')}</p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

export default ProfilePage;