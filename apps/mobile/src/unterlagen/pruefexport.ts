/**
 * E-200: Daten für die Betriebsprüfung (Datenzugriff, § 147 Abs. 6 AO) – kostenlos, auch ohne und nach Pro, über die ganze
 * Aufbewahrungsfrist. Laut Steuerberater (26.10.2026) genügen dafür weder die eigene Sicherungsdatei (nur mit der App
 * lesbar) noch die PDFs allein; nötig sind maschinell auswertbare Listen und die Originale. Das ZIP enthält genau:
 *
 * - die Listen als CSV: Rechnungen (und Gutschriften), Belege (und ungültig markierte Belege), Kassenabschlüsse,
 *   Kassenstürze (Zählprotokolle) und Sachentnahmen (E-202, Steuerberater 26.10.2026: Aufzeichnungen nach § 147 Abs. 1 AO),
 * - das Änderungsprotokoll,
 * - die E-Rechnungen als XML – ausgehend (das bei der Festschreibung festgehaltene Original, sonst aus den
 *   festgeschriebenen Daten) und eingehend (als Beleg erfasste XML-Dateien),
 * - die Originaldateien der Belege (auch ungültig markierter) und der Kasse (Z-Bons, Eigenbelege),
 * - eine Feldbeschreibung der CSV-Spalten, erzeugt aus denselben Spaltendefinitionen wie die Kopfzeilen.
 *
 * Nicht enthalten (bewusst): der DATEV-Buchungsstapel (Pro, Paket für die Steuerberatung), die Sicherungsdatei, PDFs.
 * Reine Funktion; die Dateien liest der Aufrufer (entschlüsselt) und übergibt sie.
 */
import { KU_HINWEIS, belegNummern, eRechnungAus, entnahmeSteuer, xrechnungUbl, type Beleg, type Kassensturz, type Sachentnahme } from "@amtlos/fachlogik";
import { MARKE } from "@amtlos/marke";
import { APP_VERSION } from "../version";
import { utf8 } from "./sicherung";
import { absenderFuer, type Stand } from "./speicher";
import {
  BELEG_SPALTEN,
  KASSEN_SPALTEN,
  KASSENSTURZ_SPALTEN,
  PROTOKOLL_SPALTEN,
  SACHENTNAHME_SPALTEN,
  UNGUELTIG_SPALTEN,
  aenderungsprotokoll,
  belegDateiname,
  belegeCsv,
  csv,
  gestellteRechnungen,
  istKleinunternehmer,
  kassenCsv,
  kopfAus,
  paketZippen,
  rechnungenCsv,
  rechnungsSpalten,
  type Spalte,
  type Zeitraum,
} from "./steuerpaket";
import { istGutschrift } from "./ustAusRechnungen";

const datumDe = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : iso);
const sicher = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "ohne-name";
const betragDe = (cent: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);
const ZEIT_BERLIN = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** E-200: Ordner und feste Dateinamen im Export (auch für Tests und den Rundgang). */
export const PRUEFEXPORT = {
  rechnungen: "Rechnungen.csv",
  gutschriften: "Gutschriften.csv",
  belege: "Belege.csv",
  ungueltig: "Belege_ungueltig.csv",
  kasse: "Kassenabschluesse.csv",
  kassenstuerze: "Kassenstuerze.csv",
  sachentnahmen: "Sachentnahmen.csv",
  protokoll: "Aenderungsprotokoll.csv",
  feldbeschreibung: "Feldbeschreibung.txt",
  xmlAus: "E-Rechnungen/ausgehend/",
  xmlEin: "E-Rechnungen/eingehend/",
  belegDateien: "Belege/",
  ungueltigDateien: "Belege/ungueltig/",
  kasseDateien: "Kasse/",
} as const;

