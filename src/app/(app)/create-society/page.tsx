"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createSociety, uploadFile } from "@/lib/firestore";
import { normalizeHttpUrl } from "@/lib/url";
import type { CommunityLinks } from "@/types";
import Loader from "@/components/Loader";
import { ImageUploadField } from "./_components/ImageUploadField";
import {
  BasicInformationFields,
  CommunityLinkFields,
  ContactFields,
  Section,
  fieldId,
  type BasicField,
  type ContactField,
  type FormErrors,
  type SocietyFormValues,
} from "./_components/SocietyFormSections";

const initialForm: SocietyFormValues = {
  name: "",
  organization: "",
  city: "",
  country: "",
  description: "",
  website: "",
  contactEmail: "",
  communityLinks: {
    discord: "",
    whatsapp: "",
    linkedin: "",
    twitter: "",
    instagram: "",
  },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeFileName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);

const makeUploadId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const pageStyle: React.CSSProperties = {
  padding: "var(--page-padding-y) var(--page-padding-x)",
  maxWidth: 700,
  width: "100%",
  margin: "0 auto",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 22,
  fontWeight: 800,
};

export default function CreateSocietyPage() {
  const router = useRouter();
  const {
    user,
    userProfile,
    loading,
    profileError,
    refreshUserProfile,
    loginWithGoogle,
  } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // State updates are async, so two fast clicks could both pass `saving`.
  // A ref blocks the second submit synchronously (prevents duplicate societies).
  const submittingRef = useRef(false);

  useEffect(() => {
    if (userProfile?.societyId) router.replace("/my-society");
  }, [router, userProfile?.societyId]);

  // FIX: closing/reloading the tab mid-upload silently abandoned the upload.
  useEffect(() => {
    if (!saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);

  const clearError = (key: string) =>
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );

  const updateField = (field: BasicField | ContactField, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    clearError(field);
  };

  const updateCommunityLink = (key: keyof CommunityLinks, value: string) => {
    setForm((current) => ({
      ...current,
      communityLinks: { ...current.communityLinks, [key]: value },
    }));
    clearError(`community.${key}`);
  };

  const validate = () => {
    const next: FormErrors = {};
    const name = form.name.trim();
    const description = form.description.trim();

    if (!name) next.name = "Society name is required.";
    else if (name.length < 3) next.name = "Use at least 3 characters.";
    if (!form.city.trim()) next.city = "City is required.";
    if (!form.country.trim()) next.country = "Country is required.";
    if (!description) next.description = "Description is required.";
    else if (description.length < 20)
      next.description = "Tell people a little more (at least 20 characters).";

    if (form.website.trim() && normalizeHttpUrl(form.website) === null)
      next.website = "Enter a valid http(s) link, e.g. https://yoursociety.com";
    if (form.contactEmail.trim() && !EMAIL_PATTERN.test(form.contactEmail.trim()))
      next.contactEmail = "Enter a valid email address.";

    for (const [key, value] of Object.entries(form.communityLinks)) {
      if (value.trim() && normalizeHttpUrl(value) === null)
        next[`community.${key}`] = "Enter a valid http(s) link.";
    }
    return next;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    if (!user || !userProfile) {
      toast.error("You must be signed in");
      return;
    }

    const nextErrors = validate();
    setErrors(nextErrors);
    const firstInvalid = Object.keys(nextErrors).find((k) => nextErrors[k]);
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      toast.error("Please fix the highlighted fields.");
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setUploadProgress(0);

    try {
      let logoURL = "";
      let bannerURL = "";
      const uploadFolderId = `temp_${makeUploadId()}`;

      // Upload both images in parallel; overall progress is the average.
      const pending = [logoFile, bannerFile].filter(Boolean).length;
      if (pending > 0) {
        setUploadProgress(10);
        const done = { logo: 0, banner: 0 };
        const report = () =>
          // Math.max: progress callbacks can arrive out of order
          setUploadProgress((prev) =>
            Math.max(prev, 10 + ((done.logo + done.banner) / pending) * 0.8),
          );

        [logoURL, bannerURL] = await Promise.all([
          logoFile
            ? uploadFile(
                logoFile,
                `societies/${uploadFolderId}/logo_${safeFileName(logoFile.name)}`,
                (progress) => {
                  done.logo = progress;
                  report();
                },
              )
            : Promise.resolve(""),
          bannerFile
            ? uploadFile(
                bannerFile,
                `societies/${uploadFolderId}/banner_${safeFileName(bannerFile.name)}`,
                (progress) => {
                  done.banner = progress;
                  report();
                },
              )
            : Promise.resolve(""),
        ]);
      }
      setUploadProgress(90);

      const communityLinks = Object.fromEntries(
        Object.entries(form.communityLinks)
          .map(([key, value]) => [key, normalizeHttpUrl(value) ?? ""])
          .filter(([, value]) => value),
      ) as CommunityLinks;

      await createSociety(
        {
          name: form.name.trim(),
          organization: form.organization.trim(),
          city: form.city.trim(),
          country: form.country.trim(),
          description: form.description.trim(),
          website: normalizeHttpUrl(form.website) ?? "",
          contactEmail: form.contactEmail.trim() || user.email || "",
          communityLinks:
            Object.keys(communityLinks).length > 0 ? communityLinks : undefined,
          logoURL,
          bannerURL,
        },
        {
          uid: user.uid,
          displayName: userProfile.displayName,
          email: user.email ?? "",
          photoURL: userProfile.photoURL,
        },
      );
    } catch (error) {
      console.error("[CreateSocietyPage] Failed to create society:", error);
      toast.error("Failed to create society. Please try again.");
      submittingRef.current = false;
      setSaving(false);
      setUploadProgress(0);
      return;
    }

    // The society now EXISTS. A failure refreshing the profile must not be
    // reported as "failed to create" -- the user would retry and create a
    // duplicate. Keep `saving` true so the form stays locked while we leave.
    setUploadProgress(100);
    try {
      await refreshUserProfile();
    } catch (error) {
      console.error("[CreateSocietyPage] Profile refresh failed:", error);
    }
    toast.success(`🎉 "${form.name.trim()}" is live!`);
    router.replace("/my-society");
  };

  const handleCancel = () => {
    if (window.history.length > 1) router.back();
    else router.push("/feed");
  };

  const handleSignIn = () => {
    loginWithGoogle().catch((error: unknown) => {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code: unknown }).code)
          : "";
      if (code.includes("popup-closed") || code.includes("cancelled")) return;
      console.error("[CreateSocietyPage] Sign-in failed:", error);
      toast.error("Unable to sign in. Please try again.");
    });
  };

  if (loading || userProfile?.societyId) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        <Loader />
      </div>
    );
  }

  // Guests used to see the whole form and only learn on submit that they
  // needed to sign in (after typing everything).
  if (!user) {
    return (
      <div style={pageStyle}>
        <h1 style={{ ...titleStyle, marginBottom: 8 }}>Create a Society</h1>
        <p
          style={{
            color: "var(--text-tertiary)",
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Sign in to create a society and share opportunities with students.
        </p>
        <button type="button" className="btn btn-primary" onClick={handleSignIn}>
          Sign in with Google
        </button>
      </div>
    );
  }

  // FIX: a signed-in user whose profile hadn't loaded yet got the full form
  // and then a "You must be signed in" toast on submit (confusing + wrong).
  if (profileError) {
    return (
      <div role="alert" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: "var(--text-secondary)" }}>
          Your account profile could not be loaded. Please refresh and try
          again.
        </p>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        <Loader />
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ ...titleStyle, marginBottom: 4 }}>Create a Society</h1>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13 }}>
          Create a community on Opportune to share opportunities, events, and
          updates. Your society will be public and discoverable in the global
          feed, and you&apos;ll become its admin.
        </p>
      </header>

      {/* noValidate: validation is handled above so errors are inline, themed,
          and consistent (native bubbles can't be styled or announced well). */}
      <form onSubmit={handleSubmit} noValidate>
        <BasicInformationFields
          form={form}
          errors={errors}
          onChange={updateField}
        />

        <Section title="Logo &amp; Banner">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <ImageUploadField
              id="society-logo"
              label="Logo (400×400 recommended)"
              icon="🖼️"
              file={logoFile}
              disabled={saving}
              onFileChange={setLogoFile}
            />
            <ImageUploadField
              id="society-banner"
              label="Banner (1200×400 recommended)"
              icon="🏔️"
              file={bannerFile}
              disabled={saving}
              onFileChange={setBannerFile}
            />
          </div>
        </Section>

        <ContactFields form={form} errors={errors} onChange={updateField} />
        <CommunityLinkFields
          form={form}
          errors={errors}
          onChange={updateCommunityLink}
        />

        {saving && uploadProgress > 0 && (
          <div role="status" aria-live="polite" style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                marginBottom: 6,
              }}
            >
              {uploadProgress < 90
                ? `Uploading images… ${Math.round(uploadProgress)}%`
                : "Creating society…"}
            </div>
            <div
              role="progressbar"
              aria-label="Society creation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(uploadProgress)}
              style={{
                height: 5,
                background: "var(--bg-tertiary)",
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: "100%",
                  background: "var(--gradient-primary)",
                  transition: "width .4s",
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ minWidth: 160 }}
          >
            {saving ? "⏳ Creating…" : "🏛️ Create Society"}
          </button>
        </div>
      </form>
    </div>
  );
}