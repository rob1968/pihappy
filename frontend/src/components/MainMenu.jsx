import React from 'react';
import { Link } from 'react-router-dom';

const MainMenu = () => {
  return (
    <nav style={{ marginBottom: '20px', textAlign: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
      <Link to="/" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Home / Mood</Link>
      <Link to="/community" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Community</Link>
      <Link to="/pilocations" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Map</Link>
      <Link to="/profile" style={{ marginRight: '15px', textDecoration: 'none', color: '#5e459c', fontWeight: '500' }}>Profile</Link>
      {/* Add other links consistently here if needed in the future */}
    </nav>
  );
};

export default MainMenu;