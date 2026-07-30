import type { Metadata } from 'next';
import { Public_Sans, Outfit, Inter } from 'next/font/google';
import PosShortcuts from '@/components/pos-shortcuts';
import './globals.css';

const publicSans = Public_Sans({
  subsets: ['latin'],
  variable: '--font-sans-google',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-heading-google',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body-google',
  display: 'swap',
});

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
    <html lang="en" className={`${publicSans.variable} ${outfit.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#088395" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BillDoor" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/logo-icon.png" />
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
