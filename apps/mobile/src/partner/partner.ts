/**
 * Partner-Branding „Empfohlen von …“ (E-156, Phase 2.3) – reine Daten, ohne Gerät testbar.
 *
 * Ein Partner (z. B. eine Kammer, ein Verband, eine Steuerkanzlei) empfiehlt Amtlos seinen Mitgliedern. Die App zeigt
 * dann „Empfohlen von {name}“ – mehr nicht. Ein Partner-Code schaltet NIE etwas frei (App Review 3.1.1: keine eigenen
 * Freischaltwege wie Lizenzschlüssel oder QR-Codes). Den Zugang zu Pro bekommen Mitglieder eines Partners
 * ausschließlich über Apples Abo-Angebotscodes („Code einlösen“, `pro/kauf.ts` → StoreKit), siehe docs/13-b2b-lizenz.md.
 *
 * Die Partner-ID bleibt auf dem Gerät (und in der verschlüsselten Datensicherung); sie wird nicht synchronisiert und an
 * niemanden gesendet.
 */

export interface Partner {
  /** Anzeigename, z. B. „Handwerkskammer Musterstadt“ */
  name: string;
  /** kurzer Name für enge Stellen, z. B. „HWK Musterstadt“ */
  kurz?: string;
  /** Logo: Daten-URI (`data:image/png;base64,…`) oder `require("../../assets/partner/x.png")` (gebündelt, kein Netz) */
  logo?: string | number;
  /** Seite des Partners zu Amtlos (https) */
  link?: string;
  /** ein Satz des Partners, z. B. „Für Mitglieder: 12 Monate Pro über deinen Kammer-Code.“ */
  hinweis?: string;
}

/**
 * Gebündelte Partnerliste: Partner-ID (= Partner-Code, klein geschrieben) → Angaben. Absichtlich leer – ein Partner
 * kommt erst mit einer Vereinbarung und einem App-Update dazu (kein Laden aus dem Netz). Testdaten stehen nur in den
 * Tests.
 */
export const PARTNER: Record<string, Partner> = {};

/** Erlaubte Form einer Partner-ID: Kleinbuchstaben, Ziffern, Bindestrich, 2–40 Zeichen. */
const ID_FORM = /^[a-z0-9][a-z0-9-]{1,39}$/;

/** Eingabe vereinheitlichen: getrimmt, klein geschrieben, ohne innere Leerzeichen; null, wenn sie nicht passen kann. */
export function partnerCodeNormal(code: string | null | undefined): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim().toLowerCase().replace(/\s+/g, "");
  return ID_FORM.test(c) ? c : null;
}

/**
 * Partner zu einem eingegebenen Code (Groß-/Kleinschreibung und Leerzeichen am Rand egal) – oder null, wenn es keinen
 * Partner dazu gibt. `liste` nur für Tests.
 */
export function partnerAusCode(code: string | null | undefined, liste: Record<string, Partner> = PARTNER): { id: string; partner: Partner } | null {
  const id = partnerCodeNormal(code);
  if (!id || !Object.prototype.hasOwnProperty.call(liste, id)) return null;
  return { id, partner: liste[id]! };
}

/** Angaben zu einer gespeicherten Partner-ID – null, wenn keine gesetzt ist oder der Partner nicht mehr in der Liste steht. */
export function partnerFuer(id: string | null | undefined, liste: Record<string, Partner> = PARTNER): Partner | null {
  return id && Object.prototype.hasOwnProperty.call(liste, id) ? liste[id]! : null;
}

/**
 * Partner-Code aus einem Deep Link `amtlos://partner/<code>` (das Schema „amtlos“ registriert die App schon für die
 * Anmeldung). Andere Links (z. B. `amtlos://anmeldung`) ergeben null. Liefert den normalisierten Code, auch wenn es
 * dazu keinen Partner gibt – ob er bekannt ist, prüft `partnerAusCode`.
 */
export function partnerCodeAusLink(url: string | null | undefined): string | null {
  if (typeof url !== "string") return null;
  const m = /^amtlos:\/\/+partner\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(url.trim());
  if (!m) return null;
  let roh: string;
  try {
    roh = decodeURIComponent(m[1]!);
  } catch {
    return null;
  }
  return partnerCodeNormal(roh);
}

/** Gespeicherte Partner-ID lesen (Stand, Sicherung): nur eine gültige ID, sonst undefined. */
export function partnerIdAus(roh: unknown): string | undefined {
  return typeof roh === "string" && ID_FORM.test(roh) ? roh : undefined;
}
