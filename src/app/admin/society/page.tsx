'use client';
 
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSociety, subscribeToSocietyPosts, createPost,
  togglePostLike, subscribeToComments, addComment,
  uploadFile, deletePost,
} from '@/lib/firestore';
import type {
  Society, Post, PostComment, PostAttachment, PostType,
} from '@/types';
 
// ─── Helpers ──────────────────────────────────────────────────────────────────
 
function timeAgo(date: any): string {
  if (!date) return 'just now';
  const d = date.toDate ? date.toDate() : new Date(date);
  if (isNaN(d.getTime())) return 'just now';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
}
 
function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
 
const TYPE_COLORS: Record<PostType, string> = {
  announcement: 'rgba(96,165,250,0.15)', event: 'rgba(16,185,129,0.15)',
  achievement: 'rgba(251,191,36,0.15)', recruitment: 'rgba(139,92,246,0.15)',
  general: 'rgba(107,114,128,0.15)',
};
const TYPE_TEXTS: Record<PostType, string> = {
  announcement: '#60a5fa', event: '#10b981', achievement: '#fbbf24',
  recruitment: '#a78bfa', general: '#9ca3af',
};
const POST_TYPE_OPTIONS: Array<{ value: PostType; label: string }> = [
  { value: 'announcement', label: '📢 Announcement' },
  { value: 'event',        label: '📅 Event' },
  { value: 'achievement',  label: '🏆 Achievement' },
  { value: 'recruitment',  label: '🎯 Recruitment' },
  { value: 'general',      label: '💬 General' },
];
 
// ─── Comment Thread ────────────────────────────────────────────────────────────
 
function CommentThread({ postId }: { postId: string }) {
  const { user, userProfile } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
 
  useEffect(() => {
    const unsub = subscribeToComments(postId, setComments);
    return () => unsub();
  }, [postId]);
 
  const submit = async () => {
    if (!text.trim() || !user || !userProfile) return;
    setSending(true);
    try {
      await addComment(postId, {
        postId,
        authorId: user.uid,
        authorName: userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content: text.trim(),
      });
      setText('');
    } catch { toast.error('Failed to post comment'); }
    finally { setSending(false); }
  };
 
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
      {comments.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>No comments yet.</p>
      )}
      {comments.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden',
          }}>
            {c.authorPhotoURL
              ? <img src={c.authorPhotoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : getInitials(c.authorName)}
          </div>
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '0 10px 10px 10px', padding: '7px 11px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{c.authorName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.content}</div>
          </div>
        </div>
      ))}
      {user && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); }}
            placeholder="Comment…"
            className="input"
            style={{ flex: 1, padding: '7px 12px', fontSize: 13 }}
          />
          <button className="btn btn-primary btn-sm" onClick={submit} disabled={sending || !text.trim()}>
            {sending ? '…' : 'Post'}
          </button>
        </div>
      )}
    </div>
  );
}
 
// ─── Post Composer ─────────────────────────────────────────────────────────────
 
function PostComposer({ society, authorId, authorName }: {
  society: Society;
  authorId: string;
  authorName: string;
}) {
  const [content, setContent] = useState('');
  const [type, setType] = useState<PostType>('announcement');
  const [visibility, setVisibility] = useState<'public' | 'members_only'>('public');
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedLabel = POST_TYPE_OPTIONS.find(o => o.value === type)?.label ?? type;
 
  const publish = async () => {
    if (!content.trim()) return toast.error('Post content is required');
    setUploading(true);
    try {
      const attachments: PostAttachment[] = [];
      for (const f of files) {
        const url = await uploadFile(f, `posts/${society.id}/${Date.now()}_${f.name}`, p => setProgress(p));
        attachments.push({ id: `${Date.now()}`, fileName: f.name, fileURL: url, fileType: f.type, fileSize: f.size });
      }
      await createPost({
        societyId: society.id,
        societyName: society.name,
        societyLogoURL: society.logoURL || null,
        authorId,
        authorName,
        content: content.trim(),
        type,
        visibility,
        attachments,
      });
      toast.success('Post published!');
      setContent(''); setFiles([]); setProgress(0);
    } catch { toast.error('Failed to publish post'); }
    finally { setUploading(false); }
  };
 
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-xl)', padding: 18, marginBottom: 20,
    }}>
      <textarea
        className="input"
        rows={3}
        placeholder={`Share something with ${society.name}…`}
        value={content}
        onChange={e => setContent(e.target.value)}
        style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Post Type</div>
          <select
            value={type}
            onChange={e => setType(e.target.value as PostType)}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-body)',
              fontSize: 13, padding: '8px 12px', outline: 'none', appearance: 'none', cursor: 'pointer',
            }}
          >
            {POST_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value} style={{ background: '#111827' }}>{o.label}</option>
            ))}
          </select>
          <span style={{
            display: 'inline-block', marginTop: 4,
            background: TYPE_COLORS[type], color: TYPE_TEXTS[type],
            padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          }}>
            {selectedLabel}
          </span>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Visibility</div>
          <select
            value={visibility}
            onChange={e => setVisibility(e.target.value as 'public' | 'members_only')}
            className="input select"
            style={{ width: '100%' }}
          >
            <option value="public">🌐 Public</option>
            <option value="members_only">🔒 Members Only</option>
          </select>
        </div>
      </div>
 
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: uploading ? 10 : 0 }}>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            background: 'none', border: '1px dashed var(--border-primary)',
            borderRadius: 8, padding: '6px 12px', fontSize: 12,
            color: 'var(--text-tertiary)', cursor: 'pointer',
          }}
        >
          📎 Attach file/image
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files) setFiles(Array.from(e.target.files)); }}
        />
        {files.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--primary-400)', flex: 1 }}>
            {files.map(f => f.name).join(', ')}
            <button
              onClick={() => setFiles([])}
              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', marginLeft: 8 }}
            >×</button>
          </div>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={publish}
          disabled={uploading || !content.trim()}
          style={{ marginLeft: 'auto' }}
        >
          {uploading ? `${progress}%` : '📤 Publish'}
        </button>
      </div>
 
      {uploading && (
        <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 999, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--gradient-primary)', transition: 'width .3s' }} />
        </div>
      )}
    </div>
  );
}
 
