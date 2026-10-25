/**
 * Unterlagen und Betrieb – nur auf dem Gerät (E-121). Reine Funktionen über einem unveränderlichen Stand, damit sie
 * ohne Gerät testbar sind; zustand.tsx speichert den Stand in AsyncStorage.
 */
import { letzteVollsicherung, nachweisText, nachweiseAus, type SicherungsNachweis } from "./sicherungNachweis";
import { KU_HINWEIS, belegNummern, eigenbelegeVergeben, grundGenuegt, kassensturzAus, kassenstuerzeVereinen, kontenvorgabenAus, kontenvorgabenGesetzt, naechsteBelegnummer, sachentnahmeAus, ustZeitraum, xrechnungUbl, type Kassensturz, type Kontenvorgaben, type Sachentnahme } from "@amtlos/fachlogik";
import { LEERER_BETRIEB, STORNO_ABSCHLAEGE, eRechnungAus, kassenKorrektur, kassenabschlussAus, kassenInhalt, kassenVereinen, zahlungenAus, zahlungsStand, type KassenInhalt, type Kassenabschluss, type Zahlung, belegAus, belegFassung, belegInhaltGeaendert, belegSummen, gruppenAusBranchen, istGutschriftNummer, leereDaten, type Beleg, naechsteNummer, zahlbetrag, personMerken as merken, vorlageFuer, type Betrieb, type Daten, type Eintrag, type Person, type PersonAngaben, type PersonenArt } from "@amtlos/fachlogik";
import { partnerIdAus } from "../partner/partner";
import { zustimmungAus, type Zustimmung } from "../rechtliches";

export interface Unterlage {
  id: string;
  vorlage: string;
  daten: Daten;
  erstellt: string;
  geaendert: string;
  /** zuerst als PDF geteilt oder gedruckt (E-127) – erst dann zählt die Unterlage für eine Pflicht */
  ausgegeben?: string;
  /** festgeschrieben (Vorlagen mit `festschreiben`, z. B. Rechnung): nicht mehr änderbar oder löschbar */
  festgeschrieben?: string;
  /** storniert durch diese Unterlage (Stornorechnung) */
  storniertDurch?: string;
  /** Zahlung eingegangen am (YYYY-MM-DD, E-129) – gehört nicht zum Inhalt, ändert also keine festgeschriebene Rechnung */
  bezahlt?: string;
  /** wann die Zahlung zuletzt vermerkt oder entfernt wurde (ISO) – entscheidet beim Zusammenführen zweier Fassungen */
  bezahltGeaendert?: string;
  /**
   * R12: einzelne Zahlungseingänge mit Betrag und ggf. Skonto/Minderung. Ohne Liste gilt `bezahlt` als Zahlung des
   * ganzen Betrags (wie bisher). `bezahlt` steht, sobald nichts mehr offen ist. Gehört wie `bezahlt` nicht zum Inhalt.
   */
  zahlungen?: Zahlung[];
  /** Stornorechnung: ID der stornierten Rechnung (M1) – die Nummer allein ist bei doppelt vergebenen Nummern mehrdeutig */
  stornoZuId?: string;
  /**
   * Ersatzrechnung (R11): ID der stornierten Rechnung, die diese Rechnung ersetzt – gesetzt, wenn die Kopie aus einer
   * stornierten Rechnung bzw. ihrem Storno angelegt wird. Die Voranmeldung ordnet Storno und Ersatz danach zu.
   */
  ersetzt?: string;
  /**
   * Konfliktkopie (K1): Zwei Geräte haben dieselbe Unterlage mit verschiedenem Inhalt festgeschrieben. Gültig bleibt die
   * zuerst festgeschriebene; die andere Fassung bleibt als Kopie erhalten, zählt aber nirgends mit (nicht gültig).
   */
  konfliktKopieVon?: string;
  /** SHA-256 (hex) des geteilten PDFs, wenn beim Festschreiben bekannt (H1) */
  pdfSha256?: string;
  /**
   * R12: frühere, festgeschriebene Fassungen eines Nachweises (Vorlagen mit `korrektur`), älteste zuerst. Eine Korrektur
   * legt die geltende Fassung hier ab; die Unterlage wird wieder Entwurf und beim nächsten Teilen neu festgeschrieben.
   */
  fassungen?: Fassung[];
  /** R12: zugeordnete Betriebsstätte (ID aus `Stand.betriebsstaetten`, „haupt“ = Betrieb) – leer: alle */
  betriebsstaette?: string;
  /**
   * R12 GoBD: Absenderdaten („Mein Betrieb“) zum Zeitpunkt der Festschreibung – eine festgeschriebene Rechnung zeigt
   * immer diese Angaben, auch wenn sich Anschrift oder Bank später ändern (§ 14b UStG, Doppel der Rechnung).
   */
  absender?: Betrieb;
  /** R12 GoBD: XRechnung (UBL) der festgeschriebenen Rechnung, wie sie ausgegeben wurde – das Paket nimmt dieses Original */
  xml?: string;
  /**
   * E-156: Zeitpunkt, zu dem die E-Rechnung (XRechnung) dieser Rechnung zum ersten Mal geteilt wurde – danach lässt sie
   * sich immer wieder teilen, auch ohne Pro (eigene Daten)
   */
  eRechnungGeteilt?: string;
  /** R12 GoBD: Kassenbuch aus den Tagesabschlüssen – Monat und Standort, SHA-256 des festgeschriebenen Inhalts */
  kassenbuch?: { monat: string; standort: string };
  inhaltSha256?: string;
  /**
   * E-193 (4): auf Android geteilt bzw. gedruckt, aber nicht als verschickt bestätigt („Nein, noch nicht“) – Android meldet
   * einen Abbruch des Teilen-Menüs nicht. Je Ausgabe die Fassung, wie sie hinausging (Inhalt, PDF-Hash, Absender), älteste
   * zuerst. „Doch verschickt – festschreiben“ schreibt die letzte davon fest; nur anhängen, beim Zusammenführen vereint.
   */
  geteiltOffen?: GeteilteFassung[];
}

/** E-193 (4): eine auf Android ausgegebene Fassung, deren Versand (noch) nicht bestätigt ist. */
export interface GeteilteFassung {
  am: string;
  art: "pdf" | "druck" | "xml";
  daten: Daten;
  pdfSha256?: string;
  absender?: Betrieb;
}
/** höchstens so viele unbestätigte Ausgaben je Unterlage (die ältesten fallen weg) */
const GETEILT_OFFEN_HOECHSTENS = 20;

/**
 * R12 GoBD: Protokoll von Löschungen und Korrekturen (nur anhängen, nie ändern) – geht ins Steuerberater-Paket und ins
 * offene Archiv. „beleg_geloescht“: frisch erfasster Beleg endgültig gelöscht; „beleg_ungueltig“: als ungültig markiert;
 * „beleg_korrigiert“: festgeschriebener Beleg mit Grund geändert; „sachentnahme_geloescht“.
 */
export interface ProtokollEintrag {
  id: string;
  zeitpunkt: string;
  art: "beleg_geloescht" | "beleg_ungueltig" | "beleg_korrigiert" | "sachentnahme_geloescht";
  /** ID des Belegs bzw. der Sachentnahme */
  bezug: string;
  /** Amtlos-Belegnummer (bleibt vergeben, auch wenn der Beleg gelöscht ist) */
  nr?: string;
  text: string;
}

/** R12: frühere Fassung eines festgeschriebenen Nachweises – nie gelöscht (Historie). */
export interface Fassung {
  daten: Daten;
  festgeschrieben: string;
  ausgegeben?: string;
  pdfSha256?: string;
  /** Grund, mit dem diese Fassung ihrerseits eine frühere ersetzte */
  grund?: string;
  /** wann sie durch eine Korrektur ersetzt wurde (ISO) */
  ersetzt: string;
}

/** R12: Betriebsstätte (Filiale). Betriebsstätte 1 ist der Betrieb selbst (Anschrift aus „Mein Betrieb“, ID „haupt“). */
export interface Betriebsstaette {
  id: string;
  name: string;
  strasse: string;
  plz: string;
  ort: string;
  geaendert?: string;
}
export const HAUPT_STAETTE = "haupt";

export interface Stand {
  version: 8;
  betrieb: Betrieb;
  unterlagen: Unterlage[];
  /** Belege und Eingangsrechnungen (E-133); Dateien liegen verschlüsselt daneben (unterlagen/dateien.ts) */
  belege: Beleg[];
  /** gespeicherte Personen, die Vorlagen vorausfüllen (E-124) */
  mitarbeiter: Person[];
  kunden: Person[];
  /**
   * E-165 (StB-Prüfung A-3): Lieferanten-Verzeichnis für Personenkonten – je Lieferant (Name bzw. USt-IdNr.) ein Eintrag
   * mit dem dauerhaft vergebenen Kreditorenkonto (`personenkonto`). Entsteht nur mit der Kontenvorgabe „Personenkonten“;
   * Kunden tragen ihr Debitorenkonto im selben Feld in `kunden`.
   */
  lieferanten: Person[];
  /** Antworten im Pflichten-Check (E-126), Schlüssel wie im Server-Profil ohne „profil.“ */
  profil: Record<string, string | number | boolean | string[] | null>;
  /** abgehakte Pflichten: Pflicht-ID → Datum */
  erledigt: Record<string, string>;
  /** lokale Erinnerungen an Fristen eingeschaltet (E-128) */
  erinnerungen: boolean;
  /** App nur nach Face ID / Code öffnen (E-129) */
  appSperre: boolean;
  /** letzte Änderung am Stand (ISO) */
  geaendert?: string;
  /** letzte erstellte Datensicherung (ISO, E-129) – von Hand oder automatisch in iCloud */
  letzteSicherung?: string;
  /** automatisch in iCloud sichern (nur im eigenen App-Build, E-129) */
  cloudSicherung: boolean;
  /** StB GoBD (D-11): Nachweis der Vollsicherungen außerhalb des Geräts (Datum, Art), neueste zuletzt – gerätegebunden */
  sicherungsNachweis?: SicherungsNachweis[];
  /** Pro testweise eingeschaltet – nur im Testmodus ohne App-Store-Anbindung (E-132) */
  proTest: boolean;
  /**
   * Angaben für das Steuerberater-Paket (E-133). StB-Prüfung (B-6 u. a.): `kontenvorgaben` – abweichende Konten und
   * Optionen der Kanzlei (fachlogik kontenvorgaben.ts); synchronisiert und gesichert mit dem Bereich „steuerberatung“.
   */
  steuerberatung: { kontenrahmen: "SKR03" | "SKR04"; beraternummer: string; mandantennummer: string; kontenvorgaben?: Kontenvorgaben };
  /**
   * Synchronisation (E-134): Löschvermerke („u:“ Unterlage, „b:“ Beleg, „m:“/„k:“ Person → ISO-Zeitpunkt), damit
   * Gelöschtes nicht von einem anderen Gerät zurückkommt; Zeitpunkte der letzten Änderung je Bereich (betrieb, profil,
   * erledigt, steuerberatung), damit die neuere Fassung gewinnt.
   */
  geloescht: Record<string, string>;
  zeiten: Record<string, string>;
  /** Bitte um eine Bewertung (E-132): Erfolgsmomente gezählt, zuletzt gefragt am (ISO) */
  bewertung: { erfolge: number; gefragt?: string };
  /**
   * E-188: wann der Bezahlschirm nach dem ersten Pflichten-Check von selbst kam (ISO) – er kommt so nur einmal, danach
   * nur über die üblichen Anlässe. Gerätegebunden (nicht synchronisiert), bleibt in der Datensicherung.
   */
  bezahlschirmNachCheck?: string;
  /**
   * Als ungültig markierte Belege (H2): innerhalb der Aufbewahrungsfrist nicht gelöscht, sondern hier mit Grund
   * aufbewahrt – samt Datei. Sie erscheinen in keiner Liste und zählen nirgends mit.
   */
  belegArchiv: Beleg[];
  /**
   * Was diese App-Version nicht kennt (M4): Unterlagen einer unbekannten Vorlage (neuere App, umbenannte Vorlage) und
   * Belege mit unlesbaren Kernangaben. Sie werden unverändert aufbewahrt und weitergereicht, nur nicht angezeigt –
   * nie verworfen (GoBD).
   */
  fremd: { unterlagen: Record<string, unknown>[]; belege: Record<string, unknown>[]; kasse?: Record<string, unknown>[] };
  /**
   * R12: Kassenabschlüsse (Tagesumsätze laut Z-Bon). Gespeichert = festgeschrieben; Korrektur nur mit Grund (Historie).
   * Fotos der Z-Bons liegen verschlüsselt wie Belegdateien.
   */
  kasse: Kassenabschluss[];
  /** R12: weitere Betriebsstätten (Filialen) – Betriebsstätte 1 ist der Betrieb selbst und steht nicht in der Liste */
  betriebsstaetten: Betriebsstaette[];
  /** R12 GoBD: Kassenstürze mit Zählprotokoll (z. B. bei einer Kassennachschau) – unveränderlich */
  kassenstuerze: Kassensturz[];
  /** R12 GoBD: Sachentnahmen (unentgeltliche Wertabgaben) mit selbst eingetragenen Pauschbeträgen */
  sachentnahmen: Sachentnahme[];
  /** R12 GoBD: Lösch- und Korrekturprotokoll (nur anhängen) */
  protokoll: ProtokollEintrag[];
  /**
   * Phase 2.3 (E-156): Partner, der Amtlos empfohlen hat („Empfohlen von …“, `partner/partner.ts`). Nur Anzeige – schaltet
   * nie etwas frei. Bleibt auf dem Gerät und in der Datensicherung, wird nicht synchronisiert.
   */
  partnerId?: string;
  /**
   * Vorprüfung 21.10.2026 (§ 305 Abs. 2 BGB): Zustimmung zu den eigenen Nutzungsbedingungen – Fassung und Zeitpunkt.
   * Nur gesetzt, wenn die App danach gefragt hat (erst ab `NUTZUNGSBEDINGUNGEN.freigegeben`, rechtliches.ts). Bleibt auf
   * dem Gerät und in der Datensicherung; beim Zusammenführen gewinnt die des Geräts.
   */
  nutzungsbedingungen?: Zustimmung;
}

/** Aktuelle Version des gespeicherten Stands. Höhere Versionen stammen aus einer neueren App und werden nie überschrieben. */
export const STAND_VERSION = 8;

/**
 * Migrationen: Eintrag n hebt einen Stand von Version n auf n + 1.
 * - 1 → 2 (R12): Kassenabschlüsse (`kasse`, anfangs leer).
 * - 2 → 3 (R12 Personal): Betriebsstätten (anfangs leer); schon geteilte Nachweise (Vorlagen mit `korrektur`:
 *   Arbeitszeit, NachwG, Ausweis-Hinweis) gelten ab dem Tag ihrer ersten Ausgabe als festgeschrieben.
 * - 3 → 4 (R12 GoBD): Belege bekommen ihre bisher berechnete Amtlos-Belegnummer fest gespeichert (`nr`, auch ungültig
 *   markierte); festgeschriebene Rechnungen halten die Absenderdaten fest (mangels Besserem die heutigen aus „Mein
 *   Betrieb“); Kassenstürze, Sachentnahmen und Protokoll starten leer.
 * - 4 → 5 (Phase 2.3): Partner-ID (`partnerId`) für „Empfohlen von …“ – anfangs nicht gesetzt.
 * - 5 → 6 (Vorprüfung Recht): Zustimmung zu den Nutzungsbedingungen (`nutzungsbedingungen`) – anfangs nicht gesetzt;
 *   die App fragt erst danach, wenn die eigenen Bedingungen freigegeben sind.
 * - 6 → 7 (StB-Prüfung Heckler und Busch): Kontenvorgaben der Kanzlei (`steuerberatung.kontenvorgaben`) – anfangs keine,
 *   es gelten die Standardkonten des Kontenrahmens; Vorhandenes wird nur bereinigt.
 * - 7 → 8 (E-165, Personenkonten): Lieferanten-Verzeichnis (`lieferanten`, anfangs leer). Personenkonten werden erst
 *   vergeben, wenn die Kontenvorgabe „Personenkonten“ eingeschaltet ist (`personenkontenVergeben` in steuerpaket.ts).
 */
