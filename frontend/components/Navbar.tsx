"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Users } from "lucide-react";
import { CharacterManagerDialog } from "@/components/crisis/CharacterManagerDialog";

export function Navbar() {
  const pathname = usePathname();
  const [charOpen, setCharOpen] = useState(false);
  if (pathname === "/login") return null;
  return (
    <>
      <header className="union-header">
        <div className="union-nav">
          <Link href="/mechanics" className="union-brand">
            <BookOpen size={19} strokeWidth={1.6} />
            <span>
              Fearmonger <strong>Union</strong>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            {[
              ["/mechanics", "Register"],
              ["/crisis", "Crisis tracker"],
              ["/control-panel", "Control panel"],
            ].map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
              >
                {label}
              </Link>
            ))}
            {pathname === "/crisis" && (
              <button
                className="sheet-button"
                onClick={() => setCharOpen(true)}
              >
                <Users size={14} /> Characters
              </button>
            )}
          </nav>
        </div>
      </header>
      {pathname === "/crisis" && (
        <CharacterManagerDialog open={charOpen} onOpenChange={setCharOpen} />
      )}
    </>
  );
}
