/**
 * R12 GoBD: Offenes Archiv – alle aufbewahrungspflichtigen Daten unverschlüsselt in offenen, dokumentierten Formaten
 * (CSV mit Semikolon und UTF-8, JSON, PDF, XML und die Originaldateien), damit sie über die Aufbewahrungsfrist (bis zu
 * 10 Jahre, § 147 Abs. 3 AO) ohne Amtlos und ohne Passwort lesbar bleiben (§ 147 Abs. 2 AO, GoBD Rz. 142 ff.). Reine
 * Funktion; PDFs der Rechnungen erzeugt der Aufrufer auf dem Gerät.
 */
import { KU_HINWEIS, belegNummern, eRechnungAus, kassenSummen, pdfDateiname, vorlageFuer, xrechnungUbl } from "@amtlos/fachlogik";
import { pdfPruefwert, type PdfOriginal } from "./pdfOriginal";
import { APP_VERSION } from "../version";
import { utf8 } from "./sicherung";
import { absenderFuer, type Stand } from "./speicher";
import { GUTHABEN_SPALTEN, PROTOKOLL_SPALTEN, UNEINBRINGLICH_SPALTEN, aenderungsprotokoll, belegDateiname, belegeCsv, csv, gestellteRechnungen, guthabenZeilen, kassenCsv, paketZippen, rechnungDateiname, rechnungenCsv, uneinbringlichZeilen, type Zeitraum } from "./steuerpaket";
import { MARKE } from "@amtlos/marke";

const ALLES: Zeitraum = { von: "1900-01-01", bis: "9999-12-31", name: "alle" };
const betrag = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const sicher = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "ohne-name";

/**
 * E-221 Befund 9: alle festgeschriebenen Rechnungen (inkl. Stornos und Gutschriften) – auch die, die nirgends mitzählen
 * (Konfliktkopien K1, doppelte Stornos K2): Sie sind hinausgegangen bzw. festgeschrieben und aufzubewahren.
 */
export const archivRechnungen = (s: Stand) => s.unterlagen.filter((u) => u.vorlage === "rechnung" && u.festgeschrieben && typeof u.daten.datum === "string");

/**
 * E-221 Befund 9: eindeutige, von der Reihenfolge unabhängige Dateinamen. Kommt ein Name (ohne Groß-/Kleinschreibung –
 * entpackt auf Windows/macOS wäre es dieselbe Datei) mehrfach vor, bekommt jeder dieser Einträge seine Kennung angehängt;
 * einmalige Namen bleiben wie bisher.
 */
export function eindeutigeNamen(eintraege: readonly { schluessel: string; name: string; kennung: string }[]): Map<string, string> {
  const anzahl = new Map<string, number>();
  for (const e of eintraege) anzahl.set(e.name.toLowerCase(), (anzahl.get(e.name.toLowerCase()) ?? 0) + 1);
  const aus = new Map<string, string>();
  const vergeben = new Set<string>();
  const mitZusatz = (name: string, zusatz: string) => name.replace(/(\.[A-Za-z0-9]+)?$/, (endung) => `_${zusatz}${endung}`);
  // zuerst die eindeutigen, dann die mit Kennung – jeweils nach Schlüssel sortiert, damit das Ergebnis nicht von der Reihenfolge abhängt
  const sortiert = [...eintraege].sort((a, b) => a.schluessel.localeCompare(b.schluessel));
  for (const e of sortiert) if (anzahl.get(e.name.toLowerCase()) === 1) {
    aus.set(e.schluessel, e.name);
    vergeben.add(e.name.toLowerCase());
  }
  for (const e of sortiert) {
    if (aus.has(e.schluessel)) continue;
    const basis = mitZusatz(e.name, sicher(e.kennung));
    let name = basis;
    for (let i = 2; vergeben.has(name.toLowerCase()); i++) name = mitZusatz(basis, String(i));
    vergeben.add(name.toLowerCase());
    aus.set(e.schluessel, name);
  }
  return aus;
}

