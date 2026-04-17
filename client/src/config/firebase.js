/**
 * firebase.js — Firebase client SDK for Google Auth (lazy init)
 * Only initializes when getFirebaseAuth() is called, so missing
 * env vars won't crash the app on startup.
 */
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

let _auth = null;
let _provider = null;

export const getFirebaseAuth = () => {
    if (_auth) return { auth: _auth, googleProvider: _provider };

    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) throw new Error("Google Sign-In is not configured. Set VITE_FIREBASE_API_KEY in your .env file.");

    const app = initializeApp({
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
    });

    _auth = getAuth(app);
    _provider = new GoogleAuthProvider();
    return { auth: _auth, googleProvider: _provider };
};

export const isFirebaseConfigured = () => !!import.meta.env.VITE_FIREBASE_API_KEY;
