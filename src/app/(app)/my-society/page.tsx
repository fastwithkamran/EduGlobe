"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getSociety, subscribeToSocietyPosts } from "@/lib/firestore";
import { sanitizeImageUrl } from "@/lib/utils";
import { PostComposer } from "./_components/PostComposer";
import { SocietyPostCard } from "./_components/SocietyPostCard";
import { AboutTab } from "./_components/AboutTab";
import Loader from "../../../components/Loader";
import Image from "next/image";
import type { Society, Post } from "@/types";

const PAGE_SIZE = 10;
const PAGE_INCREMENT = 10;

type Tab = "feed" | "about";

export default function MySocietyPage() {
  const { user, userProfile, isSuperAdmin } = useAuth();
  const router = useRouter();

  const [society, setSociety] = useState<Society | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>("feed");
  const [loadedSocietyId, setLoadedSocietyId] = useState<string | null>(null);
  const [postLimit, setPostLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const unsubRef = useRef<(() => void) | null>(null);

  // Re-subscribe whenever societyId OR postLimit changes
  useEffect(() => {
    const societyId = userProfile?.societyId;
    if (!societyId) return;

    let isCurrent = true;
    getSociety(societyId).then((s) => {
      if (!isCurrent) return;
      setSociety(s);
      setLoadedSocietyId(societyId);
    });

    unsubRef.current?.(); // cancel previous subscription
    unsubRef.current = subscribeToSocietyPosts(
      societyId,
      (incoming) => {
        setPosts(incoming);
        setHasMore(incoming.length === postLimit); // if we got exactly limit, there may be more
        setLoadingMore(false);
      },
      postLimit,
    );

    return () => {
      isCurrent = false;
      unsubRef.current?.();
    };
  }, [userProfile?.societyId, postLimit]);

  const isAdmin =
    isSuperAdmin ||
    userProfile?.role === "admin" ||
    userProfile?.role === "super_admin";

  // ── Loading state ──
  if (
    userProfile?.societyId &&
    loadedSocietyId !== userProfile.societyId
  ) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)]">
        <Loader />
      </div>
    );
  }

  // ── No society yet ──
  if (!userProfile?.societyId || !society) {
    return (
      <div style={{ padding: "40px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏛️</div>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 20,
            fontWeight: 800,
            marginBottom: 8,
          }}
        >
          No Academy Yet
        </h2>
        <p
          style={{
            color: "var(--text-tertiary)",
            fontSize: 13,
            marginBottom: 24,
          }}
        >
          You haven&apos;t created an Academy. Create one to get started!
        </p>
        <button
          className="btn btn-primary"
          onClick={() => router.push("/create-society")}
        >
          + Start a Education Hub
        </button>
      </div>
    );
  }

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "feed", label: "📰 Feed" },
    { id: "about", label: "ℹ️ About" },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}
    >
      {/* ── Banner ── */}
      <div
        style={{
          position: "relative",
          height: 160,
          flexShrink: 0,
          background: society.bannerURL
            ? `url(${sanitizeImageUrl(society.bannerURL)}) center/cover`
            : "var(--gradient-hero)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, transparent 40%, rgba(6,11,24,0.9))",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "0 var(--page-padding-x) 16px",
            display: "flex",
            alignItems: "flex-end",
            gap: 16,
          }}
        >
          {/* Logo */}
          <div
            style={{
              position: "relative",
              width: 72,
              height: 72,
              borderRadius: 14,
              background: "var(--gradient-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              overflow: "hidden",
              flexShrink: 0,
              border: "3px solid rgba(255,255,255,0.1)",
            }}
          >
            {society.logoURL ? (
              <Image
                src={sanitizeImageUrl(society.logoURL)}
                alt={society.name || "Society Logo"}
                fill
                sizes="72px"
                style={{ objectFit: "cover" }}
              />
            ) : (
              "🌐"
            )}
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 mb-0.5">
              <h1
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#fff",
                  margin: 0,
                }}
              >
                {society.name}
              </h1>
              {society.isVerified && (
                <span
                  style={{
                    background: "rgba(16,185,129,0.2)",
                    color: "#10b981",
                    border: "1px solid rgba(16,185,129,0.3)",
                    padding: "1px 8px",
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  ✓ Verified
                </span>
              )}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.65)",
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {society.organization && <span>{society.organization}</span>}
              <span>
                📍 {society.city}, {society.country}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div
        style={{
          borderBottom: "1px solid var(--border-primary)",
          padding: "0 var(--page-padding-x)",
          background: "var(--bg-secondary)",
          flexShrink: 0,
        }}
      >
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "12px 16px",
                fontSize: 13,
                fontWeight: 500,
                color:
                  tab === t.id ? "var(--primary-400)" : "var(--text-tertiary)",
                borderBottom: `2px solid ${tab === t.id ? "var(--primary-400)" : "transparent"}`,
                background: "none",
                border: "none",
                borderBottomWidth: 2,
                borderBottomStyle: "solid",
                cursor: "pointer",
                transition: "all .15s",
                fontFamily: "var(--font-body)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: "20px var(--page-padding-x)", flex: 1 }}>
        {/* Feed tab */}
        {tab === "feed" && (
          <>
            {isAdmin && user && (
              <PostComposer
                society={society}
                authorId={user.uid}
                authorName={userProfile?.displayName ?? ""}
              />
            )}

            {posts.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 0",
                  color: "var(--text-tertiary)",
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📰</div>
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
                    currentUserId={user?.uid}
                    isAdmin={isAdmin}
                    isSuperAdmin={isSuperAdmin}
                  />
                ))}

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-2 mb-4">
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={loadingMore}
                      onClick={() => {
                        setLoadingMore(true);
                        setPostLimit((prev) => prev + PAGE_INCREMENT);
                      }}
                    >
                      {loadingMore ? "Loading…" : "Load More Posts"}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* About tab */}
        {tab === "about" && <AboutTab society={society} />}
      </div>
    </div>
  );
}
