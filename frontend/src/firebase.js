// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Import the functions you need from the SDKs you need
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD_8OXPWH6IGdIxGpM-c7U6yplQLJhb5r8",
  authDomain: "rag-chatbot-d39eb.firebaseapp.com",
  projectId: "rag-chatbot-d39eb",
  storageBucket: "rag-chatbot-d39eb.firebasestorage.app",
  messagingSenderId: "548741375612",
  appId: "1:548741375612:web:4507c81fc6f2e3d77e8bf9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
