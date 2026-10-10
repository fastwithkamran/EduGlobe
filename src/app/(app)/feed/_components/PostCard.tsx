"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  getInitials,
} from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import { OpportunityCard } from "@/components/OpportunityCard";
import { CommentThread } from "@/components/CommentThread";
import { SocietyAboutDialog } from "./SocietyAboutDialog";
import type { Post, PostType } from "@/types";
import {
  FiTrash2,
  FiImage,
  FiPaperclip,
  FiHeart,
  FiMessageCircle,
  FiShare2,
  FiCheck,
  FiPlus,
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
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe option when the modal opens, restore focus on close
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  // Escape closes (unless a delete is in flight)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  return createPortal(
    <div
      onClick={() => {
        // FIX: backdrop click used to dismiss the modal mid-delete
        if (!loading) onCancel();
      }}
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
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-post-title"
        aria-describedby="delete-post-desc"
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
          aria-hidden="true"
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.1)",
            border: "2px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <FiTrash2 style={{ width: 24, height: 24, color: "#ef4444" }} />
        </div>
        <h2
          id="delete-post-title"
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
          id="delete-post-desc"
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
            type="button"
            ref={cancelRef}
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: 90 }}
          >
            Cancel
          </button>
          <button
            type="button"
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
            {loading ? (
              "Deleting…"
            ) : (
              <>
                <FiTrash2 style={{ width: 14, height: 14 }} /> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Image with skeleton shimmer ──────────────────────────────────────────────

function ImageWithSkeleton({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // FIX: a broken image used to pulse forever with an invisible <img>
  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "7px 12px",
          background: "var(--bg-tertiary)",
          border: "1px solid var(--border-primary)",
          borderRadius: 8,
          color: "var(--text-secondary)",
          fontSize: 12,
        }}
      >
        <FiImage style={{ width: 14, height: 14 }} /> {alt || "Image"} (couldn’t load preview)
      </a>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        borderRadius: 8,
        overflow: "hidden",
        display: "block",
        maxWidth: "100%",
        width: 280,
        border: "1px solid var(--border-primary)",
        position: "relative",
        minHeight: 80,
      }}
    >
      {!loaded && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "var(--bg-tertiary)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}
      {/* `unoptimized`: attachment hosts are user-supplied, so they can't all
          be whitelisted in next.config `images.remotePatterns`. Without this,
          next/image throws for any host that isn't configured. */}
      <Image
        src={src}
        alt={alt}
        width={0}
        height={0}
        sizes="(max-width: 480px) 100vw, 280px"
        unoptimized
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
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

// ─── Shared style for the ghost action buttons ────────────────────────────────

const actionButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 13,
  border: "none",
  cursor: "pointer",
  padding: "8px 14px",
  borderRadius: "var(--radius-md)",
  transition: "all .15s",
  // NOTE: no inline `background` here, otherwise .btn-ghost:hover can never apply
};

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
  const [showSocietyAbout, setShowSocietyAbout] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Defensive defaults — older Firestore docs may be missing these fields
  const attachments = post.attachments ?? [];
  const likedBy = post.likedBy ?? [];
  const serverCount = post.likeCount ?? 0;
  const commentCount = post.commentCount ?? 0;

  const serverLiked = currentUserId ? likedBy.includes(currentUserId) : false;

  // Optimistic like — null means "use the server value"
  const [localLiked, setLocalLiked] = useState<boolean | null>(null);
  const [localCount, setLocalCount] = useState<number | null>(null);

  // FIX: previously the optimistic override was cleared as soon as the write
  // resolved, which flashed the OLD like state until the snapshot listener
  // caught up (and permanently showed the old state if the parent held a stale
  // post object). Now the override is cleared only when the server value for
  // this post actually changes.
  const [syncedServer, setSyncedServer] = useState({
    liked: serverLiked,
    count: serverCount,
  });
  if (syncedServer.liked !== serverLiked || syncedServer.count !== serverCount) {
    setSyncedServer({ liked: serverLiked, count: serverCount });
    setLocalLiked(null);
    setLocalCount(null);
  }

  const isLiked = localLiked !== null ? localLiked : serverLiked;
  const likeCount = localCount !== null ? localCount : serverCount;
  const isFollowing = followedIds.has(post.societyId);

  const handleLike = async () => {
    if (!currentUserId) {
      toast.error("Sign in to like posts");
      return;
    }
    if (likePending) return; // FIX: rapid double-clicks could desync count
    setLikePending(true);
    const wasLiked = isLiked;
    setLocalLiked(!wasLiked);
    setLocalCount(Math.max(0, likeCount + (wasLiked ? -1 : 1)));
    try {
      await togglePostLike(post.id, currentUserId, !wasLiked);
    } catch {
      setLocalLiked(null); // revert to server truth
      setLocalCount(null);
      toast.error("Failed to like post");
    } finally {
      setLikePending(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) {
      toast.error("Sign in to follow societies");
      return;
    }
    if (followPending) return; // FIX: double-click used to follow then unfollow
    setFollowPending(true);
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
    } finally {
      setFollowPending(false);
    }
  };

  const handleShare = async () => {
    // FIX: used to share window.location.href (just the feed page). Link to
    // this specific card via its anchor instead.
    const url = `${window.location.origin}${window.location.pathname}#post-${post.id}`;
    const snippet = post.content.slice(0, 100);
    const text = `${post.societyName}: ${snippet}${post.content.length > 100 ? "…" : ""}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: post.societyName, text, url });
        return;
      } catch (error) {
        // User dismissed the share sheet — nothing to do
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Any other failure: fall through to clipboard
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
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setDeleting(false);
    }
  };

  const typeLabel = post.type.charAt(0).toUpperCase() + post.type.slice(1);

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
          transition: "border-color .2s",
          scrollMarginTop: 16,
        }}
      >
        {/* Super-admin delete button */}
        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            title="Super Admin: Delete post"
            aria-label={`Delete post by ${post.societyName}`}
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
            paddingRight: isSuperAdmin ? 44 : 0,
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
              {post.societyLogoURL && !logoFailed ? (
                <Image
                  src={sanitizeImageUrl(post.societyLogoURL)}
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
                {(() => {
                  const TypeIcon = TYPE_ICONS[post.type] ?? FiFileText;
                  return (
                    <span
                      style={{
                        background: TYPE_COLORS[post.type],
                        color: TYPE_TEXTS[post.type],
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 500,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <TypeIcon style={{ width: 12, height: 12 }} /> {typeLabel}
                    </span>
                  );
                })()}
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
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FiCheck style={{ width: 12, height: 12 }} /> Following
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <FiPlus style={{ width: 12, height: 12 }} /> Follow
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <p
          style={{
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.75,
            marginBottom: attachments.length > 0 ? 12 : 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {post.content}
        </p>

        {/* Opportunity metadata */}
        {post.opportunityMeta &&
          Object.keys(post.opportunityMeta).length > 0 && (
            <OpportunityCard meta={post.opportunityMeta} type={post.type} />
          )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}
          >
            {attachments.map((att) =>
              att.fileType?.startsWith("image/") ? (
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
                  rel="noopener noreferrer"
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
                    maxWidth: "100%",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <FiPaperclip style={{ width: 13, height: 13, flexShrink: 0 }} /> {att.fileName}
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
            type="button"
            onClick={handleLike}
            className="btn-ghost"
            aria-pressed={isLiked}
            aria-label={`${isLiked ? "Unlike" : "Like"} post, ${likeCount} likes`}
            style={{
              ...actionButtonStyle,
              color: isLiked ? "#ef4444" : "var(--text-tertiary)",
              transform: isLiked ? "scale(1.05)" : "scale(1)",
            }}
          >
            {isLiked ? (
              <FaHeart style={{ width: 14, height: 14, color: "#ef4444" }} />
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
            aria-label={`${showComments ? "Hide" : "Show"} comments, ${commentCount} comments`}
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
            <FiShare2 style={{ width: 14, height: 14 }} /> Share
          </button>
        </div>

        {showComments && <CommentThread postId={post.id} />}
      </article>

      {confirmDelete && (
        <ConfirmDeleteModal
          message={`Delete this post by "${post.societyName}"?`}
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