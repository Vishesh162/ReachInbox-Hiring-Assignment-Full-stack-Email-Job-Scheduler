import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ReachInbox | Email Job Scheduler',
  description: 'Production-grade, zero-cron email scheduler with BullMQ, Redis atomic rate limiting, and Next.js dashboard.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white text-gray-900 font-sans min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
