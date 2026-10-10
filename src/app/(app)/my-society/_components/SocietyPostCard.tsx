"use client";

import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { togglePostLike, deletePost, updatePost } from "@/lib/firestore";
import {
  timeAgo,
  POST_TYPE_OPTIONS,
  TYPE_COLORS,
  TYPE_TEXTS,
  OPPORTUNITY_TYPES,
} from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import { OpportunityCard } from "@/components/OpportunityCard";
import {
  isValidOpportunityLink,
  OpportunityMetaFields,
  normalizeOpportunityMeta,
} from "@/components/OpportunityMetaFields";
import { CommentThread } from "@/components/CommentThread";
import type { OpportunityMeta, Post, PostType } from "@/types";
import {
  FiEdit2,
  FiTrash2,
  FiPaperclip,
  FiHeart,
  FiMessageCircle,
  FiCalendar,
  FiCode,
  FiBriefcase,
  FiFileText,
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";
import { HiOutlineAcademicCap, HiOutlineMegaphone } from "react-icons/hi2";

const TYPE_ICONS: Record<
  PostType,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  announcement: HiOutlineMegaphone,
  event: FiCalendar,
  hackathon: FiCode,
  scholarship: HiOutlineAcademicCap,
  internship: FiBriefcase,
};

const MAX_EDIT_CHARS = 500;