// ─── Post Card ────────────────────────────────────────────────────────────────
 
function SocietyPostCard({ post, currentUserId, isAdmin, isSuperAdmin }: {
  post: Post;
  currentUserId?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
 
  const isLiked = currentUserId ? post.likedBy.includes(currentUserId) : false;
 
  const handleLike = async () => {
    if (!currentUserId) return;
    setLiking(true);
    try { await togglePostLike(post.id, currentUserId, !isLiked); }
    catch { toast.error('Failed'); }
    finally { setLiking(false); }
  };
 
  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(true);
    try { await deletePost(post.id); toast.success('Post deleted'); }
    catch { toast.error('Failed to delete post'); }
    finally { setDeleting(false); }
  };
 
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-xl)', padding: 18, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{post.authorName}</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center' }}>
            {timeAgo(post.createdAt)}
            <span style={{
              background: TYPE_COLORS[post.type], color: TYPE_TEXTS[post.type],
              padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 500,
            }}>
              {post.type}
            </span>
            {post.visibility === 'members_only' && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>🔒 Members</span>
            )}
          </div>
        </div>
        {(isAdmin || isSuperAdmin) && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              background: 'none', border: '1px solid rgba(239,68,68,0.2)',
              color: '#ef4444', borderRadius: 6, padding: '4px 10px',
              fontSize: 11, cursor: 'pointer', transition: 'all .15s',
            }}
          >
            {deleting ? '…' : '🗑'}
          </button>
        )}
      </div>
 
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: post.attachments.length ? 10 : 0 }}>
        {post.content}
      </p>
 
      {post.attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {post.attachments.map(att => {
            const isImg = att.fileType.startsWith('image/');
            return isImg ? (
              <a key={att.id} href={att.fileURL} target="_blank" rel="noreferrer"
                style={{ borderRadius: 8, overflow: 'hidden', display: 'block', maxWidth: 240, border: '1px solid var(--border-primary)' }}>
                <img src={att.fileURL} alt={att.fileName} style={{ width: '100%', height: 'auto', display: 'block' }} />
              </a>
            ) : (
              <a key={att.id} href={att.fileURL} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', borderRadius: 8, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 12 }}>
                📎 {att.fileName}
              </a>
            );
          })}
        </div>
      )}
 
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-secondary)' }}>
        <button
          onClick={handleLike}
          disabled={liking}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: isLiked ? '#ef4444' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}
        >
          {isLiked ? '♥' : '♡'} {post.likeCount}
        </button>
        <button
          onClick={() => setShowComments(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: showComments ? 'var(--primary-400)' : 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: 6 }}
        >
          💬 {post.commentCount}
        </button>
      </div>
 
      {showComments && <CommentThread postId={post.id} />}
    </div>
  );
}
 
// ─── Main Society Page ─────────────────────────────────────────────────────────
// Tabs: Feed | About only. Groups and Members have been removed.
 
type SocietyTab = 'feed' | 'about';
 
