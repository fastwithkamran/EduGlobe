'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createSociety, uploadFile } from '@/lib/firestore';
import { sanitizeImageUrl } from '@/lib/utils';
import type { CommunityLinks } from '@/types';
import Loader from '../../../components/Loader';

// ─── Static styles ─────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
  borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 16,
};
const head: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid var(--border-primary)',
  fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
  fontFamily: 'var(--font-heading)',
};
const body: React.CSSProperties = { padding: 20 };
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 6,
};
const fieldGap: React.CSSProperties = { marginBottom: 14 };

// ─── Community link config ─────────────────────────────────────────────────────
const COMMUNITY_LINKS: { key: keyof CommunityLinks; icon: string; label: string; placeholder: string }[] = [
  { key: 'discord',   icon: '🎮', label: 'Discord Server',  placeholder: 'https://discord.gg/...'           },
  { key: 'whatsapp',  icon: '💬', label: 'WhatsApp Group',  placeholder: 'https://chat.whatsapp.com/...'    },
  { key: 'linkedin',  icon: '💼', label: 'LinkedIn Page',   placeholder: 'https://linkedin.com/company/...' },
  { key: 'twitter',   icon: '🐦', label: 'X / Twitter',     placeholder: 'https://twitter.com/...'          },
  { key: 'instagram', icon: '📸', label: 'Instagram',       placeholder: 'https://instagram.com/...'        },
];

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function CreateSocietyPage() {
  const router = useRouter();
  const { user, userProfile, loading, refreshUserProfile } = useAuth();

  useEffect(() => {
    if (userProfile?.societyId) {
      router.replace('/my-society');
    }
  }, [router, userProfile?.societyId]);

  const [form, setForm] = useState({
    name:         '',
    organization: '',
    city:         '',
    country:      '',
    description:  '',
    website:      '',
    contactEmail: '',
    communityLinks: {
      discord: '', whatsapp: '', linkedin: '', twitter: '', instagram: '',
    } satisfies CommunityLinks,
  });

  const [logoFile,      setLogoFile]      = useState<File | null>(null);
  const [bannerFile,    setBannerFile]    = useState<File | null>(null);
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [uploadProgress,setUploadProgress]= useState(0);

  const logoRef   = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const setLink = (key: keyof CommunityLinks, value: string) =>
    setForm(p => ({ ...p, communityLinks: { ...p.communityLinks, [key]: value } }));

  const validate = (): string | null => {
    if (!form.name.trim())        return 'Society name is required';
    if (!form.city.trim())        return 'City is required';
    if (!form.country.trim())     return 'Country is required';
    if (!form.description.trim()) return 'Description is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    if (!user || !userProfile) return toast.error('You must be signed in');

    setSaving(true);
    try {
      let logoURL = '', bannerURL = '';
      const tempId = `temp_${Date.now()}`;

      if (logoFile) {
        setUploadProgress(10);
        logoURL = await uploadFile(logoFile, `societies/${tempId}/logo_${logoFile.name}`, p => setUploadProgress(10 + p * 0.4));
      }
      if (bannerFile) {
        setUploadProgress(p => Math.max(p, 50));
        bannerURL = await uploadFile(bannerFile, `societies/${tempId}/banner_${bannerFile.name}`, p => setUploadProgress(50 + p * 0.4));
      }
      setUploadProgress(90);

      const communityLinks: CommunityLinks = Object.fromEntries(
        Object.entries(form.communityLinks).filter(([, v]) => v.trim()),
      );

      await createSociety(
        {
          name:         form.name.trim(),
          organization: form.organization.trim(),
          city:         form.city.trim(),
          country:      form.country.trim(),
          description:  form.description.trim(),
          privacy:      'public',
          website:      form.website.trim(),
          contactEmail: form.contactEmail.trim() || user.email || '',
          communityLinks: Object.keys(communityLinks).length ? communityLinks : undefined,
          logoURL,
          bannerURL,
        },
        { uid: user.uid, displayName: userProfile.displayName, email: user.email ?? '', photoURL: userProfile.photoURL },
      );

      setUploadProgress(100);
      await refreshUserProfile();
      toast.success(`🎉 "${form.name}" is live!`);
      router.push('/my-society');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create society. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  // ─── Upload dropzone ──────────────────────────────────────────────────────────
  const dropzone: React.CSSProperties = {
    border: '2px dashed var(--border-primary)', borderRadius: 12, cursor: 'pointer',
    overflow: 'hidden', height: 120, display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'border-color .2s',
    background: 'rgba(255,255,255,0.02)',
  };

  if (loading || userProfile?.societyId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
        <Loader />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x)', maxWidth: 700 }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          Create a Society
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          Create a community on Opportune to share opportunities, events, and updates. Your society will be public and discoverable in the global feed, and you&apos;ll become its admin.
        </p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ─── Basic Information ─── */}
        <div style={card}>
          <div style={head}>Basic Information</div>
          <div style={body}>
            <div style={fieldGap}>
              <label style={label}>Society Name *</label>
              <input className="input" style={{ width: '100%' }} placeholder="e.g. FAST Computing Society"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div style={fieldGap}>
              <label style={label}>Organization (University / Company / Club)</label>
              <input className="input" style={{ width: '100%' }} placeholder="e.g. FAST-NUCES Karachi"
                value={form.organization} onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, ...fieldGap }}>
              <div>
                <label style={label}>City *</label>
                <input className="input" style={{ width: '100%' }} placeholder="Karachi"
                  value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} required />
              </div>
              <div>
                <label style={label}>Country *</label>
                <input className="input" style={{ width: '100%' }} placeholder="Pakistan"
                  value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label style={label}>Description *</label>
              <textarea className="input" style={{ width: '100%', resize: 'vertical' }} rows={4}
                placeholder="What does your society do? Who is it for?"
                value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
            </div>
          </div>
        </div>

        {/* ─── Logo & Banner ─── */}
        <div style={card}>
          <div style={head}>Logo &amp; Banner</div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>

              {/* Logo */}
              <div>
                <label style={label}>Logo (400×400 recommended)</label>
                <div
                  style={dropzone}
                  onClick={() => logoRef.current?.click()}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  {logoPreview
                    ? <img src={sanitizeImageUrl(logoPreview)} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>Upload Logo
                      </div>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); }}} />
              </div>

              {/* Banner */}
              <div>
                <label style={label}>Banner (1200×400 recommended)</label>
                <div
                  style={dropzone}
                  onClick={() => bannerRef.current?.click()}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  {bannerPreview
                    ? <img src={sanitizeImageUrl(bannerPreview)} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                        <div style={{ fontSize: 24, marginBottom: 4 }}>🏔️</div>Upload Banner
                      </div>}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); }}} />
              </div>

            </div>
          </div>
        </div>

        {/* ─── Contact ─── */}
        <div style={card}>
          <div style={head}>
            Contact <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>— optional</span>
          </div>
          <div style={body}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={label}>Website</label>
                <input className="input" style={{ width: '100%' }} type="url" placeholder="https://yoursociety.com"
                  value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Contact Email</label>
                <input className="input" style={{ width: '100%' }} type="email" placeholder="contact@society.com"
                  value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Community Links ─── */}
        <div style={card}>
          <div style={head}>
            Community Links <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>— where your community hangs out</span>
          </div>
          <div style={body}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {COMMUNITY_LINKS.map(({ key, icon, label: lbl, placeholder }) => (
                <div key={key}>
                  <label style={label}>{icon} {lbl}</label>
                  <input
                    className="input"
                    style={{ width: '100%' }}
                    type="url"
                    placeholder={placeholder}
                    value={form.communityLinks[key] ?? ''}
                    onChange={e => setLink(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Upload progress */}
        {saving && uploadProgress > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
              {uploadProgress < 90 ? `Uploading images… ${Math.round(uploadProgress)}%` : 'Creating society…'}
            </div>
            <div style={{ height: 5, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--gradient-primary)', transition: 'width .4s' }} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={() => router.back()} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
            {saving ? '⏳ Creating…' : '🏛️ Create Society'}
          </button>
        </div>

      </form>
    </div>
  );
}
