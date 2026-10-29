/**
 * E-240: Ist der gebündelte Katalog noch aktuell? Rechtsinhalte kommen bisher nur mit einem App-Update (oder, wenn
 * eingeschaltet, mit einem Inhalts-Update, docs/inhalte-aktualisieren.md) aufs Gerät. Die App sagt deshalb ruhig, aber
 * deutlich „Rechtsstand vom TT.MM.JJJJ – bitte App aktualisieren“, sobald der Stand alt ist – auf „Heute“ und in der
 * Einleitung des Pflichten-Checks. Sie sperrt nie etwas.
 *
 * Als veraltet gilt der Katalog (Entscheidung E-240, ohne Rechtsinhalt – nur Datumsvergleich mit Daten aus dem Katalog):
 * - **Alter:** mehr als {@link KATALOG_ALT_TAGE} Tage nach dem Rechtsstand (`katalog.rechtsstand.datum`, von der
 *   Redaktion gesetzt, catalog/rechtsstand.yaml). 120 Tage: zwei übliche Release-Abstände plus Puffer; kürzer warnte die
 *   App schon zwischen zwei regulären Updates, länger ließe einen Jahreswechsel (Mindestlohn, Minijob-Grenze) unbemerkt.
 * - **Stichtag:** sofort, wenn ein Änderungsstichtag, den der Katalog selbst nennt, nach dem Rechtsstand liegt und heute
 *   erreicht ist – die Redaktion wusste beim Bündeln, dass sich dann etwas ändern kann, kannte den Inhalt aber noch nicht:
 *   (a) `gueltig_ab` bzw. `radar.erwartet_ab` von Pflichten und Regelwerten im Status `entwurf` oder `geplant`;
 *   (b) das Ende (`gueltig_bis`) einer Regelwert-Version ohne Folgeversion ab dem nächsten Tag (der Katalog hätte dann
 *   keinen Wert mehr). Nicht dazu gehört `beschlossen`/`in_kraft` mit späterem `gueltig_ab`: Dessen Inhalt steht
 *   schon fest im Katalog (z. B. Mindestlohn ab 01.01.2027), die App wendet ihn zum Stichtag selbst an.
 * Ein neuerer Katalog (neues Bündel, App- oder Inhalts-Update) bringt einen neuen Rechtsstand mit und hebt beides auf.
 */
import roh from "./katalog.json";
import { T as TEXT } from "../texte";

/** Tage nach dem Rechtsstand, ab denen die App „bitte App aktualisieren“ zeigt (E-240). */
export const KATALOG_ALT_TAGE = 120;

/** Status, deren Stichtag einen noch unbekannten Inhalt ankündigt (E-240 (a)). */
const UNFERTIG = new Set(["entwurf", "geplant"]);

type Datiert = { id?: unknown; version?: unknown; status_recht?: unknown; gueltig_ab?: unknown; gueltig_bis?: unknown; radar?: { erwartet_ab?: unknown } | null };
export type KatalogStand = { rechtsstand?: unknown; pflichten?: Datiert[]; regelwerte?: Datiert[] };

const TAG = /^\d{4}-\d{2}-\d{2}$/;
const tag = (x: unknown): string | null => (typeof x === "string" && TAG.test(x) ? x : null);
const plusTage = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const tageZwischen = (von: string, bis: string) => Math.round((Date.parse(`${bis}T00:00:00Z`) - Date.parse(`${von}T00:00:00Z`)) / 864e5);

/** Rechtsstand als Tag (JJJJ-MM-TT): `rechtsstand.datum`; nur JJJJ-MM → der Erste des Monats (eher früher warnen). */
export function rechtsstandTag(katalog: KatalogStand = roh as unknown as KatalogStand): string | null {
  const r = katalog.rechtsstand;
  const d = typeof r === "string" ? r : r && typeof r === "object" ? (r as { datum?: unknown }).datum : null;
  if (typeof d !== "string") return null;
  if (TAG.test(d)) return d;
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(d) ? `${d}-01` : null;
}

export type Stichtag = { datum: string; id: string; art: "entwurf" | "ohne_folgewert" };

