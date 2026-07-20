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
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
