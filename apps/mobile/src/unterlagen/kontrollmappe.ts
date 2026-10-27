/**
 * Kontrollmappe: die aktuellen Nachweise für eine Kontrolle (Arbeitsschutz, Hygiene, Lebensmittel, Datenschutz,
 * Personal-Nachweise) in einem PDF – Deckblatt mit Inhaltsverzeichnis, danach die Unterlagen. Reine Funktionen (Auswahl,
 * Deckblatt, Zusammenfügen mit pdf-lib); die einzelnen PDFs erzeugt der Aufrufer auf dem Gerät.
 * Nicht in der Mappe: Rechnungen, Belege, Steuer- und Buchhaltungsunterlagen, Register- und Website-Texte.
 */
// CommonJS-Build wie in fusszeile.ts: die ESM-Variante von pdf-lib lässt sich von Metro nicht auflösen
import { kassenbuchAnzeige } from "./kassenbuchAnzeige";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib/cjs/index";
import { kassenSortiert, kassenSummen, kassenVermerk, zeitDe, type Kassenabschluss, type Kassensturz } from "@amtlos/fachlogik";
import { BEREICHE, BESCHAEFTIGUNGSARTEN, htmlMaskieren, belegNummern, cent, dateinamenTeil, kassenStandorte, kassenbuchDaten, standortVon, monatAus, monatsName, unterlagenName, vorlageFuer, type Beleg, type Bereich, type Daten, type Person, type Vorlage } from "@amtlos/fachlogik";
import { euroText as euro } from "./ablage";
import { fehltFuer } from "./pruefung";
import { HAUPT_STAETTE, NACHWEIS_MONATE, geteiltAm, heute as heuteBerlin, kassenbuchFest, nichtZaehlend, staetteVon, type Stand, type Unterlage } from "./speicher";
import { MARKE } from "@amtlos/marke";

/** Bereiche, deren Unterlagen bei Kontrollen (Gewerbeaufsicht, BG, Lebensmittelüberwachung, Datenschutz) vorzulegen sind */
const MAPPE_BEREICHE: Bereich[] = ["arbeitsschutz", "beauty", "gastro", "personal", "datenschutz"];
/** aus „Personal“ nur die Nachweise – Lohnkonto und Personalfragebogen sind Lohn- bzw. Meldedaten, keine Kontrollnachweise */
const PERSONAL_NACHWEISE = new Set(["arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ki_kompetenz", "ausweis_hinweis"]);
/** Text für die eigene Website bzw. Gesundheitsangaben von Kundinnen (R11) – kein Nachweis für eine Kontrolle */
const NICHT_IN_MAPPE = new Set(["datenschutzerklaerung_website", "anamnese_einwilligung"]);
/** Namensfelder, die nur den Zeitraum bzw. Tag benennen: dann zählt nur die neueste Fassung (z. B. HACCP je Monat) */
const ZEIT_FELDER = new Set(["zeitraum", "datum", "jahr", "stichtag"]);
/** Datum, das eine Unterlage trägt („Stand“, „Datum“) – in dieser Reihenfolge */
const DATUM_FELDER = ["stand", "datum", "ausgestellt_am", "entdeckt_am"];

/** Gehört eine Vorlage in die Kontrollmappe? Nach Bereich; Kundendokumente und Festgeschriebenes (Rechnung, Kassenbuch) nie. */
export function gehoertInMappe(v: Vorlage): boolean {
  // R12: festgeschriebene Nachweise (Arbeitszeit, NachwG, Ausweis-Hinweis) schon – nur Rechnung und Kassenbuch nicht
  if (v.kundendokument || (v.festschreiben && !v.korrektur) || NICHT_IN_MAPPE.has(v.id)) return false;
  if (v.bereich === "personal") return PERSONAL_NACHWEISE.has(v.id);
  return MAPPE_BEREICHE.includes(v.bereich);
}

export interface MappenEintrag {
  id: string;
  vorlage: string;
  titel: string;
  bereich: Bereich;
  /** Datum der Unterlage (YYYY-MM-DD): Stand bzw. Datum im Dokument, sonst wann geteilt bzw. zuletzt geändert */
  datum: string;
  /** schon geteilt oder gedruckt (sonst: vollständig, aber noch nicht ausgegeben) */
  geteilt: boolean;
  /** R12: ohne gespeicherte Unterlage – Inhalt für das PDF (Kassenbuch aus den Tagesabschlüssen; frühere Fassung) */
  daten?: Daten;
  /** R12 Personal: Tag, an dem die Fassung geteilt bzw. festgeschrieben wurde (YYYY-MM-DD) */
  geteiltAm?: string;
  /** R12: Arbeitszeitnachweis – letzter aufgezeichneter Arbeitstag (Zoll #12) */
  aufzeichnungBis?: string;
  /** R12: NachwG-Nachweis – gültig ab (Zoll #9) */
  gueltigAb?: string;
  /** R12: Korrektur in Arbeit – in die Mappe kommt die zuletzt festgeschriebene Fassung */
  korrekturLaeuft?: boolean;
  /** R12: zugeordnete Betriebsstätte (ID; ohne Angabe: Betrieb allgemein) */
  staette?: string;
  /** R12: Datei statt Vorlage (Kopie des Aufenthaltstitels, Entsorgungsbeleg) */
  datei?: { name: string; titel: string };
  /** R12: fertiges HTML statt Vorlage (Übersicht der Entsorgungsbelege) */
  html?: string;
}

export interface MappenAuswahl {
  eintraege: MappenEintrag[];
  /** Unterlagen passender Vorlagen, die weder geteilt noch vollständig sind – sie fehlen in der Mappe */
  unvollstaendig: number;
  /** R11 (UX #5): dieselben Unterlagen einzeln – mit der Zahl fehlender Angaben, zum Ergänzen */
  unvollstaendigListe: { id: string; vorlage: string; titel: string; fehlt: number }[];
}

/**
 * Arbeitszeitnachweise (R11, Reinigung #2): je Person und Monat ein eigener Eintrag – die FKS prüft alle Monate, nicht
 * nur den letzten. Aufbewahrt werden die Aufzeichnungen mindestens zwei Jahre (§ 17 Abs. 1 MiLoG); ältere gehören nicht
 * mehr in die Mappe.
 */
const JE_MONAT = new Set(["arbeitszeitnachweis"]);
const MONATE_IN_MAPPE = 24;

/** Neuester Arbeitstag eines Nachweises (YYYY-MM-DD) oder null. */
function letzterTag(u: Unterlage): string | null {
  const tage = Array.isArray(u.daten.tage) ? (u.daten.tage as { datum?: unknown }[]).map((x) => x?.datum).filter(istDatum).map((d) => d.slice(0, 10)).sort() : [];
  return tage.at(-1) ?? null;
}

function minusMonate(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1 - n, Math.min(t, 28))).toISOString().slice(0, 10);
}

const istDatum = (w: unknown): w is string => typeof w === "string" && /^\d{4}-\d{2}-\d{2}/.test(w);

function datumVon(u: Unterlage): string {
  for (const k of DATUM_FELDER) if (istDatum(u.daten[k])) return (u.daten[k] as string).slice(0, 10);
  if (JE_MONAT.has(u.vorlage)) {
    const t = letzterTag(u);
    if (t) return t;
  }
  return (u.ausgegeben ?? u.geaendert).slice(0, 10);
}

/**
 * Weiteres Feld, das bei Vorlagen mit Zeitangabe als Namensfeld eigene Fassungen trennt: Prüfprotokolle je
 * Einsatzbereich (z. B. Werkstatt und Baustelle) – sonst stünde nur das neueste Protokoll in der Mappe.
 */
const GRUPPE_ZUSATZ: Record<string, string> = { pruefprotokoll_elektro: "einsatz" };

