/**
 * Arbeitsschutz: Gefährdungsbeurteilung, Unterweisung, Gefahrstoffverzeichnis, Betriebsanweisung, Prüfprotokoll
 * elektrische Geräte (E-121, E-123). Vorschläge und Bausteine aus der Recherche (bausteine.ts, Quellen dort).
 */
import { BA_BAUSTEINE, ELEKTRO_FRISTEN, GEFAEHRDUNGEN, GEFAHRSTOFF_ANGABEN, MUTTERSCHUTZ, UNTERWEISUNGSTHEMEN } from "./bausteine.js";
import { KOPF_LINIE, LINIE, ZELLE_LINIE, nachsatz, abschnitt, absatz, angaben, ankreuzen, auswahl, datumDe, dokument, esc, ja, linien, liste, plusMonate, punkte, roh, tabelle, text, unterschriften, zelle, zellePunkte, zeilen, zusammen } from "./html.js";
import { GEFAEHRDUNGSFAKTOREN, HANDLUNGSBEDARF, RISIKO_MATRIX, RISIKO_STUFEN, SCHWERE, SCHWERE_KURZ, SONSTIGE_UNTERPUNKTE, WAHRSCHEINLICHKEIT, optionen, risikoAus } from "./konstanten.js";
import type { Betrieb, Daten, Eintrag, Option, Vorlage, Vorschlag } from "./typen.js";
import { MARKE } from "@amtlos/marke";

/** Teilnahmeliste mit Unterschriftsspalte; leere Zeilen zum Nachtragen von Hand. */
type TeilnahmeSpalte = { kopf: string; feld: string; datum?: boolean };
/** Teilnahmeliste mit Unterschrift; `extra`: eine oder zwei weitere Spalten zwischen Name und Unterschrift. */
export function teilnahmeTabelle(eintraege: Eintrag[], extra?: TeilnahmeSpalte | TeilnahmeSpalte[]): string {
  const sp = extra ? (Array.isArray(extra) ? extra : [extra]) : [];
  const kopf = ["Name", ...sp.map((x) => x.kopf), "Unterschrift"];
  const zeilen = eintraege.filter((e) => text(e, "name")).map((e) => [zelle(text(e, "name")), ...sp.map((x) => zelle(x.datum ? datumDe(text(e, x.feld)) : text(e, x.feld))), ""]);
  const breiten = sp.length >= 2 ? ["30%", ...sp.map(() => `${(36 / sp.length).toFixed(0)}%`), "34%"] : sp.length ? ["38%", "22%", "40%"] : ["45%", "55%"];
  // mit Namen: zwei Leerzeilen zum Nachtragen, die mit dem letzten Namen zusammenbleiben (keine Seite nur mit Kopf und
  // Leerzeilen); ohne Namen (Liste zum Ausdrucken): sechs Zeilen
  return tabelle(kopf, zeilen, { breiten, ...(zeilen.length ? { leerzeilen: 2, schluss: 3 } : { mindestens: 6 }), hoch: true, klasse: "teilnahme" });
}

export const BEREICHE_VORSCHLAG = ["Salon", "Kosmetikkabine", "Küche", "Gastraum und Service", "Verkaufsraum", "Lager", "Werkstatt", "Baustelle beim Kunden", "Reinigungsobjekte beim Kunden", "Behandlungsräume der Praxis", "Büro"];
// Vorprüfung 21.10.2026 (§ 6 Abs. 1 ArbSchG): eigene Spalte „bis wann“ – ohne Termin ist „offen“ nicht nachprüfbar;
// E-167 (Sifa, Blatt „B Vorlagen“): Wirksamkeit je Maßnahme in der letzten Spalte
const GEFAEHRDUNG_KOPF = ["Gefährdung", "Risiko", "Schutzmaßnahmen", "Wer / bis wann", "Erledigt / wirksam"];
const GEFAEHRDUNG_BREITEN = ["24%", "11%", "37%", "15%", "13%"];
/**
 * Risikoskala (E-167, Sifa-Durchsicht Blatt „D Risikoskala“): Schwere × Wahrscheinlichkeit statt einer Stufe „gering =
 * unwahrscheinlich ODER leicht“ – seltene, aber schwere Ereignisse (Stromschlag, Fettbrand, Absturz) landeten sonst bei
 * „gering“. Hilfetext und Legende im Dokument.
 */
export const RISIKO_SKALA = "Risiko aus Schwere und Wahrscheinlichkeit: hoch, wenn ein schwerer Schaden möglich oder wahrscheinlich ist oder ein mittlerer wahrscheinlich; gering, wenn ein leichter Schaden unwahrscheinlich oder möglich ist oder ein mittlerer unwahrscheinlich; sonst mittel (auch: schwer, aber unwahrscheinlich). Handlungsbedarf: hoch – sofort handeln, notfalls die Tätigkeit einstellen; mittel – zeitnah handeln, mit Termin; gering – bei Gelegenheit handeln, beobachten.";
/** § 5 Abs. 3 Nr. 1–6 ArbSchG – auch auf dem leeren Blatt je eine Überschrift (Vorprüfung 21.10.2026). */
const FAKTOR_NR: Record<string, string> = { arbeitsstaette: "1", einwirkungen: "2", arbeitsmittel: "3", ablaeufe_arbeitszeit: "4", qualifikation: "5", psychisch: "6" };
const MUSCH_FORTSCHREIBUNG = "Teilt eine Frau mit, dass sie schwanger ist oder stillt, legt der Arbeitgeber unverzüglich die nach dieser Beurteilung erforderlichen Schutzmaßnahmen fest und bietet ihr ein Gespräch über weitere Anpassungen ihrer Arbeitsbedingungen an (§ 10 Abs. 2 MuSchG); die Benachrichtigung der Aufsichtsbehörde regelt § 27 Abs. 1 MuSchG.";
const JUGEND_SATZ = "Beurteilung der Arbeitsbedingungen vor Beginn der Beschäftigung Jugendlicher und bei wesentlicher Änderung (§ 28a JArbSchG) – unter Beachtung der Beschäftigungsverbote und -beschränkungen der §§ 22 bis 27 JArbSchG.";
/** Vorschlag mit Risiko „hoch“ (Blatt „D“): nur die Schwere wird vorgeschlagen, die Wahrscheinlichkeit wählt der Betrieb. */
const SCHWERE_AUS_RISIKO: Record<string, string> = { hoch: "schwer", mittel: "mittel", gering: "leicht" };
// E-202 (Fachkraft für Arbeitssicherheit, 26.10.2026): 40 der 41 so markierten Bausteine bestätigt – Vermerk dort gestrichen;
// nur B-105 (Nadelstichverletzungen, arbeitsmedizinisch) behält ihn, bis ein Betriebsarzt bestätigt
const PRUEFEN = "fachlich zu prüfen";
/**
 * Ergänzende Vorschläge (R10) zu den Bausteinen der Recherche: Arbeiten an elektrischen Anlagen (Elektrohandwerk) und
 * Jugendliche (§ 28a JArbSchG). E-167: Fundstellen und Wortlaut nach der Sifa-Durchsicht (B-072, B-073).
 */
const GEFAEHRDUNGEN_EXTRA: Vorschlag[] = [
  {
    gruppe: "Handwerk",
    titel: "Elektrischer Schlag und Störlichtbogen bei Arbeiten an oder in der Nähe elektrischer Anlagen.",
    werte: {
      faktor: "arbeitsmittel",
      schwere: "schwer",
      beschreibung: "Elektrischer Schlag und Störlichtbogen bei Arbeiten an oder in der Nähe elektrischer Anlagen.",
      massnahme: "Arbeiten nur im spannungsfreien Zustand nach den fünf Sicherheitsregeln (freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit feststellen, erden und kurzschließen, benachbarte unter Spannung stehende Teile abdecken oder abschranken).\nArbeiten nur durch Elektrofachkräfte bzw. elektrotechnisch unterwiesene Personen unter deren Leitung und Aufsicht.\nGeeignete isolierte Werkzeuge, Spannungsprüfer und persönliche Schutzausrüstung (z. B. Gesichtsschutz gegen Störlichtbogen) bereitstellen und prüfen.",
    },
    quelle: "DIN VDE 0105-100; § 6 DGUV Vorschrift 3",
  },
  {
    titel: "Jugendliche Beschäftigte: Gefährdungen durch fehlende Erfahrung, Arbeitszeit und verbotene Arbeiten.",
    werte: {
      faktor: "qualifikation",
      beschreibung: "Jugendliche Beschäftigte (unter 18 Jahren): Gefährdungen durch fehlende Erfahrung, Arbeitszeit und Tätigkeiten, die für Jugendliche verboten oder beschränkt sind.",
      massnahme: "Vor Beginn der Beschäftigung und bei wesentlicher Änderung der Arbeitsbedingungen die Gefährdungen für Jugendliche beurteilen (§ 28a JArbSchG).\nGefährliche Arbeiten nach § 22 Abs. 1 JArbSchG nur, soweit dies zur Erreichung des Ausbildungsziels erforderlich ist und die Aufsicht durch einen Fachkundigen gewährleistet ist (§ 22 Abs. 2 JArbSchG).\nWerden Jugendliche in einem Betrieb beschäftigt, für den eine Fachkraft für Arbeitssicherheit und ein Betriebsarzt zu bestellen sind, muss deren sicherheitstechnische und betriebsärztliche Betreuung sichergestellt sein (§ 22 Abs. 3 JArbSchG).\nVor Beginn und danach mindestens halbjährlich unterweisen (§ 29 JArbSchG); Arbeitszeit- und Pausenregeln (§§ 8–14 JArbSchG) einhalten.",
    },
    quelle: "§§ 22, 28a, 29 JArbSchG",
  },
];

/**
 * R11: Gruppen „Gebäudereinigung“ und „Holz / Tischlerei“ – die Gefährdungen nennen die Nutzertests (Reinigung #11,
 * Tischlerei #5, #8). E-167: Fachquellen aus der Sifa-Durchsicht statt „Nutzertest“ (B-074 bis B-083); „fachlich zu prüfen“
 * bleibt nur bei Prüfstand „offen“ (B-082).
 */
const GEFAEHRDUNGEN_R11: Vorschlag[] = [
  {
    gruppe: "Gebäudereinigung",
    titel: "Alleinarbeit: Reinigung allein im Objekt, oft außerhalb der üblichen Arbeitszeit.",
    werte: { faktor: "ablaeufe_arbeitszeit", beschreibung: "Alleinarbeit: Reinigung allein im Objekt, oft außerhalb der üblichen Arbeitszeit.", massnahme: "Erreichbarkeit regeln (z. B. Mobiltelefon, vereinbarte Meldezeiten).\nErste Hilfe und Notruf für allein arbeitende Beschäftigte organisieren." },
    quelle: "DGUV Regel 112-139; BG BAU",
  },
  {
    gruppe: "Gebäudereinigung",
    titel: "Arbeit im fremden Betrieb: Gefahren im Objekt des Auftraggebers.",
    werte: { faktor: "ablaeufe_arbeitszeit", beschreibung: "Arbeit im fremden Betrieb: Gefahren im Objekt des Auftraggebers (z. B. Maschinen, Gefahrstoffe, Zutrittsbereiche).", massnahme: "Mit dem Auftraggeber die Gefahren im Objekt und die Schutzmaßnahmen abstimmen (§ 8 ArbSchG).\nBeschäftigte über die Gefahren im jeweiligen Objekt unterweisen." },
    quelle: "§ 8 ArbSchG; § 6 DGUV Vorschrift 1",
  },
  {
    gruppe: "Gebäudereinigung",
    titel: "Mischen von Reinigungsmitteln: gefährliche Reaktionen, Haut- und Atemwegsreizungen.",
    werte: { faktor: "einwirkungen", beschreibung: "Mischen von Reinigungsmitteln: gefährliche Reaktionen, Haut- und Atemwegsreizungen.", massnahme: "Reinigungsmittel nicht mischen; nur in Originalbehältern oder gekennzeichneten Gefäßen aufbewahren.\nDosierhilfen verwenden; Betriebsanweisung und Unterweisung zu den eingesetzten Reinigungsmitteln." },
    quelle: "DGUV Regel 101-019; TRGS 510",
  },
  {
    gruppe: "Gebäudereinigung",
    titel: "Stich- und Infektionsgefahr durch Abfall in Arztpraxen.",
    werte: { faktor: "einwirkungen", beschreibung: "Stich- und Infektionsgefahr durch Abfall in Arztpraxen (z. B. Kanülen im Müll).", massnahme: "Abfälle nicht mit der Hand nachdrücken oder umfüllen; mit der Praxis stichfeste Abfallbehälter vereinbaren.\nGeeignete Schutzhandschuhe bereitstellen; Vorgehen nach einer Stich- oder Schnittverletzung festlegen." },
    quelle: "TRBA 250; § 11 BioStoffV",
  },
  {
    gruppe: "Gebäudereinigung",
    titel: "Wege und Fahrten zwischen den Objekten.",
    werte: { faktor: "ablaeufe_arbeitszeit", beschreibung: "Wege und Fahrten zwischen den Objekten: Unfälle im Straßenverkehr, Zeitdruck.", massnahme: "Touren mit ausreichend Zeit planen.\nFirmenfahrzeuge regelmäßig prüfen lassen; Geräte und Mittel im Fahrzeug sichern." },
    quelle: "§ 57 DGUV Vorschrift 70; § 22 StVO",
  },
  {
    gruppe: "Holz / Tischlerei",
    titel: "Hartholzstaub (krebserzeugend) beim Sägen, Fräsen und Schleifen.",
    // E-167 (B-079, Blatt „A Kennzahlen“): AGW Holzstaub, Expositionsverzeichnis, Vorsorge nach ArbMedVV
    werte: { faktor: "einwirkungen", schwere: "schwer", beschreibung: "Hartholzstaub (krebserzeugend) beim Sägen, Fräsen und Schleifen.", massnahme: "Staub an der Entstehungsstelle absaugen; Maschinen an eine geeignete Absaugung anschließen.\nArbeitsplatzgrenzwert für Holzstaub von 2 mg/m³ einhalten (TRGS 553).\nNicht trocken kehren oder mit Druckluft abblasen, sondern absaugen.\nHartholzstaub ist krebserzeugend: Expositionsverzeichnis der betroffenen Beschäftigten führen (§ 10a GefStoffV).\nArbeitsmedizinische Vorsorge nach ArbMedVV Anhang Teil 1: Pflichtvorsorge nach Abs. 1 Nr. 1, Angebotsvorsorge, wenn eine Exposition nicht ausgeschlossen werden kann (Abs. 2 Nr. 1)." },
    quelle: "TRGS 553; ArbMedVV Anhang Teil 1 Abs. 1 Nr. 1; DGUV Regel 109-606",
  },
  {
    gruppe: "Holz / Tischlerei",
    titel: "Brand- und Explosionsgefahr durch Holzstaub und Absaugung.",
    // E-167 (B-080): unter „Sonstige Gefährdungen – Brand und Explosion“ statt „Einwirkungen“
    werte: { faktor: "sonstiges", unterpunkt: "brand", schwere: "schwer", beschreibung: "Brand- und Explosionsgefahr durch Holzstaub, Späne und die Absauganlage.", massnahme: "Absaugung und Späneabfuhr regelmäßig warten und reinigen; Staubablagerungen vermeiden.\nZündquellen fernhalten; geeignete Feuerlöscher bereithalten." },
    quelle: "TRGS 553; DGUV Regel 109-606",
  },
  {
    gruppe: "Holz / Tischlerei",
    titel: "Holzbearbeitungsmaschinen: Rückschlag und Schnittverletzungen.",
    werte: { faktor: "arbeitsmittel", schwere: "schwer", beschreibung: "Holzbearbeitungsmaschinen (z. B. Kreissäge, Fräse, Hobel): Rückschlag des Werkstücks und Schnittverletzungen.", massnahme: "Schutzeinrichtungen verwenden und nicht entfernen; Schiebestock bzw. Zuführhilfen benutzen.\nMaschinen nur durch unterwiesene Beschäftigte bedienen lassen.\nMaschinen und Schutzeinrichtungen regelmäßig prüfen (§ 14 BetrSichV)." },
    quelle: "§§ 12, 14 BetrSichV; DGUV Regel 109-606",
  },
  {
    gruppe: "Holz / Tischlerei",
    titel: "Spritzlackieren: Lösemitteldämpfe, Farbnebel und Brandgefahr.",
    werte: { faktor: "einwirkungen", beschreibung: "Spritzlackieren: Lösemitteldämpfe, Farbnebel und Brandgefahr.", massnahme: "Nur mit wirksamer Absaugung bzw. Lüftung lackieren.\nGefahrstoffverzeichnis und Betriebsanweisung für Lacke und Verdünner; geeigneten Atemschutz bereitstellen.\nZündquellen fernhalten." },
    quelle: `DGUV Regel 109-606; TRGS 500; TRGS 510`,
  },
  {
    gruppe: "Holz / Tischlerei",
    titel: "Lärm an Holzbearbeitungsmaschinen.",
    werte: { faktor: "einwirkungen", beschreibung: "Lärm an Holzbearbeitungsmaschinen.", massnahme: "Lärmarme Maschinen und Werkzeuge auswählen; Lärmbereiche kennzeichnen.\nGehörschutz bereitstellen und tragen lassen (LärmVibrationsArbSchV).\nArbeitsmedizinische Vorsorge anbieten ab 80 dB(A), Pflichtvorsorge ab 85 dB(A) (ArbMedVV Anhang Teil 3)." },
    quelle: "LärmVibrationsArbSchV; ArbMedVV Anhang Teil 3",
  },
];

/**
 * R12: Gruppen „Kfz-Werkstatt“ (Kfz #3), „Bäckerei“ (Bäckerei #6) und „Transport / Kurier“ (Kurier #9) – aus den
 * Nutzertests. E-167: Fachquellen der Sifa-Durchsicht (B-084 bis B-103); „fachlich zu prüfen“ nur noch bei Prüfstand „offen“.
 * `risiko` „hoch“ schlägt nur die Schwere „schwer“ vor (Blatt „D“: als Vorschlag kennzeichnen).
 */
