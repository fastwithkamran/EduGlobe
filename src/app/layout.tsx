import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'Opportune',
  description:
    'Discover hackathons, scholarships, internships, competitions, and events in one place. Opportune helps students in Pakistan find opportunities shared by organizations.',
  keywords: [
    'Opportune',
    'student opportunities Pakistan',
    'hackathons Pakistan',
    'scholarships for students',
    'internships Pakistan',
    'student competitions',
    'student events',
    'university events',
    'opportunity discovery platform',
  ],
  authors: [{ name: 'Opportune' }],
  verification: {
    google: 'VNPyY13oobL3dsGPU06R_aUy4g6iNIvZr-S6qM9tPcg',
  },
   icons: {
    icon: '/logo_bg.png',
    apple: '/logo_bg.png',
  },
  openGraph: {
    title: 'Opportune',
    description:
      'One place for students in Pakistan to discover hackathons, scholarships, internships, competitions, and events shared by organizations.',
    type: 'website',
    locale: 'en_US',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* Anti-FOUC: read theme from localStorage before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('opportune-theme');if(t==='light')document.documentElement.dataset.theme='light';}catch(e){}})();` }} />
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            gutter={10}
            toastOptions={{
              duration: 3500,
              style: {
                background: '#111827',
                color: '#f9fafb',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                maxWidth: '380px',
              },
              success: {
                duration: 3000,
                iconTheme: { primary: '#10b981', secondary: '#111827' },
                style: {
                  background: '#111827',
                  color: '#f9fafb',
                  border: '1px solid rgba(16,185,129,0.3)',
                  borderLeft: '4px solid #10b981',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
              },
              error: {
                duration: 4500,
                iconTheme: { primary: '#ef4444', secondary: '#111827' },
                style: {
                  background: '#111827',
                  color: '#f9fafb',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderLeft: '4px solid #ef4444',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
