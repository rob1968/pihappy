import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import './MainPage.css'; // Import the CSS

const MainPage = () => {
    // State for various parts of the page
    const [laatsteStemming, setLaatsteStemming] = useState(null); // Last mood voted
    const [stemmingToegestaan, setStemmingToegestaan] = useState(null); // Can vote mood? Initialize as null
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

    const handleChatSubmit = async () => { // Make async
        if (aiIsBezig || !chatInput.trim()) return;

        // Prepare user message content, but don't generate timestamp here
        const userMessageContent = chatInput.trim();

        // Clear input immediately, but don't add message to state yet
        const currentInput = chatInput; // Store current input in case of error (optional)
        setChatInput('');
        setAiIsBezig(true); // Set loading state

        try {
            const response = await fetch('/api/chat', { // Added /api prefix
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ vraag: userMessageContent }), // Send only the content
                credentials: 'include' // Add credentials here
            });

            if (response.ok) {
                const data = await response.json();
                // Add BOTH user and assistant messages AFTER successful backend response, using backend timestamps
                const messagesToAdd = [];
                if (data.user_message && data.user_message.tijd) {
                    messagesToAdd.push(data.user_message);
                } else {
                     console.warn("Backend did not return user_message object with tijd.");
                     // Optionally add a fallback with frontend time if needed, but ideally backend should always return it
                }
                if (data.assistant_message && data.assistant_message.tijd) {
                    messagesToAdd.push(data.assistant_message);
                     // Handle sound playback only if assistant message is valid
                     playTextToSpeech(data.assistant_message.content, userLanguage);
                } else {
                     console.warn("Backend did not return assistant_message object with tijd.");
                }

                if (messagesToAdd.length > 0) {
                    setChatMessages(prevMessages => [...prevMessages, ...messagesToAdd]);
                }

            } else {
                // Handle API errors
                const errorData = await response.json().catch(() => ({})); // Try to parse error JSON
                const errorText = errorData.antwoord || errorData.message || response.statusText;
                console.error("Failed to send chat message:", response.status, errorText);
                alert(`Error: ${errorText}`);
                // Optionally restore user input on error
                // setChatInput(currentInput);
            }
        } catch (error) {
            console.error("Error sending chat message:", error);
            const errorMessage = { role: "error", content: `Error sending message: ${error.message}`, tijd: new Date().toISOString() };
            setChatMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setAiIsBezig(false); // Reset loading state
        }
    };

    const handleDeleteMessage = async (messageId) => {
        if (!messageId) {
            console.error("Cannot delete message without an ID (tijd).");
            return;
        }
        console.log(`Attempting to delete message with ID: ${messageId}`);

        // Optional: Add a confirmation dialog
        // if (!window.confirm("Are you sure you want to delete this message?")) {
        //     return;
        // }

        try {
            const response = await fetch(`/api/chat/verwijder/${messageId}`, { // Added /api prefix
                method: 'DELETE',
                credentials: 'include' // Include credentials if needed by backend auth
            });

            if (response.ok) {
                console.log(`Message ${messageId} deleted successfully.`);
                // Update frontend state by removing the message
                setChatMessages(prevMessages => prevMessages.filter(msg => msg.tijd !== messageId));
                console.log(`Chat messages state updated after deleting ${messageId}.`); // Add log confirmation
            } else {
                const errorData = await response.json().catch(() => ({})); // Try to parse error
                console.error(`Failed to delete message ${messageId}:`, response.status, errorData.message || response.statusText);
                alert(`Error deleting message: ${errorData.message || response.statusText}`);
            }
        } catch (error) {
            console.error(`Network error deleting message ${messageId}:`, error);
            alert(`Network error: ${error.message}`);
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

    // Scroll chat box to bottom when messages change
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // Helper function to render feedback with paragraphs, bolding, and lists
    const renderFeedback = (feedbackText) => {
        if (!feedbackText || typeof feedbackText !== 'string') {
            return <p>{feedbackText || ''}</p>; // Handle empty/non-string feedback
        }

        const lines = feedbackText.split('\n');
        const renderedElements = [];
        // Only need ordered list items now
        let currentOrderedListItems = [];
        let keyCounter = 0; // For unique keys

        lines.forEach((line) => {
            const trimmedLine = line.trim();
            const orderedListMatch = trimmedLine.match(/^(\d+)\.\s*\*\*(.*)/); // Regex for "1. ** text"
            const bulletListMatch = trimmedLine.startsWith('- **');

            // --- Close any open ordered list if the current line is not a list item ---
            if (!orderedListMatch && !bulletListMatch && currentOrderedListItems.length > 0) {
                 // Close ordered list
                 renderedElements.push(
                    <ol key={`ol-${keyCounter++}`} style={{ paddingLeft: '20px' }}> {/* Basic ordered list styling */}
                        {currentOrderedListItems.map((item, itemIndex) => (
                            <li key={itemIndex}>{item}</li>
                        ))}
                    </ol>
                );
                currentOrderedListItems = [];
            }

            // --- Process the current line ---
            if (bulletListMatch) {
                // Treat as ordered list item
                const content = trimmedLine.substring(4).trim(); // Remove '- ** '
                if (content) {
                    currentOrderedListItems.push(content);
                }
            } else if (orderedListMatch) {
                // Ordered list item
                const content = orderedListMatch[2].trim(); // Get text after "1. ** "
                if (content) {
                    currentOrderedListItems.push(content);
                }
            } else if (trimmedLine) {
                 // Regular or bold paragraph (ensure no lists are open)
                 if (trimmedLine.startsWith('###')) {
                     const content = trimmedLine.substring(3).trim();
                     renderedElements.push(<p key={`p-${keyCounter++}`}><strong>{content}</strong></p>);
                 } else {
                     renderedElements.push(<p key={`p-${keyCounter++}`}>{trimmedLine}</p>);
                 }
            }
        });

        // --- Process any remaining ordered list items at the end ---
        if (currentOrderedListItems.length > 0) {
             renderedElements.push(
                <ol key={`ol-${keyCounter++}`} style={{ paddingLeft: '20px' }}>
                    {currentOrderedListItems.map((item, itemIndex) => (
                        <li key={itemIndex}>{item}</li>
                    ))}
                </ol>
            );
        }

        // If no elements were generated (e.g., only whitespace input), return null or an empty paragraph
        return renderedElements.length > 0 ? renderedElements : null;
    };

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
            {stemmingToegestaan === true && ( // Explicitly check for true
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
            {/* AI Feedback Area - Always Rendered */}
                <>
                    <div
                        id="aiFeedbackBox" // Keep ID for potential direct manipulation if needed, though state is preferred
                        className="ai-feedback-box"
                        aria-hidden={!feedbackVisible}
                        style={{ display: feedbackVisible ? 'block' : 'none' }}
                        // Render paragraphs manually instead of using dangerouslySetInnerHTML
                      >
                        {/* Show feedback or default message */}
                        {eigenFeedback
                            ? renderFeedback(eigenFeedback)
                            : <p>Submit your mood to get feedback.</p>
                        }
                      </div>
                      {/* Removed extraneous closing tag from previous diff error */}
                    <button
                        id="toggleFeedbackButton" // Keep ID for potential direct manipulation
                        aria-expanded={feedbackVisible}
                        aria-controls="aiFeedbackBox"
                        onClick={toggleFeedback}
                    >
                        {feedbackVisible ? '👆 Hide feedback' : '👇 Show feedback'}
                    </button>
                </>
            {/* End AI Feedback Area */}

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
                        <div style={{ fontSize: '0.9em', color: 'gray' }}>🕒 {new Date(msg.tijd).toLocaleTimeString('en-US')}</div>
                        <strong>{msg.role === "user" ? "You" : msg.role === "assistant" ? "AI" : "⚠️ Error"}:</strong>
                        {/* Add data-original-text attribute */}
                        <span className="bericht-tekst" data-original-text={msg.content}>{msg.content}</span>
                        {/* Add Delete Button */}
                        <button
                            onClick={() => handleDeleteMessage(msg.tijd)}
                            className="delete-message-button"
                            title="Delete this message"
                            aria-label="Delete message"
                            // Only show delete for user messages? Or all? Let's allow deleting all for now.
                            // style={{ display: msg.role === 'user' ? 'inline-block' : 'none' }} // Example to only show for user
                        >
                            🗑️ {/* Dustbin icon */}
                        </button>
                     </div>
                ))}
            </div>

            {/* WhatsApp-style chat input container */}
            <div style={{
                display: 'flex',
                alignItems: 'flex-end', // Align items to bottom as textarea grows
                padding: '8px 12px',
                border: '1px solid #ccc', // Subtle border
                borderRadius: '25px',    // Rounded corners
                backgroundColor: '#f0f2f5', // Light grey background like WhatsApp
                marginTop: '10px'       // Space above input
            }}>
                <textarea
                    id="chatInput" // Keep ID
                    placeholder="Ask a question... (max 250 characters)" // Updated placeholder
                    value={chatInput}
                    maxLength={250} // Enforce character limit
                    onChange={(e) => setChatInput(e.target.value)}
                    onInput={(e) => { // Auto-resize height
                        e.target.style.height = 'auto'; // Reset height
                        e.target.style.height = `${e.target.scrollHeight}px`; // Set to scroll height
                    }}
                    onKeyPress={(e) => {
                        // Allow Shift+Enter for new lines, Enter alone submits
                        if (e.key === 'Enter' && !e.shiftKey && !aiIsBezig) {
                            e.preventDefault(); // Prevent default Enter behavior (new line)
                            handleChatSubmit();
                        }
                    }}
                    disabled={aiIsBezig}
                    style={{ // Styling for the textarea
                        flexGrow: 1,           // Take available space
                        border: 'none',        // No border inside the container
                        outline: 'none',       // No focus outline
                        backgroundColor: 'transparent', // Inherit container background
                        resize: 'none',        // Disable manual resize handle
                        overflowY: 'hidden',   // Hide scrollbar until needed
                        minHeight: '24px',     // Minimum height matching button approx
                        maxHeight: '120px',    // Optional: Limit max height
                        padding: '6px 0',      // Vertical padding
                        marginRight: '10px',   // Space between textarea and button
                        lineHeight: '1.4',     // Adjust line height
                        fontSize: '1rem'       // Standard font size
                    }}
                />
                <button
                    id="sendButton" // Keep ID
                    onClick={handleChatSubmit}
                    disabled={aiIsBezig}
                    style={{ // Styling for the send button
                        border: 'none',
                        backgroundColor: '#00a884', // WhatsApp-like green
                        color: 'white',
                        borderRadius: '50%',    // Circular button
                        width: '40px',          // Fixed width
                        height: '40px',         // Fixed height
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1.5rem',     // Icon size
                        flexShrink: 0          // Prevent button from shrinking
                    }}
                    title="Send message"
                    aria-label="Send message"
                >
                    ➤ {/* Simple send icon */}
                </button>
            </div>

            {/* Community Section removed (moved to CommunityPage.jsx) */}

        </div>
    );
};

export default MainPage;