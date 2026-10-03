// ============================================================
// Firebase Admin SDK — Server-Side Only
// Lazy singleton: initialized on first use, not at import time.
// This prevents build failures when env vars aren't set locally.
//
// Required env vars (set in .env.local + Vercel dashboard):
//   FIREBASE_PROJECT_ID     — your Firebase project ID
//   FIREBASE_CLIENT_EMAIL   — service account client_email
//   FIREBASE_PRIVATE_KEY    — service account private_key (with real \n)
//
// Get them from: Firebase Console → Project Settings
//                → Service Accounts → Generate new private key
// ============================================================

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

let _auth: Auth | null = null;

/**
 * Returns the Firebase Admin Auth instance.
 * Lazily initialized on first call so the module can be imported
 * without crashing during build / when env vars aren't set.
 */
export function getAdminAuth(): Auth {
  if (_auth) return _auth;

  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel stores multiline secrets with literal \n — convert back
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      '[Firebase Admin] Missing env vars: FIREBASE_PROJECT_ID, ' +
      'FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY. ' +
      'See .env.example for setup instructions.'
    );
  }

  const app = getApps().length
    ? getApps()[0]!
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  _auth = getAuth(app);
  return _auth;
}
