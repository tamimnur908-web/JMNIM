import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { initializeFirestore, getFirestore, Firestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyCCA9L_y-389xBnuWwR183v6ZEjg2u9KSQ",
  authDomain: "jmnim-db0df.firebaseapp.com",
  projectId: "jmnim-db0df",
  storageBucket: "jmnim-db0df.firebasestorage.app",
  messagingSenderId: "97511284898",
  appId: "1:97511284898:web:603a9fdc1c0faaad8877fb"
};

// Initialize Firebase safely
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Ensure login session is always saved and persistent across browser refreshes/closes
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Could not set Firebase auth persistence:", err);
});

let dbInstance: Firestore;
try {
  dbInstance = initializeFirestore(app, {
    ignoreUndefinedProperties: true
  });
} catch {
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
