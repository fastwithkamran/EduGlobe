"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getSociety, subscribeToSocietyPosts } from "@/lib/firestore";
import { PostComposer } from "./_components/PostComposer";
import { SocietyPostCard } from "./_components/SocietyPostCard";
import { AboutTab } from "./_components/AboutTab";
import { NoSocietyState } from "./_components/NoSocietyState";
import { SocietyHeader } from "./_components/SocietyHeader";
import Loader from "@/components/Loader";
import type { Society, Post } from "@/types";
import { FiFileText, FiInfo, FiLock } from "react-icons/fi";
import { HiOutlineBuildingLibrary } from "react-icons/hi2";

const PAGE_SIZE = 10;
const TABS = [
  { id: "feed", label: "Feed", icon: FiFileText },
  { id: "about", label: "About", icon: FiInfo },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function MySocietyPage() {
  const {
    user,
    userProfile,
    isSuperAdmin,
    loading: authLoading,
    profileError,
    loginWithGoogle,
  } = useAuth();
  const societyId = userProfile?.societyId ?? null;

  const [society, setSociety] = useState<Society | null>(null);
  const [loadedSocietyId, setLoadedSocietyId] = useState<string | null>(null);
  const [societyError, setSocietyError] = useState<string | null>(null);
  const [societyRetry, setSocietyRetry] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadedPostsSocietyId, setLoadedPostsSocietyId] = useState<
    string | null
  >(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsRetry, setPostsRetry] = useState(0);
  const [tab, setTab] = useState<Tab>("feed");
  const [postLimit, setPostLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const isAdmin = isSuperAdmin || userProfile?.role === "admin";

  const [prevSocietyId, setPrevSocietyId] = useState<string | null>(societyId);

  // When the society changes, reset paging + stale data so the previous
  // society's page size / posts never leak into the next one.
  if (prevSocietyId !== societyId) {
    setPrevSocietyId(societyId);
    setPostLimit(PAGE_SIZE);
    setPosts([]);
    setHasMore(false);
    setLoadingMore(false);
    setSocietyError(null);
    setPostsError(null);
    setTab("feed");
  }

  useEffect(() => {
    if (!societyId) return;

    let active = true;
    getSociety(societyId)
      .then((result) => {
        if (!active) return;
        setSociety(result);
        setLoadedSocietyId(societyId);
        setSocietyError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("[MySocietyPage] Failed to load society:", error);
        setSociety(null);
        setSocietyError("Unable to load your society. Please try again.");
        setLoadedSocietyId(societyId);
      });

    return () => {
      active = false;
    };
  }, [societyId, societyRetry]);

  useEffect(() => {
    if (!societyId) return;

    let active = true;
    const unsubscribe = subscribeToSocietyPosts(
      societyId,
      (incoming) => {
        if (!active) return;
        setPosts(incoming);
        setHasMore(incoming.length >= postLimit);
        setLoadedPostsSocietyId(societyId);
        setPostsError(null);
        setLoadingMore(false);
      },
      postLimit,
      (error) => {
        if (!active) return;
        console.error(
          "[MySocietyPage] Failed to subscribe to society posts:",
          error,
        );
        setPostsError("Unable to load society posts. Please try again.");
        setLoadedPostsSocietyId(societyId);
        setLoadingMore(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [societyId, postLimit, postsRetry]);

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        <Loader />
      </div>
    );
  }

  // Prompt sign-in for unauthenticated visitors
  if (!user) {
    return (
      <main
        style={{ padding: "var(--page-padding-y) var(--page-padding-x)" }}
        aria-labelledby="society-heading"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1
              id="society-heading"
              className="mb-1 text-[22px] font-extrabold flex items-center gap-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <HiOutlineBuildingLibrary className="w-6 h-6 text-[var(--primary-400)]" />{" "}
              Society
            </h1>
            <p
              className="m-0 text-[13px] text-[var(--text-tertiary)]"
              aria-live="polite"
            >
              Sign in to view your society.
            </p>
          </div>
        </header>

        <section
          aria-label="Society"
          className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-primary)] bg-[var(--bg-card)]"
        >
          <div className="p-10 text-center sm:p-14">
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-tertiary)]">
                <FiLock className="w-6 h-6" />
              </div>
            </div>
            <h2 className="mb-1 text-[15px] font-semibold text-[var(--text-secondary)]">
              You’re signed out
            </h2>
            <p className="mx-auto mb-4 max-w-md text-[13px] text-[var(--text-tertiary)]">
              Sign in to view updates from your society and manage your
              community.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm inline-flex"
              onClick={() =>
                loginWithGoogle().catch((error: unknown) => {
                  const code =
                    typeof error === "object" &&
                    error !== null &&
                    "code" in error
                      ? String((error as { code: unknown }).code)
                      : "";
                  if (
                    code.includes("popup-closed") ||
                    code.includes("cancelled")
                  )
                    return;
                  console.error("[MySocietyPage] Sign-in failed:", error);
                  toast.error("Unable to sign in. Please try again.");
                })
              }
            >
              Sign in
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (profileError) {
    return (
      <div role="alert" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          Your account profile could not be loaded. Please refresh and try
          again.
        </p>
      </div>
    );
  }

  if (!societyId) return <NoSocietyState />;

  if (loadedSocietyId !== societyId) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        <Loader />
      </div>
    );
  }

  if (societyError) {
    return (
      <div role="alert" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
          {societyError}
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => {
            // Reset loaded id so the loader shows instead of flashing
            // "Society Not Found" while the retry is in flight.
            setSocietyError(null);
            setLoadedSocietyId(null);
            setSocietyRetry((retry) => retry + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!society) return <NoSocietyState missingSociety />;

  // Keyboard navigation for tablist (Arrow keys / Home / End)
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((item) => item.id === tab);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    const nextId = TABS[next].id;
    setTab(nextId);
    document.getElementById(`society-tab-${nextId}`)?.focus();
  };

  const feedContent = postsError ? (
    <div role="alert" style={{ textAlign: "center", padding: "40px 0" }}>
      <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
        {postsError}
      </p>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        onClick={() => {
          // Same flash-of-empty-state bug as the society retry.
          setPostsError(null);
          setLoadedPostsSocietyId(null);
          setPostsRetry((retry) => retry + 1);
        }}
      >
        Try again
      </button>
    </div>
  ) : loadedPostsSocietyId !== societyId ? (
    <div className="flex justify-center py-10 text-[var(--text-tertiary)]">
      <Loader />
    </div>
  ) : posts.length === 0 ? (
    <div
      style={{
        textAlign: "center",
        padding: "40px 0",
        color: "var(--text-tertiary)",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--bg-input)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-tertiary)",
          }}
        >
          <FiFileText style={{ width: 22, height: 22 }} />
        </div>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--text-secondary)",
          marginBottom: 6,
        }}
      >
        No posts yet
      </div>
      <p style={{ fontSize: 13 }}>
        {isAdmin
          ? "Use the composer above to publish your first post."
          : "Posts from this society will appear here."}
      </p>
    </div>
  ) : (
    <>
      {posts.map((post) => (
        <SocietyPostCard
          key={post.id}
          post={post}
          currentUserId={user.uid}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center mt-2 mb-4">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              setPostLimit((limit) => limit + PAGE_SIZE);
            }}
          >
            {loadingMore ? "Loading…" : "Load more posts"}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      <SocietyHeader society={society} />

      <div
        style={{
          borderBottom: "1px solid var(--border-primary)",
          padding: "0 var(--page-padding-x)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
        }}
      >
        <div
          className="flex"
          role="tablist"
          aria-label="Society sections"
          onKeyDown={handleTabKeyDown}
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              id={`society-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              aria-controls={`society-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              style={{
                padding: "12px 16px",
                fontSize: 13,
                fontWeight: 500,
                color:
                  tab === item.id
                    ? "var(--primary-400)"
                    : "var(--text-tertiary)",
                background: "none",
                border: "none",
                borderBottom: `2px solid ${tab === item.id ? "var(--primary-400)" : "transparent"}`,
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "var(--font-body)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <item.icon style={{ width: 14, height: 14 }} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Keep both panels mounted so draft state persists between tab switches */}
      <div
        id="society-panel-feed"
        role="tabpanel"
        aria-labelledby="society-tab-feed"
        hidden={tab !== "feed"}
        style={{ padding: "20px var(--page-padding-x)", flex: 1 }}
      >
        {isAdmin && (
          <PostComposer
            society={society}
            authorId={user.uid}
            authorName={userProfile?.displayName || user.displayName || "Admin"}
          />
        )}
        {feedContent}
      </div>

      <div
        id="society-panel-about"
        role="tabpanel"
        aria-labelledby="society-tab-about"
        hidden={tab !== "about"}
        style={{ padding: "20px var(--page-padding-x)", flex: 1 }}
      >
        <AboutTab society={society} />
      </div>
    </div>
  );
}
