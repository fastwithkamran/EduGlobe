'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createSociety, uploadFile } from '@/lib/firestore';
import type { SocietyCategory, SocietyPrivacy } from '@/types';
import { sanitizeImageUrl } from '@/../lib/utils';

export default function CreateSocietyPage() {
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();

  const [form, setForm] = useState({
    name: '',
    organization: '',
    city: '',
    country: '',
    description: '',
    category: '' as SocietyCategory | '',
    privacy: 'public' as SocietyPrivacy,
    website: '',
    contactEmail: '',
    tags: '',            // comma-separated input
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const logoRef   = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBannerFile(f);
    setBannerPreview(URL.createObjectURL(f));
  };

  const validate = (): string | null => {
    if (!form.name.trim())         return 'Institute name is required';
    if (!form.city.trim())         return 'City is required';
    if (!form.country.trim())      return 'Country is required';
    if (!form.description.trim())  return 'Description is required';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) return toast.error(err);
    if (!user || !userProfile) return toast.error('You must be signed in');

    setSaving(true);
    try {
      let logoURL = '';
      let bannerURL = '';
      const tempId = `temp_${Date.now()}`;

     // Upload logo
if (logoFile) {
  setUploadProgress(10); // The 10% you are currently seeing
  logoURL = await uploadFile(
    logoFile, 
    `societies/${tempId}/logo_${logoFile.name}`, 
    p => setUploadProgress(prev => 10 + (p * 0.4)) // 0.4 * 100 = 40. Total = 50%
  );
}

// Upload banner
if (bannerFile) {
  // If no logo, we jump to 50, otherwise we start where the logo left off
  setUploadProgress(prev => Math.max(prev, 50)); 
  bannerURL = await uploadFile(
    bannerFile, 
    `societies/${tempId}/banner_${bannerFile.name}`, 
    p => setUploadProgress(prev => 50 + (p * 0.4)) // 0.4 * 100 = 40. Total = 90%
  );
}

      setUploadProgress(90);

      const tags = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const societyId = await createSociety(
        {
          name: form.name.trim(),
          organization: form.organization.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
          description: form.description.trim(),
          category: 'other' as SocietyCategory,
          privacy: form.privacy,
          website: form.website.trim(),
          contactEmail: form.contactEmail.trim() || user.email || '',
          tags,
          logoURL,
          bannerURL,
        },
        {
          uid: user.uid,
          displayName: userProfile.displayName,
          email: user.email ?? '',
          photoURL: userProfile.photoURL,
        },
      );

      setUploadProgress(100);

      // Refresh the user profile so sidebar reflects new role/societyId
      await refreshUserProfile();

      toast.success(`🎉 "${form.name}" is live!`);
      router.push('/admin/society');
    } catch (err) {
      console.error(err);
      toast.error('Failed to create society. Please try again.');
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.06)',
    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
    fontSize: 13, padding: '10px 14px', outline: 'none', transition: 'border-color .15s',
  };

  const labelStyle = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: 6,
  };

  const sectionCard = {
    background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 16,
  };
  const sectionHead = {
    padding: '14px 20px', borderBottom: '1px solid var(--border-primary)',
    fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
  };
  const sectionBody = { padding: 20 };

  return (
    <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x)', maxWidth: 700 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          ✚ Share Wisdom
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
          You'll automatically become the admin. Public institutes appear in the global feed.
        </p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ─── Basic Info ─── */}
        <div style={sectionCard}>
          <div style={sectionHead}>Basic Information</div>
          <div style={sectionBody}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Institute Name *</label>
              <input style={inputStyle} placeholder="" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Organization (University / Company / Club)</label>
              <input style={inputStyle} placeholder="" value={form.organization} onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>City *</label>
                <input style={inputStyle} placeholder="" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} required />
              </div>
              <div>
                <label style={labelStyle}>Country *</label>
                <input style={inputStyle} placeholder="" value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description *</label>
              <textarea style={{ ...inputStyle, resize: 'vertical' } as React.CSSProperties} rows={4} placeholder="" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
            </div>
          </div>
        </div>

        {/* ─── Privacy ─── */}
        <div style={sectionCard}>
          <div style={sectionHead}>Privacy</div>
          <div style={sectionBody}>
            <div>
              <label style={labelStyle}>Privacy *</label>
              <div style={{ display: 'flex', gap: 12 }}>
                {(['public', 'private'] as SocietyPrivacy[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, privacy: p }))}
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                      border: form.privacy === p ? '2px solid var(--primary-500)' : '1px solid var(--border-primary)',
                      background: form.privacy === p ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
                      color: form.privacy === p ? 'var(--primary-400)' : 'var(--text-secondary)',
                      transition: 'all .15s', fontFamily: 'var(--font-body)', fontSize: 13,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 3 }}>
                      {p === 'public' ? '🌐 Public' : '🔒 Private'}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.8 }}>
                      {p === 'public'
                        ? 'Visible in global feed. Anyone can follow.'
                        : 'Hidden from discovery. Invite-only membership.'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Images ─── */}
        <div style={sectionCard}>
          <div style={sectionHead}>Logo & Banner Images</div>
          <div style={sectionBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
              {/* Logo */}
              <div>
                <label style={labelStyle}>Logo (square, recommended 400×400)</label>
                <div
                  onClick={() => logoRef.current?.click()}
                  style={{ border: '2px dashed var(--border-primary)', borderRadius: 12, cursor: 'pointer', overflow: 'hidden', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s', background: 'rgba(255,255,255,0.02)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  {logoPreview
                    ? <img src={sanitizeImageUrl(logoPreview)} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>Upload Logo</div>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
              </div>

              {/* Banner */}
              <div>
                <label style={labelStyle}>Banner (wide, recommended 1200×400)</label>
                <div
                  onClick={() => bannerRef.current?.click()}
                  style={{ border: '2px dashed var(--border-primary)', borderRadius: 12, cursor: 'pointer', overflow: 'hidden', height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color .2s', background: 'rgba(255,255,255,0.02)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary-500)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  {bannerPreview
                    ? <img src={sanitizeImageUrl(bannerPreview)} alt="banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}><div style={{ fontSize: 24, marginBottom: 4 }}>🏔️</div>Upload Banner</div>}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBannerChange} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Additional Details ─── */}
        <div style={sectionCard}>
          <div style={sectionHead}>Additional Details (Optional)</div>
          <div style={sectionBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Website</label>
                <input style={inputStyle} type="url" placeholder="" value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
              </div>
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input style={inputStyle} type="email" placeholder="" value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tags (comma-separated, for discoverability)</label>
              <input style={inputStyle} placeholder="" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                Tags help people discover your institute in search.
              </div>
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {saving && uploadProgress > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
              {uploadProgress < 90 ? `Uploading images… ${uploadProgress}%` : 'Creating society…'}
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
            {saving ? '⏳ Creating…' : '🏛️ Create Institute'}
          </button>
        </div>
      </form>
    </div>
  );
}
