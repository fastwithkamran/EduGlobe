'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToNotifications } from '@/lib/firestore';
import type { Notification } from '@/types';
import { useIsMobile } from '../../../hooks/use-mobile'; // Use relative because hooks is outside src
import { sanitizeImageUrl } from '@/../lib/utils';

// ─── Navigation Structure ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    section: 'Discover',
    items: [
      { label: 'Global Feed',      href: '/admin/feed',           icon: '🌐' },
    ],
  },
  {
    section: 'Learning Center',
    items: [
      { label: 'Academy',     href: '/admin/society',        icon: '🏛️' },
      { label: 'Share Wisdom',   href: '/admin/create-society', icon: '✚' },
    ],
  },
  {
    section: 'AI Tools',
    items: [
      { label: 'AI Assistant',     href: '/admin/ai',             icon: '🤖' },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'Notifications',    href: '/admin/notifications',  icon: '🔔', dynamic: 'unread' as const },
      { label: 'Settings',         href: '/admin/settings',       icon: '⚙️' },
    ],
  },
  {
    section: 'Admin Controls',
    superAdminSection: true,
    items: [
      { label: 'Manage Societies', href: '/admin/societies',      icon: '🗂️', superAdminOnly: true },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, loading, logout, user, isSuperAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!user?.uid) return;
    unsubRef.current = subscribeToNotifications(user.uid, (notifs: Notification[]) => {
      setUnreadCount(notifs.filter(n => !n.isRead).length);
    });
    return () => { unsubRef.current?.(); };
  }, [user?.uid]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ color: 'var(--primary-400)', fontFamily: 'var(--font-heading)', fontSize: '1.25rem' }}>
          Loading EduGlobe…
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  const initials = userProfile?.displayName
    ? userProfile.displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] ?? '?').toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  // Flattened items for mobile bottom nav
  const mobileNavItems = [
    { label: 'Feed', href: '/admin/feed', icon: '🌐' },
    { label: 'Academy', href: '/admin/society', icon: '🏛️' },
    { label: 'AI', href: '/admin/ai', icon: '🤖' },
    { label: 'Alerts', href: '/admin/notifications', icon: '🔔', badge: unreadCount },
    { label: 'Profile', href: '/admin/settings', icon: '⚙️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

      {/* ─── Mobile Top Header ─── */}
      {isMobile && (
        <header style={{
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px',
          background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo.png" alt="EduGlobe" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>
              Edu<span style={{ color: 'var(--primary-400)' }}>Globe</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {isSuperAdmin && <span style={{ fontSize: 14 }}>⚡</span>}
            <Link href="/admin/create-society" style={{ color: '#fff', textDecoration: 'none', background: 'var(--gradient-primary)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              + Share Wisdom
            </Link>
          </div>
        </header>
      )}

      {/* ─── Desktop Sidebar ─── */}
      {!isMobile && (
        <aside style={{
          width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'all var(--transition-base)',
        }}>

          {/* Logo */}
          <div style={{
            padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10,
            borderBottom: '1px solid var(--border-primary)',
          }}>
            <img src="/logo.png" alt="EduGlobe" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>
              Edu<span style={{ color: 'var(--primary-400)' }}>Globe</span>
            </span>
          </div>

          {/* Super-admin strip */}
          {isSuperAdmin && (
            <div style={{
              padding: '6px 12px', background: 'rgba(239,68,68,0.08)',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 600, color: '#ef4444',
            }}>
              <span>⚡</span> Super Admin Mode
            </div>
          )}

          {/* Nav */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {NAV_ITEMS.map((section) => {
              if ((section as { superAdminSection?: boolean }).superAdminSection && !isSuperAdmin) return null;
              return (
                <div key={section.section}>
                  <div style={{
                    fontSize: 10, fontWeight: 600,
                    color: (section as { superAdminSection?: boolean }).superAdminSection
                      ? 'rgba(239,68,68,0.6)' : 'var(--text-muted)',
                    letterSpacing: '.08em', textTransform: 'uppercase',
                    padding: '12px 8px 6px',
                  }}>
                    {section.section}
                  </div>

                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/admin/feed' && pathname.startsWith(item.href));
                    const badge = (item as { dynamic?: string }).dynamic === 'unread' ? unreadCount : 0;
                    const isAdminItem = (item as { superAdminOnly?: boolean }).superAdminOnly;
                    const isCreateSociety = item.href === '/admin/create-society';

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: isCreateSociety ? '9px 10px' : '8px 10px',
                          borderRadius: 'var(--radius-md)', marginBottom: 3,
                          textDecoration: 'none', fontSize: 13,
                          color: isActive
                            ? (isAdminItem ? '#ef4444' : 'var(--primary-400)')
                            : isCreateSociety ? 'var(--text-primary)' : 'var(--text-secondary)',
                          background: isActive
                            ? (isAdminItem ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)')
                            : isCreateSociety
                              ? 'linear-gradient(135deg,var(--primary-500),var(--primary-700))'
                              : 'transparent',
                          border: isCreateSociety && !isActive ? '1px solid rgba(16,185,129,0.3)' : 'none',
                          fontWeight: isCreateSociety ? 600 : 400,
                          transition: 'all .15s',
                        }}
                      >
                        <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                        {item.label}
                        {badge > 0 && (
                          <span style={{
                            marginLeft: 'auto', background: '#ef4444', color: '#fff',
                            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                          }}>
                            {badge}
                          </span>
                        )}
                        {isAdminItem && !isActive && (
                          <span style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* User footer */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              {userProfile?.photoURL ? (
                <img src={sanitizeImageUrl(userProfile.photoURL)} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isSuperAdmin ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--gradient-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {initials}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {userProfile?.displayName ?? user.email}
                </div>
                <div style={{ fontSize: 10, color: isSuperAdmin ? '#ef4444' : 'var(--text-tertiary)' }}>
                  {isSuperAdmin ? '⚡ Super Admin' : userProfile?.role === 'admin' ? 'Society Admin' : 'Viewer'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', padding: '4px 0', transition: 'color .15s', width: '100%', textAlign: 'left' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              🚪 Log Out
            </button>
          </div>
        </aside>
      )}

      {/* ─── Main Content ─── */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: isMobile ? 65 : 0 }}>
        {children}
      </main>

      {/* ─── Mobile Bottom Nav ─── */}
      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, minHeight: 65,
          background: 'rgba(13, 18, 32, 0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-primary)', zIndex: 100,
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          padding: '8px 0 calc(8px + env(safe-area-inset-bottom))'
        }}>
          {mobileNavItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/admin/feed' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', width: '20%' }}>
                <div style={{
                  fontSize: 20, filter: isActive ? 'grayscale(0)' : 'grayscale(1)', opacity: isActive ? 1 : 0.6,
                  transform: isActive ? 'translateY(-2px)' : 'none', transition: 'all 0.2s'
                }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--primary-400)' : 'var(--text-secondary)' }}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: -5, right: 10, background: '#ef4444', color: '#fff',
                    fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-secondary)'
                  }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      )}

    </div>
  );
}
