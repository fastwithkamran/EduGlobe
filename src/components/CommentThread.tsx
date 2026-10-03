'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToComments, addComment } from '@/lib/firestore';
import { getInitials } from '@/lib/postHelpers';
import { sanitizeImageUrl } from '@/lib/utils';
import type { PostComment } from '@/types';

/**
 * Shared comment thread — used in both the global feed and the my-society page.
 * Loads comments in real-time and allows the signed-in user to reply.
 */
export function CommentThread({ postId }: { postId: string }) {
  const { user, userProfile } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text,     setText]     = useState('');
  const [sending,  setSending]  = useState(false);

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
        authorId:       user.uid,
        authorName:     userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content:        text.trim(),
      });
      setText('');
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
      {comments.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          No comments yet — be the first!
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
        {comments.map(c => (
          <div key={c.id} style={{ display: 'flex', gap: 8 }}>
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--gradient-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden',
            }}>
              {c.authorPhotoURL
                ? <Image src={sanitizeImageUrl(c.authorPhotoURL)} alt="" width={28} height={28} style={{ objectFit: 'cover' }} />
                : getInitials(c.authorName)}
            </div>
            {/* Bubble */}
            <div style={{ background: 'var(--bg-tertiary)', borderRadius: '0 12px 12px 12px', padding: '8px 12px', flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{c.authorName}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.content}</div>
            </div>
          </div>
        ))}
      </div>

      {user && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); }}
            placeholder="Write a comment…"
            className="input"
            style={{ flex: 1, padding: '7px 12px', fontSize: 13 }}
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={submit}
            disabled={sending || !text.trim()}
          >
            {sending ? '…' : 'Post'}
          </button>
        </div>
      )}
    </div>
  );
}
