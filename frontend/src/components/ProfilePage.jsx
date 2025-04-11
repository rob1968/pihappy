import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // Import useParams and useNavigate
import './ProfilePage.css'; // We'll create this CSS file later

function ProfilePage() {
  const { userId } = useParams(); // Get userId from URL parameter
  const navigate = useNavigate(); // Get navigate function
  const [profile, setProfile] = useState(null);
  // Removed shops state
  const [loadingProfile, setLoadingProfile] = useState(true);
  // Removed loadingShops state
  const [error, setError] = useState(null); // General page loading errors
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  // <<< MODIFIED: Add full_country_name to edit form state >>>
  const [editFormData, setEditFormData] = useState({ naam: '', land: '', full_country_name: '', language: '' });
  const [editError, setEditError] = useState(null); // Profile editing specific errors
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [countries, setCountries] = useState([]); // State for country list

  // Fetch profile data
  useEffect(() => {
    setLoadingProfile(true);
    const profileApiUrl = userId ? `/api/profile/${userId}` : '/api/profile';
    fetch(profileApiUrl, { credentials: 'include' }) // <<< Added credentials
      .then(response => {
        if (!response.ok) {
          if (response.status === 401) {
             throw new Error('Not logged in. Please log in to view your profile.');
          }
          // Try to get error message from backend
          return response.json().then(errData => {
             throw new Error(errData.error || `HTTP error! status: ${response.status}`);
          }).catch(() => { // Fallback if response is not JSON
             throw new Error(`HTTP error! status: ${response.status}`);
          });
        }
        return response.json();
      })
      .then(data => {
        setProfile(data);
        // Initialize edit form data when profile loads
        // <<< MODIFIED: Initialize full_country_name as well >>>
        setEditFormData({
            naam: data.naam || '',
            land: data.land || '',
            full_country_name: data.full_land_name || '', // Use full name from profile if available
            language: data.language || ''
        });
        setError(null);
      })
      .catch(err => {
        console.error("Error fetching profile:", err);
        setError(err.message || 'Failed to load profile data.');
        setProfile(null);
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, [userId]);

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
        setError(prevError => prevError ? `${prevError}\nFailed to load country list.` : 'Failed to load country list.');
        setCountries([]);
      });
  }, []);

  if (loadingProfile) {
    return <div className="profile-container"><p>Loading profile...</p></div>;
  }

  if (error && !profile) {
      return <div className="profile-container error"><p>Error: {error}</p></div>;
  }

  if (!profile) {
      return <div className="profile-container"><p>Could not load profile. Are you logged in?</p></div>;
  }

  // --- Edit Profile Handlers ---
  const handleProfileEditClick = () => {
    // Re-initialize form data with current profile values when edit starts
    setEditFormData({
      naam: profile?.naam || '',
      land: profile?.land || '',
      full_country_name: profile?.full_land_name || '', // <<< Initialize full name
      language: profile?.language || '',
    });
    setEditError(null);
    setIsEditingProfile(true);
  };

  const handleProfileCancelClick = () => {
    setIsEditingProfile(false);
    setEditError(null);
  };

  // <<< MODIFIED: handleProfileInputChange to handle country selection specifically >>>
  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;

    if (name === 'land') {
      // If country code changes, find the full name and update both states
      const selectedLandObject = countries.find(c => c.code.toLowerCase() === value);
      const fullCountryName = selectedLandObject ? selectedLandObject.naam : '';
      setEditFormData(prevData => ({
        ...prevData,
        land: value, // Update the code
        full_country_name: fullCountryName // Update the full name
      }));
    } else {
      // For other fields, update normally
      setEditFormData(prevData => ({
        ...prevData,
        [name]: value,
      }));
    }
  };

  const handleProfileSaveClick = () => {
    setIsSavingProfile(true);
    setEditError(null);

    // <<< MODIFIED: Include full_country_name in dataToSave >>>
    const dataToSave = {
        naam: editFormData.naam,
        land: editFormData.land,
        full_country_name: editFormData.full_country_name, // Send full name
        language: editFormData.language,
    };

    // Validate that full_country_name is not empty if land is set (unless land is 'other')
    if (dataToSave.land && dataToSave.land !== 'other' && !dataToSave.full_country_name) {
        setEditError("Could not determine full country name for the selected code. Please re-select the country.");
        setIsSavingProfile(false);
        return;
    }

    const profileApiUrl = userId ? `/api/profile/${userId}` : '/api/profile';
    fetch(profileApiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // <<< Added credentials
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
      // <<< MODIFIED: Update profile state with the full user object returned >>>
      // Assuming the backend returns the updated user object under the 'user' key
      if (data.user) {
          setProfile(data.user);
      } else {
          // Fallback: manually update fields if backend response format differs
          setProfile(prevProfile => ({
              ...prevProfile,
              ...dataToSave // Update with saved data (might miss backend-derived fields)
          }));
          console.warn("Backend did not return updated user object under 'user' key. Manually updating state.");
      }
      setIsEditingProfile(false);
    })
    .catch(err => {
      console.error("Error updating profile:", err);
      setEditError(err.message || 'Failed to save profile.');
    })
    .finally(() => {
      setIsSavingProfile(false);
    });
  };

  // --- Logout Handler ---
  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST', credentials: 'include' }); // <<< Added credentials
      if (response.ok) {
        window.location.href = '/';
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(`Logout failed: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('An error occurred during logout. Please try again.');
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
  // <<< MODIFIED: Use full_land_name from profile state if available >>>
  const displayCountryName = profile?.full_land_name || profile?.land || 'N/A';
  const displayLanguageName = languageCodeToName[profile?.language] || profile?.language || 'N/A';

  return (
    <div className="profile-container container mt-4">
      <h1>Your Profile</h1>
      {error && <p className="error text-danger">Error loading profile data: {error}</p>}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          User Information
          <div>
            {!isEditingProfile && (
              <button className="btn btn-sm btn-outline-secondary me-2" onClick={handleProfileEditClick}>Edit Profile</button>
            )}
            <button className="btn btn-sm btn-danger" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        <div className="card-body">
          {editError && <p className="error text-danger">Error: {editError}</p>}
          {isEditingProfile ? (
            <>
              <div className="mb-3 row">
                <label htmlFor="editNaam" className="col-sm-2 col-form-label"><strong>Name:</strong></label>
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
                 <label className="col-sm-2 col-form-label"><strong>Email:</strong></label>
                 <div className="col-sm-10">
                    <p className="form-control-plaintext">{profile.email || 'N/A'} (Cannot be changed)</p>
                 </div>
              </div>
              <div className="mb-3 row">
                <label htmlFor="editLand" className="col-sm-2 col-form-label"><strong>Country:</strong></label>
                <div className="col-sm-10">
                   <select
                     className="form-select"
                     id="editLand"
                     name="land" // Name corresponds to the key in editFormData for the CODE
                     value={editFormData.land} // Value is the country CODE
                     onChange={handleProfileInputChange} // Use the modified handler
                     required
                   >
                     <option value="" disabled>Select a country...</option>
                     {countries.length > 0 ? (
                       countries.map((country) => (
                         <option key={country.code} value={country.code.toLowerCase()}>
                           {country.naam} {/* Display country name */}
                         </option>
                       ))
                     ) : (
                       <option value="" disabled>Loading countries...</option>
                     )}
                     {/* <option value="other">Other</option> */}
                   </select>
                </div>
              </div>
              {/* Add Language Dropdown */}
              <div className="mb-3 row">
                <label htmlFor="editLanguage" className="col-sm-2 col-form-label"><strong>Language:</strong></label>
                <div className="col-sm-10">
                   <select
                     className="form-select"
                     id="editLanguage"
                     name="language"
                     value={editFormData.language}
                     onChange={handleProfileInputChange}
                   >
                     <option value="" disabled>Select a language...</option>
                     {Object.entries(languageCodeToName).map(([code, name]) => (
                       <option key={code} value={code}>
                         {name}
                       </option>
                     ))}
                   </select>
                </div>
              </div>
              <div className="d-flex justify-content-end">
                 <button className="btn btn-secondary me-2" onClick={handleProfileCancelClick} disabled={isSavingProfile}>Cancel</button>
                 <button className="btn btn-primary" onClick={handleProfileSaveClick} disabled={isSavingProfile}>
                   {isSavingProfile ? 'Saving...' : 'Save Changes'}
                 </button>
              </div>
            </>
          ) : (
            <>
              <p><strong>Name:</strong> {profile.naam || 'N/A'}</p>
              <p><strong>Email:</strong> {profile.email || 'N/A'}</p>
              {/* <<< MODIFIED: Display full name if available >>> */}
              <p><strong>Country:</strong> {displayCountryName}</p>
              <p><strong>Preferred Language:</strong> {displayLanguageName}</p>
            </>
          )}
        </div>
      </div>

 {/* Removed the entire "Your Shops" section */}
 </div>
  );
}

export default ProfilePage;