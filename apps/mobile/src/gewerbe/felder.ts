/**
 * Gewerbe online anmelden: die Angaben des Vordrucks GewA 1 (Anlage 1 GewAnzV) in dessen Reihenfolge, gefüllt aus dem
 * Datenblatt „Gewerbeanmeldung“, „Mein Betrieb“ und dem Pflichten-Check – zum Abschreiben bzw. Kopieren ins Portal.
 * Rein und getestet (apps/mobile/test/gewerbe-online.test.ts); gezeichnet von seiten/GewerbeOnline.tsx.
 */
import { REGISTER_FORMEN, RECHTSFORMEN, istKapitalgesellschaft, rechtsformAus, registerAus, type Betrieb, type Daten } from "@amtlos/fachlogik";
import { T as TEXT } from "../texte";
import { erledigtSetzen, type Stand, type Unterlage } from "../unterlagen/speicher";
import { gemeindeGebuehr, landErmitteln, portalFuer, portalUrl, type GemeindeGebuehr, type LandErmittelt, type Portal } from "./portale";

/** Pflicht im Katalog und Vorlage des Datenblatts */
export const GEWERBE_PFLICHT = "gruendung.gewerbeanzeige";
export const GEWERBE_VORLAGE = "gewerbeanmeldung";
/** Nach der Anmeldung: Fragebogen zur steuerlichen Erfassung (das Gewerbeamt informiert das Finanzamt) */
export const FRAGEBOGEN_PFLICHT = "gruendung.fragebogen_steuerliche_erfassung";
/** Erlaubnisse und Eintragungen, die vor oder mit der Anmeldung nötig sein können (Katalog) */
export const ERLAUBNIS_PFLICHTEN = [
  "gruendung.erlaubnis_pruefen",
  "gruendung.handwerksrolle",
  "gruendung.handwerk_verzeichnis",
  "gruendung.reisegewerbekarte",
  "gruendung.gewo38_zuverlaessigkeit",
  "gruendung.vermittlerregister",
  "branche.gesundheit_erlaubnisse",
  "branche.transport_erlaubnis",
] as const;

type Profil = Stand["profil"];

/**
 * Status eines Felds: `ok` steht da; `fehlt` ist eine Pflichtangabe ohne Wert; `entfaellt` ist für diesen Betrieb nicht
 * nötig oder freiwillig leer; `portal` wählst du im Portal (steht nicht im Datenblatt).
 */
export type FeldStatus = "ok" | "fehlt" | "entfaellt" | "portal";

export interface OnlineFeld {
  id: string;
  /** Feldnummer im Vordruck GewA 1 (null: steht im Portal vorweg, z. B. die Rechtsform) */
  nr: number | null;
  label: string;
  wert: string | null;
  status: FeldStatus;
  hinweis: string;
  /** wo ein fehlender Wert ergänzt wird */
  ergaenzen?: "datenblatt" | "betrieb";
  /** Feld im Datenblatt „Gewerbeanmeldung“, aus dem der Wert kommt (für den Sprung zum passenden Schritt) */
  datenblattFeld?: string;
}

/** Rechtsform aus dem Check (Kennung) als Wort des Datenblatts */
const RECHTSFORM_CHECK: Record<string, string> = { einzelunternehmen: "Einzelunternehmen", ek: "e. K.", gbr: "GbR", ohg: "OHG", kg: "KG", ug: "UG (haftungsbeschränkt)", gmbh: "GmbH", gmbh_co_kg: "GmbH & Co. KG" };

