import admin from 'firebase-admin';
import dotenv from 'dotenv';
import serviceAccount from '../config/serviceAccountKey.js';

dotenv.config();

// Dynamic import for the service account JSON with the correct assertion

// Initialize Firebase Admin SDK with service account credentials
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://rag-chatbot-d39eb.firebaseio.com",  // Replace with your Firebase database URL
});

const db = admin.firestore(); // Initialize Firestore
export { db };  // Export Firestore to use in routes