/** Gruppe einer Unterlage: Vorlage plus Namensfeld (Arbeitsbereich, Thema, Person …) – Zeitangaben fassen zusammen. */
function gruppe(v: Vorlage, u: Unterlage): string {
  const feld = v.namensFeld && !ZEIT_FELDER.has(v.namensFeld) ? u.daten[v.namensFeld] : null;
  const name = typeof feld === "string" ? feld.trim().split("\n")[0]!.toLocaleLowerCase("de") : "";
  const z = JE_MONAT.has(v.id) ? monatAus(u.daten) : GRUPPE_ZUSATZ[v.id] ? u.daten[GRUPPE_ZUSATZ[v.id]!] : null;
  return `${v.id}\u0000${name}${typeof z === "string" && z.trim() ? `\u0000${z.trim().toLocaleLowerCase("de")}` : ""}`;
}

/** Name in der Mappe: bei Nachweisen je Monat mit dem Monat (R12: steht schon im Namen, „Arbeitszeitnachweis Oktober 2026 · Amira“). */
function mappenTitel(v: Vorlage, u: Pick<Unterlage, "daten">): string {
  const name = unterlagenName(v, u.daten);
  const monat = JE_MONAT.has(v.id) ? monatAus(u.daten) : "";
  return monat && !name.includes(monat) ? `${name} · ${monat}` : name;
}

const gleicherName = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.trim() !== "" && a.trim().toLocaleLowerCase("de") === b.trim().toLocaleLowerCase("de");
/** Vorlagen, die eine beschäftigte Person betreffen – ihre Betriebsstätte gilt, wenn die Unterlage selbst keine hat. */
const PERSONEN_NACHWEISE = new Set(["arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ausweis_hinweis", "lohnkonto", "ifsg_belehrung"]);

/** R12: Betriebsstätte einer Unterlage – eigene Zuordnung, sonst die der Person. */
function staetteVonUnterlage(u: Unterlage, mitarbeiter: readonly Person[]): string | undefined {
  if (u.betriebsstaette) return u.betriebsstaette;
  if (!PERSONEN_NACHWEISE.has(u.vorlage)) return undefined;
  const p = mitarbeiter.find((m) => gleicherName(m.name, u.daten.name));
  return typeof p?.betriebsstaette === "string" && p.betriebsstaette ? p.betriebsstaette : undefined;
}

const tag = (iso?: string | null) => (iso ? iso.slice(0, 10) : undefined);

/**
 * Je Vorlage (und Namensfeld) die neueste geteilte Unterlage; ist keine geteilt, die neueste vollständige. Sortiert nach
 * Bereich (Reihenfolge wie in „Vorlagen“) und Titel.
 */
export function mappenAuswahl(teil: Pick<Stand, "unterlagen" | "betrieb"> & Partial<Pick<Stand, "mitarbeiter" | "profil">>, heute = heuteBerlin()): MappenAuswahl {
  // fehltFuer liest auch das Profil (Rechtsform, Handelsregister) – Aufrufer mit Teilständen (Heute) haben keins
  const s = { profil: {}, mitarbeiter: [], ...teil } as unknown as Stand;
  const beste = new Map<string, { u: Unterlage; v: Vorlage; geteilt: boolean; zeit: string }>();
  const ohne = new Set<string>();
  const grenze = minusMonate(heute, MONATE_IN_MAPPE);
  const mitarbeiter = s.mitarbeiter;
  // Konfliktkopien (K1) gelten nicht – in die Mappe kommt nur die gültige Fassung
  const aus = nichtZaehlend(s.unterlagen);
  // R12 (Zoll #9): NachwG-Nachweise nicht je Person zusammenfassen – alle Fassungen der letzten 24 Monate
  const nachwg: { u: Unterlage; v: Vorlage; daten: Daten; geteilt: boolean; am?: string; id: string; korrektur?: boolean }[] = [];
  for (const u of s.unterlagen) {
    if (aus.has(u.id)) continue;
    const v = vorlageFuer(u.vorlage);
    if (!v || !gehoertInMappe(v)) continue;
    // Arbeitszeit älter als zwei Jahre: Aufbewahrungsfrist nach § 17 MiLoG vorbei – nicht mehr in die Mappe
    if (JE_MONAT.has(v.id)) {
      const t = letzterTag(u);
      if (t && t < grenze) continue;
    }
    // R12: Korrektur in Arbeit – es gilt die zuletzt festgeschriebene Fassung
    const korrektur = !u.festgeschrieben && Boolean(u.fassungen?.length);
    const geteilt = Boolean(u.ausgegeben || u.festgeschrieben);
    if (v.id === "nachweis_arbeitsbedingungen") {
      for (const [i, f] of (u.fassungen ?? []).entries()) if (f.ersetzt.slice(0, 10) >= grenze) nachwg.push({ u, v, daten: f.daten, geteilt: true, am: tag(f.festgeschrieben), id: `${u.id}#${i + 1}` });
      if (korrektur) continue;
      if (!geteilt && fehltFuer(s, u).length) {
        ohne.add(u.id);
        continue;
      }
      nachwg.push({ u, v, daten: u.daten, geteilt, am: tag(geteiltAm(u)), id: u.id });
      continue;
    }
    const g = gruppe(v, u);
    if (!korrektur && !geteilt && fehltFuer(s, u).length) {
      ohne.add(u.id);
      continue;
    }
    const zeit = korrektur ? u.fassungen!.at(-1)!.festgeschrieben : geteilt ? (u.festgeschrieben ?? u.ausgegeben)! : u.geaendert;
    const bisher = beste.get(g);
    // geteilt schlägt vollständig; sonst die jüngere
    const gt = geteilt || korrektur;
    if (!bisher || (gt && !bisher.geteilt) || (gt === bisher.geteilt && zeit > bisher.zeit)) beste.set(g, { u, v, geteilt: gt, zeit });
  }
  const rang = (b: Bereich) => BEREICHE.findIndex((x) => x.id === b);
  const eintraege: MappenEintrag[] = [...beste.values()].map(({ u, v, geteilt }) => {
    const korrektur = !u.festgeschrieben && Boolean(u.fassungen?.length);
    const f = korrektur ? u.fassungen!.at(-1)! : null;
    const daten = f ? f.daten : u.daten;
    const st = staetteVonUnterlage(u, mitarbeiter);
    const e: MappenEintrag = { id: u.id, vorlage: v.id, titel: mappenTitel(v, { daten }), bereich: v.bereich, datum: datumVon(f ? { ...u, daten } : u), geteilt };
    if (f) Object.assign(e, { daten, korrekturLaeuft: true, geteiltAm: tag(f.festgeschrieben) });
    else if (geteilt) e.geteiltAm = tag(geteiltAm(u));
    if (JE_MONAT.has(v.id)) {
      const t = letzterTag({ ...u, daten });
      if (t) e.aufzeichnungBis = t;
    }
    if (st) e.staette = st;
    return e;
  });
  // NachwG: je Person die Fassungen nach Datum; „gültig ab“: die erste ab Beginn, spätere ab Ausstellung bzw. Festschreibung
  // – geteilte Fassungen; ein Entwurf nur, wenn es für die Person noch keine geteilte gibt
  const jePerson = new Map<string, typeof nachwg>();
  for (const n of nachwg) {
    const k = typeof n.daten.name === "string" ? n.daten.name.trim().toLocaleLowerCase("de") : "";
    jePerson.set(k, [...(jePerson.get(k) ?? []), n]);
  }
  for (const liste of jePerson.values()) {
    const geteilte = liste.filter((n) => n.geteilt);
    const l = (geteilte.length ? geteilte : [...liste].sort((a, b) => b.u.geaendert.localeCompare(a.u.geaendert)).slice(0, 1))
      .map((n) => ({ ...n, ab: (typeof n.daten.ausgestellt_am === "string" && n.daten.ausgestellt_am) || n.am || n.u.geaendert.slice(0, 10) }))
      .sort((a, b) => a.ab.localeCompare(b.ab) || (a.am ?? "").localeCompare(b.am ?? ""));
    l.forEach((n, i) => {
      const beginn = typeof n.daten.beginn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(n.daten.beginn) ? n.daten.beginn : "";
      const ab = i === 0 && beginn ? beginn : n.ab;
      // eine Fassung, die schon vor dem Prüfzeitraum von einer neueren abgelöst wurde, fällt weg
      const naechste = l[i + 1];
      if (naechste && naechste.ab < grenze) return;
      const st = staetteVonUnterlage(n.u, mitarbeiter);
      const e: MappenEintrag = { id: n.id, vorlage: n.v.id, titel: `${unterlagenName(n.v, n.daten)} · gültig ab ${datumDe(ab)}`, bereich: n.v.bereich, datum: ab, geteilt: n.geteilt, gueltigAb: ab, ...(n.am && n.geteilt ? { geteiltAm: n.am } : {}), ...(n.id !== n.u.id ? { daten: n.daten } : {}), ...(st ? { staette: st } : {}) };
      eintraege.push(e);
    });
  }
  // NachwG-Fassungen derselben Person nach „gültig ab“ (nicht nach dem Text des Titels)
  const ohneAb = (x: MappenEintrag) => (x.gueltigAb ? x.titel.replace(/ · gültig ab .*$/, "") : x.titel);
  eintraege.sort((a, b) => rang(a.bereich) - rang(b.bereich) || ohneAb(a).localeCompare(ohneAb(b), "de") || (a.gueltigAb && b.gueltigAb ? a.gueltigAb.localeCompare(b.gueltigAb) : 0) || a.titel.localeCompare(b.titel, "de") || b.datum.localeCompare(a.datum));
  // eine unvollständige Unterlage zählt nicht als fehlend, wenn ihre Gruppe schon eine bessere Fassung hat
  const vertreten = new Set([...beste.keys()]);
  const nachwgDa = new Set([...jePerson.keys()]);
  const unvollstaendigListe: MappenAuswahl["unvollstaendigListe"] = [];
  for (const id of ohne) {
    const u = s.unterlagen.find((x) => x.id === id)!;
    const v = vorlageFuer(u.vorlage)!;
    const da = v.id === "nachweis_arbeitsbedingungen" ? nachwgDa.has(typeof u.daten.name === "string" ? u.daten.name.trim().toLocaleLowerCase("de") : "") : vertreten.has(gruppe(v, u));
    if (!da) unvollstaendigListe.push({ id: u.id, vorlage: v.id, titel: mappenTitel(v, u), fehlt: fehltFuer(s, u).length });
  }
  unvollstaendigListe.sort((a, b) => rang(vorlageFuer(a.vorlage)!.bereich) - rang(vorlageFuer(b.vorlage)!.bereich) || a.titel.localeCompare(b.titel, "de"));
  return { eintraege, unvollstaendig: unvollstaendigListe.length, unvollstaendigListe };
}