export interface PruefexportErgebnis {
  zip: Uint8Array;
  dateiname: string;
  /** Pfade im ZIP (sortiert) */
  inhalt: string[];
  rechnungen: number;
  belege: number;
  kasse: number;
  /** E-202 */
  kassenstuerze: number;
  sachentnahmen: number;
  xmlAusgehend: number;
  xmlEingehend: number;
  /** Originaldateien (Belege, Kasse), die im Export liegen */
  originale: number;
  /** Originaldateien, die im Stand genannt sind, aber nicht gelesen werden konnten */
  fehlend: string[];
}

/** Namen aller Dateien, die der Export braucht: Belege (auch ungültig markierte) und Kasse (Z-Bons, Eigenbelege). */
export function pruefexportDateien(s: Pick<Stand, "belege" | "belegArchiv" | "kasse">): string[] {
  const kasse = s.kasse.flatMap((k) => [k.datei, ...k.bewegungen.map((b) => b.datei), ...(k.historie ?? []).map((h) => h.datei)]);
  return [...new Set([...s.belege, ...s.belegArchiv].map((b) => b.datei).concat(kasse).filter((n): n is string => typeof n === "string" && n !== ""))];
}

const anzahl = (n: number, eins: string, viele: string) => `${n} ${n === 1 ? eins : viele}`;
const istXml = (name: string | null | undefined) => /\.xml$/i.test(name ?? "");

/** Zeitraum über alle Daten: vom frühesten Datum bis heute (bzw. bis zum spätesten Datum, wenn es später liegt). */
function gesamtZeitraum(s: Stand, heute: string): Zeitraum {
  const tage = [
    ...gestellteRechnungen(s).map((u) => String(u.daten.datum ?? "")),
    ...[...s.belege, ...s.belegArchiv].map((b) => b.datum),
    ...s.kasse.map((k) => k.datum),
  ].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  const bis = tage.reduce((a, d) => (d > a ? d : a), heute);
  return { von: "1900-01-01", bis, name: "gesamt" };
}

/** E-202: Stückelung lesbar – „500 €: 2 · 0,50 €: 3“, große Werte zuerst (ohne Semikolon, damit das Feld ohne Anführungszeichen bleibt). */
const stueckelungText = (st: Record<string, number> | null | undefined) =>
  Object.entries(st ?? {})
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([w, n]) => `${Number(w) % 100 ? betragDe(Number(w)) : String(Number(w) / 100)} €: ${n}`)
    .join(" · ");

/** E-202: Liste der Kassenstürze (Spalten KASSENSTURZ_SPALTEN), nach Zeitpunkt. */
export function kassenstuerzeCsv(l: readonly Kassensturz[], staetten: readonly { id: string; name: string }[] = []): string {
  const name = (st: string | null | undefined) => (st ? (staetten.find((x) => x.id === st)?.name ?? st) : "");
  const sortiert = [...l].sort((a, b) => a.zeitpunkt.localeCompare(b.zeitpunkt));
  return csv(kopfAus(KASSENSTURZ_SPALTEN), sortiert.map((k, i) => [String(i + 1), ZEIT_BERLIN.format(new Date(k.zeitpunkt)), name(k.standort), betragDe(k.gezaehlt_cent), stueckelungText(k.stueckelung), typeof k.vortag_cent === "number" ? betragDe(k.vortag_cent) : "", k.anwesend ?? "", k.notiz ?? ""]));
}

/** E-202: Liste der Sachentnahmen (Spalten SACHENTNAHME_SPALTEN), nach Datum, mit Summenzeile. */
export function sachentnahmenCsv(l: readonly Sachentnahme[]): string {
  const sortiert = [...l].sort((a, b) => a.datum.localeCompare(b.datum));
  const zeile = (n7: number, n19: number) => [betragDe(n7), betragDe(entnahmeSteuer(n7, 7)), betragDe(n19), betragDe(entnahmeSteuer(n19, 19))];
  const summe = sortiert.reduce((a, e) => ({ n7: a.n7 + e.netto7_cent, u7: a.u7 + entnahmeSteuer(e.netto7_cent, 7), n19: a.n19 + e.netto19_cent, u19: a.u19 + entnahmeSteuer(e.netto19_cent, 19) }), { n7: 0, u7: 0, n19: 0, u19: 0 });
  return csv(kopfAus(SACHENTNAHME_SPALTEN), [
    ...sortiert.map((e) => [datumDe(e.datum), ...zeile(e.netto7_cent, e.netto19_cent), e.text ?? "", ZEIT_BERLIN.format(new Date(e.erstellt))]),
    [`Summe (${anzahl(sortiert.length, "Sachentnahme", "Sachentnahmen")})`, betragDe(summe.n7), betragDe(summe.u7), betragDe(summe.n19), betragDe(summe.u19), "", ""],
  ]);
}

