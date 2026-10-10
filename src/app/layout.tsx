import type { Metadata, Viewport } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

/**
 * Absolute base URL so Open Graph / Twitter image URLs resolve correctly.
 * Order: NEXT_PUBLIC_SITE_URL -> VERCEL_PROJECT_PRODUCTION_URL -> VERCEL_URL.
 * A malformed value must never crash the whole app, so every step is guarded.
 */
function getMetadataBase(): URL | undefined {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    try {
      return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      // try the next candidate
    }
  }
  // Without a base, Next warns and resolves OG images against localhost.
  return process.env.NODE_ENV === "production"
    ? undefined
    : new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}

const DESCRIPTION =
  "Discover hackathons, scholarships, internships, competitions, and events in one place. Opportune helps students in Pakistan find opportunities shared by organizations.";

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: {
    default: "Opportune",
    template: "%s | Opportune",
  },
  description: DESCRIPTION,
  applicationName: "Opportune",
  keywords: [
    "Opportune",
    "student opportunities Pakistan",
    "hackathons Pakistan",
    "scholarships for students",
    "internships Pakistan",
    "student competitions",
    "student events",
    "university events",
    "opportunity discovery platform",
  ],
  authors: [{ name: "Opportune" }],
  verification: {
    google: "VNPyY13oobL3dsGPU06R_aUy4g6iNIvZr-S6qM9tPcg",
  },
  icons: {
    icon: "/logo_bg.png",
    apple: "/logo_bg.png",
  },
  openGraph: {
    title: "Opportune",
    description:
      "One place for students in Pakistan to discover hackathons, scholarships, internships, competitions, and events shared by organizations.",
    siteName: "Opportune",
    type: "website",
    locale: "en_US",
    images: [{ url: "/logo_bg.png", alt: "Opportune" }],
  },
  twitter: {
    card: "summary",
    title: "Opportune",
    description: DESCRIPTION,
    images: ["/logo_bg.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Required for env(safe-area-inset-*) on notched iPhones (mobile bottom nav).
  viewportFit: "cover",
  // Light default; the inline theme script below keeps this meta in sync with the dark toggle.
  themeColor: "#f0f4f8",
};

const toastBase: CSSProperties = {
  background: "var(--bg-card)",
  color: "var(--text-primary)",
  border: "1px solid var(--border-primary)",
  borderRadius: "12px",
  fontSize: "0.875rem",
  fontFamily: "var(--font-body)",
  boxShadow: "var(--shadow-lg)",
  maxWidth: "380px",
};

const toastSuccess: CSSProperties = {
  ...toastBase,
  border: "1px solid rgba(16,185,129,0.3)",
  borderLeft: "4px solid #10b981",
};

const toastError: CSSProperties = {
  ...toastBase,
  border: "1px solid rgba(239,68,68,0.3)",
  borderLeft: "4px solid #ef4444",
};

/**
 * Runs before first paint: applies the stored theme and keeps <meta name="theme-color">
 * (mobile browser chrome) in sync with it — including later toggles, via the observer.
 */
const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;function sync(){var dark=d.dataset.theme!=='light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',dark?'#060b18':'#f0f4f8');}try{if(localStorage.getItem('opportune-theme')==='dark'){delete d.dataset.theme;}else{d.dataset.theme='light';}}catch(e){}try{new MutationObserver(sync).observe(d,{attributes:true,attributeFilter:['data-theme']});}catch(e){}document.addEventListener('DOMContentLoaded',sync);sync();})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script sets data-theme on <html>
    // before React hydrates.
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: read theme from localStorage before first paint; defaults to light */}
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_INIT_SCRIPT,
          }}
        />
      </head>
      <body className={`${inter.variable} ${outfit.variable}`}>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            gutter={10}
            containerClassName="app-toaster"
            containerStyle={{ zIndex: 300 }}
            toastOptions={{
              duration: 3500,
              style: toastBase,
              success: {
                duration: 3000,
                iconTheme: { primary: "#10b981", secondary: "#ffffff" },
                style: toastSuccess,
              },
              error: {
                duration: 4500,
                iconTheme: { primary: "#ef4444", secondary: "#ffffff" },
                style: toastError,
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