/**
 * R11 (Berater d): „Kontrollbereit: x von y Nachweisen“ – x: Unterlagen, die in die Mappe kommen; y: dazu die offenen
 * Pflichten mit Vorlage, die für eine Kontrolle noch fehlen, und unvollständige Unterlagen ohne fertige Fassung.
 */
export function kontrollbereit(s: Pick<Stand, "unterlagen" | "betrieb"> & Partial<Pick<Stand, "profil">>, offen: readonly PflichtMitVorlagen[], heute = heuteBerlin()): { da: number; gesamt: number } {
  const a = mappenAuswahl(s, heute);
  const fehlt = fehltInMappe(offen, a.eintraege, "alle");
  // eine unvollständige Unterlage, deren Vorlage schon unter „fehlt“ steht, nicht doppelt zählen
  const fehltVorlagen = new Set(fehlt.map((x) => x.vorlage));
  const halb = a.unvollstaendigListe.filter((x) => !fehltVorlagen.has(x.vorlage)).length;
  return { da: a.eintraege.length, gesamt: a.eintraege.length + fehlt.length + halb };
}

/**
 * R11 (Tischlerei #22): Nachweise für eine BG-Besichtigung, für die es keine Vorlage in Amtlos gibt – nur zum Abhaken
 * („vorhanden“), ohne Aussage, ob und in welcher Form sie im Einzelfall verlangt sind. Gespeichert wie ein Haken unter
 * `erledigt` mit dem Schlüssel `nachweis.bg.<id>`.
 */
export const BG_NACHWEISE: { id: string; titel: string; /** R12: nur für diese Branchen anbieten (sonst allen) */ branchen?: string[]; /** R12: Haken dieser Pflichten („Was hast du schon?“) gelten als vorhanden */ pflichten?: string[] }[] = [
  { id: "betreuung", titel: "Betreuung durch Fachkraft für Arbeitssicherheit und Betriebsarzt", pflichten: ["arbeitsschutz.fasi_betriebsarzt"] },
  { id: "ersthelfer", titel: "Ersthelfer im Betrieb", pflichten: ["arbeitsschutz.erste_hilfe"] },
  { id: "verbandbuch", titel: "Verbandbuch (Dokumentation der Erste-Hilfe-Leistungen)" },
  { id: "pruefungen", titel: "Prüfnachweise für Arbeitsmittel (z. B. Leitern, Maschinen, Absaugung, Feuerlöscher)", pflichten: ["arbeitsschutz.arbeitsmittel_pruefen", "arbeitsschutz.dguv_v3"] },
  { id: "vorsorge", titel: "Nachweise zur arbeitsmedizinischen Vorsorge", pflichten: ["arbeitsschutz.arbeitsmedizinische_vorsorge"] },
  // R12 (Kfz #5): Werkstatt
  { id: "hebebuehne", titel: "Prüfbuch Hebebühne (jährliche Prüfung durch eine befähigte Person)", branchen: ["handwerk", "bau"] },
  { id: "druckbehaelter", titel: "Prüfnachweise Druckbehälter (z. B. Kompressor, Druckluftbehälter)", branchen: ["handwerk", "bau"] },
  { id: "hochvolt", titel: "Qualifikationsnachweise für Arbeiten an Hochvolt-Fahrzeugen", branchen: ["handwerk"] },
];
export const BG_SCHLUESSEL = (id: string) => `nachweis.bg.${id}`;

/** Datum eines Hakens („Datum|Termin“ → Datum). */
const hakenDatum = (w: string | undefined) => (w ? w.split("|")[0]! : null);

/** R12 (UX #6): Ist ein Nachweis ohne Vorlage vorhanden – selbst abgehakt oder über die passende Pflicht („Was hast du schon?“)? Liefert das Datum. */
export function bgVorhandenAm(erledigt: Record<string, string>, n: (typeof BG_NACHWEISE)[number]): string | null {
  return hakenDatum(erledigt[BG_SCHLUESSEL(n.id)]) ?? (n.pflichten ?? []).map((p) => hakenDatum(erledigt[p])).find(Boolean) ?? null;
}
/** Titel der als vorhanden markierten BG-Nachweise. */
export const bgVorhanden = (erledigt: Record<string, string>) => BG_NACHWEISE.filter((n) => bgVorhandenAm(erledigt, n)).map((n) => n.titel);
/** R12: BG-Nachweise passend zum Betrieb – Werkstatt-Nachweise nur im Handwerk; Abgehaktes immer. */
export function bgNachweiseFuer(profil: Stand["profil"], erledigt: Record<string, string>) {
  const br = Array.isArray(profil["taetigkeit.branchen"]) ? (profil["taetigkeit.branchen"] as string[]) : [];
  return BG_NACHWEISE.filter((n) => !n.branchen || !br.length || n.branchen.some((b) => br.includes(b)) || Boolean(bgVorhandenAm(erledigt, n)));
}

/**
 * R12 (Kfz #5): Umwelt und Abfall – Nachweise ohne Vorlage in Amtlos zum Abhaken (Schlüssel `nachweis.umwelt.<id>`).
 * Entsorgungsbelege kommen aus den Belegen (Lieferant oder Notiz mit „Entsorgung“, „Abfall“ …).
 */
