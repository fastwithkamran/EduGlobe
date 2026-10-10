"use client";

import Image from "next/image";
import { FiPaperclip, FiX } from "react-icons/fi";

export function AttachmentPreview({
  file,
  previewUrl,
  onRemove,
  disabled,
}: {
  file: File;
  previewUrl?: string;
  onRemove: () => void;
  disabled: boolean;
}) {
  const isImage = file.type.startsWith("image/");

  return (
    <div
      style={{
        position: "relative",
        width: isImage ? 112 : undefined,
        height: isImage ? 84 : undefined,
        minWidth: isImage ? 112 : 0,
        border: "1px solid var(--border-primary)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--bg-tertiary)",
      }}
    >
      {isImage && previewUrl ? (
        // FIX: previewUrl is a local blob: URL created by URL.createObjectURL,
        // so it must not go through sanitizeImageUrl (which targets remote
        // URLs and can swap blob: URLs for a fallback, breaking the preview).
        <Image
          src={previewUrl}
          alt={`${file.name} preview`}
          fill
          unoptimized
          sizes="112px"
          style={{ objectFit: "cover" }}
        />
      ) : (
        <span
          title={file.name}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            maxWidth: 220,
            padding: "10px 36px 10px 10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--text-secondary)",
            fontSize: 11,
          }}
        >
          <FiPaperclip style={{ width: 12, height: 12, flexShrink: 0 }} /> {file.name}
        </span>
      )}
      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        title={`Remove ${file.name}`}
        disabled={disabled}
        onClick={onRemove}
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          zIndex: 1,
          width: 26,
          height: 26,
          display: "grid",
          placeItems: "center",
          border: 0,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.75)",
          color: "#fff",
          fontSize: 16,
          lineHeight: 1,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <FiX style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}