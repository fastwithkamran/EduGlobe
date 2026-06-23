'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from '@/lib/firestore';
import type { Notification } from '@/types';

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 48 * 3600) return 'Yesterday';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

// Per updated spec: notifications are ONLY triggered when a followed society
// publishes a new post. Other activity types are filtered to 'new_post' only.
export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    unsubRef.current = subscribeToNotifications(user.uid, data => {
      // Filter to new_post only — per updated spec
      const filtered = data.filter(n => n.type === 'new_post');
      setNotifications(filtered);
      setLoading(false);
    });
    return () => unsubRef.current?.();
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    try { await markNotificationRead(id); }
    catch { toast.error('Failed to mark read'); }
  };

  const handleMarkAll = async () => {
    if (!user?.uid) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(user.uid);
      toast.success('All notifications marked as read');
    } catch { toast.error('Failed to update notifications'); }
    finally { setMarkingAll(false); }
  };

  return (
    <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🔔 Notifications</h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
            {loading ? 'Loading…' : unreadCount > 0
              ? `${unreadCount} unread — new posts from followed institutes`
              : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-outline btn-sm" onClick={handleMarkAll} disabled={markingAll}>
            {markingAll ? '⏳ Updating…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* Info banner explaining notification scope */}
      <div style={{
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 18,
        fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
        <span>
          You receive notifications only when a institute you <strong style={{ color: 'var(--primary-400)' }}>follow</strong> publishes a new post.
          Follow institutes in the <a href="/admin/feed" style={{ color: 'var(--primary-400)' }}>Global Feed</a> to start receiving updates.
        </span>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No notifications yet</div>
            <p style={{ fontSize: 13 }}>
              Follow institutes in the Global Feed — you'll be notified whenever they post.
            </p>
            <a href="/admin/feed" className="btn btn-primary btn-sm" style={{ marginTop: 16, display: 'inline-flex' }}>
              🌐 Go to Global Feed
            </a>
          </div>
        ) : (
          <div style={{ padding: '0 16px' }}>
            {notifications.map((n, i) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
                style={{
                  display: 'flex', gap: 12, padding: '14px 0', alignItems: 'flex-start',
                  borderBottom: i < notifications.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                  cursor: !n.isRead ? 'pointer' : 'default',
                  opacity: n.isRead ? 0.65 : 1,
                  transition: 'opacity .15s',
                }}
              >
                {/* Unread dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                  background: n.isRead ? 'var(--text-muted)' : 'var(--primary-500)',
                  boxShadow: !n.isRead ? '0 0 6px var(--primary-500)' : 'none',
                }} />

                {/* Icon — always 📝 for new_post */}
                <div style={{ fontSize: 16, width: 22, textAlign: 'center', flexShrink: 0 }}>📝</div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: !n.isRead ? 600 : 400, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {timeAgo(n.createdAt)}
                    {!n.isRead && (
                      <span style={{ color: 'var(--primary-400)', fontSize: 10 }}>• Click to mark read</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
