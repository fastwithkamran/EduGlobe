'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToFeed, subscribeToFollowingFeed,
  togglePostLike, subscribeToComments, addComment,
  followSociety, unfollowSociety, getFollowedSocietyIds,
  deletePost,
} from '@/lib/firestore';
import type { Post, PostComment, PostType } from '@/types';
import { sanitizeImageUrl } from '@/../lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const TYPE_COLOR: Record<PostType, string> = {
  announcement: 'rgba(96,165,250,0.15)',
  event:        'rgba(16,185,129,0.15)',
  achievement:  'rgba(251,191,36,0.15)',
  recruitment:  'rgba(139,92,246,0.15)',
  general:      'rgba(107,114,128,0.15)',
};
const TYPE_TEXT: Record<PostType, string> = {
  announcement: '#60a5fa',
  event:        '#10b981',
  achievement:  '#fbbf24',
  recruitment:  '#a78bfa',
  general:      '#9ca3af',
};

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────

function ConfirmDeleteModal({ message, onConfirm, onCancel, loading }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 16, padding: '28px 24px', width: 400, maxWidth: '90vw' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, margin: '0 auto 16px' }}>🗑️</div>
        <h2 style={{ fontSize: 'var(--text-xl)', fontFamily: 'var(--font-heading)', fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>Delete Post?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>{message}<br /><strong style={{ color: '#ef4444' }}>This action cannot be undone.</strong></p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading} style={{ minWidth: 90 }}>Cancel</button>
          <button disabled={loading} onClick={onConfirm} style={{ minWidth: 120, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 18px', background: loading ? 'rgba(239,68,68,0.4)' : 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: 'none', borderRadius: 'var(--radius-lg)', fontWeight: 600, fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
            {loading ? '⏳ Deleting…' : '🗑️ Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Comment Thread ────────────────────────────────────────────────────────────

function CommentThread({ postId }: { postId: string }) {
  const { user, userProfile } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    unsubRef.current = subscribeToComments(postId, setComments);
    return () => unsubRef.current?.();
  }, [postId]);

  const submit = async () => {
    if (!text.trim() || !user || !userProfile) return;
    setSending(true);
    try {
      await addComment(postId, { postId, authorId: user.uid, authorName: userProfile.displayName, authorPhotoURL: userProfile.photoURL, content: text.trim() });
      setText('');
    } catch { toast.error('Failed to post comment'); }
    finally { setSending(false); }
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
      {comments.length === 0 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>No comments yet — be the first!</p>}
      {comments.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' }}>
            {c.authorPhotoURL ? <img src={sanitizeImageUrl(c.authorPhotoURL)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : getInitials(c.authorName)}
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '0 12px 12px 12px', padding: '8px 12px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{c.authorName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.content}</div>
          </div>
        </div>
      ))}
      {user && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); }} placeholder="Write a comment…" className="input" style={{ flex: 1, padding: '7px 12px', fontSize: 13 }} />
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={sending || !text.trim()}>{sending ? '…' : 'Post'}</button>
        </div>
      )}
    </div>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ post, currentUserId, followedIds, onFollowToggle, isSuperAdmin }: {
  post: Post;
  currentUserId?: string;
  followedIds: Set<string>;
  onFollowToggle: (sid: string, following: boolean) => void;
  isSuperAdmin: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isLiked = currentUserId ? post.likedBy.includes(currentUserId) : false;
  const isFollowing = followedIds.has(post.societyId);

  const handleLike = async () => {
    if (!currentUserId) return toast.error('Sign in to like posts');
    setLiking(true);
    try { await togglePostLike(post.id, currentUserId, !isLiked); }
    catch { toast.error('Failed'); }
    finally { setLiking(false); }
  };

  const handleFollow = async () => {
    if (!currentUserId) return toast.error('Sign in to follow societies');
    try {
      if (isFollowing) {
        await unfollowSociety(currentUserId, post.societyId);
        onFollowToggle(post.societyId, false);
        toast.success(`Unfollowed ${post.societyName}`);
      } else {
        await followSociety(currentUserId, post.societyId);
        onFollowToggle(post.societyId, true);
        toast.success(`Following ${post.societyName}!`);
      }
    } catch { toast.error('Failed to update follow'); }
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try { await deletePost(post.id); toast.success('Post deleted'); setConfirmDelete(false); }
    catch { toast.error('Failed to delete post'); }
    finally { setDeleting(false); }
  };

  return (
    <>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 14, position: 'relative', transition: 'border-color .2s' }}>

        {/* Super-admin delete */}
        {isSuperAdmin && (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Super Admin: Delete this post"
            style={{ position: 'absolute', top: 12, right: 12, width: 30, height: 30, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', zIndex: 1 }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.22)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)'; (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >🗑️</button>
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, paddingRight: isSuperAdmin ? 44 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', flexShrink: 0 }}>
              {post.societyLogoURL ? <img src={sanitizeImageUrl(post.societyLogoURL)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : getInitials(post.societyName)}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{post.societyName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{timeAgo(post.createdAt)}</span>
                <span style={{ background: TYPE_COLOR[post.type], color: TYPE_TEXT[post.type], padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>
                  {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
                </span>
              </div>
            </div>
          </div>
          <button className={`btn btn-sm ${isFollowing ? 'btn-outline' : 'btn-primary'}`} onClick={handleFollow} style={{ flexShrink: 0 }}>
            {isFollowing ? '✓ Following' : '+ Follow'}
          </button>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: post.attachments.length > 0 ? 12 : 0 }}>{post.content}</p>

        {/* Attachments */}
        {post.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {post.attachments.map(att => {
              const isImg = att.fileType.startsWith('image/');
              return isImg ? (
                <a key={att.id} href={sanitizeImageUrl(att.fileURL)} target="_blank" rel="noreferrer" style={{ borderRadius: 8, overflow: 'hidden', display: 'block', maxWidth: 280, border: '1px solid var(--border-primary)' }}>
                  <img src={sanitizeImageUrl(att.fileURL)} alt={att.fileName} style={{ width: '100%', height: 'auto', display: 'block' }} />
                </a>
              ) : (
                <a key={att.id} href={sanitizeImageUrl(att.fileURL)} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 8, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 12 }}>
                  📎 {att.fileName}
                </a>
              );
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
          <button onClick={handleLike} disabled={liking} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: isLiked ? '#ef4444' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 8, transition: 'all .15s' }}>
            {isLiked ? '♥' : '♡'} {post.likeCount}
          </button>
          <button onClick={() => setShowComments(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: showComments ? 'var(--primary-400)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 8, transition: 'all .15s' }}>
            💬 {post.commentCount}
          </button>
          <button onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied!'); }} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px', borderRadius: 8, transition: 'all .15s' }}>
            ↗ Share
          </button>
        </div>

        {showComments && <CommentThread postId={post.id} />}
      </div>

      {confirmDelete && (
        <ConfirmDeleteModal
          message={`Delete this post by "${post.societyName}"?`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(false)}
          loading={deleting}
        />
      )}
    </>
  );
}

// ─── Main Feed Page ────────────────────────────────────────────────────────────
// Tabs: "All Posts" (global) | "Following" (followed societies only)
// "My Society" tab has been removed per updated spec.

type FeedTab = 'all' | 'following';

export default function GlobalFeedPage() {
  const { user, isSuperAdmin } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [followingPosts, setFollowingPosts] = useState<Post[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<FeedTab>('all');
  const [loadingAll, setLoadingAll] = useState(true);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  const allUnsubRef  = useRef<(() => void) | null>(null);
  const followUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to global public feed
  useEffect(() => {
    allUnsubRef.current = subscribeToFeed(posts => {
      setAllPosts(posts);
      setLoadingAll(false);
    });
    return () => allUnsubRef.current?.();
  }, []);

  // Load followed IDs first, then subscribe to their posts
  useEffect(() => {
    if (!user?.uid) return;
    getFollowedSocietyIds(user.uid).then(ids => {
      const idSet = new Set(ids);
      setFollowedIds(idSet);

      followUnsubRef.current?.();
      const unsub = subscribeToFollowingFeed(ids, posts => {
        setFollowingPosts(posts);
        setFollowingLoaded(true);
      });
      if (unsub) followUnsubRef.current = unsub;
      else setFollowingLoaded(true);
    });
    return () => followUnsubRef.current?.();
  }, [user?.uid]);

  const handleFollowToggle = (societyId: string, following: boolean) => {
    setFollowedIds(prev => {
      const next = new Set(prev);
      following ? next.add(societyId) : next.delete(societyId);
      return next;
    });
    // Re-subscribe to following feed with updated IDs
    if (user?.uid) {
      getFollowedSocietyIds(user.uid).then(ids => {
        followUnsubRef.current?.();
        const unsub = subscribeToFollowingFeed(ids, setFollowingPosts);
        if (unsub) followUnsubRef.current = unsub;
      });
    }
  };

  const currentPosts = tab === 'all' ? allPosts : followingPosts;
  const isLoading = tab === 'all' ? loadingAll : !followingLoaded;

  return (
    <>
      <div style={{ padding: 'var(--page-padding-y) var(--page-padding-x) 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800, marginBottom: 4 }}>🌐 Global Learning Feed</h1>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
              Discover posts from institutes around the world
              {isSuperAdmin && (
                <span style={{ marginLeft: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  ⚡ Super Admin Mode
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Tabs — only All Posts and Following */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)' }}>
          {(['all', 'following'] as FeedTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 500,
              color: tab === t ? 'var(--primary-400)' : 'var(--text-tertiary)',
              borderBottom: `2px solid ${tab === t ? 'var(--primary-400)' : 'transparent'}`,
              background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
              cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-body)',
            }}>
              {t === 'all' ? '🌐 All Posts' : '🔔 Following'}
              {t === 'following' && followedIds.size > 0 && (
                <span style={{ marginLeft: 6, background: 'rgba(16,185,129,0.15)', color: 'var(--primary-400)', padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
                  {followedIds.size}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px var(--page-padding-x)', flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>Loading feed…</div>
        ) : currentPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{tab === 'following' ? '🔔' : '📭'}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              {tab === 'following' ? 'No posts from followed institutes' : 'No posts yet'}
            </div>
            <p style={{ fontSize: 13 }}>
              {tab === 'following'
                ? 'Click "+ Follow" on any post in the All Posts tab to follow institutes.'
                : 'Institutes will start posting soon.'}
            </p>
          </div>
        ) : (
          currentPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={user?.uid}
              followedIds={followedIds}
              onFollowToggle={handleFollowToggle}
              isSuperAdmin={isSuperAdmin}
            />
          ))
        )}
      </div>
    </>
  );
}