/** Die Feldbeschreibung: Format, Inhalt des ZIP und je CSV-Datei jede Spalte mit Beschreibung. */
export function feldbeschreibung(s: Stand, o: { jetzt: string; dateien: { name: string; zweck: string; spalten?: readonly Spalte[]; zusatz?: string }[]; ordner: { name: string; zweck: string }[] }): string {
  const zeilen: string[] = [
    `${MARKE.name} – Daten für die Betriebsprüfung (Datenzugriff, § 147 Abs. 6 AO)`,
    `Betrieb: ${s.betrieb.name.trim() || "ohne Namen"}`,
    `Steuernummer: ${s.betrieb.steuernummer.trim() || "nicht angegeben"}${s.betrieb.ust_idnr.trim() ? ` · USt-IdNr.: ${s.betrieb.ust_idnr.trim()}` : ""}`,
    `Erstellt: ${ZEIT_BERLIN.format(new Date(o.jetzt))} (deutsche Zeit) mit ${MARKE.name} ${APP_VERSION}`,
    `Umfang: alle auf diesem Gerät erfassten Rechnungen, Belege, Kassenabschlüsse, Kassenstürze und Sachentnahmen – über alle Jahre.`,
    "",
    "Format der Tabellen (*.csv)",
    "- Zeichensatz UTF-8 mit BOM, Trennzeichen Semikolon, Zeilenende CRLF; Felder mit Semikolon, Anführungszeichen oder Zeilenumbruch in doppelten Anführungszeichen (Anführungszeichen darin verdoppelt).",
    "- Erste Zeile: Spaltenköpfe (Namen wie unten). Beträge in Euro mit Tausenderpunkt und Dezimalkomma (z. B. 1.234,56), negativ mit Minus. Datum TT.MM.JJJJ, Zeitpunkte TT.MM.JJJJ, HH:MM in deutscher Zeit.",
    "- Text, der mit =, +, @ oder - beginnt (außer Beträgen), steht mit einem vorangestellten Hochkomma, damit Tabellenprogramme ihn nicht als Formel lesen.",
    "- Am Ende der Rechnungs-, Beleg-, Kassen- und Sachentnahmeliste stehen Summenzeilen (erste Spalte „Summe …“); sie sind keine eigenen Datensätze.",
    "",
    "Inhalt",
    ...o.dateien.map((d) => `- ${d.name}: ${d.zweck}`),
    ...o.ordner.map((d) => `- ${d.name}: ${d.zweck}`),
  ];
  for (const d of o.dateien.filter((x) => x.spalten?.length)) {
    zeilen.push("", `${d.name}`, ...(d.zusatz ? [d.zusatz] : []), ...d.spalten!.map((sp, i) => `${String(i + 1).padStart(2, " ")}. ${sp.name}: ${sp.beschreibung}`));
  }
  return zeilen.join("\r\n") + "\r\n";
}

/**
 * Export „Daten für die Betriebsprüfung“ als ZIP. `dateien`: Belegdateien, Z-Bons und Eigenbelege (Name → Bytes,
 * entschlüsselt; `pruefexportDateien`). `jetzt` als ISO-Zeitpunkt.
 */
