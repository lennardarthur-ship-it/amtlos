/**
 * R12 GoBD: Offenes Archiv – alle aufbewahrungspflichtigen Daten unverschlüsselt in offenen, dokumentierten Formaten
 * (CSV mit Semikolon und UTF-8, JSON, PDF, XML und die Originaldateien), damit sie über die Aufbewahrungsfrist (bis zu
 * 10 Jahre, § 147 Abs. 3 AO) ohne Amtlos und ohne Passwort lesbar bleiben (§ 147 Abs. 2 AO, GoBD Rz. 142 ff.). Reine
 * Funktion; PDFs der Rechnungen erzeugt der Aufrufer auf dem Gerät.
 */
import { KU_HINWEIS, belegNummern, eRechnungAus, kassenSummen, xrechnungUbl } from "@amtlos/fachlogik";
import { APP_VERSION } from "../version";
import { utf8 } from "./sicherung";
import { absenderFuer, type Stand } from "./speicher";
import { aenderungsprotokoll, belegDateiname, belegeCsv, csv, gestellteRechnungen, kassenCsv, paketZippen, rechnungDateiname, rechnungenCsv, type Zeitraum } from "./steuerpaket";
import { MARKE } from "@amtlos/marke";

const ALLES: Zeitraum = { von: "1900-01-01", bis: "9999-12-31", name: "alle" };
const betrag = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const sicher = (s: string) => s.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60) || "ohne-name";

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
  if (s.kassenstuerze.length) inhalt["Kassenstuerze.csv"] = utf8(csv(["Zeitpunkt (UTC)", "Standort", "Gezählt", "Stückelung (Cent: Anzahl)", "Endbestand letzter Abschluss", "Anwesend", "Notiz"], s.kassenstuerze.map((k) => [k.zeitpunkt, k.standort ?? "", betrag(k.gezaehlt_cent), Object.entries(k.stueckelung ?? {}).map(([w, n]) => `${w}: ${n}`).join(", "), typeof k.vortag_cent === "number" ? betrag(k.vortag_cent) : "", k.anwesend ?? "", k.notiz ?? ""])));
  if (s.sachentnahmen.length) inhalt["Sachentnahmen.csv"] = utf8(csv(["Datum", "Netto 7 %", "Netto 19 %", "Bezeichnung"], s.sachentnahmen.map((e) => [e.datum, betrag(e.netto7_cent), betrag(e.netto19_cent), e.text ?? ""])));
  const prot = aenderungsprotokoll(s, ALLES);
  if (prot.length) inhalt["Aenderungsprotokoll.csv"] = utf8(csv(["Zeitpunkt", "Bereich", "Beleg/Tag", "Vorgang", "Grund bzw. Inhalt"], prot));
  // Originaldateien: Belege, Z-Bons, Eigenbelege
  let n = 0;
  for (const b of [...s.belege, ...s.belegArchiv]) if (b.datei && dateien[b.datei]) { inhalt[`Belege/${belegDateiname(b, nummern.get(b.id))}`] = dateien[b.datei]!; n++; }
  for (const k of s.kasse) {
    if (k.datei && dateien[k.datei]) { inhalt[`Kasse/${k.datum}_Z${sicher(k.zbon ?? k.id)}.${k.datei.split(".").pop()}`] = dateien[k.datei]!; n++; }
    for (const b of k.bewegungen) if (b.datei && dateien[b.datei]) { inhalt[`Kasse/${k.datum}_${sicher(b.beleg_nr ?? b.art)}.${b.datei.split(".").pop()}`] = dateien[b.datei]!; n++; }
  }
  // Rechnungen: PDF (vom Aufrufer) und XRechnung – das festgehaltene Original, sonst aus den festgeschriebenen Daten
  for (const u of gestellteRechnungen(s)) {
    const { daten, fehlt } = eRechnungAus(u.daten, absenderFuer(s, u));
    const name = rechnungDateiname(String(u.daten.nummer ?? ""), String(u.daten.kunde_name ?? ""));
    if (o.rechnungsPdfs?.[u.id]) inhalt[`Rechnungen/${name}`] = o.rechnungsPdfs[u.id]!;
    if (!fehlt.length) inhalt[`E-Rechnungen/${name.replace(/\.pdf$/, ".xml")}`] = utf8(u.xml ?? xrechnungUbl(daten, KU_HINWEIS));
  }
  // festgeschriebene Kassenbücher: Inhalt als CSV (die PDFs entstehen daraus jederzeit neu)
  for (const u of s.unterlagen.filter((x) => x.vorlage === "kassenbuch" && x.festgeschrieben)) {
    const e = Array.isArray(u.daten.eintraege) ? (u.daten.eintraege as Record<string, string>[]) : [];
    inhalt[`Kassenbuecher/Kassenbuch_${sicher(String(u.daten.zeitraum ?? u.id))}.csv`] = utf8(csv(["Datum", "Beleg", "Vorgang", "Einnahme", "Ausgabe"], [["", "", `Anfangsbestand (festgeschrieben ${u.festgeschrieben}, SHA-256 ${u.inhaltSha256 ?? "–"})`, String(u.daten.anfang ?? ""), ""], ...e.map((x) => [x.datum ?? "", x.beleg ?? "", x.text ?? "", x.einnahme ?? "", x.ausgabe ?? ""])]));
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
      `- daten/stand.json: der vollständige Datenbestand der App (JSON, UTF-8) – Zeitpunkte als ISO 8601 in UTC, Beträge in Cent (ganze Zahlen). Wichtige Felder: unterlagen[] (vorlage, daten, festgeschrieben, absender, xml, fassungen), belege[] (nr = ${MARKE.name}-Belegnummer, datum, lieferant, steuer[].brutto_cent, festgeschrieben, historie[]), belegArchiv[] (ungültig markiert, mit Grund), kasse[] (Tagesabschlüsse: datum, umsatz[], karte_cent, trinkgeld_cent, gutscheine[], bewegungen[] mit beleg_nr, erstellt = erfasst am, festgeschrieben, historie[] = frühere Fassungen mit Grund), kassenstuerze[], sachentnahmen[], protokoll[] (Löschungen und Korrekturen).`,
      `- Rechnungen/*.pdf, E-Rechnungen/*.xml (XRechnung 3.0, UBL – bei festgeschriebenen Rechnungen das bei der Festschreibung festgehaltene Original), Belege/ (Originaldateien, Dateiname beginnt mit der ${MARKE.name}-Belegnummer), Kasse/ (Z-Bons und Eigenbelege), Kassenbuecher/ (festgeschriebene Kassenbücher).`,
      "",
      "Umfang",
      `- ${gestellteRechnungen(s).length} Rechnungen, ${s.belege.length} Belege (${s.belegArchiv.length} ungültig markiert), ${s.kasse.length} Kassenabschlüsse (Umsatz ${betrag(kasseSumme)} € brutto), ${s.kassenstuerze.length} Kassenstürze, ${n} Dateien.`,
      "",
      "Nicht enthalten: die Daten der Kasse selbst (Einzelaufzeichnungen, DSFinV-K-Export, TSE-Export) – sie liegen im Kassensystem und sind dort aufzubewahren.",
    ].join("\r\n"),
  );
  const tag = jetzt.slice(0, 10);
  return { zip: paketZippen(inhalt), dateiname: `${MARKE.name}-Archiv-${sicher(s.betrieb.name || "Betrieb")}-${tag}.zip`, dateien: Object.keys(inhalt).length };
}
