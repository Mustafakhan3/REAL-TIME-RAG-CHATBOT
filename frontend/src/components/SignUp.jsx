import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import toast from "react-hot-toast";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast.success("Signup successful! Please sign in.");
      navigate("/signin", { replace: true });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please sign in instead.");
        toast.error("Email already in use!");
      } else {
        setError(err.message);
        toast.error("Signup failed!");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // keep your existing JSX (no change needed

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 px-6">
      <div className="bg-white p-12 rounded-2xl shadow-2xl w-full max-w-lg">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-10">
          Sign Up
        </h2>
        <form onSubmit={handleSignUp} className="space-y-8">
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
            disabled={isSubmitting}
            className={`w-full text-white py-4 text-xl font-semibold rounded-xl transition-all shadow-md hover:shadow-lg ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isSubmitting ? 'Creating account…' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-8 text-center text-gray-600 text-lg">
          Already have an account?{' '}
          <Link
            to="/signin"
            className="text-indigo-600 hover:underline font-medium"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
