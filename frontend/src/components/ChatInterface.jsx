import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook

const ChatInterface = ({ initialMessages, userLanguage, soundOn, playTextToSpeech }) => {
    const { t } = useTranslation(); // Get the translation function
    const [chatMessages, setChatMessages] = useState(initialMessages || []);
    const [chatInput, setChatInput] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [aiIsBezig, setAiIsBezig] = useState(false); // Track if AI is processing chat
    const chatBoxRef = useRef(null); // Ref for scrolling chat box

    // Update internal messages if initialMessages prop changes (e.g., after initial fetch)
    useEffect(() => {
        setChatMessages(initialMessages || []);
    }, [initialMessages]);

    // Scroll chat box to bottom when messages change
    useEffect(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
        }
    }, [chatMessages]);

    // Define the DOM-based filtering function (moved from MainPage)
    const filterBerichten = () => {
        const zoekwoord = searchInput.toLowerCase(); // Use state variable
        const berichten = chatBoxRef.current?.querySelectorAll(".message");

        if (!berichten) return; // Exit if chatBoxRef is not ready or no messages

        berichten.forEach(bericht => {
            const content = bericht.getAttribute("data-content") || "";
            const matchTekst = !zoekwoord || content.includes(zoekwoord);
            bericht.style.display = matchTekst ? "block" : "none";

            const tekstElement = bericht.querySelector(".bericht-tekst");
            if (tekstElement) {
                if (!tekstElement.hasAttribute("data-original-text")) {
                     tekstElement.setAttribute("data-original-text", tekstElement.textContent);
                }
                tekstElement.innerHTML = tekstElement.getAttribute("data-original-text"); // Restore original

                if (matchTekst && zoekwoord) {
                    const regex = new RegExp(`(${zoekwoord.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
                    tekstElement.innerHTML = tekstElement.innerHTML.replace(regex, `<span class="highlight">$1</span>`);
                }
            }
        });
    };

    // Effect to run the filter function when search or messages change (moved from MainPage)
    useEffect(() => {
        filterBerichten();
    }, [searchInput, chatMessages]);

    // Chat Submit Handler (moved from MainPage)
    const handleChatSubmit = async () => {
        if (aiIsBezig || !chatInput.trim()) return;

        const userMessageContent = chatInput.trim();
        const currentInput = chatInput;
        setChatInput('');
        setAiIsBezig(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vraag: userMessageContent }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                const messagesToAdd = [];
                if (data.user_message && data.user_message.tijd) {
                    messagesToAdd.push(data.user_message);
                } else {
                     console.warn("Backend did not return user_message object with tijd.");
                }
                if (data.assistant_message && data.assistant_message.tijd) {
                    messagesToAdd.push(data.assistant_message);
                     // Use the passed-in playTextToSpeech function
                     if (soundOn && playTextToSpeech) {
                        playTextToSpeech(data.assistant_message.content, userLanguage);
                     }
                } else {
                     console.warn("Backend did not return assistant_message object with tijd.");
                }

                if (messagesToAdd.length > 0) {
                    setChatMessages(prevMessages => [...prevMessages, ...messagesToAdd]);
                }

            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorText = errorData.antwoord || errorData.message || response.statusText;
                console.error("Failed to send chat message:", response.status, errorText);
                alert(t('chat.errorAlert', { error: errorText }));
                // setChatInput(currentInput); // Optionally restore input
            }
        } catch (error) {
            console.error("Error sending chat message:", error);
            const errorMessage = { role: "error", content: t('chat.errorSendingMessage', { message: error.message }), tijd: new Date().toISOString() };
            setChatMessages(prevMessages => [...prevMessages, errorMessage]);
        } finally {
            setAiIsBezig(false);
        }
    };

    // Delete Message Handler (moved from MainPage)
    const handleDeleteMessage = async (messageId) => {
        if (!messageId) {
            console.error("Cannot delete message without an ID (tijd).");
            return;
        }
        console.log(`Attempting to delete message with ID: ${messageId}`);

        try {
            const response = await fetch(`/api/chat/verwijder/${messageId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                console.log(`Message ${messageId} deleted successfully.`);
                setChatMessages(prevMessages => prevMessages.filter(msg => msg.tijd !== messageId));
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Failed to delete message ${messageId}:`, response.status, errorData.message || response.statusText);
                alert(t('chat.errorDeletingMessage', { message: errorData.message || response.statusText }));
            }
        } catch (error) {
            console.error(`Network error deleting message ${messageId}:`, error);
            alert(t('chat.networkErrorAlert', { message: error.message }));
        }
    };

    return (
        <>
            {/* Search Input */}
            <input
                type="text"
                id="searchInput"
                placeholder={t('chat.searchPlaceholder')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="chat-search-input" // Add specific class if needed
            />

            {/* Chat Box Display */}
            <div id="chatBox" className="chat-box" ref={chatBoxRef}>
                {chatMessages.map((msg, index) => (
                     <div key={msg.tijd || index} className={`message ${msg.role}`} data-content={msg.content.toLowerCase()}>
                        <div style={{ fontSize: '0.9em', color: 'gray' }}>🕒 {new Date(msg.tijd).toLocaleTimeString('en-US')}</div>
                        <strong>{msg.role === "user" ? t('chat.roleUser') : msg.role === "assistant" ? t('chat.roleAssistant') : t('chat.roleError')}:</strong>
                        <span className="bericht-tekst" data-original-text={msg.content}>{msg.content}</span>
                        <button
                            onClick={() => handleDeleteMessage(msg.tijd)}
                            className="delete-message-button"
                            title={t('chat.deleteButtonTitle')}
                            aria-label={t('chat.deleteButtonTitle')}
                        >
                            🗑️
                        </button>
                     </div>
                ))}
            </div>

            {/* Chat Input Area - Using CSS classes now */}
            <div className="chat-input-area-whatsapp">
                <textarea
                    id="chatInput"
                    placeholder={t('chat.inputPlaceholder')}
                    value={chatInput}
                    maxLength={250}
                    onChange={(e) => setChatInput(e.target.value)}
                    onInput={(e) => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !aiIsBezig) {
                            e.preventDefault();
                            handleChatSubmit();
                        }
                    }}
                    disabled={aiIsBezig}
                    className="chat-textarea-whatsapp" // Use class for styling
                />
                <button
                    id="sendButton"
                    onClick={handleChatSubmit}
                    disabled={aiIsBezig}
                    className="chat-send-button-whatsapp" // Use class for styling
                    title={t('chat.sendButtonTitle')}
                    aria-label={t('chat.sendButtonTitle')}
                >
                    ➤
                </button>
            </div>
        </>
    );
};

export default ChatInterface;