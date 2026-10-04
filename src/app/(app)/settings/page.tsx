"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  GoogleAuthProvider,
  reauthenticateWithPopup,
  signOut,
  deleteUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  updateUserProfile,
  uploadFile,
  deleteFile,
  deleteUserAccount,
} from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { sanitizeImageUrl } from "@/lib/utils";
import Image from "next/image";

// ─── Shared card styles ────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--bg-card)",
  border: "1px solid var(--border-primary)",
  borderRadius: "var(--radius-xl)",
  overflow: "hidden",
  marginBottom: 16,
};
const head: React.CSSProperties = {
  padding: "14px 18px",
  borderBottom: "1px solid var(--border-primary)",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: 14,
  color: "var(--text-primary)",
};
const body: React.CSSProperties = {
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

// ─── Delete Account Modal ─────────────────────────────────────────────────────
function DeleteAccountModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const ready = confirmText === "DELETE";

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 18,
          padding: "28px 24px",
          width: 420,
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
            border: "2px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            margin: "0 auto 18px",
          }}
        >
          ⚠️
        </div>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 18,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 8,
            color: "var(--text-primary)",
          }}
        >
          Delete Your Account?
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.65,
            marginBottom: 20,
          }}
        >
          This permanently erases your profile, follows, and notifications.
          <br />
          <strong style={{ color: "#ef4444" }}>This cannot be undone.</strong>
        </p>

        {/* Google re-auth note */}
        <div
          style={{
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 16,
          }}
        >
          🔑 A Google sign-in popup will appear to verify your identity before
          deletion.
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 5,
            }}
          >
            Type <strong style={{ color: "#ef4444" }}>DELETE</strong> to confirm
          </label>
          <input
            className="input"
            placeholder="DELETE"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            style={{ width: "100%", fontFamily: "monospace", letterSpacing: 2 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            disabled={!ready || loading}
            onClick={onConfirm}
            style={{
              padding: "9px 20px",
              borderRadius: "var(--radius-lg)",
              border: "none",
              background:
                ready && !loading
                  ? "linear-gradient(135deg,#ef4444,#dc2626)"
                  : "rgba(239,68,68,0.3)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: ready && !loading ? "pointer" : "not-allowed",
              fontFamily: "var(--font-body)",
              transition: "all .15s",
            }}
          >
            {loading ? "⏳ Deleting…" : "🗑 Delete My Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const router = useRouter();
  const { user, userProfile, refreshUserProfile, loginWithGoogle } = useAuth();

  // Profile form
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    contactInfo: "",
    universityName: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Lazy init — reads localStorage on first render; no useEffect needed.
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    return (
      (localStorage.getItem("eduglobe-theme") as "dark" | "light") ?? "dark"
    );
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    localStorage.setItem("eduglobe-theme", next);
  };

  // Populate form from profile whenever it loads/refreshes from context.
  // setState inside useEffect is intentional here — syncing external data to local form state.
  useEffect(() => {
    if (userProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        displayName: userProfile.displayName ?? "",
        bio: userProfile.bio ?? "",
        contactInfo: userProfile.contactInfo ?? "",
        universityName: userProfile.universityName ?? "",
      });
      setPreviewURL(userProfile.photoURL);
    }
  }, [userProfile]);

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const oldPhotoURL = userProfile?.photoURL ?? null;
    setPreviewURL(URL.createObjectURL(file));
    setUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadFile(
        file,
        `avatars/${user.uid}/${Date.now()}_${file.name}`,
        (pct) => setUploadProgress(pct),
      );
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshUserProfile();
      toast.success("Profile picture updated!");
      if (oldPhotoURL) deleteFile(oldPhotoURL);
    } catch {
      toast.error("Failed to upload photo");
      setPreviewURL(userProfile?.photoURL ?? null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!form.displayName.trim())
      return toast.error("Display name is required");
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        contactInfo: form.contactInfo.trim(),
        universityName: form.universityName.trim(),
      });
      await refreshUserProfile();
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
      router.push("/");
    } catch {
      toast.error("Failed to sign out");
      setSigningOut(false);
    }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } catch {
      toast.error("Unable to sign in. Please try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    try {
      // Re-authenticate via Google popup
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      // Purge Firestore data
      await deleteUserAccount(user.uid);
      // Delete Firebase Auth account
      await deleteUser(user);
      toast.success("Account deleted. Goodbye 👋");
      router.push("/");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("popup-closed") || msg.includes("cancelled")) {
        toast.error("Re-authentication cancelled — account not deleted");
      } else {
        toast.error("Failed to delete account. Please try again.");
      }
      setDeletingAccount(false);
      setShowDeleteModal(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div
        style={{
          padding: "var(--page-padding-y) var(--page-padding-x)",
          maxWidth: 720,
        }}
      >
        <div style={card}>
          <div style={head}>Sign in to view Settings</div>
          <div style={body}>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              Sign in to manage your account and preferences.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleSignIn}
              disabled={signingIn}
              style={{ alignSelf: "flex-start" }}
            >
              {signingIn ? "⏳ Signing in…" : "Sign in with Google"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "var(--page-padding-y) var(--page-padding-x)",
        maxWidth: 720,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 22,
          fontWeight: 800,
          marginBottom: 4,
        }}
      >
        ⚙️ Settings
      </h1>
      <p
        style={{
          color: "var(--text-tertiary)",
          fontSize: 13,
          marginBottom: 24,
        }}
      >
        Manage your account and preferences
      </p>

      {/* ─── Profile Picture ─── */}
      <div style={card}>
        <div style={head}>Profile Picture</div>
        <div
          style={{
            ...body,
            flexDirection: "row",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            {previewURL ? (
              <Image
                src={sanitizeImageUrl(previewURL)}
                alt="Profile"
                width={80}
                height={80}
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid var(--border-primary)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "var(--gradient-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#fff",
                }}
              >
                {initials}
              </div>
            )}
            {uploading && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                {uploadProgress}%
              </div>
            )}
          </div>
          <div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ marginBottom: 6 }}
            >
              {uploading ? "⏳ Uploading…" : "📷 Change Photo"}
            </button>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              JPG, PNG, GIF · Stored on Cloudinary
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoSelect}
            />
          </div>
        </div>
      </div>

      {/* ─── Account Information ─── */}
      <div style={card}>
        <div style={head}>Account Information</div>
        <div style={body}>
          <div className="input-group">
            <label className="input-label">Email Address</label>
            <input
              className="input"
              value={user?.email ?? ""}
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            />
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div className="input-group">
              <label className="input-label">Display Name *</label>
              <input
                className="input"
                placeholder="Your name"
                value={form.displayName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, displayName: e.target.value }))
                }
              />
            </div>
            <div className="input-group">
              <label className="input-label">University</label>
              <input
                className="input"
                placeholder="e.g., NUST, Islamabad"
                value={form.universityName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, universityName: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Bio</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Tell people about yourself…"
              value={form.bio}
              onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              style={{ resize: "vertical" }}
            />
          </div>
          <div className="input-group">
            <label className="input-label">
              Contact Info{" "}
              <span style={{ fontWeight: 400, opacity: 0.6 }}>
                — optional, visible to society members
              </span>
            </label>
            <input
              className="input"
              placeholder="LinkedIn URL or phone number"
              value={form.contactInfo}
              onChange={(e) =>
                setForm((p) => ({ ...p, contactInfo: e.target.value }))
              }
            />
          </div>
          <div className="input-group">
            <label className="input-label">Role</label>
            <input
              className="input"
              value={
                userProfile?.role
                  ? userProfile.role
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())
                  : "Not set"
              }
              disabled
              style={{ opacity: 0.5, cursor: "not-allowed" }}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveProfile}
            disabled={saving}
            style={{ alignSelf: "flex-start" }}
          >
            {saving ? "⏳ Saving…" : "💾 Save Changes"}
          </button>
        </div>
      </div>

      {/* ─── Appearance ─── */}
      <div style={card}>
        <div style={head}>Appearance</div>
        <div
          style={{
            ...body,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 2,
              }}
            >
              {theme === "dark" ? "🌙 Dark Mode" : "☀️ Light Mode"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Saved to your browser
            </div>
          </div>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{
              width: 52,
              height: 28,
              borderRadius: 999,
              border: "none",
              cursor: "pointer",
              background:
                theme === "dark" ? "var(--gradient-primary)" : "#d1d5db",
              position: "relative",
              transition: "background .25s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: theme === "dark" ? 26 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                transition: "left .25s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}
            >
              {theme === "dark" ? "🌙" : "☀️"}
            </span>
          </button>
        </div>
      </div>

      {/* ─── Danger Zone ─── */}
      <div style={{ ...card, border: "1px solid rgba(239,68,68,0.25)" }}>
        <div
          style={{
            ...head,
            borderBottom: "1px solid rgba(239,68,68,0.2)",
            color: "#ef4444",
          }}
        >
          ⚠️ Danger Zone
        </div>
        <div style={body}>
          {/* Sign Out */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--border-secondary)",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 2,
                }}
              >
                Sign Out
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Signs you out on this device
              </div>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? "⏳ Signing out…" : "👋 Sign Out"}
            </button>
          </div>

          {/* Delete Account */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#ef4444",
                  marginBottom: 2,
                }}
              >
                Delete Account
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                Permanently removes your profile, follows, and notifications
              </div>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                padding: "7px 14px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-body)",
                transition: "all .15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              }}
            >
              🗑 Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* ─── Delete Modal ─── */}
      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={handleDeleteAccount}
          onCancel={() => !deletingAccount && setShowDeleteModal(false)}
          loading={deletingAccount}
        />
      )}
    </div>
  );
}
