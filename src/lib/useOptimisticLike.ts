"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { togglePostLike } from "@/lib/firestore";
import type { Post } from "@/types";

/**
 * Shared optimistic-like logic for PostCard and SocietyPostCard.
 *
 * The two cards used to implement this separately and had drifted apart:
 * SocietyPostCard had no optimistic update, no sign-in message and disabled
 * the button for signed-out users (a disabled button can't show its tooltip
 * on touch or keyboard, so people just saw a dead button).
 *
 * The optimistic override is dropped only when the *server* value changes, so
 * the old state never flashes back while the snapshot listener catches up.
 */
export function useOptimisticLike(
  post: Pick<Post, "id" | "likedBy" | "likeCount">,
  currentUserId?: string,
) {
  const serverCount = Math.max(post.likeCount ?? 0, 0);
  const serverLiked = currentUserId
    ? (post.likedBy ?? []).includes(currentUserId)
    : false;

  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState<{ liked: boolean; count: number } | null>(
    null,
  );
  const [synced, setSynced] = useState({
    liked: serverLiked,
    count: serverCount,
  });

  if (synced.liked !== serverLiked || synced.count !== serverCount) {
    setSynced({ liked: serverLiked, count: serverCount });
    setLocal(null);
  }

  const liked = local?.liked ?? serverLiked;
  const count = local?.count ?? serverCount;

  const toggle = async () => {
    if (!currentUserId) {
      toast.error("Sign in to like posts");
      return;
    }
    if (pending) return; // rapid double-clicks used to desync the count
    setPending(true);
    const next = !liked;
    setLocal({ liked: next, count: Math.max(0, count + (next ? 1 : -1)) });
    try {
      await togglePostLike(post.id, currentUserId, next);
    } catch (error) {
      console.error("[useOptimisticLike] Like failed:", error);
      setLocal(null); // back to server truth
      toast.error("Couldn’t update your like. Try again.");
    } finally {
      setPending(false);
    }
  };

  return { liked, count, pending, toggle };
}