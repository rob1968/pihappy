import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
// MainPage is now imported within HomePageWrapper
import AuthForm from "./components/AuthForm"; // Import the combined form
import AddShopForm from "./components/AddShopForm"; // 👈 toevoegen
import CommunityPage from "./components/CommunityPage"; // Import CommunityPage
import Pilocations from "./components/Pilocations"; // Import Pilocations map page
import ProfilePage from "./components/ProfilePage"; // Import ProfilePage
import WelcomePage from "./components/WelcomePage"; // Import WelcomePage
import HomePageWrapper from "./components/HomePageWrapper"; // Import the wrapper
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePageWrapper />} /> {/* Use wrapper for root */}
        <Route path="/register" element={<AuthForm />} /> {/* Use AuthForm */}
        <Route path="/login" element={<AuthForm />} /> {/* Use AuthForm */}
        <Route path="/AddShopForm" element={<AddShopForm />} /> {/* ✅ hier! */}
        <Route path="/community" element={<CommunityPage />} /> {/* Add route for CommunityPage */}
        <Route path="/pilocations" element={<Pilocations />} /> {/* Add route for Pilocations map */}
        <Route path="/profile/:userId" element={<ProfilePage />} /> {/* Route for specific user profiles */}
        <Route path="/profile" element={<ProfilePage />} /> {/* Route for the logged-in user's profile */}
        <Route path="/welcome" element={<WelcomePage />} /> {/* Add route for WelcomePage */}
      </Routes>
    </Router>
  );
}

export default App;
