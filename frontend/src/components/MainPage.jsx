import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import './MainPage.css'; // Import the CSS

const MainPage = () => {
    // State for various parts of the page
    const [laatsteStemming, setLaatsteStemming] = useState(null); // Last mood voted
    const [stemmingToegestaan, setStemmingToegestaan] = useState(true); // Can vote mood?
    const [eigenFeedback, setEigenFeedback] = useState(''); // AI feedback for user
    const [feedbackVisible, setFeedbackVisible] = useState(true);
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [searchInput, setSearchInput] = useState('');
    // Community state removed (moved to CommunityPage.jsx)
    const [flashedMessages, setFlashedMessages] = useState([]); // For Flask-like flash messages
    const [soundOn, setSoundOn] = useState(localStorage.getItem("soundOn") === "true");
    const [aiIsBezig, setAiIsBezig] = useState(false); // Track if AI is processing chat
    const [userLanguage, setUserLanguage] = useState('en'); // Default TTS language (simple code like 'en', 'es')
    const chatBoxRef = useRef(null); // Ref for scrolling chat box

    // Fetch initial data on component mount
    useEffect(() => {
        const fetchInitialData = async () => {
            // Fetch Chat History
            try {
                const chatResponse = await fetch('/chat_geschiedenis', { credentials: 'include' });
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
                const journalResponse = await fetch('/', { credentials: 'include' }); // Fetch from journal root
                if (journalResponse.ok) {
                    const journalData = await journalResponse.json();
                    setLaatsteStemming(journalData.laatste_stemming);
                    setStemmingToegestaan(journalData.stemming_toegestaan);
                    // Set the user language for TTS from the backend data, fallback to default
                    // Assuming backend sends simple code like 'en', 'es' in user_language field
                    if (journalData.user_language) {
                        setUserLanguage(journalData.user_language);
                        console.log("User TTS language set to:", journalData.user_language);
                    } else {
                        console.warn("User language not found in backend response, using default:", userLanguage);
                    }
                    // Assuming eigen_feedback is an array of feedback objects
                    // We might want to display only the latest or format them
                    // For now, let's just store the latest AI feedback if available
                    setEigenFeedback(journalData.laatste_ai_feedback || ''); // Use latest AI feedback from session
                    // setFlashedMessages([{ message: `Welcome, ${journalData.naam}!`, category: 'info' }]); // Example flash
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
            const response = await fetch('/nieuw', { // Endpoint for submitting new entry
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

    const handleChatSubmit = async () => { // Make async
        if (aiIsBezig || !chatInput.trim()) return;

        const userMessage = {
            role: "user",
            content: chatInput.trim(),
            tijd: new Date().toISOString() // Use ISO string for consistency
        };

        // Add user message optimistically
        setChatMessages(prevMessages => [...prevMessages, userMessage]);
        const currentInput = chatInput; // Store current input before clearing
        setChatInput(''); // Clear input immediately
        setAiIsBezig(true); // Set loading state

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ vraag: userMessage.content }),
                credentials: 'include' // Add credentials here
            });

            if (response.ok) {
                const data = await response.json();
                // Add assistant message from response
                const assistantMessage = { role: "assistant", content: data.antwoord, tijd: new Date().toISOString() };
                setChatMessages(prevMessages => [...prevMessages, assistantMessage]);
                // Handle sound playback if enabled
                playTextToSpeech(data.antwoord, userLanguage); // Pass user language
            } else {
                // Handle specific errors like 400 Bad Request (length limit)
                const data = await response.json(); // Try to get error message from body
                const errorText = data.antwoord || data.message || response.statusText; // Use specific or generic error
                console.error("Failed to send chat message:", response.status, errorText);
                // Show error message in a popup alert without prefix
                alert(errorText);
                // Ensure input is not repopulated on error
                // setChatInput(currentInput); // Keep this commented/removed
            }
        } catch (error) {
            console.error("Error sending chat message:", error);
            const errorMessage = { role: "error", content: `Error sending message: ${error.message}`, tijd: new Date().toISOString() };
            setChatMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setAiIsBezig(false); // Reset loading state
        }
    };

    // Community functions removed (moved to CommunityPage.jsx)

    const toggleSound = () => {
        const newState = !soundOn;
        setSoundOn(newState);
        localStorage.setItem("soundOn", newState);
    };

    // Define the DOM-based filtering function provided by the user
    const filterBerichten = () => {
        const zoekwoord = searchInput.toLowerCase(); // Use state variable
        // Use chatBoxRef to scope the querySelectorAll
        const berichten = chatBoxRef.current?.querySelectorAll(".message");

        if (!berichten) return; // Exit if chatBoxRef is not ready or no messages

        berichten.forEach(bericht => {
            // Ensure data-content attribute exists before accessing
            const content = bericht.getAttribute("data-content") || "";

            const matchTekst = !zoekwoord || content.includes(zoekwoord);

            // Directly manipulate style - NOTE: Less idiomatic React
            bericht.style.display = matchTekst ? "block" : "none";

            // Highlighting logic
            const tekstElement = bericht.querySelector(".bericht-tekst");
            if (tekstElement) {
                // Store original text if not already stored
                if (!tekstElement.hasAttribute("data-original-text")) {
                     tekstElement.setAttribute("data-original-text", tekstElement.textContent);
                }
                // Always reset innerHTML first to remove previous highlights
                tekstElement.innerHTML = tekstElement.getAttribute("data-original-text"); // Restore original before potential highlight

                if (matchTekst && zoekwoord) {
                    const regex = new RegExp(`(${zoekwoord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi"); // Escape regex special chars
                    tekstElement.innerHTML = tekstElement.innerHTML.replace(regex, `<span class="highlight">$1</span>`);
                }
                // No need for an else block to restore, as it's done above before the highlight check
            }
        });
    };

    // Effect to run the filter function when search or messages change
    useEffect(() => {
        // Run filterBerichten after the component updates and messages are rendered
        // A slight delay might sometimes be needed for DOM updates, but usually useEffect dependency works
        filterBerichten();
    }, [searchInput, chatMessages]); // Rerun when search or messages change
    // Removed duplicated filterBerichten function and useEffect hook below this line

    // --- TODO: Implement text-to-speech function ---
    // WARNING: Embedding API keys in frontend code is insecure. Consider a backend proxy.
    const playTextToSpeech = (text, languageCode = 'en') => { // Accept languageCode, default to 'en'
        if (!soundOn || !text) return;

        console.log(`Requesting TTS from backend proxy for lang '${languageCode}':`, text); // Log language

        fetch("/api/tts/synthesize", { // Call the new backend endpoint
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

    // Scroll chat box to bottom when messages change
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages]);

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
                <Link to="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: 'bold' }}>Home / Mood</Link> {/* Bold current page */}
                <Link to="/community" style={{ textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Community</Link>
                {/* Add other links as needed */}
            </nav>

            <h1>PiHappy - Mood & Chat</h1> {/* Updated heading */}

            {/* Last Mood Display */}
            {laatsteStemming && (
                <div style={{ fontSize: '32px', fontWeight: 'bold', marginTop: '20px', color: '#28a745' }}>
                    Your feeling today is: {laatsteStemming}
                </div>
            )}

            {/* Mood Voting Form */}
            {stemmingToegestaan && (
                <form onSubmit={(e) => e.preventDefault()}> {/* Prevent default form submission */}
                    <label>How are you feeling right now?</label>
                    <div className="mood-columns">
                        {/* Positive */}
                        <div className="mood-column">
                            <div className="groep-label">😊 Positive</div>
                            <button type="button" onClick={() => handleMoodSubmit('Happy 😊')}>Happy 😊</button>
                            <button type="button" onClick={() => handleMoodSubmit('Excited 🤩')}>Excited 🤩</button>
                            <button type="button" onClick={() => handleMoodSubmit('Grateful 🙏')}>Grateful 🙏</button>
                        </div>
                        {/* Negative */}
                        <div className="mood-column">
                            <div className="groep-label">😔 Negative</div>
                            <button type="button" onClick={() => handleMoodSubmit('Sad 😔')}>Sad 😔</button>
                            <button type="button" onClick={() => handleMoodSubmit('Stressed 😰')}>Stressed 😰</button>
                            <button type="button" onClick={() => handleMoodSubmit('Sick 🤒')}>Sick 🤒</button>
                        </div>
                        {/* Neutral */}
                        <div className="mood-column">
                            <div className="groep-label">😐 Neutral</div>
                            <button type="button" onClick={() => handleMoodSubmit('Neutral 😐')}>Neutral 😐</button>
                            <button type="button" onClick={() => handleMoodSubmit('Surprised 😲')}>Surprised 😲</button>
                            <button type="button" onClick={() => handleMoodSubmit('Reflective 🤔')}>Reflective 🤔</button>
                        </div>
                    </div>
                </form>
            )}

            {/* AI Feedback */}
            {eigenFeedback && (
                <>
                    <div
                        id="aiFeedbackBox" // Keep ID for potential direct manipulation if needed, though state is preferred
                        className="ai-feedback-box"
                        aria-hidden={!feedbackVisible}
                        style={{ display: feedbackVisible ? 'block' : 'none' }}
                        dangerouslySetInnerHTML={{ __html: eigenFeedback }} // Assuming feedback might contain HTML
                    />
                    <button
                        id="toggleFeedbackButton" // Keep ID for potential direct manipulation
                        aria-expanded={feedbackVisible}
                        aria-controls="aiFeedbackBox"
                        onClick={toggleFeedback}
                    >
                        {feedbackVisible ? '👆 Hide feedback' : '👇 Show feedback'}
                    </button>
                </>
            )}

            {/* Sound Toggle */}
            <button id="toggleSoundButton" onClick={toggleSound}>
                {soundOn ? '🔊 Sound: On' : '🔇 Sound: Off'}
            </button>

            {/* Chat Section */}
            <input
                type="text"
                id="searchInput" // Keep ID
                placeholder="Search in messages.."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                // onChange triggers state update, which triggers the useEffect hook containing filterBerichten
            />

            <div id="chatBox" className="chat-box" ref={chatBoxRef}>
                {/* Render ALL chatMessages, filtering will happen via DOM manipulation */}
                {chatMessages.map((msg, index) => (
                     // Add data-content attribute for the filter function
                     // Use msg.tijd for key if available and unique, otherwise fallback to index
                     <div key={msg.tijd || index} className={`message ${msg.role}`} data-content={msg.content.toLowerCase()}>
                        {/* Basic message structure - needs date/time formatting */}
                        <div style={{ fontSize: '0.9em', color: 'gray' }}>🕒 {new Date(msg.tijd).toLocaleTimeString('nl-NL')}</div>
                        <strong>{msg.role === "user" ? "You" : msg.role === "assistant" ? "AI" : "⚠️ Error"}:</strong>
                        {/* Add data-original-text attribute */}
                        <span className="bericht-tekst" data-original-text={msg.content}>{msg.content}</span>
                     </div>
                ))}
            </div>

            <input
                type="text"
                id="chatInput" // Keep ID
                placeholder="Ask a question..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !aiIsBezig && handleChatSubmit()}
                disabled={aiIsBezig}
            />
            <button id="sendButton" onClick={handleChatSubmit} disabled={aiIsBezig}>Send</button>

            {/* Community Section removed (moved to CommunityPage.jsx) */}

        </div>
    );
};

export default MainPage;