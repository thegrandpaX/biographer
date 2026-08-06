import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Biographer",
  description: "A patient, curious biographer for your life story.",
  manifest: "/manifest.json",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        {session && (
          <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
            <nav className="flex gap-4 text-sm font-medium">
              <Link href="/">Today</Link>
              <Link href="/review">Review</Link>
              <Link href="/chapters">Chapters</Link>
            </nav>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button type="submit" className="text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
                Sign out
              </button>
            </form>
          </header>
        )}
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