export const MIGRATIONEN: Record<number, (roh: Record<string, unknown>) => Record<string, unknown>> = {
  1: (roh) => ({ ...roh, kasse: Array.isArray(roh.kasse) ? roh.kasse : [] }),
  2: (roh) => ({
    ...roh,
    betriebsstaetten: Array.isArray(roh.betriebsstaetten) ? roh.betriebsstaetten : [],
    unterlagen: Array.isArray(roh.unterlagen)
      ? (roh.unterlagen as unknown[]).map((u) => {
          if (!istObjekt(u) || typeof u.vorlage !== "string" || !vorlageFuer(u.vorlage)?.korrektur || !u.ausgegeben || u.festgeschrieben) return u;
          return { ...u, festgeschrieben: u.ausgegeben };
        })
      : roh.unterlagen,
  }),
  3: (roh) => {
    const liste = (w: unknown) => (Array.isArray(w) ? (w as unknown[]) : []);
    const alleBelege = [...liste(roh.belege), ...liste(roh.belegArchiv)].filter((b): b is Record<string, unknown> => istObjekt(b) && typeof b.id === "string" && typeof b.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.datum));
    const nummern = belegNummern(alleBelege.map((b) => ({ id: b.id as string, datum: b.datum as string, erstellt: String(b.erstellt ?? b.datum), nr: typeof b.nr === "string" ? b.nr : null })));
    const mitNr = (w: unknown) => (Array.isArray(w) ? (w as unknown[]).map((b) => (istObjekt(b) && typeof b.id === "string" && !b.nr && nummern.get(b.id) ? { ...b, nr: nummern.get(b.id) } : b)) : w);
    const betrieb = istObjekt(roh.betrieb) ? roh.betrieb : undefined;
    return {
      ...roh,
      belege: mitNr(roh.belege),
      belegArchiv: mitNr(roh.belegArchiv),
      unterlagen: Array.isArray(roh.unterlagen)
        ? (roh.unterlagen as unknown[]).map((u) => {
            if (!istObjekt(u)) return u;
            if (betrieb && u.vorlage === "rechnung" && u.festgeschrieben && !u.absender) return { ...u, absender: betrieb };
            // Verfahrensdokumentation: ab jetzt festgeschrieben und versioniert – schon geteilte ab ihrer ersten Ausgabe
            if (u.vorlage === "verfahrensdokumentation" && u.ausgegeben && !u.festgeschrieben) return { ...u, festgeschrieben: u.ausgegeben };
            return u;
          })
        : roh.unterlagen,
      kassenstuerze: liste(roh.kassenstuerze),
      sachentnahmen: liste(roh.sachentnahmen),
      protokoll: liste(roh.protokoll),
    };
  },
  4: (roh) => ({ ...roh, partnerId: undefined }),
  5: (roh) => ({ ...roh, nutzungsbedingungen: undefined }),
  6: (roh) => {
    if (!istObjekt(roh.steuerberatung)) return roh;
    const v = kontenvorgabenAus(roh.steuerberatung.kontenvorgaben);
    const { kontenvorgaben: _alt, ...rest } = roh.steuerberatung;
    return { ...roh, steuerberatung: kontenvorgabenGesetzt(v) ? { ...rest, kontenvorgaben: v } : rest };
  },
  7: (roh) => ({ ...roh, lieferanten: Array.isArray(roh.lieferanten) ? roh.lieferanten : [] }),
};

export class StandFehler extends Error {
  /** „unlesbar“: kein gültiges JSON bzw. kein Objekt; „version“: aus einer neueren App-Version */
  constructor(public art: "unlesbar" | "version") {
    super(art === "version" ? "Stand aus einer neueren App-Version" : "Stand unlesbar");
  }
}

/** Gespeicherten Stand auf die aktuelle Version heben; wirft StandFehler „version“ bei einer unbekannten, höheren Version. */
export function migrieren(roh: Record<string, unknown>): Record<string, unknown> {
  let v = typeof roh.version === "number" && Number.isInteger(roh.version) && roh.version >= 1 ? roh.version : 1;
  if (v > STAND_VERSION) throw new StandFehler("version");
  let r = roh;
  while (v < STAND_VERSION) {
    const m = MIGRATIONEN[v];
    if (!m) throw new StandFehler("version");
    r = m(r);
    v++;
  }
  return { ...r, version: STAND_VERSION };
}

export const LEERER_STAND: Stand = { version: 8, kasse: [], kassenstuerze: [], sachentnahmen: [], protokoll: [], betriebsstaetten: [], betrieb: LEERER_BETRIEB, unterlagen: [], belege: [], mitarbeiter: [], kunden: [], lieferanten: [], profil: {}, erledigt: {}, erinnerungen: false, appSperre: false, cloudSicherung: false, proTest: false, bewertung: { erfolge: 0 }, steuerberatung: { kontenrahmen: "SKR03", beraternummer: "", mandantennummer: "" }, geloescht: {}, zeiten: {}, belegArchiv: [], fremd: { unterlagen: [], belege: [] } };

function profilAus(roh: unknown): Stand["profil"] {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(
    Object.entries(roh as Record<string, unknown>).filter(([, w]) => w === null || ["string", "number", "boolean"].includes(typeof w) || (Array.isArray(w) && w.every((x) => typeof x === "string"))),
  ) as Stand["profil"];
}
function erledigtAus(roh: unknown): Record<string, string> {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(Object.entries(roh as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
}

/** Karte Schlüssel → ISO-Zeitpunkt (Löschvermerke, Zeiten); Unlesbares fällt weg. */
function isoKarte(roh: unknown): Record<string, string> {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return {};
  return Object.fromEntries(Object.entries(roh as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string" && /^\d{4}-\d{2}-\d{2}T/.test(e[1])));
}

/** Zeitpunkt der letzten Änderung eines Bereichs setzen (Synchronisation, E-134). */
const mitZeit = (s: Stand, bereich: string, jetzt = new Date()): Stand => ({ ...s, zeiten: { ...s.zeiten, [bereich]: jetzt.toISOString() } });
/** Löschvermerk setzen. */
const vermerken = (s: Stand, schluessel: string, jetzt = new Date()): Stand => ({ ...s, geloescht: { ...s.geloescht, [schluessel]: jetzt.toISOString() } });

function steuerberatungAus(roh: unknown): Stand["steuerberatung"] {
  const b = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const ziffern = (w: unknown) => (typeof w === "string" ? w.replace(/\D/g, "").slice(0, 7) : "");
  const kontenvorgaben = kontenvorgabenAus(b.kontenvorgaben);
  return { kontenrahmen: b.kontenrahmen === "SKR04" ? "SKR04" : "SKR03", beraternummer: ziffern(b.beraternummer), mandantennummer: ziffern(b.mandantennummer), ...(kontenvorgabenGesetzt(kontenvorgaben) || kontenvorgaben.kanzlei ? { kontenvorgaben } : {}) };
}

function bewertungAus(roh: unknown): Stand["bewertung"] {
  const b = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
  const erfolge = typeof b.erfolge === "number" && Number.isFinite(b.erfolge) ? Math.max(0, Math.floor(b.erfolge)) : 0;
  return typeof b.gefragt === "string" && b.gefragt ? { erfolge, gefragt: b.gefragt } : { erfolge };
}

/** Liste der Personen einer Art im Stand. */
export const PERSONEN_LISTE: Record<PersonenArt, "mitarbeiter" | "kunden"> = { mitarbeiter: "mitarbeiter", kunde: "kunden" };

function personenAus(roh: unknown): Person[] {
  if (!Array.isArray(roh)) return [];
  return roh
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === "object" && typeof (p as Person).id === "string" && typeof (p as Person).name === "string"))
    .map((p) => Object.fromEntries(Object.entries(p).filter(([, w]) => typeof w === "string" || w === null)) as Person);
}

const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const istIso = (w: unknown): w is string => typeof w === "string" && ISO_ZEIT.test(w);
const ANFANG = "1970-01-01T00:00:00.000Z";
const istObjekt = (w: unknown): w is Record<string, unknown> => Boolean(w && typeof w === "object" && !Array.isArray(w));

/**
 * Eine gespeicherte Unterlage bereinigen: Zeitstempel müssen ISO-Zeitpunkte sein (K1 – sonst entschiede ein
 * präpariertes `geaendert` das Zusammenführen). Eine Festschreibung geht dabei nie verloren: Ist ihr Zeitpunkt
 * unlesbar, gilt der der Ausgabe bzw. der letzten Änderung.
 */
function unterlageAus(u: Record<string, unknown>): Unterlage {
  const erstellt = istIso(u.erstellt) ? u.erstellt : istIso(u.geaendert) ? u.geaendert : ANFANG;
  const geaendert = istIso(u.geaendert) ? u.geaendert : erstellt;
  const r: Unterlage = { ...(u as unknown as Unterlage), erstellt, geaendert };
  if (u.ausgegeben) r.ausgegeben = istIso(u.ausgegeben) ? u.ausgegeben : geaendert;
  else delete r.ausgegeben;
  if (u.festgeschrieben) r.festgeschrieben = istIso(u.festgeschrieben) ? u.festgeschrieben : (r.ausgegeben ?? geaendert);
  else delete r.festgeschrieben;
  for (const k of ["storniertDurch", "stornoZuId", "ersetzt", "konfliktKopieVon", "pdfSha256", "bezahlt"] as const) if (typeof u[k] !== "string" || !u[k]) delete r[k];
  if (!istIso(u.bezahltGeaendert)) delete r.bezahltGeaendert;
  if (!istIso(u.eRechnungGeteilt)) delete r.eRechnungGeteilt;
  const z = zahlungenAus(u.zahlungen);
  if (z.length) r.zahlungen = z;
  else delete r.zahlungen;
  // R12: Fassungen nie verwerfen – nur Unlesbares (kein Inhalt, kein Zeitpunkt) fällt weg
  const f = Array.isArray(u.fassungen) ? (u.fassungen as unknown[]).filter((x): x is Fassung => istObjekt(x) && istObjekt(x.daten) && istIso(x.festgeschrieben) && istIso(x.ersetzt)) : [];
  if (f.length) r.fassungen = f;
  else delete r.fassungen;
  if (typeof u.betriebsstaette !== "string" || !u.betriebsstaette) delete r.betriebsstaette;
  // R12 GoBD: Absender-Schnappschuss nur als Objekt mit Text, XML nur als Text
  if (istObjekt(u.absender)) r.absender = { ...LEERER_BETRIEB, ...Object.fromEntries(Object.entries(u.absender).filter(([, w]) => typeof w === "string")) } as Betrieb;
  else delete r.absender;
  if (typeof u.xml !== "string" || !u.xml.startsWith("<")) delete r.xml;
  if (!(istObjekt(u.kassenbuch) && typeof u.kassenbuch.monat === "string" && typeof u.kassenbuch.standort === "string")) delete r.kassenbuch;
  if (typeof u.inhaltSha256 !== "string") delete r.inhaltSha256;
  // E-193 (4): unbestätigte Ausgaben – nur Lesbares (Zeitpunkt, Art, Inhalt)
  const offen = geteiltOffenAus(u.geteiltOffen);
  if (offen.length) r.geteiltOffen = offen;
  else delete r.geteiltOffen;
  return r;
}

function geteiltOffenAus(roh: unknown): GeteilteFassung[] {
  if (!Array.isArray(roh)) return [];
  return (roh as unknown[])
    .filter((x): x is Record<string, unknown> => istObjekt(x) && istIso(x.am) && (x.art === "pdf" || x.art === "druck" || x.art === "xml") && istObjekt(x.daten))
    .map((x) => ({ am: x.am as string, art: x.art as GeteilteFassung["art"], daten: x.daten as Daten, ...(typeof x.pdfSha256 === "string" && x.pdfSha256 ? { pdfSha256: x.pdfSha256 } : {}), ...(istObjekt(x.absender) ? { absender: { ...LEERER_BETRIEB, ...Object.fromEntries(Object.entries(x.absender).filter(([, w]) => typeof w === "string")) } as Betrieb } : {}) }))
    .sort((a, b) => a.am.localeCompare(b.am))
    .slice(-GETEILT_OFFEN_HOECHSTENS);
}

/** R12: Betriebsstätten lesen – unlesbare Einträge fallen weg. */
function betriebsstaettenAus(roh: unknown): Betriebsstaette[] {
  if (!Array.isArray(roh)) return [];
  const t = (w: unknown) => (typeof w === "string" ? w : "");
  return roh.filter((x): x is Record<string, unknown> => istObjekt(x) && typeof x.id === "string" && Boolean(x.id) && x.id !== HAUPT_STAETTE).map((x) => ({ id: x.id as string, name: t(x.name), strasse: t(x.strasse), plz: t(x.plz), ort: t(x.ort), ...(istIso(x.geaendert) ? { geaendert: x.geaendert } : {}) }));
}

/**
 * Gespeicherten Stand lesen und bereinigen. `null` ergibt den leeren Stand. Unlesbares (kein JSON, kein Objekt) und
 * Stände einer neueren App-Version werfen StandFehler – der Aufrufer darf dann nichts überschreiben (Ladefehler).
 * Unbekannte Vorlagen und unlesbare Belege fallen nicht weg, sondern kommen nach `fremd` (M4).
 */
export function standAus(json: string | null): Stand {
  if (!json) return LEERER_STAND;
  let geparst: unknown;
  try {
    geparst = JSON.parse(json);
  } catch {
    throw new StandFehler("unlesbar");
  }
  if (!istObjekt(geparst)) throw new StandFehler("unlesbar");
  const roh = migrieren(geparst) as Partial<Stand>;
  const betrieb = { ...LEERER_BETRIEB };
  for (const k of Object.keys(LEERER_BETRIEB) as (keyof Betrieb)[]) {
    const w = (roh.betrieb as Record<string, unknown> | undefined)?.[k];
    if (typeof w === "string") betrieb[k] = w;
  }
  const r = roh as Record<string, unknown>;
  const fremdRoh = istObjekt(r.fremd) ? r.fremd : {};
  const liste = (w: unknown) => (Array.isArray(w) ? (w as unknown[]).filter(istObjekt) : []);
  // bekannte Vorlagen in `unterlagen`, unbekannte unverändert in `fremd` – auch aus `fremd` eines älteren Geräts zurück
  const unterlagen: Unterlage[] = [];
  const fremdeUnterlagen: Record<string, unknown>[] = [];
  const gesehen = new Set<string>();
  for (const u of [...liste(r.unterlagen), ...liste(fremdRoh.unterlagen)]) {
    if (typeof u.id !== "string" || gesehen.has(u.id)) continue;
    gesehen.add(u.id);
    if (typeof u.vorlage === "string" && vorlageFuer(u.vorlage) && istObjekt(u.daten)) unterlagen.push(unterlageAus(u));
    else fremdeUnterlagen.push(u);
  }
  const belege: Beleg[] = [];
  const belegArchiv: Beleg[] = [];
  const fremdeBelege: Record<string, unknown>[] = [];
  const belegGesehen = new Set<string>();
  for (const b of [...liste(r.belege), ...liste(r.belegArchiv), ...liste(fremdRoh.belege)]) {
    if (typeof b.id !== "string" || belegGesehen.has(b.id)) continue;
    belegGesehen.add(b.id);
    const g = belegAus(b);
    if (!g) fremdeBelege.push(b);
    else (g.ungueltig ? belegArchiv : belege).push(g);
  }
  // R12: Kassenabschlüsse – unlesbare bleiben unverändert in `fremd.kasse` (Aufbewahrungspflicht)
  const kasse: Kassenabschluss[] = [];
  const fremdeKasse: Record<string, unknown>[] = [];
  const kasseGesehen = new Set<string>();
  for (const k of [...liste(r.kasse), ...liste(fremdRoh.kasse)]) {
    if (typeof k.id === "string" && kasseGesehen.has(k.id)) continue;
    if (typeof k.id === "string") kasseGesehen.add(k.id);
    const g = kassenabschlussAus(k);
    if (g) kasse.push(g);
    else fremdeKasse.push(k);
  }
  const iso = (w: unknown) => (typeof w === "string" && w ? w : undefined);
  const kassenstuerze = kassenstuerzeVereinen([], liste(r.kassenstuerze).map(kassensturzAus).filter((x): x is Kassensturz => x !== null));
  const sachentnahmen = liste(r.sachentnahmen).map(sachentnahmeAus).filter((x): x is Sachentnahme => x !== null);
  const protokoll = protokollAus(r.protokoll);
  const partnerId = partnerIdAus(r.partnerId);
  const nutzungsbedingungen = zustimmungAus(r.nutzungsbedingungen);
  return belegNummernSichern({
    version: 8,
    kasse: kassenVereinen([], kasse),
    kassenstuerze,
    sachentnahmen,
    protokoll,
    betriebsstaetten: betriebsstaettenAus(r.betriebsstaetten),
    betrieb,
    unterlagen,
    belege,
    belegArchiv,
    fremd: { unterlagen: fremdeUnterlagen, belege: fremdeBelege, ...(fremdeKasse.length ? { kasse: fremdeKasse } : {}) },
    mitarbeiter: personenAus(r.mitarbeiter),
    kunden: personenAus(r.kunden),
    lieferanten: personenAus(r.lieferanten),
    profil: profilAus(r.profil),
    erledigt: erledigtAus(r.erledigt),
    erinnerungen: r.erinnerungen === true,
    appSperre: r.appSperre === true,
    cloudSicherung: r.cloudSicherung === true,
    proTest: r.proTest === true,
    bewertung: bewertungAus(r.bewertung),
    steuerberatung: steuerberatungAus(r.steuerberatung),
    geloescht: isoKarte(r.geloescht),
    zeiten: isoKarte(r.zeiten),
    ...(iso(r.geaendert) ? { geaendert: iso(r.geaendert) } : {}),
    ...(iso(r.letzteSicherung) ? { letzteSicherung: iso(r.letzteSicherung) } : {}),
    ...(nachweiseAus(r.sicherungsNachweis).length ? { sicherungsNachweis: nachweiseAus(r.sicherungsNachweis) } : {}),
    ...(partnerId ? { partnerId } : {}),
    ...(nutzungsbedingungen ? { nutzungsbedingungen } : {}),
    ...(iso(r.bezahlschirmNachCheck) ? { bezahlschirmNachCheck: iso(r.bezahlschirmNachCheck) } : {}),
  });
}

/** R12 GoBD: Protokoll lesen – Unlesbares fällt weg. */
function protokollAus(roh: unknown): ProtokollEintrag[] {
  const arten = ["beleg_geloescht", "beleg_ungueltig", "beleg_korrigiert", "sachentnahme_geloescht"];
  return (Array.isArray(roh) ? (roh as unknown[]) : [])
    .filter((x): x is Record<string, unknown> => istObjekt(x) && typeof x.id === "string" && istIso(x.zeitpunkt) && arten.includes(String(x.art)) && typeof x.bezug === "string")
    .map((x) => ({ id: x.id as string, zeitpunkt: x.zeitpunkt as string, art: x.art as ProtokollEintrag["art"], bezug: x.bezug as string, ...(typeof x.nr === "string" && x.nr ? { nr: x.nr } : {}), text: typeof x.text === "string" ? x.text.slice(0, 500) : "" }));
}

/** R12 GoBD: Protokolle zweier Stände nach ID vereinen (nur anhängen). */
export function protokollVereinen(a: readonly ProtokollEintrag[], b: readonly ProtokollEintrag[]): ProtokollEintrag[] {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].sort((x, y) => x.zeitpunkt.localeCompare(y.zeitpunkt) || x.id.localeCompare(y.id));
}

/** R12 GoBD: Sachentnahmen zweier Stände nach ID (gelöschte laut Löschvermerk „e:“ fallen weg). */
export function sachentnahmenVereinen(a: readonly Sachentnahme[], b: readonly Sachentnahme[], geloescht: Record<string, string>): Sachentnahme[] {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) if (!m.has(x.id)) m.set(x.id, x);
  return [...m.values()].filter((x) => !geloescht[`e:${x.id}`]).sort((x, y) => x.datum.localeCompare(y.datum) || x.id.localeCompare(y.id));
}

