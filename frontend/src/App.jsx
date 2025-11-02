import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// ✅ Your components
import SignIn from "./components/SignIn";
import SignUp from "./components/SignUp";
import Chatbox from "./components/Chatbox";

// ✅ Optional: You can later add AuthListener here if needed for login-state routing

function App() {
  return (
    <Router>
<div className="min-h-screen bg-zinc-950">        {/* ✅ Global toast popup */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 2500,
            style: {
              fontSize: "15px",
              borderRadius: "10px",
              fontWeight: 500,
            },
            success: {
              iconTheme: { primary: "#fff", secondary: "#16a34a" },
              style: {
                background: "#16a34a", // emerald green
                color: "#fff",
              },
            },
            error: {
              style: {
                background: "#dc2626", // red
                color: "#fff",
              },
            },
          }}
        />

        {/* ✅ Route system */}
        <Routes>
          <Route path="/" element={<Navigate to="/signin" replace />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/chat" element={<Chatbox />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

