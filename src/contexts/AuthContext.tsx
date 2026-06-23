'use client';
 
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getUserProfile } from '@/lib/firestore';
import type { UserProfile } from '@/types';
 
// ─── Super Admin ──────────────────────────────────────────────────────────────
export const SUPER_ADMIN_EMAIL = 'thekamranayaz.92@gmail.com';
 
interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  // `loading` remains true until BOTH the sync-check AND profile fetch are done.
  // Nothing in the app renders while this is true, so first-time users never
  // see a flash of the wrong UI state before the reload fires.
  loading: boolean;
  needsOnboarding: boolean;
  isSuperAdmin: boolean;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<{ isNew: boolean }>;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setNeedsOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
  refreshUserProfile: () => Promise<void>;
}
 
const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  needsOnboarding: false,
  isSuperAdmin: false,
  logout: async () => {},
  loginWithGoogle: async () => ({ isNew: false }),
  setUserProfile: () => {},
  setNeedsOnboarding: () => {},
  refreshUserProfile: async () => {},
});
 
export const useAuth = () => useContext(AuthContext);
 
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
 
  const isSuperAdmin =
    !!user?.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
 
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // ── First-Visit Sync Check ─────────────────────────────────────────
        //
        // WHY THIS EXISTS:
        //   On the very first sign-in, Firebase Auth completes successfully but
        //   the fresh OAuth token has not yet been fully propagated to the
        //   Firestore permission layer. Any Firestore write attempted in this
        //   window fails with a CORS/permission error. The reliable fix is one
        //   automatic page reload, which forces the browser to re-negotiate the
        //   Auth token with all Firebase services from a clean state.
        //
        // HOW IT WORKS:
        //   1. Check whether a document exists in /users/{uid}.
        //   2. If it does NOT exist → this is a first-time user.
        //        a. Write the skeleton document now (the token is valid enough
        //           for this single write even in the degraded state).
        //        b. Reload the page. The next load will see the document, skip
        //           this branch entirely, and have a fully synced token.
        //   3. If it DOES exist → returning user. Do nothing. Continue normally.
        //
        // The `loading` state stays `true` throughout this check so the app
        // never renders its post-auth UI before the reload fires. The user
        // only ever sees the loading screen for the brief moment between sign-in
        // and the automatic reload.
 
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userDocRef);
 
          if (!userSnap.exists()) {
            // ── New user: write skeleton doc then reload ─────────────────────
            console.log('[AuthContext] First-visit sync: no user doc found. Writing skeleton and reloading…');
 
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              displayName: firebaseUser.displayName ?? 'New User',
              photoURL: firebaseUser.photoURL ?? null,
              role: null,
              societyId: null,
              universityName: '',
              bio: '',
              contactInfo: '',
              // createdAt marks the moment the doc was first written,
              // distinct from when the user actually completed onboarding.
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
 
            console.log('[AuthContext] Skeleton doc written. Reloading page to sync credentials…');
 
            // Keep loading=true so nothing renders before the reload.
            // The reload is the last thing that happens — no further state
            // updates are needed or useful after this line.
            window.location.reload();
            return; // Prevent any code below from running before the reload.
          }
 
          // ── Returning user: doc exists, proceed normally ─────────────────
          console.log('[AuthContext] User doc exists. Skipping sync reload.');
          setUser(firebaseUser);
 
          const profile = await getUserProfile(firebaseUser.uid);
          if (profile) {
            setUserProfile(profile);
            setNeedsOnboarding(!profile.role);
          } else {
            setUserProfile(null);
            setNeedsOnboarding(true);
          }
        } catch (error) {
          // If the Firestore check itself fails (e.g. network error), we
          // still set the user so the app is not permanently stuck on the
          // loading screen. The sync will be retried on the next sign-in.
          console.error('[AuthContext] First-visit sync check error:', error);
          setUser(firebaseUser);
          setUserProfile(null);
        }
      } else {
        // Signed out
        setUser(null);
        setUserProfile(null);
        setNeedsOnboarding(false);
      }
 
      // Only reached when: (a) user doc already existed (returning user), or
      // (b) the user is null (signed out), or (c) the Firestore check failed.
      // NOT reached when a reload has been triggered (the `return` above exits
      // before this line for new users).
      setLoading(false);
    });
 
    return () => unsubscribe();
  }, []);
 
  const refreshUserProfile = async () => {
    if (!user) return;
    const profile = await getUserProfile(user.uid);
    if (profile) {
      setUserProfile(profile);
      setNeedsOnboarding(!profile.role);
    }
  };
 
  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setNeedsOnboarding(false);
  };
 
  const loginWithGoogle = async (): Promise<{ isNew: boolean }> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const userDocRef = doc(db, 'users', result.user.uid);
    const userDoc = await getDoc(userDocRef);
 
    if (!userDoc.exists()) {
      // Note: for popup flow, the onAuthStateChanged listener above will fire
      // immediately after this function returns and will run the sync-check.
      // We still return { isNew: true } here for any callers that need it.
      setUser(result.user);
      setNeedsOnboarding(true);
      setUserProfile(null);
      return { isNew: true };
    } else {
      const profile = await getUserProfile(result.user.uid);
      setUser(result.user);
      setUserProfile(profile);
      setNeedsOnboarding(!profile?.role);
      return { isNew: false };
    }
  };
 
  return (
    <AuthContext.Provider value={{
      user, userProfile, loading, needsOnboarding, isSuperAdmin,
      logout, loginWithGoogle, setUserProfile, setNeedsOnboarding,
      refreshUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};