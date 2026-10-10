import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// Firebase web config — these are public identifiers, not secrets.
// Security is enforced by Firestore security rules and Firebase Auth.
// Source: Firebase Console → Project Settings → Your apps → Web app config.
const firebaseConfig = {
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "gen-lang-client-0109021341",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??
    "1:770404023630:web:195d3d49fb7701ecae721f",
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??
    "AIzaSyD4vNG0djkxmh780iEzELsORG4j5rTwt2o",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ??
    "gen-lang-client-0109021341.firebaseapp.com",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "770404023630",
};

// Non-default Firestore database ID (Project uses a named database)
const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ??
  "ai-studio-d22cf13b-5bf4-40cc-b966-42aeb5ff0e24";

// Reuse the existing app on hot reload / repeated imports.
const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app, firestoreDatabaseId);
export default app;
