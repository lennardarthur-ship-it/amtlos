/**
 * „Code einlösen“ (Phase 2.3, E-156) – reine Abläufe, ohne Gerät testbar. Partner-Lizenzen laufen ausschließlich über
 * Apples Abo-Angebotscodes (App Review 3.1.1: Freischalten nur per In-App-Kauf, keine eigenen Lizenzschlüssel oder
 * QR-Codes). Die App zeigt dafür Apples eigenes Einlöseblatt (StoreKit, über RevenueCat
 * `presentCodeRedemptionSheet`); ob Pro danach gilt, sagt allein die Berechtigung „pro“ aus RevenueCat – die App
 * schaltet nie selbst etwas frei.
 */

/** Was „Code einlösen“ von RevenueCat braucht – im Test ersetzbar. */
export interface CodeAdapter {
  /** Apples Einlöseblatt zeigen (iOS 14+). Das Versprechen erfüllt sich, sobald das Blatt gezeigt wurde – nicht erst nach dem Einlösen. */
  blattZeigen(): Promise<void>;
  /** zwischengespeicherte Kundendaten verwerfen, damit die nächste Abfrage frisch vom Server kommt */
  cacheVerwerfen(): Promise<void>;
  /** Kundendaten (Berechtigungen) holen */
  kundendaten(): Promise<{ entitlements: { active: Record<string, unknown> } }>;
}

/** „pro“: Pro ist (jetzt) aktiv; „offen“: Blatt gezeigt, (noch) kein Pro – z. B. abgebrochen oder Apple prüft noch. */
export type CodeErgebnis = "pro" | "offen";

/**
 * Einlöseblatt zeigen und danach die Berechtigung neu abfragen. Fehler beim Zeigen werden geworfen (Anzeige im
 * Bezahlschirm). Ein später eingelöster Code kommt zusätzlich über die Kundendaten-Beobachtung an (`proBeobachten`) und
 * beim nächsten Wechsel in den Vordergrund.
 */
export async function codeEinloesenMit(a: CodeAdapter, berechtigung: string): Promise<CodeErgebnis> {
  await a.blattZeigen();
  try {
    await a.cacheVerwerfen();
    const info = await a.kundendaten();
    return info.entitlements.active[berechtigung] ? "pro" : "offen";
  } catch {
    return "offen";
  }
}
