import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import './MainPage.css'; // Import the CSS
import MoodVotingForm from './MoodVotingForm'; // Import the MoodVotingForm component
import AiFeedbackDisplay from './AiFeedbackDisplay'; // Import the AiFeedbackDisplay component
import ChatInterface from './ChatInterface'; // Import the ChatInterface component

const MainPage = () => {
    // State for various parts of the page
    const [laatsteStemming, setLaatsteStemming] = useState(null); // Last mood voted
    const [stemmingToegestaan, setStemmingToegestaan] = useState(null); // Can vote mood? Initialize as null
    const [eigenFeedback, setEigenFeedback] = useState(''); // AI feedback for user
    const [feedbackVisible, setFeedbackVisible] = useState(true);
    const [chatMessages, setChatMessages] = useState([]); // Keep for initial fetch
    // chatInput, searchInput moved to ChatInterface
    // Community state removed (moved to CommunityPage.jsx)
    const [flashedMessages, setFlashedMessages] = useState([]); // For Flask-like flash messages
    const [soundOn, setSoundOn] = useState(localStorage.getItem("soundOn") === "true");
    // aiIsBezig moved to ChatInterface
    const [userLanguage, setUserLanguage] = useState('en'); // Default TTS language (simple code like 'en', 'es')
    // chatBoxRef moved to ChatInterface

    // Fetch initial data on component mount
    useEffect(() => {
        const fetchInitialData = async () => {
            // Fetch Chat History
            try {
                const chatResponse = await fetch('/api/chat_geschiedenis', { credentials: 'include' }); // Added /api prefix
                if (chatResponse.ok) {
                    const chatData = await chatResponse.json();
                    setChatMessages(chatData.geschiedenis || []);
                } else if (chatResponse.status === 401) { // Handle unauthorized specifically
                     console.warn("Not logged in, cannot fetch chat history.");
                     // Redirect to login or show login message?
                }
                 else {
                    console.error("Failed to fetch chat history:", chatResponse.statusText);
                }
            } catch (error) {
                console.error("Error fetching chat history:", error);
            }

            // Fetch Journal Data (from the updated '/' endpoint)
            try {
                const journalResponse = await fetch('/api/', { credentials: 'include' }); // Added /api prefix
                if (journalResponse.ok) {
                    const contentType = journalResponse.headers.get("content-type");
                    if (contentType && contentType.indexOf("application/json") !== -1) {
                        // It's JSON, proceed to parse
                        const journalData = await journalResponse.json();
                        // ... (rest of the success logic)
                        setLaatsteStemming(journalData.laatste_stemming);
                        setStemmingToegestaan(journalData.stemming_toegestaan);
                        if (journalData.user_language) {
                            setUserLanguage(journalData.user_language);
                            console.log("User TTS language set to:", journalData.user_language);
                        } else {
                            console.warn("User language not found in backend response, using default:", userLanguage);
                        }
                        setEigenFeedback(journalData.laatste_ai_feedback || ''); // Use latest AI feedback from session
                        // setFlashedMessages([{ message: `Welcome, ${journalData.naam}!`, category: 'info' }]); // Example flash moved inside JSON check
                    } else {
                        // It's not JSON, likely HTML (error/login page)
                        console.error("Failed to fetch journal data: Expected JSON, but received", contentType);
                        // Optionally, try to read as text to see the HTML content for debugging
                        // const errorText = await journalResponse.text();
                        // console.error("Received HTML content:", errorText);
                        // Handle this case - maybe show a generic error or prompt login?
                        // For now, just log the error. The states won't be updated.
                    }
                } else if (journalResponse.status === 401) {
                    console.warn("Not logged in, cannot fetch journal data.");
                     // Redirect to login? Handled by backend redirect usually, but good for clarity
                }
                else {
                    console.error("Failed to fetch journal data:", journalResponse.statusText);
                }
            } catch (error) {
                console.error("Error fetching journal data:", error);
            }

            // Community data fetch removed (handled in CommunityPage.jsx)
        };

        fetchInitialData();
    }, []); // Empty dependency array ensures this runs only once on mount

    // --- TODO: Implement functions ---
    const handleMoodSubmit = async (mood) => { // Removed START log
        console.log("--- handleMoodSubmit START ---"); // Add log at the very start
        console.log("Mood submitted:", mood);
        // Keep UI disabled while processing
        // setStemmingToegestaan(false); // Already disabled by backend logic after successful post

        try {
            // console.log("Attempting to fetch /nieuw..."); // Removed log
            const response = await fetch('/api/nieuw', { // Added /api prefix
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded', // Match backend expectation
                },
                body: new URLSearchParams({ 'stemming': mood }),
                credentials: 'include'
            });
            // console.log("Fetch call to /nieuw completed. Status:", response.status); // Removed log

            const data = await response.json(); // Always expect JSON now

            if (response.ok) { // Status 200-299 (specifically 201 from backend)
                console.log("Mood submitted successfully:", data);
                setLaatsteStemming(data.entry.stemming); // Update mood from response
                setEigenFeedback(data.ai_feedback); // Update AI feedback from response
                setStemmingToegestaan(false); // Explicitly disable voting after success
                setFeedbackVisible(true); // Show feedback after submission
                // Speak the AI feedback if sound is on
                playTextToSpeech(data.ai_feedback, userLanguage); // Pass user language
                // Optionally clear chat history if backend logic implies it
                // setChatMessages([]);
                // setFlashedMessages([{ message: data.message || 'Mood saved!', category: 'success' }]);
            } else if (response.status === 409) { // Handle conflict (already submitted today)
                 console.warn("Mood already submitted today:", data.message);
                 setLaatsteStemming(data.laatste_stemming); // Show the existing mood
                 setStemmingToegestaan(false); // Keep voting disabled
                 // setFlashedMessages([{ message: data.message, category: 'warning' }]);
                 alert(data.message); // Simple alert
            }
            else { // Handle other errors (401 Unauthorized, 500 Server Error, etc.)
                console.error("Failed to submit mood:", response.status, data.message);
                // Don't re-enable voting here, rely on initial fetch state
                // setFlashedMessages([{ message: data.message || 'Error submitting mood.', category: 'error' }]);
                alert(`Error: ${data.message || response.statusText}`); // Simple alert
            }
        } catch (error) {
            console.error("Error submitting mood:", error); // Reverted log message
            // Don't re-enable voting here
            // setFlashedMessages([{ message: 'Network error submitting mood.', category: 'error' }]);
            alert(`Network Error: ${error.message}`); // Simple alert
        }
        // No finally block needed to re-enable voting, as it's controlled by backend logic now
    };

    const toggleFeedback = () => {
        setFeedbackVisible(!feedbackVisible);
        // TODO: Play sound if turning visible and soundOn
    };

    // handleChatSubmit moved to ChatInterface.jsx
    // handleDeleteMessage moved to ChatInterface.jsx

    // Community functions removed (moved to CommunityPage.jsx)

    const toggleSound = () => {
        const newState = !soundOn;
        setSoundOn(newState);
        localStorage.setItem("soundOn", newState);
    };

    // Define the DOM-based filtering function provided by the user
    // filterBerichten moved to ChatInterface.jsx

    // Chat filter useEffect moved to ChatInterface.jsx

    // --- TODO: Implement text-to-speech function ---
    // WARNING: Embedding API keys in frontend code is insecure. Consider a backend proxy.
    const playTextToSpeech = (text, languageCode = 'en') => { // Accept languageCode, default to 'en'
        if (!soundOn || !text) return;

        console.log(`Requesting TTS from backend proxy for lang '${languageCode}':`, text); // Log language

        fetch("/api/synthesize", { // Corrected path: /api (from blueprint) + /synthesize (from route)
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "audio/mpeg" // Expect audio back
            },
            body: JSON.stringify({
                text: text,
                language_code: languageCode // Send the language code
            }),
            credentials: 'include' // Include cookies if backend needs session info (optional here)
        })
        .then(response => {
            if (!response.ok) {
                // Try to get error details from backend JSON response
                return response.json().then(err => {
                    const errorDetails = err.detail || err.error || JSON.stringify(err);
                    throw new Error(`Backend TTS Error: ${response.status} ${response.statusText} - ${errorDetails}`);
                }).catch(() => {
                    // Fallback if error response isn't JSON
                    throw new Error(`Backend TTS Error: ${response.status} ${response.statusText}`);
                });
            }
            // Expecting audio blob directly now
            return response.blob();
        })
        .then(blob => {
            const audioURL = URL.createObjectURL(blob);
            const audio = new Audio(audioURL);
            audio.play()
                .catch(e => console.error("Error playing audio:", e));
            audio.onended = () => URL.revokeObjectURL(audioURL);
        })
        .catch(error => {
            console.error("🎤 Fout bij spraakgeneratie (via backend):", error);
            // Optionally show an alert to the user
            // alert(`Could not generate speech: ${error.message}`);
        });
    };

    // Chat scroll useEffect moved to ChatInterface.jsx

    // renderFeedback function removed, now lives in AiFeedbackDisplay.jsx

    return (
        <div className="container">
            {/* Flashed Messages */}
            {flashedMessages.length > 0 && (
                <div className="flashed-messages">
                    {flashedMessages.map((msg, index) => (
                        <div key={index} className={`flash-message flash-${msg.category || 'info'}`}>
                            {msg.message}
                        </div>
                    ))}
                </div>
            )}

            {/* Navigation Menu */}
            <nav style={{ marginBottom: '20px', textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <Link to="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Home / Mood</Link>
                <Link to="/community" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Community</Link>
                <Link to="/pilocations" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Map</Link>
                <Link to="/profile" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Profile</Link>
                {/* Removed logout link */}
            </nav>

            <h1>PiHappy - Mood & Chat</h1> {/* Updated heading */}

            {/* Last Mood Display */}
            {laatsteStemming && (
                <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '20px', color: '#28a745' }}>
                    Your feeling today is: {laatsteStemming}
                </div>
            )}

            {/* Mood Voting Form */}
            {/* Render the extracted Mood Voting Form component */}
            <MoodVotingForm
                isVotingAllowed={stemmingToegestaan === true} // Pass voting status
                onMoodSubmit={handleMoodSubmit} // Pass the submit handler
            />

            {/* AI Feedback */}
            {/* Render the extracted AI Feedback Display component */}
            <AiFeedbackDisplay
                feedbackText={eigenFeedback}
                isVisible={feedbackVisible}
                onToggleVisibility={toggleFeedback}
            />

            {/* Sound Toggle */}
            <button id="toggleSoundButton" onClick={toggleSound}>
                {soundOn ? '🔊 Sound: On' : '🔇 Sound: Off'}
            </button>

            {/* Chat Section - Render the extracted ChatInterface component */}
            <ChatInterface
                initialMessages={chatMessages} // Pass fetched initial messages
                userLanguage={userLanguage}
                soundOn={soundOn}
                playTextToSpeech={playTextToSpeech} // Pass the TTS function
            />

            {/* Community Section removed (moved to CommunityPage.jsx) */}

        </div>
    );
};

export default MainPage;