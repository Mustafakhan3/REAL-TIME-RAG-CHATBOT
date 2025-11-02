import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import toast from "react-hot-toast";

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/chat';

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
   try {
  await signInWithEmailAndPassword(auth, email, password);
  toast.success("Signed in successfully!");
  navigate(from, { replace: true });
} catch (err) {
  setError(err.message);
  toast.error("Sign-in failed!");
}
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-6">
      <div className="bg-white p-12 rounded-2xl shadow-2xl w-full max-w-lg">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-10">
          Sign In
        </h2>
        <form onSubmit={handleSignIn} className="space-y-8">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-6 py-4 border border-gray-300 text-xl rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-400 transition"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full px-6 py-4 border border-gray-300 text-xl rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-400 transition"
            required
          />
          {error && <p className="text-red-500 text-lg text-center">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 text-xl font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            Sign In
          </button>
        </form>
        <p className="mt-8 text-center text-gray-600 text-lg">
          Don’t have an account?{' '}
          <Link
            to="/signup"
            className="text-indigo-600 hover:underline font-medium"
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
