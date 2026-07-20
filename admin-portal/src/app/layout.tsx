import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BillDoor Admin — Orbitex Platform Management',
  description: 'Admin panel for managing BillDoor clients, license keys, and platform settings.',
  icons: { icon: '/favicon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
