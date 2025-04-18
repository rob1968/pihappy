import React from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook

// Reusable Mood Button component (optional, but good practice)
// Reusable Mood Button component (optional, but good practice)
const MoodButton = ({ moodKey, moodText, emoji, onMoodSubmit }) => ( // Added moodKey and moodText
  <button type="button" onClick={() => onMoodSubmit(`${moodKey} ${emoji}`)} className="mood-button">
    {moodText} {emoji} {/* Display translated text */}
  </button>
);

const MoodVotingForm = ({ isVotingAllowed, onMoodSubmit }) => {
  const { t } = useTranslation(); // Get the translation function
  if (!isVotingAllowed) {
    return null; // Don't render anything if voting is not allowed
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mood-voting-form"> {/* Prevent default form submission */}
      <label className="mood-voting-label">{t('moodVoting.question')}</label>
      <div className="mood-columns">
        {/* Positive */}
        <div className="mood-column">
          <div className="mood-group-label"> {t('moodVoting.positiveGroup')}</div>
          <MoodButton moodKey="Happy" moodText={t('moodVoting.moodHappy')} emoji="😊" onMoodSubmit={onMoodSubmit} />
          <MoodButton moodKey="Excited" moodText={t('moodVoting.moodExcited')} emoji="🤩" onMoodSubmit={onMoodSubmit} />
          <MoodButton moodKey="Grateful" moodText={t('moodVoting.moodGrateful')} emoji="🙏" onMoodSubmit={onMoodSubmit} />
        </div>
        {/* Negative */}
        <div className="mood-column">
          <div className="mood-group-label"> {t('moodVoting.negativeGroup')}</div>
          <MoodButton moodKey="Sad" moodText={t('moodVoting.moodSad')} emoji="😔" onMoodSubmit={onMoodSubmit} />
          <MoodButton moodKey="Stressed" moodText={t('moodVoting.moodStressed')} emoji="😰" onMoodSubmit={onMoodSubmit} />
          <MoodButton moodKey="Sick" moodText={t('moodVoting.moodSick')} emoji="🤒" onMoodSubmit={onMoodSubmit} />
        </div>
        {/* Neutral */}
        <div className="mood-column">
          <div className="mood-group-label"> {t('moodVoting.neutralGroup')}</div>
          <MoodButton moodKey="Neutral" moodText={t('moodVoting.moodNeutral')} emoji="😐" onMoodSubmit={onMoodSubmit} />
          <MoodButton moodKey="Surprised" moodText={t('moodVoting.moodSurprised')} emoji="😲" onMoodSubmit={onMoodSubmit} />
          <MoodButton moodKey="Reflective" moodText={t('moodVoting.moodReflective')} emoji="🤔" onMoodSubmit={onMoodSubmit} />
        </div>
      </div>
    </form>
  );
};

export default MoodVotingForm;