'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createSociety, uploadFile } from '@/lib/firestore';
import { sanitizeImageUrl } from '@/lib/utils';
import type { CommunityLinks } from '@/types';

// ─── Reusable class strings ────────────────────────────────────────────────────
const cardCls  = 'rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden mb-4';
const headCls  = 'px-5 py-3.5 border-b border-[var(--border-primary)] text-sm font-bold text-[var(--text-primary)]';
const bodyCls  = 'p-5';
const labelCls = 'block text-xs font-semibold text-[var(--text-secondary)] mb-1.5';

// Community link config
const COMMUNITY_LINKS: { key: keyof CommunityLinks; icon: string; label: string; placeholder: string }[] = [
  { key: 'discord',   icon: '🎮', label: 'Discord Server',  placeholder: 'https://discord.gg/...' },
  { key: 'whatsapp',  icon: '💬', label: 'WhatsApp Group',  placeholder: 'https://chat.whatsapp.com/...' },
  { key: 'linkedin',  icon: '💼', label: 'LinkedIn Page',   placeholder: 'https://linkedin.com/company/...' },
  { key: 'twitter',   icon: '🐦', label: 'X / Twitter',     placeholder: 'https://twitter.com/...' },
  { key: 'instagram', icon: '📸', label: 'Instagram',       placeholder: 'https://instagram.com/...' },
];

