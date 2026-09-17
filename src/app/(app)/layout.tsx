'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToNotifications } from '@/lib/firestore';
import type { Notification } from '@/types';
import { useIsMobile } from '../../../hooks/use-mobile';
import { sanitizeImageUrl } from '@/../lib/utils';

const NAV_ITEMS = [
  {
    section: 'Discover',
    items: [
      { label: 'Global Feed',      href: '/feed',           icon: '🌐' },
    ],
  },
  {
    section: 'Learning Center',
    items: [
      { label: 'Academy',          href: '/society',        icon: '🏛️' },
      { label: 'Share Wisdom',     href: '/create-society', icon: '✚' },
    ],
  },
  {
    section: 'AI Tools',
    items: [
      { label: 'AI Assistant',     href: '/ai',             icon: '🤖' },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'Notifications',    href: '/notifications',  icon: '🔔', dynamic: 'unread' as const },
      { label: 'Settings',         href: '/settings',       icon: '⚙️' },
    ],
  },
  {
    section: 'Admin Controls',
    superAdminSection: true,
    items: [
      { label: 'Manage Societies', href: '/societies',      icon: '🗂️', superAdminOnly: true },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, loading, logout, user, isSuperAdmin, loginWithGoogle } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const unsubRef = useRef<(() => void) | null>(null);
  const isMobile = useIsMobile();

  // ─── Theme toggle ─────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const saved = localStorage.getItem('eduglobe-theme') as 'dark' | 'light' | null;
    if (saved) setTheme(saved);
  }, []);
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('eduglobe-theme', next);
    if (next === 'light') document.documentElement.dataset.theme = 'light';
    else delete document.documentElement.dataset.theme;
  };

  // ─── Mobile nav auto-hide on scroll ──────────────────────────────────────
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      setNavVisible(y < lastScrollY.current || y < 80);
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [isMobile]);

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

  const initials = userProfile?.displayName
    ? userProfile.displayName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : (user?.email?.[0] ?? '?').toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const handleGuestSignIn = async () => {
    try { await loginWithGoogle(); }
    catch { /* user cancelled */ }
  };

  const mobileNavItems = [
    { label: 'Feed',    href: '/feed',          icon: '🌐' },
    { label: 'Academy', href: '/society',        icon: '🏛️' },
    { label: 'AI',      href: '/ai',             icon: '🤖' },
    { label: 'Alerts',  href: '/notifications',  icon: '🔔', badge: unreadCount },
    { label: 'Profile', href: '/settings',       icon: '⚙️' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', overflow: 'hidden', background: 'var(--bg-primary)' }}>

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isSuperAdmin && <span style={{ fontSize: 14 }}>⚡</span>}
            <button
              onClick={toggleTheme}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14 }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {user ? (
              <Link href="/create-society" style={{ color: '#fff', textDecoration: 'none', background: 'var(--gradient-primary)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
                + Share Wisdom
              </Link>
            ) : (
              <button onClick={handleGuestSignIn} style={{ color: '#fff', background: 'var(--gradient-primary)', padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Sign In
              </button>
            )}
          </div>
        </header>
      )}

      {!isMobile && (
        <aside style={{
          width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'all var(--transition-base)',
        }}>
          <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border-primary)' }}>
            <img src="/logo.png" alt="EduGlobe" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, objectFit: 'contain' }} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 16 }}>
              Edu<span style={{ color: 'var(--primary-400)' }}>Globe</span>
            </span>
          </div>

          {isSuperAdmin && (
            <div style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#ef4444' }}>
              <span>⚡</span> Super Admin Mode
            </div>
          )}

          <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
            {NAV_ITEMS.map((section) => {
              if ((section as { superAdminSection?: boolean }).superAdminSection && !isSuperAdmin) return null;
              return (
                <div key={section.section}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: (section as { superAdminSection?: boolean }).superAdminSection ? 'rgba(239,68,68,0.6)' : 'var(--text-muted)', letterSpacing: '.08em', textTransform: 'uppercase', padding: '12px 8px 6px' }}>
                    {section.section}
                  </div>
                  {section.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/feed' && pathname.startsWith(item.href));
                    const badge = (item as { dynamic?: string }).dynamic === 'unread' ? unreadCount : 0;
                    const isAdminItem = (item as { superAdminOnly?: boolean }).superAdminOnly;
                    const isCreateSociety = item.href === '/create-society';
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: isCreateSociety ? '9px 10px' : '8px 10px',
                          borderRadius: 'var(--radius-md)', marginBottom: 3,
                          textDecoration: 'none', fontSize: 13,
                          color: isActive ? (isAdminItem ? '#ef4444' : 'var(--primary-400)') : isCreateSociety ? 'var(--text-primary)' : 'var(--text-secondary)',
                          background: isActive ? (isAdminItem ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.12)') : isCreateSociety ? 'linear-gradient(135deg,var(--primary-500),var(--primary-700))' : 'transparent',
                          border: isCreateSociety && !isActive ? '1px solid rgba(16,185,129,0.3)' : 'none',
                          fontWeight: isCreateSociety ? 600 : 400,
                          transition: 'all .15s',
                        }}
                      >
                        <span style={{ fontSize: 14, width: 18, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                        {item.label}
                        {badge > 0 && (
                          <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999 }}>
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

          {/* Sidebar Footer: user profile OR guest sign-in */}
          <div style={{ padding: 12, borderTop: '1px solid var(--border-primary)' }}>
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  {userProfile?.photoURL ? (
                    <img src={sanitizeImageUrl(userProfile.photoURL)} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSuperAdmin ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handleLogout}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 12, cursor: 'pointer', padding: '4px 0', transition: 'color .15s', flex: 1, textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    🚪 Log Out
                  </button>
                  {/* Theme toggle */}
                  <button
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14, transition: 'all .15s', flexShrink: 0 }}
                  >
                    {theme === 'dark' ? '☀️' : '🌙'}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleGuestSignIn}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 14px', background: 'var(--gradient-primary)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all .2s', boxShadow: '0 0 16px rgba(16,185,129,0.2)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 24px rgba(16,185,129,0.35)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 16px rgba(16,185,129,0.2)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="rgba(255,255,255,0.9)" />
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="rgba(255,255,255,0.85)" />
                    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="rgba(255,255,255,0.8)" />
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="rgba(255,255,255,0.9)" />
                  </svg>
                  Sign in with Google
                </button>
                <button
                  onClick={toggleTheme}
                  title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-primary)', borderRadius: 8, padding: '4px 8px', cursor: 'pointer', fontSize: 14, transition: 'all .15s', flexShrink: 0 }}
                >
                  {theme === 'dark' ? '☀️' : '🌙'}
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: isMobile ? 65 : 0 }}>
        {children}
      </main>

      {isMobile && (
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, minHeight: 65,
          background: 'rgba(13, 18, 32, 0.9)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-primary)', zIndex: 100,
          display: 'flex', justifyContent: 'space-around', alignItems: 'center',
          padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
          // Auto-hide on scroll down, reappear on scroll up
          transform: navVisible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {mobileNavItems.map(item => {
            const isActive = pathname === item.href || (item.href !== '/feed' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, position: 'relative', width: '20%' }}>
                <div style={{ fontSize: 20, filter: isActive ? 'grayscale(0)' : 'grayscale(1)', opacity: isActive ? 1 : 0.6, transform: isActive ? 'translateY(-2px)' : 'none', transition: 'all 0.2s' }}>
                  {item.icon}
                </div>
                <span style={{ fontSize: 10, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--primary-400)' : 'var(--text-secondary)' }}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: 10, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-secondary)' }}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

