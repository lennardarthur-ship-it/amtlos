"use client";

/** Fehlerseite: sagt, was zu tun ist; keine technischen Details an Nutzer (die stehen im Server-Log). */
export default function Fehler({ reset }: { error: Error; reset: () => void }) {
  const en = typeof document !== "undefined" && document.documentElement.lang === "en";
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-titel font-bold">{en ? "That did not work. Please try again." : "Das hat nicht geklappt. Bitte versuche es noch einmal."}</h1>
      <button className="knopf mt-6" onClick={reset}>
        {en ? "Try again" : "Noch einmal versuchen"}
      </button>
    </main>
  );
}
