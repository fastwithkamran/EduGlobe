"use client";

import { useEffect, useRef } from "react";
import type { Society } from "@/types";
import { FiAlertTriangle, FiTrash2, FiLoader } from "react-icons/fi";

export function ConfirmDeleteModal({
  society,
  onConfirm,
  onCancel,
  loading,
}: {
  society: Society;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [loading, onCancel]);

  return (
    <div
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-society-title"
        aria-describedby="delete-society-description"
        className="w-full max-w-[460px] rounded-2xl border border-red-500/30 bg-[var(--bg-secondary)] p-6 shadow-2xl sm:p-8"
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border-2 border-red-500/35 bg-red-500/10 text-2xl text-red-500"
        >
          <FiAlertTriangle />
        </div>
        <h2
          id="delete-society-title"
          className="mb-2 text-center text-xl font-extrabold text-[var(--text-primary)]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Delete Society?
        </h2>
        <p
          id="delete-society-description"
          className="mb-4 text-center text-sm leading-relaxed text-[var(--text-secondary)]"
        >
          Permanently delete{" "}
          <strong className="text-[var(--text-primary)]">{society.name}</strong>
          ?
        </p>

        <div className="mb-5 rounded-xl border border-red-500/15 bg-red-500/[0.06] p-3.5">
          <p className="mb-2 text-xs font-semibold text-red-500">
            This action removes:
          </p>
          <ul className="m-0 list-inside list-disc space-y-1 text-xs text-[var(--text-secondary)]">
            <li>The society profile</li>
            <li>Top-level posts and follow records</li>
            <li>Society logo and banner where Cloudinary cleanup succeeds</li>
          </ul>
          <p className="mb-0 mt-3 text-xs leading-relaxed text-[var(--text-tertiary)]">
            Nested post comments and attachment files are not deleted by the
            current cleanup process.
          </p>
        </div>

        <p className="mb-5 text-center text-xs text-[var(--text-muted)]">
          This action <strong className="text-red-500">cannot be undone</strong>
          .
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <button
            ref={cancelButtonRef}
            type="button"
            className="btn btn-outline min-w-24"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex min-w-40 items-center justify-center gap-1.5 rounded-lg border-0 bg-gradient-to-br from-red-500 to-red-700 px-5 py-2.5 text-[13px] font-bold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? (
              <>
                <FiLoader className="animate-spin text-sm" /> Deleting…
              </>
            ) : (
              <>
                <FiTrash2 className="text-sm" /> Delete Society
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
