"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/auth/actions";
import Avatar from "./Avatar";

type HeaderProfile = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
} | null;

const links = [
  { label: "Projects", href: "/" },
  { label: "Phases", href: "/phases" },
  { label: "Usage", href: "/usage" },
];

export default function Header({ profile }: { profile: HeaderProfile }) {
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-moa-line px-6 py-6 sm:px-10">
      <Link href="/" className="flex items-center gap-5">
        <span className="text-3xl font-medium tracking-[0.15em]">MOA</span>
        <span className="hidden h-8 w-px bg-moa-text/50 md:block" />
        <span className="hidden text-xs font-medium leading-snug tracking-[0.35em] lowercase md:block">
          michael office
          <br />
          of architecture
        </span>
      </Link>

      <div className="flex items-center gap-8">
        <nav className="flex items-center gap-8 text-sm font-medium">
          {links.map((link) => {
            const active = link.href === "/" ? pathname === "/" || pathname.startsWith("/projects") : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`border-b pb-1 transition-colors hover:text-moa-muted ${
                  active ? "border-moa-text" : "border-transparent"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <AvatarMenu profile={profile} />
      </div>
    </header>
  );
}

function AvatarMenu({ profile }: { profile: HeaderProfile }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!profile) {
    return (
      <Link href="/login" aria-label="Log in" className="transition-opacity hover:opacity-70">
        <Avatar size={36} />
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="block rounded-full transition-opacity hover:opacity-70 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-moa-text"
      >
        <Avatar name={profile.name} src={profile.avatar_url} size={36} />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-3 w-60 border border-moa-line bg-moa-bg py-2 text-sm">
          <div className="border-b border-moa-line px-5 pb-3 pt-1">
            <p className="truncate font-medium">{profile.name || "Signed in"}</p>
            <p className="truncate text-moa-muted">{profile.email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="mt-1 block px-5 py-2 transition-colors hover:text-moa-muted"
          >
            My account
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" className="w-full px-5 py-2 text-left transition-colors hover:text-moa-muted">
              Log out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
