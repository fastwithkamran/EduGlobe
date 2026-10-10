"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  subscribeToFeed,
  subscribeToFollowingFeed,
  getFollowedSocietyIds,
} from "@/lib/firestore";
import { TYPE_TEXTS } from "@/lib/postHelpers";
import { PostCard } from "./_components/PostCard";
import { FeedSkeleton } from "./_components/FeedSkeleton";
import type { Post, PostType } from "@/types";
import {
  FiSearch,
  FiX,
  FiGlobe,
  FiZap,
  FiBell,
  FiInbox,
  FiLock,
  FiArrowUp,
  FiCode,
  FiBriefcase,
  FiCalendar,
} from "react-icons/fi";
import {
  HiOutlineAcademicCap,
  HiOutlineMegaphone,
} from "react-icons/hi2";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

type FeedTab = "all" | "following";

const TYPE_FILTERS: Array<{
  value: PostType | "all";
  label: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}> = [
  { value: "all", label: "All" },
  { value: "hackathon", label: "Hackathons", icon: FiCode },
  { value: "scholarship", label: "Scholarships", icon: HiOutlineAcademicCap },
  { value: "internship", label: "Internships", icon: FiBriefcase },
  { value: "announcement", label: "Announcements", icon: HiOutlineMegaphone },
  { value: "event", label: "Events", icon: FiCalendar },
];

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function GlobalFeedPage() {
  const { user, isSuperAdmin, loading: authLoading, loginWithGoogle } = useAuth();

  const [tab, setTab] = useState<FeedTab>("all");
  const [loadingAll, setLoadingAll] = useState(true);
  const [feedRetry, setFeedRetry] = useState(0);
  const [followingLoadedUserId, setFollowingLoadedUserId] = useState<
    string | null
  >(null);
  const [followingError, setFollowingError] = useState<string | null>(null);
  const [followingRetry, setFollowingRetry] = useState(0);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [followingPageSize, setFollowingPageSize] = useState(PAGE_SIZE);
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
  const followingUidRef = useRef<string | null>(null);
  // Search + type filter
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<PostType | "all">("all");

  // Pending new-post badge counts — updated inside subscription callbacks (not during render).
  // Avoids "Cannot access refs during render" from the React Compiler rule.
  const [pendingAllCount, setPendingAllCount] = useState(0);
  const [pendingFollowCount, setPendingFollowCount] = useState(0);

  // ── Global feed subscription (re-subscribes on pageSize change) ──────────────
  useEffect(() => {
    let initialized = true;
    let active = true;
    const unsubscribe = subscribeToFeed(
      (incoming) => {
        if (!active) return;
        setAllLivePosts(incoming);
        if (initialized) {
          // First load and each load-more subscription includes the latest window.
          initialized = false;
          setFeedError(null);
          setPendingAllCount(0);
          incoming.forEach((post) => seenAllIds.current.add(post.id));
          setDisplayedAll(incoming);
          setLoadingAll(false);
          setLoadingMore(false);
        } else {
          setPendingAllCount(
            incoming.filter((post) => !seenAllIds.current.has(post.id)).length,
          );
        }
      },
      pageSize,
      (error) => {
        if (!active) return;
        console.error(
          "[GlobalFeedPage] Global feed subscription failed:",
          error,
        );
        setFeedError("Unable to load the global feed. Please try again.");
        setLoadingAll(false);
        setLoadingMore(false);
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [pageSize, feedRetry]);

  // ── Following feed ───────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = user?.uid;
    const identityChanged = followingUidRef.current !== (uid ?? null);
    followingUidRef.current = uid ?? null;
    let active = true;
    let initialized = true;
    let unsubscribe: (() => void) | null = null;

    if (!uid) {
      queueMicrotask(() => {
        if (!active) return;
        setFollowingError(null);
        setFollowingLivePosts([]);
        setDisplayedFollowing([]);
        setFollowedIds(new Set());
        setPendingFollowCount(0);
      });
      return () => {
        active = false;
      };
    }

    if (identityChanged) {
      queueMicrotask(() => {
        if (!active) return;
        setFollowingError(null);
        setFollowingLoadedUserId(null);
        setFollowingLivePosts([]);
        setDisplayedFollowing([]);
        setPendingFollowCount(0);
      });
    }

    getFollowedSocietyIds(uid)
      .then((ids) => {
        if (!active) return;
        setFollowedIds(new Set(ids));
        setFollowingError(null);
        unsubscribe = subscribeToFollowingFeed(
          ids,
          (incoming) => {
            if (!active) return;
            setFollowingError(null);
            setFollowingLivePosts(incoming);
            if (initialized) {
              initialized = false;
              incoming.forEach((post) => seenFollowingIds.current.add(post.id));
              setDisplayedFollowing(incoming);
              setFollowingLoadedUserId(uid);
              setPendingFollowCount(0);
            } else {
              setPendingFollowCount(
                incoming.filter(
                  (post) => !seenFollowingIds.current.has(post.id),
                ).length,
              );
            }
          },
          (error) => {
            if (!active) return;
            console.error(
              "[GlobalFeedPage] Following feed subscription failed:",
              error,
            );
            setFollowingError(
              "Unable to load your following feed. Please try again.",
            );
            setFollowingLoadedUserId(uid);
            setLoadingMore(false);
          },
          followingPageSize,
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(
          "[GlobalFeedPage] Failed to load followed societies:",
          error,
        );
        setFollowingError(
          "Unable to load your following feed. Please try again.",
        );
        setFollowingLoadedUserId(uid);
        setLoadingMore(false);
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [user?.uid, followingRetry, followingPageSize]);

  const pendingCount = tab === "all" ? pendingAllCount : pendingFollowCount;

  const showNewPosts = () => {
    if (tab === "all") {
      allLivePosts.forEach((post) => seenAllIds.current.add(post.id));
      setDisplayedAll(allLivePosts);
      setPendingAllCount(0);
    } else {
      followingLivePosts.forEach((post) =>
        seenFollowingIds.current.add(post.id),
      );
      setDisplayedFollowing(followingLivePosts);
      setPendingFollowCount(0);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFollowToggle = (societyId: string, following: boolean) => {
    setFollowingError(null);
    setFollowingLoadedUserId(null);
    setFollowedIds((previous) => {
      const next = new Set(previous);
      if (following) next.add(societyId);
      else next.delete(societyId);
      return next;
    });
    setFollowingRetry((previous) => previous + 1);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const currentDisplayed = tab === "all" ? displayedAll : displayedFollowing;
  const isLoading =
    authLoading ||
    (tab === "all"
      ? loadingAll
      : Boolean(user?.uid && followingLoadedUserId !== user.uid));
  const hasMore =
    tab === "all"
      ? allLivePosts.length === pageSize
      : followingLivePosts.length === followingPageSize;
  const normalizedSearch = search.trim().toLowerCase();

  const filteredPosts = currentDisplayed
    .filter((post) => typeFilter === "all" || post.type === typeFilter)
    .filter(
      (post) =>
        !normalizedSearch ||
        post.societyName.toLowerCase().includes(normalizedSearch) ||
        post.content.toLowerCase().includes(normalizedSearch),
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
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FiGlobe className="text-[var(--primary-400)]" /> Global Opportunity Feed
            </h1>
            <p style={{ color: "var(--text-tertiary)", fontSize: 13, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
              Discover posts from institutes around the world
              {isSuperAdmin && (
                <span
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#ef4444",
                    padding: "2px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FiZap className="text-[10px]" /> Super Admin Mode
                </span>
              )}
            </p>
          </div>

          {/* Search bar */}
          <div style={{ position: "relative", minWidth: 220 }}>
            <label className="sr-only" htmlFor="feed-search">
              Search feed posts
            </label>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              <FiSearch style={{ width: 14, height: 14 }} />
            </span>
            <input
              id="feed-search"
              className="input"
              placeholder="Search posts or institutes…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ paddingLeft: 32, fontSize: 13, width: "100%" }}
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 2,
                }}
              >
                <FiX style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          {(["all", "following"] as FeedTab[]).map((feedTab) => (
            <button
              key={feedTab}
              type="button"
              aria-pressed={tab === feedTab}
              onClick={() => setTab(feedTab)}
              className="feed-tab-button"
              style={{
                fontWeight: 500,
                color:
                  tab === feedTab
                    ? "var(--primary-400)"
                    : "var(--text-tertiary)",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === feedTab ? "var(--primary-400)" : "transparent"}`,
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "var(--font-body)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {feedTab === "all" ? (
                <>
                  <FiGlobe style={{ width: 14, height: 14 }} /> All Posts
                </>
              ) : (
                <>
                  <FiBell style={{ width: 14, height: 14 }} /> Following
                </>
              )}
              {feedTab === "following" && followedIds.size > 0 && (
                <span
                  style={{
                    marginLeft: 2,
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
          <label className="feed-mobile-filter">
            <span>Filter</span>
            <select
              className="select"
              aria-label="Filter posts by type"
              value={typeFilter}
              onChange={(event) => {
                const selectedFilter = TYPE_FILTERS.find(
                  ({ value }) => value === event.target.value,
                );
                if (selectedFilter) setTypeFilter(selectedFilter.value);
              }}
              style={{
                padding: "7px 28px 7px 10px",
                fontSize: 12,
                minWidth: 88,
              }}
            >
              {TYPE_FILTERS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Type filter chips */}
        <div
          className="feed-type-filters"
          style={{
            gap: 6,
            flexWrap: "wrap",
            padding: "12px 0 4px",
          }}
        >
          {TYPE_FILTERS.map(({ value, label, icon: FilterIcon }) => {
            const active = typeFilter === value;
            const color =
              value !== "all"
                ? TYPE_TEXTS[value as PostType]
                : "var(--primary-400)";
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setTypeFilter(value)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
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
                {FilterIcon && <FilterIcon style={{ width: 13, height: 13 }} />}
                <span>{label}</span>
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
            type="button"
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
            <FiArrowUp style={{ width: 14, height: 14 }} /> {pendingCount} new post{pendingCount !== 1 ? "s" : ""} — tap to
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
        {tab === "following" && authLoading ? (
          <FeedSkeleton />
        ) : tab === "following" && !user ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "rgba(16,185,129,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--primary-400)",
                }}
              >
                <FiLock style={{ width: 24, height: 24 }} />
              </div>
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
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => loginWithGoogle().catch(() => {})}
            >
              Sign In
            </button>
          </div>
        ) : tab === "following" && followingError ? (
          <div
            role="alert"
            style={{ textAlign: "center", padding: "80px 24px" }}
          >
            <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
              {followingError}
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setFollowingError(null);
                setFollowingRetry((retry) => retry + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <FeedSkeleton />
        ) : feedError && tab === "all" ? (
          <div
            role="alert"
            style={{ textAlign: "center", padding: "80px 24px" }}
          >
            <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
              {feedError}
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setFeedError(null);
                setLoadingAll(true);
                setFeedRetry((retry) => retry + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : filteredPosts.length === 0 ? (
          // Empty / no results
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--bg-input)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-tertiary)",
                }}
              >
                {search ? (
                  <FiSearch style={{ width: 24, height: 24 }} />
                ) : tab === "following" ? (
                  <FiBell style={{ width: 24, height: 24 }} />
                ) : (
                  <FiInbox style={{ width: 24, height: 24 }} />
                )}
              </div>
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
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setSearch("")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FiX style={{ width: 14, height: 14 }} /> Clear Search
              </button>
            ) : typeFilter !== "all" ? (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setTypeFilter("all")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FiX style={{ width: 14, height: 14 }} /> Show All Types
              </button>
            ) : tab === "following" ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setTab("all")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FiGlobe style={{ width: 14, height: 14 }} /> Browse All Posts
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setTab("all")}
                style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <FiGlobe style={{ width: 14, height: 14 }} /> Browse All Posts
              </button>
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
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={loadingMore}
                  onClick={() => {
                    setLoadingMore(true);
                    if (tab === "all") {
                      setPageSize((size) => size + PAGE_SIZE);
                    } else {
                      setFollowingPageSize((size) => size + PAGE_SIZE);
                    }
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
