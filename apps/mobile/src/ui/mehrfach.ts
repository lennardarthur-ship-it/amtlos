/**
 * R12 (Bäckerei #1): „Keine davon“ bzw. „Nichts davon“ schließt die anderen Antworten aus – und umgekehrt. Ausschließend
 * ist eine Option, deren Wert mit „keine“ beginnt oder deren Text mit „Keine davon“ bzw. „Nichts davon“ anfängt.
 */
export const exklusiv = (o: { wert: string; text: string }) => o.wert.startsWith("keine") || /^(keine davon|nichts davon)/i.test(o.text.trim());
export function mehrfachUmschalten(werte: string[], wert: string, optionen: { wert: string; text: string }[]): string[] {
  if (werte.includes(wert)) return werte.filter((x) => x !== wert);
  const o = optionen.find((x) => x.wert === wert);
  if (o && exklusiv(o)) return [wert];
  const aus = new Set(optionen.filter(exklusiv).map((x) => x.wert));
  return [...werte.filter((x) => !aus.has(x)), wert];
}
