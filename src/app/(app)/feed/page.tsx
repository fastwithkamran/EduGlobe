"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToFeed,
  subscribeToFollowingFeed,
  followSociety,
  unfollowSociety,
  getFollowedSocietyIds,
} from "@/lib/firestore";
import { TYPE_TEXTS } from "@/lib/postHelpers";
import { PostCard } from "./_components/PostCard";
import { FeedSkeleton } from "./_components/FeedSkeleton";
import type { Post, PostType } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;
const PAGE_INCREMENT = 15;

type FeedTab = "all" | "following";

const TYPE_FILTERS: Array<{ value: PostType | "all"; label: string }> = [
  { value: "all", label: "✨ All" },
  { value: "hackathon", label: "💻 Hackathons" },
  { value: "scholarship", label: "🎓 Scholarships" },
  { value: "internship", label: "💼 Internships" },
  { value: "announcement", label: "📢 Announcements" },
  { value: "event", label: "📅 Events" },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GlobalFeedPage() {
  const { user, isSuperAdmin } = useAuth();

  const [tab, setTab] = useState<FeedTab>("all");
  const [loadingAll, setLoadingAll] = useState(true);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  // All posts from subscription (may include unseen new arrivals)
  const [allLivePosts, setAllLivePosts] = useState<Post[]>([]);
  const [followingLivePosts, setFollowingLivePosts] = useState<Post[]>([]);

  // What the user actually sees — held back when new posts arrive mid-scroll
  const [displayedAll, setDisplayedAll] = useState<Post[]>([]);
  const [displayedFollowing, setDisplayedFollowing] = useState<Post[]>([]);

  // Track IDs the user has already seen (to detect new arrivals)
  const seenAllIds = useRef<Set<string>>(new Set());
  const seenFollowingIds = useRef<Set<string>>(new Set());
  const isInitAllRef = useRef(true);
  const isInitFollowRef = useRef(true);

  const allUnsubRef = useRef<(() => void) | null>(null);
  const followUnsubRef = useRef<(() => void) | null>(null);

  // Search + type filter
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PostType | "all">("all");

  // Pending new-post badge counts — updated inside subscription callbacks (not during render).
  // Avoids "Cannot access refs during render" from the React Compiler rule.
  const [pendingAllCount, setPendingAllCount] = useState(0);
  const [pendingFollowCount, setPendingFollowCount] = useState(0);

  // ── Global feed subscription (re-subscribes on pageSize change) ──────────────
  useEffect(() => {
    isInitAllRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPendingAllCount(0); // reset badge on re-subscribe
    allUnsubRef.current?.();
    allUnsubRef.current = subscribeToFeed((incoming) => {
      setAllLivePosts(incoming);
      if (isInitAllRef.current) {
        // First load — mark all as seen, no badge
        isInitAllRef.current = false;
        incoming.forEach((p) => seenAllIds.current.add(p.id));
        setDisplayedAll(incoming);
        setLoadingAll(false);
        setLoadingMore(false);
      } else {
        // Live update — count posts the user hasn't seen yet
        setPendingAllCount(
          incoming.filter((p) => !seenAllIds.current.has(p.id)).length,
        );
      }
    }, pageSize);
    return () => allUnsubRef.current?.();
  }, [pageSize]);

  // ── Following feed ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFollowingLoaded(true); // not signed in — nothing to load
      return;
    }

    getFollowedSocietyIds(user.uid).then((ids) => {
      setFollowedIds(new Set(ids));
      followUnsubRef.current?.();
      isInitFollowRef.current = true;
      setPendingFollowCount(0);
      const unsub = subscribeToFollowingFeed(ids, (incoming) => {
        setFollowingLivePosts(incoming);
        if (isInitFollowRef.current) {
          // First load — mark all as seen
          isInitFollowRef.current = false;
          incoming.forEach((p) => seenFollowingIds.current.add(p.id));
          setDisplayedFollowing(incoming);
          setFollowingLoaded(true);
        } else {
          // Live update — count unseen
          setPendingFollowCount(
            incoming.filter((p) => !seenFollowingIds.current.has(p.id)).length,
          );
        }
      });
      if (unsub) followUnsubRef.current = unsub;
      else setFollowingLoaded(true);
    });
    return () => followUnsubRef.current?.();
  }, [user?.uid]);

  const pendingCount = tab === "all" ? pendingAllCount : pendingFollowCount;

  const showNewPosts = () => {
    if (tab === "all") {
      allLivePosts.forEach((p) => seenAllIds.current.add(p.id));
      setDisplayedAll(allLivePosts);
      setPendingAllCount(0);
    } else {
      followingLivePosts.forEach((p) => seenFollowingIds.current.add(p.id));
      setDisplayedFollowing(followingLivePosts);
      setPendingFollowCount(0);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Follow toggle ────────────────────────────────────────────────────────────
  // Plain function — React Compiler handles memoization; explicit useCallback
  // conflicted with ref mutations inside (react-compiler lint error).
  const handleFollowToggle = (societyId: string, following: boolean) => {
    setFollowedIds((prev) => {
      const next = new Set(prev);
      following ? next.add(societyId) : next.delete(societyId);
      return next;
    });
    if (user?.uid) {
      getFollowedSocietyIds(user.uid).then((ids) => {
        followUnsubRef.current?.();
        isInitFollowRef.current = true;
        setPendingFollowCount(0);
        const unsub = subscribeToFollowingFeed(ids, (incoming) => {
          setFollowingLivePosts(incoming);
          if (isInitFollowRef.current) {
            isInitFollowRef.current = false;
            incoming.forEach((p) => seenFollowingIds.current.add(p.id));
            setDisplayedFollowing(incoming);
          } else {
            setPendingFollowCount(
              incoming.filter((p) => !seenFollowingIds.current.has(p.id))
                .length,
            );
          }
        });
        if (unsub) followUnsubRef.current = unsub;
      });
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const currentDisplayed = tab === "all" ? displayedAll : displayedFollowing;
  const isLoading = tab === "all" ? loadingAll : !followingLoaded;
  const hasMore = tab === "all" && allLivePosts.length === pageSize; // only page global feed

  const filteredPosts = currentDisplayed
    .filter((p) => typeFilter === "all" || p.type === typeFilter)
    .filter(
      (p) =>
        !search.trim() ||
        p.societyName.toLowerCase().includes(search.toLowerCase()) ||
        p.content.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <>
      {/* ── Header ── */}
      <div style={{ padding: "var(--page-padding-y) var(--page-padding-x) 0" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 22,
                fontWeight: 800,
                marginBottom: 4,
              }}
            >
              🌐 Global Learning Feed
            </h1>
            <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
              Discover posts from institutes around the world
              {isSuperAdmin && (
                <span
                  style={{
                    marginLeft: 8,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#ef4444",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  ⚡ Super Admin Mode
                </span>
              )}
            </p>
          </div>

          {/* Search bar */}
          <div style={{ position: "relative", minWidth: 220 }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: 14,
                pointerEvents: "none",
              }}
            >
              🔍
            </span>
            <input
              className="input"
              placeholder="Search posts or institutes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 32, fontSize: 13, width: "100%" }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          {(["all", "following"] as FeedTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "8px 18px",
                fontSize: 13,
                fontWeight: 500,
                color:
                  tab === t ? "var(--primary-400)" : "var(--text-tertiary)",
                borderBottom: `2px solid ${tab === t ? "var(--primary-400)" : "transparent"}`,
                background: "none",
                border: "none",
                borderBottomWidth: 2,
                borderBottomStyle: "solid",
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "var(--font-body)",
              }}
            >
              {t === "all" ? "🌐 All Posts" : "🔔 Following"}
              {t === "following" && followedIds.size > 0 && (
                <span
                  style={{
                    marginLeft: 6,
                    background: "rgba(16,185,129,0.15)",
                    color: "var(--primary-400)",
                    padding: "1px 6px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {followedIds.size}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Type filter chips */}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            padding: "12px 0 4px",
          }}
        >
          {TYPE_FILTERS.map(({ value, label }) => {
            const active = typeFilter === value;
            const color =
              value !== "all"
                ? TYPE_TEXTS[value as PostType]
                : "var(--primary-400)";
            return (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: active ? color : "var(--border-primary)",
                  background: active ? `${color}18` : "transparent",
                  color: active ? color : "var(--text-tertiary)",
                  fontWeight: active ? 600 : 400,
                  transition: "all .15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── New posts badge ── */}
      {pendingCount > 0 && (
        <div
          style={{
            position: "sticky",
            top: 8,
            zIndex: 40,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <button
            onClick={showNewPosts}
            style={{
              pointerEvents: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 18px",
              borderRadius: 999,
              background: "var(--gradient-primary)",
              color: "#fff",
              border: "none",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
              animation: "pulse 2s ease-in-out infinite",
            }}
          >
            ⬆ {pendingCount} new post{pendingCount !== 1 ? "s" : ""} — tap to
            show
          </button>
        </div>
      )}

      {/* ── Content ── */}
      <div
        style={{
          padding: "16px var(--page-padding-x)",
          flex: 1,
          overflowY: "auto",
        }}
      >
        {/* ── Unauthenticated following tab ── */}
        {tab === "following" && !user ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
                fontFamily: "var(--font-heading)",
              }}
            >
              Sign In to Follow Societies
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                maxWidth: 300,
                margin: "0 auto 24px",
                lineHeight: 1.7,
              }}
            >
              Create an account to follow institutes and get a personalised feed
              of their announcements, events, and opportunities.
            </p>
            <a href="/login" className="btn btn-primary btn-sm">
              Sign In
            </a>
          </div>
        ) : isLoading ? (
          <FeedSkeleton />
        ) : filteredPosts.length === 0 ? (
          // Empty / no results
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div
              style={{
                fontSize: 52,
                marginBottom: 16,
                filter: "grayscale(0.2)",
              }}
            >
              {search ? "🔍" : tab === "following" ? "🔔" : "📭"}
            </div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
                fontFamily: "var(--font-heading)",
              }}
            >
              {search
                ? "No matches found"
                : tab === "following"
                  ? "Your feed is quiet"
                  : typeFilter !== "all"
                    ? `No ${typeFilter}s yet`
                    : "No posts yet"}
            </div>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-tertiary)",
                maxWidth: 320,
                margin: "0 auto 24px",
                lineHeight: 1.7,
              }}
            >
              {search
                ? `No posts or institutes match "${search}".`
                : tab === "following"
                  ? "Follow institutes from the All Posts tab to see their updates here."
                  : typeFilter !== "all"
                    ? "No posts of this type have been published yet."
                    : "Institutes haven't posted yet. Check back soon."}
            </p>
            {search ? (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSearch("")}
              >
                ✕ Clear Search
              </button>
            ) : typeFilter !== "all" ? (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setTypeFilter("all")}
              >
                ✕ Show All Types
              </button>
            ) : tab === "following" ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setTab("all")}
              >
                🌐 Browse All Posts
              </button>
            ) : (
              <a href="/societies" className="btn btn-outline btn-sm">
                🏛️ Explore Institutes
              </a>
            )}
          </div>
        ) : (
          <>
            {filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.uid}
                followedIds={followedIds}
                onFollowToggle={handleFollowToggle}
                isSuperAdmin={isSuperAdmin}
              />
            ))}

            {/* Load More */}
            {hasMore && typeFilter === "all" && !search && (
              <div
                style={{ textAlign: "center", marginTop: 8, marginBottom: 16 }}
              >
                <button
                  className="btn btn-outline btn-sm"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    setPageSize((p) => p + PAGE_INCREMENT);
                  }}
                >
                  {loadingMore ? "Loading…" : "Load More Posts"}
                </button>
              </div>
            )}

            {/* End-of-feed indicator */}
            {(!hasMore || typeFilter !== "all" || search) && (
              <div
                style={{
                  textAlign: "center",
                  padding: "28px 0 8px",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  borderTop: "1px solid var(--border-secondary)",
                  marginTop: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 1,
                      background: "var(--border-secondary)",
                      display: "inline-block",
                    }}
                  />
                  {filteredPosts.length} post
                  {filteredPosts.length !== 1 ? "s" : ""}
                  {search ? ` matching "${search}"` : " · You're all caught up"}
                  <span
                    style={{
                      width: 20,
                      height: 1,
                      background: "var(--border-secondary)",
                      display: "inline-block",
                    }}
                  />
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