/**
 * R12 GoBD: Jeder Beleg hat eine feste Amtlos-Belegnummer. Belege ohne Nummer (z. B. von einem Gerät mit älterer App)
 * bekommen die nächste freie; kommt eine Nummer doppelt vor (zwei Geräte offline), behält sie der zuerst erfasste bzw.
 * festgeschriebene Beleg, der andere bekommt die nächste freie – solange er nicht festgeschrieben ist.
 */
export function belegNummernSichern(s: Stand): Stand {
  const alle = [...s.belege, ...s.belegArchiv];
  const ids = new Set(alle.map((b) => b.id));
  // Nummern gelöschter Belege bleiben vergeben (keine Wiederverwendung)
  const vergeben = s.protokoll.filter((p) => p.art === "beleg_geloescht" && !ids.has(p.bezug)).map((p) => p.nr ?? "").filter(Boolean);
  const reihenfolge = [...alle].sort((a, b) => (a.festgeschrieben ? 0 : 1) - (b.festgeschrieben ? 0 : 1) || a.erstellt.localeCompare(b.erstellt) || a.id.localeCompare(b.id));
  const gesehen = new Set<string>(vergeben);
  const neu = new Map<string, string>();
  const fest: { nr?: string | null }[] = alle.filter((b) => b.nr).map((b) => ({ nr: b.nr }));
  for (const b of reihenfolge) {
    if (b.nr && !gesehen.has(b.nr)) {
      gesehen.add(b.nr);
      continue;
    }
    if (b.nr && b.festgeschrieben) continue;
    const nr = naechsteBelegnummer(fest, b.datum.slice(0, 4), [...gesehen]);
    gesehen.add(nr);
    fest.push({ nr });
    neu.set(b.id, nr);
  }
  if (!neu.size) return s;
  const setze = (l: Beleg[]) => l.map((b) => (neu.has(b.id) ? { ...b, nr: neu.get(b.id)! } : b));
  return { ...s, belege: setze(s.belege), belegArchiv: setze(s.belegArchiv) };
}

// Formatter einmal anlegen (R9 Performance): ein neuer Intl.DateTimeFormat je Aufruf ist rund 70× langsamer
const TAG_FORMAT = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
// „heute“ ohne Argument wird in Listen je Zeile abgefragt – je Minute einmal berechnen
let heuteZwischen: { minute: number; tag: string } | null = null;

/** Heutiges Datum in Deutschland als YYYY-MM-DD. */
export const heute = (jetzt?: Date) => {
  if (jetzt) return TAG_FORMAT.format(jetzt);
  const ms = Date.now();
  const minute = Math.floor(ms / 60_000);
  if (heuteZwischen?.minute !== minute) heuteZwischen = { minute, tag: TAG_FORMAT.format(new Date(ms)) };
  return heuteZwischen.tag;
};

/** Neuer, leerer Beleg (von Hand oder mit Foto). Kleinunternehmer (§ 19 UStG) starten ohne Vorsteuerabzug. */
export function leererBeleg(quelle: Beleg["quelle"], datei: string | null, kleinunternehmer = false, jetzt = new Date()): Beleg {
  const iso = jetzt.toISOString();
  return { id: neueId(), datum: heute(jetzt), lieferant: "", nummer: null, kategorie: "sonstiges", steuer: [{ satz: 19, brutto_cent: 0 }], vorsteuer: !kleinunternehmer, zahlung: "bank", bezahlt: null, notiz: null, datei, quelle, erstellt: iso, geaendert: iso };
}

/**
 * Zufallsquelle für IDs. Auf dem Gerät setzt schluesselbund.ts `expo-crypto` ein; sonst Web Crypto (Node, Browser).
 * Math.random nur als letzter Ausweg – IDs müssen über Geräte hinweg kollisionsfest sein (Synchronisation).
 */
let idZufall: ((n: number) => Uint8Array) | null = null;
export const idZufallSetzen = (f: (n: number) => Uint8Array) => {
  idZufall = f;
};
function zufallsBytes(n: number): Uint8Array {
  if (idZufall) return idZufall(n);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) return c.getRandomValues(new Uint8Array(n));
  return Uint8Array.from({ length: n }, () => Math.floor(Math.random() * 256));
}
/** Neue ID: Zeitstempel (Base36, sortierbar) und 64 Bit Zufall (Base36), nur Kleinbuchstaben und Ziffern. */
export const neueId = () => `${Date.now().toString(36)}${Array.from(zufallsBytes(8), (b) => b.toString(36).padStart(2, "0")).join("")}`;

/** Ist der gespeicherte Text lesbar? Unlesbares darf nicht durch einen leeren Stand überschrieben werden. */
export function istLesbar(json: string | null): boolean {
  if (!json) return true;
  try {
    const roh = JSON.parse(json) as unknown;
    return Boolean(roh && typeof roh === "object");
  } catch {
    return false;
  }
}

/** Nächste fortlaufende Nummer einer Vorlage aus allen vorhandenen Unterlagen (festgeschriebene lassen sich nicht löschen). */
function naechste(s: Stand, vorlageId: string, feld: string, jetzt: Date): string {
  // StB-Prüfung (B-12): Gutschriften mit eigenem Nummernkreis („GS-…“) zählen nicht in der Reihe der Rechnungsnummern
  const vorhanden = s.unterlagen.filter((u) => u.vorlage === vorlageId).map((u) => u.daten[feld]).filter((n): n is string => typeof n === "string" && !(vorlageId === "rechnung" && istGutschriftNummer(n)));
  return naechsteNummer(vorhanden, heute(jetzt).slice(0, 4));
}

const nummerVon = (u: Unterlage) => {
  // eine Konfliktkopie (K1) trägt die Nummer der gültigen Fassung – sie zählt nicht als zweite Unterlage
  if (u.konfliktKopieVon) return "";
  const v = vorlageFuer(u.vorlage);
  return v?.fortlaufend && typeof u.daten[v.fortlaufend] === "string" ? (u.daten[v.fortlaufend] as string).trim() : "";
};
// Häufigkeit je „Vorlage|Nummer“ und „Vorlage|Nummer“ je ID, einmal je Liste berechnet – Listen fragen das für jede
// Zeile ab; beides als Map, damit eine Abfrage O(1) bleibt (R9 Performance: vorher quadratisch über alle Unterlagen)
const nummernZaehler = new WeakMap<Unterlage[], { anzahl: Map<string, number>; jeId: Map<string, string> }>();

/** Gibt es dieselbe Nummer schon in einer anderen Unterlage derselben Vorlage? */
export function nummerDoppelt(s: Stand, u: Unterlage): boolean {
  const n = nummerVon(u);
  if (!n) return false;
  let z = nummernZaehler.get(s.unterlagen);
  if (!z) {
    z = { anzahl: new Map(), jeId: new Map() };
    for (const x of s.unterlagen) {
      const nx = nummerVon(x);
      if (!nx) continue;
      const k = `${x.vorlage}|${nx}`;
      z.anzahl.set(k, (z.anzahl.get(k) ?? 0) + 1);
      z.jeId.set(x.id, k);
    }
    nummernZaehler.set(s.unterlagen, z);
  }
  const k = `${u.vorlage}|${n}`;
  const anzahl = z.anzahl.get(k) ?? 0;
  // u selbst zählt mit, wenn es mit derselben Nummer in der Liste steht
  return anzahl - (z.jeId.get(u.id) === k ? 1 : 0) > 0;
}

export const istFest = (u: Unterlage | undefined) => Boolean(u?.festgeschrieben);

