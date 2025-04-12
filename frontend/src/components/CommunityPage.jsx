import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
// import './CommunityPage.css'; // Optional: Create and import CSS if needed

const CommunityPage = () => {
    // State moved from MainPage
    const [communityInput, setCommunityInput] = useState('');
    // const [communityMessages, setCommunityMessages] = useState([]); // Keep if displaying messages
    const [analyseResultaat, setAnalyseResultaat] = useState('');
    const [populaireThemas, setPopulaireThemas] = useState('Loading...');
    const [topBijdragers, setTopBijdragers] = useState('Loading...');
    const [canPost, setCanPost] = useState(true); // Assume true initially
    const [cooldownExpires, setCooldownExpires] = useState(null);
    const [countryCounts, setCountryCounts] = useState(null); // State for country counts
    // const [flashedMessages, setFlashedMessages] = useState([]);

    // Function moved from MainPage
    const handleCommunitySubmit = async () => {
        console.log("--- handleCommunitySubmit START ---");
        const trimmedInput = communityInput.trim();
        if (!trimmedInput) return;

        // Removed word count validation, maxLength attribute handles character limit
        console.log("Community input submitted:", trimmedInput);

        try {
            const response = await fetch('/api/community_input/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ input: trimmedInput }),
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok) {
                console.log("Community input saved successfully:", data.message);
                setCommunityInput('');
                // Refresh status after successful post
                fetchInputStatus();
                // Optionally refresh stats
                // refreshCommunityStats();
            } else {
                const errorText = data.message || response.statusText;
                console.error("Failed to send community input:", response.status, errorText);
                // Check if the error is the cooldown message (status 429)
                if (response.status === 429) {
                    // Update status based on error message (or re-fetch status)
                    fetchInputStatus(); // Re-fetch status to get accurate expiry
                    alert(errorText); // Show the specific cooldown message
                } else {
                    alert(`Error: ${errorText}`); // Show other errors
                }
            }
        } catch (error) {
            console.error("Error sending community input:", error);
            alert(`Network Error: ${error.message}`);
        }
    };

    // Function to fetch and display the latest analysis result
    const fetchLatestAnalysis = async () => {
        console.log("Fetching latest community analysis...");
        setAnalyseResultaat("⏳ Loading analysis..."); // Indicate loading
        try {
            // We can reuse the analyseCommunityInput service function if its backend
            // route now fetches the latest stored result.
            // Assuming the service function was updated or we call the endpoint directly:
            const response = await fetch('/api/community_input/analyse', {
                 method: 'GET',
                 headers: { 'Accept': 'application/json' },
                 credentials: 'include'
            });
             if (!response.ok) {
                 throw new Error(`HTTP error! status: ${response.status}`);
             }
            const data = await response.json();

            if (data.status === 'success') {
                console.log("Latest analysis fetched:", data.ai_feedback);
                setAnalyseResultaat(data.ai_feedback || "No analysis available yet."); // Show message if feedback is empty
            } else {
                 console.error("Error in analysis response:", data.message);
                 setAnalyseResultaat(`Error: ${data.message || 'Could not load analysis'}`);
            }
        } catch (error) {
            console.error("Error fetching analysis:", error);
            setAnalyseResultaat(`Network Error: ${error.message}`);
        }
    };

    // Rename the old analyseCommunity function to avoid confusion
    // This button now just triggers a refresh of the displayed analysis
    const refreshAnalysisDisplay = () => {
        fetchLatestAnalysis();
    };

    // Function moved from MainPage
    const refreshCommunityStats = async () => {
        console.log("Refreshing community stats...");
        setPopulaireThemas("⏳ Loading...");
        setTopBijdragers("⏳ Loading...");

        try {
            const response = await fetch('/api/community_input/statistieken', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                credentials: 'include'
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                console.log("Stats refreshed successfully:", data);
                setPopulaireThemas(data.populaire_themas.join(', ') || 'None');
                setTopBijdragers(
                    data.top_bijdragers.map(b => `${b.naam} (${b.aantal})`).join(', ') || 'None'
                );
            } else {
                console.error("Failed to refresh stats:", response.status, data.message);
                const errorMsg = `Error: ${data.message || response.statusText}`;
                setPopulaireThemas(errorMsg);
                setTopBijdragers(errorMsg);
            }
        } catch (error) {
            console.error("Error refreshing stats:", error);
            const errorMsg = `Network Error: ${error.message}`;
            setPopulaireThemas(errorMsg);
            setTopBijdragers(errorMsg);
        }
    };

    // Function to fetch input status
    const fetchInputStatus = async () => {
        try {
            const response = await fetch('/api/community_input/status', { credentials: 'include' });
            if (!response.ok) {
                // Handle error, maybe default to allowing post or show error?
                console.error("Failed to fetch community input status:", response.statusText);
                setCanPost(true); // Default to allow post on status check error
                setCooldownExpires(null);
                return;
            }
            const data = await response.json();
            if (data.status === 'success') {
                setCanPost(data.can_post);
                setCooldownExpires(data.cooldown_expires); // Store ISO string
            } else {
                 console.error("Error in status response:", data.message);
                 setCanPost(true); // Default to allow
                 setCooldownExpires(null);
            }
        } catch (error) {
            console.error("Network error fetching community input status:", error);
            setCanPost(true); // Default to allow post on network error
            setCooldownExpires(null);
        }
    };

    // Fetch initial stats and input status on component mount
    // Function to fetch country counts
    const fetchCountryCounts = async () => {
        console.log("Fetching country counts...");
        try {
            const response = await fetch('/api/community_input/stats_by_country', { credentials: 'include' });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            console.log("Received country counts data:", data); // Log received data
            if (data.status === 'success') {
                setCountryCounts(data.country_counts);
            } else {
                console.error("Error fetching country counts:", data.message);
                setCountryCounts({}); // Set empty object on error
            }
        } catch (error) {
            console.error("Network error fetching country counts:", error);
            setCountryCounts({}); // Set empty object on error
        }
    };

    useEffect(() => {
        refreshCommunityStats();
        fetchInputStatus();
        fetchLatestAnalysis();
        fetchCountryCounts(); // Fetch country counts on initial load
    }, []); // Empty dependency array ensures this runs only once on mount

    // Helper function to calculate remaining time
    const calculateRemainingTime = (expiryIsoString) => {
        if (!expiryIsoString) return 'a few minutes'; // Fallback
        const now = new Date();
        const expiry = new Date(expiryIsoString);
        const diffSeconds = Math.max(0, Math.floor((expiry - now) / 1000));
        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;
        if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? 's' : ''}`;
        } else if (seconds > 0) {
             return `${seconds} second${seconds > 1 ? 's' : ''}`;
        }
        return 'a moment'; // Should ideally not happen if canPost is false
    };

    return (
        <div className="container"> {/* Use same container class or create new CSS */}
            {/* Navigation Menu */}
            <nav style={{ marginBottom: '20px', textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <Link to="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Home / Mood</Link>
                <Link to="/community" style={{ textDecoration: 'none', color: '#5e459c', fontWeight: 'bold' }}>Community</Link> {/* Bold current page */}
                {/* Add other links as needed */}
            </nav>

            <h1>Community Page</h1>

            {/* Community Section JSX moved from MainPage */}
            <h2>🌍 Community Input</h2>
            {/* Conditionally render input form or cooldown message */}
            {canPost ? (
                <div className="community-input-area-whatsapp"> {/* Use class */}
                    <textarea
                        id="inputText" // Keep ID
                        placeholder="Share your idea or suggestion (max 250 characters)"
                        value={communityInput}
                        maxLength={250} // Enforce character limit
                        onChange={(e) => setCommunityInput(e.target.value)}
                        onInput={(e) => { // Auto-resize height
                            e.target.style.height = 'auto'; // Reset height
                            e.target.style.height = `${e.target.scrollHeight}px`; // Set to scroll height
                        }}
                        onKeyPress={(e) => {
                            // Allow Shift+Enter for new lines, Enter alone submits
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault(); // Prevent default Enter behavior (new line)
                                handleCommunitySubmit();
                            }
                        }}
                        className="community-textarea-whatsapp" // Use class
                    />
                    <button
                        id="sendInputButton"
                        onClick={handleCommunitySubmit}
                        className="community-send-button-whatsapp" // Use class
                        title="Send" // Tooltip
                    >
                        ➤ {/* Simple send icon */}
                    </button>
                </div>
            ) : (
                <div className="cooldown-message" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '5px', color: '#856404' }}>
                    You can post again in {calculateRemainingTime(cooldownExpires)}.
                </div>
            )}
            {/* Keep other buttons separate */}
            <button id="analyseCommunityButton" onClick={refreshAnalysisDisplay} style={{ marginRight: '10px' }}>🔍 Refresh Analysis Display</button>
            <button id="refreshStatsButton" onClick={refreshCommunityStats}>🔄 Refresh Stats</button>


            <h2>🤖 AI Analysis Community</h2>
            <div id="analyse_resultaat">{analyseResultaat}</div>

            <h2>📊 Community Statistics</h2>
            <div id="statistieken_resultaat">
                <p><strong>🔍 Popular Topics:</strong> <span id="populaireThemas">{populaireThemas}</span></p>
                <p><strong>🏆 Top Contributors:</strong> <span id="topBijdragers">{topBijdragers}</span></p>
                {/* Display Country Counts */}
                <div>
                    <strong>🌍 Inputs by Country:</strong>
                    {countryCounts === null ? (
                        <span> Loading...</span>
                    ) : Object.keys(countryCounts).length > 0 ? (
                        <ul style={{ listStyle: 'none', paddingLeft: '10px', marginTop: '5px' }}>
                            {Object.entries(countryCounts)
                                .sort(([, countA], [, countB]) => countB - countA) // Sort descending by count
                                .map(([country, count]) => (
                                    <li key={country}>{country}: {count}</li>
                            ))}
                        </ul>
                    ) : (
                        <span> No data available.</span>
                    )}
                </div>
            </div>
            {/* Refresh button could also trigger fetchCountryCounts if desired */}


        </div>
    );
};

export default CommunityPage;