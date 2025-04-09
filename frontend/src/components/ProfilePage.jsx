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
  const [editFormData, setEditFormData] = useState({ naam: '', land: '' });
  const [editError, setEditError] = useState(null); // Profile editing specific errors
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Fetch profile data
  useEffect(() => {
    setLoadingProfile(true);
    // Determine the API endpoint based on whether userId is present
    const profileApiUrl = userId ? `/api/profile/${userId}` : '/api/profile';
    fetch(profileApiUrl) // Use the determined URL
      .then(response => {
        if (!response.ok) {
          if (response.status === 401) {
             throw new Error('Not logged in. Please log in to view your profile.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        setProfile(data);
        // Initialize edit form data when profile loads (or resets if needed)
        setEditFormData({ naam: data.naam || '', land: data.land || '' });
        setError(null);
      })
      .catch(err => {
        console.error("Error fetching profile:", err);
        setError(err.message || 'Failed to load profile data.');
        setProfile(null); // Clear profile on error
      })
      .finally(() => {
        setLoadingProfile(false);
      });
  }, [userId]); // Re-fetch if userId changes (or if it becomes present/absent)

  // Removed useEffect hook for fetching shops

  if (loadingProfile) {
    return <div className="profile-container"><p>Loading profile...</p></div>;
  }

  if (error && !profile) {
      // If there was an error loading the profile itself (e.g., not logged in)
      return <div className="profile-container error"><p>Error: {error}</p></div>;
  }

  if (!profile) {
      // Should ideally be caught by the error above, but as a fallback
      return <div className="profile-container"><p>Could not load profile. Are you logged in?</p></div>;
  }

  // --- Edit Profile Handlers ---
  const handleProfileEditClick = () => {
    // Initialize form data with current profile values
    setEditFormData({
      naam: profile?.naam || '',
      land: profile?.land || '',
      // Add other fields from profile if they become editable
    });
    setEditError(null); // Clear previous edit errors
    setIsEditingProfile(true);
  };

  const handleProfileCancelClick = () => {
    setIsEditingProfile(false);
    setEditError(null); // Clear edit errors on cancel
    // Optionally reset editFormData if needed, but it will re-init on next edit click
  };

  const handleProfileInputChange = (event) => {
    const { name, value } = event.target;
    setEditFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleProfileSaveClick = () => {
    setIsSavingProfile(true);
    setEditError(null);

    // Only send fields that are actually editable (e.g., naam, land)
    const dataToSave = {
        naam: editFormData.naam,
        land: editFormData.land,
    };

    // Update profile - NOTE: This PUT request might need adjustment
    // It currently updates the logged-in user's profile.
    // If you want to allow editing other profiles (admin?), this needs more logic.
    // For now, it assumes you can only edit your own profile, which might
    // conflict if viewing another user's page via /profile/:userId.
    // A check comparing `userId` from params with logged-in user's ID is needed
    // before enabling/allowing the save.
    // Use the same logic as GET to determine the correct endpoint for PUT
    const profileApiUrl = userId ? `/api/profile/${userId}` : '/api/profile';
    fetch(profileApiUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dataToSave),
    })
    .then(response => {
      if (!response.ok) {
        // Attempt to read error message from backend
        return response.json().then(errData => {
           throw new Error(errData.error || `HTTP error! status: ${response.status}`);
        });
      }
      return response.json();
    })
    .then(data => {
      setProfile(data.user); // Update profile state with the response
      setIsEditingProfile(false); // Exit edit mode
      // Optionally show a success message
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
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        // Redirect to the root page after successful logout.
        // HomePageWrapper will then show WelcomePage because the session is cleared.
        // Use full page reload to ensure state is cleared.
        window.location.href = '/';
      } else {
        // Handle logout error (e.g., show message)
        const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty object
        alert(`Logout failed: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Logout error:', error);
      alert('An error occurred during logout. Please try again.');
    }
  };

  // --- Render Profile ---
  return (
    <div className="profile-container container mt-4">
      <h1>Your Profile</h1>
      {error && <p className="error text-danger">Error loading profile data: {error}</p>} {/* Updated error message */}

      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          User Information
          <div> {/* Use a div to group buttons */}
            {!isEditingProfile && (
              <button className="btn btn-sm btn-outline-secondary me-2" onClick={handleProfileEditClick}>Edit Profile</button>
            )}
            {/* Always show Logout button when profile is loaded */}
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
                   {/* TODO: Consider making this a dropdown if you have a predefined list */}
                   <input
                     type="text"
                     className="form-control"
                     id="editLand"
                     name="land"
                     value={editFormData.land}
                     onChange={handleProfileInputChange}
                   />
                </div>
              </div>
              {/* Add other editable fields here */}
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
              <p><strong>Country:</strong> {profile.land || 'N/A'}</p>
              {/* Display other profile fields here */}
            </>
          )}
        </div>
      </div>

      {/* Removed the entire "Your Shops" section */}
    </div>
  );
}

export default ProfilePage;