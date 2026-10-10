"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  isValidOpportunityLink,
  OpportunityMetaFields,
  normalizeOpportunityMeta,
} from "@/components/OpportunityMetaFields";
import { AttachmentPreview } from "./AttachmentPreview";
import {
  FiPaperclip,
  FiSend,
  FiCalendar,
  FiCode,
  FiBriefcase,
} from "react-icons/fi";
import { HiOutlineAcademicCap, HiOutlineMegaphone } from "react-icons/hi2";

const TYPE_ICONS: Record<
  PostType,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  announcement: HiOutlineMegaphone,
  event: FiCalendar,
  hackathon: FiCode,
  scholarship: HiOutlineAcademicCap,
  internship: FiBriefcase,
};

const MAX_CHARS = 500;
const MAX_POST_IMAGES = 2;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_DOC_SIZE = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const isImageFile = (file: File) => file.type.startsWith("image/");

/** Storage-safe file name: no slashes, spaces or odd characters. */
const safeFileName = (name: string) =>
  name
    .replace(/[^\w.-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(-100) || "file";

type PendingFile = { file: File; previewUrl?: string };

/**
 * Rich post creation form for society admins supporting text, file attachments, and opportunity metadata.
 */
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
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [meta, setMeta] = useState<OpportunityMeta>({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Map<File, string>());
  // Synchronous guard: state updates are async, so a fast double-click could
  // otherwise publish the same post twice.
  const publishingRef = useRef(false);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const clearFiles = () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    setFiles([]);
  };

  const trimmedLength = content.trim().length;
  const isOpportunity = OPPORTUNITY_TYPES.includes(type);
  const selectedLabel =
    POST_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;

  const handleFilesSelected = (selected: File[]) => {
    let imageCount = files.filter(({ file }) => isImageFile(file)).length;
    let total = files.length;
    const accepted: PendingFile[] = [];
    let tooBig = false;
    let tooManyImages = false;
    let tooMany = false;

    for (const file of selected) {
      const image = isImageFile(file);
      if (file.size > (image ? MAX_IMAGE_SIZE : MAX_DOC_SIZE)) {
        tooBig = true;
        continue;
      }
      if (total >= MAX_ATTACHMENTS) {
        tooMany = true;
        continue;
      }
      if (image && imageCount >= MAX_POST_IMAGES) {
        tooManyImages = true;
        continue;
      }
      total += 1;
      if (image) {
        imageCount += 1;
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.set(file, previewUrl);
        accepted.push({ file, previewUrl });
      } else {
        accepted.push({ file });
      }
    }

    if (tooBig) toast.error("Images must be 5 MB or smaller, files 10 MB");
    if (tooManyImages)
      toast.error(`Posts can include up to ${MAX_POST_IMAGES} images`);
    if (tooMany)
      toast.error(`Posts can include up to ${MAX_ATTACHMENTS} attachments`);
    if (accepted.length) setFiles((current) => [...current, ...accepted]);
  };

  const publish = async () => {
    if (publishingRef.current) return;
    if (!trimmedLength) return toast.error("Post content is required");
    if (trimmedLength > MAX_CHARS)
      return toast.error(`Post exceeds ${MAX_CHARS} character limit`);
    if (isOpportunity && !isValidOpportunityLink(meta.applyLink))
      return toast.error("Enter a valid http or https application link");

    publishingRef.current = true;
    setUploading(true);
    setProgress(0);
    try {
      const attachments: PostAttachment[] = [];
      const totalBytes =
        files.reduce((sum, { file }) => sum + file.size, 0) || 1;
      let doneBytes = 0;

      for (const [index, { file: f }] of files.entries()) {
        const url = await uploadFile(
          f,
          `posts/${society.id}/${Date.now()}_${index}_${safeFileName(f.name)}`,
          (p) =>
            setProgress(((doneBytes + (p / 100) * f.size) / totalBytes) * 100),
        );
        doneBytes += f.size;
        attachments.push({
          id: `${Date.now()}-${index}`,
          fileName: f.name,
          fileURL: url,
          fileType: f.type,
          fileSize: f.size,
        });
      }

      const opportunityMeta = isOpportunity
        ? normalizeOpportunityMeta(meta)
        : undefined;

      await createPost({
        societyId: society.id,
        societyName: society.name,
        societyLogoURL: society.logoURL || null,
        authorId,
        authorName,
        content: content.trim(),
        type,
        attachments,
        ...(opportunityMeta && Object.keys(opportunityMeta).length
          ? { opportunityMeta }
          : {}),
      });

      toast.success("Post published");
      setContent("");
      clearFiles();
      setProgress(0);
      setMeta({});
      if (fileRef.current) fileRef.current.value = "";
    } catch (error) {
      console.error("[PostComposer] Failed to publish post:", error);
      toast.error(
        "Couldn’t publish your post. Your draft is still here, so try again.",
      );
    } finally {
      publishingRef.current = false;
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
      <textarea
        className="input w-full resize-y"
        rows={3}
        aria-label="Post content"
        placeholder={`Share something with the students…`}
        value={content}
        disabled={uploading}
        onChange={(e) => setContent(e.target.value)}
        style={{ marginBottom: 4 }}
      />
      <div
        aria-live="polite"
        style={{
          textAlign: "right",
          fontSize: 11,
          marginBottom: 10,
          color:
            trimmedLength > MAX_CHARS
              ? "#ef4444"
              : trimmedLength > MAX_CHARS * 0.8
                ? "#f59e0b"
                : "var(--text-muted)",
        }}
      >
        {trimmedLength} / {MAX_CHARS}
      </div>

      <div className="mb-3">
        <div className="text-[11px] text-[var(--text-muted)] mb-1.5">
          Post type
        </div>
        <div className="flex flex-wrap gap-1.5">
          {POST_TYPE_OPTIONS.map((o) => {
            const Icon = TYPE_ICONS[o.value];
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={type === o.value}
                disabled={uploading}
                onClick={() => {
                  if (type === o.value) return;
                  setType(o.value);
                  setMeta({});
                }}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: uploading ? "not-allowed" : "pointer",
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
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Icon style={{ width: 12, height: 12 }} />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

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
            {selectedLabel} details{" "}
            <span className="font-normal opacity-70">
              (optional but recommended)
            </span>
          </div>
          <OpportunityMetaFields
            type={type}
            value={meta}
            onChange={setMeta}
            disabled={uploading}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          style={{
            background: "none",
            border: "1px dashed var(--border-primary)",
            borderRadius: 8,
            padding: "6px 12px",
            fontSize: 12,
            color: "var(--text-tertiary)",
            cursor: uploading ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <FiPaperclip style={{ width: 13, height: 13 }} /> Attach file or image
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,.pdf,.doc,.docx,.ppt,.pptx"
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <span className="text-[11px] text-[var(--text-muted)]">
          Up to 2 images (5 MB each), 5 attachments total
        </span>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={publish}
          disabled={uploading || !trimmedLength || trimmedLength > MAX_CHARS}
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {uploading ? (
            `Publishing ${Math.round(progress)}%`
          ) : (
            <>
              <FiSend style={{ width: 13, height: 13 }} /> Publish
            </>
          )}
        </button>
      </div>

      {files.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map(({ file, previewUrl }, index) => (
            <AttachmentPreview
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              file={file}
              previewUrl={previewUrl}
              disabled={uploading}
              onRemove={() => {
                const url = previewUrls.current.get(file);
                if (url) URL.revokeObjectURL(url);
                previewUrls.current.delete(file);
                setFiles((current) => current.filter((_, i) => i !== index));
              }}
            />
          ))}
        </div>
      )}

      {uploading && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
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
