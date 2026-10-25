/**
 * Partnerkanzleien „Steuerberatung finden“ – reine Daten, ohne Gerät testbar (docs/15-partnerkanzleien.md).
 *
 * Berufsrecht (Prüfbericht Rechtsanwalt, Abschnitt 7): Eine Kanzlei zahlt eine feste Gebühr für die Listung – nie eine
 * Provision oder sonst ein Entgelt je Mandat (§ 9 StBerG, § 49b Abs. 3 BRAO). Die App bleibt ein Werkzeug zur
 * Selbsthilfe; die Kanzlei berät unter eigenem Namen und in eigener Verantwortung. Daten gehen nur an eine Kanzlei,
 * wenn der Nutzer sie selbst sendet (Teilen-Menü bzw. eigene Mail-App).
 *
 * Die Liste ist gebündelt (kein Laden aus dem Netz) und absichtlich leer – eine Kanzlei kommt erst mit unterschriebenem
 * Listungsvertrag und einem App-Update dazu. Solange keine gültige Kanzlei in der Liste steht, zeigt die App den
 * Bereich nirgends. Testdaten stehen nur in den Tests.
 */

/** Berufsbezeichnung, wie sie die Kanzlei führt (§ 43 StBerG) */
export type Berufsbezeichnung = "Steuerberatungsgesellschaft" | "Steuerberater" | "Steuerberaterin";
export const BERUFSBEZEICHNUNGEN: readonly Berufsbezeichnung[] = ["Steuerberatungsgesellschaft", "Steuerberater", "Steuerberaterin"];

/** Übliche Leistungen – Vorschläge für die Angaben der Kanzlei (frei ergänzbar). */
export const LEISTUNGEN = ["Erstgespräch", "Buchhaltung übernehmen", "USt-Voranmeldung", "Lohnabrechnung", "Jahresabschluss", "Steuererklärungen", "Existenzgründung"] as const;

/** „bundesweit digital“ als Einzugsgebiet – sonst ein PLZ-Bereich wie „72“ oder „70–72“. */
export const BUNDESWEIT = "bundesweit digital";

export interface Kanzlei {
  /** Kennung, klein geschrieben (z. B. „stb-muster-reutlingen“) */
  id: string;
  /** Name der Kanzlei, wie sie auftritt */
  name: string;
  /** kurzer Name für enge Stellen (Knopf „Paket an … senden“), z. B. „Muster StB“ – höchstens 28 Zeichen */
  kurz?: string;
  /** „Steuerberatungsgesellschaft“, „Steuerberater“ oder „Steuerberaterin“ */
  berufsbezeichnung: Berufsbezeichnung;
  /** Ort des Sitzes bzw. der Beratungsstelle */
  ort: string;
  /** Einzugsgebiet: PLZ-Bereich („72“, „70–72“) oder „bundesweit digital“ */
  gebiet: string;
  /** E-Mail-Adresse für Anfragen und das Paket */
  email: string;
  telefon?: string;
  /** Website der Kanzlei (https) */
  web?: string;
  /** zuständige Steuerberaterkammer, z. B. „Steuerberaterkammer Stuttgart“ */
  kammer: string;
  /** Leistungen, z. B. „Buchhaltung übernehmen“, „USt-Voranmeldung“, „Jahresabschluss“, „Erstgespräch“ */
  leistungen: string[];
  /** Festpreise so, wie die Kanzlei sie angibt – die App zeigt sie mit „laut Kanzlei“ und rechnet nichts nach */
  festpreise?: string[];
  /** arbeitet mit DATEV (liest den DATEV-Buchungsstapel aus dem Paket direkt ein) */
  datev: boolean;
  /** Schwerpunkte, z. B. „Handwerk“, „Gastronomie“ */
  branchen?: string[];
  /** Ende der Listung (ISO-Datum, einschließlich) – danach verschwindet die Kanzlei aus der App */
  gueltigBis: string;
}

/** Gebündelte Liste. Absichtlich leer – siehe oben und docs/15-partnerkanzleien.md. */
export const KANZLEIEN: Kanzlei[] = [];

const ID_FORM = /^[a-z0-9][a-z0-9-]{1,59}$/;
const EMAIL_FORM = /^[^\s@<>()[\]",;:]+@[^\s@<>()[\]",;:]+\.[a-z]{2,}$/i;
const TELEFON_FORM = /^\+?[0-9 ()/-]{6,24}$/;
const DATUM_FORM = /^\d{4}-\d{2}-\d{2}$/;
const PLZ_BEREICH = /^\d{1,5}(\s?[–-]\s?\d{1,5})?$/;
/** Erfolgsbezogene Vergütung hat in den Angaben nichts zu suchen (§ 9 StBerG, § 49b Abs. 3 BRAO). */
const VERBOTEN = /provision|vermittlungsgeb|erfolgsabh|mandatsabh|je mandat/i;