const s = (w: unknown) => (typeof w === "string" ? w.trim() : typeof w === "number" ? String(w) : "");
const datumDe = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);
const anschrift = (b: Betrieb) => [b.strasse.trim(), [b.plz.trim(), b.ort.trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ");

/** Vor- und Nachname getrennt (letztes Wort = Name) – das Portal fragt beides einzeln ab. */
export function nameTeilen(voll: string): { name: string; vornamen: string } {
  const teile = voll.trim().split(/\s+/).filter(Boolean);
  if (teile.length < 2) return { name: teile[0] ?? "", vornamen: "" };
  return { name: teile[teile.length - 1] ?? "", vornamen: teile.slice(0, -1).join(" ") };
}

/**
 * Rechtsform für die Anmeldung: Datenblatt, dann „Mein Betrieb“, dann der Check. Mit Datenblatt ohne Angabe wie im
 * Datenblatt selbst „Einzelunternehmen“; ohne Datenblatt leer, wenn nirgends angegeben.
 */
export function rechtsformFuer(daten: Daten | undefined, b: Betrieb, profil: Profil): string {
  const roh = s(daten?.rechtsform) || s(b.rechtsform) || RECHTSFORM_CHECK[s(profil.rechtsform)] || "";
  return rechtsformAus(roh, RECHTSFORMEN) || (daten ? "Einzelunternehmen" : "");
}

export interface FelderEingabe {
  /** Werte des Datenblatts – undefined, solange es keins gibt */
  daten?: Daten;
  betrieb: Betrieb;
  profil: Profil;
}

/** Die Felder des Vordrucks GewA 1 mit den Werten des Betriebs, in der Reihenfolge des Vordrucks. */
export function gewerbeFelder({ daten: datenblatt, betrieb: b, profil }: FelderEingabe): OnlineFeld[] {
  const daten: Daten = datenblatt ?? {};
  const l: OnlineFeld[] = [];
  const feld = (f: Omit<OnlineFeld, "status"> & { status?: FeldStatus; pflicht?: boolean }) => {
    const { pflicht = true, ...rest } = f;
    const status: FeldStatus = f.status ?? (f.wert ? "ok" : pflicht ? "fehlt" : "entfaellt");
    l.push({ ...rest, wert: f.wert || null, status, ergaenzen: status === "fehlt" ? f.ergaenzen : undefined });
  };
  const rechtsform = rechtsformFuer(datenblatt, b, profil);
  const register = REGISTER_FORMEN.includes(rechtsform);
  const kapital = istKapitalgesellschaft(rechtsform, b.name);
  const eingetragen = profil["gesellschaft.handelsregister"] === "eingetragen";

  feld({ id: "rechtsform", nr: null, label: "Rechtsform", wert: rechtsform, hinweis: TEXT.go_h_rechtsform, ergaenzen: "datenblatt", datenblattFeld: "rechtsform" });
  if (register) {
    feld({ id: "registername", nr: 1, label: "Eingetragener Name mit Rechtsform", wert: s(b.name), hinweis: TEXT.go_h_registername, ergaenzen: "betrieb" });
    const reg = registerAus(b);
    // Gesellschaft in Gründung: noch kein Eintrag – dann gehört der Gesellschaftsvertrag zur Anmeldung
    if (!reg && kapital && !eingetragen) feld({ id: "register", nr: 2, label: "Registereintrag (Ort und Nummer)", wert: null, status: "entfaellt", hinweis: TEXT.go_h_register_gruendung });
    else feld({ id: "register", nr: 2, label: "Registereintrag (Ort und Nummer)", wert: reg, hinweis: TEXT.go_h_register, ergaenzen: "betrieb" });
  } else {
    feld({ id: "geschaeft", nr: 3, label: "Name des Geschäfts", wert: s(b.name), pflicht: false, hinweis: TEXT.go_h_geschaeft });
  }
  const { name, vornamen } = nameTeilen(s(daten.name) || s(b.verantwortlich));
  feld({ id: "name", nr: 4, label: "Name", wert: name, hinweis: kapital ? TEXT.go_h_name_gesellschaft : TEXT.go_h_name, ergaenzen: "datenblatt", datenblattFeld: "name" });
  feld({ id: "vornamen", nr: 5, label: "Vornamen", wert: vornamen, hinweis: TEXT.go_h_vornamen, ergaenzen: "datenblatt", datenblattFeld: "name" });
  feld({ id: "geschlecht", nr: 6, label: "Geschlecht", wert: null, status: "portal", hinweis: TEXT.go_h_geschlecht });
  feld({ id: "geburtsname", nr: 7, label: "Geburtsname", wert: s(daten.geburtsname), pflicht: false, hinweis: TEXT.go_h_geburtsname, datenblattFeld: "geburtsname" });
  feld({ id: "geburtsdatum", nr: 8, label: "Geburtsdatum", wert: datumDe(s(daten.geburtsdatum)), hinweis: TEXT.go_h_geburtsdatum, ergaenzen: "datenblatt", datenblattFeld: "geburtsdatum" });
  feld({ id: "geburtsort", nr: 9, label: "Geburtsort und -land", wert: s(daten.geburtsort), hinweis: TEXT.go_h_geburtsort, ergaenzen: "datenblatt", datenblattFeld: "geburtsort" });
  feld({ id: "staatsangehoerigkeit", nr: 10, label: "Staatsangehörigkeit", wert: s(daten.staatsangehoerigkeit), hinweis: TEXT.go_h_staatsangehoerigkeit, ergaenzen: "datenblatt", datenblattFeld: "staatsangehoerigkeit" });
  feld({ id: "wohnanschrift", nr: 11, label: "Anschrift der Wohnung", wert: s(daten.wohnanschrift).replace(/\s*\n\s*/g, ", "), hinweis: TEXT.go_h_wohnanschrift, ergaenzen: "datenblatt", datenblattFeld: "wohnanschrift" });
  if (kapital) feld({ id: "vertretung", nr: 12, label: "Gesetzliche Vertreter (Geschäftsführung)", wert: s(b.vertretung), hinweis: TEXT.go_h_vertretung, ergaenzen: "betrieb" });
  feld({ id: "betriebsstaette", nr: 15, label: "Betriebsstätte", wert: anschrift(b), hinweis: TEXT.go_h_betriebsstaette, ergaenzen: "betrieb" });
  feld({ id: "kontakt", nr: 15, label: "Telefon, E-Mail", wert: [b.telefon, b.email].map((x) => x.trim()).filter(Boolean).join(", "), pflicht: false, hinweis: TEXT.go_h_kontakt });
  feld({ id: "taetigkeit", nr: 18, label: "Angemeldete Tätigkeit", wert: s(daten.taetigkeit).replace(/\s*\n\s*/g, " "), hinweis: TEXT.go_h_taetigkeit, ergaenzen: "datenblatt", datenblattFeld: "taetigkeit" });
  const erwerb = s(daten.erwerb) || s(profil.erwerb);
  feld({ id: "erwerb", nr: 19, label: "Im Nebenerwerb?", wert: erwerb === "neben" ? "Ja, Nebenerwerb" : erwerb === "haupt" ? "Nein, Haupterwerb" : "", hinweis: TEXT.go_h_erwerb, ergaenzen: "datenblatt", datenblattFeld: "erwerb" });
  feld({ id: "beginn", nr: 20, label: "Beginn der Tätigkeit", wert: datumDe(s(daten.beginn) || s(profil.gruendungsdatum)), hinweis: TEXT.go_h_beginn, ergaenzen: "datenblatt", datenblattFeld: "beginn" });
  const handwerk = ["a", "b1", "b2"].includes(s(profil["handwerk.anlage"]));
  feld({ id: "art", nr: 21, label: "Art des Betriebs", wert: handwerk ? "Handwerk" : null, status: handwerk ? "ok" : "portal", hinweis: TEXT.go_h_art });
  const gesamt = profil["beschaeftigte.gesamt"];
  const personen = s(daten.beschaeftigte) || (typeof gesamt === "number" ? (gesamt === 0 ? "keine" : String(gesamt)) : "");
  feld({ id: "beschaeftigte", nr: 22, label: "Zahl der tätigen Personen", wert: personen, hinweis: TEXT.go_h_beschaeftigte, ergaenzen: "datenblatt", datenblattFeld: "beschaeftigte" });
  feld({ id: "niederlassung", nr: 23, label: "Die Anmeldung wird erstattet für", wert: null, status: "portal", hinweis: TEXT.go_h_niederlassung });
  feld({ id: "grund", nr: 25, label: "Grund der Neuerrichtung", wert: null, status: "portal", hinweis: TEXT.go_h_grund });
  // Erlaubnis bzw. Handwerkskarte: Pflichtangabe nur, wenn der Check eine nennt
  const paragraphen = Array.isArray(profil["erlaubnis.gewo_paragraphen"]) ? (profil["erlaubnis.gewo_paragraphen"] as string[]).filter((x) => x !== "keine") : [];
  const erlaubnisNoetig = paragraphen.length > 0 || s(profil["handwerk.anlage"]) === "a";
  // Feld 28 fragt nach der Erlaubnis, Feld 29 (nur Anlage A) nach der Handwerkskarte
  const nurHandwerkskarte = !paragraphen.length && s(profil["handwerk.anlage"]) === "a";
  feld({ id: "erlaubnis", nr: nurHandwerkskarte ? 29 : 28, label: nurHandwerkskarte ? "Handwerkskarte" : "Erlaubnis oder Handwerkskarte", wert: s(daten.erlaubnis), pflicht: erlaubnisNoetig, hinweis: erlaubnisNoetig ? TEXT.go_h_erlaubnis_noetig : TEXT.go_h_erlaubnis, ergaenzen: "datenblatt", datenblattFeld: "erlaubnis" });
  return l;
}

/** Text der Marke bei einem fehlenden Wert */
export const fehltText = (f: OnlineFeld) => (f.ergaenzen === "betrieb" ? TEXT.go_fehlt_betrieb : TEXT.go_fehlt_datenblatt);

/** Wie viele Pflichtangaben noch fehlen. */
export const fehlende = (felder: OnlineFeld[]) => felder.filter((f) => f.status === "fehlt");

/** Das jüngste Datenblatt (nicht storniert) – Grundlage der Werte. */
export function datenblattVon(s: Pick<Stand, "unterlagen">, id?: string): Unterlage | undefined {
  if (id) {
    const u = s.unterlagen.find((x) => x.id === id && x.vorlage === GEWERBE_VORLAGE);
    if (u) return u;
  }
  return s.unterlagen.filter((u) => u.vorlage === GEWERBE_VORLAGE && !u.storniertDurch).sort((a, b) => b.geaendert.localeCompare(a.geaendert))[0];
}

export interface Bedarf {
  id: "zugang" | "ausweis" | "register" | "gebuehr" | "erlaubnis";
  titel: string;
  text: string;
}

/** Gebühr: geprüfte Angabe der Gemeinde, sonst des Landesportals, sonst „je nach Gemeinde“. */
export const gebuehrText = (portal: Portal, gemeinde?: GemeindeGebuehr) => gemeinde?.text ?? portal.gebuehr ?? TEXT.go_b_gebuehr_text;

/**
 * „Das brauchst du“ – je nach Portal und Rechtsform. Erlaubnisse nur, wenn der Check welche nennt (`erlaubnisse`:
 * Kennungen der Katalogpflichten, die Seite verlinkt sie).
 */
export function bedarf(weg: Pick<Weg, "portal" | "gemeinde">, rechtsform: string, name = "", erlaubnisse: readonly string[] = []): Bedarf[] {
  const l: Bedarf[] = [{ id: "zugang", titel: TEXT.go_b_zugang, text: weg.portal.zugang }, { id: "ausweis", titel: TEXT.go_b_ausweis, text: TEXT.go_b_ausweis_text }];
  if (istKapitalgesellschaft(rechtsform, name)) l.push({ id: "register", titel: TEXT.go_b_register_kapital, text: TEXT.go_b_register_kapital_text });
  else if (REGISTER_FORMEN.includes(rechtsform)) l.push({ id: "register", titel: TEXT.go_b_register, text: TEXT.go_b_register_text });
  l.push({ id: "gebuehr", titel: TEXT.go_b_gebuehr, text: gebuehrText(weg.portal, weg.gemeinde) });
  if (erlaubnisse.length) l.push({ id: "erlaubnis", titel: TEXT.go_b_erlaubnis, text: TEXT.go_b_erlaubnis_text });
  return l;
}

/** Welche der Erlaubnis-Pflichten aus dem Katalog nach dem Check gelten (Reihenfolge wie `ERLAUBNIS_PFLICHTEN`). */
export const geltendeErlaubnisse = (geltend: readonly { id: string }[]) => ERLAUBNIS_PFLICHTEN.filter((id) => geltend.some((p) => p.id === id));

export interface Weg {
  land: LandErmittelt;
  portal: Portal;
  url: string;
  /** geprüfte Gebühr der Gemeinde, falls bekannt */
  gemeinde?: GemeindeGebuehr;
}

/** Portal für den Betrieb: Bundesland aus der PLZ (bei Grenzregionen mit der Angabe aus „Mein Betrieb“ bzw. dem Check). */
export function wegFuer(b: Betrieb, profil: Profil): Weg {
  const land = landErmitteln(b.plz, b.bundesland, profil.bundesland);
  const portal = portalFuer(land.land);
  return { land, portal, url: portalUrl(portal, b.plz), gemeinde: gemeindeGebuehr(b.ort, land.land) };
}

/** Tag der Anmeldung gültig? (TT.MM.JJJJ schon umgewandelt: ISO, nicht in der Zukunft) */
export function anmeldetagGueltig(iso: string | null, heute: string): boolean {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso && iso <= heute;
}

/** „Erledigt markieren“: die Pflicht mit dem Tag der Anmeldung abhaken (wie in der Pflicht selbst). */
export function gewerbeErledigt(st: Stand, tag: string, heute: string): Stand {
  if (!anmeldetagGueltig(tag, heute)) return st;
  return erledigtSetzen(st, GEWERBE_PFLICHT, tag);
}
