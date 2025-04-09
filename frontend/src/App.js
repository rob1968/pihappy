import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import MainPage from "./components/MainPage"; // Import MainPage
import AuthForm from "./components/AuthForm"; // Import the combined form
import AddShopForm from "./components/AddShopForm"; // 👈 toevoegen
import CommunityPage from "./components/CommunityPage"; // Import CommunityPage

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} /> {/* Use MainPage for root */}
        <Route path="/register" element={<AuthForm />} /> {/* Use AuthForm */}
        <Route path="/login" element={<AuthForm />} /> {/* Use AuthForm */}
        <Route path="/AddShopForm" element={<AddShopForm />} /> {/* ✅ hier! */}
        <Route path="/community" element={<CommunityPage />} /> {/* Add route for CommunityPage */}
      </Routes>
    </Router>
  );
}

export default App;
