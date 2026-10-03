'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Root page — immediately redirects to /feed.
 * Authenticated users land on /feed with full access.
 * Guests land on /feed and can browse freely; sign-in is available via the sidebar.
 */
export default function RootPage() {
  const { loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace('/feed');
    }
  }, [loading, router]);

  // Minimal loading state while auth resolves
  return (
    <div style={{
      display: 'flex', height: '100vh',
      justifyContent: 'center', alignItems: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2px solid rgba(16,185,129,0.2)',
        borderTopColor: 'var(--primary-400)',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
