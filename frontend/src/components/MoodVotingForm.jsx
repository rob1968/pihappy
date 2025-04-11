import React from 'react';

// Reusable Mood Button component (optional, but good practice)
const MoodButton = ({ mood, emoji, onMoodSubmit }) => (
  <button type="button" onClick={() => onMoodSubmit(`${mood} ${emoji}`)} className="mood-button">
    {mood} {emoji}
  </button>
);

const MoodVotingForm = ({ isVotingAllowed, onMoodSubmit }) => {
  if (!isVotingAllowed) {
    return null; // Don't render anything if voting is not allowed
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mood-voting-form"> {/* Prevent default form submission */}
      <label className="mood-voting-label">How are you feeling right now?</label>
      <div className="mood-columns">
        {/* Positive */}
        <div className="mood-column">
          <div className="mood-group-label">😊 Positive</div>
          <MoodButton mood="Happy" emoji="😊" onMoodSubmit={onMoodSubmit} />
          <MoodButton mood="Excited" emoji="🤩" onMoodSubmit={onMoodSubmit} />
          <MoodButton mood="Grateful" emoji="🙏" onMoodSubmit={onMoodSubmit} />
        </div>
        {/* Negative */}
        <div className="mood-column">
          <div className="mood-group-label">😔 Negative</div>
          <MoodButton mood="Sad" emoji="😔" onMoodSubmit={onMoodSubmit} />
          <MoodButton mood="Stressed" emoji="😰" onMoodSubmit={onMoodSubmit} />
          <MoodButton mood="Sick" emoji="🤒" onMoodSubmit={onMoodSubmit} />
        </div>
        {/* Neutral */}
        <div className="mood-column">
          <div className="mood-group-label">😐 Neutral</div>
          <MoodButton mood="Neutral" emoji="😐" onMoodSubmit={onMoodSubmit} />
          <MoodButton mood="Surprised" emoji="😲" onMoodSubmit={onMoodSubmit} />
          <MoodButton mood="Reflective" emoji="🤔" onMoodSubmit={onMoodSubmit} />
        </div>
      </div>
    </form>
  );
};

export default MoodVotingForm;