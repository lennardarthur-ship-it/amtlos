"use client";

export function DruckenKnopf({ text }: { text: string }) {
  return (
    <button type="button" className="knopf knopf-leise print:hidden" onClick={() => window.print()}>
      {text}
    </button>
  );
}