export default function SocietyPage() {
  const { user, userProfile, isSuperAdmin } = useAuth();
  const router = useRouter();
 
  const [society, setSociety] = useState<Society | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<SocietyTab>('feed');
  const [loading, setLoading] = useState(true);
 
  const postsUnsubRef = useRef<(() => void) | null>(null);
 
  useEffect(() => {
    if (!userProfile?.societyId) { setLoading(false); return; }
 
    getSociety(userProfile.societyId).then(s => {
      setSociety(s);
      setLoading(false);
    });
 
    postsUnsubRef.current = subscribeToSocietyPosts(userProfile.societyId, setPosts);
 
    return () => { postsUnsubRef.current?.(); };
  }, [userProfile?.societyId]);
 
  const isAdmin = isSuperAdmin || userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
 
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
        Loading society…
      </div>
    );
  }
 
  if (!userProfile?.societyId || !society) {
    return (
      <div style={{ padding: '40px 28px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏛️</div>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          No Academy Yet
        </h2>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 13, marginBottom: 24 }}>
          You haven't created an Academy. Create one to get started!
        </p>
        <button className="btn btn-primary" onClick={() => router.push('/admin/create-society')}>
          + Start a Education Hub
        </button>
      </div>
    );
  }
 
  const TABS: Array<{ id: SocietyTab; label: string }> = [
    { id: 'feed',  label: '📰 Feed' },
    { id: 'about', label: 'ℹ️ About' },
  ];
 
  const CATEGORY_EMOJI: Record<string, string> = {
    educational: '🎓', professional: '💼', technology: '💻', cultural: '🎭',
    sports: '⚽', arts: '🎨', debate: '🎤', religious: '🕌',
    community: '🤝', entrepreneurship: '🚀', media: '📹', other: '🌐',
  };
 
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
 
      {/* ─── Society Banner ─── */}
      <div style={{
        position: 'relative', height: 160, flexShrink: 0,
        background: society.bannerURL
          ? `url(${society.bannerURL}) center/cover`
          : 'var(--gradient-hero)',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(6,11,24,0.9))' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 var(--page-padding-x) 16px', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 14,
            background: 'var(--gradient-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.1)', flexShrink: 0,
          }}>
            {society.logoURL
              ? <img src={society.logoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : CATEGORY_EMOJI[society.category] ?? '🌐'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>
                {society.name}
              </h1>
              {society.isVerified && (
                <span style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700 }}>
                  ✓ Verified
                </span>
              )}
              <span style={{
                background: society.privacy === 'public' ? 'rgba(96,165,250,0.2)' : 'rgba(107,114,128,0.2)',
                color: society.privacy === 'public' ? '#60a5fa' : '#9ca3af',
                padding: '1px 8px', borderRadius: 999, fontSize: 10,
              }}>
                {society.privacy === 'public' ? '🌐 Public' : '🔒 Private'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {society.organization && <span>🏫 {society.organization}</span>}
              <span>📍 {society.city}, {society.country}</span>
            </div>
          </div>
        </div>
      </div>
 
      {/* ─── Tabs (Feed + About only) ─── */}
      <div style={{
        borderBottom: '1px solid var(--border-primary)',
        padding: '0 var(--page-padding-x)', background: 'var(--bg-secondary)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '12px 16px', fontSize: 13, fontWeight: 500,
                color: tab === t.id ? 'var(--primary-400)' : 'var(--text-tertiary)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--primary-400)' : 'transparent'}`,
                background: 'none', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid',
                cursor: 'pointer', transition: 'all .15s', fontFamily: 'var(--font-body)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
 
      {/* ─── Tab Content ─── */}
      <div style={{ padding: '20px var(--page-padding-x)', flex: 1 }}>
 
        {/* Feed Tab */}
        {tab === 'feed' && (
          <>
            {isAdmin && user && (
              <PostComposer
                society={society}
                authorId={user.uid}
                authorName={userProfile?.displayName ?? ''}
              />
            )}
            {posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>📰</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No posts yet</div>
                <p style={{ fontSize: 13 }}>
                  {isAdmin ? 'Use the composer above to publish your first post.' : 'Posts from this society will appear here.'}
                </p>
              </div>
            ) : (
              posts.map(post => (
                <SocietyPostCard
                  key={post.id}
                  post={post}
                  currentUserId={user?.uid}
                  isAdmin={isAdmin}
                  isSuperAdmin={isSuperAdmin}
                />
              ))
            )}
          </>
        )}
 
        {/* About Tab */}
        {tab === 'about' && (
          <div style={{ maxWidth: 600 }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-xl)', padding: 20, marginBottom: 14,
            }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>About</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{society.description}</p>
            </div>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-xl)', padding: 20,
            }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Details</h3>
              {([
                ['Organization', society.organization || '—'],
                ['City', society.city],
                ['Country', society.country],
                ['Privacy', society.privacy === 'public' ? '🌐 Public' : '🔒 Private'],
                ['Website', society.website || '—'],
                ['Contact', society.contactEmail || '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid var(--border-secondary)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{k}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              {society.tags.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {society.tags.map(tag => (
                    <span key={tag} style={{
                      background: 'rgba(16,185,129,0.1)', color: 'var(--primary-400)',
                      padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                    }}>#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
 
      </div>
    </div>
  );
}
