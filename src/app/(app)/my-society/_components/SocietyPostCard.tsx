"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { deletePost, updatePost } from "@/lib/firestore";
import {
  timeAgo,
  TYPE_COLORS,
  TYPE_TEXTS,
  OPPORTUNITY_TYPES,
} from "@/lib/postHelpers";
import { useOptimisticLike } from "@/lib/useOptimisticLike";
import { OpportunityCard } from "@/components/OpportunityCard";
import {
  OpportunityMetaFields,
  normalizeOpportunityMeta,
  validateOpportunityMeta,
} from "@/components/OpportunityMetaFields";
import { CommentThread } from "@/components/CommentThread";
import {
  AttachmentList,
  ConfirmDeleteModal,
  PostTypeBadge,
  getPostTypeLabel,
  hasOpportunityMeta,
  plural,
} from "@/components/PostCardParts";
import type { OpportunityMeta, Post } from "@/types";
import { FiEdit2, FiTrash2, FiHeart, FiMessageCircle } from "react-icons/fi";
import { FaHeart } from "react-icons/fa";

const MAX_EDIT_CHARS = 500;

// No inline `background`, so .btn-ghost:hover can apply.
const actionButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  cursor: "pointer",
  padding: "8px 14px",
  borderRadius: "var(--radius-md)",
  transition: "all .15s",
};

/**
 * Post card rendered on the Society profile page with inline editing, deletion, and opportunity details.
 */
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(post.content ?? "");
  const [editMeta, setEditMeta] = useState<OpportunityMeta>(
    post.opportunityMeta ?? {},
  );
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const attachments = post.attachments ?? [];
  const content = post.content ?? "";
  const commentCount = Math.max(post.commentCount ?? 0, 0);

  const {
    liked: isLiked,
    count: likeCount,
    toggle: handleLike,
  } = useOptimisticLike(post, currentUserId);

  const isOpportunity = OPPORTUNITY_TYPES.includes(post.type);
  const typeLabel = getPostTypeLabel(post.type);
  const canManage = isAdmin || isSuperAdmin;
  const trimmedEditLength = editText.trim().length;
  const isEdited =
    post.updatedAt instanceof Date &&
    post.createdAt instanceof Date &&
    post.updatedAt.getTime() > post.createdAt.getTime() + 5_000;

  const metaError = isOpportunity ? validateOpportunityMeta(editMeta) : null;
  const hasChanges =
    editText.trim() !== content.trim() ||
    (isOpportunity &&
      JSON.stringify(normalizeOpportunityMeta(editMeta)) !==
        JSON.stringify(normalizeOpportunityMeta(post.opportunityMeta ?? {})));
  const canSave =
    !saving &&
    trimmedEditLength > 0 &&
    trimmedEditLength <= MAX_EDIT_CHARS &&
    !metaError &&
    hasChanges;

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const resetEdit = () => {
    setEditText(content);
    setEditMeta(post.opportunityMeta ?? {});
  };

  const cancelEdit = () => {
    setEditing(false);
    resetEdit();
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted");
      setConfirmDelete(false);
    } catch (error) {
      console.error("[SocietyPostCard] Delete failed:", error);
      toast.error("Couldn’t delete the post. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!canSave) return;
    if (metaError) {
      toast.error(metaError);
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
    <>
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
              {post.authorName || "Unknown author"}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] flex gap-1.5 items-center flex-wrap">
              <span>{timeAgo(post.createdAt)}</span>
              {isEdited && <span style={{ opacity: 0.8 }}>(edited)</span>}
              <PostTypeBadge type={post.type} />
            </div>
          </div>

          {canManage && (
            <div className="flex gap-1.5">
              {!editing && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    resetEdit();
                    setEditing(true);
                  }}
                >
                  <FiEdit2
                    style={{ width: 12, height: 12 }}
                    aria-hidden="true"
                  />{" "}
                  Edit
                </button>
              )}
              <button
                type="button"
                className="btn btn-danger-outline btn-sm"
                aria-label="Delete post"
                title="Delete post"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <FiTrash2
                  style={{ width: 12, height: 12 }}
                  aria-hidden="true"
                />
              </button>
            </div>
          )}
        </div>

        {/* Content or edit mode */}
        {editing ? (
          <div
            className="mb-3"
            onKeyDown={(e) => {
              if (e.key === "Escape" && !saving) cancelEdit();
            }}
          >
            <textarea
              ref={textareaRef}
              className="input w-full resize-y"
              rows={4}
              aria-label="Edit post content"
              value={editText}
              disabled={saving}
              onChange={(e) => setEditText(e.target.value)}
              // No inline fontSize: it would override the 16px iOS-zoom guard in globals.css
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
                      ? "var(--danger-text)"
                      : "var(--text-muted)",
                }}
              >
                {trimmedEditLength}/{MAX_EDIT_CHARS}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveEdit}
                  disabled={!canSave}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Spacing to following blocks comes from THEIR margin-top, so it
          // no longer stacks up (the old code added margins from 3 places).
          <p
            style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              margin: 0,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {content}
          </p>
        )}

        {/* Opportunity details */}
        {!editing &&
          isOpportunity &&
          hasOpportunityMeta(post.opportunityMeta) && (
            <OpportunityCard meta={post.opportunityMeta!} type={post.type} />
          )}

        {/* Same attachment rendering as PostCard: images previously crashed on
            non-whitelisted hosts (no `unoptimized`) and had no error fallback. */}
        <AttachmentList attachments={attachments} />

        {/* Actions */}
        <div className="flex gap-2 mt-3 pt-2.5 border-t border-[var(--border-secondary)]">
          <button
            type="button"
            onClick={handleLike}
            aria-pressed={isLiked}
            aria-label={`${isLiked ? "Unlike" : "Like"} post, ${plural(likeCount, "like")}`}
            className="btn-ghost"
            style={{
              ...actionButtonStyle,
              color: isLiked ? "var(--danger-text)" : "var(--text-tertiary)",
            }}
          >
            {isLiked ? (
              <FaHeart style={{ width: 13, height: 13 }} />
            ) : (
              <FiHeart style={{ width: 13, height: 13 }} />
            )}{" "}
            {likeCount}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
            aria-label={`${showComments ? "Hide" : "Show"} comments, ${plural(commentCount, "comment")}`}
            className="btn-ghost"
            style={{
              ...actionButtonStyle,
              color: showComments
                ? "var(--primary-400)"
                : "var(--text-tertiary)",
            }}
          >
            <FiMessageCircle style={{ width: 13, height: 13 }} /> {commentCount}
          </button>
        </div>

        {showComments && <CommentThread postId={post.id} />}
      </article>

      {confirmDelete && (
        <ConfirmDeleteModal
          message="It will be removed for everyone."
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(false)}
          loading={deleting}
        />
      )}
    </>
  );
}
