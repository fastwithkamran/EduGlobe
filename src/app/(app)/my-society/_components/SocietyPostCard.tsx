"use client";

import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { togglePostLike, deletePost, updatePost } from "@/lib/firestore";
import {
  timeAgo,
  TYPE_COLORS,
  TYPE_TEXTS,
  OPPORTUNITY_TYPES,
} from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import { CommentThread } from "./CommentThread";
import type { Post } from "@/types";

const MAX_EDIT_CHARS = 500;

export function SocietyPostCard({
  post,
  currentUserId,
  isAdmin,
  isSuperAdmin,
}: {
  post: Post;
  currentUserId?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content);
  const [saving, setSaving] = useState(false);

  const isLiked = currentUserId ? post.likedBy.includes(currentUserId) : false;
  const canManage = isAdmin || isSuperAdmin;
  const isEdited =
    post.updatedAt &&
    post.createdAt &&
    new Date(post.updatedAt as unknown as string).getTime() >
      new Date(post.createdAt as unknown as string).getTime() + 5_000; // 5s buffer

  const handleLike = async () => {
    if (!currentUserId) return;
    setLiking(true);
    try {
      await togglePostLike(post.id, currentUserId, !isLiked);
    } catch {
      toast.error("Failed to like post");
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted");
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText.length > MAX_EDIT_CHARS) return;
    setSaving(true);
    try {
      await updatePost(post.id, { content: editText.trim() });
      toast.success("Post updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update post");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-xl)",
        padding: 18,
        marginBottom: 14,
      }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {post.authorName}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] flex gap-1.5 items-center flex-wrap">
            {timeAgo(post.createdAt)}
            {isEdited && <span className="opacity-60">· edited</span>}
            <span
              style={{
                background: TYPE_COLORS[post.type],
                color: TYPE_TEXTS[post.type],
                padding: "1px 7px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 500,
              }}
            >
              {post.type}
            </span>
          </div>
        </div>

        {/* Admin controls */}
        {canManage && (
          <div className="flex gap-1.5">
            {!editing && (
              <button
                onClick={() => {
                  setEditing(true);
                  setEditText(post.content);
                }}
                style={{
                  background: "none",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-tertiary)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                ✏️ Edit
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: "none",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {deleting ? "…" : "🗑"}
            </button>
          </div>
        )}
      </div>

      {/* ── Content (or Edit mode) ── */}
      {editing ? (
        <div className="mb-3">
          <textarea
            className="input w-full resize-y"
            rows={4}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            style={{ fontSize: 14 }}
          />
          <div className="flex justify-between items-center mt-1.5">
            <span
              style={{
                fontSize: 11,
                color:
                  editText.length > MAX_EDIT_CHARS
                    ? "#ef4444"
                    : "var(--text-muted)",
              }}
            >
              {editText.length}/{MAX_EDIT_CHARS}
            </span>
            <div className="flex gap-2">
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveEdit}
                disabled={
                  saving || !editText.trim() || editText.length > MAX_EDIT_CHARS
                }
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.7,
            marginBottom:
              post.attachments.length || OPPORTUNITY_TYPES.includes(post.type)
                ? 10
                : 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.content}
        </p>
      )}

      {/* ── Opportunity Meta ── */}
      {!editing &&
        post.opportunityMeta &&
        OPPORTUNITY_TYPES.includes(post.type) && (
          <div
            style={{
              background: `${TYPE_COLORS[post.type]}`,
              borderRadius: 8,
              padding: "10px 14px",
              marginBottom: 10,
              border: `1px solid ${TYPE_TEXTS[post.type]}33`,
            }}
          >
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px]">
              {post.opportunityMeta.deadline && (
                <span>
                  ⏰{" "}
                  <strong style={{ color: TYPE_TEXTS[post.type] }}>
                    Deadline:
                  </strong>{" "}
                  {post.opportunityMeta.deadline}
                </span>
              )}
              {post.opportunityMeta.prize && (
                <span>
                  🏆{" "}
                  <strong style={{ color: TYPE_TEXTS[post.type] }}>
                    Prize:
                  </strong>{" "}
                  {post.opportunityMeta.prize}
                </span>
              )}
              {post.opportunityMeta.location && (
                <span>📍 {post.opportunityMeta.location}</span>
              )}
              {post.opportunityMeta.organizer && (
                <span>🏛 {post.opportunityMeta.organizer}</span>
              )}
              {post.opportunityMeta.applyLink && (
                <a
                  href={post.opportunityMeta.applyLink}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    color: TYPE_TEXTS[post.type],
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  → Apply Now
                </a>
              )}
            </div>
          </div>
        )}

      {/* ── Attachments ── */}
      {post.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {post.attachments.map((att) => {
            const isImg = att.fileType.startsWith("image/");
            return isImg ? (
              <a
                key={att.id}
                href={sanitizeImageUrl(att.fileURL)}
                target="_blank"
                rel="noreferrer"
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  display: "block",
                  maxWidth: 240,
                  border: "1px solid var(--border-primary)",
                  position: "relative",
                  aspectRatio: "16/9",
                }}
              >
                <Image
                  src={sanitizeImageUrl(att.fileURL)}
                  alt={att.fileName}
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              </a>
            ) : (
              <a
                key={att.id}
                href={sanitizeImageUrl(att.fileURL)}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                }}
              >
                📎 {att.fileName}
              </a>
            );
          })}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-2 mt-3 pt-2.5 border-t border-[var(--border-secondary)]">
        <button
          onClick={handleLike}
          disabled={liking}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            color: isLiked ? "#ef4444" : "var(--text-tertiary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: 6,
          }}
        >
          {isLiked ? "♥" : "♡"} {post.likeCount}
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            color: showComments ? "var(--primary-400)" : "var(--text-tertiary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "3px 8px",
            borderRadius: 6,
          }}
        >
          💬 {post.commentCount}
        </button>
      </div>

      {showComments && <CommentThread postId={post.id} />}
    </div>
  );
}
