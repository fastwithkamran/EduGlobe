"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToComments, addComment } from "@/lib/firestore";
import { getInitials } from "@/lib/postHelpers";
import { sanitizeImageUrl } from "@/lib/utils";
import type { PostComment } from "@/types";
import { FiSend, FiLoader } from "react-icons/fi";

const MAX_COMMENT_LENGTH = 100;

/**
 * Shared comment thread — used in both the global feed and the my-society page.
 * Loads comments in real-time and allows the signed-in user to reply.
 */
export function CommentThread({ postId }: { postId: string }) {
  const { user, userProfile } = useAuth();
  const [commentSnapshot, setCommentSnapshot] = useState<{
    key: string;
    comments: PostComment[];
  } | null>(null);
  const [subscriptionState, setSubscriptionState] = useState<{
    key: string;
    status: "ready" | "error";
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const subscriptionKey = `${postId}:${retryCount}`;

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeToComments(
      postId,
      (comments) => {
        if (!active) return;
        setCommentSnapshot({ key: subscriptionKey, comments });
        setSubscriptionState({ key: subscriptionKey, status: "ready" });
      },
      (error) => {
        if (!active) return;
        console.error("[CommentThread] Failed to load comments:", error);
        setSubscriptionState({ key: subscriptionKey, status: "error" });
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [postId, subscriptionKey]);

  const comments =
    commentSnapshot?.key === subscriptionKey ? commentSnapshot.comments : [];
  const state =
    subscriptionState?.key === subscriptionKey
      ? subscriptionState.status
      : null;
  const loading = state === null;
  const loadError = state === "error";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = text.trim();
    if (
      !content ||
      content.length > MAX_COMMENT_LENGTH ||
      !user ||
      !userProfile ||
      sending
    )
      return;
    setSending(true);
    try {
      await addComment(postId, {
        authorId: user.uid,
        authorName: userProfile.displayName,
        authorPhotoURL: userProfile.photoURL,
        content,
      });
      setText("");
    } catch (error) {
      console.error("[CommentThread] Failed to post comment:", error);
      toast.error("Failed to post comment");
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-label="Comments"
      aria-busy={loading}
      style={{
        marginTop: 14,
        paddingTop: 12,
        borderTop: "1px solid var(--border-secondary)",
      }}
    >
      {loading ? (
        <p
          role="status"
          style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}
        >
          Loading comments…
        </p>
      ) : loadError ? (
        <div
          role="alert"
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            marginBottom: 10,
          }}
        >
          <span>Comments could not be loaded. </span>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            style={{
              border: 0,
              padding: 0,
              background: "none",
              color: "var(--primary-400)",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        comments.length === 0 && (
          <p
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginBottom: 10,
            }}
          >
            No comments yet — be the first!
          </p>
        )
      )}

      {!loading && !loadError && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {comments.map((comment) => (
            <div key={comment.id} style={{ display: "flex", gap: 8 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--gradient-primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {comment.authorPhotoURL ? (
                  <Image
                    src={sanitizeImageUrl(comment.authorPhotoURL)}
                    alt=""
                    width={28}
                    height={28}
                    style={{ objectFit: "cover" }}
                  />
                ) : (
                  getInitials(comment.authorName)
                )}
              </div>
              {/* Bubble */}
              <div
                style={{
                  background: "var(--bg-tertiary)",
                  borderRadius: "0 12px 12px 12px",
                  padding: "8px 12px",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 2,
                  }}
                >
                  {comment.authorName}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {comment.content}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {user && !loadError && (
        <form
          onSubmit={submit}
          style={{ display: "flex", gap: 8, marginTop: 8 }}
        >
          <input
            aria-label="Write a comment"
            value={text}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write a comment…"
            className="input"
            style={{ flex: 1, padding: "7px 12px", fontSize: 13 }}
          />
          <span
            aria-live="polite"
            style={{
              alignSelf: "center",
              color: "var(--text-muted)",
              fontSize: 10,
              whiteSpace: "nowrap",
            }}
          >
            {text.length}/{MAX_COMMENT_LENGTH}
          </span>
          <button
            type="submit"
            className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
            disabled={
              sending || !text.trim() || text.trim().length > MAX_COMMENT_LENGTH
            }
          >
            {sending ? (
              <>
                <FiLoader className="animate-spin text-xs" /> Posting…
              </>
            ) : (
              <>
                <FiSend className="text-xs" /> Post
              </>
            )}
          </button>
        </form>
      )}
    </section>
  );
}
