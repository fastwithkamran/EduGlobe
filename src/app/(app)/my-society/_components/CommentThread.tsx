'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToComments, addComment } from '@/lib/firestore';
import { getInitials } from '@/lib/postHelpers';
import { sanitizeImageUrl } from '@/lib/utils';
import type { PostComment } from '@/types';

export function CommentThread({ postId }: { postId: string }) {
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
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-secondary)]">
      {comments.length === 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-2">No comments yet.</p>
      )}

      <div className="flex flex-col gap-2 mb-2">
        {comments.map(c => (
          <div key={c.id} className="flex gap-2">
            {/* Avatar */}
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-[9px] font-bold text-white shrink-0 overflow-hidden">
              {c.authorPhotoURL
                ? <Image src={sanitizeImageUrl(c.authorPhotoURL)} alt="" width={24} height={24} className="w-full h-full object-cover" />
                : getInitials(c.authorName)}
            </div>
            {/* Bubble */}
            <div className="bg-[var(--bg-tertiary)] rounded-[0_10px_10px_10px] px-3 py-1.5 flex-1">
              <div className="text-[11px] font-semibold text-[var(--text-primary)] mb-0.5">{c.authorName}</div>
              <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{c.content}</div>
            </div>
          </div>
        ))}
      </div>

      {user && (
        <div className="flex gap-2 mt-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(); }}
            placeholder="Comment…"
            className="input flex-1"
            style={{ padding: '7px 12px', fontSize: 13 }}
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