export function pruefexport(s: Stand, dateien: Record<string, Uint8Array>, jetzt: string): PruefexportErgebnis {
  const inhalt: Record<string, Uint8Array> = {};
  const z = gesamtZeitraum(s, jetzt.slice(0, 10));
  const nummern = belegNummern([...s.belege, ...s.belegArchiv]);
  const fehlend: string[] = [];
  const vergeben = new Set<string>();
  const ablegen = (pfad: string, bytes: Uint8Array): string => {
    let name = pfad;
    for (let i = 2; vergeben.has(name); i++) name = pfad.replace(/(\.\w+)?$/, (e) => `_${i}${e}`);
    vergeben.add(name);
    inhalt[name] = bytes;
    return name;
  };

  // Originaldateien der Belege: E-Rechnungen (XML) nach E-Rechnungen/eingehend/, alles andere nach Belege/
  const belegPfade = new Map<string, string>();
  let originale = 0;
  let xmlEingehend = 0;
  const belegDatei = (b: Beleg, ordner: string) => {
    if (!b.datei) return;
    const bytes = dateien[b.datei];
    if (!bytes) return void fehlend.push(b.datei);
    const xml = istXml(b.datei);
    const pfad = ablegen(`${xml ? PRUEFEXPORT.xmlEin : ordner}${belegDateiname(b, nummern.get(b.id))}`, bytes);
    belegPfade.set(b.id, pfad);
    if (xml) xmlEingehend++;
    else originale++;
  };
  for (const b of s.belege) belegDatei(b, PRUEFEXPORT.belegDateien);
  for (const b of s.belegArchiv) belegDatei(b, PRUEFEXPORT.ungueltigDateien);
  // Kasse: Z-Bons (auch früherer Fassungen) und Eigenbelege – jede Datei einmal
  const gesehen = new Set<string>();
  for (const k of s.kasse) {
    const fassungen = [k, ...(k.historie ?? [])];
    for (const [i, f] of fassungen.entries()) {
      if (f.datei && !gesehen.has(f.datei)) {
        gesehen.add(f.datei);
        const bytes = dateien[f.datei];
        if (bytes) {
          ablegen(`${PRUEFEXPORT.kasseDateien}${k.datum}_Z${sicher(k.zbon ?? k.id)}${i ? `_Fassung${i}` : ""}.${f.datei.split(".").pop() || "bin"}`, bytes);
          originale++;
        } else fehlend.push(f.datei);
      }
      for (const bw of f.bewegungen) {
        if (!bw.datei || gesehen.has(bw.datei)) continue;
        gesehen.add(bw.datei);
        const bytes = dateien[bw.datei];
        if (bytes) {
          ablegen(`${PRUEFEXPORT.kasseDateien}${k.datum}_${sicher(bw.beleg_nr ?? bw.art)}.${bw.datei.split(".").pop() || "bin"}`, bytes);
          originale++;
        } else fehlend.push(bw.datei);
      }
    }
  }

  // ausgehende E-Rechnungen: das festgehaltene Original, sonst aus den festgeschriebenen Daten (wie im Paket)
  const ohneXml: string[] = [];
  let xmlAusgehend = 0;
  const rechnungen = gestellteRechnungen(s);
  for (const u of rechnungen) {
    const { daten, fehlt } = eRechnungAus(u.daten, absenderFuer(s, u));
    if (fehlt.length && !u.xml) {
      ohneXml.push(`${daten.nummer || "ohne Nummer"}: ${fehlt.slice(0, 3).join(", ")}`);
      continue;
    }
    ablegen(`${PRUEFEXPORT.xmlAus}${sicher(daten.nummer || u.id)}.xml`, utf8(u.xml ?? xrechnungUbl(daten, KU_HINWEIS)));
    xmlAusgehend++;
  }

  // Listen
  const gutschriften = rechnungen.filter(istGutschrift);
  inhalt[PRUEFEXPORT.rechnungen] = utf8(rechnungenCsv(s, z));
  if (gutschriften.length) inhalt[PRUEFEXPORT.gutschriften] = utf8(rechnungenCsv(s, z, true));
  // die Belegliste nennt den Pfad der Originaldatei im Export
  inhalt[PRUEFEXPORT.belege] = utf8(belegeCsv(s, z, belegPfade, s.steuerberatung.kontenrahmen, nummern, istKleinunternehmer(s)));
  const betrag = (b: Beleg) => b.steuer.reduce((a, x) => a + x.brutto_cent, 0);
  if (s.belegArchiv.length)
    inhalt[PRUEFEXPORT.ungueltig] = utf8(csv(kopfAus(UNGUELTIG_SPALTEN), s.belegArchiv.map((b) => [nummern.get(b.id) ?? "", datumDe(b.datum), b.lieferant, betragDe(betrag(b)), b.ungueltig ? ZEIT_BERLIN.format(new Date(b.ungueltig)) : "", b.ungueltig_grund ?? "", b.datei ? (belegPfade.get(b.id) ?? "nein (Datei nicht lesbar)") : "nein"])));
  if (s.kasse.length) inhalt[PRUEFEXPORT.kasse] = utf8(kassenCsv(s, z));
  // E-202: Kassenstürze (Zählprotokolle) und Sachentnahmen als eigene Listen
  if (s.kassenstuerze.length) inhalt[PRUEFEXPORT.kassenstuerze] = utf8(kassenstuerzeCsv(s.kassenstuerze, s.betriebsstaetten));
  if (s.sachentnahmen.length) inhalt[PRUEFEXPORT.sachentnahmen] = utf8(sachentnahmenCsv(s.sachentnahmen));
  // das Änderungsprotokoll immer – auch leer (nur Kopfzeile), damit erkennbar ist, dass es nichts zu protokollieren gab
  inhalt[PRUEFEXPORT.protokoll] = utf8(csv(kopfAus(PROTOKOLL_SPALTEN), aenderungsprotokoll(s, z)));

  const dateienListe: { name: string; zweck: string; spalten?: readonly Spalte[] }[] = [
    { name: PRUEFEXPORT.rechnungen, zweck: `${anzahl(rechnungen.length - gutschriften.length, "gestellte Rechnung", "gestellte Rechnungen")} einschließlich Stornorechnungen, nach Datum; Summen je Steuersatz am Ende.`, spalten: rechnungsSpalten({ gutschriften: false, bis: z.bis, datei: false }) },
    ...(gutschriften.length ? [{ name: PRUEFEXPORT.gutschriften, zweck: `${anzahl(gutschriften.length, "Gutschrift", "Gutschriften")}, die der Betrieb als Leistungsempfänger ausgestellt hat; nicht in der Rechnungsliste.`, spalten: rechnungsSpalten({ gutschriften: true, bis: z.bis, datei: false }) }] : []),
    { name: PRUEFEXPORT.belege, zweck: `${anzahl(s.belege.length, "Beleg", "Belege")} mit Belegnummer der App, Beträgen, Konto und Zahltag; Summe am Ende.`, spalten: BELEG_SPALTEN },
    ...(s.belegArchiv.length ? [{ name: PRUEFEXPORT.ungueltig, zweck: `${anzahl(s.belegArchiv.length, "als ungültig markierter Beleg", "als ungültig markierte Belege")} mit Grund (erklären Lücken in den Belegnummern).`, spalten: UNGUELTIG_SPALTEN }] : []),
    ...(s.kasse.length ? [{ name: PRUEFEXPORT.kasse, zweck: `${anzahl(s.kasse.length, "Tagesabschluss", "Tagesabschlüsse")} (Z-Bons) mit Umsatz je Steuersatz, Zahlungsarten, Bewegungen, Bargeldbestand und Korrekturen; Summe am Ende.`, spalten: KASSEN_SPALTEN }] : []),
    ...(s.kassenstuerze.length ? [{ name: PRUEFEXPORT.kassenstuerze, zweck: `${anzahl(s.kassenstuerze.length, "Kassensturz", "Kassenstürze")} (Zählprotokolle des Bargeldbestands) mit gezähltem Bestand, Stückelung und Anwesenden, nach Zeitpunkt.`, spalten: KASSENSTURZ_SPALTEN }] : []),
    ...(s.sachentnahmen.length ? [{ name: PRUEFEXPORT.sachentnahmen, zweck: `${anzahl(s.sachentnahmen.length, "Sachentnahme", "Sachentnahmen")} (unentgeltliche Wertabgaben, z. B. nach den Pauschbeträgen) mit Bemessungsgrundlage und Umsatzsteuer je Steuersatz, nach Datum; Summe am Ende.`, spalten: SACHENTNAHME_SPALTEN }] : []),
    { name: PRUEFEXPORT.protokoll, zweck: "Änderungen nach der Festschreibung, Korrekturen, Löschungen, ungültig markierte Belege, Nacherfassungen und nach dem Teilen gelöschte Rechnungsentwürfe (deren Nummer vergeben bleibt), nach Zeitpunkt.", spalten: PROTOKOLL_SPALTEN },
    { name: PRUEFEXPORT.feldbeschreibung, zweck: "diese Beschreibung." },
  ];
  const ordner = [
    { name: PRUEFEXPORT.xmlAus, zweck: `${anzahl(xmlAusgehend, "E-Rechnung", "E-Rechnungen")} (XRechnung, UBL) der gestellten Rechnungen; bei festgeschriebenen Rechnungen die bei der Festschreibung festgehaltene Datei. Dateiname = Rechnungsnummer.${ohneXml.length ? ` Ohne E-Rechnung (Angaben fehlen bzw. Privatkunde): ${ohneXml.slice(0, 20).join("; ")}${ohneXml.length > 20 ? " …" : ""}.` : ""}` },
    { name: PRUEFEXPORT.xmlEin, zweck: `${anzahl(xmlEingehend, "empfangene E-Rechnung", "empfangene E-Rechnungen")} (XML) – die Originaldateien dieser Belege, unverändert. Dateiname beginnt mit der Belegnummer der App (Spalte „Datei“ in ${PRUEFEXPORT.belege}).` },
    { name: PRUEFEXPORT.belegDateien, zweck: `Originaldateien der Belege (Fotos, PDFs), unverändert; Dateiname beginnt mit der Belegnummer der App. Ungültig markierte Belege im Unterordner ungueltig/. Zusammen mit der Kasse ${anzahl(originale, "Originaldatei", "Originaldateien")}.` },
    { name: PRUEFEXPORT.kasseDateien, zweck: "Fotos der Z-Bons (Name: Geschäftstag_Z-Bon-Nummer) und der Eigenbelege zu Entnahmen, Einlagen und Bankeinzahlungen (Name: Geschäftstag_Eigenbelegnummer)." },
  ];
  if (fehlend.length) dateienListe.push({ name: "Hinweis", zweck: `${fehlend.length} ${fehlend.length === 1 ? "Originaldatei ließ" : "Originaldateien ließen"} sich auf dem Gerät nicht lesen und ${fehlend.length === 1 ? "fehlt" : "fehlen"} im Export.` });
  inhalt[PRUEFEXPORT.feldbeschreibung] = utf8(feldbeschreibung(s, { jetzt, dateien: dateienListe, ordner }));

  const tag = jetzt.slice(0, 10);
  return {
    zip: paketZippen(inhalt),
    dateiname: `${MARKE.name}-Betriebspruefung-${sicher(s.betrieb.name || "Betrieb")}-${tag}.zip`,
    inhalt: Object.keys(inhalt).sort(),
    rechnungen: rechnungen.length,
    belege: s.belege.length + s.belegArchiv.length,
    kasse: s.kasse.length,
    kassenstuerze: s.kassenstuerze.length,
    sachentnahmen: s.sachentnahmen.length,
    xmlAusgehend,
    xmlEingehend,
    originale,
    fehlend,
  };
}
