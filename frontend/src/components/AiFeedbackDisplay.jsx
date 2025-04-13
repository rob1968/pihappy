import React from 'react';
import { useTranslation } from 'react-i18next'; // Import the hook

// Helper function moved inside the component to access 't'


const AiFeedbackDisplay = ({ feedbackText, isVisible, onToggleVisibility }) => {
  const { t } = useTranslation(); // Get the translation function

  // Helper function to render feedback with paragraphs, bolding, and lists
  const renderFeedback = (feedbackText) => {
      if (!feedbackText || typeof feedbackText !== 'string') {
          // Return default message if feedback is empty/invalid
          return <p>{t('aiFeedback.defaultMessage')}</p>;
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

      // If no elements were generated (e.g., only whitespace input), return default message
      return renderedElements.length > 0 ? renderedElements : <p>{t('aiFeedback.defaultMessage')}</p>;
  };

  return (
    <>
      <div
        id="aiFeedbackBox" // Keep ID if needed elsewhere, though unlikely now
        className="ai-feedback-box"
        aria-hidden={!isVisible}
        style={{ display: isVisible ? 'block' : 'none' }}
      >
        {/* Render feedback using the helper function */}
        {renderFeedback(feedbackText)}
      </div>
      <button
        id="toggleFeedbackButton" // Keep ID if needed
        aria-expanded={isVisible}
        aria-controls="aiFeedbackBox"
        onClick={onToggleVisibility}
        className="toggle-feedback-button" // Add a class for potential styling
      >
        {isVisible ? t('aiFeedback.hideButton') : t('aiFeedback.showButton')}
      </button>
    </>
  );
};

export default AiFeedbackDisplay;