export function anlegen(s: Stand, vorlageId: string, jetzt: Date, id = neueId()): [Stand, Unterlage] {
  const v = vorlageFuer(vorlageId);
  if (!v) throw new Error(`Unbekannte Vorlage: ${vorlageId}`);
  // Branche aus dem Pflichten-Check: manche Vorbelegungen passen nur in bestimmten Branchen (R10)
  const daten = leereDaten(v, s.betrieb, heute(jetzt), gruppenAusBranchen(s.profil["taetigkeit.branchen"]));
  // fortlaufende Nummer (Rechnung): aus den vorhandenen Unterlagen derselben Vorlage weiterzählen
  if (v.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  // Startwerte aus dem Pflichten-Check (z. B. Kleinunternehmer), pro Unterlage überschreibbar
  for (const [feld, profilFeld] of Object.entries(v.ausProfil ?? {})) {
    const w = s.profil[profilFeld];
    if (w === undefined || w === null || Array.isArray(w)) continue;
    // Zahl für einen Schalter (z. B. „Davon unter 18 Jahren: 1“ → „Mit Jugendlichen“): an, sobald größer als 0
    const schalter = v.abschnitte.some((a) => a.felder.some((f) => f.id === feld && f.art === "schalter"));
    daten[feld] = schalter ? (typeof w === "number" ? w > 0 : w === true) : typeof w === "number" ? String(w) : w;
  }
  // Startwerte aus „Mein Betrieb“ (z. B. Soll-/Ist-Versteuerung)
  for (const [feld, betriebsFeld] of Object.entries(v.ausBetrieb ?? {})) {
    const w = s.betrieb[betriebsFeld];
    if (typeof w !== "string" || !w.trim()) continue;
    // Auswahlfelder (z. B. Rechtsform) nur mit einer passenden Option füllen – „GmbH“, „UG“, „e.K.“ gleich ohne Punkte/Leerzeichen
    const def = v.abschnitte.flatMap((a) => a.felder).find((f) => f.id === feld);
    if (def?.art === "wahl") {
      const norm = (x: string) => x.toLowerCase().replace(/[\s.]/g, "");
      const opt = def.optionen.find((o) => norm(o.wert) === norm(w)) ?? def.optionen.find((o) => norm(o.wert).startsWith(norm(w)));
      if (opt) daten[feld] = opt.wert;
    } else daten[feld] = w;
  }
  // R12: Nachweise mit Fassungen tragen den Tag ihrer letzten Änderung („Fassung vom …“ im PDF)
  if (v.korrektur) daten.fassung_stand = heute(jetzt);
  // StB GoBD (D-11): Verfahrensdokumentation mit dem Nachweis der letzten Vollsicherung außerhalb des Geräts
  if (v.id === "verfahrensdokumentation") {
    const n = letzteVollsicherung(s.sicherungsNachweis);
    if (n) daten.sicherung_nachweis = nachweisText(n);
  }
  // R12 (Bäckerei #3): Kassenmeldung mit den Betriebsstätten aus „Mein Betrieb“
  if (v.id === "kassenmeldung" && s.betriebsstaetten.length) daten.betriebsstaetten = s.betriebsstaetten.filter((b) => b.name.trim()).map((b) => ({ name: b.name.trim(), anschrift: [b.strasse.trim(), [b.plz.trim(), b.ort.trim()].filter(Boolean).join(" ")].filter(Boolean).join("\n") }));
  const u: Unterlage = { id, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString() };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** R12: Felder eines Arbeitstags, die seinen Inhalt ausmachen (ohne Zeitstempel). */
const TAG_FELDER = ["datum", "beginn", "ende", "pause", "einsatzort", "bemerkung"] as const;
const tagInhalt = (e: Eintrag) => TAG_FELDER.map((k) => (typeof e[k] === "string" ? (e[k] as string).trim() : "")).join("\u0000");
const tagLeer = (e: Eintrag) => TAG_FELDER.slice(1).every((k) => !(typeof e[k] === "string" && (e[k] as string).trim()));
/** Zeitstempel eines Arbeitstags entfernen (Kopie eines Tags, einer Woche oder des ganzen Nachweises). */
export const ohneStempel = (e: Eintrag): Eintrag => (({ erfasst_am: _e, geaendert_am: _g, ...rest }) => rest)(e);

/**
 * R12 (Zoll #2, #3): Je Arbeitstag „erfasst am“ (sobald er Inhalt hat) und „geändert am“ (Inhalt später geändert) –
 * Tage, die gleich geblieben sind, behalten ihre Stempel. Ein Tag ohne Stempel ist neu.
 */
export function tageStempeln(alt: Daten, neu: Daten, tag: string): Daten {
  if (!Array.isArray(neu.tage)) return neu;
  const vorher = Array.isArray(alt.tage) ? (alt.tage as Eintrag[]) : [];
  const gleich = new Set(vorher.filter((e) => typeof e.erfasst_am === "string").map((e) => `${e.erfasst_am as string}\u0001${tagInhalt(e)}`));
  // ein Tag ohne Stempel mit genau dem Inhalt eines gestempelten Tags ist derselbe Tag (z. B. neu sortiert eingelesen)
  const nachInhalt = new Map(vorher.filter((e) => typeof e.erfasst_am === "string").map((e) => [tagInhalt(e), e]));
  let geaendert = false;
  const tage = (neu.tage as Eintrag[]).map((e) => {
    if (!e || typeof e !== "object") return e;
    if (typeof e.erfasst_am !== "string" || !e.erfasst_am) {
      if (tagLeer(e)) return e;
      geaendert = true;
      const alt = nachInhalt.get(tagInhalt(e));
      if (alt) return { ...e, erfasst_am: alt.erfasst_am as string, ...(typeof alt.geaendert_am === "string" ? { geaendert_am: alt.geaendert_am } : {}) };
      return { ...e, erfasst_am: tag };
    }
    if (gleich.has(`${e.erfasst_am}\u0001${tagInhalt(e)}`) || e.erfasst_am === tag || e.geaendert_am === tag) return e;
    geaendert = true;
    return { ...e, geaendert_am: tag };
  });
  return geaendert ? { ...neu, tage } : neu;
}

/** R12: nach einer Änderung – Zeitstempel der Arbeitstage und Tag der Fassung (nur Vorlagen mit `korrektur`). */
function nachAenderung(u: Unterlage, daten: Daten, jetzt: Date): Daten {
  const v = vorlageFuer(u.vorlage);
  if (!v?.korrektur) return daten;
  const tag = heute(jetzt);
  const d = u.vorlage === "arbeitszeitnachweis" ? tageStempeln(u.daten, daten, tag) : daten;
  return d.fassung_stand === tag ? d : { ...d, fassung_stand: tag };
}

/** Festgeschriebene Unterlagen bleiben, wie sie sind (GoBD, E-127). */
export function aendern(s: Stand, id: string, daten: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id && !u.festgeschrieben ? { ...u, daten: nachAenderung(u, daten, jetzt), geaendert: jetzt.toISOString() } : u)) };
}

/** Ein Feld setzen (bzw. mehrere) – liest den aktuellen Stand, damit schnelles Tippen nichts verliert. */
export function felderSetzen(s: Stand, id: string, werte: Daten, jetzt: Date): Stand {
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id && !u.festgeschrieben ? { ...u, daten: nachAenderung(u, { ...u.daten, ...werte }, jetzt), geaendert: jetzt.toISOString() } : u)) };
}

/**
 * R12 (Zoll #2): festgeschriebenen Nachweis korrigieren – nur mit Grund. Die geltende Fassung kommt unverändert in die
 * Historie (`fassungen`); die Unterlage wird mit Fassungsnummer, Datum der ersetzten Fassung und Grund wieder Entwurf
 * und beim nächsten Teilen neu festgeschrieben. Die erste Ausgabe bleibt (die Pflicht bleibt erledigt).
 */
export function korrigieren(s: Stand, id: string, grund: string, jetzt: Date): Stand {
  const u = s.unterlagen.find((x) => x.id === id);
  if (!u || !u.festgeschrieben || !vorlageFuer(u.vorlage)?.korrektur || !grund.trim() || u.konfliktKopieVon) return s;
  const iso = jetzt.toISOString();
  const alterGrund = typeof u.daten.fassung_grund === "string" && u.daten.fassung_grund.trim() ? u.daten.fassung_grund.trim() : undefined;
  const fassung: Fassung = { daten: u.daten, festgeschrieben: u.festgeschrieben, ...(u.ausgegeben ? { ausgegeben: u.ausgegeben } : {}), ...(u.pdfSha256 ? { pdfSha256: u.pdfSha256 } : {}), ...(alterGrund ? { grund: alterGrund } : {}), ersetzt: iso };
  const fassungen = [...(u.fassungen ?? []), fassung];
  const daten: Daten = { ...u.daten, fassung_nr: String(fassungen.length + 1), fassung_ersetzt: heute(new Date(u.festgeschrieben)), fassung_grund: grund.trim(), fassung_stand: heute(jetzt) };
  const { festgeschrieben: _f, pdfSha256: _p, ...rest } = u;
  return { ...s, unterlagen: s.unterlagen.map((x) => (x.id === id ? { ...rest, daten, geaendert: iso, fassungen } : x)) };
}

/** R12: Tag (YYYY-MM-DD), an dem die Fassung festgeschrieben bzw. zuletzt geteilt wurde. */
export const geteiltAm = (u: Pick<Unterlage, "festgeschrieben" | "ausgegeben">) => (u.festgeschrieben ?? u.ausgegeben ?? null);

/**
 * Lässt sich die Unterlage mit genau diesem Inhalt ausgeben (H1)? `daten` ist der Inhalt, aus dem das PDF erzeugt
 * wurde. Hat sich die Unterlage inzwischen geändert (z. B. hat die Synchronisation während des Teilen-Menüs einen
 * neueren Entwurf gebracht), darf nicht festgeschrieben werden – sonst stünde etwas anderes fest, als verschickt wurde.
 */
export function ausgabeMoeglich(s: Stand, id: string, daten?: Daten): boolean {
  const u = s.unterlagen.find((x) => x.id === id);
  if (!u) return false;
  return !daten || Boolean(u.festgeschrieben) || JSON.stringify(u.daten) === JSON.stringify(daten);
}

/**
 * Als PDF geteilt oder gedruckt: merken, und Vorlagen mit `festschreiben` festschreiben. Mit `daten` (Inhalt des PDFs)
 * nur, wenn die Unterlage noch genau diesen Inhalt hat – sonst bleibt der Stand unverändert (siehe `ausgabeMoeglich`).
 */
export function ausgeben(s: Stand, id: string, jetzt: Date, daten?: Daten, pdfSha256?: string, absender?: Betrieb, eRechnung?: boolean): Stand {
  if (!ausgabeMoeglich(s, id, daten)) return s;
  // E-156: als E-Rechnung geteilt – vermerken (danach immer wieder teilbar, auch ohne Pro)
  if (eRechnung) {
    const mit = ausgeben(s, id, jetzt, daten, pdfSha256, absender);
    return { ...mit, unterlagen: mit.unterlagen.map((u) => (u.id === id && !u.eRechnungGeteilt ? { ...u, eRechnungGeteilt: jetzt.toISOString() } : u)) };
  }
  const vorher = s.unterlagen.find((u) => u.id === id);
  const neu: Stand = {
    ...s,
    unterlagen: s.unterlagen.map((u) => {
      if (u.id !== id) return u;
      const v = vorlageFuer(u.vorlage);
      const fest = v?.festschreiben;
      if (u.ausgegeben && (!fest || u.festgeschrieben)) return u;
      const festschreiben = fest && !u.festgeschrieben;
      if (!festschreiben) return { ...u, ausgegeben: u.ausgegeben ?? jetzt.toISOString() };
      // R12 GoBD: Absenderdaten und XRechnung so festhalten, wie sie jetzt ausgegeben werden (§ 14b UStG)
      const betrieb = absender ?? s.betrieb;
      const e = v?.eRechnung ? eRechnungAus(u.daten, betrieb) : null;
      return { ...u, ausgegeben: u.ausgegeben ?? jetzt.toISOString(), festgeschrieben: jetzt.toISOString(), ...(pdfSha256 ? { pdfSha256 } : {}), ...(v?.eRechnung ? { absender: { ...betrieb } } : {}), ...(e && !e.fehlt.length ? { xml: xrechnungUbl(e.daten, KU_HINWEIS) } : {}) };
    }),
  };
  // R12 GoBD: eine abgegebene (geteilte) Voranmeldung schreibt die Belege ihres Zeitraums fest
  if (vorher?.vorlage === "ust_voranmeldung" && !vorher.ausgegeben) {
    const z = zeitraumAusText(vorher.daten.zeitraum);
    if (z) return belegeFestschreiben(neu, neu.belege.filter((b) => (b.datum >= z.von && b.datum <= z.bis) || (zahltagVon(b) >= z.von && zahltagVon(b) <= z.bis)).map((b) => b.id), jetzt);
  }
  return neu;
}

/**
 * E-193 (4): Android – geteilt bzw. gedruckt, aber „Nein, noch nicht“ verschickt: nicht festschreiben, nur die Fassung
 * merken, die das Gerät verlassen haben könnte (für „Doch verschickt – festschreiben“ und als Nachweis). Nur bei Vorlagen
 * mit `festschreiben`, die noch nicht festgeschrieben sind.
 */
export function teilenOffenVermerken(s: Stand, id: string, jetzt: Date, f: Omit<GeteilteFassung, "am">): Stand {
  return {
    ...s,
    unterlagen: s.unterlagen.map((u) => {
      if (u.id !== id || u.festgeschrieben || !vorlageFuer(u.vorlage)?.festschreiben) return u;
      const g: GeteilteFassung = { am: jetzt.toISOString(), art: f.art, daten: f.daten, ...(f.pdfSha256 ? { pdfSha256: f.pdfSha256 } : {}), ...(f.absender ? { absender: { ...f.absender } } : {}) };
      return { ...u, geteiltOffen: [...(u.geteiltOffen ?? []), g].slice(-GETEILT_OFFEN_HOECHSTENS) };
    }),
  };
}

/** E-193 (4): zuletzt geteilte, unbestätigte Fassung – und ob die Unterlage seitdem geändert wurde. */
export function geteiltOffenLetzte(u: Pick<Unterlage, "geteiltOffen" | "daten" | "festgeschrieben">): { fassung: GeteilteFassung; geaendert: boolean } | null {
  const f = !u.festgeschrieben ? u.geteiltOffen?.at(-1) : undefined;
  return f ? { fassung: f, geaendert: JSON.stringify(f.daten) !== JSON.stringify(u.daten) } : null;
}

/**
 * E-193 (4): „Doch verschickt – festschreiben“ – die zuletzt geteilte Fassung wird festgeschrieben, genau mit dem Inhalt,
 * PDF-Hash und Absender, mit dem sie hinausging (GoBD: was das Gerät verlassen hat, ändert sich nicht mehr). Änderungen
 * seit dem Teilen werden dabei verworfen. Erste Ausgabe = erste unbestätigte Ausgabe; festgeschrieben = jetzt.
 */
export function geteilteFassungFestschreiben(s: Stand, id: string, jetzt: Date): Stand {
  const u = s.unterlagen.find((x) => x.id === id);
  const letzte = u ? geteiltOffenLetzte(u) : null;
  if (!u || !letzte) return s;
  const f = letzte.fassung;
  const erste = u.ausgegeben ?? u.geteiltOffen![0]!.am;
  const vorher: Stand = { ...s, unterlagen: s.unterlagen.map((x) => (x.id === id ? { ...x, daten: f.daten, ...(letzte.geaendert ? { geaendert: jetzt.toISOString() } : {}) } : x)) };
  const fest = ausgeben(vorher, id, jetzt, f.daten, f.pdfSha256, f.absender, f.art === "xml");
  return { ...fest, unterlagen: fest.unterlagen.map((x) => (x.id === id && x.festgeschrieben ? { ...x, ausgegeben: erste } : x)) };
}

const zahltagVon = (b: Pick<Beleg, "datum" | "bezahlt">) => b.bezahlt || b.datum;
const MONATSNAMEN = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];

/**
 * R12 GoBD: Zeitraum einer Voranmeldung aus ihrem Feld „Zeitraum“ (z. B. „Oktober 2026“, „3. Quartal 2026“, „Q3 2026“,
 * „2026-10“, „2026-Q3“) – null, wenn er sich nicht eindeutig lesen lässt.
 */
export function zeitraumAusText(w: unknown): { von: string; bis: string; periode: string } | null {
  if (typeof w !== "string") return null;
  const t = w.trim().toLocaleLowerCase("de");
  let periode: string | null = null;
  let m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(t) ?? null;
  if (m) periode = `${m[1]}-${m[2]}`;
  m = periode ? null : /^(\d{4})-q([1-4])$/.exec(t);
  if (m) periode = `${m[1]}-Q${m[2]}`;
  m = periode ? null : /^([1-4])\.?\s*quartal\s+(\d{4})$/.exec(t) ?? /^q([1-4])\s*\/?\s*(\d{4})$/.exec(t);
  if (m) periode = `${m[2]}-Q${m[1]}`;
  m = periode ? null : /^([a-zä]+)\s+(\d{4})$/.exec(t);
  if (m && MONATSNAMEN.includes(m[1]!)) periode = `${m[2]}-${String(MONATSNAMEN.indexOf(m[1]!) + 1).padStart(2, "0")}`;
  if (!periode) return null;
  const z = ustZeitraum(periode);
  return z ? { von: z.von, bis: z.bis, periode } : null;
}

/** R12 GoBD: abgegebene (geteilte) Voranmeldung, deren Zeitraum diesen Tag enthält – ihr Zeitraum als Text, sonst null. */
export function vaAbgegebenFuer(s: Pick<Stand, "unterlagen">, tag: string): string | null {
  for (const u of s.unterlagen) {
    if (u.vorlage !== "ust_voranmeldung" || !u.ausgegeben) continue;
    const z = zeitraumAusText(u.daten.zeitraum);
    if (z && tag >= z.von && tag <= z.bis) return String(u.daten.zeitraum).trim();
  }
  return null;
}