export interface ArchivErgebnis {
  zip: Uint8Array;
  dateiname: string;
  dateien: number;
}

/** Offenes Archiv als ZIP. `dateien`: Belegdateien, Z-Bons und Eigenbelege (Name → Bytes, entschlüsselt). */
export function offenesArchiv(s: Stand, dateien: Record<string, Uint8Array>, jetzt: string, o: { rechnungsPdfs?: Record<string, Uint8Array> } = {}): ArchivErgebnis {
  const inhalt: Record<string, Uint8Array> = {};
  const nummern = belegNummern([...s.belege, ...s.belegArchiv]);
  inhalt["daten/stand.json"] = utf8(JSON.stringify(s, null, 1));
  inhalt["Rechnungen.csv"] = utf8(rechnungenCsv(s, ALLES));
  inhalt["Belege.csv"] = utf8(belegeCsv(s, ALLES, new Map(), s.steuerberatung.kontenrahmen, nummern));
  inhalt["Belege_ungueltig.csv"] = utf8(csv([`${MARKE.name}-Belegnr.`, "Datum", "Lieferant", "Ungültig seit", "Grund"], s.belegArchiv.map((b) => [nummern.get(b.id) ?? "", b.datum, b.lieferant, b.ungueltig ?? "", b.ungueltig_grund ?? ""])));
  if (s.kasse.length) inhalt["Kassenabschluesse.csv"] = utf8(kassenCsv(s, ALLES));
  // E-229: Guthaben der Kunden (Überzahlungen, Rückzahlungen, Verrechnungen) und uneinbringliche Forderungen
  const guthaben = guthabenZeilen(s, ALLES);
  if (guthaben.length) inhalt["Guthaben.csv"] = utf8(csv(GUTHABEN_SPALTEN.map((x) => x.name), guthaben));
  const uneinbringlich = uneinbringlichZeilen(s, ALLES);
  if (uneinbringlich.length) inhalt["Uneinbringlich.csv"] = utf8(csv(UNEINBRINGLICH_SPALTEN.map((x) => x.name), uneinbringlich));
  if (s.kassenstuerze.length) inhalt["Kassenstuerze.csv"] = utf8(csv(["Zeitpunkt (UTC)", "Standort", "Gezählt", "Stückelung (Cent: Anzahl)", "Endbestand letzter Abschluss", "Anwesend", "Notiz"], s.kassenstuerze.map((k) => [k.zeitpunkt, k.standort ?? "", betrag(k.gezaehlt_cent), Object.entries(k.stueckelung ?? {}).map(([w, n]) => `${w}: ${n}`).join(", "), typeof k.vortag_cent === "number" ? betrag(k.vortag_cent) : "", k.anwesend ?? "", k.notiz ?? ""])));
  if (s.sachentnahmen.length) inhalt["Sachentnahmen.csv"] = utf8(csv(["Datum", "Netto 7 %", "Netto 19 %", "Bezeichnung"], s.sachentnahmen.map((e) => [e.datum, betrag(e.netto7_cent), betrag(e.netto19_cent), e.text ?? ""])));
  const prot = aenderungsprotokoll(s, ALLES);
  if (prot.length) inhalt["Aenderungsprotokoll.csv"] = utf8(csv(PROTOKOLL_SPALTEN.map((x) => x.name), prot));
  // Originaldateien: Belege, Z-Bons, Eigenbelege – E-221: Namen eindeutig (nichts überschreibt sich), jede Datei einmal
  let n = 0;
  const belegListe = [...s.belege, ...s.belegArchiv].filter((b) => b.datei && dateien[b.datei]);
  const belegNamen = eindeutigeNamen(belegListe.map((b) => ({ schluessel: b.id, name: belegDateiname(b, nummern.get(b.id)), kennung: b.id })));
  for (const b of belegListe) { inhalt[`Belege/${belegNamen.get(b.id)!}`] = dateien[b.datei!]!; n++; }
  // Kasse: Z-Bons und Eigenbelege der geltenden und der früheren Fassungen (E-221: wie die Prüfexporte)
  const kassenDateien: { schluessel: string; name: string; kennung: string; datei: string }[] = [];
  const gesehen = new Set<string>();
  for (const k of s.kasse) {
    for (const [i, f] of [k, ...(k.historie ?? [])].entries()) {
      const zusatz = i ? `_Fassung-${i}` : "";
      if (f.datei && dateien[f.datei] && !gesehen.has(f.datei)) {
        gesehen.add(f.datei);
        kassenDateien.push({ schluessel: f.datei, name: `${f.datum}_Z${sicher(f.zbon ?? k.id)}${zusatz}.${f.datei.split(".").pop()}`, kennung: k.id, datei: f.datei });
      }
      for (const b of f.bewegungen) if (b.datei && dateien[b.datei] && !gesehen.has(b.datei)) {
        gesehen.add(b.datei);
        kassenDateien.push({ schluessel: b.datei, name: `${f.datum}_${sicher(b.beleg_nr ?? b.art)}${zusatz}.${b.datei.split(".").pop()}`, kennung: k.id, datei: b.datei });
      }
    }
  }
  const kassenNamen = eindeutigeNamen(kassenDateien);
  for (const d of kassenDateien) { inhalt[`Kasse/${kassenNamen.get(d.schluessel)!}`] = dateien[d.datei]!; n++; }
  // Rechnungen: PDF (vom Aufrufer) und XRechnung – das festgehaltene Original immer, sonst aus den festgeschriebenen Daten
  // (wenn sie für eine E-Rechnung reichen). E-221: auch Konfliktkopien und doppelte Stornos; PDF und XML gleich benannt
  const rechnungen = archivRechnungen(s);
  const rechnungsNamen = eindeutigeNamen(rechnungen.map((u) => {
    const name = rechnungDateiname(String(u.daten.nummer ?? ""), String(u.daten.kunde_name ?? ""));
    return { schluessel: u.id, name: u.konfliktKopieVon ? name.replace(/\.pdf$/, "_Konfliktkopie.pdf") : name, kennung: u.id };
  }));
  // E-228: das aufbewahrte Original-PDF (byte-genau wie geteilt) geht vor dem neu erzeugten
  const original = (p: PdfOriginal | undefined) => (p && dateien[p.datei] && pdfPruefwert(dateien[p.datei]!) === p.sha256 ? dateien[p.datei]! : null);
  let originale = 0;
  for (const u of rechnungen) {
    const name = rechnungsNamen.get(u.id)!;
    const pdf = original(u.pdf) ?? o.rechnungsPdfs?.[u.id];
    if (original(u.pdf)) originale++;
    if (pdf) inhalt[`Rechnungen/${name}`] = pdf;
    const xml = u.xml ?? (() => {
      const { daten, fehlt } = eRechnungAus(u.daten, absenderFuer(s, u));
      return fehlt.length ? null : xrechnungUbl(daten, KU_HINWEIS);
    })();
    if (xml) inhalt[`E-Rechnungen/${name.replace(/\.pdf$/, ".xml")}`] = utf8(xml);
  }
  // festgeschriebene Kassenbücher: Inhalt als CSV (die PDFs entstehen daraus jederzeit neu)
  for (const u of s.unterlagen.filter((x) => x.vorlage === "kassenbuch" && x.festgeschrieben)) {
    const e = Array.isArray(u.daten.eintraege) ? (u.daten.eintraege as Record<string, string>[]) : [];
    inhalt[`Kassenbuecher/Kassenbuch_${sicher(String(u.daten.zeitraum ?? u.id))}.csv`] = utf8(csv(["Datum", "Beleg", "Vorgang", "Einnahme", "Ausgabe"], [["", "", `Anfangsbestand (festgeschrieben ${u.festgeschrieben}, SHA-256 ${u.inhaltSha256 ?? "–"})`, String(u.daten.anfang ?? ""), ""], ...e.map((x) => [x.datum ?? "", x.beleg ?? "", x.text ?? "", x.einnahme ?? "", x.ausgabe ?? ""])]));
  }
  // E-228: aufbewahrte Original-PDFs der übrigen festgeschriebenen Unterlagen (Nachweise, Kassenbücher, frühere Fassungen)
  // und unbestätigter Ausgaben (auf Android geteilt, Versand nicht bestätigt – das PDF hat das Gerät womöglich verlassen)
  const weitere: { schluessel: string; name: string; kennung: string; bytes: Uint8Array }[] = [];
  for (const u of s.unterlagen) {
    const v = vorlageFuer(u.vorlage);
    const basis = (daten: typeof u.daten, am: string) => (v ? pdfDateiname(v, daten, am.slice(0, 10)) : `${sicher(u.vorlage)}_${am.slice(0, 10)}.pdf`);
    const dazu = (p: PdfOriginal | undefined, name: string, ordner: string) => {
      const b = original(p);
      if (b) weitere.push({ schluessel: `${ordner}${p!.datei}`, name: `${ordner}${name}`, kennung: u.id, bytes: b });
    };
    if (u.vorlage !== "rechnung" && u.festgeschrieben) dazu(u.pdf, basis(u.daten, u.festgeschrieben), "Unterlagen/");
    for (const [i, f] of (u.fassungen ?? []).entries()) dazu(f.pdf, basis(f.daten, f.festgeschrieben).replace(/\.pdf$/, `_Fassung-${i + 1}.pdf`), "Unterlagen/");
    for (const g of u.geteiltOffen ?? []) dazu(g.pdf, basis(g.daten, g.am).replace(/\.pdf$/, `_geteilt-${g.am.slice(11, 16).replace(":", "")}.pdf`), "Ausgaben_unbestaetigt/");
  }
  const weitereNamen = eindeutigeNamen(weitere);
  for (const w of weitere) {
    inhalt[weitereNamen.get(w.schluessel)!] = w.bytes;
    originale++;
  }
  const kasseSumme = s.kasse.reduce((a, k) => a + kassenSummen(k).brutto, 0);
  inhalt["LIESMICH.txt"] = utf8(
    [
      `${MARKE.name} – offenes Archiv`,
      `Betrieb: ${s.betrieb.name || "ohne Namen"}`,
      `Erstellt: ${jetzt} mit ${MARKE.name} ${APP_VERSION}`,
      "",
      `Zweck: Alle Aufzeichnungen dieses Geräts in offenen Formaten, lesbar ohne ${MARKE.name} und ohne Passwort (§ 147 Abs. 2 AO). Aufbewahrung: Kassenaufzeichnungen, Bücher und Verfahrensdokumentation 10 Jahre (§ 147 Abs. 3 AO), Buchungsbelege 8 Jahre. Das Archiv ist NICHT verschlüsselt – sicher aufbewahren.`,
      "",
      "Formate",
      "- *.csv: Semikolon als Trenner, UTF-8 mit BOM, Zeilenende CRLF, Beträge mit Komma (1234,56), Datum TT.MM.JJJJ bzw. ISO; erste Zeile = Spaltenköpfe.",
      `- daten/stand.json: der vollständige Datenbestand der App (JSON, UTF-8) – Zeitpunkte als ISO 8601 in UTC, Beträge in Cent (ganze Zahlen). Wichtige Felder: unterlagen[] (vorlage, daten, festgeschrieben, absender, xml, fassungen), belege[] (nr = ${MARKE.name}-Belegnummer, datum, lieferant, steuer[].brutto_cent, festgeschrieben, historie[]), belegArchiv[] (ungültig markiert, mit Grund), kasse[] (Tagesabschlüsse: datum, umsatz[], karte_cent, trinkgeld_cent, gutscheine[], bewegungen[] mit beleg_nr, erstellt = erfasst am, festgeschrieben, historie[] = frühere Fassungen mit Grund), kassenstuerze[], sachentnahmen[], protokoll[] (Löschungen und Korrekturen; E-214: „korrektur_nicht_uebernommen“ mit fassung_bis, geraet, eingang), an Rechnungen zahlungen[] (Zahlungseingänge; guthaben = mit dem Guthaben einer Überzahlung verrechnet), guthaben[] (Überzahlungen und Rückzahlungen, auch in Guthaben.csv) und uneinbringlich (Tag und Grund, auch in Uneinbringlich.csv), geraet nur in Belegen und Historie (Gerät der Fassung), eingang (Eingang beim Synchronisationsserver: seit, version, zeit).`,
      `- Rechnungen/*.pdf, E-Rechnungen/*.xml (XRechnung 3.0, UBL – bei festgeschriebenen Rechnungen das bei der Festschreibung festgehaltene Original), Belege/ (Originaldateien, Dateiname beginnt mit der ${MARKE.name}-Belegnummer), Kasse/ (Z-Bons und Eigenbelege, frühere Fassungen mit „_Fassung-n“), Kassenbuecher/ (festgeschriebene Kassenbücher).`,
      `- Original-PDFs: Wo die App das zuerst geteilte bzw. gedruckte PDF selbst aufbewahrt hat, steht genau diese Datei im Archiv (Rechnungen/, Unterlagen/ für Nachweise, Kassenbücher und frühere Fassungen, Ausgaben_unbestaetigt/ für geteilte, aber nicht als verschickt bestätigte Fassungen) – ihr SHA-256 steht in daten/stand.json (unterlagen[].pdf.sha256, pdfSha256). Rechnungen ohne aufbewahrtes Original sind aus dem bei der Festschreibung festgehaltenen Dokument neu erzeugt. Dieses Archiv: ${originale} Original-PDF(s).`,
      `- Gleiche Dateinamen (z. B. dieselbe Rechnungsnummer von zwei Geräten) bekommen die interne Kennung angehängt („_<Kennung>“) – nichts wird überschrieben; dieselbe Kennung steht in daten/stand.json.`,
      `- „_Konfliktkopie“: eine abweichend festgeschriebene Fassung derselben Rechnung von einem anderen Gerät. Sie und doppelte Stornorechnungen zählen in Rechnungen.csv, Voranmeldung und EÜR nicht mit, sind aber aufbewahrt (PDF, XML und in daten/stand.json mit konfliktKopieVon).`,
      "",
      "Umfang",
      `- ${gestellteRechnungen(s).length} Rechnungen${rechnungen.length > gestellteRechnungen(s).length ? ` (dazu ${rechnungen.length - gestellteRechnungen(s).length} nicht zählende: Konfliktkopien bzw. doppelte Stornos)` : ""}, ${s.belege.length} Belege (${s.belegArchiv.length} ungültig markiert), ${s.kasse.length} Kassenabschlüsse (Umsatz ${betrag(kasseSumme)} € brutto), ${s.kassenstuerze.length} Kassenstürze, ${n} Dateien.`,
      "",
      "Nicht enthalten: die Daten der Kasse selbst (Einzelaufzeichnungen, DSFinV-K-Export, TSE-Export) – sie liegen im Kassensystem und sind dort aufzubewahren.",
    ].join("\r\n"),
  );
  const tag = jetzt.slice(0, 10);
  return { zip: paketZippen(inhalt), dateiname: `${MARKE.name}-Archiv-${sicher(s.betrieb.name || "Betrieb")}-${tag}.zip`, dateien: Object.keys(inhalt).length };
}
