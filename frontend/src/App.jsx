// src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import SignUp from './components/SignUp.jsx';
import SignIn from './components/SignIn.jsx';
import Chatbox from './components/Chatbox.jsx';
import { auth } from './firebase';

// Simple auth gate to protect private routes
function RequireAuth({ children }) {
  const location = useLocation();
  const user = auth.currentUser;
  // If not logged in, send to /signin but remember where they tried to go
  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/signin" replace />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chatbox />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/signin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
