import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'EduGlobe',
  description:
    'The all-in-one platform for students worldwide. Discover educational activities, post your creativity, and grow with AI-powered tools.',
  keywords: ['Students', 'student organizations', 'Educational Platform', 'EduGlobe'],
  authors: [{ name: 'EduGlobe' }],
   icons: {
    icon: '/logo_bg.png',
    apple: '/logo_bg.png',
  },
  openGraph: {
    title: 'EduGlobe',
    description: 'The ultimate platform for students worldwide — powered by AI.',
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
      </head>
      <body>
        <AuthProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: '#111827',
                color: '#f9fafb',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
                fontSize: '0.875rem',
                fontFamily: 'Inter, sans-serif',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#111827' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#111827' } },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