const text = (w: unknown): w is string => typeof w === "string" && w.trim().length > 0;
const texte = (w: unknown): w is string[] => Array.isArray(w) && w.every(text);
const datumOk = (iso: string) => DATUM_FORM.test(iso) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;

export const emailGueltig = (e: unknown): e is string => text(e) && EMAIL_FORM.test(e.trim());

/**
 * Was an einer Kanzlei fehlt oder nicht stimmt (leer = in Ordnung). `heute` als ISO-Datum: Eine abgelaufene Listung
 * ist ein Fehler.
 */
export function kanzleiFehler(k: Partial<Kanzlei> | null | undefined, heute: string): string[] {
  if (!k || typeof k !== "object") return ["keine Angaben"];
  const f: string[] = [];
  if (!text(k.id) || !ID_FORM.test(k.id)) f.push("id");
  if (!text(k.name)) f.push("name");
  if (k.kurz !== undefined && (!text(k.kurz) || k.kurz.trim().length > 28)) f.push("kurz");
  if (!k.berufsbezeichnung || !BERUFSBEZEICHNUNGEN.includes(k.berufsbezeichnung)) f.push("berufsbezeichnung");
  if (!text(k.ort)) f.push("ort");
  if (!text(k.gebiet) || (k.gebiet !== BUNDESWEIT && !PLZ_BEREICH.test(k.gebiet.trim()))) f.push("gebiet");
  if (!emailGueltig(k.email)) f.push("email");
  if (k.telefon !== undefined && (!text(k.telefon) || !TELEFON_FORM.test(k.telefon.trim()))) f.push("telefon");
  if (k.web !== undefined && (!text(k.web) || !/^https:\/\/[^\s/]+\.[^\s]+$/.test(k.web))) f.push("web");
  if (!text(k.kammer) || !/steuerberaterkammer/i.test(k.kammer)) f.push("kammer");
  if (!texte(k.leistungen) || !k.leistungen.length) f.push("leistungen");
  if (k.festpreise !== undefined && !texte(k.festpreise)) f.push("festpreise");
  if (typeof k.datev !== "boolean") f.push("datev");
  if (k.branchen !== undefined && !texte(k.branchen)) f.push("branchen");
  if (!text(k.gueltigBis) || !datumOk(k.gueltigBis)) f.push("gueltigBis");
  else if (k.gueltigBis < heute) f.push("abgelaufen");
  const alles = [k.name, k.kurz, k.ort, k.gebiet, ...(k.leistungen ?? []), ...(k.festpreise ?? []), ...(k.branchen ?? [])].filter(text).join(" ");
  if (VERBOTEN.test(alles)) f.push("verguetung");
  return f;
}

/**
 * Die Kanzleien, die die App zeigt: vollständig, mit gültiger E-Mail, nicht abgelaufen; doppelte Kennungen nur einmal.
 * Leer → der Bereich „Steuerberatung finden“ erscheint nirgends. Reihenfolge wie in der Liste (keine bezahlte
 * Platzierung nach Mandaten).
 */
export function sichtbareKanzleien(heute: string, liste: readonly Kanzlei[] = KANZLEIEN): Kanzlei[] {
  const gesehen = new Set<string>();
  return liste.filter((k) => {
    if (kanzleiFehler(k, heute).length || gesehen.has(k.id)) return false;
    gesehen.add(k.id);
    return true;
  });
}

/** Festpreis mit Herkunft: „… laut Kanzlei“ – nie als Angabe der App. */
export const festpreisText = (t: string) => (/laut Kanzlei/i.test(t) ? t.trim() : `${t.trim()} (laut Kanzlei)`);

/** Einzugsgebiet lesbar: „PLZ 72…“ oder „bundesweit digital“. */
export const gebietText = (g: string) => (g === BUNDESWEIT ? BUNDESWEIT : `PLZ-Bereich ${g}`);

/** mailto-Link für „Kontakt aufnehmen“ (ohne Anhang – Daten sendet der Nutzer nur selbst). */
export const mailtoLink = (email: string, betreff: string) => `mailto:${email.trim()}?subject=${encodeURIComponent(betreff)}`;
/** tel-Link: nur Ziffern und führendes „+“. */
export const telLink = (telefon: string) => `tel:${telefon.trim().replace(/(?!^\+)[^\d]/g, "")}`;
