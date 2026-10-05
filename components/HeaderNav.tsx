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
    <nav aria-label="Main" className="flex gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center border-b-2 px-3.5 text-[15px] ${
              active
                ? "border-accent font-semibold text-ink"
                : "border-transparent font-medium text-ink-soft hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
