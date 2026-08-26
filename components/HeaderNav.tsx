"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Interview" },
  { href: "/review", label: "Review" },
  { href: "/chapters", label: "Chapters" },
];

export default function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-7 items-center">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "text-sm font-semibold text-ink border-b-2 border-accent pb-0.5"
                : "text-sm font-medium text-ink-soft"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
