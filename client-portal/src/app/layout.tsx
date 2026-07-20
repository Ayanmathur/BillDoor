import type { Metadata } from 'next';
import './globals.css';

/**
 * BillDoor Client Portal — Root Layout
 * 
 * SEO: proper title, meta description, semantic HTML.
 * Theme: data-theme attribute toggled by ThemeProvider.
 */
export const metadata: Metadata = {
  title: 'BillDoor — Smart Billing & Reviews for Your Business',
  description:
    'BillDoor by Orbitex: digital billing, appointment scheduling, review collection, and WhatsApp automation for Indian businesses.',
  icons: {
    icon: '/favicon.png',
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, interactive-widget=resizes-content" />
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#111111" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BillDoor" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>{children}</body>
    </html>
  );
}
