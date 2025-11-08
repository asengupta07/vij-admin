import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VIJ Admin",
  description: "Visual Insight for JS Errors",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
          <header className="border-b border-black/10 dark:border-white/10">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
              <Link href="/">
                <h1 className="text-lg font-semibold tracking-tight">VIJ Admin</h1>
              </Link>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Self-hosted error tracking</span>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