const g = (gruppe: string, titel: string, faktor: string, massnahme: string, quelle: string, risiko?: string, extra?: Eintrag): Vorschlag => ({ gruppe, titel, werte: { faktor, ...(risiko ? { schwere: SCHWERE_AUS_RISIKO[risiko] ?? risiko } : {}), ...extra, beschreibung: titel, massnahme }, quelle });
const KFZ = "Kfz-Werkstatt";
const BAECKEREI = "Bäckerei";
const TRANSPORT = "Transport / Kurier";
const GEFAEHRDUNGEN_R12: Vorschlag[] = [
  g(KFZ, "Hebebühne und Arbeitsgrube: Quetschen durch absinkende oder abrutschende Fahrzeuge, Absturz in die Grube.", "arbeitsmittel", "Fahrzeuge nur an den vom Hersteller vorgesehenen Aufnahmepunkten anheben; Hebebühne nur durch unterwiesene Beschäftigte bedienen.\nHebebühne mindestens jährlich durch eine befähigte Person prüfen lassen (§ 14 BetrSichV, DGUV Grundsatz 308-002).\nArbeitsgrube bei Nichtbenutzung abdecken bzw. absichern; Grubenrand kennzeichnen.", "§ 14 BetrSichV; DGUV Regel 109-009; DGUV Regel 100-500 Kap. 2.10; DGUV Grundsatz 308-002", "hoch"),
  g(KFZ, "Abgase von Dieselmotoren beim Motorlauf in der Halle.", "einwirkungen", "Motoren in der Halle nur mit Abgasabsaugung am Auspuff laufen lassen; Motorlaufzeiten kurz halten.\nHalle ausreichend lüften; Gefährdung nach TRGS 554 beurteilen.\nDieselmotoremissionen sind krebserzeugend: Beschäftigte mit Exposition im Expositionsverzeichnis erfassen (§ 10a GefStoffV).", "TRGS 554; § 10a GefStoffV"),
  g(KFZ, "Hochvolt-Fahrzeuge (Elektro- und Hybridantrieb): elektrischer Schlag und Störlichtbogen.", "arbeitsmittel", "Arbeiten am Hochvolt-System nur durch dafür qualifizierte Beschäftigte (Qualifizierungsstufen nach DGUV Information 209-093).\nSpannungsfreiheit nach Herstellervorgabe herstellen, sichern und feststellen; Fahrzeug kennzeichnen und Arbeitsbereich absperren.\nIsolierte Werkzeuge und geeignete Schutzausrüstung bereitstellen und prüfen.", "DGUV Information 209-093", "hoch"),
  g(KFZ, "Reifenmontage und -befüllung: Platzen des Reifens, Quetschen an der Montiermaschine, schwere Räder.", "arbeitsmittel", "Reifen nur mit Füllgerät mit Druckbegrenzung befüllen, große Reifen im Füllkäfig.\nMontiermaschine nur unterwiesen bedienen; nicht in den Bereich von Montierkopf und Felge greifen.\nRadheber bzw. Hebehilfen für schwere Räder bereitstellen.", `DGUV Regel 109-009`),
  g(KFZ, "Bremsenreiniger und Lösemittel: Dämpfe, Hautschäden, Brandgefahr.", "einwirkungen", "Ersatz prüfen (z. B. wässrige Reiniger, Bremsenwaschgerät statt Sprühdose).\nFür ausreichende Lüftung sorgen; Zündquellen fernhalten.\nIm Gefahrstoffverzeichnis führen, Betriebsanweisung und geeignete Schutzhandschuhe bereitstellen.", "§ 7 GefStoffV; TRGS 510; DGUV Regel 109-009"),
  // E-167 (B-089, offen): Brandgefahr des Kältemittels R1234yf, Sachkunde nach ChemKlimaschutzV
  g(KFZ, "Kältemittel beim Klimaanlagen-Service: Erfrierungen, Erstickungsgefahr in Gruben und tiefliegenden Bereichen.", "einwirkungen", "Klimaservice nur durch Beschäftigte mit Sachkunde nach ChemKlimaschutzV bzw. F-Gase-Verordnung; Kältemittel nur mit Absaug- und Recyclinggerät handhaben.\nKältemittel R1234yf ist entzündbar – Zündquellen fernhalten.\nNicht in Arbeitsgruben oder tiefliegenden Bereichen ablassen (Kältemittel sind schwerer als Luft).\nSchutzbrille und Kälteschutzhandschuhe tragen.", `DGUV Regel 109-009; ChemKlimaschutzV`),
  g(KFZ, "Batteriesäure und Knallgas beim Laden von Starterbatterien.", "einwirkungen", "Batterien nur in gut gelüfteten Bereichen laden; Funken, offenes Feuer und Rauchen fernhalten.\nSchutzbrille und säurefeste Handschuhe tragen; Augenspüleinrichtung bereithalten.", `DGUV Regel 109-009`),
  g(KFZ, "Druckluft: Verletzungen durch Abblasen, peitschende Schläuche, Lärm.", "arbeitsmittel", "Druckluft nie auf Personen richten; Kleidung und Haut nicht abblasen.\nSchläuche und Kupplungen regelmäßig kontrollieren und sichern.\nKompressor und Druckbehälter nach BetrSichV prüfen lassen.", "BetrSichV Anhang 2 Abschnitt 4; DGUV Regel 109-009"),
  // E-167 (B-092): Vorsorge mit Schwelle 4 mg/m³ nach ArbMedVV
  g(BAECKEREI, "Mehlstaub: Atemwegs- und Hauterkrankungen (Bäckerasthma).", "einwirkungen", "Staubarm arbeiten: Mehl nicht werfen oder abblasen, langsam einschütten, Knetmaschinen abdecken bzw. absaugen; staubarme Mehle und Trennmittel verwenden.\nFeucht reinigen oder saugen statt kehren.\nArbeitsmedizinische Vorsorge: Pflichtvorsorge bei Mehlstaub über 4 mg/m³, Angebotsvorsorge bei Einhaltung (ArbMedVV Anhang Teil 1 Abs. 1 Nr. 2 Buchst. j, Abs. 2 Nr. 2 Buchst. j).", "ArbMedVV Anhang Teil 1 Abs. 1 Nr. 2 Buchst. j, Abs. 2 Nr. 2 Buchst. j; BGN-Branchenwissen Backbetriebe", "hoch"),
  g(BAECKEREI, "Teig- und Knetmaschinen, Ausrollmaschinen: Einzug und Quetschen.", "arbeitsmittel", "Schutzgitter und Verriegelungen nicht überbrücken; nicht in laufende Maschinen greifen.\nReinigen nur bei stillstehender und gegen Wiedereinschalten gesicherter Maschine.\nMaschinen und Schutzeinrichtungen regelmäßig prüfen (§ 14 BetrSichV); Betriebsanweisung für die Maschine (§ 12 BetrSichV).", "§§ 12, 14 BetrSichV; BGN-Branchenwissen Backbetriebe", "hoch"),
  g(BAECKEREI, "Öfen, Stikkenöfen und Gärräume: Verbrennungen, heißer Dampf, Einschließen, kippende Stikkenwagen.", "arbeitsmittel", "Hitzeschutzhandschuhe bereitstellen; Ofentüren vorsichtig öffnen (Dampf).\nNotöffnung von Gär- und Kühlräumen von innen regelmäßig prüfen.\nStikkenwagen nicht überladen, Bremsen und Rollen prüfen.", `BGN-Branchenwissen Backbetriebe`),
  // E-167 (B-095): Untersuchungsfristen und Nachtzeit in Bäckereien
  g(BAECKEREI, "Nachtarbeit und frühe Arbeitszeiten: Belastung der Gesundheit, Müdigkeit, Unfälle auf dem Arbeitsweg.", "ablaeufe_arbeitszeit", "Nachtarbeitnehmer vor Beginn der Beschäftigung und danach alle 3 Jahre, ab 50 Jahren jährlich arbeitsmedizinisch untersuchen lassen, Kosten trägt der Betrieb (§ 6 Abs. 3 ArbZG); Ausgleich nach § 6 Abs. 5 ArbZG.\nNachtzeit in Bäckereien und Konditoreien: 22 bis 5 Uhr (§ 2 Abs. 3 ArbZG).\nSchichtpläne nach gesicherten arbeitswissenschaftlichen Erkenntnissen gestalten.\nJugendliche: in Bäckereien nur in den Grenzen des § 14 JArbSchG (z. B. über 16 Jahre ab 5 Uhr, über 17 Jahre ab 4 Uhr).", "§§ 2, 6 Abs. 3, 5 ArbZG; § 14 Abs. 2 Nr. 4, Abs. 3 JArbSchG"),
  g(TRANSPORT, "Straßenverkehr: Unfälle bei der Auslieferung.", "arbeitsmittel", "Fahrzeuge mindestens jährlich durch eine sachkundige Person prüfen lassen (§ 57 DGUV Vorschrift 70); vor Fahrtbeginn Abfahrtkontrolle.\nNur geeignete, unterwiesene Fahrerinnen und Fahrer einsetzen (§ 35 DGUV Vorschrift 70); Führerscheine regelmäßig kontrollieren.\nNicht telefonieren oder Scanner bedienen während der Fahrt.", "§§ 35, 36, 57 DGUV Vorschrift 70", "hoch"),
  g(TRANSPORT, "Zeitdruck und lange Touren: psychische Belastung, Ermüdung.", "psychisch", "Touren realistisch planen, Pausen einplanen (§ 4 ArbZG).\nLenk- und Ruhezeiten einhalten, wo sie gelten; Rückmeldung der Fahrer zur Tourplanung einholen.", "§§ 4, 21a ArbZG; BG Verkehr"),
  g(TRANSPORT, "Ladungssicherung: verrutschende oder herabfallende Ladung.", "ablaeufe_arbeitszeit", "Ladung so verstauen und sichern, dass sie auch bei Vollbremsung oder Ausweichbewegung nicht verrutscht (§ 22 StVO); Zurrgurte, Trennnetze und Antirutschmatten bereitstellen.\nFahrer zur Ladungssicherung unterweisen.", "§ 22 StVO; VDI 2700; DGUV Information 214-003"),
  // E-167 (B-099): Heben und Tragen gehört zu den Arbeitsverfahren (physische Belastung)
  g(TRANSPORT, "Heben und Tragen von Paketen, Treppen: Belastung von Rücken und Gelenken.", "ablaeufe_arbeitszeit", "Sackkarre bzw. Treppensteiger bereitstellen; schwere Sendungen zu zweit tragen.\nUnterweisung zum rückengerechten Heben und Tragen (Lastenhandhabungsverordnung).", "LasthandhabV; Leitmerkmalmethode (BAuA)"),
  g(TRANSPORT, "Lastenrad: Stürze, Unfälle, Überladung.", "arbeitsmittel", "Vor dem ersten Einsatz einweisen; zulässiges Gesamtgewicht und Zuladung beachten.\nRäder regelmäßig warten (Bremsen, Beleuchtung, Reifen); Helm bereitstellen.", `BG Verkehr`),
  // E-167 (B-101): UV-Angebotsvorsorge wie B-050
  g(TRANSPORT, "Witterung: Hitze, Kälte, Nässe und Glätte auf der Tour.", "einwirkungen", "Wetterschutzkleidung und bei Hitze Getränke bereitstellen; Sonnenschutz.\nBei Glätte Touren anpassen; Winterausrüstung der Fahrzeuge.\nAngebotsvorsorge bei Tätigkeiten im Freien mit intensiver UV-Belastung von regelmäßig 1 Stunde oder mehr je Tag (ArbMedVV Anhang Teil 3).", `ArbMedVV Anhang Teil 3`),
  g(TRANSPORT, "Hunde beim Zustellen: Bissverletzungen.", "sonstiges", "Grundstücke mit frei laufenden Hunden nicht betreten; Adressen an die Disposition melden.\nVerhalten gegenüber Hunden unterweisen.", `BG Verkehr`),
  g(TRANSPORT, "Überfall und Gewalt (Bargeld, Wertsendungen).", "psychisch", "Möglichst bargeldlos kassieren; Bargeld nicht offen mitführen.\nVerhalten bei Überfall unterweisen; Erreichbarkeit und Notruf regeln; Betreuung nach einem Vorfall.", `BG Verkehr; BGHW`),
];

/**
 * E-166: Gruppe „Praxis / Gesundheit“ (Arzt-, Zahnarzt-, Therapiepraxen, Pflege). E-167: Fundstellen der Sifa-Durchsicht
 * (B-104 bis B-108); offen bleiben das Vorgehen nach einer Stichverletzung (Betriebsarzt, aktuelle PEP-Leitlinie) und die
 * aktuelle BGW-Schrift zu Desinfektionsmitteln.
 */
const PRAXIS = "Praxis / Gesundheit";
const GEFAEHRDUNGEN_PRAXIS: Vorschlag[] = [
  g(PRAXIS, "Biostoffe bei Untersuchung und Behandlung: Infektionen durch Blut, Körperflüssigkeiten und Ausscheidungen.", "einwirkungen", "Tätigkeiten mit Biostoffen nach BioStoffV und TRBA 250 beurteilen und einer Schutzstufe zuordnen.\nWirksame Desinfektionsverfahren festlegen (§ 11 Abs. 1 BioStoffV); Hygieneplan mit Händehygiene, Flächen- und Instrumentendesinfektion.\nGeeignete Schutzhandschuhe und Schutzkleidung bereitstellen.\nArbeitsmedizinische Vorsorge nach ArbMedVV Anhang Teil 2 prüfen; Impfungen anbieten, soweit das Infektionsrisiko tätigkeitsbedingt erhöht ist (§ 6 Abs. 2 ArbMedVV).", "BioStoffV; TRBA 250; ArbMedVV Anhang Teil 2 Abs. 1 Nr. 3; § 6 Abs. 2 ArbMedVV"),
  g(PRAXIS, "Stich- und Schnittverletzungen durch gebrauchte Kanülen und scharfe Instrumente (Nadelstichverletzungen).", "einwirkungen", "Spitze und scharfe Instrumente durch solche mit Sicherheitsmechanismus ersetzen, soweit technisch möglich und zur Vermeidung einer Infektion erforderlich (§ 11 Abs. 2 BioStoffV).\nGebrauchte Kanülen nicht in die Schutzkappe zurückstecken (§ 11 Abs. 3 BioStoffV).\nStich- und bruchfeste, eindeutig gekennzeichnete Abwurfbehälter möglichst nah am Verwendungsort bereitstellen; nicht umfüllen (§ 11 Abs. 4 BioStoffV; TRBA 250 Nr. 4.2.5).\nVorgehen nach einer Stichverletzung festlegen und aushängen: Blutfluss fördern, desinfizieren, Durchgangsarzt bzw. Betriebsarzt aufsuchen, im Verbandbuch eintragen. Beschäftigte zeitnah über Verletzungen mit organisatorischen oder technischen Ursachen informieren – in Einrichtungen des Gesundheitsdienstes, z. B. der medizinischen Fußpflege, ist das Pflicht (§ 11 Abs. 5 BioStoffV).", `§ 11 Abs. 2–5 BioStoffV; TRBA 250; Leitlinie HIV-PEP – ${PRUEFEN}`, "hoch"),
  g(PRAXIS, "Desinfektionsmittel: Reizungen von Haut und Atemwegen, Allergien.", "einwirkungen", "Desinfektionsmittel im Gefahrstoffverzeichnis führen und eine Betriebsanweisung erstellen (GefStoffV, TRGS 525).\nFlächen wischen statt sprühen; Lösungen mit Dosierhilfe und nicht mit heißem Wasser ansetzen; lüften.\nChemikalienbeständige Schutzhandschuhe tragen (z. B. aus Nitril) – Untersuchungshandschuhe schützen nicht ausreichend vor Chemikalien.", `TRGS 525; BGW`),
  g(PRAXIS, "Hautbelastung durch häufige Händedesinfektion, Händewaschen und langes Tragen von Handschuhen (Feuchtarbeit).", "einwirkungen", "Feuchtarbeit nach TRGS 401 beurteilen; Hautschutzplan mit Hautschutz, Hautreinigung und Hautpflege aufstellen.\nHandschuhe nur so lange wie nötig tragen; bei längerem Tragen Unterziehhandschuhe aus Baumwolle.\nArbeitsmedizinische Vorsorge bei Feuchtarbeit nach ArbMedVV Anhang Teil 1 anbieten bzw. veranlassen.", "TRGS 401; ArbMedVV Anhang Teil 1"),
  g(PRAXIS, "Röntgen und andere ionisierende Strahlung (nur Hinweis).", "sonstiges", "Röntgen und Strahlenschutz regeln das Strahlenschutzgesetz und die Strahlenschutzverordnung mit eigenen Pflichten (z. B. Fachkunde, Strahlenschutzverantwortliche und -beauftragte, Unterweisung) – nicht Gegenstand dieser Beurteilung; mit der zuständigen Strahlenschutzbehörde klären.", "StrlSchG; StrlSchV (Unterweisung § 63 StrlSchV)"),
];

/**
 * E-167: Gefährdungen, die in der Sifa-Durchsicht je Branche fehlten (Blatt „A Fehlende Bausteine“, Fragen 1, 5, 6) –
 * Gefährdung, Faktor, Maßnahmen und Fachquelle aus dem Blatt, im Stil der übrigen Bausteine (eine Maßnahme je Zeile). Der
 * Risikovorschlag des Blatts wird als Schwere vorgeschlagen (hoch → schwer, mittel → mittel, gering → leicht); die
 * Wahrscheinlichkeit wählt der Betrieb. Prüfstand „offen“: „fachlich zu prüfen“ in der Quelle.
 */