export default function CreateSocietyPage() {
  const router = useRouter();
  const { user, userProfile, refreshUserProfile } = useAuth();

  const [form, setForm] = useState({
    name:         '',
    organization: '',
    city:         '',
    country:      '',
    description:  '',
    website:      '',
    contactEmail: '',
    communityLinks: {
      discord:   '',
      whatsapp:  '',
      linkedin:  '',
      twitter:   '',
      instagram: '',
    } satisfies CommunityLinks,
  });

  const [logoFile,     setLogoFile]     = useState<File | null>(null);
  const [bannerFile,   setBannerFile]   = useState<File | null>(null);
  const [logoPreview,  setLogoPreview]  = useState<string | null>(null);
  const [bannerPreview,setBannerPreview]= useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);
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

  const setLink = (key: keyof CommunityLinks, value: string) =>
    setForm(p => ({ ...p, communityLinks: { ...p.communityLinks, [key]: value } }));

  const validate = (): string | null => {
    if (!form.name.trim())        return 'Institute name is required';
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
      let logoURL   = '';
      let bannerURL = '';
      const tempId  = `temp_${Date.now()}`;

      // Upload logo → Cloudinary (10% → 50%)
      if (logoFile) {
        setUploadProgress(10);
        logoURL = await uploadFile(
          logoFile,
          `societies/${tempId}/logo_${logoFile.name}`,
          p => setUploadProgress(10 + p * 0.4),
        );
      }

      // Upload banner → Cloudinary (50% → 90%)
      if (bannerFile) {
        setUploadProgress(prev => Math.max(prev, 50));
        bannerURL = await uploadFile(
          bannerFile,
          `societies/${tempId}/banner_${bannerFile.name}`,
          p => setUploadProgress(50 + p * 0.4),
        );
      }

      setUploadProgress(90);

      // Strip empty community links before saving
      const communityLinks: CommunityLinks = Object.fromEntries(
        Object.entries(form.communityLinks).filter(([, v]) => v.trim()),
      );

      const societyId = await createSociety(
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
        {
          uid:         user.uid,
          displayName: userProfile.displayName,
          email:       user.email ?? '',
          photoURL:    userProfile.photoURL,
        },
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

  return (
    <div className="px-[var(--page-padding-x)] py-[var(--page-padding-y)] max-w-[700px]">

      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold text-[var(--text-primary)] mb-1"
            style={{ fontFamily: 'var(--font-heading)' }}>
          ✚ Share Wisdom
        </h1>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          You&apos;ll automatically become the admin. All institutes are public and appear in the global feed.
        </p>
      </div>

      <form onSubmit={handleSubmit}>

        {/* ─── Basic Information ─── */}
        <div className={cardCls}>
          <div className={headCls}>Basic Information</div>
          <div className={bodyCls}>
            <div className="flex flex-col gap-3.5">

              <div>
                <label className={labelCls}>Institute / Society Name *</label>
                <input className="input w-full" placeholder="e.g. FAST Computing Society"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              </div>

              <div>
                <label className={labelCls}>Organization (University / Company / Club)</label>
                <input className="input w-full" placeholder="e.g. FAST-NUCES Karachi"
                  value={form.organization}
                  onChange={e => setForm(p => ({ ...p, organization: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className={labelCls}>City *</label>
                  <input className="input w-full" placeholder="Karachi"
                    value={form.city}
                    onChange={e => setForm(p => ({ ...p, city: e.target.value }))} required />
                </div>
                <div>
                  <label className={labelCls}>Country *</label>
                  <input className="input w-full" placeholder="Pakistan"
                    value={form.country}
                    onChange={e => setForm(p => ({ ...p, country: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label className={labelCls}>Description *</label>
                <textarea className="input w-full resize-y" rows={4}
                  placeholder="What does your society do? Who is it for?"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required />
              </div>

            </div>
          </div>
        </div>

        {/* ─── Logo & Banner ─── */}
        <div className={cardCls}>
          <div className={headCls}>Logo &amp; Banner</div>
          <div className={bodyCls}>
            <div className="grid grid-cols-[1fr_2fr] gap-4">

              {/* Logo */}
              <div>
                <label className={labelCls}>Logo (400×400 recommended)</label>
                <div
                  onClick={() => logoRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border-primary)] rounded-xl cursor-pointer overflow-hidden h-[120px] flex items-center justify-center transition-colors hover:border-[var(--primary-500)] bg-white/[0.02]"
                >
                  {logoPreview
                    ? <img src={sanitizeImageUrl(logoPreview)} alt="logo" className="w-full h-full object-cover" />
                    : <div className="text-center text-[var(--text-muted)] text-xs">
                        <div className="text-2xl mb-1">🖼️</div>Upload Logo
                      </div>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>

              {/* Banner */}
              <div>
                <label className={labelCls}>Banner (1200×400 recommended)</label>
                <div
                  onClick={() => bannerRef.current?.click()}
                  className="border-2 border-dashed border-[var(--border-primary)] rounded-xl cursor-pointer overflow-hidden h-[120px] flex items-center justify-center transition-colors hover:border-[var(--primary-500)] bg-white/[0.02]"
                >
                  {bannerPreview
                    ? <img src={sanitizeImageUrl(bannerPreview)} alt="banner" className="w-full h-full object-cover" />
                    : <div className="text-center text-[var(--text-muted)] text-xs">
                        <div className="text-2xl mb-1">🏔️</div>Upload Banner
                      </div>}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
              </div>

            </div>
          </div>
        </div>

        {/* ─── Contact (Optional) ─── */}
        <div className={cardCls}>
          <div className={headCls}>
            Contact
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">— optional</span>
          </div>
          <div className={bodyCls}>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className={labelCls}>Website</label>
                <input className="input w-full" type="url" placeholder="https://yoursociety.com"
                  value={form.website}
                  onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Contact Email</label>
                <input className="input w-full" type="email" placeholder="contact@society.com"
                  value={form.contactEmail}
                  onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Community Links (Optional) ─── */}
        <div className={cardCls}>
          <div className={headCls}>
            Community Links
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1">— where your community hangs out</span>
          </div>
          <div className={bodyCls}>
            <div className="grid grid-cols-1 gap-3">
              {COMMUNITY_LINKS.map(({ key, icon, label, placeholder }) => (
                <div key={key}>
                  <label className={labelCls}>{icon} {label}</label>
                  <input
                    className="input w-full"
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

        {/* Upload Progress */}
        {saving && uploadProgress > 0 && (
          <div className="mb-4">
            <div className="text-xs text-[var(--text-tertiary)] mb-1.5">
              {uploadProgress < 90 ? `Uploading images… ${Math.round(uploadProgress)}%` : 'Creating society…'}
            </div>
            <div className="h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%`, background: 'var(--gradient-primary)' }}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
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
