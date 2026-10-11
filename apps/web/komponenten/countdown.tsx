"use client";

import { useEffect, useState } from "react";

/** Restzeit bis zu einer Frist, aktualisiert jede halbe Minute. Texte kommen fertig übersetzt vom Server. */
export function Countdown({ bis, laeuft, abgelaufen, zeit }: { bis: string; laeuft: string; abgelaufen: string; zeit: string }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setJetzt(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  const rest = new Date(bis).getTime() - jetzt;
  if (rest <= 0) return <span className="font-bold text-frist">{abgelaufen.replace("{zeit}", zeit)}</span>;
  const h = Math.floor(rest / 3_600_000);
  const m = Math.floor((rest % 3_600_000) / 60_000);
  return (
    <span className={`font-bold ${h < 24 ? "text-frist" : "text-bald"}`} role="timer">
      {laeuft.replace("{h}", String(h)).replace("{m}", String(m)).replace("{zeit}", zeit)}
    </span>
  );
}