/** Only ever link to http(s) URLs (document links previously went through the image sanitizer). */
function safeHref(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

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
  const [editMeta, setEditMeta] = useState<OpportunityMeta>(
    post.opportunityMeta ?? {},
  );
  const [saving, setSaving] = useState(false);

  // FIX: older / partially written documents can lack these arrays, which
  // crashed the whole feed with "Cannot read properties of undefined".
  const attachments = post.attachments ?? [];
  const likedBy = post.likedBy ?? [];
  const likeCount = Math.max(post.likeCount ?? 0, 0);
  const commentCount = Math.max(post.commentCount ?? 0, 0);

  const isOpportunity = OPPORTUNITY_TYPES.includes(post.type);
  const typeLabel =
    POST_TYPE_OPTIONS.find((o) => o.value === post.type)?.label ?? post.type;
  const isLiked = currentUserId ? likedBy.includes(currentUserId) : false;
  const canManage = isAdmin || isSuperAdmin;
  const trimmedEditLength = editText.trim().length;
  const isEdited =
    post.updatedAt instanceof Date &&
    post.createdAt instanceof Date &&
    post.updatedAt.getTime() > post.createdAt.getTime() + 5_000;

  const handleLike = async () => {
    if (!currentUserId || liking) return;
    setLiking(true);
    try {
      await togglePostLike(post.id, currentUserId, !isLiked);
    } catch (error) {
      console.error("[SocietyPostCard] Like failed:", error);
      toast.error("Couldn’t update your like. Try again.");
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted");
    } catch (error) {
      console.error("[SocietyPostCard] Delete failed:", error);
      toast.error("Couldn’t delete the post. Try again.");
      setDeleting(false);
    }
  };

  const resetEdit = () => {
    setEditText(post.content);
    setEditMeta(post.opportunityMeta ?? {});
  };

  const handleSaveEdit = async () => {
    if (!trimmedEditLength || trimmedEditLength > MAX_EDIT_CHARS) return;
    // FIX: used `type !== "announcement"` here but OPPORTUNITY_TYPES everywhere
    // else, so any non-opportunity, non-announcement type was validated and
    // saved with opportunity metadata it never displays.
    if (isOpportunity && !isValidOpportunityLink(editMeta.applyLink)) {
      toast.error("Enter a valid http or https application link");
      return;
    }
    setSaving(true);
    try {
      await updatePost(post.id, {
        content: editText.trim(),
        ...(isOpportunity
          ? { opportunityMeta: normalizeOpportunityMeta(editMeta) }
          : {}),
      });
      toast.success("Post updated");
      setEditing(false);
    } catch (error) {
      console.error("[SocietyPostCard] Update failed:", error);
      toast.error("Couldn’t update the post. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-xl)",
        padding: 18,
        marginBottom: 14,
        opacity: deleting ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--text-primary)]">
            {post.authorName}
          </div>
          <div className="text-[11px] text-[var(--text-tertiary)] flex gap-1.5 items-center flex-wrap">
            {timeAgo(post.createdAt)}
            {isEdited && <span className="opacity-60">· edited</span>}
            {(() => {
              const TypeIcon = TYPE_ICONS[post.type] ?? FiFileText;
              return (
                <span
                  style={{
                    background: TYPE_COLORS[post.type],
                    color: TYPE_TEXTS[post.type],
                    padding: "2px 7px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 500,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <TypeIcon style={{ width: 11, height: 11 }} />
                  {typeLabel}
                </span>
              );
            })()}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-1.5">
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  resetEdit();
                  setEditing(true);
                }}
                style={{
                  background: "none",
                  border: "1px solid var(--border-primary)",
                  color: "var(--text-tertiary)",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <FiEdit2 style={{ width: 12, height: 12 }} /> Edit
              </button>
            )}
            <button
              type="button"
              aria-label="Delete post"
              title="Delete post"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: "none",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#ef4444",
                borderRadius: 6,
                padding: "4px 10px",
                fontSize: 11,
                cursor: deleting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {deleting ? "…" : <FiTrash2 style={{ width: 12, height: 12 }} />}
            </button>
          </div>
        )}
      </div>

      {/* Content or edit mode */}
      {editing ? (
        <div className="mb-3">
          <textarea
            className="input w-full resize-y"
            rows={4}
            aria-label="Edit post content"
            value={editText}
            disabled={saving}
            onChange={(e) => setEditText(e.target.value)}
            style={{ fontSize: 14 }}
          />
          {isOpportunity && (
            <div
              className="mt-3 rounded-lg p-3"
              style={{
                background: TYPE_COLORS[post.type],
                border: `1px solid ${TYPE_TEXTS[post.type]}33`,
              }}
            >
              <div
                className="mb-2 text-[11px] font-semibold"
                style={{ color: TYPE_TEXTS[post.type] }}
              >
                {typeLabel} details
              </div>
              <OpportunityMetaFields
                type={post.type}
                value={editMeta}
                onChange={setEditMeta}
                disabled={saving}
              />
            </div>
          )}
          <div className="flex justify-between items-center mt-1.5">
            <span
              style={{
                fontSize: 11,
                color:
                  trimmedEditLength > MAX_EDIT_CHARS
                    ? "#ef4444"
                    : "var(--text-muted)",
              }}
            >
              {trimmedEditLength}/{MAX_EDIT_CHARS}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setEditing(false);
                  resetEdit();
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveEdit}
                disabled={
                  saving ||
                  !trimmedEditLength ||
                  trimmedEditLength > MAX_EDIT_CHARS
                }
              >
                {saving ? "Saving…" : "Save changes"}
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
            margin: 0,
            marginBottom: attachments.length || isOpportunity ? 10 : 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {post.content}
        </p>
      )}

      {/* Opportunity details */}
      {!editing &&
        isOpportunity &&
        post.opportunityMeta &&
        Object.keys(post.opportunityMeta).length > 0 && (
          <div className="mb-2.5">
            <OpportunityCard meta={post.opportunityMeta} type={post.type} />
          </div>
        )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {attachments.map((att) => {
            const isImg = att.fileType?.startsWith("image/");
            const href = isImg
              ? sanitizeImageUrl(att.fileURL)
              : safeHref(att.fileURL);
            if (!href) return null;
            return isImg ? (
              <a
                key={att.id}
                href={href}
                // FIX: no target meant clicking an image navigated away from the feed.
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  borderRadius: 8,
                  overflow: "hidden",
                  display: "block",
                  width: "100%",
                  maxWidth: 240,
                  border: "1px solid var(--border-primary)",
                  position: "relative",
                  aspectRatio: "16/9",
                }}
              >
                <Image
                  src={href}
                  alt={att.fileName}
                  fill
                  className="object-contain"
                />
              </a>
            ) : (
              <a
                key={att.id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  maxWidth: "100%",
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                  textDecoration: "none",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  overflowWrap: "anywhere",
                }}
              >
                <FiPaperclip style={{ width: 12, height: 12, flexShrink: 0 }} /> {att.fileName}
              </a>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3 pt-2.5 border-t border-[var(--border-secondary)]">
        <button
          type="button"
          onClick={handleLike}
          disabled={liking || !currentUserId}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike post" : "Like post"}
          title={currentUserId ? undefined : "Sign in to like posts"}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            color: isLiked ? "#ef4444" : "var(--text-tertiary)",
            background: "none",
            border: "none",
            cursor: liking || !currentUserId ? "not-allowed" : "pointer",
            padding: "5px 10px",
            borderRadius: "var(--radius-md)",
            transition: "all .15s",
          }}
        >
          {isLiked ? (
            <FaHeart style={{ width: 13, height: 13, color: "#ef4444" }} />
          ) : (
            <FiHeart style={{ width: 13, height: 13 }} />
          )}{" "}
          {likeCount}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          aria-label={`${showComments ? "Hide" : "Show"} comments (${commentCount})`}
          className="btn-ghost"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 13,
            color: showComments ? "var(--primary-400)" : "var(--text-tertiary)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "5px 10px",
            borderRadius: "var(--radius-md)",
            transition: "all .15s",
          }}
        >
          <FiMessageCircle style={{ width: 13, height: 13 }} /> {commentCount}
        </button>
      </div>

      {showComments && <CommentThread postId={post.id} />}
    </article>
  );
}