/** Änderungsstichtage nach dem Rechtsstand, aufsteigend (E-240 (a) und (b)). */
export function aenderungsStichtage(katalog: KatalogStand = roh as unknown as KatalogStand): Stichtag[] {
  const stand = rechtsstandTag(katalog);
  if (!stand) return [];
  const aus: Stichtag[] = [];
  for (const e of [...(katalog.pflichten ?? []), ...(katalog.regelwerte ?? [])]) {
    if (!UNFERTIG.has(String(e.status_recht))) continue;
    for (const d of new Set([tag(e.gueltig_ab), tag(e.radar?.erwartet_ab)])) if (d && d > stand) aus.push({ datum: d, id: String(e.id), art: "entwurf" });
  }
  const versionen = katalog.regelwerte ?? [];
  for (const r of versionen) {
    const bis = tag(r.gueltig_bis);
    if (!bis) continue;
    const danach = plusTage(bis, 1);
    if (danach <= stand) continue;
    // Folgeversion: gleiche ID, mit Beginn spätestens am Tag danach und nicht schon davor beendet. Eine Version ohne
    // Beginn (geplant, Datum unbekannt) ist keine Folgeversion.
    const folge = versionen.some((x) => {
      const ab = tag(x.gueltig_ab);
      const ende = tag(x.gueltig_bis);
      return x !== r && x.id === r.id && ab !== null && ab <= danach && (ende === null || ende >= danach);
    });
    if (!folge) aus.push({ datum: danach, id: `${String(r.id)}@${String(r.version)}`, art: "ohne_folgewert" });
  }
  return aus.sort((a, b) => a.datum.localeCompare(b.datum) || a.id.localeCompare(b.id));
}

export type Aktualitaet = {
  /** Rechtsstand (JJJJ-MM-TT) oder null, wenn der Katalog keinen trägt */
  stand: string | null;
  /** Tage seit dem Rechtsstand */
  tage: number;
  /** null = aktuell; sonst warum veraltet (Stichtag geht vor, weil er konkreter ist) */
  grund: null | "alter" | "stichtag";
  /** erreichter Stichtag (bei `grund: "stichtag"`) */
  stichtag?: Stichtag;
};

/** Aktualität des Katalogs am Tag `heute` (JJJJ-MM-TT, deutsche Zeit) – für Tests mit festem Datum. */
export function katalogAktualitaet(heute: string, katalog: KatalogStand = roh as unknown as KatalogStand): Aktualitaet {
  const stand = rechtsstandTag(katalog);
  // ohne Rechtsstand kann die App das Alter nicht beurteilen – katalog-buendel.mjs bricht dann ohnehin ab
  if (!stand) return { stand: null, tage: 0, grund: null };
  const tage = tageZwischen(stand, heute);
  const erreicht = aenderungsStichtage(katalog).find((s) => s.datum <= heute);
  if (erreicht) return { stand, tage, grund: "stichtag", stichtag: erreicht };
  return { stand, tage, grund: tage > KATALOG_ALT_TAGE ? "alter" : null };
}

/** Erster Tag, an dem die App „bitte aktualisieren“ zeigt (für das Freigabe-Tor und die Doku). */
export function veraltetAb(katalog: KatalogStand = roh as unknown as KatalogStand): string | null {
  const stand = rechtsstandTag(katalog);
  if (!stand) return null;
  const alter = plusTage(stand, KATALOG_ALT_TAGE + 1);
  const s = aenderungsStichtage(katalog)[0]?.datum;
  return s && s < alter ? s : alter;
}

const tt = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Texte des Hinweises für einen Tag – `null`, solange der Katalog aktuell ist (RechtsstandHinweis.tsx). */
export function rechtsstandHinweisTexte(heute: string, katalog: KatalogStand = roh as unknown as KatalogStand): { titel: string; text: string } | null {
  const a = katalogAktualitaet(heute, katalog);
  if (!a.grund || !a.stand) return null;
  return { titel: TEXT.e240_veraltet_titel(tt(a.stand)), text: a.grund === "stichtag" && a.stichtag ? TEXT.e240_veraltet_stichtag(tt(a.stichtag.datum)) : TEXT.e240_veraltet_alter };
}
