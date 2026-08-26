import type { Metadata } from "next";
import { Newsreader, Work_Sans } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import HeaderNav from "@/components/HeaderNav";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
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
      className={`${newsreader.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {session && (
          <header className="flex items-center justify-between border-b border-border px-8 py-4">
            <HeaderNav />
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button type="submit" className="text-sm text-ink-faint hover:text-ink-soft">
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