/** R12 GoBD: Absender einer Unterlage – bei festgeschriebenen Rechnungen der festgehaltene, sonst „Mein Betrieb“. */
export const absenderFuer = (s: Pick<Stand, "betrieb">, u: Pick<Unterlage, "absender" | "festgeschrieben"> | undefined): Betrieb => (u?.festgeschrieben && u.absender ? u.absender : s.betrieb);

/**
 * Storno (E-127): eine festgeschriebene Rechnung wird nicht geändert, sondern durch eine Stornorechnung mit neuer
 * Nummer und negativen Beträgen aufgehoben; die Stornorechnung verweist auf Nummer und Datum der ursprünglichen.
 */
export function stornieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const alt = s.unterlagen.find((u) => u.id === id);
  const v = alt ? vorlageFuer(alt.vorlage) : undefined;
  if (!alt || !v?.storno || !alt.festgeschrieben || alt.storniertDurch || alt.daten.storno_zu || alt.konfliktKopieVon) return [s, null];
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const negativ = (p: unknown) => (typeof p === "string" && p.trim() ? (p.trim().startsWith("-") ? p.trim().slice(1) : `-${p.trim()}`) : p);
  if (Array.isArray(daten.positionen)) daten.positionen = (daten.positionen as Record<string, unknown>[]).map((e) => ({ ...e, preis: negativ(e.preis) })) as Daten[string];
  daten.storno_zu = typeof alt.daten.nummer === "string" ? alt.daten.nummer : "";
  daten.storno_zu_datum = typeof alt.daten.datum === "string" ? alt.daten.datum : null;
  // E-193 (8b): Storno einer Schlussrechnung spiegelt auch die abgesetzten Abschläge – es hebt nur den Rest auf
  if (alt.daten.schluss === true) daten[STORNO_ABSCHLAEGE] = true;
  daten.datum = heute(jetzt);
  if (v.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  const u: Unterlage = { id: neu, vorlage: v.id, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString(), stornoZuId: id };
  return [{ ...s, unterlagen: [u, ...s.unterlagen.map((x) => (x.id === id ? { ...x, storniertDurch: neu } : x))] }, u];
}

/**
 * Kopie, z. B. für den nächsten Monat oder einen weiteren Arbeitsbereich. R11: Die Kopie einer stornierten Rechnung –
 * oder ihrer Stornorechnung, dann mit den Daten der ursprünglichen Rechnung – ist die Ersatzrechnung und merkt sich
 * das Original (`ersetzt`).
 */
export function kopieren(s: Stand, id: string, jetzt: Date, neu = neueId()): [Stand, Unterlage | null] {
  const gewaehlt = s.unterlagen.find((u) => u.id === id);
  if (!gewaehlt) return [s, null];
  const stornoVon = gewaehlt.stornoZuId ? s.unterlagen.find((u) => u.id === gewaehlt.stornoZuId) : undefined;
  const alt = stornoVon ?? gewaehlt;
  const ersetzt = stornoVon ? stornoVon.id : alt.storniertDurch && !alt.daten.storno_zu ? alt.id : undefined;
  const daten = JSON.parse(JSON.stringify(alt.daten)) as Daten;
  const v = vorlageFuer(alt.vorlage);
  // eine kopierte Rechnung bekommt die nächste Nummer – Nummern dürfen nur einmal vorkommen
  if (v?.fortlaufend) daten[v.fortlaufend] = naechste(s, v.id, v.fortlaufend, jetzt);
  // die Kopie ist ein neuer Entwurf: kein Storno-Bezug, nicht ausgegeben, nicht festgeschrieben
  delete daten.storno_zu;
  delete daten.storno_zu_datum;
  // StB-Prüfung (C-6): die Ersatzrechnung nennt die stornierte Rechnung (Voranmeldung: Korrektur im Zeitraum des Stornos; XRechnung BG-3)
  if (ersetzt && alt.vorlage === "rechnung" && typeof alt.daten.nummer === "string") daten.ersetzt_nummer = alt.daten.nummer;
  else delete daten.ersetzt_nummer;
  // R12: die Kopie eines Nachweises ist eine neue erste Fassung – ohne Fassungsangaben und Zeitstempel der Tage
  if (v?.korrektur) {
    for (const k of ["fassung_nr", "fassung_ersetzt", "fassung_grund"]) delete daten[k];
    daten.fassung_stand = heute(jetzt);
    if (Array.isArray(daten.tage)) daten.tage = (daten.tage as Eintrag[]).map(ohneStempel);
  }
  // fortlaufend nummerierte Unterlagen (Rechnung) bekommen das heutige Datum – sonst passt die Nummernfolge nicht
  if (v?.fortlaufend && typeof daten.datum === "string") daten.datum = heute(jetzt);
  const u: Unterlage = { id: neu, vorlage: alt.vorlage, daten, erstellt: jetzt.toISOString(), geaendert: jetzt.toISOString(), ...(ersetzt ? { ersetzt } : {}) };
  return [{ ...s, unterlagen: [u, ...s.unterlagen] }, u];
}

/** Löschen – außer festgeschriebene Unterlagen (Korrektur nur per Storno bzw. neue Fassung) und Nachweise mit Fassungen. */
export function loeschen(s: Stand, id: string): Stand {
  const weg = s.unterlagen.find((u) => u.id === id && !u.festgeschrieben && !u.fassungen?.length);
  if (!weg) return s;
  // ein verworfener Storno-Entwurf gibt die ursprüngliche Rechnung wieder frei
  return { ...vermerken(s, `u:${id}`), unterlagen: s.unterlagen.filter((u) => u.id !== id).map((u) => (u.storniertDurch === id ? (({ storniertDurch: _weg, ...rest }) => rest)(u) : u)) };
}

/** Person aus einer Unterlage merken (gleicher Name ergänzt den vorhandenen Eintrag). */
export function personMerken(s: Stand, art: PersonenArt, angaben: PersonAngaben, id = neueId(), jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const vorher = new Map(s[k].map((p) => [p.id, JSON.stringify(p)]));
  // geänderte oder neue Einträge bekommen einen Zeitstempel – sonst käme eine neue Anschrift beim Synchronisieren nicht an
  const liste = merken(s[k], angaben, id).map((p) => (vorher.get(p.id) === JSON.stringify(p) ? p : { ...p, geaendert: jetzt.toISOString() }));
  return { ...s, [k]: liste };
}

/** Person anlegen oder ändern (Bearbeiten unter „Mein Betrieb“). */
export function personSetzen(s: Stand, art: PersonenArt, p: Person, jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const neu = { ...p, geaendert: jetzt.toISOString() };
  return { ...s, [k]: s[k].some((x) => x.id === p.id) ? s[k].map((x) => (x.id === p.id ? neu : x)) : [...s[k], neu] };
}

export function personLoeschen(s: Stand, art: PersonenArt, id: string): Stand {
  const k = PERSONEN_LISTE[art];
  return { ...vermerken(s, `${art === "mitarbeiter" ? "m" : "k"}:${id}`), [k]: s[k].filter((x) => x.id !== id) };
}

/** Personen alphabetisch. */
export const personenSortiert = (l: Person[]) => [...l].filter((p) => p.name.trim()).sort((a, b) => a.name.localeCompare(b.name, "de"));

/** Antworten im Pflichten-Check setzen. Das Bundesland übernimmt „Mein Betrieb“, solange dort keins steht. */
export function profilSetzen(s: Stand, werte: Stand["profil"], bundeslandName?: string): Stand {
  const betrieb = bundeslandName && !s.betrieb.bundesland ? { ...s.betrieb, bundesland: bundeslandName } : s.betrieb;
  const jetzt = new Date();
  let mit = mitZeit(betrieb === s.betrieb ? s : mitZeit(s, "betrieb", jetzt), "profil", jetzt);
  // je Antwort ein eigener Zeitpunkt (G1): so gehen Antworten auf zwei Geräten beim Synchronisieren nicht verloren
  for (const k of Object.keys(werte)) mit = mitZeit(mit, `profil:${k}`, jetzt);
  return { ...mit, betrieb, profil: { ...s.profil, ...werte } };
}

/** Pflicht abhaken bzw. den Haken entfernen. Wiederkehrende Pflichten gelten nur für einen Termin („Datum|Termin“). */
export function erledigtSetzen(s: Stand, pflichtId: string, datum: string | null, termin?: string | null): Stand {
  const erledigt = { ...s.erledigt };
  if (datum) erledigt[pflichtId] = termin ? `${datum}|${termin}` : datum;
  else delete erledigt[pflichtId];
  // je Pflicht ein eigener Zeitpunkt (G1): Haken auf zwei Geräten an verschiedenen Pflichten bleiben beide
  const jetzt = new Date();
  return { ...mitZeit(mitZeit(s, "erledigt", jetzt), `erledigt:${pflichtId}`, jetzt), erledigt };
}

export function betriebSetzen(s: Stand, b: Betrieb): Stand {
  return { ...mitZeit(s, "betrieb"), betrieb: b };
}

export const steuerberatungSetzen = (s: Stand, sb: Stand["steuerberatung"], jetzt = new Date()): Stand => ({ ...mitZeit(s, "steuerberatung", jetzt), steuerberatung: sb });

/** Zuletzt bearbeitete zuerst. */
// je Unterlagenliste einmal sortiert (R9 Performance: Seiten fragen das bei jedem Zeichnen ab) – nicht verändern
const sortiertZwischen = new WeakMap<Unterlage[], Unterlage[]>();
export const sortiert = (s: Stand): Unterlage[] => {
  let l = sortiertZwischen.get(s.unterlagen);
  if (!l) {
    l = [...s.unterlagen].sort((a, b) => b.geaendert.localeCompare(a.geaendert));
    sortiertZwischen.set(s.unterlagen, l);
  }
  return l;
};

/**
 * Inhaltlich gleich wie im JSON (R9 Performance, ersetzt den Vergleich zweier JSON.stringify des ganzen Stands):
 * Gleiche Objekte werden sofort übersprungen – nach dem Zusammenführen ist fast alles noch dasselbe Objekt. Schlüssel
 * mit `undefined` zählen wie fehlende (wie in JSON); die Reihenfolge der Schlüssel spielt keine Rolle.
 */
export function gleicherInhalt(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b) ? true : false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    const y = b as unknown[];
    if (a.length !== y.length) return false;
    for (let i = 0; i < a.length; i++) if (!gleicherInhalt(a[i] === undefined ? null : a[i], y[i] === undefined ? null : y[i])) return false;
    return true;
  }
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  for (const k in x) if (x[k] !== undefined && !gleicherInhalt(x[k], y[k])) return false;
  for (const k in y) if (y[k] !== undefined && x[k] === undefined) return false;
  return true;
}

/** Zwei Stände inhaltlich gleich – ohne den Zeitpunkt der letzten Änderung. */
export const standGleich = (a: Stand, b: Stand) => gleicherInhalt({ ...a, geaendert: undefined }, { ...b, geaendert: undefined });

export const betriebFehlt = (b: Betrieb) => !b.name.trim();

/**
 * Zahlungseingang einer Rechnung setzen bzw. entfernen (E-129): der ganze Betrag an diesem Tag. Einzelne Zahlungen
 * (R12) fallen dabei weg – „bezahlt“ heißt hier: vollständig.
 */
export function bezahltSetzen(s: Stand, id: string, datum: string | null, jetzt = new Date()): Stand {
  // eigener Zeitstempel: beim Zusammenführen gewinnt so auch das Entfernen einer Zahlung
  const g = jetzt.toISOString();
  return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === id ? (datum ? (({ zahlungen: _z, ...rest }) => ({ ...rest, bezahlt: datum, bezahltGeaendert: g }))(u) : (({ bezahlt: _weg, zahlungen: _z, ...rest }) => ({ ...rest, bezahltGeaendert: g }))(u)) : u)) };
}

/** Rechnungsbetrag brutto (Storno negativ) – für Zahlungen; StB-Prüfung (C-4): bei einer Schlussrechnung der Rest nach den Abschlägen. */
function bruttoVon(s: Stand, u: Unterlage): number {
  const { daten } = eRechnungAus(u.daten, s.betrieb);
  return zahlbetrag(daten);
}

/** Zahlungen einer Rechnung: die Liste, sonst (ältere Daten, „als bezahlt markiert“) der ganze Betrag am Tag `bezahlt`. */
export function zahlungenVon(s: Stand, u: Unterlage): Zahlung[] {
  if (u.zahlungen?.length) return u.zahlungen;
  return u.bezahlt ? [{ id: `${u.id}-voll`, datum: u.bezahlt, betrag_cent: bruttoVon(s, u) }] : [];
}

/** Offener Betrag einer Rechnung (brutto) nach allen Zahlungen und Minderungen. */
export function offenerBetrag(s: Stand, u: Unterlage): number {
  const brutto = bruttoVon(s, u);
  if (u.bezahlt && !u.zahlungen?.length) return 0;
  return zahlungsStand(brutto, u.zahlungen ?? []).offen;
}

/**
 * R12: Zahlungseingang mit Betrag vermerken – optional mit Skonto bzw. Minderung (§ 17 UStG). Ist danach nichts mehr
 * offen, gilt die Rechnung ab diesem Tag als bezahlt; sonst bleibt der Rest offen (Teilzahlung).
 */
export function zahlungVermerken(s: Stand, id: string, z: Omit<Zahlung, "id">, jetzt = new Date(), zid = neueId()): Stand {
  const u = s.unterlagen.find((x) => x.id === id);
  if (!u || u.vorlage !== "rechnung") return s;
  const neu: Zahlung = { id: zid, datum: z.datum, betrag_cent: Math.max(0, Math.round(z.betrag_cent)), ...(z.minderung_cent ? { minderung_cent: Math.max(0, Math.round(z.minderung_cent)), art: z.art ?? "skonto" } : {}) };
  if (!neu.betrag_cent && !neu.minderung_cent) return s;
  // eine ältere Vollzahlung ohne Liste wird zur ersten Zahlung
  const zahlungen = [...zahlungenVon(s, u), neu];
  const alle = zahlungenAus(zahlungen);
  const offen = zahlungsStand(bruttoVon(s, u), alle).offen;
  const g = jetzt.toISOString();
  const { bezahlt: _b, ...rest } = u;
  const letzter = alle[alle.length - 1]!.datum;
  return { ...s, unterlagen: s.unterlagen.map((x) => (x.id === id ? { ...rest, zahlungen: alle, bezahltGeaendert: g, ...(offen === 0 ? { bezahlt: letzter } : {}) } : x)) };
}

/** R12: neuer Kassenabschluss – gespeichert ist er festgeschrieben (GoBD). */
export function kasseSpeichern(s: Stand, inhalt: KassenInhalt, jetzt = new Date(), id = neueId()): [Stand, Kassenabschluss] {
  const iso = jetzt.toISOString();
  // R12 GoBD: Bewegungen bekommen ihre Eigenbeleg-Nummer beim Speichern
  const k: Kassenabschluss = { id, ...kassenInhalt(eigenbelegeVergeben(inhalt, s.kasse)), erstellt: iso, geaendert: iso, festgeschrieben: iso };
  return [{ ...s, kasse: kassenVereinen(s.kasse, [k]) }, k];
}

