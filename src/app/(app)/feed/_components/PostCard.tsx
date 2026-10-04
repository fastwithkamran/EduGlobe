"use client";

import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  togglePostLike,
  followSociety,
  unfollowSociety,
  deletePost,
} from "@/lib/firestore";
import {
  timeAgo,
  TYPE_COLORS,
  TYPE_TEXTS,
  TYPE_EMOJI,
  getInitials,
} from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CommentThread } from "@/components/CommentThread";
import type { Post } from "@/types";

// ─── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmDeleteModal({
  message,
  onConfirm,
  onCancel,
  loading,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: 16,
          padding: "28px 24px",
          width: 400,
          maxWidth: "90vw",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.1)",
            border: "2px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            margin: "0 auto 16px",
          }}
        >
          🗑️
        </div>
        <h2
          style={{
            fontSize: "var(--text-xl)",
            fontFamily: "var(--font-heading)",
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Delete Post?
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          {message}
          <br />
          <strong style={{ color: "#ef4444" }}>
            This action cannot be undone.
          </strong>
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: 90 }}
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={onConfirm}
            style={{
              minWidth: 120,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 18px",
              background: loading
                ? "rgba(239,68,68,0.4)"
                : "linear-gradient(135deg,#ef4444,#dc2626)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-lg)",
              fontWeight: 600,
              fontSize: 13,
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {loading ? "⏳ Deleting…" : "🗑️ Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Image with skeleton shimmer ──────────────────────────────────────────────

function ImageWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      style={{
        borderRadius: 8,
        overflow: "hidden",
        display: "block",
        maxWidth: 280,
        border: "1px solid var(--border-primary)",
        position: "relative",
        minHeight: 80,
      }}
    >
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--bg-tertiary)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}
      <Image
        src={src}
        alt={alt}
        width={0}
        height={0}
        sizes="100vw"
        onLoad={() => setLoaded(true)}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          opacity: loaded ? 1 : 0,
          transition: "opacity .3s",
        }}
      />
    </a>
  );
}

// ─── Post Card ────────────────────────────────────────────────────────────────

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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Optimistic like — null means use server value
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localCount, setLocalCount] = useState<number | null>(null);

  const serverLiked = currentUserId
    ? post.likedBy.includes(currentUserId)
    : false;
  const isLiked = localLiked !== null ? localLiked : serverLiked;
  const likeCount = localCount !== null ? localCount : post.likeCount;
  const isFollowing = followedIds.has(post.societyId);

  const handleLike = async () => {
    if (!currentUserId) return toast.error("Sign in to like posts");
    const wasLiked = isLiked;
    const prevCount = likeCount;
    setLocalLiked(!wasLiked);
    setLocalCount(prevCount + (wasLiked ? -1 : 1));
    try {
      await togglePostLike(post.id, currentUserId, !wasLiked);
      setLocalLiked(null);
      setLocalCount(null); // server owns state now
    } catch {
      setLocalLiked(wasLiked);
      setLocalCount(prevCount); // revert
      toast.error("Failed to like post");
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) return toast.error("Sign in to follow societies");
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
    } catch {
      toast.error("Failed to update follow");
    }
  };

  const handleShare = async () => {
    const text = `${post.societyName}: ${post.content.slice(0, 100)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.societyName,
          text,
          url: window.location.href,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      navigator.clipboard?.writeText(window.location.href);
      toast.success("Link copied!");
    }
  };

  const handleDeleteConfirmed = async () => {
    setDeleting(true);
    try {
      await deletePost(post.id);
      toast.success("Post deleted");
      setConfirmDelete(false);
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-primary)",
          borderRadius: "var(--radius-xl)",
          padding: 20,
          marginBottom: 14,
          position: "relative",
          transition: "border-color .2s",
        }}
      >
        {/* Super-admin delete button */}
        {isSuperAdmin && (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Super Admin: Delete post"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              color: "#ef4444",
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all .15s",
              zIndex: 1,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.22)";
              e.currentTarget.style.transform = "scale(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            🗑️
          </button>
        )}

        {/* Header: society logo + name + follow button */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 12,
            paddingRight: isSuperAdmin ? 44 : 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
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
              }}
            >
              {post.societyLogoURL ? (
                <Image
                  src={sanitizeImageUrl(post.societyLogoURL)}
                  alt=""
                  width={40}
                  height={40}
                  style={{ objectFit: "cover" }}
                />
              ) : (
                getInitials(post.societyName)
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-heading)",
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
                <span
                  style={{
                    background: TYPE_COLORS[post.type],
                    color: TYPE_TEXTS[post.type],
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  {TYPE_EMOJI[post.type]}{" "}
                  {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
                </span>
              </div>
            </div>
          </div>
          <button
            className={`btn btn-sm ${isFollowing ? "btn-outline" : "btn-primary"}`}
            onClick={handleFollow}
            style={{ flexShrink: 0 }}
          >
            {isFollowing ? "✓ Following" : "+ Follow"}
          </button>
        </div>

        {/* Content */}
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.75,
            marginBottom: post.attachments.length > 0 ? 12 : 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.content}
        </p>

        {/* Opportunity metadata */}
        {post.opportunityMeta && (
          <OpportunityCard meta={post.opportunityMeta} type={post.type} />
        )}

        {/* Attachments */}
        {post.attachments.length > 0 && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
          >
            {post.attachments.map((att) =>
              att.fileType.startsWith("image/") ? (
                <ImageWithSkeleton
                  key={att.id}
                  src={sanitizeImageUrl(att.fileURL)}
                  alt={att.fileName}
                />
              ) : (
                <a
                  key={att.id}
                  href={sanitizeImageUrl(att.fileURL)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 12px",
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
              ),
            )}
          </div>
        )}

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
            onClick={handleLike}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              color: isLiked ? "#ef4444" : "var(--text-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 10px",
              borderRadius: 8,
              transform: isLiked ? "scale(1.08)" : "scale(1)",
              transition: "all .15s",
            }}
          >
            {isLiked ? "♥" : "♡"} {likeCount}
          </button>
          <button
            onClick={() => setShowComments((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              color: showComments
                ? "var(--primary-400)"
                : "var(--text-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 10px",
              borderRadius: 8,
              transition: "all .15s",
            }}
          >
            💬 {post.commentCount}
          </button>
          <button
            onClick={handleShare}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 13,
              color: "var(--text-tertiary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 10px",
              borderRadius: 8,
              transition: "all .15s",
            }}
          >
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
