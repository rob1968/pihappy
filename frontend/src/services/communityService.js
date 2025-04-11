// Base URL for the API
const API_BASE_URL = '/api';

/**
 * Handles API responses, parsing JSON and throwing errors for non-ok statuses.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<any>} - The parsed JSON data.
 * @throws {Error} - Throws an error with the message from the API or status text.
 */
const handleResponse = async (response) => {
    const data = await response.json().catch(() => null); // Try to parse JSON

    if (!response.ok) {
        const errorMessage = data?.message || data?.error || response.statusText || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return data; // Return parsed data on success
};

/**
 * Sends community input to the backend.
 * @param {string} inputText - The text input from the user.
 * @returns {Promise<any>} - The result from the API.
 */
export const sendCommunityInput = async (inputText) => {
    const response = await fetch(`${API_BASE_URL}/community_input/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputText }),
        credentials: 'include'
    });
    return handleResponse(response);
};

/**
 * Triggers the AI analysis of community input.
 * @returns {Promise<any>} - The analysis result from the API.
 */
export const analyseCommunityInput = async () => {
    const response = await fetch(`${API_BASE_URL}/community_input/analyse`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
    });
    return handleResponse(response);
};

/**
 * Fetches community statistics (popular themes, top contributors).
 * @returns {Promise<any>} - The statistics data from the API.
 */
export const fetchCommunityStats = async () => {
    const response = await fetch(`${API_BASE_URL}/community_input/statistieken`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
    });
    // This endpoint might have a specific success structure (e.g., data.status === 'success')
    // HandleResponse might need adjustment or specific handling here if needed.
    // For now, assume standard JSON success/error based on status code.
    return handleResponse(response);
};