/** R12: Kassenabschluss korrigieren – nur mit Grund, die vorige Fassung bleibt in der Historie. */
export function kasseKorrigieren(s: Stand, id: string, inhalt: KassenInhalt, grund: string, jetzt = new Date()): Stand {
  // R12 GoBD: Grund mit mindestens 10 Zeichen; neue Bewegungen bekommen eine Eigenbeleg-Nummer
  if (!grundGenuegt(grund)) return s;
  return { ...s, kasse: s.kasse.map((k) => (k.id === id ? kassenKorrektur(k, eigenbelegeVergeben(inhalt, s.kasse), grund, jetzt.toISOString()) : k)) };
}

/** R12 GoBD: Kassensturz speichern (unveränderlich). */
export function kassensturzSpeichern(s: Stand, k: Omit<Kassensturz, "id" | "zeitpunkt">, jetzt = new Date(), id = neueId()): [Stand, Kassensturz] {
  const neu = kassensturzAus({ ...k, id, zeitpunkt: jetzt.toISOString() })!;
  return [{ ...s, kassenstuerze: kassenstuerzeVereinen(s.kassenstuerze, [neu]) }, neu];
}

/** R12 GoBD: Sachentnahme speichern. */
export function sachentnahmeSpeichern(s: Stand, e: Omit<Sachentnahme, "id" | "erstellt">, jetzt = new Date(), id = neueId()): Stand {
  const neu = sachentnahmeAus({ ...e, id, erstellt: jetzt.toISOString() });
  return neu ? { ...s, sachentnahmen: [...s.sachentnahmen, neu].sort((a, b) => a.datum.localeCompare(b.datum)) } : s;
}

/** R12 GoBD: Sachentnahme löschen – mit Protokolleintrag und Löschvermerk („e:“). */
export function sachentnahmeLoeschen(s: Stand, id: string, jetzt = new Date()): Stand {
  const e = s.sachentnahmen.find((x) => x.id === id);
  if (!e) return s;
  const iso = jetzt.toISOString();
  return { ...vermerken(s, `e:${id}`, jetzt), sachentnahmen: s.sachentnahmen.filter((x) => x.id !== id), protokoll: [...s.protokoll, { id: neueId(), zeitpunkt: iso, art: "sachentnahme_geloescht", bezug: id, text: `Sachentnahme ${e.datum} gelöscht (7 %: ${(e.netto7_cent / 100).toFixed(2)} €, 19 %: ${(e.netto19_cent / 100).toFixed(2)} € netto)` }] };
}

/**
 * R12 GoBD: Kassenbuch eines Monats aus den Tagesabschlüssen festschreiben – beim ersten Teilen. Gibt es schon ein
 * festgeschriebenes Kassenbuch für Monat und Standort mit anderem Inhalt (Tagesabschluss inzwischen korrigiert),
 * kommt die bisherige Fassung in die Historie und die neue gilt (Fassung 2 …). Gleicher Inhalt: nichts ändert sich.
 */
export function kassenbuchFestschreiben(s: Stand, monat: string, standort: string, daten: Daten, sha256: string, jetzt = new Date(), id = neueId()): Stand {
  const iso = jetzt.toISOString();
  const alt = s.unterlagen.find((u) => u.vorlage === "kassenbuch" && u.kassenbuch?.monat === monat && u.kassenbuch.standort === standort && !u.konfliktKopieVon);
  if (alt && alt.festgeschrieben && JSON.stringify(alt.daten) === JSON.stringify(daten)) return s;
  if (alt && alt.festgeschrieben) {
    const fassung: Fassung = { daten: alt.daten, festgeschrieben: alt.festgeschrieben, ...(alt.ausgegeben ? { ausgegeben: alt.ausgegeben } : {}), ...(alt.inhaltSha256 ? { pdfSha256: alt.inhaltSha256 } : {}), grund: "Tagesabschlüsse seit der Festschreibung korrigiert bzw. ergänzt", ersetzt: iso };
    return { ...s, unterlagen: s.unterlagen.map((u) => (u.id === alt.id ? { ...u, daten, geaendert: iso, festgeschrieben: iso, ausgegeben: iso, inhaltSha256: sha256, fassungen: [...(u.fassungen ?? []), fassung] } : u)) };
  }
  const u: Unterlage = { id, vorlage: "kassenbuch", daten, erstellt: iso, geaendert: iso, ausgegeben: iso, festgeschrieben: iso, kassenbuch: { monat, standort }, inhaltSha256: sha256 };
  return { ...s, unterlagen: [u, ...s.unterlagen] };
}

/** R12 GoBD: festgeschriebenes Kassenbuch zu Monat und Standort (oder undefined). */
export const kassenbuchFest = (s: Pick<Stand, "unterlagen">, monat: string, standort: string) => s.unterlagen.find((u) => u.vorlage === "kassenbuch" && u.kassenbuch?.monat === monat && u.kassenbuch.standort === standort && u.festgeschrieben && !u.konfliktKopieVon);

/** Monate, die Nachweise nach § 17 Abs. 1 MiLoG (Arbeitszeit) bzw. nach dem Ende der Beschäftigung aufbewahrt werden. */
export const NACHWEIS_MONATE = 24;

const plusMonateIso = (iso: string, n: number) => {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1 + n, t)).toISOString().slice(0, 10);
};
const gleicherName = (a: unknown, b: unknown) => typeof a === "string" && typeof b === "string" && a.trim() !== "" && a.trim().toLocaleLowerCase("de") === b.trim().toLocaleLowerCase("de");

/**
 * R12 (Zoll #10): bis wann ein Nachweis (Vorlage mit `korrektur`) aufzubewahren ist – YYYY-MM-DD, „9999-12-31“ solange
 * die Person beschäftigt ist; null für andere Vorlagen. Arbeitszeit: 24 Monate nach dem letzten Arbeitstag
 * (§ 17 Abs. 1 MiLoG). NachwG-Nachweis und Ausweis-Hinweis: für die Dauer der Beschäftigung und danach noch 24 Monate
 * (Prüfzeitraum der FKS); ohne gespeicherte Person 24 Monate nach der Ausgabe.
 */
export function aufbewahrenBis(s: Pick<Stand, "mitarbeiter">, u: Unterlage): string | null {
  const v = vorlageFuer(u.vorlage);
  if (!v?.korrektur) return null;
  // R12 GoBD: Verfahrensdokumentation (Organisationsunterlage) – 10 Jahre (§ 147 Abs. 3 AO), solange sie die Aufzeichnungen beschreibt: immer
  if (u.vorlage === "verfahrensdokumentation") return "9999-12-31";
  const ab = (u.ausgegeben ?? u.festgeschrieben ?? u.geaendert).slice(0, 10);
  if (u.vorlage === "arbeitszeitnachweis") {
    const tage = (Array.isArray(u.daten.tage) ? (u.daten.tage as Eintrag[]) : []).map((x) => x?.datum).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    return plusMonateIso(tage.at(-1) ?? ab, NACHWEIS_MONATE);
  }
  const p = s.mitarbeiter.find((m) => gleicherName(m.name, u.daten.name));
  if (!p) return plusMonateIso(ab, NACHWEIS_MONATE);
  return typeof p.ende === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.ende) ? plusMonateIso(p.ende > ab ? p.ende : ab, NACHWEIS_MONATE) : "9999-12-31";
}

/**
 * Festgeschriebene Unterlagen, die aufzubewahren sind: alle Rechnungen und Kassenbücher; Nachweise (R12) mit Fassungen
 * oder festgeschrieben, solange ihre Frist läuft.
 */
function festAufbewahren(s: Stand, u: Unterlage, tag: string): boolean {
  if (!u.festgeschrieben && !u.fassungen?.length) return false;
  const bis = aufbewahrenBis(s, u);
  return bis === null ? Boolean(u.festgeschrieben) : bis >= tag;
}

/** Unterlagen, die aufbewahrt werden müssen: festgeschriebene (Rechnungen, Kassenbuch, Nachweise in ihrer Frist), Belege (auch ungültig markierte) und Unbekanntes. */
export const aufbewahrungspflichtig = (s: Stand, tag = heute()): { id: string }[] => [...s.unterlagen.filter((u) => festAufbewahren(s, u, tag)), ...s.belege, ...s.belegArchiv, ...s.kasse, ...s.kassenstuerze, ...s.sachentnahmen, ...((s.fremd.kasse ?? []) as { id: string }[]), ...(s.fremd.unterlagen as { id: string }[]), ...(s.fremd.belege as { id: string }[])];

/**
 * Ruhezeit für das Änderungsprotokoll der Belege (H2): War ein Beleg so lange unverändert, wird vor der nächsten
 * Änderung seine bisherige Fassung festgehalten. Tippen in einem Feld erzeugt so nur einen Eintrag, nicht einen je Taste.
 */
export const BELEG_RUHE_MS = 10 * 60 * 1000;
/** So lange nach dem Erfassen darf ein Beleg noch endgültig gelöscht werden (falsch erfasst, doppelt fotografiert). */
export const BELEG_LOESCHBAR_MS = 24 * 60 * 60 * 1000;

/**
 * Beleg anlegen oder ändern (E-133). Änderungen an einem älteren Beleg werden protokolliert (H2).
 * R12 GoBD: Ein neuer Beleg bekommt sofort seine feste Amtlos-Belegnummer. Ein festgeschriebener Beleg (im Paket bzw.
 * in einer abgegebenen Voranmeldung) ändert sich nur mit Grund (mindestens 10 Zeichen) – die vorige Fassung kommt mit
 * diesem Grund sofort in die Historie und ins Protokoll; ohne Grund bleibt der Stand unverändert.
 */
export function belegSetzen(s: Stand, b: Beleg, jetzt: Date, grund?: string): Stand {
  const alt = s.belege.find((x) => x.id === b.id);
  // ungültig markierte Belege bleiben, wie sie sind
  if (!alt && s.belegArchiv.some((x) => x.id === b.id)) return s;
  const iso = jetzt.toISOString();
  const historie = [...(alt?.historie ?? [])];
  const geaendert = alt ? belegInhaltGeaendert(alt, b) : false;
  let protokoll = s.protokoll;
  if (alt?.festgeschrieben && geaendert) {
    if (!grundGenuegt(grund)) return s;
    historie.push(belegFassung(alt, iso, grund));
    protokoll = [...protokoll, { id: neueId(), zeitpunkt: iso, art: "beleg_korrigiert", bezug: b.id, ...(alt.nr ? { nr: alt.nr } : {}), text: grund!.trim().slice(0, 300) }];
  } else if (alt && geaendert && jetzt.getTime() - Date.parse(alt.geaendert) > BELEG_RUHE_MS) historie.push(belegFassung(alt, iso));
  const { historie: _h, ...rest } = b;
  // Nummer und Festschreibung gehören nicht zum Inhalt – sie bleiben, wie sie sind
  const nr = alt?.nr ?? b.nr ?? naechsteBelegnummer([...s.belege, ...s.belegArchiv], b.datum.slice(0, 4), s.protokoll.map((p) => p.nr ?? "").filter(Boolean));
  const neu: Beleg = { ...rest, nr, ...(alt?.festgeschrieben ? { festgeschrieben: alt.festgeschrieben } : {}), geaendert: iso, ...(historie.length ? { historie } : {}) };
  return { ...s, protokoll, belege: alt ? s.belege.map((x) => (x.id === b.id ? neu : x)) : [neu, ...s.belege] };
}

/** R12 GoBD: Belege festschreiben (Steuerberater-Paket, abgegebene Voranmeldung) – schon festgeschriebene behalten ihren Zeitpunkt. */
export function belegeFestschreiben(s: Stand, ids: readonly string[], jetzt = new Date()): Stand {
  const set = new Set(ids);
  if (!s.belege.some((b) => set.has(b.id) && !b.festgeschrieben)) return s;
  const iso = jetzt.toISOString();
  return { ...s, belege: s.belege.map((b) => (set.has(b.id) && !b.festgeschrieben ? { ...b, festgeschrieben: iso, geaendert: iso } : b)) };
}

/**
 * Darf der Beleg endgültig gelöscht werden? Nur leer (nichts erfasst) oder frisch erfasst (24 Stunden) und noch in
 * keinem Paket bzw. keiner abgegebenen Voranmeldung (R12 GoBD) – sonst wird er ungültig markiert.
 */
export function belegEndgueltigLoeschbar(b: Beleg, jetzt = new Date()): boolean {
  if (b.festgeschrieben) return false;
  const leer = !b.lieferant.trim() && !b.datei && !belegSummen(b).brutto_cent;
  return leer || jetzt.getTime() - Date.parse(b.erstellt) < BELEG_LOESCHBAR_MS;
}

/**
 * Beleg löschen (H2): Leere oder frisch erfasste Belege werden gelöscht (mit Löschvermerk für die Synchronisation).
 * Alle anderen liegen in der Aufbewahrungsfrist – sie werden mit Grund als ungültig markiert und ins Archiv gelegt;
 * Datensatz und Datei bleiben erhalten.
 */
export function belegLoeschen(s: Stand, id: string, jetzt = new Date(), grund = "In der App als ungültig markiert"): Stand {
  const b = s.belege.find((x) => x.id === id);
  if (!b) return s;
  const iso = jetzt.toISOString();
  const leer = !b.lieferant.trim() && !b.datei && !belegSummen(b).brutto_cent;
  // R12 GoBD: jede Löschung steht im Protokoll (außer einem leeren, nie ausgefüllten Beleg) – die Nummer bleibt vergeben
  const eintrag = (art: ProtokollEintrag["art"], text: string): ProtokollEintrag => ({ id: neueId(), zeitpunkt: iso, art, bezug: id, ...(b.nr ? { nr: b.nr } : {}), text });
  const beschreibung = `${b.lieferant.trim() || "ohne Lieferant"}, ${b.datum}, ${(belegSummen(b).brutto_cent / 100).toFixed(2).replace(".", ",")} € brutto`;
  if (belegEndgueltigLoeschbar(b, jetzt)) return { ...vermerken(s, `b:${id}`, jetzt), belege: s.belege.filter((x) => x.id !== id), protokoll: leer ? s.protokoll : [...s.protokoll, eintrag("beleg_geloescht", `Innerhalb von 24 Stunden nach der Erfassung gelöscht: ${beschreibung}`)] };
  return { ...s, belege: s.belege.filter((x) => x.id !== id), belegArchiv: [{ ...b, ungueltig: iso, ungueltig_grund: grund, geaendert: iso }, ...s.belegArchiv.filter((x) => x.id !== id)], protokoll: [...s.protokoll, eintrag("beleg_ungueltig", `Als ungültig markiert (${grund}): ${beschreibung}`)] };
}

/** Belege nach Belegdatum, neueste zuerst. */
export const belegeSortiert = (s: Stand) => [...s.belege].sort((a, b) => b.datum.localeCompare(a.datum) || b.geaendert.localeCompare(a.geaendert));

/** Seit der letzten Datensicherung geändert (oder nie gesichert)? */
export function ungesichert(s: Stand): boolean {
  if (!s.letzteSicherung) return s.unterlagen.length > 0 || s.belege.length > 0 || s.kasse.length > 0 || s.belegArchiv.length > 0 || s.mitarbeiter.length > 0 || s.kunden.length > 0;
  return Boolean(s.geaendert && s.geaendert > s.letzteSicherung);
}

/**
 * „Alle Daten löschen“ (E-129): Liegen aufbewahrungspflichtige Unterlagen auf dem Gerät, nur mit einer Sicherung,
 * die nach der letzten Änderung erstellt wurde – sonst wären Rechnungen weg, die Jahre aufbewahrt werden müssen.
 */
