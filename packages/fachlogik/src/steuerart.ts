/**
 * Steuerart einer Ausgangsrechnung – gemeinsam für Rechnung, E-Rechnung, Voranmeldung und Buchungen (DATEV), damit
 * alle Stellen denselben Wert prüfen.
 *
 * StB-Prüfung Steuerberatungskanzlei (21.10.2026, B-2/C-12): Der Nullsteuersatz (§ 12 Abs. 3 UStG, Photovoltaik) ist eine
 * eigene Steuerart – steuerpflichtig zu 0 % (Kz 87, XRechnung Kategorie Z), nicht „befreit“ (Kz 48, Kategorie E).
 */
export type Steuerart = "standard" | "reverse_charge" | "igl" | "befreit" | "nullsatz";

/** Nullsteuersatz nach § 12 Abs. 3 UStG (Lieferung und Installation von Photovoltaikanlagen): Kz 87, eigenes Erlöskonto, XRechnung Z. */
export const STEUERART_NULLSATZ = "nullsatz" as const satisfies Steuerart;

/** Alle Steuerarten in fester Reihenfolge (Auswahl, Prüfung gespeicherter Werte). */
export const STEUERARTEN: readonly Steuerart[] = ["standard", "reverse_charge", "igl", "befreit", STEUERART_NULLSATZ];

/** Ist der Wert eine bekannte Steuerart? */
export const istSteuerart = (w: unknown): w is Steuerart => typeof w === "string" && (STEUERARTEN as readonly string[]).includes(w);

/** Nullsteuersatz (§ 12 Abs. 3 UStG)? */
export const istNullsatz = (art: Steuerart | null | undefined) => art === STEUERART_NULLSATZ;
