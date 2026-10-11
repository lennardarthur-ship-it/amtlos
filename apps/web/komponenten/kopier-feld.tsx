"use client";

import { useState } from "react";

export function KopierFeld({ wert, knopf, erledigt }: { wert: string; knopf: string; erledigt: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input readOnly value={wert} className="feld font-mono text-klein" aria-label={knopf} onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="knopf flex-none"
        onClick={async () => {
          await navigator.clipboard.writeText(wert);
          setKopiert(true);
        }}
      >
        <span aria-live="polite">{kopiert ? erledigt : knopf}</span>
      </button>
    </div>
  );
}