const GASTRO = "Gastronomie / Café";
const sonst = (unterpunkt: string): Eintrag => ({ unterpunkt });
const GEFAEHRDUNGEN_SIFA: Vorschlag[] = [
  g(GASTRO, "CO2 aus Getränkeschankanlagen und Druckgasflaschen im Keller: Erstickung.", "einwirkungen", "CO2-Warnanlage in Räumen mit Gasflaschen bzw. Schankanlage.\nGasflaschen gegen Umfallen sichern.\nSchankanlage nach BetrSichV prüfen lassen.\nBeschäftigte unterweisen.", "DGUV Regel 110-007; BetrSichV; TRGS 510", "hoch"),
  g(GASTRO, "Gasgeräte und Flüssiggas: Brand, Explosion, Kohlenmonoxid.", "sonstiges", "Gasgeräte mit der Lüftung verriegeln.\nFlüssiggasanlagen prüfen lassen; Gasmangelsicherung.\nVerhalten bei Gasgeruch unterweisen.", "DGUV Regel 110-010; DGUV Regel 110-003; BetrSichV", "hoch", sonst("brand")),
  g(GASTRO, "Brandschutz allgemein: Feuerlöscher, Flucht- und Rettungswege, Brandschutzhelfer.", "sonstiges", "Grundausstattung mit Feuerlöschern nach ASR A2.2.\nFlucht- und Rettungswege freihalten (ASR A2.3).\nBrandschutzhelferinnen und -helfer benennen und ausbilden (in der Regel 5 % der Beschäftigten).", "ASR A2.2; ASR A2.3", "mittel", sonst("brand")),
  g(GASTRO, "Alleinarbeit, Spät- und Nachtschicht, Gästeaggression beim Kassenabschluss.", "psychisch", "Erreichbarkeit und Notruf regeln.\nKassenabschluss ohne Publikum.\nBargeldbestand in der Kasse gering halten.", "BGN; DGUV Regel 112-139", "mittel"),
  g("Friseur", "Schnitt- und Stichverletzungen an Scheren und Rasiermessern (mit Blutkontakt).", "arbeitsmittel", "Rasiermesser mit Wechselklinge verwenden.\nKlingen in durchstichsichere Behälter entsorgen.\nVerletzungen im Verbandbuch eintragen; Hygieneplan anwenden.", "BGW; Hygieneverordnung des Landes", "mittel"),
  g("Friseur", "Verbrennungen an Glätteisen, Lockenstab und Wärmegeräten.", "arbeitsmittel", "Hitzefeste Ablagen bereitstellen.\nGeräte nach Gebrauch abschalten.", "BGW", "gering"),
  g("Kosmetik", "Verbrennungen durch Heißwachs; UV-Strahlung von Nageltrocknern.", "einwirkungen", "Wachserwärmer mit Temperaturregelung verwenden.\nLED-Geräte bevorzugen; Herstellerangaben beachten.", `BGW 04-05-080; OStrV`, "gering"),
  g(BAECKEREI, "Hautbelastung durch Teig, Mehl, Feuchtarbeit und Reinigungsmittel.", "einwirkungen", "Hautschutzplan aufstellen.\nBei der Reinigung Schutzhandschuhe tragen.\nFeuchtarbeitszeiten beachten: mehr als 2 Stunden je Tag Angebotsvorsorge, ab 4 Stunden Pflichtvorsorge (ArbMedVV).", "TRGS 401; BGN", "mittel"),
  g(BAECKEREI, "Brotschneide- und Schneidmaschinen, Ausrutschen auf Mehl und Wasser, Heben von Mehlsäcken (25 kg).", "arbeitsmittel", "Schutzeinrichtungen an Schneidmaschinen verwenden und nicht überbrücken.\nRutschhemmender Boden in der Backstube nach ASR A1.5 Anhang 2.\nHebehilfen und Sackkarre für Mehlsäcke bereitstellen.", "BGN; ASR A1.5; LasthandhabV", "mittel"),
  g(KFZ, "Schweißen und Schneiden: Schweißrauch, Brand, optische Strahlung.", "einwirkungen", "Schweißrauch an der Entstehungsstelle absaugen.\nBrandwache und Erlaubnisschein bei Arbeiten außerhalb fester Schweißplätze; Schutzschirm gegen optische Strahlung.\nArbeitsmedizinische Vorsorge: Pflichtvorsorge bei Schweißrauch über 3 mg/m³, Angebotsvorsorge bei Einhaltung (ArbMedVV Anhang Teil 1 Abs. 1 Nr. 2 Buchst. b, Abs. 2 Nr. 2 Buchst. f).", "TRGS 528; DGUV Regel 100-500 Kap. 2.26; ArbMedVV", "hoch"),
  g(KFZ, "Hautkontakt mit Altöl, Kraftstoff (Benzol) und Kühlschmierstoff.", "einwirkungen", "Chemikalienschutzhandschuhe tragen.\nHautschutzplan anwenden.\nHände und Werkzeug nicht mit Kraftstoff reinigen.", "TRGS 401; DGUV Regel 109-009", "mittel"),
  g(KFZ, "Pyrotechnische Rückhaltesysteme (Airbag, Gurtstraffer).", "sonstiges", "Arbeiten nur durch unterwiesene Beschäftigte.\nHerstellerangaben beachten.\nLagerung nach den Vorgaben des Sprengstoffrechts.", `DGUV Regel 109-009`, "mittel", sonst("brand")),
  g(KFZ, "Brand- und Explosionsgefahr durch Kraftstoffe, Lacke und Batterieladung.", "sonstiges", "Zündquellen fernhalten.\nExplosionsgefährdete Bereiche in der Gefährdungsbeurteilung festlegen.\nGeeignete Feuerlöscher bereitstellen.", "TRGS 720 ff.; DGUV Regel 109-009", "hoch", sonst("brand")),
  g(TRANSPORT, "Ein- und Aussteigen, Laderaum, Hubladebühne: Stürze und Quetschen.", "arbeitsmittel", "Trittstufen und Haltegriffe nutzen; nicht abspringen.\nHubladebühne prüfen lassen.", `DGUV Vorschrift 70; BG Verkehr`, "mittel"),
  g(TRANSPORT, "Rangieren und Rückwärtsfahren.", "arbeitsmittel", "Beim Rückwärtsfahren einweisen lassen bzw. Rückfahrkamera nutzen (§ 46 DGUV Vorschrift 70).", `§ 46 DGUV Vorschrift 70`, "mittel"),
  g("Gebäudereinigung", "Feuchtarbeit und Hautbelastung durch Reinigungsmittel.", "einwirkungen", "Hautschutzplan aufstellen.\nGeeignete Schutzhandschuhe mit Unterziehhandschuhen tragen.\nArbeitsmedizinische Vorsorge bei Feuchtarbeit: mehr als 2 Stunden je Tag Angebotsvorsorge, ab 4 Stunden Pflichtvorsorge (ArbMedVV Anhang Teil 1).", "TRGS 401; ArbMedVV Anhang Teil 1; BG BAU", "hoch"),
  g("Gebäudereinigung", "Ätzende Sanitär- und Grundreiniger: Verätzung von Haut und Augen.", "einwirkungen", "Durch mildere Reiniger ersetzen, wo möglich.\nDosiersysteme verwenden.\nSchutzbrille tragen; Betriebsanweisung für die Reiniger.", "DGUV Regel 101-019; TRGS 555", "mittel"),
  g("Gebäudereinigung", "Ausrutschen auf frisch gewischten Böden.", "arbeitsstaette", "Nasse Bereiche absperren bzw. kennzeichnen.\nRutschhemmende Schuhe tragen.\nIn Nass- und Trockenzonen arbeiten.", "ASR A1.5; BG BAU", "mittel"),
  g("Gebäudereinigung", "Absturz bei Glas- und Fensterreinigung, von Leitern und Tritten.", "arbeitsmittel", "Teleskopstangen statt Leitern verwenden.\nGeeignete Tritte einsetzen.\nVorhandene Anschlageinrichtungen nutzen.", "DGUV Information 208-016; BG BAU", "hoch"),
  g("Gebäudereinigung", "Biostoffe in Sanitärbereichen.", "einwirkungen", "Schutzhandschuhe tragen.\nReinigungstücher nach Farben trennen (Farbkodierung).\nHändehygiene; Impfangebot mit dem Betriebsarzt prüfen.", `BioStoffV; TRBA 250 sinngemäß`, "mittel"),
  g("Gebäudereinigung", "Heben und Tragen, Zwangshaltungen, Reinigungsmaschinen (Lärm, Elektrik).", "ablaeufe_arbeitszeit", "Leichte Geräte und Fahrwagen einsetzen.\nReinigungsmaschinen nach DGUV Vorschrift 3 prüfen lassen.\nKabel so führen, dass niemand stolpert.", "LasthandhabV; DGUV Vorschrift 3", "mittel"),
  g("Büro / Laden", "Flurförderzeuge (Handhubwagen) und Warenannahme.", "arbeitsmittel", "Beschäftigte unterweisen.\nSicherheitsschuhe tragen.\nVerkehrswege für Personen und Fahrzeuge trennen.", "BGHW; DGUV Vorschrift 68 (nur bei Gabelstaplern)", "mittel"),
  g("Büro / Laden", "Kälte an Kühltheken und in Kühlräumen.", "einwirkungen", "Kälteschutzkleidung bereitstellen.\nAufwärmzeiten einplanen.", "BGHW; ASR A3.5", "gering"),
  g(PRAXIS, "Gewalt und Aggression durch Patientinnen und Patienten.", "psychisch", "Notfallplan und Alarmierung festlegen.\nDeeskalationsschulung anbieten.\nNachsorge nach einem Vorfall regeln.", `BGW; DGUV Information 207-025`, "mittel"),
  g(PRAXIS, "Laser in Dermatologie und Zahnmedizin.", "einwirkungen", "Laserschutzbeauftragte bzw. -beauftragten bestellen (§ 5 Abs. 2 OStrV).\nLaserschutzbrillen bereitstellen.\nLaserbereich kennzeichnen.", "OStrV; TROS Laserstrahlung", "hoch"),
  g(PRAXIS, "Narkosegase und Lachgas (Zahnarztpraxis), Quecksilber und Amalgam, Methacrylate.", "einwirkungen", "Absaugung und geschlossene Systeme verwenden.\nStoffe im Gefahrstoffverzeichnis führen.\nMutterschutz beachten.", `TRGS 525`, "mittel"),
  g(PRAXIS, "Mutterschutz bei Biostoffen (z. B. Röteln, Zytomegalie, Windpocken).", "sonstiges", "Immunstatus klären.\nUnverantwortbare Gefährdung nach § 11 Abs. 2 MuSchG beurteilen.", `§ 11 Abs. 2 MuSchG`, "hoch"),
];
/**
 * Stichworte in eingetragenen Gefährdungen, die beim Mutterschutz meist Maßnahmen verlangen (R11, Tischlerei #17).
 * E-167 (Blatt „B Vorlagen“, §§ 9–12 MuSchG): auch Heben und Tragen, Biostoffe, Strahlung, Narkosegase.
 */
const MUSCH_STICHWORTE = /krebserzeugend|hartholz|holzstaub|lärm|gefahrstoff|lösemittel|biostoff|infektion|cmr|heben|tragen|lasten|strahlung|röntgen|laser|narkose|lachgas|quecksilber/i;

/** E-167 (Blatt „B Vorlagen“, § 4 Nr. 6 ArbSchG): Personengruppen, die besonders zu berücksichtigen sind. */
const SCHUTZBEDUERFTIG: Record<string, string> = { jugendliche: "Jugendliche", schwangere: "Schwangere und stillende Frauen", leiharbeit: "Leiharbeitnehmerinnen und Leiharbeitnehmer", fremdfirmen: "Beschäftigte von Fremdfirmen", behinderung: "Menschen mit Behinderung" };
/**
 * E-167 (Blatt „B Vorlagen“, § 3 Abs. 6 BetrSichV): Art, Umfang und Fristen der Prüfungen von Arbeitsmitteln. Vorschläge
 * mit Frist aus der genannten Quelle; wo die Frist erst die Gefährdungsbeurteilung ergibt, steht das so da. Durchsicht
 * Sifa 23.10.2026: Fristen „mindestens jährlich“, Tabelle 1B vollständig (B-226), DGUV Regel 110-010 statt DGUV
 * Vorschrift 79 (B-200, B-233), TRBA 220 gestrichen (B-218).
 */
const pruef = (gruppe: string | undefined, arbeitsmittel: string, pruefart: string, frist: string, befaehigt: string, quelle: string): Vorschlag => ({ ...(gruppe ? { gruppe } : {}), titel: arbeitsmittel, werte: { arbeitsmittel, pruefart, frist, befaehigt }, quelle });
const ALLE_BRANCHEN = undefined;
export const PRUEF_VORSCHLAEGE: Vorschlag[] = [
  pruef(ALLE_BRANCHEN, "Ortsveränderliche elektrische Geräte und Verlängerungsleitungen", "Prüfung nach DIN EN 50699 (VDE 0702)", "Richtwert 6 Monate, in Büros höchstens 2 Jahre bei Fehlerquote unter 2 %; Werkstätten und ähnliche Bedingungen höchstens 1 Jahr; Baustellen Richtwert 3 Monate, höchstens 1 Jahr", "Elektrofachkraft bzw. elektrotechnisch unterwiesene Person unter Leitung einer Elektrofachkraft", "DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1B"),
  pruef(ALLE_BRANCHEN, "Elektrische Anlagen und ortsfeste Betriebsmittel", "Wiederholungsprüfung", "Richtwert 4 Jahre", "Elektrofachkraft", "DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1A"),
  pruef(ALLE_BRANCHEN, "Fehlerstrom-Schutzschalter (stationäre Anlagen)", "Prüftaste betätigen", "Richtwert 6 Monate", "unterwiesene Benutzerin bzw. unterwiesener Benutzer", "DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1A"),
  pruef(ALLE_BRANCHEN, "Feuerlöscher", "Instandhaltung und Prüfung", "spätestens alle 2 Jahre", "Sachkundige Person", "ASR A2.2"),
  pruef(ALLE_BRANCHEN, "Leitern und Tritte", "Sichtprüfung vor Benutzung; Prüfung durch befähigte Person", "Frist nach Gefährdungsbeurteilung (in der Regel 12 Monate)", "befähigte Person", "DGUV Information 208-016; §§ 3 Abs. 6, 14 BetrSichV"),
  pruef(ALLE_BRANCHEN, "Regale und Lagereinrichtungen", "Regalinspektion", "mindestens jährlich", "befähigte Person", "DIN EN 15635; § 14 BetrSichV"),
  pruef("Gastronomie / Café", "Getränkeschankanlage mit CO2-Druckgasflaschen", "Prüfung nach BetrSichV", "Frist nach Gefährdungsbeurteilung", "befähigte Person", "DGUV Regel 110-007; BetrSichV"),
  pruef("Gastronomie / Café", "Flüssiggasanlage und Gasgeräte", "Prüfung auf Dichtheit und sicheren Betrieb", "Frist nach Gefährdungsbeurteilung", "befähigte Person", "DGUV Regel 110-010; BetrSichV"),
  pruef("Gastronomie / Café", "Aufschnittmaschine", "Prüfung der Schutzeinrichtungen", "Frist nach Gefährdungsbeurteilung", "befähigte Person", "§§ 3 Abs. 6, 14 BetrSichV"),
  pruef("Bäckerei", "Knet-, Teig- und Ausrollmaschinen", "Prüfung der Schutzeinrichtungen und Verriegelungen", "Frist nach Gefährdungsbeurteilung", "befähigte Person", "§§ 3 Abs. 6, 14 BetrSichV"),
  pruef("Kfz-Werkstatt", "Hebebühne", "Wiederkehrende Prüfung", "mindestens jährlich", "befähigte Person", "§ 14 BetrSichV; DGUV Grundsatz 308-002"),
  pruef("Kfz-Werkstatt", "Kompressor und Druckluftbehälter", "Prüfung nach BetrSichV Anhang 2 Abschnitt 4", "Frist nach Prüffristenermittlung", "befähigte Person bzw. zugelassene Überwachungsstelle", "BetrSichV Anhang 2 Abschnitt 4"),
  pruef(undefined, "Firmenfahrzeuge", "Prüfung auf betriebssicheren Zustand", "mindestens jährlich", "Sachkundige Person", "§ 57 DGUV Vorschrift 70"),
  pruef("Holz / Tischlerei", "Holzbearbeitungsmaschinen (z. B. Kreissäge)", "Prüfung der Schutzeinrichtungen", "Frist nach Gefährdungsbeurteilung", "befähigte Person", "§§ 3 Abs. 6, 14 BetrSichV; DGUV Regel 109-606"),
];
/**
 * Nächster Prüftermin als Vorschlag: letzte Prüfung plus erste Monats- bzw. Jahreszahl der Frist („12 Monate“, „2 Jahre“);
 * „mindestens jährlich“ (Durchsicht Sifa 23.10.2026, B-231/B-236/B-238) zählt als 12 Monate.
 */
export function naechstePruefung(letzte: string, frist: string): string {
  const m = /(\d+)\s*(Monat|Monate|Jahr|Jahre)\b/.exec(frist);
  const j = /\bjährlich\b/.exec(frist);
  const stelle = m && (!j || m.index < j.index) ? m.index : j?.index;
  if (!letzte || stelle === undefined || /Gefährdungsbeurteilung|Prüffristenermittlung/.test(frist.slice(0, stelle))) return "";
  return plusMonate(letzte, m && stelle === m.index ? Number(m[1]) * (m[2]!.startsWith("Jahr") ? 12 : 1) : 12);
}
const PRUEF_KOPF = ["Arbeitsmittel", "Prüfart", "Frist", "Befähigte Person", "Letzte Prüfung", "Nächste Prüfung"];
const PRUEF_BREITEN = ["21%", "19%", "18%", "18%", "12%", "12%"];

