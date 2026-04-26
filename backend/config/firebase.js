/**
 * firebase.js — Production Ready Firebase Admin (FCM Safe Init)
 * ✅ Only initializes once
 * ✅ Verifies admin.messaging() exists before marking as available
 * ✅ Safe JSON parsing
 * ✅ Graceful fallback if Firebase not configured
 */

import admin from "firebase-admin";

let firebaseApp = null;
let fcmAvailable = false;
let initAttempted = false;

export const initFirebase = () => {
    // Prevent duplicate initialization attempts
    if (initAttempted) {
        return firebaseApp;
    }
    initAttempted = true;

    // If already initialized by another process, reuse it
    if (admin.apps.length) {
        firebaseApp = admin.app();

        // Verify messaging is actually available
        try {
            if (admin.messaging()) {
                fcmAvailable = true;
                console.log("✅ [Firebase] Already initialized (messaging available)");
                return firebaseApp;
            }
        } catch (err) {
            console.warn("⚠️  [Firebase] Already initialized but messaging unavailable");
            fcmAvailable = false;
            return firebaseApp;
        }
    }

    try {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
        const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (serviceAccountJson) {
            let parsed;

            try {
                // Parse the Firebase service account JSON
                parsed = JSON.parse(serviceAccountJson);

                // Validate required fields
                if (!parsed.private_key || !parsed.client_email || !parsed.project_id) {
                    throw new Error("Missing required Firebase service account fields (private_key, client_email, project_id)");
                }
            } catch (parseErr) {
                console.error("❌ [Firebase] Invalid FIREBASE_SERVICE_ACCOUNT JSON - cannot parse");
                console.error("   Error:", parseErr.message);
                console.error("   Make sure FIREBASE_SERVICE_ACCOUNT is a valid JSON string");
                fcmAvailable = false;
                return null;
            }

            firebaseApp = admin.initializeApp({
                credential: admin.credential.cert(parsed),
                projectId: parsed.project_id,
            });

            // Verify messaging is available
            try {
                const messaging = admin.messaging();
                if (messaging) {
                    fcmAvailable = true;
                    console.log("✅ [Firebase] Initialized with service account (messaging UP)");
                    console.log(`   Project: ${parsed.project_id} | Email: ${parsed.client_email}`);
                } else {
                    console.warn("⚠️  [Firebase] Initialized but messaging() not available");
                    fcmAvailable = false;
                }
            } catch (msgErr) {
                console.warn("⚠️  [Firebase] Initialized but messaging() failed:", msgErr.message);
                fcmAvailable = false;
            }

        } else if (credPath) {
            firebaseApp = admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });

            // Verify messaging is available
            try {
                const messaging = admin.messaging();
                if (messaging) {
                    fcmAvailable = true;
                    console.log("✅ [Firebase] Initialized with default credentials (messaging UP)");
                } else {
                    console.warn("⚠️  [Firebase] Initialized but messaging() not available");
                    fcmAvailable = false;
                }
            } catch (msgErr) {
                console.warn("⚠️  [Firebase] Initialized but messaging() failed:", msgErr.message);
                fcmAvailable = false;
            }

        } else {
            console.log("📦 [Firebase] Not configured → FCM disabled (no FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS)");
            fcmAvailable = false;
            return null;
        }

    } catch (err) {
        console.error("❌ [Firebase] Init failed:", err.message);
        fcmAvailable = false;
        return null;
    }

    return firebaseApp;
};

export const isFcmAvailable = () => fcmAvailable;

export const getFirebaseAdmin = () => admin;