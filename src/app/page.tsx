'use client';
 
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
 
export default function LoginPage() {
  const { user, loginWithGoogle, loading } = useAuth();
  const router = useRouter();
 
  useEffect(() => {
    if (user && !loading) {
      router.push('/admin/feed');
    }
  }, [user, loading, router]);
 
  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch {
      toast.error('Failed to sign in with Google.');
    }
  };
 
  if (loading) {
    return (
      <div style={{
        display: 'flex', height: '100vh',
        justifyContent: 'center', alignItems: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid rgba(16,185,129,0.2)',
          borderTopColor: 'var(--primary-400)',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
 
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'var(--bg-primary)',
    }}>
      {/* ─── Login Card ─── */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 20,
        padding: '36px 40px',
        width: 400,
        maxWidth: '90vw',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        {/* Brand name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <img src="/logo.png" alt="EduGlobe" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'contain' }} />
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)',
          }}>
            Edu<span style={{ color: 'var(--primary-400)' }}>Globe</span>
          </div>
        </div>
 
        {/* Welcome message — matches screenshot exactly */}
        <p style={{
          color: 'var(--text-tertiary)',
          fontSize: 14,
          marginBottom: 28,
          lineHeight: 1.5,
        }}>
          Welcome! Please sign in to continue.
        </p>
 
        {/* Google Sign-In button */}
        <button
          onClick={handleLogin}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '13px 20px',
            background: 'var(--gradient-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            transition: 'all .2s',
            boxShadow: '0 0 20px rgba(16,185,129,0.2)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 30px rgba(16,185,129,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px rgba(16,185,129,0.2)';
          }}
        >
          {/* Google "G" icon — inline SVG, no external dependency */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="rgba(255,255,255,0.9)" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="rgba(255,255,255,0.85)" />
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="rgba(255,255,255,0.8)" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="rgba(255,255,255,0.9)" />
          </svg>
          Sign In with Google
        </button>
      </div>
    </div>
  );
}
