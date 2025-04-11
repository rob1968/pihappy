// Base URL for the API
const API_BASE_URL = '/api';

/**
 * Handles API responses, parsing JSON and throwing errors for non-ok statuses.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<any>} - The parsed JSON data.
 * @throws {Error} - Throws an error with the message from the API or status text.
 */
const handleResponse = async (response) => {
    const data = await response.json().catch(() => null); // Try to parse JSON, default to null if not JSON

    if (!response.ok) {
        const errorMessage = data?.antwoord || data?.message || data?.error || response.statusText || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return data; // Return parsed data on success
};

/**
 * Sends a chat message to the backend.
 * @param {string} messageContent - The user's message text.
 * @returns {Promise<object>} - Object containing user_message and assistant_message from the backend.
 */
export const sendChatMessage = async (messageContent) => {
    const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vraag: messageContent }),
        credentials: 'include'
    });
    return handleResponse(response);
};

/**
 * Deletes a specific chat message.
 * @param {string} messageId - The timestamp ID of the message to delete.
 * @returns {Promise<any>} - The result from the API (usually success status).
 */
export const deleteChatMessage = async (messageId) => {
    const response = await fetch(`${API_BASE_URL}/chat/verwijder/${messageId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    // Delete might return empty body on success, handleResponse handles this
    return handleResponse(response);
};

/**
 * Fetches the chat history for the logged-in user.
 * @returns {Promise<Array<object>>} - Array of chat message objects.
 */
export const fetchChatHistory = async () => {
    const response = await fetch(`${API_BASE_URL}/chat_geschiedenis`, {
        credentials: 'include'
    });
    const data = await handleResponse(response);
    return data.geschiedenis || []; // Return history array or empty array
};

/**
 * Deletes all chat messages for the logged-in user.
 * @returns {Promise<any>} - The result from the API.
 */
export const deleteAllChatMessages = async () => {
     const response = await fetch(`${API_BASE_URL}/chat/verwijder_alle`, {
        method: 'DELETE',
        credentials: 'include'
    });
    return handleResponse(response);
};