"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { createPost, uploadFile } from "@/lib/firestore";
import {
  POST_TYPE_OPTIONS,
  TYPE_COLORS,
  TYPE_TEXTS,
  OPPORTUNITY_TYPES,
} from "@/lib/postHelpers";
import type {
  PostAttachment,
  PostType,
  OpportunityMeta,
  Society,
} from "@/types";

const MAX_CHARS = 500;

export function PostComposer({
  society,
  authorId,
  authorName,
}: {
  society: Society;
  authorId: string;
  authorName: string;
}) {
  const [content, setContent] = useState("");
  const [type, setType] = useState<PostType>("announcement");
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<OpportunityMeta>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const isOpportunity = OPPORTUNITY_TYPES.includes(type);
  const selectedLabel =
    POST_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

  const publish = async () => {
    if (!content.trim()) return toast.error("Post content is required");
    if (content.length > MAX_CHARS)
      return toast.error(`Post exceeds ${MAX_CHARS} character limit`);
    setUploading(true);
    try {
      const attachments: PostAttachment[] = [];
      for (const f of files) {
        const url = await uploadFile(
          f,
          `posts/${society.id}/${Date.now()}_${f.name}`,
          (p) => setProgress(p),
        );
        attachments.push({
          id: `${Date.now()}`,
          fileName: f.name,
          fileURL: url,
          fileType: f.type,
          fileSize: f.size,
        });
      }

      // Only include meta fields that have values
      const opportunityMeta: OpportunityMeta | undefined = isOpportunity
        ? Object.fromEntries(
            Object.entries(meta).filter(([, v]) => v && String(v).trim()),
          )
        : undefined;

      await createPost({
        societyId: society.id,
        societyName: society.name,
        societyLogoURL: society.logoURL || null,
        authorId,
        authorName,
        content: content.trim(),
        type,
        visibility: "public",
        attachments,
        ...(opportunityMeta && Object.keys(opportunityMeta).length
          ? { opportunityMeta }
          : {}),
      });

      toast.success("Post published!");
      setContent("");
      setFiles([]);
      setProgress(0);
      setMeta({});
    } catch {
      toast.error("Failed to publish post");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-primary)",
        borderRadius: "var(--radius-xl)",
        padding: 18,
        marginBottom: 20,
      }}
    >
      {/* Content textarea */}
      <textarea
        className="input w-full resize-y"
        rows={3}
        placeholder={`Share something with ${society.name}…`}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ marginBottom: 4 }}
      />
      {/* Character counter */}
      <div
        style={{
          textAlign: "right",
          fontSize: 11,
          marginBottom: 10,
          color:
            content.length > MAX_CHARS
              ? "#ef4444"
              : content.length > MAX_CHARS * 0.8
                ? "#f59e0b"
                : "var(--text-muted)",
        }}
      >
        {content.length} / {MAX_CHARS}
      </div>

      {/* Post type selector */}
      <div className="mb-3">
        <div className="text-[11px] text-[var(--text-muted)] mb-1.5">
          Post Type
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POST_TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setType(o.value);
                setMeta({});
              }}
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 12,
                cursor: "pointer",
                border: "1px solid",
                borderColor:
                  type === o.value
                    ? TYPE_TEXTS[o.value]
                    : "var(--border-primary)",
                background:
                  type === o.value ? TYPE_COLORS[o.value] : "transparent",
                color:
                  type === o.value
                    ? TYPE_TEXTS[o.value]
                    : "var(--text-tertiary)",
                fontWeight: type === o.value ? 600 : 400,
                transition: "all .15s",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity Meta */}
      {isOpportunity && (
        <div
          style={{
            background: `${TYPE_COLORS[type]}`,
            borderRadius: 10,
            border: `1px solid ${TYPE_TEXTS[type]}33`,
            padding: "12px 14px",
            marginBottom: 14,
            marginTop: 5,
          }}
        >
          <div
            className="text-[11px] font-semibold mb-2.5"
            style={{ color: TYPE_TEXTS[type] }}
          >
            {selectedLabel} Details{" "}
            <span className="font-normal opacity-70">
              — optional but recommended
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                ⏰ Deadline
              </label>
              <input
                type="date"
                className="input w-full"
                style={{ fontSize: 12 }}
                value={meta.deadline ?? ""}
                onChange={(e) =>
                  setMeta((p) => ({ ...p, deadline: e.target.value }))
                }
              />
            </div>
            {type === "hackathon" && (
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  🏆 Prize / Reward
                </label>
                <input
                  className="input w-full"
                  placeholder="PKR 2.5M, USD 10K…"
                  style={{ fontSize: 12 }}
                  value={meta.prize ?? ""}
                  onChange={(e) =>
                    setMeta((p) => ({ ...p, prize: e.target.value }))
                  }
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                📍 Location
              </label>
              <input
                className="input w-full"
                placeholder="Online / Karachi / Remote"
                style={{ fontSize: 12 }}
                value={meta.location ?? ""}
                onChange={(e) =>
                  setMeta((p) => ({ ...p, location: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                🏛 Organizer
              </label>
              <input
                className="input w-full"
                placeholder="Google, LUMS, HEC…"
                style={{ fontSize: 12 }}
                value={meta.organizer ?? ""}
                onChange={(e) =>
                  setMeta((p) => ({ ...p, organizer: e.target.value }))
                }
              />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                🔗 Apply Link
              </label>
              <input
                type="url"
                className="input w-full"
                placeholder="https://..."
                style={{ fontSize: 12 }}
                value={meta.applyLink ?? ""}
                onChange={(e) =>
                  setMeta((p) => ({ ...p, applyLink: e.target.value }))
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Attach + Publish row */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            background: "none",
            border: "1px dashed var(--border-primary)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "var(--text-tertiary)",
            cursor: "pointer",
          }}
        >
          📎 Attach file / image
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) setFiles(Array.from(e.target.files));
          }}
        />
        {files.length > 0 && (
          <div
            className="text-[12px] flex-1 min-w-0"
            style={{ color: "var(--primary-400)" }}
          >
            <span className="truncate">
              {files.map((f) => f.name).join(", ")}
            </span>
            <button
              onClick={() => setFiles([])}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                fontSize: 14,
                cursor: "pointer",
                marginLeft: 6,
              }}
            >
              ×
            </button>
          </div>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={publish}
          disabled={uploading || !content.trim() || content.length > MAX_CHARS}
          style={{ marginLeft: "auto" }}
        >
          {uploading ? `${Math.round(progress)}%` : "📤 Publish"}
        </button>
      </div>

      {/* Upload progress bar */}
      {uploading && (
        <div
          style={{
            height: 3,
            background: "var(--bg-tertiary)",
            borderRadius: 999,
            overflow: "hidden",
            marginTop: 10,
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "var(--gradient-primary)",
              transition: "width .3s",
            }}
          />
        </div>
      )}
    </div>
  );
}
