'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { updateUserProfile, uploadFile } from '@/lib/firestore';
import { useAuth } from '@/contexts/AuthContext';

export default function SettingsPage() {
  const { user, userProfile, refreshUserProfile } = useAuth();

  const [form, setForm] = useState({
    displayName: '',
    bio: '',
    contactInfo: '',
    universityName: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    memberJoins: true,
    postActivity: true,
    groupMessages: true,
    invitations: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form from profile
  useEffect(() => {
    if (userProfile) {
      setForm({
        displayName: userProfile.displayName ?? '',
        bio: userProfile.bio ?? '',
        contactInfo: userProfile.contactInfo ?? '',
        universityName: userProfile.universityName ?? '',
      });
      setPreviewURL(userProfile.photoURL);
    }
  }, [userProfile]);

  // ─── Profile Picture ─────────────────────────────────────────────────────────

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Local preview
    setPreviewURL(URL.createObjectURL(file));
    setUploading(true);
    setUploadProgress(0);

    try {
      const path = `avatars/${user.uid}/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path, pct => setUploadProgress(pct));
      await updateUserProfile(user.uid, { photoURL: url });
      await refreshUserProfile();
      toast.success('Profile picture updated!');
    } catch {
      toast.error('Failed to upload photo');
      setPreviewURL(userProfile?.photoURL ?? null);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ─── Profile Save ─────────────────────────────────────────────────────────────

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!form.displayName.trim()) return toast.error('Display name is required');
    setSaving(true);
    try {
      await updateUserProfile(user.uid, {
        displayName: form.displayName.trim(),
        bio: form.bio.trim(),
        contactInfo: form.contactInfo.trim(),
        universityName: form.universityName.trim(),
      });
      await refreshUserProfile();
      toast.success('Profile saved!');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // ─── Password Change ──────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!user || !user.email) return;
    if (!pwForm.current) return toast.error('Enter your current password');
    if (pwForm.next.length < 6) return toast.error('New password must be at least 6 characters');
    if (pwForm.next !== pwForm.confirm) return toast.error('Passwords do not match');

    setChangingPw(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, pwForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, pwForm.next);
      setPwForm({ current: '', next: '', confirm: '' });
      toast.success('Password changed successfully!');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('wrong-password')) {
        toast.error('Current password is incorrect');
      } else {
        toast.error('Failed to change password');
      }
    } finally {
      setChangingPw(false);
    }
  };

  const initials = userProfile?.displayName
    ? userProfile.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x)', maxWidth: 720 }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>⚙️ Settings</h1>
      <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 24 }}>Manage your account and preferences</p>

      {/* ─── Profile Picture ─── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>
          Profile Picture
        </div>
        <div style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {previewURL ? (
              <img src={previewURL} alt="Profile" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-primary)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: '#fff' }}>
                {initials}
              </div>
            )}
            {uploading && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff', fontWeight: 600 }}>
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
              {uploading ? '⏳ Uploading…' : '📷 Change Photo'}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>JPG, PNG, GIF up to 5MB</div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
          </div>
        </div>
      </div>

      {/* ─── Account Info ─── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>
          Account Information
        </div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Read-only email */}
          <div className="input-group">
            <label className="input-label">Email Address (from Google sign-in)</label>
            <input className="input" value={user?.email ?? ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Display Name *</label>
              <input className="input" placeholder="Your name" value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div className="input-group">
              <label className="input-label">University</label>
              <input className="input" placeholder="e.g., NUST, Islamabad" value={form.universityName} onChange={e => setForm(p => ({ ...p, universityName: e.target.value }))} />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Bio</label>
            <textarea className="input" rows={3} placeholder="Tell people about yourself…" value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          <div className="input-group">
            <label className="input-label">Contact Info (optional, shown to society members)</label>
            <input className="input" placeholder="e.g., LinkedIn URL or phone number" value={form.contactInfo} onChange={e => setForm(p => ({ ...p, contactInfo: e.target.value }))} />
          </div>

          {/* Role display (read-only) */}
          <div className="input-group">
            <label className="input-label">Role</label>
            <input className="input" value={userProfile?.role ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Not set'} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
          </div>

          <button className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={saving} style={{ alignSelf: 'flex-start' }}>
            {saving ? '⏳ Saving…' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      {/* ─── Change Password (only for email/password users) ─── */}
      {user?.providerData?.some(p => p.providerId === 'password') && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-primary)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14 }}>
            Change Password
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Current Password</label>
              <input className="input" type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">New Password</label>
                <input className="input" type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Confirm New Password</label>
                <input className="input" type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleChangePassword} disabled={changingPw} style={{ alignSelf: 'flex-start' }}>
              {changingPw ? '⏳ Changing…' : '🔒 Change Password'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
