"use client";

import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { followSociety, unfollowSociety, deletePost } from "@/lib/firestore";
import { timeAgo, getInitials, OPPORTUNITY_TYPES } from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import { useOptimisticLike } from "@/lib/useOptimisticLike";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CommentThread } from "@/components/CommentThread";
import {
  AttachmentList,
  ConfirmDeleteModal,
  PostTypeBadge,
  hasOpportunityMeta,
  plural,
  truncateChars,
} from "@/components/PostCardParts";
import { SocietyAboutDialog } from "./SocietyAboutDialog";
import type { Post } from "@/types";
import {
  FiTrash2,
  FiHeart,
  FiMessageCircle,
  FiShare2,
  FiCheck,
  FiPlus,
} from "react-icons/fi";
import { FaHeart } from "react-icons/fa";

// Shared style for the ghost action buttons.
// NOTE: no inline `background`, otherwise .btn-ghost:hover can never apply.
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
 * Feed card representing an individual society post with likes, comments, and opportunity metadata.
 */
export function PostCard({
  post,
  currentUserId,
  followedIds,
  onFollowToggle,
  isSuperAdmin,
}: {
  post: Post;
  currentUserId?: string;
  followedIds: Set<string>;
  onFollowToggle: (sid: string, following: boolean) => void;
  isSuperAdmin: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [showSocietyAbout, setShowSocietyAbout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Fallbacks for optional post properties
  const attachments = post.attachments ?? [];
  const content = post.content ?? "";
  const commentCount = Math.max(post.commentCount ?? 0, 0);

  const {
    liked: isLiked,
    count: likeCount,
    toggle: handleLike,
  } = useOptimisticLike(post, currentUserId);

  const isFollowing = followedIds.has(post.societyId);
  const logoSrc = post.societyLogoURL
    ? sanitizeImageUrl(post.societyLogoURL)
    : "";
  const isOpportunity = OPPORTUNITY_TYPES.includes(post.type);
  const isEdited =
    post.updatedAt instanceof Date &&
    post.createdAt instanceof Date &&
    post.updatedAt.getTime() > post.createdAt.getTime() + 5_000;

  const handleFollow = async () => {
    if (!currentUserId) {
      toast.error("Sign in to follow societies");
      return;
    }
    if (followPending) return;
    setFollowPending(true);
    try {
      if (isFollowing) {
        await unfollowSociety(currentUserId, post.societyId);
        onFollowToggle(post.societyId, false);
        toast.success(`Unfollowed ${post.societyName}`);
      } else {
        await followSociety(currentUserId, post.societyId);
        onFollowToggle(post.societyId, true);
        toast.success(`Following ${post.societyName}`);
      }
    } catch (error) {
      console.error("[PostCard] Follow failed:", error);
      toast.error("Couldn’t update follow. Try again.");
    } finally {
      setFollowPending(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    const text = `${truncateChars(content, 100)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: post.societyName, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied!");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted");
      setConfirmDelete(false);
    } catch (error) {
      console.error("[PostCard] Delete failed:", error);
      toast.error("Couldn’t delete the post. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <article
        id={`post-${post.id}`}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-xl)",
          padding: 20,
          marginBottom: 14,
          position: "relative",
          scrollMarginTop: 16,
        }}
      >
        {/* Super-admin delete button (hover styles live in CSS so they don't stick on touch) */}
        {isSuperAdmin && (
          <button
            type="button"
            className="icon-danger-btn"
            onClick={() => setConfirmDelete(true)}
            title="Super admin: delete post"
            aria-label={`Delete post by ${post.societyName}`}
            style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
          >
            <FiTrash2 style={{ width: 14, height: 14 }} />
          </button>
        )}

        {/* Header: society logo + name + follow button */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 12,
            paddingRight: isSuperAdmin ? 48 : 0,
          }}
        >
          {/* minWidth:0 lets long society names truncate instead of pushing
              the Follow button off-screen on mobile */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              flex: 1,
            }}
          >
            <button
              type="button"
              onClick={() => setShowSocietyAbout(true)}
              aria-label={`View ${post.societyName} about information`}
              title={`About ${post.societyName}`}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                overflow: "hidden",
                flexShrink: 0,
                padding: 0,
                border: 0,
                cursor: "pointer",
              }}
            >
              {/* Society logo avatar */}
              {logoSrc && !logoFailed ? (
                <Image
                  src={logoSrc}
                  alt=""
                  width={40}
                  height={40}
                  unoptimized
                  onError={() => setLogoFailed(true)}
                  style={{ objectFit: "cover", width: 40, height: 40 }}
                />
              ) : (
                getInitials(post.societyName)
              )}
            </button>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-heading)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {post.societyName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span>{timeAgo(post.createdAt)}</span>
                {isEdited && <span style={{ opacity: 0.8 }}>(edited)</span>}
                <PostTypeBadge type={post.type} />
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`btn btn-sm ${isFollowing ? "btn-outline" : "btn-primary"}`}
            onClick={handleFollow}
            disabled={followPending}
            aria-pressed={isFollowing}
            aria-label={
              isFollowing
                ? `Unfollow ${post.societyName}`
                : `Follow ${post.societyName}`
            }
            style={{ flexShrink: 0 }}
          >
            {isFollowing ? (
              <>
                <FiCheck style={{ width: 12, height: 12 }} aria-hidden="true" />{" "}
                Following
              </>
            ) : (
              <>
                <FiPlus style={{ width: 12, height: 12 }} aria-hidden="true" />{" "}
                Follow
              </>
            )}
          </button>
        </div>

        {/* Content: spacing to what follows comes from the next block's own margin-top */}
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.75,
            margin: 0,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {content}
        </p>

        {/* Opportunity metadata: only for opportunity types, like SocietyPostCard */}
        {isOpportunity && hasOpportunityMeta(post.opportunityMeta) && (
          <OpportunityCard meta={post.opportunityMeta!} type={post.type} />
        )}

        <AttachmentList attachments={attachments} />

        {/* Actions: Like · Comment · Share */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 14,
            paddingTop: 12,
            borderTop: "1px solid var(--border-secondary)",
          }}
        >
          <button
            type="button"
            onClick={handleLike}
            className="btn-ghost"
            aria-pressed={isLiked}
            aria-label={`${isLiked ? "Unlike" : "Like"} post, ${plural(likeCount, "like")}`}
            style={{
              ...actionButtonStyle,
              color: isLiked ? "var(--danger-text)" : "var(--text-tertiary)",
            }}
          >
            {isLiked ? (
              <FaHeart style={{ width: 14, height: 14 }} />
            ) : (
              <FiHeart style={{ width: 14, height: 14 }} />
            )}{" "}
            {likeCount}
          </button>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="btn-ghost"
            aria-expanded={showComments}
            aria-label={`${showComments ? "Hide" : "Show"} comments, ${plural(commentCount, "comment")}`}
            style={{
              ...actionButtonStyle,
              color: showComments
                ? "var(--primary-400)"
                : "var(--text-tertiary)",
            }}
          >
            <FiMessageCircle style={{ width: 14, height: 14 }} /> {commentCount}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="btn-ghost"
            style={{ ...actionButtonStyle, color: "var(--text-tertiary)" }}
          >
            <FiShare2 style={{ width: 14, height: 14 }} aria-hidden="true" />{" "}
            Share
          </button>
        </div>

        {showComments && <CommentThread postId={post.id} />}
      </article>

      {confirmDelete && (
        <ConfirmDeleteModal
          message={`Delete this post by “${post.societyName}”?`}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setConfirmDelete(false)}
          loading={deleting}
        />
      )}
      {showSocietyAbout && (
        <SocietyAboutDialog
          societyId={post.societyId}
          onClose={() => setShowSocietyAbout(false)}
        />
      )}
    </>
  );
}
