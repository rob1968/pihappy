import React, { useEffect, useState, useRef } from 'react';

const App = () => {
  const [chatHistory, setChatHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [communityInput, setCommunityInput] = useState('');
  const [feedbackVisible, setFeedbackVisible] = useState(true);
  const [feedbackText, setFeedbackText] = useState('');
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem('geluidAan') === 'true');
  const [laatsteStemming, setLaatsteStemming] = useState(null);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    fetchChatHistory();
    fetchCommunityStats();
    setFeedbackText('Example AI feedback message.');
  }, []);

  useEffect(() => {
    localStorage.setItem('geluidAan', soundOn);
  }, [soundOn]);

  const fetchChatHistory = () => {
    setChatHistory([]);
  };

  const fetchCommunityStats = () => {
    // Placeholder
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const newMessage = { role: 'user', content: chatInput, time: new Date() };
    setChatHistory([...chatHistory, newMessage]);
    setChatInput('');

    setTimeout(() => {
      const response = { role: 'assistant', content: 'AI response to: ' + newMessage.content, time: new Date() };
      setChatHistory(prev => [...prev, response]);
      if (soundOn) playSpeech(response.content);
    }, 1000);
  };

  const playSpeech = (text) => {
    console.log('Playing speech:', text);
  };

  const handleCommunitySend = () => {
    if (communityInput.trim().split(/\s+/).length > 10) {
      alert('⚠️ Maximaal 10 woorden toegestaan.');
      return;
    }
    setCommunityInput('');
  };

  const handleStemmingClick = (value) => {
    fetch('/nieuw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stemming: value })
    }).then(() => {
      setLaatsteStemming(value);
    });
  };

  const filteredMessages = chatHistory.filter(msg =>
    msg.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleFeedback = () => setFeedbackVisible(!feedbackVisible);

  return (
    <div className="container mx-auto p-4 text-center">
      <h1 className="text-3xl font-bold">PiHappy</h1>

      {laatsteStemming && (
        <div className="text-2xl font-bold mt-4 text-green-600">
          Your feeling today is: {laatsteStemming}
        </div>
      )}

      <div className="mood-columns flex flex-wrap justify-center gap-6 mt-6">
        <div className="mood-column flex flex-col items-center gap-2">
          <div className="font-bold">😊 Positive</div>
          <button onClick={() => handleStemmingClick('Happy 😊')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Happy 😊</button>
          <button onClick={() => handleStemmingClick('Excited 🤩')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Excited 🤩</button>
          <button onClick={() => handleStemmingClick('Grateful 🙏')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Grateful 🙏</button>
        </div>
        <div className="mood-column flex flex-col items-center gap-2">
          <div className="font-bold">😔 Negative</div>
          <button onClick={() => handleStemmingClick('Sad 😔')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Sad 😔</button>
          <button onClick={() => handleStemmingClick('Stressed 😰')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Stressed 😰</button>
          <button onClick={() => handleStemmingClick('Sick 🤒')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Sick 🤒</button>
        </div>
        <div className="mood-column flex flex-col items-center gap-2">
          <div className="font-bold">😐 Neutral</div>
          <button onClick={() => handleStemmingClick('Neutral 😐')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Neutral 😐</button>
          <button onClick={() => handleStemmingClick('Surprised 😲')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Surprised 😲</button>
          <button onClick={() => handleStemmingClick('Reflective 🤔')} className="p-2 rounded bg-gray-100 hover:bg-gray-300 min-w-[130px]">Reflective 🤔</button>
        </div>
      </div>

      {feedbackText && (
        <>
          {feedbackVisible && (
            <div className="ai-feedback-box bg-yellow-100 border-l-4 border-yellow-300 p-4 rounded text-left my-4">
              {feedbackText}
            </div>
          )}
          <button
            className="mb-4 p-2 border rounded"
            onClick={toggleFeedback}
          >
            {feedbackVisible ? '👆 Hide feedback' : '👇 Show feedback'}
          </button>
        </>
      )}

      <button
        className="mb-4 p-2 border rounded"
        onClick={() => setSoundOn(prev => !prev)}
      >
        {soundOn ? '🔊 Sound: On' : '🔇 Sound: Off'}
      </button>

      <input
        type="text"
        className="border p-2 w-full max-w-md"
        placeholder="Search in messages..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div
        ref={chatBoxRef}
        className="chat-box border p-4 h-80 overflow-y-scroll text-left my-4"
      >
        {filteredMessages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role} my-2 p-2 rounded ${msg.role === 'user' ? 'bg-blue-100 text-right' : 'bg-gray-200 text-left'}`}>
            <div className="text-xs text-gray-500">🕒 {new Date(msg.time).toLocaleTimeString('nl-NL')}</div>
            <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong> {msg.content}
          </div>
        ))}
      </div>

      <input
        type="text"
        className="border p-2 w-full max-w-md"
        placeholder="Ask a question..."
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
      />
      <button onClick={handleSendChat} className="p-2 border rounded ml-2">Send</button>

      <h2 className="text-xl font-bold mt-8">🌍 Community Input</h2>
      <input
        type="text"
        className="border p-2 w-full max-w-md"
        placeholder="Share your idea or suggestion (max 10 words)"
        value={communityInput}
        onChange={(e) => setCommunityInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCommunitySend()}
      />
      <button onClick={handleCommunitySend} className="p-2 border rounded ml-2">Send</button>
    </div>
  );
};

export default App;
