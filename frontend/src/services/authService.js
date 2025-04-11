// Base URL for the API - could be moved to config/env variable later
const API_BASE_URL = '/api'; // Assuming all API routes are prefixed with /api

/**
 * Handles API responses, parsing JSON and throwing errors for non-ok statuses.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<any>} - The parsed JSON data.
 * @throws {Error} - Throws an error with the message from the API or status text.
 */
const handleResponse = async (response) => {
    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
    } else {
        // Handle non-JSON responses if necessary, or assume error for now
        // For auth check, a 200 OK might not have JSON, but that's handled by the caller checking response.ok
        if (!response.ok) {
             throw new Error(response.statusText || `HTTP error! status: ${response.status}`);
        }
        return null; // Return null for non-JSON success responses (like auth check)
    }

    if (!response.ok) {
        // Use the error message from the JSON response if available
        const errorMessage = data.message || data.error || response.statusText || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return data;
};

/**
 * Logs in a user.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<any>} - The result from the API.
 */
export const loginUser = async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    // Login might redirect or just return success/user data, handleResponse might need adjustment
    // For now, assume it returns JSON on success/error
    return handleResponse(response);
};

/**
 * Registers a new user.
 * @param {object} registrationData - Data including name, email, password, land, browser_lang, timestamp.
 * @returns {Promise<any>} - The result from the API.
 */
export const registerUser = async (registrationData) => {
    const response = await fetch(`${API_BASE_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registrationData),
    });
    return handleResponse(response);
};

/**
 * Logs out the current user.
 * @returns {Promise<any>} - The result from the API (usually just success/failure).
 */
export const logoutUser = async () => {
    const response = await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        // No body needed, session cookie is used
    });
     // Logout might return empty body on success
    if (!response.ok) {
        // Try to parse error, but fallback if not JSON
        try {
            const errorData = await response.json();
            throw new Error(errorData.message || response.statusText);
        } catch (e) {
             throw new Error(response.statusText || `HTTP error! status: ${response.status}`);
        }
    }
    return null; // Indicate success with null or an empty object
};

/**
 * Checks the current authentication status by hitting a protected endpoint.
 * @returns {Promise<boolean>} - True if authenticated, false otherwise.
 */
export const checkAuthStatus = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/profile`, {
             credentials: 'include', // Important for sending session cookie
        });
        return response.ok; // 2xx status means logged in
    } catch (error) {
        console.error("Network error during auth check:", error);
        return false; // Network errors mean we can't confirm auth
    }
};

/**
 * Fetches the profile data for the logged-in user or a specific user.
 * @param {string|null} userId - Optional user ID to fetch a specific profile.
 * @returns {Promise<any>} - The user profile data.
 */
export const fetchProfile = async (userId = null) => {
    const url = userId ? `${API_BASE_URL}/profile/${userId}` : `${API_BASE_URL}/profile`;
    const response = await fetch(url, {
         credentials: 'include', // Needed if fetching own profile based on session
    });
    return handleResponse(response);
};

/**
 * Updates the user's profile.
 * @param {object} profileData - Data to update (e.g., { naam: 'New Name', land: 'us' }).
 * @param {string|null} userId - Optional user ID if updating another profile (admin).
 * @returns {Promise<any>} - The updated user profile data.
 */
export const updateProfile = async (profileData, userId = null) => {
     const url = userId ? `${API_BASE_URL}/profile/${userId}` : `${API_BASE_URL}/profile`;
     const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
        credentials: 'include', // Needed for session authentication
     });
     return handleResponse(response);
};

/**
 * Fetches the list of countries.
 * @returns {Promise<Array<object>>} - Array of country objects { code: string, naam: string }.
 */
export const fetchCountries = async () => {
    const response = await fetch(`${API_BASE_URL}/landen`);
    const data = await handleResponse(response);
    return data.landen || []; // Return the array or empty array on error/unexpected format
};