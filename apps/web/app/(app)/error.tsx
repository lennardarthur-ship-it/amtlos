"use client";

import Link from "next/link";

/** Fehler innerhalb der App: Navigation bleibt, Weg zurück ist klar; keine technischen Details für Nutzer. */
export default function Fehler({ reset }: { error: Error; reset: () => void }) {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  return (
    <div className="lesetext space-y-6">
      <h1 className="text-titel font-bold">{en ? "That did not work." : "Das hat nicht geklappt."}</h1>
      <p>{en ? "Your data is safe. Try again, or go back to Today. If it keeps happening, write to us – the help page has the address." : "Deine Daten sind sicher. Versuch es noch einmal oder geh zurück zu „Heute“. Wenn es wieder passiert, schreib uns – die Adresse steht in der Hilfe."}</p>
      <div className="flex flex-wrap gap-3">
        <button className="knopf" onClick={reset}>
          {en ? "Try again" : "Noch einmal versuchen"}
        </button>
        <Link href="/heute" className="knopf knopf-leise">
          {en ? "Back to Today" : "Zurück zu Heute"}
        </Link>
      </div>
    </div>
  );
}
