import type { Metadata } from "next";
import { Archivo, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import HeaderNav from "@/components/HeaderNav";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
    // suppressHydrationWarning: browser extensions inject attributes onto
    // <html> before React hydrates, which would otherwise log a mismatch.
    <html
      lang="en"
      className={`${archivo.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {session && (
          <header className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-border px-5 py-[18px] sm:px-10">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-glow)]"
                />
                <span className="text-[15px] font-bold uppercase tracking-[0.08em] [font-stretch:125%]">
                  Biographer
                </span>
              </div>
              <HeaderNav />
            </div>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="h-11 px-1 text-sm text-ink-faint hover:text-ink-soft"
              >
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
