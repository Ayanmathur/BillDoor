import type { Metadata } from 'next';
import PosShortcuts from '@/components/pos-shortcuts';
import './globals.css';

/**
 * BillDoor Client Portal — Root Layout
 * 
 * SEO: proper title, meta description, semantic HTML.
 * Theme: data-theme attribute toggled by ThemeProvider.
 * PWA: Manifest, Service Worker, and Desktop POS Shortcuts.
 */
export const metadata: Metadata = {
  title: 'BillDoor — Smart Billing & Reviews for Your Business',
  description:
    'BillDoor by Orbitex: digital billing, appointment scheduling, review collection, and WhatsApp automation for Indian businesses.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BillDoor',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#111111" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BillDoor" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        {children}
        <PosShortcuts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(err) {
                    console.error('ServiceWorker registration failed: ', err);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