export const allesLoeschenErlaubt = (s: Stand) => aufbewahrungspflichtig(s).length === 0 || !ungesichert(s);

/** Tage seit der letzten Sicherung, wenn eine fällig ist (ungesicherte Änderungen, älter als `nach` Tage), sonst null. */
export function sicherungFaellig(s: Stand, jetzt: Date, nach = 7): { tage: number | null } | null {
  if (!ungesichert(s) || (s.unterlagen.length === 0 && s.belege.length === 0 && s.kasse.length === 0)) return null;
  if (!s.letzteSicherung) return { tage: null };
  const tage = Math.floor((jetzt.getTime() - Date.parse(s.letzteSicherung)) / 864e5);
  return tage >= nach ? { tage } : null;
}

const istStornoRechnung = (u: Unterlage) => typeof u.daten.storno_zu === "string" && u.daten.storno_zu.trim() !== "";

/**
 * Ziel jeder Stornorechnung: über `stornoZuId` (M1), bei älteren Daten über die Nummer – aber nur, wenn sie
 * eindeutig ist (zwei offline vergebene gleiche Nummern dürfen nicht beide als storniert gelten).
 */
function stornoZiele(l: Unterlage[]): Map<string, Unterlage[]> {
  const nachId = new Map(l.map((u) => [u.id, u]));
  const nachNummer = new Map<string, Unterlage[]>();
  for (const x of l) {
    const n = nummerVon(x);
    if (n && !istStornoRechnung(x)) nachNummer.set(`${x.vorlage}|${n}`, [...(nachNummer.get(`${x.vorlage}|${n}`) ?? []), x]);
  }
  const ziele = new Map<string, Unterlage[]>();
  for (const st of l) {
    if (!istStornoRechnung(st) || st.konfliktKopieVon) continue;
    const kandidaten = st.stornoZuId ? [nachId.get(st.stornoZuId)].filter((x): x is Unterlage => Boolean(x)) : (nachNummer.get(`${st.vorlage}|${String(st.daten.storno_zu).trim()}`) ?? []);
    const ziel = kandidaten.length === 1 ? kandidaten[0]! : undefined;
    if (ziel && ziel.id !== st.id) ziele.set(ziel.id, [...(ziele.get(ziel.id) ?? []), st]);
  }
  return ziele;
}

/** Festgeschriebene Stornos einer Rechnung, die zuerst festgeschriebene vorn (eindeutig auf allen Geräten). */
const festeStornos = (stornos: Unterlage[]) => stornos.filter((x) => x.festgeschrieben).sort((a, b) => a.festgeschrieben!.localeCompare(b.festgeschrieben!) || a.id.localeCompare(b.id));

/**
 * Storno-Verweise abgleichen: Verweise auf eine Stornorechnung, die es nicht (mehr) gibt, entfernen – sonst ließe
 * sich die Rechnung nie mehr korrigieren; fehlende Verweise aus den vorhandenen Stornorechnungen ergänzen. Gibt es
 * mehrere Stornos zu einer Rechnung (zwei Geräte offline, K2), zeigt der Verweis auf allen Geräten auf dieselbe:
 * die zuerst festgeschriebene, sonst den Entwurf mit der kleinsten ID.
 */
export function stornoVerweisePruefen(l: Unterlage[]): Unterlage[] {
  const ids = new Set(l.map((u) => u.id));
  const ziele = stornoZiele(l);
  return l.map((u) => {
    const stornos = ziele.get(u.id) ?? [];
    const gewaehlt = festeStornos(stornos)[0] ?? [...stornos].sort((a, b) => a.id.localeCompare(b.id))[0];
    // ohne zuordenbares Storno: einen vorhandenen Verweis nur behalten, wenn die Stornorechnung noch da ist
    // und nicht eindeutig zu einer anderen Rechnung gehört
    const behalten = u.storniertDurch && ids.has(u.storniertDurch) && ![...ziele.entries()].some(([ziel, l2]) => ziel !== u.id && l2.some((x) => x.id === u.storniertDurch)) ? u.storniertDurch : undefined;
    const sd = istStornoRechnung(u) ? behalten : (gewaehlt?.id ?? behalten);
    if (sd === u.storniertDurch) return u;
    if (!sd) return (({ storniertDurch: _weg, ...rest }) => rest)(u);
    return { ...u, storniertDurch: sd };
  });
}

/**
 * Was in Umsatzsteuer-Voranmeldung, EÜR, DATEV-Export und Listen nicht mitzählt (K1, K2): Konfliktkopien und
 * festgeschriebene Stornorechnungen, auf die die stornierte Rechnung nicht verweist (doppelt storniert) – je
 * Ursprungsrechnung zählt nur die Stornorechnung aus `storniertDurch`.
 */
export function nichtZaehlend(l: Unterlage[]): Set<string> {
  const aus = new Set(l.filter((u) => u.konfliktKopieVon).map((u) => u.id));
  const nachId = new Map(l.map((u) => [u.id, u]));
  for (const [ziel, stornos] of stornoZiele(l)) {
    const sd = nachId.get(ziel)?.storniertDurch;
    for (const st of stornos) if (st.id !== sd) aus.add(st.id);
  }
  return aus;
}

/** Nummern von Rechnungen mit mehr als einer festgeschriebenen Stornorechnung (K2). */
export function mehrfachStorniert(l: Unterlage[]): string[] {
  const nachId = new Map(l.map((u) => [u.id, u]));
  return [...stornoZiele(l)].filter(([, st]) => festeStornos(st).length > 1).map(([ziel]) => nummerVon(nachId.get(ziel)!) || ziel).sort();
}

const frueher = (x?: string, y?: string) => (x && y ? (x < y ? x : y) : (x ?? y));

/** Kurzer, auf allen Geräten gleicher Hash (FNV-1a) – für die ID einer Konfliktkopie. */
function kurzHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(36);
}

export interface Vereinigung {
  u: Unterlage;
  /** zweite, abweichend festgeschriebene Fassung (K1) – als Konfliktkopie unter neuer ID aufzubewahren */
  kopie?: Unterlage;
}

/**
 * Zwei Fassungen derselben Unterlage vereinen (Synchronisation und Wiederherstellen). Festgeschrieben schlägt
 * Entwurf, zwischen Entwürfen gewinnt die zuletzt geänderte Fassung. Sind beide festgeschrieben, wird der Inhalt nie
 * übernommen (K1): Gültig bleibt die zuerst festgeschriebene Fassung; weicht die andere ab, kommt sie als
 * Konfliktkopie zurück. Vermerke werden feldweise vereint: erste Ausgabe und Festschreibung nach dem früheren Datum,
 * ein Storno-Verweis aus jeder Fassung, die Zahlung nach dem Zeitpunkt ihrer letzten Änderung (ohne Zeitpunkt –
 * ältere Daten – bleibt eine vorhandene Zahlung erhalten).
 */
export function unterlagenVereinen(lokal: Unterlage, andere: Unterlage): Vereinigung {
  const fl = Boolean(lokal.festgeschrieben);
  const fa = Boolean(andere.festgeschrieben);
  // R12: eine Korrektur (mehr Fassungen) ist neuer als die Fassung, die sie ersetzt – auch wenn diese festgeschrieben ist
  const sl = lokal.fassungen?.length ?? 0;
  const sa = andere.fassungen?.length ?? 0;
  let basis: Unterlage;
  let kopie: Unterlage | undefined;
  if (sl !== sa) basis = sl > sa ? lokal : andere;
  else if (fl && fa) {
    const dl = JSON.stringify(lokal.daten);
    const da = JSON.stringify(andere.daten);
    // zuerst festgeschrieben gewinnt; bei gleichem Zeitpunkt entscheidet der Inhalt – auf allen Geräten gleich
    basis = lokal.festgeschrieben! < andere.festgeschrieben! ? lokal : andere.festgeschrieben! < lokal.festgeschrieben! ? andere : dl <= da ? lokal : andere;
    const zweite = basis === lokal ? andere : lokal;
    if (dl !== da) {
      const { storniertDurch: _s, bezahlt: _b, bezahltGeaendert: _bg, zahlungen: _z, ...rest } = zweite;
      kopie = { ...rest, id: `${lokal.id}-konflikt-${kurzHash(JSON.stringify(zweite.daten))}`, konfliktKopieVon: lokal.id };
    }
  } else basis = fl !== fa ? (fl ? lokal : andere) : lokal.geaendert >= andere.geaendert ? lokal : andere;
  const zweite = basis === lokal ? andere : lokal;
  const r: Unterlage = { ...basis };
  const ausgegeben = frueher(lokal.ausgegeben, andere.ausgegeben);
  if (ausgegeben) r.ausgegeben = ausgegeben;
  // E-156: einmal als E-Rechnung geteilt bleibt geteilt – aus jeder Fassung, das frühere Datum
  const eRechnung = frueher(lokal.eRechnungGeteilt, andere.eRechnungGeteilt);
  if (eRechnung) r.eRechnungGeteilt = eRechnung;
  if (fl && fa && sl === sa) r.festgeschrieben = frueher(lokal.festgeschrieben, andere.festgeschrieben);
  // E-193 (4): unbestätigte Ausgaben beider Seiten (nach Zeitpunkt) – keine geht verloren
  const offen = new Map<string, GeteilteFassung>();
  for (const g of [...(lokal.geteiltOffen ?? []), ...(andere.geteiltOffen ?? [])]) if (!offen.has(g.am)) offen.set(g.am, g);
  if (offen.size) r.geteiltOffen = [...offen.values()].sort((a, b) => a.am.localeCompare(b.am)).slice(-GETEILT_OFFEN_HOECHSTENS);
  else delete r.geteiltOffen;
  // R12: Fassungen beider Seiten – keine geht verloren (nach Zeitpunkt der Festschreibung)
  const fassungen = new Map<string, Fassung>();
  for (const f of [...(lokal.fassungen ?? []), ...(andere.fassungen ?? [])]) if (!fassungen.has(f.festgeschrieben)) fassungen.set(f.festgeschrieben, f);
  if (fassungen.size) r.fassungen = [...fassungen.values()].sort((a, b) => a.festgeschrieben.localeCompare(b.festgeschrieben));
  else delete r.fassungen;
  const storno = basis.storniertDurch ?? zweite.storniertDurch;
  if (storno) r.storniertDurch = storno;
  const zl = lokal.bezahltGeaendert ?? "";
  const za = andere.bezahltGeaendert ?? "";
  const quelle = zl || za ? (zl >= za ? lokal : andere) : lokal.bezahlt ? lokal : andere;
  delete r.bezahlt;
  delete r.bezahltGeaendert;
  delete r.zahlungen;
  if (quelle.bezahlt) r.bezahlt = quelle.bezahlt;
  if (quelle.bezahltGeaendert) r.bezahltGeaendert = quelle.bezahltGeaendert;
  // R12: die Zahlungen gehören zum Zahlungsvermerk – sie kommen aus derselben Fassung wie `bezahlt`
  if (quelle.zahlungen?.length) r.zahlungen = quelle.zahlungen;
  return kopie ? { u: r, kopie } : { u: r };
}

/** Wie `unterlagenVereinen`, nur die gültige Fassung. */
export const unterlageVereinen = (lokal: Unterlage, andere: Unterlage): Unterlage => unterlagenVereinen(lokal, andere).u;

/**
 * Unterlagen zweier Stände nach ID vereinen; Konfliktkopien (K1) kommen dazu und werden ihrerseits vereint.
 * Liefert die vereinten Unterlagen und die Nummern (bzw. IDs) der Unterlagen mit Konflikt.
 */
export function unterlagenZusammenfuehren(lokal: Unterlage[], andere: Unterlage[], ueberspringen: (x: Unterlage) => boolean = () => false): { liste: Map<string, Unterlage>; konflikte: string[]; neu: number; aktualisiert: number; behalten: number } {
  const m = new Map(lokal.map((u) => [u.id, u]));
  const konflikte = new Set<string>();
  let neu = 0;
  let aktualisiert = 0;
  let behalten = 0;
  const dazu = (e: Unterlage, zaehlen: boolean) => {
    const l = m.get(e.id);
    if (!l) {
      m.set(e.id, e);
      if (zaehlen) neu++;
      return;
    }
    const v = unterlagenVereinen(l, e);
    m.set(e.id, v.u);
    if (zaehlen) {
      if (JSON.stringify(v.u) === JSON.stringify(l)) behalten++;
      else aktualisiert++;
    }
    if (v.kopie) {
      konflikte.add(nummerVon(v.u) || v.u.id);
      dazu(v.kopie, false);
    }
  };
  for (const e of andere) if (!ueberspringen(e)) dazu(e, true);
  return { liste: m, konflikte: [...konflikte].sort(), neu, aktualisiert, behalten };
}

/** Belege beider Seiten (gültige und ungültig markierte) nach ID: die zuletzt geänderte Fassung gewinnt. */
export function belegeVereinen(a: Beleg[], b: Beleg[]): Map<string, Beleg> {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const l = m.get(x.id);
    if (!l || l.geaendert < x.geaendert) m.set(x.id, x);
  }
  return m;
}

/** Fremdes (unbekannte Vorlagen, unlesbare Belege) beider Seiten nach ID vereinen – nie etwas verlieren. */
export function fremdVereinen(a: Stand["fremd"], b: Stand["fremd"]): Stand["fremd"] {
  const vereinen = (x: Record<string, unknown>[], y: Record<string, unknown>[]) => {
    const m = new Map(x.map((e) => [String(e.id), e]));
    for (const e of y) {
      const l = m.get(String(e.id));
      if (!l || String(l.geaendert ?? "") < String(e.geaendert ?? "")) m.set(String(e.id), e);
    }
    return [...m.values()];
  };
  const kasse = vereinen(a.kasse ?? [], b.kasse ?? []);
  return { unterlagen: vereinen(a.unterlagen, b.unterlagen), belege: vereinen(a.belege, b.belege), ...(kasse.length ? { kasse } : {}) };
}

export interface Zusammenfuehrung {
  stand: Stand;
  neu: number;
  behalten: number;
  aktualisiert: number;
  /** gleiche Nummer in zwei verschiedenen Unterlagen derselben Vorlage */
  nummernKonflikte: string[];
  /** auf zwei Geräten verschieden festgeschrieben (K1): gültig bleibt die zuerst festgeschriebene, die andere ist Konfliktkopie */
  festKonflikte: string[];
  /** Rechnungen mit mehr als einer festgeschriebenen Stornorechnung (K2) */
  mehrfachStorniert: string[];
}

/**
 * Sicherung zurückspielen, ohne Neueres zu verlieren (E-129): Unterlagen werden nach ID zusammengeführt (siehe
 * `unterlagenVereinen`). Was nur auf dem Gerät existiert, bleibt. Auf dem Gerät gelöschte Entwürfe kommen nicht
 * zurück (M7); ausdrücklich wiederhergestellte Belege schon – sie bekommen einen neuen Zeitstempel, damit sie einen
 * Löschvermerk schlagen (H2). Personen, Antworten und Haken werden ergänzt; „Mein Betrieb“ nur übernommen, wenn er leer ist.
 */
/** Steuerberatung noch wie im leeren Stand (SKR03, keine Nummern, keine Kontenvorgaben)? */
const steuerberatungLeer = (sb: Stand["steuerberatung"]) => JSON.stringify(sb) === JSON.stringify(LEERER_STAND.steuerberatung);

