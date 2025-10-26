// backend/lib/firebase.js
import admin from 'firebase-admin';

// Build creds from environment variables set in Railway
const serviceAccount = {
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  // Turn the \n sequences back into real newlines
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Initialize once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // databaseURL is optional for Firestore; omit unless you actually need RTDB
    // databaseURL: "https://rag-chatbot-d39eb.firebaseio.com",
  });
}

export const db = admin.firestore();
export default admin;
