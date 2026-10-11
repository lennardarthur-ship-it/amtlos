"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Lädt die Seite im Hintergrund neu, solange sie angezeigt wird (z. B. bis die erste Berechnung fertig ist). */
export function AutoAktualisieren({ alleMs = 1500, hoechstens = 20 }: { alleMs?: number; hoechstens?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const takt = setInterval(() => {
      if (++n > hoechstens) return clearInterval(takt);
      router.refresh();
    }, alleMs);
    return () => clearInterval(takt);
  }, [router, alleMs, hoechstens]);
  return null;
}