/**
 * E-193 (8c): Angaben für die Steuerberatung beim Wiederherstellen – bisher blieb immer die Fassung des Geräts, auf einem
 * neuen Gerät also der Standard SKR03 ohne Berater- und Mandantennummer, und das nächste Paket ging still im falschen
 * Kontenrahmen hinaus. Jetzt wie bei der Synchronisation: die zuletzt geänderte Fassung (`zeiten.steuerberatung`); hat
 * das Gerät keinen Zeitpunkt, die aus der Sicherung – außer beide haben keinen (ältere Daten) und nur das Gerät hat Angaben.
 */
export function steuerberatungVereinen(aktuell: Pick<Stand, "steuerberatung" | "zeiten">, gesichert: Pick<Stand, "steuerberatung" | "zeiten">): Stand["steuerberatung"] {
  const tl = aktuell.zeiten.steuerberatung;
  const tg = gesichert.zeiten.steuerberatung;
  if (tl) return !tg || tl >= tg ? aktuell.steuerberatung : gesichert.steuerberatung;
  if (!tg && steuerberatungLeer(gesichert.steuerberatung)) return aktuell.steuerberatung;
  return gesichert.steuerberatung;
}

export function zusammenfuehren(aktuell: Stand, gesichert: Stand, jetzt = new Date()): Zusammenfuehrung {
  // Löschvermerke für Entwürfe beider Seiten (M7) – festgeschriebene Unterlagen werden nie gelöscht
  const geloescht: Record<string, string> = { ...aktuell.geloescht };
  for (const [k, v] of Object.entries(gesichert.geloescht)) if (k.startsWith("u:") && (!geloescht[k] || v > geloescht[k]!)) geloescht[k] = v;
  const vermerk = (u: Unterlage) => geloescht[`u:${u.id}`];
  const zuletzt = (x: Unterlage) => (x.ausgegeben && x.ausgegeben > x.geaendert ? x.ausgegeben : x.geaendert);
  const weg = (u: Unterlage) => !u.festgeschrieben && Boolean(vermerk(u)) && zuletzt(u) <= vermerk(u)!;
  const u = unterlagenZusammenfuehren(aktuell.unterlagen, gesichert.unterlagen, weg);
  const unterlagen = stornoVerweisePruefen([...u.liste.values()].filter((x) => !weg(x)));

  const personen = (a: Person[], g: Person[]) => [...a, ...g.filter((p) => !a.some((x) => x.id === p.id))];
  // Belege: nach ID, die zuletzt geänderte Fassung gewinnt; nur auf dem Gerät Vorhandenes bleibt
  const lokaleBelege = [...aktuell.belege, ...aktuell.belegArchiv];
  const lokalIds = new Map(lokaleBelege.map((b) => [b.id, b]));
  let neu = u.neu;
  let aktualisiert = u.aktualisiert;
  let behalten = u.behalten;
  const iso = jetzt.toISOString();
  const wieder: Beleg[] = [];
  for (const g of [...gesichert.belege, ...gesichert.belegArchiv]) {
    const a = lokalIds.get(g.id);
    if (!a) {
      neu++;
      // auf dem Gerät (oder einem anderen) gelöscht, jetzt bewusst zurückgeholt: schlägt den Löschvermerk
      if (geloescht[`b:${g.id}`]) {
        delete geloescht[`b:${g.id}`];
        wieder.push({ ...g, geaendert: iso });
      } else wieder.push(g);
    } else if (a.geaendert < g.geaendert) {
      aktualisiert++;
      wieder.push(g);
    } else behalten++;
  }
  const belegNachId = belegeVereinen(lokaleBelege, wieder);
  const alleBelege = [...belegNachId.values()];
  const erledigt = { ...gesichert.erledigt, ...aktuell.erledigt };
  // E-193 (8c): Zeitpunkte je Bereich beider Seiten (der spätere je Schlüssel) – sonst hielte eine spätere
  // Synchronisation die wiederhergestellten Angaben für älter als die leeren des Geräts
  const zeiten: Record<string, string> = { ...gesichert.zeiten };
  for (const [k, v] of Object.entries(aktuell.zeiten)) if (!zeiten[k] || v > zeiten[k]!) zeiten[k] = v;
  const stand: Stand = {
    ...aktuell,
    betrieb: betriebFehlt(aktuell.betrieb) ? gesichert.betrieb : aktuell.betrieb,
    steuerberatung: steuerberatungVereinen(aktuell, gesichert),
    zeiten,
    unterlagen,
    belege: alleBelege.filter((b) => !b.ungueltig),
    belegArchiv: alleBelege.filter((b) => b.ungueltig),
    mitarbeiter: personen(aktuell.mitarbeiter, gesichert.mitarbeiter),
    kunden: personen(aktuell.kunden, gesichert.kunden),
    lieferanten: personen(aktuell.lieferanten, gesichert.lieferanten),
    profil: { ...gesichert.profil, ...aktuell.profil },
    erledigt,
    geloescht,
    fremd: fremdVereinen(aktuell.fremd, gesichert.fremd),
    // R12: Kassenabschlüsse nach ID – nie etwas verlieren, Korrekturen beider Seiten bleiben in der Historie
    kasse: kassenVereinen(aktuell.kasse, gesichert.kasse),
    // R12: Betriebsstätten nach ID, die zuletzt geänderte gewinnt; auf dem Gerät gelöschte kommen nicht zurück
    betriebsstaetten: staettenVereinen(aktuell.betriebsstaetten, gesichert.betriebsstaetten, geloescht),
    // R12 GoBD: Kassenstürze und Protokoll nie verlieren; Sachentnahmen nach ID
    kassenstuerze: kassenstuerzeVereinen(aktuell.kassenstuerze, gesichert.kassenstuerze),
    protokoll: protokollVereinen(aktuell.protokoll, gesichert.protokoll),
    sachentnahmen: sachentnahmenVereinen(aktuell.sachentnahmen, gesichert.sachentnahmen, aktuell.geloescht),
  };
  // Phase 2.3: Partner aus der Sicherung nur übernehmen, wenn auf dem Gerät keiner gesetzt ist
  const partnerId = aktuell.partnerId ?? gesichert.partnerId;
  if (partnerId) stand.partnerId = partnerId;
  // E-193 (8c): Nachweise der Vollsicherung (StB GoBD, D-11) beider Seiten – der Nachweis geht mit der Sicherung nicht verloren
  const nachweise = nachweiseAus([...(aktuell.sicherungsNachweis ?? []), ...(gesichert.sicherungsNachweis ?? [])].filter((n, i, a) => a.findIndex((x) => x.am === n.am && x.ziel === n.ziel) === i));
  if (nachweise.length) stand.sicherungsNachweis = nachweise;
  return { stand: belegNummernSichern(stand), neu, behalten, aktualisiert, nummernKonflikte: nummernKonflikteVon(stand), festKonflikte: u.konflikte, mehrfachStorniert: mehrfachStorniert(stand.unterlagen) };
}

/** Nummern, die in zwei verschiedenen Unterlagen derselben Vorlage vorkommen. */
export function nummernKonflikteVon(s: Stand): string[] {
  return [...new Set(s.unterlagen.filter((u) => nummerDoppelt(s, u)).map(nummerVon))].filter(Boolean).sort();
}

/** R12: Betriebsstätten zweier Stände nach ID – die zuletzt geänderte gewinnt; mit Löschvermerk („s:“) älteres weg. */
export function staettenVereinen(a: Betriebsstaette[], b: Betriebsstaette[], geloescht: Record<string, string>): Betriebsstaette[] {
  const m = new Map(a.map((x) => [x.id, x]));
  for (const x of b) {
    const l = m.get(x.id);
    if (!l || (l.geaendert ?? "") < (x.geaendert ?? "")) m.set(x.id, x);
  }
  return [...m.values()].filter((x) => !geloescht[`s:${x.id}`] || (x.geaendert ?? "") > geloescht[`s:${x.id}`]!);
}

/** R12: Name und Anschrift einer Betriebsstätte (ID „haupt“ bzw. leer: der Betrieb selbst). */
export function staetteVon(s: Pick<Stand, "betrieb" | "betriebsstaetten">, id: string | null | undefined): { id: string; name: string; anschrift: string } {
  const st = id && id !== HAUPT_STAETTE ? s.betriebsstaetten.find((x) => x.id === id) : undefined;
  const b = st ?? { name: s.betrieb.name, strasse: s.betrieb.strasse, plz: s.betrieb.plz, ort: s.betrieb.ort };
  return { id: st?.id ?? HAUPT_STAETTE, name: b.name.trim() || "Betrieb", anschrift: [b.strasse.trim(), [b.plz.trim(), b.ort.trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ") };
}

/** R12: alle Betriebsstätten zur Auswahl – der Betrieb zuerst. */
export const alleStaetten = (s: Pick<Stand, "betrieb" | "betriebsstaetten">) => [staetteVon(s, HAUPT_STAETTE), ...s.betriebsstaetten.map((x) => staetteVon(s, x.id))];

/** R12: Anzahl der Betriebsstätten für den Pflichten-Check (Profil `betriebsstaetten.anzahl`): der Betrieb und die weiteren. */
const mitStaettenAnzahl = (s: Stand): Stand => {
  const n = 1 + s.betriebsstaetten.length;
  return s.profil["betriebsstaetten.anzahl"] === n ? s : profilSetzen(s, { "betriebsstaetten.anzahl": n });
};

/** R12: Betriebsstätte anlegen oder ändern – schreibt die Anzahl ins Profil des Pflichten-Checks. */
export function staetteSetzen(s: Stand, st: Betriebsstaette, jetzt = new Date()): Stand {
  const neu = { ...st, geaendert: jetzt.toISOString() };
  const liste = s.betriebsstaetten.some((x) => x.id === st.id) ? s.betriebsstaetten.map((x) => (x.id === st.id ? neu : x)) : [...s.betriebsstaetten, neu];
  return mitStaettenAnzahl({ ...s, betriebsstaetten: liste });
}

/** R12: Betriebsstätte löschen (Zuordnungen von Personen und Unterlagen fallen auf den Betrieb zurück). */
export function staetteLoeschen(s: Stand, id: string, jetzt = new Date()): Stand {
  if (!s.betriebsstaetten.some((x) => x.id === id)) return s;
  const unterlagen = s.unterlagen.map((u) => (u.betriebsstaette === id ? (({ betriebsstaette: _b, ...rest }) => rest)(u) : u));
  const mitarbeiter = s.mitarbeiter.map((p): Person => (p.betriebsstaette === id ? { ...p, betriebsstaette: null, geaendert: jetzt.toISOString() } : p));
  return mitStaettenAnzahl({ ...vermerken(s, `s:${id}`, jetzt), betriebsstaetten: s.betriebsstaetten.filter((x) => x.id !== id), unterlagen, mitarbeiter });
}

/**
 * R12: alle verschlüsselt abgelegten Dateien des Stands – Belegfotos, Z-Bons und Kopien der Aufenthaltstitel
 * (Mitarbeiter). Für Sicherung, Synchronisation und Aufräumen.
 */
export function dateienImStand(s: Pick<Stand, "belege" | "belegArchiv" | "kasse" | "mitarbeiter">): string[] {
  // R12 GoBD: auch Fotos der Eigenbelege (Bankeinzahlung, Entnahme, Einlage) – aus der geltenden Fassung und der Historie
  const bewegungen = s.kasse.flatMap((k) => [k, ...(k.historie ?? [])]).flatMap((k) => k.bewegungen.map((b) => b.datei));
  const zbons = s.kasse.flatMap((k) => (k.historie ?? []).map((h) => h.datei));
  return [...new Set([...s.belege, ...s.belegArchiv, ...s.kasse].map((b) => b.datei).concat(s.mitarbeiter.map((p) => p.aufenthalt_datei), bewegungen, zbons).filter((n): n is string => typeof n === "string" && n !== ""))];
}

/**
 * R12 (Kurier #13): Gibt es schon eine andere Person mit diesem Namen? (gleich ohne Groß-/Kleinschreibung und
 * Leerzeichen) – z. B. aus einer Vorlage gemerkt und danach von Hand noch einmal angelegt.
 */
export function doppeltePerson(s: Stand, art: PersonenArt, id: string): Person | null {
  const l = s[PERSONEN_LISTE[art]];
  const p = l.find((x) => x.id === id);
  if (!p || !p.name.trim()) return null;
  const norm = (n: string) => n.trim().replace(/\s+/g, " ").toLocaleLowerCase("de");
  return l.find((x) => x.id !== id && norm(x.name) === norm(p.name)) ?? null;
}

/** R12: zwei Einträge derselben Person zusammenführen – leere Angaben des bleibenden Eintrags aus dem anderen ergänzen. */
export function personenZusammenfuehren(s: Stand, art: PersonenArt, bleibt: string, weg: string, jetzt = new Date()): Stand {
  const k = PERSONEN_LISTE[art];
  const a = s[k].find((x) => x.id === bleibt);
  const b = s[k].find((x) => x.id === weg);
  if (!a || !b || a.id === b.id) return s;
  const neu: Person = { ...a };
  for (const [f, w] of Object.entries(b)) if (f !== "id" && f !== "geaendert" && typeof w === "string" && w.trim() && !(typeof neu[f] === "string" && (neu[f] as string).trim())) neu[f] = w;
  return personLoeschen(personSetzen(s, art, neu, jetzt), art, weg);
}

/** R12 (Zoll #5): so viele Tage vor dem Ablauf eines Aufenthaltstitels erinnert „Heute“. */
export const AUFENTHALT_VORLAUF_TAGE = 60;

/**
 * R12 (Zoll #5): Aufenthaltstitel beschäftigter Personen, die in den nächsten `vorlauf` Tagen ablaufen oder abgelaufen
 * sind – nach Datum. Beendete Beschäftigungen zählen nicht.
 */
export function aufenthaltLaeuftAb(s: Pick<Stand, "mitarbeiter">, tag = heute(), vorlauf = AUFENTHALT_VORLAUF_TAGE): { id: string; name: string; bis: string; tage: number }[] {
  const ms = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  return s.mitarbeiter
    .filter((p) => typeof p.aufenthalt_bis === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.aufenthalt_bis) && p.name.trim() && !(typeof p.ende === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.ende) && p.ende < tag))
    .map((p) => ({ id: p.id, name: p.name.trim(), bis: p.aufenthalt_bis as string, tage: Math.round((ms(p.aufenthalt_bis as string) - ms(tag)) / 864e5) }))
    .filter((x) => x.tage <= vorlauf)
    .sort((a, b) => a.bis.localeCompare(b.bis));
}

/** R12 (Bäckerei #7): Vorlagen, die sich einer Betriebsstätte zuordnen lassen (Hygiene, Lebensmittel, Arbeitszeit). */
export const STAETTEN_VORLAGEN = new Set(["haccp", "ifsg_belehrung", "hygieneschulung", "hygieneplan", "allergene", "reinigungsplan", "arbeitszeitnachweis"]);

/**
 * R12: Betriebsstätte einer Unterlage setzen – Zuordnung, kein Inhalt: geht auch bei festgeschriebenen Unterlagen
 * (ändert weder Daten noch PDF). „haupt“ bzw. leer = Betrieb.
 */
export function unterlageStaette(s: Stand, id: string, staette: string | null, jetzt = new Date()): Stand {
  return {
    ...s,
    unterlagen: s.unterlagen.map((u) => {
      if (u.id !== id) return u;
      const { betriebsstaette: _b, ...rest } = u;
      return { ...rest, ...(staette ? { betriebsstaette: staette } : {}), geaendert: u.festgeschrieben ? u.geaendert : jetzt.toISOString() };
    }),
  };
}
