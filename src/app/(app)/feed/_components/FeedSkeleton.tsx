'use client';

/** Skeleton placeholder cards shown while the feed is loading */
export function FeedSkeleton() {
  return (
    <div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--bg-tertiary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 12, width: '40%', background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
              <div style={{ height: 10, width: '25%', background: 'var(--bg-tertiary)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          </div>
          <div style={{ height: 12, background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 12, width: '80%', background: 'var(--bg-tertiary)', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
          <div style={{ height: 12, width: '60%', background: 'var(--bg-tertiary)', borderRadius: 6, animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  );
}
