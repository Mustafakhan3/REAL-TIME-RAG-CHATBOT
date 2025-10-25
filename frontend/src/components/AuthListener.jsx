import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';  // Use named import for `auth` from firebase.js
import { useNavigate } from 'react-router-dom';  // Use `useNavigate` in React Router v6

const AuthListener = () => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();  // Use `useNavigate` hook

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUser(user);
        navigate('/chat');  // Redirect to chat page
      } else {
        setUser(null);
        navigate('/signin');  // Redirect to sign-in page
      }
    });

    return () => unsubscribe();  // Clean up the subscription on unmount
  }, [navigate]);

  return <div>{user ? <p>Welcome, {user.email}</p> : <p>Please sign in</p>}</div>;
};

export default AuthListener;
