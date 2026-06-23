'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAllSocieties, deleteSociety } from '@/lib/firestore';
import type { Society } from '@/types';

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({
  society,
  onConfirm,
  onCancel,
  loading,
}: {
  society: Society;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 16, padding: '32px 28px', width: 460, maxWidth: '90vw',
          animation: 'scaleIn .2s ease',
        }}
      >
        {/* Danger icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, margin: '0 auto 18px',
        }}>⚠️</div>

        <h2 style={{
          fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)',
          fontWeight: 800, textAlign: 'center', marginBottom: 10,
        }}>
          Delete Society?
        </h2>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.65, marginBottom: 8 }}>
          You are about to permanently delete <strong style={{ color: 'var(--text-primary)' }}>{society.name}</strong>.
        </p>

        {/* What will be deleted list */}
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8 }}>
            This will permanently delete:
          </div>
          {[
            'The society profile and all metadata',
            'All posts made by this society',
            'All members and invitations',
            'All groups (messages require Cloud Function to cascade)',
            'All follow relationships',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <span style={{ color: '#ef4444', flexShrink: 0 }}>✕</span>
              {item}
            </div>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
          This action <strong style={{ color: '#ef4444' }}>cannot be undone</strong>.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: 100 }}
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            style={{
              minWidth: 160, display: 'inline-flex', alignItems: 'center',
              justifyContent: 'center', gap: 6, padding: '9px 20px',
              background: loading ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)',
              color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)',
              fontWeight: 700, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all .15s', fontFamily: 'var(--font-body)',
            }}
          >
            {loading ? '⏳ Deleting…' : '🗑️ Delete Society'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SocietiesAdminPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [confirmSociety, setConfirmSociety] = useState<Society | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Redirect non-admins
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.push('/admin/feed');
    }
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    getAllSocieties()
      .then(data => setSocieties(data))
      .catch(() => toast.error('Failed to load societies'))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  const filtered = societies.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.organization.toLowerCase().includes(search.toLowerCase()),
  );

  const handleDeleteConfirmed = async () => {
    if (!confirmSociety) return;
    setDeleting(true);
    try {
      await deleteSociety(confirmSociety.id);
      setSocieties(prev => prev.filter(s => s.id !== confirmSociety.id));
      toast.success(`Society "${confirmSociety.name}" deleted`);
      setConfirmSociety(null);
    } catch {
      toast.error('Failed to delete society. Check Firestore rules.');
    } finally {
      setDeleting(false);
    }
  };

  const CATEGORY_EMOJI: Record<string, string> = {
    technology: '💻', literary: '📚', sports: '⚽', arts: '🎨',
    music: '🎵', debate: '🎤', community: '🤝', entrepreneurship: '🚀',
    science: '🔬', media: '📹', other: '🌐',
  };

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
      Checking permissions…
    </div>
  );

  if (!isSuperAdmin) return null;

  return (
    <>
      <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
              🏛️ Manage Societies
            </h1>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
              {loading ? 'Loading…' : `${societies.length} societies on the platform`}
              <span style={{
                marginLeft: 8, background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444',
                padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              }}>
                ⚡ Super Admin
              </span>
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div style={{
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 10, padding: '10px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)',
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          Deleting a society is <strong style={{ color: '#ef4444' }}>permanent and irreversible</strong>. All posts, members, and groups will be removed.
        </div>

        {/* Search */}
        <div style={{ marginBottom: 16 }}>
          <input
            className="input"
            style={{ maxWidth: 320 }}
            placeholder="🔍 Search by name or organization…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Society list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading societies…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No societies found</div>
            {search && <p style={{ fontSize: 13 }}>Try a different search term.</p>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(society => (
              <div
                key={society.id}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-xl)', padding: '16px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'border-color .2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
              >
                {/* Logo / emoji */}
                <div style={{
                  width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                  background: 'var(--gradient-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, overflow: 'hidden',
                }}>
                  {society.logoURL
                    ? <img src={society.logoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : CATEGORY_EMOJI[society.category] ?? '🌐'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>
                      {society.name}
                    </span>
                    {society.isVerified && (
                      <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                        ✓ Verified
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 3 }}>
                    🎓 {society.organization} · {society.category.charAt(0).toUpperCase() + society.category.slice(1)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
                    <span>👥 {society.memberCount} members</span>
                    <span>❤️ {society.followerCount} followers</span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                      ID: {society.id.slice(0, 8)}…
                    </span>
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => setConfirmSociety(society)}
                  title="Super Admin: Delete this society"
                  style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)',
                    color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    transition: 'all .15s', fontFamily: 'var(--font-body)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.5)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.25)';
                  }}
                >
                  🗑️ Delete Society
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete modal */}
      {confirmSociety && (
        <ConfirmDeleteModal
          society={confirmSociety}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmSociety(null)}
          loading={deleting}
        />
      )}
    </>
  );
}
