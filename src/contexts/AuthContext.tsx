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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextType {
  user:               FirebaseUser | null;
  userProfile:        UserProfile  | null;
  /** True until BOTH auth state and profile fetch are resolved. */
  loading:            boolean;
  /** True when the signed-in user has no role yet (first-time setup). */
  needsOnboarding:    boolean;
  /**
   * Derived from `userProfile.role === 'super_admin'`.
   * To grant access: set `role: "super_admin"` on the user's Firestore doc.
   * No email is hardcoded in the client bundle.
   */
  isSuperAdmin:       boolean;
  logout:             () => Promise<void>;
  /** Triggers the Google sign-in popup. State is managed by onAuthStateChanged. */
  loginWithGoogle:    () => Promise<void>;
  setUserProfile:     React.Dispatch<React.SetStateAction<UserProfile | null>>;
  setNeedsOnboarding: React.Dispatch<React.SetStateAction<boolean>>;
  refreshUserProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user:               null,
  userProfile:        null,
  loading:            true,
  needsOnboarding:    false,
  isSuperAdmin:       false,
  logout:             async () => {},
  loginWithGoogle:    async () => {},
  setUserProfile:     () => {},
  setNeedsOnboarding: () => {},
  refreshUserProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user,            setUser]            = useState<FirebaseUser | null>(null);
  const [userProfile,     setUserProfile]     = useState<UserProfile  | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Role-based — no email hardcoded in the bundle.
  // Grant super admin by setting role:"super_admin" in Firestore users/{uid}.
  const isSuperAdmin = userProfile?.role === 'super_admin';

  // ── Single source of truth for auth state ─────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Signed out
        setUser(null);
        setUserProfile(null);
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userSnap   = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          // ── First sign-in: write skeleton doc ──────────────────────────────
          await setDoc(userDocRef, {
            uid:           firebaseUser.uid,
            email:         firebaseUser.email        ?? '',
            displayName:   firebaseUser.displayName  ?? 'New User',
            photoURL:      firebaseUser.photoURL      ?? null,
            role:          null,
            societyId:     null,
            universityName:'',
            bio:           '',
            contactInfo:   '',
            createdAt:     serverTimestamp(),
            updatedAt:     serverTimestamp(),
          });

          // Force-refresh the ID token so Firestore security rules see the
          // fully-propagated OAuth token on the very next read.
          // This replaces the old window.location.reload() — no page flash.
          await firebaseUser.getIdToken(/* forceRefresh= */ true);
        }

        // ── Fetch profile (new and returning users converge here) ───────────
        const profile = await getUserProfile(firebaseUser.uid);
        setUser(firebaseUser);
        setUserProfile(profile);
        setNeedsOnboarding(!profile?.role);
      } catch (err) {
        // Network / Firestore error — still unblock the app.
        console.error('[AuthContext] Error during auth state resolution:', err);
        setUser(firebaseUser);
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const refreshUserProfile = async () => {
    if (!user) return;
    const profile = await getUserProfile(user.uid);
    if (profile) {
      setUserProfile(profile);
      setNeedsOnboarding(!profile.role);
    }
  };

  const logout = async () => {
    // Clear state immediately for instant UI response;
    // onAuthStateChanged will also fire with null — that's fine.
    setUser(null);
    setUserProfile(null);
    setNeedsOnboarding(false);
    await signOut(auth);
  };

  /**
   * Triggers the Google sign-in popup only.
   * ALL state updates (user, userProfile, needsOnboarding) are handled
   * exclusively by onAuthStateChanged — no race conditions, no duplicate reads.
   */
  const loginWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
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