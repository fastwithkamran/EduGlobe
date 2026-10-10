"use client";

import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiKey, FiTrash2 } from "react-icons/fi";

export function DeleteAccountModal({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);
  const ready = confirmText === "DELETE";

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    confirmInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loading) {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "input:not([disabled]), button:not([disabled])",
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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        aria-describedby="delete-account-description"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 18,
          padding: "28px 24px",
          width: 420,
          maxWidth: "100%",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
            border: "2px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <FiAlertTriangle style={{ width: 24, height: 24, color: "#ef4444" }} />
        </div>
        <h2
          id="delete-account-title"
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: 18,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 8,
            color: "var(--text-primary)",
          }}
        >
          Delete Your Account?
        </h2>
        <p
          id="delete-account-description"
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.65,
            marginBottom: 20,
          }}
        >
          This permanently erases your profile, follows, and notifications.
          <br />
          <strong style={{ color: "#ef4444" }}>This cannot be undone.</strong>
        </p>

        <div
          style={{
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <FiKey style={{ width: 16, height: 16, color: "#3b82f6", flexShrink: 0 }} />
          <span>A Google sign-in popup will appear to verify your identity before deletion.</span>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="delete-account-confirm"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
              marginBottom: 5,
            }}
          >
            Type <strong style={{ color: "#ef4444" }}>DELETE</strong> to confirm
          </label>
          <input
            ref={confirmInputRef}
            id="delete-account-confirm"
            className="input"
            placeholder="DELETE"
            autoComplete="off"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            style={{ width: "100%", fontFamily: "monospace", letterSpacing: 2 }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || loading}
            onClick={onConfirm}
            style={{
              padding: "9px 20px",
              borderRadius: "var(--radius-lg)",
              border: "none",
              background:
                ready && !loading
                  ? "linear-gradient(135deg,#ef4444,#dc2626)"
                  : "rgba(239,68,68,0.3)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 13,
              cursor: ready && !loading ? "pointer" : "not-allowed",
              fontFamily: "var(--font-body)",
              transition: "all .15s",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {loading ? (
              "Deleting…"
            ) : (
              <>
                <FiTrash2 style={{ width: 14, height: 14 }} /> Delete My Account
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
