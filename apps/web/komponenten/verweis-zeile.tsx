import Link from "next/link";
import type { ReactNode } from "react";

/** Eine Zeile, die irgendwohin führt: Titel, Erklärung, Hinweis rechts, Pfeil als Zeichen dafür, dass es weitergeht. */
export function VerweisZeile({ href, titel, text, info, className }: { href: string; titel: string; text?: string | null; info?: ReactNode; className?: string }) {
  return (
    <li className={`border-b border-linie ${className ?? ""}`}>
      <Link href={href} className="group flex min-h-14 items-center gap-4 py-3 hover:bg-blatt/60">
        <span className="min-w-0 flex-1">
          <span className="block font-bold group-hover:underline group-hover:underline-offset-4">{titel}</span>
          {text ? <span className="mt-0.5 block text-klein text-tinte-leise">{text}</span> : null}
        </span>
        {info ? <span className="shrink-0 text-klein text-tinte-leise">{info}</span> : null}
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-tinte-leise"><path d="M6 3l5 5-5 5" /></svg>
      </Link>
    </li>
  );
}
