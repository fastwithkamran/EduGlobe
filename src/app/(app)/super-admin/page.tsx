"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { deleteSociety, getAllSocieties } from "@/lib/firestore";
import type { Society } from "@/types";
import { ConfirmDeleteModal } from "./_components/ConfirmDeleteModal";
import { SocietyRow } from "./_components/SocietyRow";

export default function SuperAdminPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [societies, setSocieties] = useState<Society[]>([]);
  const [search, setSearch] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadState, setLoadState] = useState<{
    attempt: number;
    status: "success" | "error";
  } | null>(null);
  const [confirmSociety, setConfirmSociety] = useState<Society | null>(null);
  const [deletingSocietyId, setDeletingSocietyId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) router.replace("/feed");
  }, [authLoading, isSuperAdmin, router]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;

    getAllSocieties()
      .then((data) => {
        if (!active) return;
        setSocieties(data);
        setLoadState({ attempt: loadAttempt, status: "success" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error("[SuperAdminPage] Failed to load societies:", error);
        setLoadState({ attempt: loadAttempt, status: "error" });
      });

    return () => {
      active = false;
    };
  }, [isSuperAdmin, loadAttempt]);

  const loading = authLoading || loadState?.attempt !== loadAttempt;
  const loadError = !loading && loadState?.status === "error";
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      societies.filter((society) => {
        if (!normalizedSearch) return true;
        const searchableText = [
          society.name,
          society.organization,
          society.city,
          society.country,
        ]
          .filter(Boolean)
          .join(" ")
          .toLocaleLowerCase();
        return searchableText.includes(normalizedSearch);
      }),
    [normalizedSearch, societies],
  );

  const handleCancelDelete = useCallback(() => {
    if (!deletingSocietyId) setConfirmSociety(null);
  }, [deletingSocietyId]);

  const handleDeleteConfirmed = async () => {
    if (!confirmSociety || deletingSocietyId) return;
    const society = confirmSociety;
    setDeletingSocietyId(society.id);
    try {
      await deleteSociety(society.id);
      setSocieties((current) =>
        current.filter((item) => item.id !== society.id),
      );
      toast.success(`Society "${society.name}" deleted`);
      setConfirmSociety(null);
    } catch (error) {
      console.error("[SuperAdminPage] Failed to delete society:", error);
      toast.error("Failed to delete society. Please try again.");
    } finally {
      setDeletingSocietyId(null);
    }
  };

  if (authLoading) {
    return (
      <div
        className="flex h-full items-center justify-center text-[var(--text-tertiary)]"
        role="status"
      >
        Checking permissions…
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <>
      <main
        className="p-[var(--page-padding-y)_var(--page-padding-x)]"
        aria-labelledby="manage-societies-heading"
      >
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1
              id="manage-societies-heading"
              className="mb-1 text-[22px] font-extrabold"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              🗂️ Manage Societies
            </h1>
            <p className="m-0 text-[13px] text-[var(--text-tertiary)]">
              {loading
                ? "Loading societies…"
                : loadError
                  ? "Could not load societies."
                  : `${societies.length} societies on the platform`}
              <span className="ml-2 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-500">
                ⚡ Super Admin
              </span>
            </p>
          </div>
        </header>

        <div
          role="note"
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-[var(--text-secondary)]"
        >
          <span aria-hidden="true">⚠️</span>
          <span>
            Deletion removes the society, its top-level posts, and follow
            records. Nested post comments and post attachment files are not
            currently removed. Society logo and banner cleanup is best-effort.
            <strong className="text-red-500"> This cannot be undone.</strong>
          </span>
        </div>

        <div className="mb-4">
          <label className="sr-only" htmlFor="society-search">
            Search societies
          </label>
          <input
            id="society-search"
            className="input w-full sm:max-w-96"
            type="search"
            placeholder="Search name, organization, or location…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <div
            role="status"
            className="p-10 text-center text-sm text-[var(--text-tertiary)]"
          >
            Loading societies…
          </div>
        ) : loadError ? (
          <div className="p-10 text-center">
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              Societies could not be loaded. Check your connection and try
              again.
            </p>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSocieties([]);
                setLoadAttempt((attempt) => attempt + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[var(--text-tertiary)] sm:p-14">
            <div aria-hidden="true" className="mb-3 text-4xl">
              🏛️
            </div>
            <h2 className="mb-1 text-[15px] font-semibold text-[var(--text-secondary)]">
              No societies found
            </h2>
            {normalizedSearch && (
              <p className="m-0 text-[13px]">Try a different search term.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {filtered.map((society) => (
              <SocietyRow
                key={society.id}
                society={society}
                onDelete={() => setConfirmSociety(society)}
                deleteDisabled={deletingSocietyId !== null}
              />
            ))}
          </div>
        )}
      </main>

      {confirmSociety && (
        <ConfirmDeleteModal
          society={confirmSociety}
          onConfirm={handleDeleteConfirmed}
          onCancel={handleCancelDelete}
          loading={deletingSocietyId === confirmSociety.id}
        />
      )}
    </>
  );
}
