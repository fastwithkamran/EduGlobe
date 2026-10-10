"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from "@/lib/firestore";
import { timeAgo } from "@/lib/postHelpers";
import type { Notification } from "@/types";
import { FiBell, FiFileText, FiLock, FiGlobe } from "react-icons/fi";

const NOTIFICATION_LIMIT = 30;
const TIME_REFRESH_MS = 60_000;

/** Firestore can hand back null (pending serverTimestamp) or an invalid Date.
 *  Calling toISOString() on those throws and would crash the whole page. */
function getValidDate(value: unknown): Date | null {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

function NotificationRow({
  notification,
  isMarkingRead,
  onMarkRead,
}: {
  notification: Notification;
  isMarkingRead: boolean;
  onMarkRead: (id: string) => void;
}) {
  const createdAt = getValidDate(notification.createdAt);
  const statusLabel = notification.isRead ? "Read" : "Unread";

  return (
    <article
      className="flex items-start gap-3 py-4"
      style={{ borderBottom: "1px solid var(--border-secondary)" }}
    >
      <span
        role="img"
        aria-label={statusLabel}
        title={statusLabel}
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{
          background: notification.isRead
            ? "var(--text-muted)"
            : "var(--primary-500)",
          boxShadow: notification.isRead
            ? "none"
            : "0 0 6px var(--primary-500)",
        }}
      />
      <span
        aria-hidden="true"
        className="w-5 shrink-0 flex items-center justify-center text-[var(--primary-400)] mt-0.5"
      >
        <FiFileText style={{ width: 16, height: 16 }} />
      </span>

      <div className="min-w-0 flex-1">
        <h2
          className="mb-1 text-[13px] text-[var(--text-primary)]"
          style={{
            fontWeight: notification.isRead ? 400 : 600,
            fontFamily: "var(--font-body)",
            letterSpacing: "normal",
          }}
        >
          {notification.title}
        </h2>
        {/* Read items are dimmed via colour, not opacity, so text keeps readable contrast */}
        <p
          className={`m-0 break-words text-[13px] leading-relaxed ${
            notification.isRead
              ? "text-[var(--text-tertiary)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          {notification.message}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-[var(--text-muted)]">
          {createdAt ? (
            <time dateTime={createdAt.toISOString()}>
              {timeAgo(createdAt)}
            </time>
          ) : (
            <span>Just now</span>
          )}
          {notification.relatedPostId && (
            <Link
              href="/feed"
              className="font-medium text-[var(--primary-400)] hover:underline"
              onClick={() => {
                if (!notification.isRead) onMarkRead(notification.id);
              }}
            >
              Open Global Feed
            </Link>
          )}
          {!notification.isRead && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              disabled={isMarkingRead}
              className="font-medium text-[var(--primary-400)] hover:underline disabled:cursor-wait disabled:opacity-60"
              aria-label={`Mark "${notification.title}" as read`}
            >
              {isMarkingRead ? "Marking read…" : "Mark as read"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function NotificationSkeleton() {
  return (
    <div role="status" className="px-4 sm:px-5">
      <span className="sr-only">Loading notifications…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-start gap-3 py-4"
          style={{ borderBottom: "1px solid var(--border-secondary)" }}
        >
          <div className="skeleton mt-1.5 h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="skeleton mb-2 h-3.5 w-2/5" />
            <div className="skeleton mb-2 h-3 w-4/5" />
            <div className="skeleton h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const { user, loading: authLoading, loginWithGoogle } = useAuth();
  const uid = user?.uid ?? null;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [subscriptionState, setSubscriptionState] = useState<{
    key: string;
    status: "ready" | "error";
  } | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  // Synchronous guard: state updates are async, so rapid double-clicks (or the
  // "Open Global Feed" link + button) could otherwise fire duplicate writes.
  const inFlightRef = useRef<Set<string>>(new Set());
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!uid) return;
    let active = true;
    const key = `${uid}:${retryCount}`;

    const unsubscribe = subscribeToNotifications(
      uid,
      (data) => {
        if (!active) return;
        setNotifications(data);
        setSubscriptionState({ key, status: "ready" });
      },
      (error) => {
        if (!active) return;
        console.error("[NotificationsPage] Subscription failed:", error);
        setSubscriptionState({ key, status: "error" });
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid, retryCount]);

  // Keep "5 minutes ago" labels fresh.
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), TIME_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const subscriptionKey = uid ? `${uid}:${retryCount}` : null;
  const subscriptionStatus =
    subscriptionKey && subscriptionState?.key === subscriptionKey
      ? subscriptionState.status
      : null;

  const signedOut = !authLoading && !uid;
  const loading = authLoading || Boolean(uid && subscriptionStatus === null);
  const listenerError = subscriptionStatus === "error";

  // Never show another account's data: after logout / account switch the state
  // still holds the previous user's list until a new snapshot arrives.
  const visibleNotifications =
    subscriptionStatus === "ready" ? notifications : [];

  const unreadCount = visibleNotifications.filter((n) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    if (inFlightRef.current.has(id)) return;
    inFlightRef.current.add(id);
    setMarkingReadIds((current) => new Set(current).add(id));
    try {
      await markNotificationRead(id);
    } catch (error) {
      console.error("[NotificationsPage] markNotificationRead failed:", error);
      toast.error("Failed to mark notification as read", {
        id: `mark-read-${id}`,
      });
    } finally {
      inFlightRef.current.delete(id);
      setMarkingReadIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const handleMarkAll = async () => {
    if (!uid || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(uid);
      toast.success("All notifications marked as read");
    } catch (error) {
      console.error("[NotificationsPage] markAllNotificationsRead failed:", error);
      toast.error("Failed to update notifications");
    } finally {
      setMarkingAll(false);
    }
  };

  const retrySubscription = () => setRetryCount((count) => count + 1);

  const statusText = signedOut
    ? "Sign in to view your notifications."
    : loading
      ? "Loading notifications…"
      : listenerError
        ? "Notifications could not be loaded."
        : unreadCount > 0
          ? `${unreadCount} unread in your latest ${NOTIFICATION_LIMIT} notifications`
          : `No unread in your latest ${NOTIFICATION_LIMIT} notifications`;

  let body: ReactNode;
  if (signedOut) {
    body = (
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
          Sign in to see updates from the societies you follow.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm inline-flex"
          onClick={() => loginWithGoogle().catch(() => {})}
        >
          Sign in
        </button>
      </div>
    );
  } else if (loading) {
    body = <NotificationSkeleton />;
  } else if (listenerError) {
    body = (
      <div role="alert" className="p-10 text-center">
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          We couldn’t load your notifications. Please try again.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={retrySubscription}
        >
          Try again
        </button>
      </div>
    );
  } else if (visibleNotifications.length === 0) {
    body = (
      <div className="p-10 text-center sm:p-14">
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-input)] flex items-center justify-center text-[var(--text-tertiary)]">
            <FiBell className="w-6 h-6" />
          </div>
        </div>
        <h2 className="mb-1 text-[15px] font-semibold text-[var(--text-secondary)]">
          No notifications yet
        </h2>
        <p className="mx-auto mb-4 max-w-md text-[13px] text-[var(--text-tertiary)]">
          Follow societies in the Global Feed to hear when they share a new
          post.
        </p>
        <Link
          href="/feed"
          className="btn btn-primary btn-sm inline-flex items-center gap-1.5"
        >
          <FiGlobe className="w-3.5 h-3.5" /> Go to Global Feed
        </Link>
      </div>
    );
  } else {
    body = (
      <div className="px-4 sm:px-5">
        {visibleNotifications.map((notification) => (
          <NotificationRow
            key={notification.id}
            notification={notification}
            isMarkingRead={markingReadIds.has(notification.id)}
            onMarkRead={(id) => void handleMarkRead(id)}
          />
        ))}
      </div>
    );
  }

  return (
    <main
      style={{ padding: "var(--page-padding-y) var(--page-padding-x)" }}
      aria-labelledby="notifications-heading"
    >
      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1
            id="notifications-heading"
            className="mb-1 text-[22px] font-extrabold flex items-center gap-2"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <FiBell className="w-6 h-6 text-[var(--primary-400)]" /> Notifications
          </h1>
          <p
            className="m-0 text-[13px] text-[var(--text-tertiary)]"
            aria-live="polite"
          >
            {statusText}
          </p>
        </div>
        {!loading && !listenerError && !signedOut && unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-outline btn-sm shrink-0"
            onClick={handleMarkAll}
            disabled={markingAll}
            title="Marks all of your notifications as read, including ones older than the 30 shown here"
          >
            {markingAll ? "Updating…" : "Mark all read"}
          </button>
        )}
      </header>

      <section
        aria-label="Notifications"
        aria-busy={loading}
        className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-primary)] bg-[var(--bg-card)]"
      >
        {body}
      </section>
    </main>
  );
}