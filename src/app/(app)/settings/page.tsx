"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { useTheme } from "@/hooks/useTheme";
import { DeleteAccountModal } from "./_components/DeleteAccountModal";
import {
  FiSettings,
  FiCamera,
  FiSave,
  FiMoon,
  FiSun,
  FiAlertTriangle,
  FiLogOut,
  FiTrash2,
} from "react-icons/fi";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

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
  const profileDirty = useRef(false);
  const syncedProfileUid = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const temporaryPreviewURL = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Danger zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!userProfile) return;
    const isNewProfile = syncedProfileUid.current !== userProfile.uid;
    if (isNewProfile || !profileDirty.current) {
      // Sync the editable form only when the active account changes or it has no unsaved edits.
      setForm({
        displayName: userProfile.displayName ?? "",
        bio: userProfile.bio ?? "",
        contactInfo: userProfile.contactInfo ?? "",
        universityName: userProfile.universityName ?? "",
      });
      if (isNewProfile) profileDirty.current = false;
      syncedProfileUid.current = userProfile.uid;
    }
    if (!temporaryPreviewURL.current) {
      setPreviewURL(userProfile.photoURL);
    }
  }, [userProfile]);

  useEffect(
    () => () => {
      if (temporaryPreviewURL.current) {
        URL.revokeObjectURL(temporaryPreviewURL.current);
      }
    },
    [],
  );

  const updateProfileForm = (updates: Partial<typeof form>) => {
    setForm((current) => ({ ...current, ...updates }));
    profileDirty.current = true;
  };

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
    e.target.value = "";
    if (!file || !user) return;
    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      toast.error("Choose a JPG, PNG, or GIF image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("Profile images must be 5 MB or smaller.");
      return;
    }

    const oldPhotoURL = userProfile?.photoURL ?? null;
    const nextPreviewURL = URL.createObjectURL(file);
    if (temporaryPreviewURL.current) {
      URL.revokeObjectURL(temporaryPreviewURL.current);
    }
    temporaryPreviewURL.current = nextPreviewURL;
    setPreviewURL(nextPreviewURL);
    setUploading(true);
    setUploadProgress(0);
    let uploadedPhotoURL: string | null = null;
    let profileUpdated = false;
    try {
      uploadedPhotoURL = await uploadFile(
        file,
        `avatars/${user.uid}/${Date.now()}_${file.name}`,
        (pct) => setUploadProgress(pct),
      );
      await updateUserProfile(user.uid, { photoURL: uploadedPhotoURL });
      profileUpdated = true;
      URL.revokeObjectURL(nextPreviewURL);
      temporaryPreviewURL.current = null;
      setPreviewURL(uploadedPhotoURL);
      let refreshFailed = false;
      try {
        await refreshUserProfile();
      } catch (error) {
        refreshFailed = true;
        console.error(
          "[SettingsPage] Failed to refresh profile after photo update:",
          error,
        );
      }
      if (oldPhotoURL) {
        try {
          await deleteFile(oldPhotoURL);
        } catch (error) {
          console.error(
            "[SettingsPage] Failed to remove previous profile photo:",
            error,
          );
        }
      }
      if (refreshFailed) {
        toast.error(
          "Photo updated, but profile data could not refresh. Reload the page.",
        );
      } else {
        toast.success("Profile picture updated!");
      }
    } catch (error) {
      if (temporaryPreviewURL.current === nextPreviewURL) {
        URL.revokeObjectURL(nextPreviewURL);
        temporaryPreviewURL.current = null;
      }
      if (uploadedPhotoURL && !profileUpdated) {
        await deleteFile(uploadedPhotoURL);
      }
      console.error("[SettingsPage] Failed to update profile photo:", error);
      toast.error(
        profileUpdated
          ? "Photo was saved, but the settings update did not finish. Reload the page."
          : "Failed to upload photo",
      );
      setPreviewURL(
        profileUpdated ? uploadedPhotoURL : (userProfile?.photoURL ?? null),
      );
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
      profileDirty.current = false;
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
      router.push("/feed");
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

  const handleCancelDelete = useCallback(() => {
    if (!deletingAccount) setShowDeleteModal(false);
  }, [deletingAccount]);

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    let profileDataRemoved = false;
    try {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
      await deleteUserAccount(user.uid);
      profileDataRemoved = true;
      await deleteUser(user);
      toast.success("Account deleted successfully.");
      router.push("/feed");
    } catch (err: unknown) {
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";
      if (
        errorCode.includes("popup-closed") ||
        errorCode.includes("cancelled")
      ) {
        toast.error("Re-authentication cancelled — account not deleted");
      } else if (profileDataRemoved) {
        console.error(
          "[SettingsPage] Account data was removed, but Firebase Auth deletion failed:",
          err,
        );
        toast.error(
          "Your profile data was removed, but the sign-in account could not be deleted. Keep this session open and try again.",
          { duration: 8000 },
        );
      } else {
        console.error("[SettingsPage] Account deletion failed:", err);
        toast.error(
          "Account deletion did not complete. Some profile data may have been removed; please try again.",
          { duration: 8000 },
        );
      }
      setDeletingAccount(false);
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
              type="button"
              className="btn btn-primary"
              onClick={handleSignIn}
              disabled={signingIn}
              style={{ alignSelf: "flex-start" }}
            >
              {signingIn ? "Signing in…" : "Sign in with Google"}
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
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <FiSettings className="w-6 h-6 text-[var(--primary-400)]" /> Settings
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
              type="button"
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ marginBottom: 6 }}
            >
              {uploading ? (
                "Uploading…"
              ) : (
                <>
                  <FiCamera className="w-3.5 h-3.5" /> Change Photo
                </>
              )}
            </button>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              JPG, PNG, or GIF · Maximum 5 MB · Stored on Cloudinary
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif"
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
                  updateProfileForm({ displayName: e.target.value })
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
                  updateProfileForm({ universityName: e.target.value })
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
              onChange={(e) => updateProfileForm({ bio: e.target.value })}
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
                updateProfileForm({ contactInfo: e.target.value })
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
            type="button"
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            onClick={handleSaveProfile}
            disabled={saving}
            style={{ alignSelf: "flex-start" }}
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                <FiSave className="w-3.5 h-3.5" /> Save Changes
              </>
            )}
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
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {theme === "dark" ? (
                <>
                  <FiMoon className="w-4 h-4 text-slate-300" /> Dark Mode
                </>
              ) : (
                <>
                  <FiSun className="w-4 h-4 text-amber-500" /> Light Mode
                </>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Saved to your browser
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{
              width: 52,
              height: 28,
              borderRadius: 999,
              border: "1px solid var(--border-primary)",
              cursor: "pointer",
              background:
                theme === "dark" ? "var(--gradient-primary)" : "var(--bg-tertiary)",
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
              {theme === "dark" ? (
                <FiMoon style={{ width: 12, height: 12, color: "#1e293b" }} />
              ) : (
                <FiSun style={{ width: 12, height: 12, color: "#f59e0b" }} />
              )}
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
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FiAlertTriangle className="w-4 h-4" /> Danger Zone
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
              type="button"
              className="btn btn-outline btn-sm inline-flex items-center gap-1.5"
              onClick={handleSignOut}
              disabled={signingOut}
            >
              {signingOut ? (
                "Signing out…"
              ) : (
                <>
                  <FiLogOut className="w-3.5 h-3.5" /> Sign Out
                </>
              )}
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
              type="button"
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
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.18)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.08)";
              }}
            >
              <FiTrash2 style={{ width: 13, height: 13 }} /> Delete Account
            </button>
          </div>
        </div>
      </div>

      {/* ─── Delete Modal ─── */}
      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={handleDeleteAccount}
          onCancel={handleCancelDelete}
          loading={deletingAccount}
        />
      )}
    </div>
  );
}
