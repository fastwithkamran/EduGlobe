"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import toast from "react-hot-toast";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

export function ImageUploadField({
  id,
  label,
  icon,
  file,
  disabled,
  onFileChange,
}: {
  id: string;
  label: string;
  icon: string;
  file: File | null;
  disabled: boolean;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const isDragging = dragging && !disabled;

  // Derive preview URL synchronously from file prop to avoid cascading effect renders.
  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  // Clean up object URL when file changes or component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const acceptFile = (selectedFile: File | undefined | null) => {
    if (!selectedFile) return;
    if (!ACCEPTED_IMAGE_TYPES.has(selectedFile.type)) {
      toast.error("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (selectedFile.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be 5 MB or smaller.");
      return;
    }
    onFileChange(selectedFile);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file
    acceptFile(selectedFile);
  };

  const handleDrop = (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    acceptFile(event.dataTransfer.files?.[0]);
  };

  return (
    <div>
      <label style={fieldLabel} htmlFor={id}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <button
          id={id}
          type="button"
          className="dropzone"
          data-dragging={isDragging}
          aria-describedby={`${id}-help`}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            if (disabled) return;
            event.dataTransfer.dropEffect = "copy";
            setDragging(true);
          }}
          onDragLeave={(event) => {
            // FIX: dragleave also fires when the cursor moves onto a child
            // (the preview <img>), so the highlight flickered. Only clear it
            // when the pointer actually leaves the dropzone.
            if (
              event.relatedTarget instanceof Node &&
              event.currentTarget.contains(event.relatedTarget)
            )
              return;
            setDragging(false);
          }}
          onDrop={handleDrop}
        >
          {previewUrl ? (
            // blob: URLs are generated locally and are safe; running them
            // through sanitizeImageUrl could strip them and blank the preview.
            <Image
              src={previewUrl}
              alt={`${label} preview`}
              width={400}
              height={140}
              unoptimized
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ textAlign: "center", fontSize: 12 }}>
              <span
                aria-hidden="true"
                style={{ display: "block", fontSize: 24, marginBottom: 4 }}
              >
                {icon}
              </span>
              Choose or drop an image
            </span>
          )}
        </button>

        {file && !disabled && (
          <button
            type="button"
            className="btn btn-sm"
            aria-label={`Remove ${label}`}
            onClick={() => onFileChange(null)}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "4px 10px",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
            }}
          >
            ✕ Remove
          </button>
        )}

        {/* Visually hidden, removed from tab order: the button above is the
            single keyboard-accessible control. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          onChange={handleInputChange}
        />
      </div>
      <p
        id={`${id}-help`}
        style={{ marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}
      >
        JPG, PNG, or WebP; up to 5 MB{file ? ` — ${file.name}` : ""}
      </p>
    </div>
  );
}