"use client";

import { useCallback, useEffect, useState } from "react";

export type AppTheme = "dark" | "light";

const THEME_STORAGE_KEY = "opportune-theme";
const THEME_CHANGE_EVENT = "opportune-theme-change";

/** Browser-chrome colour per theme (matches --bg-primary in globals.css). */
const THEME_COLORS: Record<AppTheme, string> = {
  dark: "#060b18",
  light: "#f0f4f8",
};

/**
 * Safely reads the persisted theme from localStorage.
 */
function readStoredTheme(): AppTheme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable: the theme still applies for this session.
  }
}

function readAppliedTheme(): AppTheme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme: AppTheme) {
  const root = document.documentElement;
  if (theme === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;

  // Update mobile browser chrome color
  let metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (metas.length === 0) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
    metas = document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
  }
  metas.forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]));
}

/**
 * Hook for querying and toggling the application color theme (light / dark).
 */
export function useTheme() {
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    const sync = (next: AppTheme) => {
      applyTheme(next);
      setThemeState(next);
    };

    // Sync React state with the theme initialised by the root layout script.
    sync(readStoredTheme() ?? readAppliedTheme());

    // Other tabs. key === null means storage was cleared.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
      sync(readStoredTheme() ?? "light");
    };

    // Listen for custom theme change events within the same tab
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<AppTheme>).detail;
      sync(detail === "light" ? "light" : "dark");
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    applyTheme(nextTheme);
    writeStoredTheme(nextTheme);
    setThemeState(nextTheme);
    window.dispatchEvent(
      new CustomEvent<AppTheme>(THEME_CHANGE_EVENT, { detail: nextTheme }),
    );
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme };
}
