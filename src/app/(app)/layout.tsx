"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { subscribeToNotifications } from "@/lib/firestore";
import type { Notification } from "@/types";
import { sanitizeImageUrl } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import Loader from "../../components/Loader";
import Image from "next/image";
import {
  FiGlobe,
  FiBell,
  FiSettings,
  FiLayers,
  FiSun,
  FiMoon,
  FiLogOut,
  FiZap,
} from "react-icons/fi";
import { HiOutlineBuildingLibrary, HiOutlineSparkles } from "react-icons/hi2";

const NAV_ITEMS = [
  {
    section: "Discover",
    items: [{ label: "Global Feed", href: "/feed", icon: FiGlobe }],
  },
  {
    section: "Community",
    items: [{ label: "Society", href: "/my-society", icon: HiOutlineBuildingLibrary }],
  },
  {
    section: "AI Tools",
    items: [{ label: "AI Assistant", href: "/ai", icon: HiOutlineSparkles }],
  },
  {
    section: "Account",
    items: [
      {
        label: "Notifications",
        href: "/notifications",
        icon: FiBell,
        dynamic: "unread" as const,
      },
      { label: "Settings", href: "/settings", icon: FiSettings },
    ],
  },
  {
    section: "Admin Controls",
    superAdminSection: true,
    items: [
      {
        label: "Manage Societies",
        href: "/super-admin",
        icon: FiLayers,
        superAdminOnly: true,
      },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile, loading, logout, user, isSuperAdmin, loginWithGoogle } =
    useAuth();
  const [notificationCount, setNotificationCount] = useState<{
    userId: string;
    unread: number;
  } | null>(null);
  const unreadCount =
    notificationCount && notificationCount.userId === user?.uid
      ? notificationCount.unread
      : 0;

  const { theme, toggleTheme } = useTheme();

  // ─── Mobile nav auto-hide on scroll ──────────────────────────────────────
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollY = useRef(0);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = el.scrollTop;
      setNavVisible(y < lastScrollY.current || y < 80);
      lastScrollY.current = y;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return subscribeToNotifications(
      user.uid,
      (notifs: Notification[]) => {
        setNotificationCount({
          userId: user.uid,
          unread: notifs.filter((notification) => !notification.isRead).length,
        });
      },
      (error) => {
        console.error("[AdminLayout] Notification subscription failed:", error);
      },
    );
  }, [user?.uid]);

  if (loading) {
    return (
      <div
        className="app-viewport"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
        }}
      >
        <div
          style={{
            color: "var(--primary-400)",
            fontFamily: "var(--font-heading)",
            fontSize: "1.25rem",
          }}
        >
          <Loader />
        </div>
      </div>
    );
  }

  const initials = userProfile?.displayName
    ? userProfile.displayName
        .split(" ")
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : (user?.email?.[0] ?? "?").toUpperCase();
  const profilePhotoURL = userProfile?.photoURL
    ? sanitizeImageUrl(userProfile.photoURL)
    : "";

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/feed");
    } catch (error) {
      console.error("[AdminLayout] Failed to sign out:", error);
      toast.error("Failed to sign out. Please try again.");
    }
  };

  const handleGuestSignIn = async () => {
    try {
      await loginWithGoogle();
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (
        code.includes("popup-closed-by-user") ||
        code.includes("cancelled-popup-request")
      ) {
        return;
      }
      console.error("[AdminLayout] Google sign-in failed:", error);
      toast.error("Unable to sign in. Please try again.");
    }
  };

  const mobileNavItems = [
    { label: "Feed", href: "/feed", icon: FiGlobe },
    { label: "Society", href: "/my-society", icon: HiOutlineBuildingLibrary },
    { label: "AI", href: "/ai", icon: HiOutlineSparkles },
    { label: "Alerts", href: "/notifications", icon: FiBell, badge: unreadCount },
    { label: "Profile", href: "/settings", icon: FiSettings },
  ];

  return (
    <div
      className="app-shell flex flex-col md:flex-row"
      style={{
        background: "var(--bg-primary)",
      }}
    >
      <header
        className="flex md:hidden"
        style={{
          height: 60,
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-primary)",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image
            src="/logo_bg.png"
            alt="Opportune"
            width={32}
            height={32}
            style={{
              borderRadius: 8,
              flexShrink: 0,
              objectFit: "contain",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            Opportune
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {isSuperAdmin && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: "#ef4444",
                fontSize: 13,
              }}
              title="Super Admin"
            >
              <FiZap />
            </span>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-primary)",
              borderRadius: 8,
              padding: "6px 8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
            }}
          >
            {theme === "dark" ? (
              <FiSun className="w-4 h-4 text-amber-400" />
            ) : (
              <FiMoon className="w-4 h-4 text-slate-300" />
            )}
          </button>
          {!user && (
            <button
              type="button"
              onClick={handleGuestSignIn}
              aria-label="Sign in with Google"
              style={{
                color: "#fff",
                background: "var(--gradient-primary)",
                padding: "4px 10px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      <aside
        className="hidden md:flex"
        style={{
          width: "var(--sidebar-width)",
          minWidth: "var(--sidebar-width)",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-primary)",
          flexDirection: "column",
          overflow: "hidden",
          transition: "all var(--transition-base)",
        }}
      >
        <div
          style={{
            padding: "18px 16px 14px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "1px solid var(--border-primary)",
          }}
        >
          <Image
            src="/logo_bg.png"
            alt="Opportune"
            width={32}
            height={32}
            style={{
              borderRadius: 8,
              flexShrink: 0,
              objectFit: "contain",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 16,
            }}
          >
            Opportune
          </span>
        </div>

        {isSuperAdmin && (
          <div
            style={{
              padding: "6px 12px",
              background: "rgba(239,68,68,0.08)",
              borderBottom: "1px solid rgba(239,68,68,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 600,
              color: "#ef4444",
            }}
          >
            <FiZap style={{ width: 14, height: 14, display: "inline-block" }} /> Super Admin Mode
          </div>
        )}

        <nav
          aria-label="Primary navigation"
          style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}
        >
          {NAV_ITEMS.map((section) => {
            if (
              (section as { superAdminSection?: boolean }).superAdminSection &&
              !isSuperAdmin
            )
              return null;
            return (
              <div key={section.section}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: (section as { superAdminSection?: boolean })
                      .superAdminSection
                      ? "rgba(239,68,68,0.6)"
                      : "var(--text-muted)",
                    letterSpacing: ".08em",
                    textTransform: "uppercase",
                    padding: "12px 8px 6px",
                  }}
                >
                  {section.section}
                </div>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/feed" && pathname.startsWith(item.href));
                  const badge =
                    (item as { dynamic?: string }).dynamic === "unread"
                      ? unreadCount
                      : 0;
                  const isAdminItem = (item as { superAdminOnly?: boolean })
                    .superAdminOnly;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                        borderRadius: "var(--radius-md)",
                        marginBottom: 3,
                        textDecoration: "none",
                        fontSize: 13,
                        color: isActive
                          ? isAdminItem
                            ? "#ef4444"
                            : "var(--primary-400)"
                          : "var(--text-secondary)",
                        background: isActive
                          ? isAdminItem
                            ? "rgba(239,68,68,0.1)"
                            : "rgba(16,185,129,0.12)"
                          : "transparent",
                        fontWeight: 400,
                        transition: "all .15s",
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <item.icon style={{ width: 16, height: 16 }} />
                      </span>
                      {item.label}
                      {Boolean(badge > 0) && (
                        <span
                          style={{
                            marginLeft: "auto",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: "#ef4444",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      {isAdminItem && !isActive && (
                        <span
                          style={{
                            marginLeft: "auto",
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#ef4444",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer: user profile OR guest sign-in */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border-primary)",
          }}
        >
          {user ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                {profilePhotoURL ? (
                  <Image
                    src={profilePhotoURL}
                    alt={`${userProfile?.displayName ?? "User"} profile photo`}
                    width={32}
                    height={32}
                    style={{
                      borderRadius: "50%",
                      flexShrink: 0,
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: isSuperAdmin
                        ? "linear-gradient(135deg,#ef4444,#dc2626)"
                        : "var(--gradient-primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {userProfile?.displayName ?? user.email}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: isSuperAdmin ? "#ef4444" : "var(--text-tertiary)",
                    }}
                  >
                    {isSuperAdmin ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <FiZap style={{ width: 12, height: 12 }} /> Super Admin
                      </span>
                    ) : userProfile?.role === "admin" ? (
                      "Society Admin"
                    ) : (
                      "Viewer"
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleLogout}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-tertiary)",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "4px 0",
                    transition: "color .15s",
                    flex: 1,
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.color = "#ef4444")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.color = "var(--text-tertiary)")
                  }
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FiLogOut style={{ width: 14, height: 14 }} /> Log Out
                  </span>
                </button>
                {/* Theme toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                  title={
                    theme === "dark"
                      ? "Switch to Light Mode"
                      : "Switch to Dark Mode"
                  }
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-primary)",
                    borderRadius: 8,
                    padding: "4px 8px",
                    cursor: "pointer",
                    fontSize: 14,
                    transition: "all .15s",
                    flexShrink: 0,
                  }}
                >
                  {theme === "dark" ? (
                    <FiSun style={{ width: 15, height: 15, color: "#f59e0b" }} />
                  ) : (
                    <FiMoon style={{ width: 15, height: 15 }} />
                  )}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={handleGuestSignIn}
                aria-label="Sign in with Google"
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "10px 14px",
                  background: "var(--gradient-primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-lg)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  transition: "all .2s",
                  boxShadow: "0 0 16px rgba(16,185,129,0.2)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 24px rgba(16,185,129,0.35)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 0 16px rgba(16,185,129,0.2)";
                }}
              >
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                    fill="rgba(255,255,255,0.9)"
                  />
                  <path
                    d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                    fill="rgba(255,255,255,0.85)"
                  />
                  <path
                    d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
                    fill="rgba(255,255,255,0.8)"
                  />
                  <path
                    d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
                    fill="rgba(255,255,255,0.9)"
                  />
                </svg>
                Sign in with Google
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                title={
                  theme === "dark"
                    ? "Switch to Light Mode"
                    : "Switch to Dark Mode"
                }
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-primary)",
                  borderRadius: 8,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 14,
                  transition: "all .15s",
                  flexShrink: 0,
                }}
              >
                {theme === "dark" ? (
                  <FiSun style={{ width: 15, height: 15, color: "#f59e0b" }} />
                ) : (
                  <FiMoon style={{ width: 15, height: 15 }} />
                )}
              </button>
            </div>
          )}
        </div>
      </aside>

      <main
        ref={mainRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </main>

      <nav
        aria-label="Primary mobile navigation"
        className="flex md:hidden"
        style={{
          flexShrink: 0,
          minHeight: 65,
          width: "100%",
          background: "var(--bg-glass)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid var(--border-primary)",
          zIndex: 100,
          justifyContent: "space-around",
          alignItems: "center",
          padding: "8px 0 calc(8px + env(safe-area-inset-bottom))",
          // Auto-hide on scroll down, reappear on scroll up
          transform: navVisible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/feed" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              style={{
                textDecoration: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                position: "relative",
                width: "20%",
              }}
            >
              <div
                style={{
                  filter: isActive ? "grayscale(0)" : "grayscale(1)",
                  opacity: isActive ? 1 : 0.6,
                  transform: isActive ? "translateY(-2px)" : "none",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <item.icon style={{ width: 20, height: 20 }} />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--primary-400)"
                    : "var(--text-secondary)",
                }}
              >
                {item.label}
              </span>
              {Boolean(item.badge && item.badge > 0) && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: "calc(50% - 14px)",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ef4444",
                    border: "2px solid var(--bg-primary)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