export const UMWELT_NACHWEISE: { id: string; titel: string }[] = [
  { id: "entsorgungsnachweise", titel: "Entsorgungs- und Übernahmescheine für gefährliche Abfälle (z. B. Altöl, Batterien, Lösemittel)" },
  { id: "abfallregister", titel: "Register bzw. Nachweisbuch der Abfälle (§ 49 KrWG, Nachweisverordnung)" },
  { id: "abscheider", titel: "Prüfung und Wartung des Abscheiders (Öl- bzw. Fettabscheider, Betriebstagebuch)" },
  { id: "gewerbeabfall", titel: "Dokumentation der Getrenntsammlung (Gewerbeabfallverordnung)" },
  { id: "gefahrstofflager", titel: "Lagerung wassergefährdender Stoffe (Auffangwannen, Prüfungen)" },
];
export const UMWELT_SCHLUESSEL = (id: string) => `nachweis.umwelt.${id}`;
export const umweltVorhanden = (erledigt: Record<string, string>) => UMWELT_NACHWEISE.map((n) => ({ titel: n.titel, am: hakenDatum(erledigt[UMWELT_SCHLUESSEL(n.id)]) ?? undefined })).filter((n) => n.am);

/** R12: Beleg einer Entsorgung (Lieferant, Notiz oder Nummer nennen Entsorgung, Abfall, Altöl, Container …). */
const ENTSORGUNG = /entsorg|abfall|altöl|altoel|recycling|container|abscheider|sondermüll|sondermuell|wertstoff/i;
export const entsorgungsbelege = (belege: readonly Beleg[], heute = heuteBerlin()) => belege.filter((b) => !b.ungueltig && b.datum >= minusMonate(heute, 60) && ENTSORGUNG.test(`${b.lieferant} ${b.notiz ?? ""}`)).sort((a, b) => b.datum.localeCompare(a.datum));

/**
 * Kontrollarten (R10): Jede Stelle bekommt nur, was sie prüft – die Lebensmittelkontrolle keine Gehälter (Datenminimierung,
 * Art. 5 Abs. 1 lit. c DSGVO). „alle“ bündelt wie bisher alles.
 */
export type Kontrollart = "alle" | "hygiene" | "zoll" | "bg" | "datenschutz" | "kasse" | "umwelt";
export const KONTROLLARTEN: Kontrollart[] = ["alle", "hygiene", "zoll", "bg", "umwelt", "datenschutz", "kasse"];
const JE_KONTROLLE: Record<Exclude<Kontrollart, "alle" | "kasse">, ReadonlySet<string>> = {
  // Prüfbericht Lebensmittelhygiene (22.10.2026, Frage 15): dazu der Schulungsnachweis nach § 4 LMHV
  hygiene: new Set(["ifsg_belehrung", "hygieneschulung", "allergene", "haccp", "hygieneplan"]),
  // R12: dazu Kopien der Aufenthaltstitel und – auf Verlangen – Lohnkonten (eigene Einträge ohne Vorlage)
  zoll: new Set(["arbeitszeitnachweis", "nachweis_arbeitsbedingungen", "ausweis_hinweis", "aufenthaltstitel", "lohnkonto"]),
  umwelt: new Set(["entsorgungsbelege", "gefahrstoffverzeichnis"]),
  // E-167: Betriebsanweisungen für Maschinen und Biostoffe, Expositionsverzeichnis
  bg: new Set(["gefaehrdungsbeurteilung", "unterweisung", "gefahrstoffverzeichnis", "betriebsanweisung", "betriebsanweisung_maschine", "betriebsanweisung_biostoffe", "expositionsverzeichnis", "pruefprotokoll_elektro", "hautschutzplan"]),
  datenschutz: new Set(["datenschutz_dokumentation", "avv", "datenschutzinformation", "datenpanne"]),
};

/**
 * Prüfbericht Lebensmittelhygiene (22.10.2026, Frage 15): Steht eine Belehrung nach § 43 IfSG in der Mappe, erinnert das
 * Deckblatt an die Bescheinigungen des Gesundheitsamts – sie gibt es nur auf Papier und gehören dazu (§ 43 Abs. 5 IfSG).
 */
export const mitIfsgBescheinigungen = (vorlagen: readonly string[]) => vorlagen.includes("ifsg_belehrung");

/** Gehört eine Vorlage in die Mappe für diese Kontrollart? */
export function fuerKontrolle(vorlageId: string, art: Kontrollart): boolean {
  const v = vorlageFuer(vorlageId);
  if (art === "kasse") return KASSEN_VORLAGEN.has(vorlageId);
  // R12: Einträge ohne Vorlage – Aufenthaltstitel (Zoll, Alle), Lohnkonto nur in der Zoll-Mappe, Entsorgungsbelege (Umwelt)
  if (vorlageId === "aufenthaltstitel") return art === "zoll" || art === "alle";
  if (vorlageId === "lohnkonto") return art === "zoll";
  if (vorlageId === "entsorgungsbelege") return art === "umwelt";
  if (!v || !gehoertInMappe(v)) return false;
  return art === "alle" || JE_KONTROLLE[art].has(vorlageId);
}

/** R12: Vorlagen der Kassennachschau */
const KASSEN_VORLAGEN = new Set(["kassenbuch", "kassenmeldung", "verfahrensdokumentation", "tagesabschluesse", "kassensturz"]);

/**
 * R12: Mappe für die Kassennachschau (§ 146b AO) – nur, was es gibt: Kassenbuch je Monat aus den Tagesabschlüssen
 * (höchstens 24 Monate), selbst geführte Kassenbücher anderer Monate, die neueste Kassenmeldung und
 * Verfahrensdokumentation. Neueste zuerst.
 */
export function kassenMappe(s: Pick<Stand, "unterlagen" | "kasse" | "belege" | "belegArchiv" | "betrieb"> & Partial<Pick<Stand, "kassenstuerze">>, heute = heuteBerlin()): MappenEintrag[] {
  const grenze = minusMonate(heute, MONATE_IN_MAPPE).slice(0, 7);
  // R12 GoBD: keine Monate nach heute
  const monate = [...new Set(s.kasse.map((k) => k.datum.slice(0, 7)))].filter((m) => m >= grenze && m <= heute.slice(0, 7)).sort((a, b) => b.localeCompare(a));
  const nummern = belegNummern([...s.belege, ...s.belegArchiv]);
  const aus: MappenEintrag[] = [];
  // R12 GoBD (Kassennachschau): zuerst der letzte Kassensturz mit Zählprotokoll, dann die Tagesabschlüsse des laufenden
  // und des Vormonats mit Z-Nummer, TSE, Erfassung und Korrekturen
  const sturz = s.kassenstuerze?.length ? s.kassenstuerze[s.kassenstuerze.length - 1]! : null;
  if (sturz) aus.push({ id: `kassensturz-${sturz.id}`, vorlage: "kassensturz", titel: `Kassensturz vom ${zeitDe(sturz.zeitpunkt)} (Zählprotokoll)`, bereich: "steuern", datum: sturz.zeitpunkt.slice(0, 10), geteilt: true, html: kassensturzHtml(sturz, s.betrieb.name) });
  const vormonat = minusMonate(`${heute.slice(0, 7)}-01`, 1).slice(0, 7);
  const tage = kassenSortiert(s.kasse.filter((k) => k.datum.slice(0, 7) >= vormonat && k.datum <= heute));
  if (tage.length) aus.push({ id: "tagesabschluesse", vorlage: "tagesabschluesse", titel: `Tagesabschlüsse ${monatsName(vormonat)} und ${monatsName(heute.slice(0, 7))} (Z-Nummer, TSE, Korrekturen)`, bereich: "steuern", datum: tage[tage.length - 1]!.datum, geteilt: true, html: tagesabschluesseHtml(tage, s.betrieb.name, heute) });
  // je Monat und Standort (Filiale) ein Kassenbuch
  for (const m of monate)
    for (const st of kassenStandorte(s.kasse)) {
      const d = kassenbuchDaten(s.kasse, s.belege, m, nummern, st);
      if (!d) continue;
      const letzter = s.kasse.filter((k) => k.datum.startsWith(m) && standortVon(k) === st).reduce((x, k) => (k.datum > x ? k.datum : x), `${m}-01`);
      aus.push({ id: `kassenbuch-${m}${st ? `-${st}` : ""}`, vorlage: "kassenbuch", titel: `Kassenbuch ${monatsName(m)}${st ? ` · ${st}` : ""} (aus den Tagesabschlüssen)`, bereich: "steuern", datum: letzter, geteilt: false, daten: kassenbuchAnzeige(s, d as unknown as Daten, kassenbuchFest(s, m, st), st) });
    }
  const erzeugt = new Set(monate.map((m) => monatsName(m).toLocaleLowerCase("de")));
  const aus2 = nichtZaehlend(s.unterlagen);
  const neueste = new Map<string, Unterlage>();
  for (const u of s.unterlagen) {
    if (aus2.has(u.id) || !KASSEN_VORLAGEN.has(u.vorlage)) continue;
    const z = typeof u.daten.zeitraum === "string" ? u.daten.zeitraum.trim().toLocaleLowerCase("de") : "";
    if (u.vorlage === "kassenbuch" && (!z || erzeugt.has(z))) continue;
    const g = u.vorlage === "kassenbuch" ? `kassenbuch|${z}` : u.vorlage;
    const zeit = (x: Unterlage) => `${x.ausgegeben || x.festgeschrieben ? "1" : "0"}${x.ausgegeben ?? x.geaendert}`;
    const b = neueste.get(g);
    if (!b || zeit(u) > zeit(b)) neueste.set(g, u);
  }
  for (const u of neueste.values()) {
    const v = vorlageFuer(u.vorlage)!;
    aus.push({ id: u.id, vorlage: v.id, titel: unterlagenName(v, u.daten), bereich: v.bereich, datum: datumVon(u), geteilt: Boolean(u.ausgegeben || u.festgeschrieben) });
  }
  return aus;
}