/** Risikostufe eines Eintrags: aus Schwere × Wahrscheinlichkeit; sonst die bisherige Einzelstufe (Unterlagen vor E-167). */
export function risikoEintrag(x: Eintrag): { stufe: string; alt: boolean } {
  const neu = risikoAus(text(x, "schwere"), text(x, "wahrscheinlichkeit"));
  if (neu) return { stufe: neu, alt: false };
  const alt = text(x, "risiko");
  return { stufe: RISIKO_STUFEN[alt] ? alt : "", alt: Boolean(RISIKO_STUFEN[alt]) };
}
/** Einträge mit der bisherigen Einzelstufe, aber ohne Schwere und Wahrscheinlichkeit – neu zu bewerten. */
const altBewertet = (l: Eintrag[]) => l.filter((x) => risikoEintrag(x).alt);
/** Legende mit Matrix (E-167, Blatt „D Risikoskala“) – auch auf dem leeren Blatt. */
function risikoLegende(): string {
  const zeilen = Object.entries(SCHWERE).map(([s, t]) => [`<strong>${esc(t)}</strong>`, ...Object.keys(WAHRSCHEINLICHKEIT).map((w) => esc(RISIKO_MATRIX[s]![w]!))]);
  return zusammen(
    `<h3>Risiko: Schwere × Wahrscheinlichkeit</h3>${tabelle(["Schwere des möglichen Schadens", ...Object.values(WAHRSCHEINLICHKEIT)], zeilen, { breiten: ["40%", "20%", "20%", "20%"], klasse: "risikomatrix" })}` +
      `<p class="klein">Handlungsbedarf: hoch – ${esc(HANDLUNGSBEDARF.hoch!)}; mittel – ${esc(HANDLUNGSBEDARF.mittel!)}; gering – ${esc(HANDLUNGSBEDARF.gering!)}.</p>`,
  );
}

const WIRKSAM: Record<string, string> = { wirksam: "Die Maßnahmen sind umgesetzt und wirksam.", teilweise: "Die Maßnahmen sind teilweise wirksam; Nachbesserung siehe Bemerkung.", offen: "Die Wirksamkeit ist noch zu überprüfen." };
/** E-167 (B-001): Unternehmermodell mit den Pflichten des Unternehmers; Regelbetreuung als eigene Auswahl. */
const MITWIRKUNG = [
  "Fachkraft für Arbeitssicherheit",
  "Betriebsärztin / Betriebsarzt",
  "Alternative bedarfsorientierte Betreuung (Unternehmermodell) der BG nach DGUV Vorschrift 2, Anlage 3 – Teilnahme an Motivations- und Informationsmaßnahmen am …; anlassbezogene Betreuung durch …",
  "Regelbetreuung nach DGUV Vorschrift 2, Anlage 1 durch … (Fachkraft für Arbeitssicherheit, Betriebsärztin bzw. Betriebsarzt oder Dienst)",
  "Beschäftigte des Bereichs",
];
/** E-167 (B-116, B-117): Anlässe für die Überprüfung; „jährlich“ ist eine Empfehlung. */
const FORTSCHREIBUNG = [
  "bei Änderungen von Tätigkeiten, Arbeitsmitteln oder Arbeitsstoffen, nach Unfällen sowie jährlich",
  "bei Änderungen von Tätigkeiten, Arbeitsmitteln, Arbeitsstoffen oder der Arbeitsstätte, nach Unfällen und Beinaheunfällen, bei Berufskrankheiten oder Gesundheitsbeschwerden, nach Ergebnissen der arbeitsmedizinischen Vorsorge, bei neuen Vorschriften oder Erkenntnissen, bei Beschäftigung Jugendlicher und nach Mitteilung einer Schwangerschaft",
];
/** E-167 (B-112 bis B-115): Wortlaut und Fundstellen des JArbSchG konkret. */
const JUGEND_VORSCHLAEGE = [
  "Gefährliche Arbeiten nach § 22 Abs. 1 JArbSchG nur, soweit zur Erreichung des Ausbildungsziels erforderlich, unter Aufsicht eines Fachkundigen; betriebsärztliche und sicherheitstechnische Betreuung sichergestellt (§ 22 Abs. 2, 3 JArbSchG).",
  "Keine Akkord- oder Fließarbeit, soweit nicht § 23 Abs. 2 JArbSchG greift (Ausbildung, Aufsicht).",
  "Höchstens 8 Stunden täglich und 40 Stunden wöchentlich (8,5 Stunden nach § 8 Abs. 2a JArbSchG); Ruhepausen 30 Minuten bei mehr als 4,5 bis 6 Stunden, 60 Minuten bei mehr als 6 Stunden (§ 11 JArbSchG); Schichtzeit höchstens 10 Stunden (§ 12 JArbSchG); Nachtruhe 20 bis 6 Uhr mit den Ausnahmen nach § 14 JArbSchG.",
  "Unterweisung vor Beginn und mindestens halbjährlich (§ 29 JArbSchG).",
];

