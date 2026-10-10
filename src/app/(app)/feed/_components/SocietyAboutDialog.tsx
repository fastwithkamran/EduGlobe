"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AboutTab } from "../../my-society/_components/AboutTab";
import { getSociety } from "@/lib/firestore";
import type { Society } from "@/types";
import { FiX } from "react-icons/fi";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function SocietyAboutDialog({
  societyId,
  onClose,
}: {
  societyId: string;
  onClose: () => void;
}) {
  const [society, setSociety] = useState<Society | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // ── Load society ──────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    getSociety(societyId)
      .then((result) => {
        if (!active) return;
        setSociety(result);
        // FIX: a null result means "deleted / not found", not a load failure.
        // Previously `setError(!result)` made the "no longer available"
        // message unreachable.
        setError(false);
      })
      .catch((fetchError: unknown) => {
        console.error(
          "[SocietyAboutDialog] Failed to load society:",
          fetchError,
        );
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [societyId, retryCount]);

  // ── Focus management + scroll lock (runs once on mount) ───────────────────
  // FIX: this used to depend on [onClose]. The parent passes an inline arrow
  // function, so every parent re-render (e.g. any live feed update) re-ran the
  // effect and stole focus back to the close button.
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    closeButtonRef.current?.focus();

    // Prevent the feed behind the dialog from scrolling
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  // ── Keyboard: Escape + focus trap ─────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable =
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      const outside = !dialogRef.current?.contains(current);

      if (event.shiftKey && (current === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (current === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const dialog = (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="society-dialog-title"
        aria-busy={loading}
        ref={dialogRef}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border-primary)] px-5 py-4">
          <h2
            id="society-dialog-title"
            className="m-0 min-w-0 truncate text-base font-bold text-[var(--text-primary)]"
          >
            {society?.name ?? "Society information"}
          </h2>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close society information"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--border-primary)] text-lg text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
          >
            <FiX className="w-5 h-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              className="py-12 text-center text-sm text-[var(--text-tertiary)]"
            >
              Loading society information…
            </div>
          ) : society ? (
            <AboutTab society={society} />
          ) : (
            <div className="py-10 text-center" role={error ? "alert" : undefined}>
              <p className="mb-4 text-sm text-[var(--text-secondary)]">
                {error
                  ? "Could not load this society’s information."
                  : "This society is no longer available."}
              </p>
              {error && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setLoading(true);
                    setError(false);
                    setSociety(null);
                    setRetryCount((count) => count + 1);
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );

  // Portal to <body> so no ancestor (transform, overflow, z-index stacking)
  // can clip or mis-layer the overlay.
  return createPortal(dialog, document.body);
}