const euroPlain = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const MAPPE_STIL = `<style>body{font-family:"Amtlos Sans",Helvetica,Arial,sans-serif;color:#1f2a33;font-size:9pt;margin:0}h1{font-family:"Amtlos Serif",Georgia,serif;font-size:18pt;margin:0 0 2mm}p{color:#5b6670;margin:0 0 5mm}table{width:100%;border-collapse:collapse}th{font-size:8pt;text-align:left;color:#5b6670;border-bottom:.4mm solid #1f2a33;padding:0 1.5mm 1.5mm}td{padding:1.5mm;border-bottom:.3mm solid #d6dbe0;vertical-align:top}.r{text-align:right;white-space:nowrap}</style>`;

/** R12 GoBD: Liste der Tagesabschlüsse für die Kassennachschau (Z-Nummer, TSE, Umsatz, Zahlungsarten, Erfassung, Korrekturen). */
export function tagesabschluesseHtml(l: readonly Kassenabschluss[], betrieb: string, heute: string): string {
  const zeilen = l
    .map((k) => {
      const sm = kassenSummen(k);
      const tse = [k.tse_seriennr ? `TSE ${k.tse_seriennr}` : "", k.tse_von || k.tse_bis ? `TA ${k.tse_von ?? ""}–${k.tse_bis ?? ""}` : ""].filter(Boolean).join(", ");
      return `<tr><td>${esc(datumDe(k.datum))}${k.standort ? `<br>${esc(k.standort)}` : ""}</td><td>${k.geschlossen ? "geschlossen" : esc(k.zbon ?? (k.kassenbericht ? "Kassenbericht" : ""))}</td><td>${esc(tse)}</td><td class="r">${euroPlain(sm.brutto)}</td><td class="r">${euroPlain(sm.karte)}</td><td class="r">${euroPlain(sm.bar)}</td><td>${esc(kassenVermerk(k))}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Tagesabschlüsse</title><meta name="amtlos-gestalt" content="nachweis"><meta name="amtlos-fuss-links" content="${esc(`${betrieb.trim() || "Betrieb"} · Tagesabschlüsse`)}"><meta name="amtlos-fuss-rechts" content="${esc(`Stand ${datumDe(heute)}`)}">${MAPPE_STIL}</head><body>
<h1>Tagesabschlüsse</h1><p>${esc(betrieb.trim() || "Betrieb")} · aus ${MARKE.name}, festgeschrieben beim Speichern · ${l.length} ${l.length === 1 ? "Abschluss" : "Abschlüsse"}. Die Einzelaufzeichnungen, der DSFinV-K-Export und die Programmierprotokolle liegen im Kassensystem.</p>
<table><thead><tr><th>Tag</th><th>Z-Bon</th><th>TSE</th><th class="r">Umsatz</th><th class="r">Karte</th><th class="r">Bar</th><th>Erfasst, festgeschrieben, Korrekturen</th></tr></thead><tbody>${zeilen}</tbody></table></body></html>`;
}

/** R12 GoBD: Zählprotokoll eines Kassensturzes. */
export function kassensturzHtml(k: Kassensturz, betrieb: string): string {
  const st = Object.entries(k.stueckelung ?? {}).sort((a, b) => Number(b[0]) - Number(a[0]));
  const wert = (w: number) => (w >= 100 ? `${w / 100} €` : `${w} ct`);
  const tabelle = st.length ? `<table><thead><tr><th>Schein/Münze</th><th class="r">Anzahl</th><th class="r">Betrag</th></tr></thead><tbody>${st.map(([w, n]) => `<tr><td>${wert(Number(w))}</td><td class="r">${n}</td><td class="r">${euroPlain(Number(w) * n)}</td></tr>`).join("")}<tr><td><strong>Summe</strong></td><td></td><td class="r"><strong>${euroPlain(k.gezaehlt_cent)}</strong></td></tr></tbody></table>` : `<p><strong>Gezählter Bestand: ${euroPlain(k.gezaehlt_cent)}</strong> (ohne Stückelung)</p>`;
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Kassensturz</title><meta name="amtlos-gestalt" content="nachweis"><meta name="amtlos-fuss-links" content="${esc(`${betrieb.trim() || "Betrieb"} · Kassensturz`)}"><meta name="amtlos-fuss-rechts" content="${esc(zeitDe(k.zeitpunkt))}">${MAPPE_STIL}</head><body>
<h1>Kassensturz – Zählprotokoll</h1><p>${esc(betrieb.trim() || "Betrieb")} · gezählt am ${zeitDe(k.zeitpunkt)}${k.standort ? ` · ${esc(k.standort)}` : ""}${k.anwesend ? ` · ${esc(k.anwesend)}` : ""}</p>
${tabelle}${typeof k.vortag_cent === "number" ? `<p>Endbestand laut letztem Tagesabschluss: ${euroPlain(k.vortag_cent)} – Einnahmen und Ausgaben seit diesem Abschluss sind darin nicht enthalten.</p>` : ""}${k.notiz ? `<p>${esc(k.notiz)}</p>` : ""}</body></html>`;
}

/**
 * R12 (Kurier #20): Kontrollarten passend zum Betrieb – Hygiene nur mit Lebensmitteln bzw. Kosmetik, Zoll nur mit
 * Beschäftigten, Umwelt nur in Handwerk, Bau, Gastronomie und Reinigung. Ohne bekannte Branche alle; was schon
 * Einträge hat, bleibt immer wählbar.
 */
export function kontrollartenFuer(s: Pick<Stand, "profil" | "mitarbeiter">, mitEintraegen: ReadonlySet<Kontrollart>): Kontrollart[] {
  const br = Array.isArray(s.profil["taetigkeit.branchen"]) ? (s.profil["taetigkeit.branchen"] as string[]) : [];
  const n = s.profil["beschaeftigte.gesamt"];
  const mitPersonal = s.mitarbeiter.length > 0 || (typeof n === "number" ? n > 0 : true);
  const passt: Record<Kontrollart, boolean> = {
    alle: true,
    hygiene: !br.length || br.some((b) => ["gastronomie_lebensmittel", "beauty_kosmetik", "gesundheit_pflege"].includes(b)),
    zoll: mitPersonal,
    bg: mitPersonal || !br.length,
    umwelt: !br.length || br.some((b) => ["handwerk", "bau", "gastronomie_lebensmittel", "gebaeudereinigung", "produktion"].includes(b)),
    datenschutz: true,
    kasse: true,
  };
  return KONTROLLARTEN.filter((k) => passt[k] || mitEintraegen.has(k));
}

/** R12 (Zoll #5): Kopien der Aufenthaltstitel als Einträge (Datei), je Person mit „gültig bis“. */
export function aufenthaltEintraege(s: Pick<Stand, "mitarbeiter">, heute = heuteBerlin()): MappenEintrag[] {
  return s.mitarbeiter
    .filter((p) => typeof p.aufenthalt_datei === "string" && p.aufenthalt_datei && p.name.trim() && !beendetVor(p, minusMonate(heute, NACHWEIS_MONATE)))
    .map((p) => {
      const bis = typeof p.aufenthalt_bis === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.aufenthalt_bis) ? p.aufenthalt_bis : "";
      const titel = `Kopie Aufenthaltstitel · ${p.name.trim()}${bis ? ` · gültig bis ${datumDe(bis)}` : ""}`;
      return { id: `aufenthalt-${p.id}`, vorlage: "aufenthaltstitel", titel, bereich: "personal" as Bereich, datum: bis || heute, geteilt: true, datei: { name: p.aufenthalt_datei!, titel }, ...(p.betriebsstaette ? { staette: p.betriebsstaette } : {}) };
    })
    .sort((a, b) => a.titel.localeCompare(b.titel, "de"));
}

/** R12 (Zoll #7): Lohnkonten auf Verlangen – je Person und Jahr die neueste Fassung, laufendes und die zwei Vorjahre. */
export function lohnkontoEintraege(s: Pick<Stand, "unterlagen" | "mitarbeiter">, heute = heuteBerlin()): MappenEintrag[] {
  const ab = Number(heute.slice(0, 4)) - 2;
  const aus = nichtZaehlend(s.unterlagen);
  const v = vorlageFuer("lohnkonto");
  if (!v) return [];
  const je = new Map<string, Unterlage>();
  for (const u of s.unterlagen) {
    if (u.vorlage !== "lohnkonto" || aus.has(u.id)) continue;
    const jahr = Number(String(u.daten.jahr ?? "").trim());
    if (!Number.isInteger(jahr) || jahr < ab) continue;
    const k = `${String(u.daten.name ?? "").trim().toLocaleLowerCase("de")}|${jahr}`;
    const b = je.get(k);
    if (!b || u.geaendert > b.geaendert) je.set(k, u);
  }
  return [...je.values()]
    .map((u) => {
      const st = staetteVonUnterlage(u, s.mitarbeiter);
      return { id: u.id, vorlage: "lohnkonto", titel: unterlagenName(v, u.daten) + (u.daten.jahr ? ` · ${String(u.daten.jahr).trim()}` : ""), bereich: "personal" as Bereich, datum: datumVon(u), geteilt: Boolean(u.ausgegeben), ...(u.ausgegeben ? { geteiltAm: tag(u.ausgegeben) } : {}), ...(st ? { staette: st } : {}) };
    })
    .sort((a, b) => a.titel.localeCompare(b.titel, "de"));
}

/** R12 (Kfz #5): Entsorgungsbelege – eine Übersicht als Tabelle, dazu je Beleg mit Datei dessen Foto bzw. PDF. */
export function entsorgungEintraege(belege: readonly Beleg[], betrieb: string, heute = heuteBerlin()): MappenEintrag[] {
  const l = entsorgungsbelege(belege, heute);
  if (!l.length) return [];
  const zeilen = l.map((b) => `<tr><td>${esc(datumDe(b.datum))}</td><td>${esc(b.lieferant)}</td><td>${esc(b.nummer ?? "")}</td><td>${esc(b.notiz ?? "")}</td><td class="r">${euro(b.steuer.reduce((a, x) => a + x.brutto_cent, 0))}</td></tr>`).join("");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Entsorgungsbelege</title><meta name="amtlos-gestalt" content="nachweis"><meta name="amtlos-fuss-links" content="${esc(`${betrieb.trim() || "Betrieb"} · Entsorgungsbelege`)}"><meta name="amtlos-fuss-rechts" content="${esc(`Stand ${datumDe(heute)}`)}">
<style>body{font-family:"Amtlos Sans",Helvetica,Arial,sans-serif;color:#1f2a33;font-size:10pt;margin:0}h1{font-family:"Amtlos Serif",Georgia,serif;font-size:20pt;margin:0 0 2mm}p{color:#5b6670;margin:0 0 6mm}table{width:100%;border-collapse:collapse}th{font-size:8.5pt;text-align:left;color:#5b6670;border-bottom:.4mm solid #1f2a33;padding:0 2mm 1.5mm}td{padding:2mm;border-bottom:.3mm solid #d6dbe0;vertical-align:top}.r{text-align:right;white-space:nowrap}</style></head><body>
<h1>Entsorgungsbelege</h1><p>${esc(betrieb.trim() || "Betrieb")} · aus den erfassten Belegen der letzten fünf Jahre · ${l.length} ${l.length === 1 ? "Beleg" : "Belege"}</p>
<table><thead><tr><th>Datum</th><th>Entsorger</th><th>Nummer</th><th>Notiz</th><th class="r">Betrag</th></tr></thead><tbody>${zeilen}</tbody></table></body></html>`;
  return [
    { id: "entsorgung-liste", vorlage: "entsorgungsbelege", titel: `Entsorgungsbelege (${l.length})`, bereich: "betrieb", datum: l[0]!.datum, geteilt: true, html },
    ...l.filter((b) => b.datei && !/\.xml$/i.test(b.datei)).map((b) => ({ id: `entsorgung-${b.id}`, vorlage: "entsorgungsbelege", titel: `Beleg ${b.lieferant.trim() || "Entsorgung"} vom ${datumDe(b.datum)}`, bereich: "betrieb" as Bereich, datum: b.datum, geteilt: true, datei: { name: b.datei!, titel: `Beleg ${b.lieferant.trim()} vom ${datumDe(b.datum)}` } })),
  ];
}

/** Beschäftigung vor diesem Tag beendet? */
const beendetVor = (p: Person, tag2: string) => typeof p.ende === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.ende) && p.ende < tag2;

/** R12 (Zoll #8): eine Zeile der Personalübersicht auf dem Deckblatt der Zoll-Mappe. */
export interface PersonalZeile {
  name: string;
  geburtsdatum: string;
  beginn: string;
  art: string;
  wochenstunden: string;
  entgelt: string;
  sofortmeldung: string;
  aufenthaltBis: string;
}

/**
 * R12 (Zoll #8): Wer arbeitet hier – alle zum Stichtag beschäftigten Personen (ohne Ende oder Ende heute oder später),
 * auf Wunsch nur einer Betriebsstätte. „Sofortmeldung bestätigt am“: eigene Angabe, sonst der Haken an der Pflicht,
 * wenn er zum Beginn dieser Person gehört.
 */
export function personalUebersicht(s: Pick<Stand, "mitarbeiter" | "erledigt">, heute = heuteBerlin(), staette?: string): PersonalZeile[] {
  const t = (p: Person, k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  const haken = s.erledigt["personal.sofortmeldung"];
  const [hDatum, hTermin] = haken ? haken.split("|") : [];
  return s.mitarbeiter
    .filter((p) => p.name.trim() && !beendetVor(p, heute) && (!staette || (staette === HAUPT_STAETTE ? !t(p, "betriebsstaette") || t(p, "betriebsstaette") === HAUPT_STAETTE : t(p, "betriebsstaette") === staette)))
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .map((p) => {
      const beginn = t(p, "beginn");
      const sofort = t(p, "sofortmeldung_am") || (hDatum && beginn && (hTermin ? hTermin === beginn : hDatum >= beginn) ? hDatum : "");
      const sl = cent(t(p, "stundenlohn"));
      const mg = cent(t(p, "monatsgehalt"));
      const entgelt = t(p, "entgelt_art") === "monat" ? (mg !== null ? `${euro(mg)} im Monat` : "") : sl !== null ? `${euro(sl)} je Stunde` : mg !== null ? `${euro(mg)} im Monat` : "";
      return {
        name: p.name.trim(),
        geburtsdatum: datumOder(t(p, "geburtsdatum")),
        beginn: datumOder(beginn),
        art: BESCHAEFTIGUNGSARTEN.find((a) => a.wert === t(p, "art"))?.text ?? "",
        wochenstunden: t(p, "wochenstunden"),
        entgelt,
        sofortmeldung: datumOder(sofort),
        aufenthaltBis: datumOder(t(p, "aufenthalt_bis")),
      };
    });
}
const datumOder = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? datumDe(iso) : "");

/**
 * R12 (UX #6): abgehakte Pflichten mit Vorlage für diese Kontrolle, zu denen keine Unterlage in der Mappe steht – auf
 * dem Deckblatt „vorhanden (bestätigt am …)“.
 */
export function bestaetigtOhneUnterlage(gilt: readonly PflichtMitVorlagen[], erledigt: Record<string, string>, eintraege: readonly MappenEintrag[], art: Kontrollart): { titel: string; am: string }[] {
  const da = new Set(eintraege.map((e) => e.vorlage));
  return gilt
    .filter((p) => erledigt[p.id] && p.vorlagen.some((v) => fuerKontrolle(v, art)) && !p.vorlagen.some((v) => da.has(v)))
    .map((p) => ({ titel: p.titel, am: hakenDatum(erledigt[p.id])! }));
}

/** R12 (Bäckerei #7): Eintrag gehört zur gewählten Betriebsstätte – ohne Zuordnung gilt er für alle. Kassenbücher nach Standort. */
export function inStaette(e: MappenEintrag, staette: string | null, s: Pick<Stand, "betrieb" | "betriebsstaetten">): boolean {
  if (!staette) return true;
  if (e.vorlage === "kassenbuch" && e.daten && typeof e.daten.zeitraum === "string") {
    const st = e.id.startsWith("kassenbuch-") ? (e.daten.zeitraum.split(" · ")[1] ?? "") : null;
    if (st !== null) return staette === HAUPT_STAETTE ? !st || st === staetteVon(s, HAUPT_STAETTE).name : st.toLocaleLowerCase("de") === staetteVon(s, staette).name.toLocaleLowerCase("de");
  }
  if (!e.staette) return true;
  return e.staette === staette || (staette === HAUPT_STAETTE && e.staette === HAUPT_STAETTE);
}

/** Was eine offene Pflicht braucht, um in der Mappe zu fehlen: Titel und die Vorlagen dazu. */
export interface PflichtMitVorlagen {
  id: string;
  titel: string;
  vorlagen: string[];
}

/**
 * „Fehlt noch für eine Kontrolle“ (R10): offene Pflichten mit einer Vorlage, die in die Mappe gehört – solange keine
 * Unterlage zu einer dieser Vorlagen in der Mappe steht. Die erste passende Vorlage ist die zum Erstellen.
 */
export function fehltInMappe(offen: readonly PflichtMitVorlagen[], eintraege: readonly MappenEintrag[], art: Kontrollart): { id: string; titel: string; vorlage: string }[] {
  const da = new Set(eintraege.map((e) => e.vorlage));
  const gesehen = new Set<string>();
  const r: { id: string; titel: string; vorlage: string }[] = [];
  for (const p of offen) {
    const passend = p.vorlagen.filter((v) => fuerKontrolle(v, art));
    if (!passend.length || passend.some((v) => da.has(v))) continue;
    // eine Vorlage nur einmal anbieten (z. B. Unterweisung für Erst- und Wiederholungsunterweisung)
    if (gesehen.has(passend[0]!)) continue;
    gesehen.add(passend[0]!);
    r.push({ id: p.id, titel: p.titel, vorlage: passend[0]! });
  }
  return r;
}

// E-220: dieselbe Maskierung wie in den Vorlagen (& < > " ')
const esc = (t: string) => htmlMaskieren(String(t ?? ""));
export const datumDe = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const bereichTitel = (b: Bereich) => BEREICHE.find((x) => x.id === b)?.titel ?? "";

/** R12: Zusätze auf dem Deckblatt der Zoll-Mappe. */
export interface DeckblattExtra {
  /** Betriebsstätte, für die die Mappe gilt (Name, Anschrift) */
  staette?: string;
  personal?: PersonalZeile[];
  /** Dienstplan heute: eingeteilte Personen und freier Text */
  dienstplan?: { namen: string[]; text: string };
  /** Satz am Ende (z. B. „Mappe ausgedruckt im Betrieb bereithalten“) */
  hinweis?: string;
}

/** Zusatz unter dem Titel einer Zeile im Inhaltsverzeichnis (R12): Aufzeichnung bis, geteilt am, gültig ab, Entwurf. */
export function eintragZusatz(e: MappenEintrag): string {
  const teile: string[] = [];
  if (e.aufzeichnungBis) teile.push(`Aufzeichnung bis ${datumDe(e.aufzeichnungBis)}`);
  if (e.gueltigAb && !e.titel.includes("gültig ab")) teile.push(`gültig ab ${datumDe(e.gueltigAb)}`);
  if (e.datei || e.html) return teile.join(" · ");
  if (e.geteilt && e.geteiltAm) teile.push(`geteilt am ${datumDe(e.geteiltAm)}`);
  else if (!e.geteilt) teile.push(JE_MONAT.has(e.vorlage) ? "nicht abgeschlossen" : "vollständig, noch nicht geteilt");
  if (e.korrekturLaeuft) teile.push("Korrektur in Arbeit – hier die geltende Fassung");
  return teile.join(" · ");
}

/**
 * Deckblatt: Betrieb, Datum, Inhaltsverzeichnis mit Titel, Datum und – wenn bekannt – Seite in der Mappe. Die Meta-Tags
 * geben der Fußzeile (fusszeile.ts) Betrieb und Stand. R12: Personalübersicht, Dienstplan, „vorhanden (bestätigt am …)“.
 */
export function deckblattHtml(betrieb: string, heute: string, eintraege: (MappenEintrag & { seite?: number })[], art?: string, papier: (string | { titel: string; am?: string })[] = [], extra: DeckblattExtra = {}): string {
  const name = betrieb.trim() || "Betrieb";
  // viele Einträge: engere Zeilen, damit das Inhaltsverzeichnis nicht mit wenigen Zeilen auf eine zweite Seite läuft
  const eng = eintraege.length > 9 || Boolean(extra.personal?.length);
  const zeilen = eintraege
    .map((e, i) => {
      const zusatz = eintragZusatz(e);
      return `<tr><td class="nr">${i + 1}</td><td><div class="t">${esc(e.titel)}</div><div class="b">${esc([bereichTitel(e.bereich), zusatz].filter(Boolean).join(" · "))}</div></td><td class="d">${esc(datumDe(e.datum))}</td><td class="s">${e.seite ?? ""}</td></tr>`;
    })
    .join("");
  const p = extra.personal ?? [];
  const personal = p.length
    ? `<h2 class="papier">Personalübersicht (${p.length} ${p.length === 1 ? "Person" : "Personen"})</h2><table class="personal"><thead><tr><th>Name</th><th>Geburtsdatum</th><th>Beginn</th><th>Art</th><th>Std./Woche</th><th>Entgelt</th><th>Sofortmeldung bestätigt am</th><th>Aufenthaltstitel gültig bis</th></tr></thead><tbody>${p.map((x) => `<tr><td class="t">${esc(x.name)}</td><td>${esc(x.geburtsdatum)}</td><td>${esc(x.beginn)}</td><td>${esc(x.art)}</td><td>${esc(x.wochenstunden)}</td><td>${esc(x.entgelt)}</td><td>${esc(x.sofortmeldung)}</td><td>${esc(x.aufenthaltBis)}</td></tr>`).join("")}</tbody></table>`
    : "";
  const dp = extra.dienstplan;
  const dienstplan = dp && (dp.namen.length || dp.text.trim()) ? `<h2 class="papier">Dienstplan heute (${esc(datumDe(heute))})</h2>${dp.namen.length ? `<p class="dienst">${dp.namen.map(esc).join(", ")}</p>` : ""}${dp.text.trim() ? `<p class="dienst">${esc(dp.text.trim()).replace(/\n/g, "<br>")}</p>` : ""}` : "";
  const papierZeilen = papier.map((t) => (typeof t === "string" ? esc(t) : `${esc(t.titel)}${t.am ? ` – vorhanden (bestätigt am ${esc(datumDe(t.am))})` : ""}`));
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Kontrollmappe</title>
<meta name="amtlos-gestalt" content="nachweis"><meta name="amtlos-fuss-links" content="${esc(`${name} · Kontrollmappe`)}"><meta name="amtlos-fuss-rechts" content="${esc(`Stand ${datumDe(heute)}`)}">
<style>
body{font-family:"Amtlos Sans",Helvetica,Arial,sans-serif;color:#1f2a33;font-size:10.5pt;margin:0}
.art{font-size:9pt;letter-spacing:.08em;text-transform:uppercase;color:#5b6670}
h1{font-family:"Amtlos Serif",Georgia,serif;font-size:26pt;margin:6mm 0 2mm}
.betrieb{font-size:14pt;font-weight:600;margin:0}
.staette{margin:1mm 0 0}
.stand{color:#5b6670;margin:1mm 0 10mm}
h2{font-size:11pt;margin:0 0 3mm;text-transform:uppercase;letter-spacing:.06em;color:#5b6670}
table{width:100%;border-collapse:collapse}
td{padding:2.4mm 2mm;border-bottom:.3mm solid #d6dbe0;vertical-align:top}
td.nr{width:8mm;color:#5b6670}td.d{width:24mm;white-space:nowrap}td.s{width:14mm;text-align:right;white-space:nowrap}
th{font-size:8.5pt;font-weight:600;text-align:left;color:#5b6670;padding:0 2mm 1.5mm;border-bottom:.4mm solid #1f2a33}
th.s{text-align:right}
.t{font-weight:600}.b{font-size:8.5pt;color:#5b6670;margin-top:.5mm}
table.personal{font-size:8.5pt}table.personal td{padding:1.4mm 1.5mm}table.personal th{font-size:7.5pt;padding:0 1.5mm 1.2mm}
p.dienst{margin:0 0 2mm}
.hinweis{margin-top:8mm;font-size:8.5pt;color:#5b6670}
h2.papier{margin-top:7mm}ul.papier{margin:0;padding-left:5mm}ul.papier li{margin:1mm 0}
body.eng h1{margin:3mm 0 1mm;font-size:22pt}body.eng .stand{margin-bottom:6mm}body.eng td{padding:1.5mm 2mm}body.eng .hinweis{margin-top:5mm}
</style></head><body class="g-nachweis${eng ? " eng" : ""}">
<div class="art">Kontrollmappe${art ? ` · ${esc(art)}` : ""}</div>
<h1>Nachweise des Betriebs</h1>
<p class="betrieb">${esc(name)}</p>
${extra.staette ? `<p class="staette">Betriebsstätte: ${esc(extra.staette)}</p>` : ""}
<p class="stand">Zusammengestellt am ${esc(datumDe(heute))} · ${eintraege.length} ${eintraege.length === 1 ? "Unterlage" : "Unterlagen"}</p>
${dienstplan}${personal}${dienstplan || personal ? '<h2 class="papier">Inhalt</h2>' : "<h2>Inhalt</h2>"}
<table><thead><tr><th></th><th>Unterlage</th><th>Datum</th><th class="s">Seite</th></tr></thead><tbody>${zeilen}</tbody></table>
${papierZeilen.length ? `<h2 class="papier">Außerdem im Betrieb vorhanden (nicht in dieser Mappe)</h2><ul class="papier">${papierZeilen.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}
<p class="hinweis">Jede Unterlage folgt mit eigener Fußzeile und eigenen Seitenzahlen; die Seite im Inhalt zählt die Mappe von vorn.${extra.hinweis ? ` ${esc(extra.hinweis)}` : ""}</p>
</body></html>`;
}

/**
 * R12: Datei (Foto oder PDF, z. B. Kopie des Aufenthaltstitels) als PDF für die Mappe – ein PDF bleibt, wie es ist; ein
 * Foto kommt auf eine A4-Seite mit Überschrift. null, wenn sich die Datei nicht lesen lässt.
 */
export async function dateiAlsPdf(bytes: Uint8Array, name: string, titel: string): Promise<Uint8Array | null> {
  const endung = name.split(".").pop()?.toLowerCase() ?? "";
  try {
    if (endung === "pdf" || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
      await PDFDocument.load(bytes);
      return bytes;
    }
    const doc = await PDFDocument.create();
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const bild = png ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const seite = doc.addPage([595.28, 841.89]);
    const schrift = await doc.embedFont(StandardFonts.Helvetica);
    // Standardschrift kennt nur WinAnsi – andere Zeichen ersetzen
    const sicher = titel.replace(/[^\x20-\x7e\xa0-\xff–—„“”‚‘’·•€]/g, "?");
    seite.drawText(sicher, { x: 42, y: 841.89 - 52, size: 12, font: schrift, color: rgb(0.12, 0.16, 0.2) });
    const breite = 595.28 - 84;
    const hoehe = 841.89 - 120;
    const m = Math.min(breite / bild.width, hoehe / bild.height, 1.5);
    seite.drawImage(bild, { x: 42 + (breite - bild.width * m) / 2, y: 42 + (hoehe - bild.height * m), width: bild.width * m, height: bild.height * m });
    doc.setTitle(sicher);
    return await doc.save();
  } catch {
    return null;
  }
}

/** Seitenzahl eines PDFs. */
export async function seitenzahl(pdf: Uint8Array): Promise<number> {
  return (await PDFDocument.load(pdf)).getPageCount();
}

/** Seite, auf der jede Unterlage in der Mappe beginnt (1-basiert), nach einem Deckblatt mit `deckblatt` Seiten. */
export function startSeiten(deckblatt: number, seiten: number[]): number[] {
  let n = deckblatt + 1;
  return seiten.map((x) => {
    const s = n;
    n += x;
    return s;
  });
}

/** Fügt die PDFs in dieser Reihenfolge zu einem zusammen. */
export async function mappeZusammenfuegen(teile: Uint8Array[], titel = "Kontrollmappe"): Promise<Uint8Array> {
  const ziel = await PDFDocument.create();
  for (const t of teile) {
    const quelle = await PDFDocument.load(t);
    const seiten = await ziel.copyPages(quelle, quelle.getPageIndices());
    for (const s of seiten) ziel.addPage(s);
  }
  ziel.setTitle(titel);
  ziel.setCreator(MARKE.name);
  return ziel.save();
}

/** Dateiname der Mappe: Kontrollmappe_<Betrieb>_<Datum>.pdf */
export const mappeDateiname = (betrieb: string, heute: string) => `Kontrollmappe_${dateinamenTeil(betrieb, 40, "._-") || "Betrieb"}_${heute}.pdf`;
