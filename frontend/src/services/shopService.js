// Base URL for the API
const API_BASE_URL = '/api';

/**
 * Handles API responses, parsing JSON and throwing errors for non-ok statuses.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<any>} - The parsed JSON data.
 * @throws {Error} - Throws an error with the message from the API or status text.
 */
const handleResponse = async (response) => {
    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get("content-type");
    let data = null;
    if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json().catch(() => null);
    }

    if (!response.ok) {
        const errorMessage = data?.error || data?.message || response.statusText || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return data; // Return parsed data or null if no JSON content
};

/**
 * Fetches all shops.
 * @returns {Promise<Array<object>>} - Array of shop objects.
 */
export const fetchShops = async () => {
    const response = await fetch(`${API_BASE_URL}/shops`);
    return handleResponse(response);
};

/**
 * Fetches distinct shop categories.
 * @returns {Promise<Array<string>>} - Array of category strings.
 */
export const fetchCategories = async () => {
    const response = await fetch(`${API_BASE_URL}/categories`);
    // Assuming this returns a simple array of strings directly
    return handleResponse(response);
};

/**
 * Adds a new shop.
 * @param {object} shopData - Data for the new shop (name, category, location, latitude, longitude, type).
 * @returns {Promise<object>} - The newly created shop object.
 */
export const addShop = async (shopData) => {
    const response = await fetch(`${API_BASE_URL}/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopData),
        credentials: 'include' // Needed to associate shop with logged-in user
    });
    return handleResponse(response);
};

/**
 * Fetches shops belonging to the currently logged-in user.
 * @returns {Promise<Array<object>>} - Array of the user's shop objects.
 */
export const fetchUserShops = async () => {
    const response = await fetch(`${API_BASE_URL}/profile/shops`, {
        credentials: 'include'
    });
    return handleResponse(response);
};

/**
 * Updates an existing shop.
 * @param {string} shopId - The ID of the shop to update.
 * @param {object} shopData - The data to update.
 * @returns {Promise<object>} - The updated shop object.
 */
export const updateShop = async (shopId, shopData) => {
    const response = await fetch(`${API_BASE_URL}/shops/${shopId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shopData),
        credentials: 'include'
    });
    return handleResponse(response);
};

/**
 * Finds shops near a given location (uses the moved endpoint).
 * @param {string} location - The location string to search near.
 * @returns {Promise<object>} - The result object containing the response text.
 */
export const findNearbyShops = async (location) => {
     const response = await fetch(`${API_BASE_URL}/shops/find_nearby`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locatie: location }), // Match backend expectation
        credentials: 'include'
    });
    return handleResponse(response);
};