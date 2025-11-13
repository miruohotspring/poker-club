import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ポーカークラブ',
  description: "Let's play poker!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="dark h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased ${cn('h-full')}`}
      >
        <div className="h-full">{children}</div>
      </body>
    </html>
  );
}
