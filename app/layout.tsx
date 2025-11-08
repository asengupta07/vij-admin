import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import "@/lib/ws";

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
          <header className="sticky top-0 z-10 border-b border-black/10 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-white/10 dark:bg-black/40">
            <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
              <Link href="/">
                <h1 className="text-lg font-semibold tracking-tight">VIJ Admin</h1>
              </Link>
              <nav className="flex items-center gap-4">
                <Link href="/logs" className="text-sm text-zinc-700 hover:underline dark:text-zinc-300">
                  View logs
                </Link>
                <Link href="/groups" className="text-sm text-zinc-700 hover:underline dark:text-zinc-300">
                  Groups
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