export const gefaehrdungsbeurteilung: Vorlage = {
  id: "gefaehrdungsbeurteilung",
  titel: "Gefährdungsbeurteilung",
  beschreibung: "Welche Gefahren es an einem Arbeitsplatz gibt, wie hoch das Risiko ist und was du dagegen tust – mit Vorschlägen je Branche, Prüffristen der Arbeitsmittel, Mutterschutz und Wirksamkeitskontrolle.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefaehrdungsbeurteilung", "personal.mutterschutz_gefaehrdungsbeurteilung", "branche.handwerk_gefaehrdung_gewerk"],
  grundlage: "§§ 5, 6 ArbSchG; § 3 Abs. 6 BetrSichV; § 10 MuSchG",
  grundlageFuer: (d) => (ja(d, "jugendliche") ? "§§ 5, 6 ArbSchG; § 3 Abs. 6 BetrSichV; § 10 MuSchG; § 28a JArbSchG" : ""),
  // „Davon unter 18 Jahren“ im Pflichten-Check: Abschnitt „Jugendliche“ vorbelegt
  ausProfil: { jugendliche: "beschaeftigte.jugendlich" },
  namensFeld: "arbeitsbereich",
  abschnitte: [
    { titel: "Arbeitsbereich",
      felder: [
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich oder Gewerk", hilfe: "Je Bereich eine eigene Beurteilung; gleichartige Arbeitsplätze dürfen zusammen beurteilt werden.", pflicht: true, vorschlaege: BEREICHE_VORSCHLAG },
        { id: "taetigkeiten", art: "mehrzeilig", label: "Tätigkeiten in diesem Bereich", hilfe: "Was wird hier gemacht – Tätigkeiten, Geräte, Stoffe" },
        { id: "beschaeftigte", selten: true, art: "zahl", label: "Beschäftigte in diesem Bereich" },
        // E-167 (Blatt „B Vorlagen“): besonders schutzbedürftige Personen im Kopf der Beurteilung
        { id: "schutzbeduerftig", art: "mehrfach", label: "Besonders schutzbedürftige Personen (§ 4 Nr. 6 ArbSchG)", hilfe: "Wer in diesem Bereich arbeitet und besonders zu berücksichtigen ist", optionen: optionen(SCHUTZBEDUERFTIG) },
        { id: "beurteilt_von", art: "text", label: "Beurteilt von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "mitwirkung", selten: true, art: "mehrzeilig", label: "Mitgewirkt haben", hilfe: "Fachkundige Unterstützung (ASiG, DGUV Vorschrift 2): Fachkraft für Arbeitssicherheit und Betriebsärztin bzw. Betriebsarzt – als Regelbetreuung oder im Unternehmermodell der Berufsgenossenschaft. Das Unternehmermodell setzt voraus, dass du an den Motivations- und Informationsmaßnahmen der BG teilnimmst und dich bei Bedarf anlassbezogen betreuen lässt. Dazu die Beschäftigten des Bereichs.", vorschlaege: MITWIRKUNG },
        { id: "datum", art: "datum", label: "Datum der Beurteilung", vorbelegung: "heute", pflicht: true },
      ],
    },
    {
      titel: "Gefährdungen und Maßnahmen",
      // E-167 (Blatt „B Vorlagen“, § 4 ArbSchG, § 7 Abs. 3 GefStoffV): STOP mit Substitution zuerst
      hilfe: "Wähle typische Gefährdungen deiner Branche aus und passe sie an. Maßnahmen in der Reihenfolge STOP: Substitution vor technisch vor organisatorisch vor persönlich – z. B. erst ein milderes Reinigungsmittel, dann Absaugung, dann kürzere Einsatzzeiten, zuletzt Schutzhandschuhe. Das Risiko ergibt sich aus Schwere und Wahrscheinlichkeit.",
      felder: [
        {
          id: "gefaehrdungen",
          art: "liste",
          label: "Gefährdungen",
          eintrag: "Gefährdung",
          titelFeld: "beschreibung",
          pflicht: true,
          leerStarten: true,
          vorschlaege: [...GEFAEHRDUNGEN, ...GEFAEHRDUNGEN_EXTRA, ...GEFAEHRDUNGEN_R11, ...GEFAEHRDUNGEN_R12, ...GEFAEHRDUNGEN_PRAXIS, ...GEFAEHRDUNGEN_SIFA],
          gruppenLabel: "Branche",
          felder: [
            { id: "beschreibung", art: "mehrzeilig", label: "Gefährdung", pflicht: true },
            { id: "massnahme", art: "mehrzeilig", label: "Schutzmaßnahmen", hilfe: "Eine Maßnahme je Zeile, in der Reihenfolge STOP", pflicht: true },
            // E-167 (Blatt „D Risikoskala“): zwei Fragen statt einer vorbelegten Stufe; leer, bis beides gewählt ist
            { id: "schwere", art: "wahl", label: "Schwere des möglichen Schadens", optionen: optionen(SCHWERE), pflicht: true, hilfe: "Ein Vorschlag aus den Bausteinen ist nur ein Vorschlag – prüfe ihn für deinen Arbeitsplatz." },
            { id: "wahrscheinlichkeit", art: "wahl", label: "Wahrscheinlichkeit", optionen: optionen(WAHRSCHEINLICHKEIT), pflicht: true, hilfe: RISIKO_SKALA },
            // R11 (Tischlerei #18): beim eigenen Eintrag abgefragt – vorbelegt landete Holzstaub unter „Arbeitsstätte“
            { id: "faktor", art: "wahl", label: "Gefährdungsfaktor (§ 5 Abs. 3 ArbSchG)", optionen: optionen(GEFAEHRDUNGSFAKTOREN), pflicht: true, hilfe: "Bestimmt den Abschnitt im Dokument, z. B. Stäube und Gefahrstoffe unter „Einwirkungen“." },
            // E-167 (Blatt „B Vorlagen“): feste Unterpunkte bei „Sonstige Gefährdungen“
            { id: "unterpunkt", art: "wahl", label: "Unterpunkt bei „Sonstige Gefährdungen“", optionen: optionen(SONSTIGE_UNTERPUNKTE), wenn: { feld: "faktor", ist: "sonstiges" } },
            { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" },
            { id: "umsetzen_bis", art: "datum", label: "Umsetzen bis", hilfe: "Termin, bis wann die Maßnahme umgesetzt sein soll – erscheint in der Spalte „Wer / bis wann“" },
            { id: "umgesetzt_am", selten: true, art: "datum", label: "Umgesetzt am" },
            // E-167 (Blatt „B Vorlagen“, § 3 Abs. 1 ArbSchG): Wirksamkeit je Maßnahme, Restrisiko optional
            { id: "wirksam_am", selten: true, art: "datum", label: "Wirksamkeit geprüft am" },
            { id: "wirksam_von", selten: true, art: "text", label: "Wirksamkeit geprüft von", vorbelegung: "verantwortlich" },
            { id: "risiko_nach", selten: true, art: "wahl", label: "Risiko nach der Maßnahme", optionen: optionen(RISIKO_STUFEN) },
          ],
        },
      ],
    },
    {
      titel: "Prüfungen der Arbeitsmittel",
      hilfe: "Art, Umfang und Fristen der Prüfungen legst du in der Gefährdungsbeurteilung fest (§ 3 Abs. 6 BetrSichV). Die Frist der Vorschläge ist ein Richtwert; den nächsten Termin rechnet die App aus der letzten Prüfung nur als Vorschlag. Elektrische Geräte dokumentierst du zusätzlich im Prüfprotokoll.",
      felder: [
        {
          id: "pruefungen",
          art: "liste",
          label: "Prüfungen",
          eintrag: "Prüfung",
          titelFeld: "arbeitsmittel",
          leerStarten: true,
          vorschlaege: PRUEF_VORSCHLAEGE,
          gruppenLabel: "Branche",
          felder: [
            { id: "arbeitsmittel", art: "text", label: "Arbeitsmittel", pflicht: true },
            { id: "pruefart", art: "text", label: "Prüfart", pflicht: true },
            { id: "frist", art: "text", label: "Frist", pflicht: true, hilfe: "z. B. „12 Monate“ – aus der Quelle oder deiner Beurteilung" },
            { id: "befaehigt", art: "text", label: "Befähigte Person", hilfe: "Wer prüft, z. B. Elektrofachkraft, Sachkundige Person, Firma" },
            { id: "letzte", art: "datum", label: "Letzte Prüfung" },
            { id: "naechste", art: "datum", label: "Nächste Prüfung", hilfe: "leer: letzte Prüfung plus Frist, soweit die Frist eine Zahl nennt" },
          ],
        },
      ],
    },
    {
      titel: "Mutterschutz und Jugendliche",
      hilfe: "Die Beurteilung nach dem Mutterschutzgesetz ist für jeden Arbeitsplatz nötig – unabhängig davon, ob gerade jemand schwanger ist. Bei Gefahrstoffen, Biostoffen, Lärm, Heben und Tragen prüfst du besonders die §§ 9 bis 12 MuSchG. Teilt eine Beschäftigte mit, dass sie schwanger ist oder stillt, schreibst du diese Beurteilung für sie fort und legst die Schutzmaßnahmen unverzüglich fest (§ 10 Abs. 2 MuSchG).",
      felder: [
        { id: "mutterschutz_ergebnis", art: "wahl", label: "Ergebnis für schwangere oder stillende Frauen", optionen: MUTTERSCHUTZ, pflicht: true },
        { id: "mutterschutz_details", art: "mehrzeilig", label: "Gefährdungen und erforderliche Schutzmaßnahmen", hilfe: "z. B. kein Umgang mit bestimmten Chemikalien, Sitzgelegenheit, keine Nachtarbeit" },
        // Vorprüfung 21.10.2026: § 14 Abs. 2 MuSchG – alle Beschäftigten über das Ergebnis informieren
        { id: "mutterschutz_informiert", art: "datum", label: "Beschäftigte über das Ergebnis informiert am", hilfe: "Alle Personen, die bei dir beschäftigt sind, erfahren das Ergebnis und ob Schutzmaßnahmen nötig sind (§ 14 Abs. 2 MuSchG) – z. B. per Aushang oder in der Unterweisung." },
        // Jugendliche (§ 28a JArbSchG) analog zum Mutterschutz – im selben Schritt, aus dem Pflichten-Check vorbelegt
        { id: "jugendliche", selten: true, art: "schalter", label: "Jugendliche unter 18 Jahren in diesem Bereich", hilfe: "Auch Azubis und Praktikum: Ihre Arbeitsbedingungen beurteilst du vor Beginn der Beschäftigung (§ 28a JArbSchG)." },
        { id: "jugendliche_details", art: "mehrzeilig", label: "Gefährdungen und Schutzmaßnahmen für Jugendliche", wenn: { feld: "jugendliche" }, pflicht: true, hilfe: "z. B. keine Arbeiten mit Gefahrstoffen ohne Aufsicht, keine Akkordarbeit, Arbeitszeit- und Pausenregeln (§§ 8–14 JArbSchG)", vorschlaege: JUGEND_VORSCHLAEGE },
      ],
    },
    {
      titel: "Wirksamkeit und Fortschreibung",
      felder: [
        { id: "wirksamkeit", art: "wahl", label: "Wirksamkeit der Maßnahmen", optionen: optionen(WIRKSAM), vorbelegung: "offen" },
        { id: "wirksamkeit_am", art: "datum", label: "Überprüft am" },
        { id: "bemerkung", art: "mehrzeilig", label: "Bemerkung" },
        { id: "fortschreibung", art: "text", label: "Überprüfung der Beurteilung", hilfe: "„Jährlich“ ist eine Empfehlung, keine gesetzliche Frist – anpassen musst du die Beurteilung bei Änderungen (§ 3 Abs. 1 ArbSchG).", vorschlaege: FORTSCHREIBUNG },
      ],
    },
  ],
  hinweise(d) {
    // R11 (Tischlerei #17): „keine Schutzmaßnahmen erforderlich“ trotz Gefahrstoffen, krebserzeugender Stäube oder Lärm
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    const kritisch = g.filter((x) => MUSCH_STICHWORTE.test(`${text(x, "beschreibung")} ${text(x, "massnahme")}`));
    const r: string[] = [];
    if (text(d, "mutterschutz_ergebnis") === "keine_massnahmen" && kritisch.length)
      r.push(`Mutterschutz: Du hast ${kritisch.length === 1 ? "eine Gefährdung" : `${kritisch.length} Gefährdungen`} wie Gefahrstoffe, Biostoffe, krebserzeugende Stäube, Lärm oder Heben und Tragen eingetragen, aber „keine Schutzmaßnahmen erforderlich“ gewählt. Bitte das Ergebnis prüfen (§§ 9 bis 12 MuSchG).`);
    // E-167 (Blatt „D Risikoskala“): Unterlagen mit der bisherigen Einzelstufe neu bewerten
    const alt = altBewertet(g);
    if (alt.length) r.push(`Risiko neu bewerten: ${alt.length === 1 ? "Eine Gefährdung hat" : `${alt.length} Gefährdungen haben`} noch die bisherige Einstufung ohne Schwere und Wahrscheinlichkeit. Die alte Stufe bleibt im Dokument mit dem Vermerk „neu bewerten“, bis du beides wählst.`);
    return r;
  },
  pruefen(d) {
    // „umgesetzt und wirksam“ passt nicht zu Maßnahmen ohne Umsetzungsdatum (Hinweis, kein Hindernis)
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    return text(d, "wirksamkeit") === "wirksam" && g.some((x) => !text(x, "umgesetzt_am")) ? ["Wirksamkeit: „Maßnahmen umgesetzt und wirksam“ gewählt, aber nicht alle Maßnahmen haben ein Datum „Umgesetzt am“ – bitte prüfen."] : [];
  },
  // E-167: Übersicht der Risikostufen im Abschluss
  ergebnis(d) {
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    if (!g.length) return [];
    const zahl = (s: string) => g.filter((x) => risikoEintrag(x).stufe === s && !risikoEintrag(x).alt).length;
    const offen = g.length - zahl("hoch") - zahl("mittel") - zahl("gering");
    return [["Risiko hoch", String(zahl("hoch"))], ["Risiko mittel", String(zahl("mittel"))], ["Risiko gering", String(zahl("gering"))], ...(offen ? ([["Noch nicht bewertet", String(offen)]] as [string, string][]) : []), ["Gefährdungen", String(g.length)]];
  },
  html(d, b) {
    const g = liste(d, "gefaehrdungen").filter((x) => text(x, "beschreibung") || text(x, "massnahme"));
    // beschriftet, damit Name und Daten ohne Spaltenkopf verständlich sind: „Wer: … · Frist: … · erledigt …“ (je eine Zeile)
    const lbl = (t: string) => `<span class="lbl">${t}</span> `;
    // „Wer / bis wann“: Name und Termin je eine Zeile; ohne Termin eine kurze Linie zum Nachtragen
    const werBis = (x: Eintrag) => [text(x, "verantwortlich") ? esc(text(x, "verantwortlich")) : "", text(x, "umsetzen_bis") ? `${lbl("bis")}${datumDe(text(x, "umsetzen_bis"))}` : `${lbl("bis")}${ZELLE_LINIE}`].filter(Boolean).join("<br>");
    // „Erledigt / wirksam“: Umsetzung und – je Maßnahme – Prüfung der Wirksamkeit (E-167)
    const erledigt = (x: Eintrag) =>
      [text(x, "umgesetzt_am") ? datumDe(text(x, "umgesetzt_am")) : lbl("offen").trim(), text(x, "wirksam_am") ? `${lbl("wirksam")}${datumDe(text(x, "wirksam_am"))}${text(x, "wirksam_von") ? `<br><span class="klein">${esc(text(x, "wirksam_von"))}</span>` : ""}` : ""].filter(Boolean).join("<br>");
    // Risiko: Stufe fett, darunter Schwere und Wahrscheinlichkeit; bisherige Einzelstufe mit Vermerk; leer: Linie
    const risiko = (x: Eintrag) => {
      const r = risikoEintrag(x);
      const nach = RISIKO_STUFEN[text(x, "risiko_nach")] ? `<br><span class="klein">nach Maßnahme: ${esc(RISIKO_STUFEN[text(x, "risiko_nach")]!)}</span>` : "";
      if (r.alt) return `${esc(RISIKO_STUFEN[r.stufe]!)}<br><span class="klein">bisherige Einstufung – neu bewerten</span>${nach}`;
      if (!r.stufe) return `${ZELLE_LINIE}${nach}`;
      return `<strong>${esc(RISIKO_STUFEN[r.stufe]!)}</strong><br><span class="klein">${esc(SCHWERE_KURZ[text(x, "schwere")] ?? "")} / ${esc(WAHRSCHEINLICHKEIT[text(x, "wahrscheinlichkeit")] ?? "")}</span>${nach}`;
    };
    const tab = (l: Eintrag[]) => tabelle(GEFAEHRDUNG_KOPF, l.map((x) => [zelle(text(x, "beschreibung")), risiko(x), zellePunkte(text(x, "massnahme")), werBis(x), erledigt(x)]), { breiten: GEFAEHRDUNG_BREITEN });
    const teile = Object.entries(GEFAEHRDUNGSFAKTOREN)
      .map(([faktor, titel]) => {
        const l = g.filter((x) => (text(x, "faktor") || "sonstiges") === faktor);
        if (!l.length) return "";
        // „Sonstige“: nach festen Unterpunkten gegliedert (Brand und Explosion, Elektrik, Notfall, Weitere)
        if (faktor === "sonstiges")
          return abschnitt(
            titel,
            Object.entries(SONSTIGE_UNTERPUNKTE)
              .map(([u, ut]) => {
                const lu = l.filter((x) => (SONSTIGE_UNTERPUNKTE[text(x, "unterpunkt")] ? text(x, "unterpunkt") : "weitere") === u);
                return lu.length ? `<h3>${esc(ut)}</h3>${tab(lu)}` : "";
              })
              .join(""),
          );
        return abschnitt(titel, tab(l), FAKTOR_NR[faktor] ? { rand: `§ 5 Abs. 3 Nr. ${FAKTOR_NR[faktor]}` } : "");
      })
      .join("");
    // leeres Blatt: die sechs Gefährdungsfaktoren des § 5 Abs. 3 ArbSchG je mit einer kleinen Tabelle – so wird keine
    // Kategorie übersehen (Vorprüfung 21.10.2026); E-167: dazu „Sonstige“ mit Brand/Explosion, Elektrik, Notfall
    const leereFaktoren =
      Object.entries(GEFAEHRDUNGSFAKTOREN)
        .filter(([faktor]) => FAKTOR_NR[faktor])
        .map(([faktor, titel]) => abschnitt(titel, tabelle(GEFAEHRDUNG_KOPF, [], { breiten: GEFAEHRDUNG_BREITEN, mindestens: 2, hoch: true }), { rand: `§ 5 Abs. 3 Nr. ${FAKTOR_NR[faktor]}` }))
        .join("") +
      abschnitt(
        GEFAEHRDUNGSFAKTOREN.sonstiges!,
        ["brand", "elektrisch", "notfall"].map((u) => `<h3>${esc(SONSTIGE_UNTERPUNKTE[u]!)}</h3>${tabelle(GEFAEHRDUNG_KOPF, [], { breiten: GEFAEHRDUNG_BREITEN, mindestens: 1, hoch: true })}`).join(""),
      );
    const p = liste(d, "pruefungen").filter((x) => text(x, "arbeitsmittel"));
    const pruefungen = abschnitt(
      "Prüfungen der Arbeitsmittel",
      tabelle(PRUEF_KOPF, p.map((x) => [`<strong>${zelle(text(x, "arbeitsmittel"))}</strong>`, zelle(text(x, "pruefart")), zelle(text(x, "frist")), zelle(text(x, "befaehigt")), datumDe(text(x, "letzte")) || ZELLE_LINIE, datumDe(text(x, "naechste")) || naechstePruefung(text(x, "letzte"), text(x, "frist")) || ZELLE_LINIE]), { breiten: PRUEF_BREITEN, ...(p.length ? {} : { mindestens: 4, hoch: true }) }),
      { rand: "§ 3 Abs. 6 BetrSichV" },
    );
    const musch = MUTTERSCHUTZ.find((m) => m.wert === text(d, "mutterschutz_ergebnis"));
    // Blatt zum Ausfüllen (keine Gefährdung erfasst): Auswahlen zum Ankreuzen statt vorgedruckter Startwerte
    const leer = !g.length;
    const details = text(d, "mutterschutz_details");
    const schutz = auswahl(d, "schutzbeduerftig").map((w) => SCHUTZBEDUERFTIG[w] ?? w);
    return dokument({
      titel: "Gefährdungsbeurteilung",
      betrieb: b,
      unter: text(d, "arbeitsbereich") || undefined,
      meta: `Arbeitsbereich: ${text(d, "arbeitsbereich")}\nBeurteilt von: ${text(d, "beurteilt_von")}\nStand: ${datumDe(text(d, "datum"))}`,
      inhalt:
        abschnitt(
          "Allgemeine Angaben",
          angaben([
            ["Arbeitsbereich / Gewerk", text(d, "arbeitsbereich")],
            ["Tätigkeiten", text(d, "taetigkeiten"), 2],
            // auf dem leeren Blatt als Linie zum Eintragen, sonst nur, wenn angegeben
            ["Beschäftigte", text(d, "beschaeftigte") || (leer ? "" : null)],
            // E-167: auf dem leeren Blatt zum Ankreuzen
            ["Besonders schutzbedürftige Personen", schutz.length ? schutz.join(", ") : leer ? roh(ankreuzen(Object.values(SCHUTZBEDUERFTIG), { nebeneinander: true })) : null],
            ["Beurteilt von", text(d, "beurteilt_von")],
            // eine Zeile je Person oder Stelle; Satzzeichen am Zeilenende entfallen, sonst stünde „Protokoll., Zweite“ da
            ["Mitgewirkt haben", text(d, "mitwirkung").split("\n").map((z) => z.trim().replace(/[.;,]+$/, "")).filter(Boolean).join(", ") || (leer ? "" : null)],
            ["Datum", datumDe(text(d, "datum"))],
          ]),
        ) +
        // ohne Einträge: je Gefährdungsfaktor eine leere Tabelle zum Ausfüllen von Hand
        (teile || leereFaktoren) +
        risikoLegende() +
        pruefungen +
        (d.mutterschutz !== false
          ? abschnitt(
              "Mutterschutz (§ 10 MuSchG)",
              // ohne Ergebnis: die drei möglichen Ergebnisse zum Ankreuzen; Einzelheiten unter eigener Zwischenüberschrift
              `<p>Ergebnis der anlassunabhängigen Beurteilung für schwangere oder stillende Frauen:</p>${musch ? `<p><strong>${esc(musch.text)}</strong></p>` : ankreuzen(MUTTERSCHUTZ.map((m) => m.text))}${details ? `<h3>${musch?.wert === "keine_massnahmen" ? "Beurteilte Gefährdungen" : "Gefährdungen und Schutzmaßnahmen"}</h3>${zeilen(details)}` : ""}` +
                angaben([["Beschäftigte informiert am (§ 14 Abs. 2 MuSchG)", datumDe(text(d, "mutterschutz_informiert"))]]) +
                `<p class="klein">${esc(MUSCH_FORTSCHREIBUNG)}</p>`,
            )
          : "") +
        (ja(d, "jugendliche") ? abschnitt("Jugendliche (§ 28a JArbSchG)", `<p>${esc(JUGEND_SATZ)}</p>${text(d, "jugendliche_details") ? zeilen(text(d, "jugendliche_details")) : absatz("")}`) : "") +
        abschnitt(
          "Wirksamkeit und Fortschreibung",
          angaben([
            // leeres Blatt: nicht den Startwert „noch zu überprüfen“ vordrucken, sondern alle Stufen zum Ankreuzen
            ["Wirksamkeit", leer || !WIRKSAM[text(d, "wirksamkeit")] ? roh(ankreuzen(Object.values(WIRKSAM))) : WIRKSAM[text(d, "wirksamkeit")]!],
            ["Überprüft am", datumDe(text(d, "wirksamkeit_am"))],
            // leeres Blatt: Platz für die Bemerkung, auf die „teilweise wirksam“ verweist
            ["Bemerkung", text(d, "bemerkung") || (leer ? "" : null), 2],
            ["Überprüfung der Beurteilung", text(d, "fortschreibung")],
          ]),
        ) +
        unterschriften(["Ort, Datum", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

const ANLASS: Record<string, string> = { erst: "Erstunterweisung vor Aufnahme der Tätigkeit", wiederholung: "Wiederholungsunterweisung (mindestens jährlich)", anlass: "Unterweisung aus besonderem Anlass (z. B. neue Arbeitsmittel, Unfall)" };
/** Anlass kurz für die Kennungsleiste, mit weicher Trennstelle (die schmale Spalte trennt sonst nicht) */
const ANLASS_KURZ: Record<string, string> = { erst: "Erst\u00adunterweisung", wiederholung: "Wiederholungs\u00adunterweisung", anlass: "aus besonderem Anlass" };

/**
 * Themen der Unterweisung mit Branchengruppen (R10): Die App zeigt die passenden zuerst \u2013 beim Friseur keine Fritteuse,
 * beim Elektriker keine Friseurchemikalien. Erg\u00e4nzt um die f\u00fcnf Sicherheitsregeln f\u00fcr Elektroarbeiten (Handwerk).
 */
const UNTERWEISUNG_OPTIONEN: Option[] = [
  ...UNTERWEISUNGSTHEMEN.map((t) => ({ wert: t.wert, text: t.text, quelle: t.quelle, gruppen: t.branchen })),
  {
    wert: "elektro_fuenf_sicherheitsregeln",
    text: "Arbeiten an elektrischen Anlagen: die f\u00fcnf Sicherheitsregeln (freischalten, gegen Wiedereinschalten sichern, Spannungsfreiheit feststellen, erden und kurzschlie\u00dfen, benachbarte unter Spannung stehende Teile abdecken oder abschranken)",
    quelle: "DIN VDE 0105-100",
    gruppen: ["handwerk_allgemein"],
  },
  // R12 (Kfz #3, Bäckerei #6, Kurier #10): Themen für Werkstatt, Bäckerei und Fahrzeugführer – Gruppen aus gruppenFuerBetrieb;
  // E-167: Fundstellen der Sifa-Durchsicht (B-138 bis B-156), „fachlich zu prüfen“ nur bei Prüfstand „offen“
  ...([
    ["kfz_hebebuehne", "Hebebühne und Arbeitsgrube: Fahrzeuge sicher aufnehmen, Grube absichern", "DGUV Regel 109-009; DGUV Grundsatz 308-002", "kfz_werkstatt"],
    ["kfz_diesel", "Abgase von Dieselmotoren: Motor in der Halle nur mit Absaugung laufen lassen", "TRGS 554", "kfz_werkstatt"],
    ["kfz_hochvolt", "Hochvolt-Fahrzeuge: Arbeiten nur mit passender Qualifikation, Spannungsfreiheit nach Herstellervorgabe", "DGUV Information 209-093", "kfz_werkstatt"],
    ["kfz_reifen", "Reifenmontage und -befüllung: Füllgerät mit Druckbegrenzung, Füllkäfig, Radheber", `DGUV Regel 109-009`, "kfz_werkstatt"],
    ["kfz_gefahrstoffe", "Bremsenreiniger, Kältemittel und Batteriesäure: Lüftung, Zündquellen, Schutzausrüstung", "DGUV Regel 109-009; GefStoffV", "kfz_werkstatt"],
    ["kfz_druckluft", "Druckluft: nie auf Personen richten, Kleidung nicht abblasen", "DGUV Regel 109-009", "kfz_werkstatt"],
    ["baecker_mehlstaub", "Mehlstaub vermeiden: staubarm arbeiten, feucht reinigen, arbeitsmedizinische Vorsorge", "ArbMedVV; BGN", "baeckerei"],
    ["baecker_maschinen", "Teig- und Knetmaschinen: nicht in laufende Maschinen greifen, Schutzeinrichtungen nicht überbrücken", "§ 12 BetrSichV; BGN", "baeckerei"],
    ["baecker_oefen", "Öfen, Stikkenöfen und Gärräume: Verbrennungen, Dampf, Notöffnung", `BGN`, "baeckerei"],
    ["baecker_nacht", "Nachtarbeit: Untersuchung für Nachtarbeitnehmer und Ausgleich (§ 6 ArbZG)", "§ 6 ArbZG", "baeckerei"],
    ["fahrer_eignung", "Fahrzeugführer: Eignung, Unterweisung, Abfahrtkontrolle und Verhalten bei Mängeln", "§ 35 DGUV Vorschrift 70", "transport"],
    ["fahrer_ladung", "Ladungssicherung: Ladung so sichern, dass sie bei Vollbremsung nicht verrutscht", "§ 22 StVO", "transport"],
    ["fahrer_heben", "Heben und Tragen: Sackkarre, Treppen, schwere Sendungen zu zweit", "LasthandhabV", "transport"],
    ["fahrer_lastenrad", "Lastenrad: Einweisung, Helm, Zuladung, Wartung", `BG Verkehr`, "transport"],
    ["fahrer_tour", "Auf der Tour: Witterung, Hunde, Überfall – richtig verhalten", `BG Verkehr`, "transport"],
    // E-166: Praxen (Gesundheit und Pflege)
    ["praxis_biostoffe", "Biostoffe: Händehygiene, Schutzhandschuhe, Desinfektion nach Hygieneplan, Impfangebot", "§ 14 BioStoffV; TRBA 250", "praxis"],
    ["praxis_nadelstich", "Stich- und Schnittverletzungen: Kanülen nicht zurückstecken, Abwurfbehälter, Vorgehen nach einer Verletzung", "§ 11 BioStoffV", "praxis"],
    ["praxis_desinfektion", "Desinfektionsmittel sicher anwenden: wischen statt sprühen, richtig dosieren, geeignete Handschuhe", "TRGS 525", "praxis"],
  ] as const).map(([wert, text, quelle, gruppe]) => ({ wert, text, quelle, gruppen: [gruppe] })),
];

/**
 * E-167 (Sifa-Durchsicht, Blatt „B Vorlagen“, B-124): Gefahrstoffe und Biostoffe – Unterweisung mündlich und
 * arbeitsplatzbezogen, Inhalt und Zeitpunkt schriftlich festhalten und von den Unterwiesenen durch Unterschrift bestätigen
 * lassen (§ 14 Abs. 2 GefStoffV, § 14 Abs. 3 BioStoffV). Ein eingetippter Name genügt dafür nicht: Die App verlangt die
 * Bestätigung „Unterschriften auf Papier eingeholt“, bevor „Alle Pflichtangaben“ erscheint.
 */
export const UNTERSCHRIFT_THEMEN = [
  "gefahrstoffe_inhalt_der_betriebsanweisun",
  "friseurchemikalien_faerbe_blondier_dauer",
  "infektionsschutz_und_hygiene_stich_und_s",
  "staubarmes_arbeiten_absaugung_nassbearbe",
  "kfz_diesel",
  "kfz_gefahrstoffe",
  "baecker_mehlstaub",
  "praxis_biostoffe",
  "praxis_nadelstich",
  "praxis_desinfektion",
];
/** Themen mit Gefahrstoffen oder Biostoffen gewählt? */
export const mitUnterschriftPflicht = (d: Daten) => auswahl(d, "themen").some((w) => UNTERSCHRIFT_THEMEN.includes(w));
export const UNTERSCHRIFT_TEXT = "Gefahrstoffe und Biostoffe: Die Unterweisung erfolgt mündlich und arbeitsplatzbezogen. Inhalt und Zeitpunkt werden schriftlich festgehalten und von den Unterwiesenen durch Unterschrift bestätigt (§ 14 Abs. 2 GefStoffV, § 14 Abs. 3 BioStoffV). Ein eingetippter Name genügt dafür nicht – PDF ausdrucken, jede Person unterschreiben lassen und den Nachweis aufbewahren. Eine reine App- oder E-Learning-Unterweisung reicht für diese Themen nicht.";
export const UNTERSCHRIFT_FEHLT = "Unterschriften der Unterwiesenen auf Papier einholen und bestätigen (Gefahrstoffe/Biostoffe, § 14 Abs. 2 GefStoffV)";
/** Satz im PDF über der Teilnahmeliste (Gefahrstoffe/Biostoffe). */
const UNTERSCHRIFT_PDF = "Gefahrstoffe/Biostoffe: Unterweisung mündlich und arbeitsplatzbezogen; jede unterwiesene Person bestätigt Inhalt und Zeitpunkt mit ihrer eigenhändigen Unterschrift (§ 14 Abs. 2 GefStoffV, § 14 Abs. 3 BioStoffV).";

export const unterweisung: Vorlage = {
  id: "unterweisung",
  titel: "Unterweisungsnachweis",
  beschreibung: "Wann du wen zu welchen Gefahren und Schutzmaßnahmen unterwiesen hast – Themen zum Ankreuzen, mit Unterschriften und nächstem Termin.",
  bereich: "arbeitsschutz",
  // R11: auch die halbjährliche Unterweisung Jugendlicher (Katalog: arbeitsschutz.unterweisung_jugendliche)
  pflichten: ["arbeitsschutz.erstunterweisung", "arbeitsschutz.unterweisung_wiederholen", "arbeitsschutz.unterweisung_jugendliche"],
  grundlage: "§ 12 ArbSchG; § 4 Abs. 1 DGUV Vorschrift 1",
  // mit Jugendlichen gehört § 29 JArbSchG in den Kopf – er bestimmt den halbjährlichen Termin (R10); E-167: mit
  // Gefahrstoffen/Biostoffen § 14 Abs. 2 GefStoffV (Unterschrift)
  grundlageFuer: (d) => (ja(d, "jugendliche") || mitUnterschriftPflicht(d) ? ["§ 12 ArbSchG", ...(ja(d, "jugendliche") ? ["§ 29 JArbSchG"] : []), ...(mitUnterschriftPflicht(d) ? ["§ 14 Abs. 2 GefStoffV"] : []), "§ 4 Abs. 1 DGUV Vorschrift 1"].join("; ") : ""),
  // „Davon unter 18 Jahren“ im Pflichten-Check: Schalter vorbelegt (die App setzt ihn außerdem, sobald ein Teilnehmer unter 18 ist)
  ausProfil: { jugendliche: "beschaeftigte.jugendlich" },
  namensFeld: "thema",
  abschnitte: [
    { titel: "Unterweisung",
      felder: [
        { id: "thema", art: "text", label: "Bezeichnung", pflicht: true, vorschlaege: ["Jährliche Unterweisung Arbeitsschutz", "Erstunterweisung neuer Beschäftigter", "Unterweisung Gefahrstoffe", "Unterweisung Brandschutz und Erste Hilfe"] },
        { id: "anlass", art: "wahl", label: "Anlass", optionen: optionen(ANLASS), vorbelegung: "wiederholung" },
        { id: "datum", art: "datum", label: "Datum", vorbelegung: "heute", pflicht: true },
        { id: "dauer", art: "text", label: "Dauer", vorschlaege: ["30 Minuten", "45 Minuten", "60 Minuten", "90 Minuten"] },
        { id: "durchgefuehrt_von", art: "text", label: "Durchgeführt von", vorbelegung: "verantwortlich", pflicht: true },
        // R11 (Reinigung #13): verständlich heißt auch in einer Sprache, die alle verstehen
        { id: "sprache", art: "text", label: "Unterwiesen in Sprache", hilfe: "z. B. Deutsch oder Arabisch – die Unterweisung muss für alle verständlich sein (§ 12 Abs. 1 ArbSchG)", vorschlaege: ["Deutsch", "Englisch", "Arabisch", "Dari/Farsi", "Polnisch", "Rumänisch", "Russisch", "Türkisch", "Ukrainisch"] },
        { id: "jugendliche", art: "schalter", label: "Mit Jugendlichen unter 18 Jahren", hilfe: "Dann ist die Unterweisung mindestens halbjährlich zu wiederholen (§ 29 Abs. 2 JArbSchG)" },
      ],
    },
    {
      titel: "Inhalte",
      // E-167 (Blatt „B Vorlagen“, § 14 Abs. 2 GefStoffV): mündlich und arbeitsplatzbezogen
      hilfe: "Bei Gefahrstoffen und Biostoffen unterweist du mündlich und arbeitsplatzbezogen anhand der Betriebsanweisung – eine reine App- oder E-Learning-Unterweisung reicht dafür nicht, und die Unterwiesenen unterschreiben auf Papier.",
      felder: [
        { id: "themen", art: "bausteine", label: "Themen der Unterweisung", optionen: UNTERWEISUNG_OPTIONEN, vorbelegung: [UNTERWEISUNGSTHEMEN[0]!.wert, UNTERWEISUNGSTHEMEN[1]!.wert, UNTERWEISUNGSTHEMEN[2]!.wert], pflicht: true },
        { id: "inhalt", art: "mehrzeilig", label: "Betriebsspezifische Ergänzungen", hilfe: "z. B. konkrete Geräte, Mittel, Abläufe in deinem Betrieb" },
        // E-167 (Blatt „B Vorlagen“, DGUV Information 211-005)
        { id: "ba_nummer", art: "text", label: "Unterweisung anhand Betriebsanweisung Nr.", hilfe: "z. B. BA-01, BA-02 – die Betriebsanweisungen, die besprochen wurden" },
        { id: "verstaendnis", art: "text", label: "Verständnis geprüft durch", hilfe: "Wie du geprüft hast, dass alle die Inhalte verstanden haben", vorschlaege: ["Rückfragen und Gespräch", "Fragen zu den Inhalten", "kurzer Test", "Vorführen am Arbeitsplatz"] },
      ],
    },
    {
      titel: "Teilnehmende",
      // Vorprüfung 21.10.2026 (T-13); E-167: bei Gefahrstoffen und Biostoffen Unterschrift vorgeschrieben
      hilfe: "Namen eintragen – im ausgedruckten PDF unterschreibt jede Person eigenhändig daneben. Bei Gefahrstoffen und Biostoffen ist die Unterschrift vorgeschrieben (§ 14 Abs. 2 GefStoffV); bei den übrigen Themen ist ein nur eingetippter Name als Nachweis schwach. Freie Zeilen kommen automatisch dazu.",
      felder: [
        { id: "teilnehmer", art: "liste", ausMitarbeitern: true, label: "Teilnehmende", eintrag: "Person", titelFeld: "name", felder: [{ id: "name", art: "text", label: "Name", pflicht: true }] },
        { id: "unterschriften_papier", art: "schalter", label: "Unterschriften auf Papier eingeholt", hilfe: "Erst ankreuzen, wenn alle Unterwiesenen den ausgedruckten Nachweis eigenhändig unterschrieben haben – ein eingetippter Name genügt bei Gefahrstoffen und Biostoffen nicht (§ 14 Abs. 2 GefStoffV, § 14 Abs. 3 BioStoffV).", wenn: { feld: "themen", ist: UNTERSCHRIFT_THEMEN } },
      ],
    },
  ],
  pruefen(d) {
    return mitUnterschriftPflicht(d) && !ja(d, "unterschriften_papier") ? [UNTERSCHRIFT_FEHLT] : [];
  },
  pruefenZu: { [UNTERSCHRIFT_FEHLT]: "unterschriften_papier" },
  formHinweis(d) {
    return mitUnterschriftPflicht(d) ? { form: "unterschrift", text: UNTERSCHRIFT_TEXT } : null;
  },
  hinweise(d) {
    // Bezeichnung nennt Gefahrstoffe, aber kein passendes Thema angekreuzt – dann fehlte der Hinweis auf die Unterschrift
    return /gefahrstoff|biostoff/i.test(text(d, "thema")) && !mitUnterschriftPflicht(d) ? ["Die Bezeichnung nennt Gefahrstoffe oder Biostoffe: Kreuze das passende Thema an – dann verlangt der Nachweis die Unterschrift der Unterwiesenen (§ 14 Abs. 2 GefStoffV)."] : [];
  },
  html(d, b) {
    const themen = auswahl(d, "themen").map((w) => UNTERWEISUNG_OPTIONEN.find((t) => t.wert === w)?.text ?? w);
    // Jugendliche: mindestens halbjährlich (§ 29 Abs. 2 JArbSchG), sonst mindestens jährlich (§ 4 Abs. 1 DGUV Vorschrift 1)
    const jugendliche = ja(d, "jugendliche");
    const naechste = plusMonate(text(d, "datum"), jugendliche ? 6 : 12);
    const unterschrift = mitUnterschriftPflicht(d);
    return dokument({
      titel: "Unterweisungsnachweis",
      betrieb: b,
      unter: text(d, "thema") || undefined,
      // Anlass und Dauer in der Kennungsleiste (die Bezeichnung steht schon als Unterzeile unter dem Titel)
      meta: `Datum: ${datumDe(text(d, "datum"))}\nDurchgeführt von: ${text(d, "durchgefuehrt_von")}\nAnlass: ${ANLASS_KURZ[text(d, "anlass")] ?? ""}\nDauer: ${text(d, "dauer")}\nSprache: ${text(d, "sprache")}\nNächste Unterweisung: ${naechste ? `bis ${naechste}` : ""}`,
      inhalt:
        // in der Kennungsleiste entfallen leere Angaben – dann hier als Linie zum Eintragen
        ((a) => (a ? abschnitt("Angaben", a) : ""))(
          angaben([["Bezeichnung", text(d, "thema") ? null : ""], ["Anlass", ANLASS[text(d, "anlass")] ? null : ""], ["Datum", text(d, "datum") ? null : ""], ["Dauer", text(d, "dauer") ? null : ""], ["Durchgeführt von", text(d, "durchgefuehrt_von") ? null : ""]]),
        ) +
        abschnitt(
          "Inhalte der Unterweisung",
          (themen.length ? punkte(themen) : absatz("")) +
            (text(d, "inhalt") ? `<h3>Betriebsspezifische Ergänzungen</h3>${zeilen(text(d, "inhalt"))}` : "") +
            // E-167: Betriebsanweisungen und Verständniskontrolle – leer als Linie zum Eintragen
            angaben([["Anhand Betriebsanweisung Nr.", text(d, "ba_nummer") || (unterschrift || !themen.length ? "" : null)], ["Verständnis geprüft durch", text(d, "verstaendnis")]]),
        ) +
        abschnitt("Teilnahme", `${unterschrift ? `<p class="vor-tabelle"><strong>${esc(UNTERSCHRIFT_PDF)}</strong></p>` : ""}<p class="vor-tabelle">Mit meiner Unterschrift bestätige ich, dass ich an der Unterweisung${text(d, "sprache") ? ` (unterwiesen in Sprache: ${esc(text(d, "sprache"))})` : ""} teilgenommen und die Inhalte verstanden habe.</p>${teilnahmeTabelle(liste(d, "teilnehmer"))}`) +
        // der Hinweis zur Wiederholung steht als Fußnote nach den Unterschriften: so bleibt die letzte Teilnahmezeile mit
        // den Unterschriften zusammen (Schlussblock), statt dass eine Folgeseite nur Hinweis und Unterschriften trägt
        unterschriften(["Ort, Datum", "Unterschrift der unterweisenden Person"]) +
        nachsatz(`${jugendliche ? "Die Unterweisung Jugendlicher ist mindestens halbjährlich zu wiederholen (§ 29 Abs. 2 JArbSchG)" : "Die Unterweisung ist mindestens einmal jährlich zu wiederholen (§ 4 Abs. 1 DGUV Vorschrift 1)"}${naechste ? `, nächster Termin spätestens am ${naechste}` : ""}.`),
    });
  },
};

/** E-167: Einstufung nach CLP – Kategorie 1A/1B (§ 10a GefStoffV). */
const CMR: Option[] = [
  { wert: "nein", text: "nein" },
  { wert: "k", text: "krebserzeugend 1A/1B" },
  { wert: "m", text: "keimzellmutagen 1A/1B" },
  { wert: "r", text: "reproduktionstoxisch 1A/1B" },
];
const CMR_TEXT: Record<string, string> = { k: "krebserzeugend 1A/1B", m: "keimzellmutagen 1A/1B", r: "reproduktionstoxisch 1A/1B" };

const SDB = [
  { wert: "liegt_vor", text: "liegt vor" },
  { wert: "fehlt", text: "fehlt – anfordern" },
];

/**
 * Sicherheitsdatenblatt eines Eintrags: Auswahl `sdb`; gespeicherte Einträge von früher haben stattdessen den Schalter
 * `sdb_vorhanden`. Dessen `true` gilt als „liegt vor“. Ein gespeichertes `false` lässt sich nicht von einem übersehenen
 * Schalter unterscheiden (Startwert war `false`) – es gilt deshalb als offen: Linie zum Eintragen statt „fehlt“.
 */
function sdbStatus(x: Eintrag): "liegt_vor" | "fehlt" | null {
  const w = text(x, "sdb");
  if (w === "liegt_vor" || w === "fehlt") return w;
  return x.sdb_vorhanden === true ? "liegt_vor" : null;
}

export const gefahrstoffverzeichnis: Vorlage = {
  id: "gefahrstoffverzeichnis",
  titel: "Gefahrstoffverzeichnis",
  beschreibung: "Alle Gefahrstoffe im Betrieb mit Einstufung, Mengenbereich, Arbeitsbereich und Verweis auf das Sicherheitsdatenblatt.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefahrstoffe"],
  grundlage: "§ 6 Abs. 12 GefStoffV",
  querformat: true,
  abschnitte: [
    { titel: "Stand", felder: [{ id: "stand", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true }, { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" }] },
    {
      titel: "Gefahrstoffe",
      hilfe: "Die Angaben stehen auf dem Etikett und im Sicherheitsdatenblatt (Abschnitte 1, 2 und 16).",
      felder: [
        {
          id: "stoffe",
          art: "liste",
          label: "Gefahrstoffe",
          eintrag: "Gefahrstoff",
          titelFeld: "bezeichnung",
          pflicht: true,
          felder: [
            { id: "bezeichnung", art: "text", label: "Bezeichnung (Handelsname)", pflicht: true },
            { id: "hersteller", art: "text", label: "Hersteller" },
            { id: "gefahren", art: "text", label: "Einstufung / gefährliche Eigenschaften", hilfe: "H-Sätze oder Piktogramme laut Etikett, z. B. H315, H319", pflicht: true },
            // E-167 (Blatt „B Vorlagen“): Bezug klar – im Betrieb vorrätig (Lagermenge)
            { id: "menge", art: "text", label: "Mengenbereich im Betrieb (Lagermenge)", hilfe: "Wie viel im Betrieb vorrätig ist", pflicht: true, vorschlaege: ["bis 1 kg bzw. 1 l", "1 bis 10 kg bzw. l", "10 bis 100 kg bzw. l", "über 100 kg bzw. l"] },
            { id: "arbeitsbereich", art: "text", label: "Arbeitsbereiche mit möglicher Exposition", pflicht: true },
            { id: "verwendung", art: "text", label: "Verwendung" },
            // Auswahl ohne Startwert statt Schalter: ein übersehener Schalter druckte „fehlt“ (früher `sdb_vorhanden`, siehe sdbStatus)
            { id: "sdb", art: "wahl", label: "Sicherheitsdatenblatt", optionen: SDB, pflicht: true },
            // nicht bei „fehlt“; bei offener Auswahl sichtbar, damit der Stand früherer Einträge (sdb_vorhanden) erhalten bleibt
            { id: "sdb_stand", selten: true, art: "datum", label: "Stand des Sicherheitsdatenblatts", wenn: { feld: "sdb", ist: "fehlt", nicht: true } },
            // E-167 (Blatt „B Vorlagen“, § 10a GefStoffV): krebserzeugend, keimzellmutagen oder reproduktionstoxisch 1A/1B,
            // Ergebnis der Substitutionsprüfung, Nummer der Betriebsanweisung
            { id: "cmr", selten: true, art: "wahl", label: "Krebserzeugend, keimzellmutagen oder reproduktionstoxisch (Kategorie 1A/1B)", optionen: CMR, hilfe: "Steht im Sicherheitsdatenblatt (Abschnitt 2, z. B. H350, H340, H360). Dann führst du zusätzlich ein Expositionsverzeichnis." },
            { id: "substitution", selten: true, art: "text", label: "Substitution geprüft (Ergebnis)", hilfe: "z. B. „Ersatz durch wässrigen Reiniger nicht möglich, weil …“" },
            { id: "ba_nr", selten: true, art: "text", label: "Betriebsanweisung Nr.", hilfe: "z. B. BA-01" },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const s = liste(d, "stoffe").filter((x) => text(x, "bezeichnung"));
    const cmr = s.filter((x) => CMR_TEXT[text(x, "cmr")]);
    const zeilenHtml = s.map((x) => [
      `<strong>${zelle(text(x, "bezeichnung"))}</strong>${text(x, "hersteller") ? `<br><span class="klein">${zelle(text(x, "hersteller"))}</span>` : ""}${text(x, "ba_nr") ? `<br><span class="klein">Betriebsanweisung ${zelle(text(x, "ba_nr"))}</span>` : ""}`,
      `${zelle(text(x, "gefahren"))}${CMR_TEXT[text(x, "cmr")] ? `<br><strong>${esc(CMR_TEXT[text(x, "cmr")]!)}</strong>` : ""}`,
      zelle(text(x, "menge")),
      zelle(text(x, "arbeitsbereich")),
      `${zelle(text(x, "verwendung"))}${text(x, "substitution") ? `<br><span class="klein">Substitution geprüft: ${zelle(text(x, "substitution"))}</span>` : ""}`,
      ((st) => (st === "liegt_vor" ? `liegt vor${text(x, "sdb_stand") ? `<br>Stand ${datumDe(text(x, "sdb_stand"))}` : ""}` : st === "fehlt" ? "<strong>fehlt – anfordern</strong>" : ZELLE_LINIE))(sdbStatus(x)),
    ]);
    return dokument({
      titel: "Gefahrstoffverzeichnis",
      betrieb: b,
      quer: true,
      meta: `Stand: ${datumDe(text(d, "stand"))}\nVerantwortlich: ${text(d, "verantwortlich")}${s.length ? `\nAnzahl Gefahrstoffe: ${s.length}` : ""}`,
      inhalt:
        tabelle(["Bezeichnung / Hersteller", "Einstufung / gefährliche Eigenschaften", "Mengenbereich", "Arbeitsbereiche", "Verwendung", "Sicherheitsdatenblatt"], zeilenHtml, { breiten: ["20%", "22%", "12%", "18%", "14%", "14%"], ...(s.length ? {} : { mindestens: 10, hoch: true }) }) +
        nachsatz(`Verzeichnis nach § 6 Abs. 12 GefStoffV mit ${GEFAHRSTOFF_ANGABEN.length} Pflichtangaben: ${GEFAHRSTOFF_ANGABEN.join("; ")}. Mengenbereich: im Betrieb vorrätige Menge.`) +
        (cmr.length ? nachsatz(`${cmr.length === 1 ? "Ein Stoff ist" : `${cmr.length} Stoffe sind`} krebserzeugend, keimzellmutagen oder reproduktionstoxisch (Kategorie 1A/1B): Für Beschäftigte mit Tätigkeiten mit diesen Stoffen ist ein Expositionsverzeichnis zu führen (§ 10a GefStoffV).`) : ""),
    });
  },
};

/**
 * E-167 (Sifa-Durchsicht, Blatt „B Vorlagen“, B-079, B-085): Verzeichnis der Beschäftigten mit Tätigkeiten mit
 * krebserzeugenden, keimzellmutagenen oder reproduktionstoxischen Gefahrstoffen der Kategorie 1A oder 1B, mit Höhe und
 * Dauer der Exposition (§ 10a GefStoffV in der Fassung vom 2.12.2024) – z. B. Hartholzstaub in der Tischlerei,
 * Dieselmotoremissionen in der Werkstatt. Durchsicht Sifa 23.10.2026 (TRGS 410 Nr. 5): Geburtsdatum, eindeutige
 * Stoffkennung bzw. Tätigkeit nach TRGS 906, Ermittlungsmethode und Beurteilungsmaßstab als Feldhinweis, Datum der
 * Aktualisierung; Fußtext mit 5-Jahres-Frist für ausschließlich reproduktionstoxische Stoffe und der ZED.
 */
const EXPO_STOFFE = ["Hartholzstaub (z. B. Eiche, Buche)", "Dieselmotoremissionen"];
export const EXPO_HINWEIS = "Verzeichnis nach § 10a GefStoffV (TRGS 410): Beschäftigte mit Tätigkeiten mit krebserzeugenden, keimzellmutagenen oder reproduktionstoxischen Gefahrstoffen der Kategorie 1A oder 1B, mit Höhe und Dauer der Exposition. Das Verzeichnis wird aktuell gehalten; bei Änderungen wird das Datum der Aktualisierung festgehalten (TRGS 410 Nr. 5 Abs. 2). Aufbewahrung: 40 Jahre, bei ausschließlich reproduktionstoxischen Stoffen 5 Jahre nach Ende der Exposition; Abgabe an die ZED möglich (§ 10a Abs. 2, 3 GefStoffV). Beschäftigte erhalten beim Ausscheiden einen Auszug ihrer Angaben.";
export const expositionsverzeichnis: Vorlage = {
  id: "expositionsverzeichnis",
  titel: "Expositionsverzeichnis",
  beschreibung: "Wer im Betrieb mit krebserzeugenden Stoffen wie Hartholzstaub oder Dieselmotoremissionen arbeitet – mit Höhe und Dauer der Exposition (§ 10a GefStoffV).",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.expositionsverzeichnis"],
  grundlage: "§ 10a GefStoffV",
  querformat: true,
  abschnitte: [
    { titel: "Stand", felder: [{ id: "stand", art: "datum", label: "Stand", hilfe: "Bei jeder Änderung das Datum der Aktualisierung eintragen (TRGS 410 Nr. 5 Abs. 2)", vorbelegung: "heute", pflicht: true }, { id: "verantwortlich", art: "text", label: "Verantwortlich", vorbelegung: "verantwortlich" }] },
    {
      titel: "Beschäftigte und Exposition",
      hilfe: "Je Person und Stoff eine Zeile. Die Höhe der Exposition kommt aus Messungen oder einer begründeten Abschätzung in der Gefährdungsbeurteilung. Alternativ bietet die DGUV die Zentrale Expositionsdatenbank (ZED) an.",
      felder: [
        {
          id: "eintraege",
          art: "liste",
          label: "Beschäftigte",
          eintrag: "Person",
          titelFeld: "name",
          ausMitarbeitern: true,
          pflicht: true,
          felder: [
            { id: "name", art: "text", label: "Name", pflicht: true },
            { id: "geburtsdatum", art: "datum", label: "Geburtsdatum", pflicht: true },
            { id: "taetigkeit", art: "text", label: "Tätigkeit", pflicht: true, hilfe: "z. B. Schleifen von Eichenholz, Motorlauf in der Halle" },
            { id: "stoff", art: "text", label: "Stoff", pflicht: true, vorschlaege: EXPO_STOFFE },
            { id: "kennung", art: "text", label: "Stoffkennung bzw. Tätigkeit nach TRGS 906", pflicht: true, hilfe: "Eindeutige Stoffkennung (z. B. CAS- oder EG-Nummer) oder die Tätigkeit nach TRGS 906 (TRGS 410 Nr. 5 Abs. 1 Nr. 3)" },
            { id: "kategorie", art: "wahl", label: "Einstufung", optionen: CMR.filter((o) => o.wert !== "nein"), vorbelegung: "k" },
            { id: "hoehe", art: "text", label: "Höhe der Exposition", pflicht: true, hilfe: "Messwert oder Abschätzung mit Ermittlungsmethode und Beurteilungsmaßstab (TRGS 410 Nr. 5 Abs. 1 Nr. 5), z. B. „unter 2 mg/m³ (Messung vom …)“" },
            { id: "von", art: "datum", label: "Exposition seit", pflicht: true },
            { id: "bis", art: "datum", label: "Exposition bis", hilfe: "leer: dauert an" },
            { id: "dauer", art: "text", label: "Dauer", hilfe: "z. B. „etwa 4 Stunden je Woche“", pflicht: true },
          ],
        },
      ],
    },
  ],
  html(d, b) {
    const l = liste(d, "eintraege").filter((x) => text(x, "name"));
    const zeit = (x: Eintrag) => (text(x, "von") ? `${datumDe(text(x, "von"))} – ${text(x, "bis") ? datumDe(text(x, "bis")) : "andauernd"}` : ZELLE_LINIE);
    return dokument({
      titel: "Expositionsverzeichnis",
      betrieb: b,
      quer: true,
      meta: `Stand: ${datumDe(text(d, "stand"))}\nVerantwortlich: ${text(d, "verantwortlich")}${l.length ? `\nAnzahl Einträge: ${l.length}` : ""}`,
      inhalt:
        tabelle(
          ["Name / Geburtsdatum", "Tätigkeit", "Stoff / Kennung / Einstufung", "Höhe der Exposition (Methode, Beurteilungsmaßstab)", "Zeitraum", "Dauer"],
          l.map((x) => [
            `<strong>${zelle(text(x, "name"))}</strong>${text(x, "geburtsdatum") ? `<br><span class="klein">geb. ${datumDe(text(x, "geburtsdatum"))}</span>` : ""}`,
            zelle(text(x, "taetigkeit")),
            `${zelle(text(x, "stoff"))}${text(x, "kennung") ? `<br><span class="klein">${esc(text(x, "kennung"))}</span>` : ""}${CMR_TEXT[text(x, "kategorie")] ? `<br><span class="klein">${esc(CMR_TEXT[text(x, "kategorie")]!)}</span>` : ""}`,
            zelle(text(x, "hoehe")),
            zeit(x),
            zelle(text(x, "dauer")),
          ]),
          { breiten: ["17%", "20%", "18%", "17%", "15%", "13%"], ...(l.length ? {} : { mindestens: 10, hoch: true }) },
        ) +
        nachsatz(EXPO_HINWEIS) +
        unterschriften(["Ort, Datum", "Unterschrift Arbeitgeber/in"]),
    });
  },
};

/** Kasten einer Betriebsanweisung; `linien`: Linien je leerem Kasten (Blatt zum Ausfüllen). */
export interface BaTeil {
  id: string;
  label: string;
  hilfe: string;
  bausteine?: string;
  linien?: number;
  /** Vorschläge zum Antippen (statt Bausteinen aus der Recherche) */
  vorschlaege?: string[];
  vorschlagGruppen?: Record<string, string[]>;
  /** nur drucken, wenn ausgefüllt (z. B. Beschäftigungsbeschränkungen) */
  wennGefuellt?: boolean;
  pflicht?: boolean;
}
/** Abschnitte nach TRGS 555 Nr. 3.2.4–3.2.8 (3.2.2/3.2.3 stehen im Kopf). */
const BA_TEILE: BaTeil[] = [
  { id: "gefahren", label: "Gefahren für Mensch und Umwelt", hilfe: "H-Sätze aus dem Sicherheitsdatenblatt (Abschnitt 2), z. B. „Verursacht schwere Augenreizung“" },
  { id: "schutz", label: "Schutzmaßnahmen und Verhaltensregeln", hilfe: "Technisch, organisatorisch, Hygiene, persönliche Schutzausrüstung – konkret mit „müssen“ und „dürfen nicht“ (TRGS 555 Nr. 3.1 Abs. 9)", bausteine: "schutzmassnahmen", linien: 5 },
  { id: "gefahrfall", label: "Verhalten im Gefahrfall", hilfe: "Bei Verschütten, Brand, Unfall – laut Sicherheitsdatenblatt (Abschnitte 5 und 6)", bausteine: "gefahrfall" },
  { id: "erste_hilfe", label: "Erste Hilfe", hilfe: "Nach Augen-, Hautkontakt, Einatmen, Verschlucken – laut Sicherheitsdatenblatt (Abschnitt 4); auch, was zu unterlassen ist", bausteine: "erste_hilfe" },
  { id: "entsorgung", label: "Sachgerechte Entsorgung", hilfe: "Laut Sicherheitsdatenblatt (Abschnitt 13); Entsorgungswege im Zweifel mit der örtlichen Gewerbeabfallberatung klären", bausteine: "entsorgung" },
];
/**
 * E-167 (Blatt „B Vorlagen“, TRGS 555 Nr. 3.1, 3.2): Beschäftigungsbeschränkungen als eigener Kasten, nur wenn ausgefüllt.
 * Wortlaut nach der Durchsicht Sifa 23.10.2026 (B-240: § 22 Abs. 2 JArbSchG wie B-266; B-241: kein pauschales Verbot).
 */
export const BESCHRAENKUNG_VORSCHLAEGE = ["Jugendliche dürfen mit diesem Stoff nur arbeiten, soweit dies zur Erreichung des Ausbildungsziels erforderlich ist, und unter Aufsicht einer fachkundigen Person (§ 22 Abs. 2 JArbSchG).", "Schwangere und stillende Frauen dürfen mit diesem Stoff nicht arbeiten, soweit die Gefährdungsbeurteilung eine unverantwortbare Gefährdung ergibt (§ 11 MuSchG für Schwangere, § 12 MuSchG für Stillende)."];
const BA_BESCHRAENKUNG: BaTeil = { id: "beschraenkung", label: "Beschäftigungsbeschränkungen", hilfe: "z. B. für Jugendliche, Schwangere und stillende Frauen", vorschlaege: BESCHRAENKUNG_VORSCHLAEGE, wennGefuellt: true, pflicht: false };
/** Gefahrenpiktogramme nach CLP (Anhang V VO (EG) Nr. 1272/2008). */
export const GHS: Record<string, string> = { GHS01: "Explodierende Bombe", GHS02: "Flamme", GHS03: "Flamme über einem Kreis", GHS04: "Gasflasche", GHS05: "Ätzwirkung", GHS06: "Totenkopf mit Knochen", GHS07: "Ausrufezeichen", GHS08: "Gesundheitsgefahr", GHS09: "Umwelt" };
const SIGNALWORT: Record<string, string> = { gefahr: "Gefahr", achtung: "Achtung", keins: "kein Signalwort" };

/** Felder der Kästen einer Betriebsanweisung (Inhalt mit Bausteinen bzw. Vorschlägen zum Antippen). */
export const baFelder = (teile: BaTeil[]) =>
  teile.map((t) => ({ id: t.id, art: "mehrzeilig" as const, label: t.label, hilfe: t.hilfe, pflicht: t.pflicht ?? true, ...(t.bausteine ? { vorschlaege: (BA_BAUSTEINE[t.bausteine] ?? []).map((o) => o.text) } : t.vorschlaege ? { vorschlaege: t.vorschlaege, ...(t.vorschlagGruppen ? { vorschlagGruppen: t.vorschlagGruppen } : {}) } : {}) }));

/**
 * Aushang einer Betriebsanweisung (Muster DGUV Information 211-010): Titelband mit Nummer und Stand, Kopfkasten (Bereich
 * und Gegenstand), die Kästen, Notruf und Freigabe. Gemeinsam für Gefahrstoffe, Maschinen und Biostoffe (E-167).
 * `kopf`: [Überschrift, [Bezeichnung, Wert][]], `zusatz`: weitere Zeile im Kopfkasten (z. B. Signalwort, Piktogramme).
 */
export function baAushang(o: { d: Daten; b: Betrieb; band: string; untertitel: string; kopf: [string, [string, string][]]; zusatz?: string; teile: BaTeil[]; platz?: number }): string {
  const { d } = o;
  const teile = o.teile.filter((t) => !t.wennGefuellt || text(d, t.id));
  // leerer Kasten: drei Linien zum Ausfüllen von Hand, Schutzmaßnahmen fünf
  const kaesten = teile.map((t) => `<section class="kasten"><h2>${esc(t.label)}</h2><div class="inhalt">${text(d, t.id) ? zeilen(text(d, t.id)) : linien(t.linien ?? 3)}</div></section>`).join("");
  const leer = teile.every((t) => !text(d, t.id));
  return dokument({
    titel: "Betriebsanweisung",
    betrieb: o.b,
    gestalt: "aushang",
    // viel Text → kompakter Satz, damit der Aushang auf ein Blatt passt (geschätzte Höhe der Kästen, siehe baHoehe);
    // auch das leere Blatt kompakt: die Linien zum Ausfüllen brauchen sonst mehr als ein Blatt
    klasse: baHoehe(d, teile) > (o.platz ?? BA_PLATZ) || leer ? "ba kompakt" : "ba",
    band: o.band,
    meta: `Stand: ${datumDe(text(d, "datum"))}`,
    inhalt:
      `<div class="titelband"><div class="t">Betriebsanweisung<small>${esc(o.untertitel)}</small></div><div class="n">${text(d, "nummer") ? `<span>Nummer<b>${esc(text(d, "nummer"))}</b></span>` : ""}<span>Stand<b>${datumDe(text(d, "datum")) || "&nbsp;"}</b></span></div></div>` +
      `<section class="kasten stoff"><h2>${esc(o.kopf[0])}</h2><div class="inhalt">${o.kopf[1].map(([k, w]) => `<div><dt>${esc(k)}</dt><dd>${w ? esc(w) : LINIE}</dd></div>`).join("")}</div>${o.zusatz ?? ""}</section>` +
      kaesten +
      // ohne Angabe: Notruf und Linie für die Ersthelferin bzw. den Ersthelfer zum Eintragen von Hand
      `<div class="notruf">${text(d, "notruf") ? esc(text(d, "notruf")) : `Notruf 112 · Ersthelfer/in: ${LINIE}`}</div>` +
      unterschriften([text(d, "erstellt_von") ? `Freigegeben: ${text(d, "erstellt_von")}` : "Freigegeben von (Name)", "Datum, Unterschrift"]),
  });
}

/**
 * Signalwort und Piktogramme (E-167, TRGS 555 Nr. 3.2.4 Abs. 3): Zeile im Kopfkasten; leer zum Ankreuzen bzw. Eintragen.
 * Durchsicht Sifa 23.10.2026: Piktogramme nur als Text („GHS02 Flamme“) ohne Raute – eine nummerierte Raute ohne Symbol
 * ist kein Piktogramm nach CLP und kann verwechselt werden.
 */
function ghsZeile(d: Daten): string {
  const w = SIGNALWORT[text(d, "signalwort")];
  const p = auswahl(d, "piktogramme").filter((x) => GHS[x]);
  const signal = w ? `<b>${esc(w)}</b>` : "☐ Gefahr &nbsp; ☐ Achtung";
  const bilder = p.length ? p.map((x) => `<span class="ghs-eintrag">${esc(x)} ${esc(GHS[x]!)}</span>`).join("") : LINIE;
  return `<div class="inhalt ghs-zeile"><div><dt>Signalwort</dt><dd>${signal}</dd></div><div class="breit"><dt>Gefahrenpiktogramme</dt><dd>${bilder}</dd></div></div>`;
}

export const betriebsanweisung: Vorlage = {
  id: "betriebsanweisung",
  gestalt: "aushang",
  titel: "Betriebsanweisung",
  beschreibung: "Aushang für einen Gefahrstoff nach TRGS 555: Gefahren, Schutzmaßnahmen, Verhalten im Gefahrfall, Erste Hilfe, Entsorgung – mit Bausteinen zum Antippen.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.gefahrstoffe"],
  grundlage: "§ 14 Abs. 1 GefStoffV; TRGS 555",
  namensFeld: "stoff",
  abschnitte: [
    { titel: "Gefahrstoff",
      felder: [
        { id: "stoff", art: "text", label: "Gefahrstoff (Handelsname)", hilfe: "Die im Betrieb geläufige Bezeichnung", pflicht: true },
        { id: "arbeitsbereich", art: "text", label: "Arbeitsbereich, Arbeitsplatz, Tätigkeit", pflicht: true, vorschlaege: BEREICHE_VORSCHLAG },
        { id: "nummer", selten: true, art: "text", label: "Nummer der Betriebsanweisung", hilfe: "z. B. BA-01" },
        // E-167 (Blatt „B Vorlagen“, TRGS 555 Nr. 3.2.4 Abs. 3): Signalwort und Piktogramme – ohne zulässig, aber üblich
        { id: "signalwort", art: "wahl", label: "Signalwort", hilfe: "Steht auf dem Etikett und im Sicherheitsdatenblatt (Abschnitt 2)", optionen: optionen(SIGNALWORT) },
        { id: "piktogramme", art: "mehrfach", label: "Gefahrenpiktogramme", hilfe: "Wie auf dem Etikett", optionen: Object.entries(GHS).map(([wert, t]) => ({ wert, text: `${wert} ${t}` })) },
      ],
    },
    {
      titel: "Inhalt nach TRGS 555",
      hilfe: "Die stoffbezogenen Angaben stehen im Sicherheitsdatenblatt; die Bausteine sind allgemeine Regeln.",
      felder: [...baFelder(BA_TEILE), ...baFelder([BA_BESCHRAENKUNG]).map((f) => ({ ...f, selten: true }))],
    },
    { titel: "Notruf und Freigabe",
      felder: [
        { id: "notruf", art: "text", label: "Notruf und Ersthelfer/in", hilfe: "z. B. Notruf 112 · Ersthelfer/in: Name, Telefon", vorschlaege: ["Notruf 112"] },
        { id: "erstellt_von", art: "text", label: "Freigegeben von", vorbelegung: "verantwortlich", pflicht: true },
        { id: "datum", art: "datum", label: "Stand", vorbelegung: "heute", pflicht: true },
      ],
    },
  ],
  html(d: Daten, b) {
    // Orange der DGUV-Muster, so weit abgedunkelt, dass die weiße Schrift im Band 4,5 : 1 erreicht (#e0640c: 3,5 : 1)
    return baAushang({
      d,
      b,
      band: "#c2540a",
      untertitel: "gemäß § 14 GefStoffV (TRGS 555)",
      kopf: ["Arbeitsbereich, Arbeitsplatz, Tätigkeit · Gefahrstoffbezeichnung", [["Arbeitsbereich, Arbeitsplatz, Tätigkeit", text(d, "arbeitsbereich")], ["Gefahrstoff", text(d, "stoff")]]],
      zusatz: ghsZeile(d),
      teile: [...BA_TEILE, BA_BESCHRAENKUNG],
      // die Zeile mit Signalwort und Piktogrammen braucht ca. 12 mm
      platz: BA_PLATZ - 12,
    });
  },
};

/**
 * Platz für die fünf Kästen nach TRGS 555 im normalen Satz (10,4 pt) in mm: Satzspiegel 269 mm abzüglich Kopf,
 * Titelband und Stoffkasten (ca. 81 mm) sowie Notruf und Unterschriften (ca. 30 mm), etwas Reserve für einen
 * zweizeiligen Stoffnamen. Gemessen an den PDFs der Prüfwerkzeuge (dokumente-pruefen, Jahres-Szenarien).
 */
const BA_PLATZ = 155;

/**
 * Geschätzte Höhe der Kästen im normalen Satz (mm): je Kasten Überschrift, Innenabstand und Abstand (16,8 mm),
 * je Textzeile 5,1 mm (ca. 96 Zeichen je Zeile), je Aufzählungspunkt 0,9 mm; ein leerer Kasten je Linie zum Ausfüllen 6,4 mm.
 * Früher zählten nur die Zeilen (ab 12 kompakt) – kurze Anweisungen wurden zu früh klein gesetzt, lange liefen über.
 */
function baHoehe(d: Daten, teile: BaTeil[] = BA_TEILE): number {
  return teile.reduce((h, t) => {
    const z = text(d, t.id).split("\n").map((x) => x.trim()).filter(Boolean);
    if (!z.length) return h + 16.8 + (t.linien ?? 3) * 6.4 + 1;
    return h + 16.8 + z.reduce((m, x) => m + 5.1 * Math.ceil(x.length / 96), 0) + (z.length > 1 ? 0.9 * z.length : 1.9);
  }, 0);
}

const ERGEBNIS: Record<string, string> = { bestanden: "bestanden", maengel: "Mängel – nicht verwenden" };
// E-167 (B-187): Ausgabestände und Zuordnung Instandsetzung / Wiederholungsprüfung (Elektrofachkraft bestätigt noch)
const NORM = "DIN EN 50678 (VDE 0701):2021-02 (nach Instandsetzung) / DIN EN 50699 (VDE 0702):2021-06 (Wiederholungsprüfung)";
/**
 * E-167 (Blatt „B Vorlagen“): Grenzwerte als Zeile im Protokoll – Werte aus der Sifa-Durchsicht, von einer
 * Elektrofachkraft zu bestätigen (PRUEFLISTE); maßgeblich sind Norm und Herstellerangaben.
 */
export const ELEKTRO_GRENZWERTE = "Grenzwerte (Auszug, maßgeblich sind Norm und Herstellerangaben): RPE ≤ 0,3 Ω bis 5 m Leitungslänge; RISO ≥ 1 MΩ (Schutzklasse I) bzw. ≥ 2 MΩ (Schutzklasse II); IPE ≤ 3,5 mA; IB ≤ 0,5 mA.";
const QUALIFIKATION: Record<string, string> = { efk: "Elektrofachkraft", eup: "Elektrotechnisch unterwiesene Person unter Leitung und Aufsicht einer Elektrofachkraft" };
const MESSVERFAHREN: Record<string, string> = { direkt: "direktes Verfahren", differenz: "Differenzstromverfahren", ersatz: "Ersatz-Ableitstromverfahren" };
const SCHUTZKLASSE: Record<string, string> = { I: "I", II: "II", III: "III" };

/** Geräte zum Antippen, je Branchengruppe (R10): beim Elektriker keine Föhne, im Salon keine Winkelschleifer. */
const GERAETE: Record<string, string[]> = {
  friseur: ["Föhn", "Glätteisen", "Lockenstab", "Haarschneidemaschine", "Trockenhaube", "Wärmegerät (Climazon)"],
  kosmetik: ["Wachserwärmer", "Bedampfer", "Lupenleuchte", "Behandlungsliege (elektrisch)", "Nageltrockner (UV/LED)"],
  gastro_cafe: ["Kaffeemaschine", "Wasserkocher", "Mikrowelle", "Toaster", "Mixer", "Kühlschrank (Stecker)", "Spülmaschine (Stecker)"],
  handwerk_allgemein: ["Bohrmaschine", "Bohrhammer", "Akkuschrauber-Ladegerät", "Winkelschleifer", "Stichsäge", "Kreissäge", "Baustrahler", "Kabeltrommel", "Baustromverteiler", "Industriestaubsauger"],
  buero_laden: ["Computer mit Netzteil", "Monitor", "Drucker", "Kassensystem", "Kaffeemaschine"],
  alle: ["Verlängerungskabel", "Mehrfachsteckdose", "Wasserkocher"],
};
const GERAETE_VORSCHLAEGE = [...new Set(Object.values(GERAETE).flat())];
const GERAETE_GRUPPEN: Record<string, string[]> = Object.fromEntries(GERAETE_VORSCHLAEGE.map((g) => [g, Object.keys(GERAETE).filter((k) => GERAETE[k]!.includes(g))]));

/** Richtwert der Prüffrist in Monaten aus dem Text der DGUV-Tabelle („Richtwert 6 Monate“, „Richtwert 4 Jahre“). */
export function richtwertMonate(text: string): number | null {
  const m = /Richtwert[^0-9]{0,30}(\d+)\s*(Monat|Monate|Jahr|Jahre)\b/.exec(text);
  if (!m) return null;
  return Number(m[1]) * (m[2]!.startsWith("Jahr") ? 12 : 1);
}

export const elektroPruefung: Vorlage = {
  id: "pruefprotokoll_elektro",
  titel: "Prüfprotokoll elektrische Geräte (DGUV V3)",
  beschreibung: "Verzeichnis der geprüften Geräte mit Schutzklasse, Messwerten, Ergebnis und nächstem Termin – mit den Richtwerten für Prüffristen aus der DGUV Vorschrift 3.",
  bereich: "arbeitsschutz",
  pflichten: ["arbeitsschutz.dguv_v3"],
  grundlage: "§ 5 DGUV Vorschrift 3; § 14 BetrSichV",
  querformat: true,
  namensFeld: "datum",
  abschnitte: [
    { titel: "Prüfung",
      hilfe: "Prüfen darf eine Elektrofachkraft; eine elektrotechnisch unterwiesene Person nur unter Leitung und Aufsicht einer Elektrofachkraft. Die Prüffrist legst du in der Gefährdungsbeurteilung fest.",
      felder: [
        // im Handwerk prüft meist der Betrieb selbst – dann ist die verantwortliche Person aus „Mein Betrieb“ vorbelegt (R10)
        { id: "pruefer", art: "text", label: "Prüfende Elektrofachkraft / Firma", pflicht: true, vorbelegung: "verantwortlich", vorbelegungGruppen: ["handwerk_allgemein"] },
        { id: "datum", art: "datum", label: "Prüfdatum", vorbelegung: "heute", pflicht: true },
        { id: "auftraggeber", art: "mehrzeilig", label: "Auftraggeber / Prüfort", hilfe: "Wenn du beim Kunden prüfst: Name und Anschrift des Kunden bzw. Ort der Prüfung" },
        // E-167 (Blatt „B Vorlagen“): Qualifikation, Prüfgerät mit Kalibrierung, Messverfahren, Prüfplakette
        { id: "qualifikation", art: "wahl", label: "Qualifikation der prüfenden Person", optionen: optionen(QUALIFIKATION) },
        { id: "messgeraet", selten: true, art: "text", label: "Verwendetes Prüfgerät" },
        { id: "kalibriert", selten: true, art: "datum", label: "Prüfgerät kalibriert bis" },
        { id: "messverfahren", selten: true, art: "wahl", label: "Messverfahren Schutzleiter- bzw. Berührungsstrom", optionen: optionen(MESSVERFAHREN) },
        { id: "pruefart", art: "wahl", label: "Art der Prüfung", optionen: [{ wert: "Wiederholungsprüfung", text: "Wiederholungsprüfung" }, { wert: "Erstprüfung", text: "Erstprüfung" }, { wert: "Prüfung nach Instandsetzung", text: "nach Instandsetzung" }], vorbelegung: "Wiederholungsprüfung", pflicht: true },
        { id: "umfang", art: "bausteine", label: "Umfang der Prüfung", optionen: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Messung des Schutzleiter- bzw. Berührungsstroms", "Funktionsprüfung"].map((t) => ({ wert: t, text: t })), vorbelegung: ["Sichtprüfung", "Messung des Schutzleiterwiderstands", "Messung des Isolationswiderstands", "Funktionsprüfung"], pflicht: true },
        { id: "norm", art: "text", label: "Prüfgrundlage", vorbelegung: { text: NORM }, vorschlaege: [NORM] },
        { id: "einsatz", art: "wahl", label: "Einsatzbedingungen (Richtwert für die Prüffrist)", hilfe: `Ohne eigenes Datum je Gerät schlägt ${MARKE.name} die nächste Prüfung aus Prüfdatum und Richtwert vor – die Frist legst du in der Gefährdungsbeurteilung fest. Eine längere Frist (bis 1 bzw. 2 Jahre) nur mit dokumentierter Fehlerquote unter 2 %.`, optionen: ELEKTRO_FRISTEN.slice(0, 4).map((o) => ({ wert: o.wert, text: o.text, quelle: o.quelle })) },
        { id: "plakette", selten: true, art: "schalter", label: "Prüfplaketten an den Geräten angebracht" },
        { id: "leerzeilen", selten: true, art: "schalter", label: "Leere Zeilen zum Ausfüllen von Hand anhängen" },
      ],
    },
    {
      titel: "Geräte",
      felder: [
        {
          id: "geraete",
          art: "liste",
          label: "Geräte",
          eintrag: "Gerät",
          titelFeld: "bezeichnung",
          felder: [
            { id: "bezeichnung", art: "text", label: "Gerät", pflicht: true, vorschlaege: GERAETE_VORSCHLAEGE, vorschlagGruppen: GERAETE_GRUPPEN },
            { id: "typ", art: "text", label: "Hersteller / Typ" },
            { id: "inventar", art: "text", label: "Inventar-Nr." },
            { id: "standort", art: "text", label: "Standort" },
            { id: "schutzklasse", art: "wahl", label: "Schutzklasse", optionen: optionen(SCHUTZKLASSE) },
            // Messwerte nach DIN EN 50678 / 50699 – wie vom Prüfgerät angezeigt, mit Einheit
            { id: "rpe", art: "text", label: "Schutzleiterwiderstand RPE (Ω)", hilfe: "z. B. 0,12", wenn: { feld: "schutzklasse", ist: ["II", "III"], nicht: true } },
            { id: "riso", art: "text", label: "Isolationswiderstand RISO (MΩ)", hilfe: "z. B. > 20" },
            { id: "ipe", art: "text", label: "Schutzleiter- bzw. Berührungsstrom IPE / IB (mA)", hilfe: "z. B. 0,05" },
            { id: "ergebnis", art: "wahl", label: "Ergebnis", optionen: optionen(ERGEBNIS), vorbelegung: "bestanden" },
            { id: "maengel", art: "text", label: "Mängel", wenn: { feld: "ergebnis", ist: "maengel" }, pflicht: true },
            { id: "naechste", art: "datum", label: "Nächste Prüfung", hilfe: "leer: Vorschlag aus Prüfdatum plus Richtwert der Einsatzbedingungen" },
          ],
        },
      ],
    },
  ],
  // E-167 (Blatt „B Vorlagen“): ein eigenes Datum „nächste Prüfung“ am oder vor dem Prüfdatum ist ein Eingabefehler
  hinweise(d) {
    const g = liste(d, "geraete").filter((x) => text(x, "bezeichnung") && text(x, "naechste") && text(d, "datum") && text(x, "naechste") <= text(d, "datum"));
    return g.length ? [`Nächste Prüfung: Bei ${g.length === 1 ? `„${text(g[0]!, "bezeichnung")}“` : `${g.length} Geräten`} liegt das Datum nicht nach dem Prüfdatum – bitte prüfen (leer lassen: Vorschlag aus dem Richtwert).`] : [];
  },
  html(d, b) {
    const g = liste(d, "geraete").filter((x) => text(x, "bezeichnung"));
    const einsatz = ELEKTRO_FRISTEN.find((o) => o.wert === text(d, "einsatz"));
    // nächste Prüfung: eigenes Datum je Gerät, sonst Prüfdatum plus Richtwert (R10)
    const richtwert = einsatz ? richtwertMonate(einsatz.text) : null;
    const naechste = (x: Eintrag) => (text(x, "naechste") ? datumDe(text(x, "naechste")) : richtwert ? plusMonate(text(d, "datum"), richtwert) : "");
    const messwert = (x: Eintrag, id: string, einheit: string) => (text(x, id) ? `${esc(text(x, id))}&nbsp;${einheit}` : "");
    const auftrag = text(d, "auftraggeber");
    return dokument({
      titel: "Prüfprotokoll elektrische Geräte",
      betrieb: b,
      quer: true,
      // ohne prüfende Person: Linie in der Kennungsleiste; ohne Geräte (Blatt zum Ausfüllen) auch Prüfgrundlage und Prüfgerät als Linie
      meta: `Prüfdatum: ${datumDe(text(d, "datum"))}\nGeprüft von: ${text(d, "pruefer") || KOPF_LINIE}\nArt der Prüfung: ${text(d, "pruefart")}`,
      inhalt:
        angaben([
          ["Auftraggeber / Prüfort", auftrag || null],
          ["Qualifikation", QUALIFIKATION[text(d, "qualifikation")] ?? (g.length ? null : "")],
          ["Umfang der Prüfung", auswahl(d, "umfang").join(", ")],
          ["Prüfgrundlage", text(d, "norm") || (g.length ? null : "")],
          ["Prüfgerät", [text(d, "messgeraet"), text(d, "kalibriert") ? `kalibriert bis ${datumDe(text(d, "kalibriert"))}` : ""].filter(Boolean).join(", ") || (g.length ? null : "")],
          ["Messverfahren", MESSVERFAHREN[text(d, "messverfahren")] ?? null],
          ["Prüfplaketten", ja(d, "plakette") ? "an den geprüften Geräten angebracht" : null],
        ]) +
        `<section class="abschnitt ohne-nummer">${tabelle(
          ["Gerät", "Hersteller / Typ, Inventar-Nr.", "Standort", "SK", "RPE", "RISO", "IPE / IB", "Ergebnis", "Nächste Prüfung"],
          g.map((x) => [
            `<strong>${zelle(text(x, "bezeichnung"))}</strong>`,
            zelle([text(x, "typ"), text(x, "inventar") ? `Inv.-Nr. ${text(x, "inventar")}` : ""].filter(Boolean).join("\n")),
            zelle(text(x, "standort")),
            esc(text(x, "schutzklasse")),
            text(x, "schutzklasse") === "II" || text(x, "schutzklasse") === "III" ? "–" : messwert(x, "rpe", "Ω"),
            messwert(x, "riso", "MΩ"),
            messwert(x, "ipe", "mA"),
            // E-167 (T-95): „Mangel – nicht verwenden“ steht im Protokoll
            text(x, "ergebnis") === "maengel" ? `<strong>Mangel – nicht verwenden:</strong> ${zelle(text(x, "maengel"))}` : "bestanden",
            naechste(x),
          ]),
          // ohne Geräte (Protokoll zum Ausfüllen von Hand) immer mit leeren Zeilen – so viele, wie mit den Unterschriften auf das Blatt passen
          { breiten: ["16%", "17%", "11%", "5%", "8%", "8%", "8%", "15%", "12%"], leerzeilen: ja(d, "leerzeilen") ? 12 : g.length ? 0 : 7, hoch: ja(d, "leerzeilen") || !g.length },
        )}</section>` +
        nachsatz(`SK = Schutzklasse; Messwerte: RPE Schutzleiterwiderstand, RISO Isolationswiderstand, IPE / IB Schutzleiter- bzw. Berührungsstrom. ${ELEKTRO_GRENZWERTE}${einsatz ? ` Prüffrist (${einsatz.quelle ?? "DGUV Vorschrift 3"}) – ${einsatz.text.replace(/\.$/, "")}; nächster Termin als Vorschlag, die Frist legt der Arbeitgeber in der Gefährdungsbeurteilung fest.` : ""}`) +
        unterschriften(["Ort, Datum", "Unterschrift der prüfenden Person"]),
    });
  },
};
