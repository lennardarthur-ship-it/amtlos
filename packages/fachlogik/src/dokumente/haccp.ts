/**
 * E-166: Kern des HACCP-Verfahrens nach Art. 5 Abs. 2 VO (EG) Nr. 852/2004 für kleine Lebensmittelbetriebe –
 * Gefahrenanalyse je Prozessschritt (Grundsatz a), Bestimmung der kritischen Kontrollpunkte mit einfacher
 * Entscheidungshilfe (b), Grenzwerte, Überwachung und Korrekturmaßnahmen (c–e), Verifizierung (f) und Dokumentation (g).
 * Dazu Hygieneplan-Zeilen für Bäckerei und Foodtruck / mobilen Verkauf.
 *
 * Quellen: Art. 5 VO (EG) Nr. 852/2004 (Wortlaut über gesetze.legal, abgerufen 22.10.2026); Bekanntmachung der Kommission
 * zur Umsetzung von Managementsystemen für Lebensmittelsicherheit (2022/C 355/01, ABl. C 355 vom 16.9.2022) – Flexibilität
 * nach Art und Größe des Betriebs, Grenzwerte „nicht in jedem Fall“ als Zahl; Entscheidungsbaum für CCP nach Codex
 * Alimentarius CXC 1-1969 (Fassung 2023, vier Fragen); Temperaturwerte BfR (Merkblatt „Sicher verpflegt“, Presseinformation
 * 05/2021: 72 °C an allen Stellen für mindestens zwei Minuten; Heißhalten mindestens 60 °C) und die Kühlwerte der
 * Lebensmittelüberwachung aus der Recherche (bausteine.ts, HACCP). Alles ist Vorschlag und fachlich zu prüfen
 * (PRUEFLISTE T-131); Werte ohne belegte Quelle tragen „üblicher Richtwert, fachlich zu prüfen“.
 */
import type { Option, Vorschlag } from "./typen.js";

export const PRUEFEN_HACCP = "fachlich zu prüfen";
export const RICHTWERT_HACCP = "üblicher Richtwert, fachlich zu prüfen";

/** Typische Prozessschritte eines kleinen Betriebs – auf dem leeren Blatt je eine Zeile der Gefahrenanalyse. */
export const PROZESSSCHRITTE = ["Wareneingang", "Lagerung gekühlt", "Lagerung tiefgekühlt", "Zubereitung", "Erhitzen", "Heißhalten", "Abkühlen", "Regenerieren", "Ausgabe"] as const;

/** Arten von Gefahren (Gefahrenanalyse). */
export const GEFAHR_ARTEN: Option[] = [
  { wert: "biologisch", text: "biologisch (Keime, Schimmel, Schädlinge)" },
  { wert: "chemisch", text: "chemisch (Reinigungsmittel, Frittierfett)" },
  { wert: "physikalisch", text: "physikalisch (Fremdkörper wie Glas, Metall, Holz)" },
  { wert: "allergene", text: "Allergene (Kreuzkontakt, falsche Auskunft)" },
];
/** Kurzform der Gefahrenart für die Tabelle. */
export const GEFAHR_KURZ: Record<string, string> = { biologisch: "biologisch", chemisch: "chemisch", physikalisch: "physikalisch", allergene: "Allergene" };

/**
 * Entscheidungshilfe für kritische Kontrollpunkte in einfachen Worten – die vier Fragen des Entscheidungsbaums nach
 * Codex Alimentarius CXC 1-1969 (Fassung 2023), der Reihe nach je Gefahr und Prozessschritt.
 */
export const CCP_FRAGEN = [
  "Lässt sich die Gefahr in diesem Schritt schon mit der Basishygiene (gute Hygienepraxis: Reinigung, Personalhygiene, Kühlung nach Plan) sicher beherrschen? Ja: kein CCP.",
  "Gibt es in diesem Schritt eine gezielte Maßnahme gegen diese Gefahr? Nein: kein CCP – prüfe die folgenden Schritte.",
  "Beseitigt ein späterer Schritt die Gefahr oder senkt er sie auf ein unbedenkliches Maß (z. B. späteres Erhitzen)? Ja: kein CCP hier – der spätere Schritt ist der CCP.",
  "Beseitigt dieser Schritt selbst die Gefahr oder senkt er sie auf ein unbedenkliches Maß? Ja: CCP. Nein: Ablauf oder Rezept ändern und neu bewerten.",
];
export const CCP_FRAGEN_QUELLE = "Entscheidungsbaum nach Codex Alimentarius CXC 1-1969 (Fassung 2023), in einfachen Worten";
/** Begründung der CCP-Entscheidung zum Antippen. */
export const CCP_BEGRUENDUNG = [
  "Frage 1: mit der Basishygiene beherrscht – kein CCP",
  "Frage 2: keine gezielte Maßnahme in diesem Schritt – kein CCP",
  "Frage 3: ein späterer Schritt beseitigt die Gefahr – kein CCP",
  "Frage 4: dieser Schritt beseitigt die Gefahr – CCP",
];

/** Hinweis zur Flexibilität für kleine Betriebe (Hilfetext und Fußtext). */
export const HACCP_FLEXIBEL =
  "Kleine Betriebe dürfen das Verfahren einfach halten: Dokumente und Aufzeichnungen müssen der Art und Größe des Betriebs angemessen sein (Art. 5 Abs. 2 Buchst. g VO (EG) Nr. 852/2004); wo die Gefahrenanalyse keinen CCP ergibt, genügt die gute Hygienepraxis (Bekanntmachung der Kommission 2022/C 355/01). Leitlinien für eine gute Hygienepraxis deiner Branche helfen dabei.";

/** Aufbewahrung (Grundsatz g): die Verordnung nennt keine feste Dauer. */
export const HACCP_AUFBEWAHRUNG = "für einen angemessenen Zeitraum (Art. 5 Abs. 4 Buchst. c VO (EG) Nr. 852/2004) – Dauer mit der Lebensmittelüberwachung abstimmen";

const GASTRO = "Gastronomie / Café";
const BAECKEREI = "Bäckerei";
const MOBIL = "Foodtruck / mobiler Verkauf";
const QUELLE_GA = `Art. 5 Abs. 2 Buchst. a, b VO (EG) Nr. 852/2004 – Vorschlag, ${PRUEFEN_HACCP}`;

const ga = (gruppe: string, schritt: string, arten: string[], gefahr: string, lenkung: string, ccp: "ja" | "nein", begruendung: string): Vorschlag => ({
  gruppe,
  titel: schritt,
  werte: { schritt, arten, gefahr, lenkung, ccp, begruendung },
  quelle: QUELLE_GA,
});

/** Gefahrenanalyse: je Prozessschritt Gefahr, Lenkungsmaßnahme und CCP-Entscheidung – Vorschläge je Branchengruppe. */
export const GEFAHRENANALYSE: Vorschlag[] = [
  ga(GASTRO, "Wareneingang", ["biologisch", "physikalisch", "allergene"], "Keime in verdorbener oder zu warm gelieferter Ware; Fremdkörper und Schädlinge in beschädigter Verpackung; fehlende oder falsche Allergenkennzeichnung", "Ware bei Annahme prüfen: Temperatur gekühlter und tiefgekühlter Ware, Verpackung, Kennzeichnung, Mindesthaltbarkeits- und Verbrauchsdatum; Mängel zurückweisen; Kühlware sofort einräumen; Lieferschein aufbewahren", "nein", CCP_BEGRUENDUNG[0]!),
  ga(GASTRO, "Lagerung gekühlt", ["biologisch", "allergene"], "Vermehrung von Keimen bei zu hoher Temperatur; Übertragung von Keimen von roher auf verzehrfertige Ware; Kreuzkontakt mit Allergenen in offenen Behältern", "Kühltemperatur messen und eintragen; Rohes unten und abgedeckt lagern; zuerst verbrauchen, was zuerst abläuft; Verbrauchsdatum beachten", "ja", CCP_BEGRUENDUNG[3]!),
  ga(GASTRO, "Lagerung tiefgekühlt", ["biologisch"], "Antauen bei Ausfall des Geräts oder offen stehender Tür; Keimvermehrung nach dem Auftauen", "Temperatur messen und eintragen; Ware verpackt und beschriftet lagern; im Kühlschrank auftauen, Auftauwasser verwerfen, nicht wieder einfrieren", "nein", CCP_BEGRUENDUNG[0]!),
  ga(GASTRO, "Zubereitung", ["biologisch", "physikalisch", "allergene"], "Übertragung von Keimen über Hände, Bretter und Messer (rohes Geflügel, Fleisch, Eier auf verzehrfertige Speisen); Fremdkörper (Glas, Schmuck, Verpackungsreste); Kreuzkontakt mit Allergenen", "Händewaschen; Trennung rein/unrein, Schneidbretter nach Farben; Flächen nach rohem Fleisch, Geflügel, Fisch oder Eiern sofort reinigen und desinfizieren; Rezepturen mit Allergenen festhalten; kein Glas über offenen Lebensmitteln", "nein", CCP_BEGRUENDUNG[0]!),
  ga(GASTRO, "Erhitzen", ["biologisch"], "Krankheitserreger (z. B. Salmonellen, Campylobacter) überleben bei zu geringer Kerntemperatur", "Kerntemperatur mit Einstichthermometer messen und eintragen", "ja", CCP_BEGRUENDUNG[3]!),
  ga(GASTRO, "Heißhalten", ["biologisch"], "Sporen (z. B. Bacillus cereus) keimen aus und Keime vermehren sich, wenn Speisen zu kühl warmgehalten werden", "Temperatur der Speisen in der Warmhaltetheke messen; Heißhaltezeit begrenzen; Reste nicht erneut warmhalten", "ja", CCP_BEGRUENDUNG[3]!),
  ga(GASTRO, "Abkühlen", ["biologisch"], "Sporenbildner (z. B. Clostridium perfringens) vermehren sich, wenn große Mengen langsam abkühlen", "In flachen Behältern und kleinen Mengen abkühlen, z. B. im Kaltwasserbad; Temperatur und Uhrzeit messen und eintragen", "ja", CCP_BEGRUENDUNG[3]!),
  ga(GASTRO, "Regenerieren", ["biologisch"], "Keime überleben oder vermehren sich, wenn vorgegarte Speisen nicht ausreichend wieder erhitzt werden", "Speisen zügig und an allen Stellen durcherhitzen; Kerntemperatur messen und eintragen; nur einmal regenerieren", "ja", CCP_BEGRUENDUNG[3]!),
  ga(GASTRO, "Ausgabe", ["biologisch", "allergene"], "Keimvermehrung bei zu langer Standzeit ohne Kühlung; Verunreinigung durch Gäste an offener Ware; falsche Auskunft zu Allergenen", "Kaltspeisen gekühlt ausgeben, Standzeit begrenzen; Spuckschutz bzw. Abdeckung; Vorlegebesteck je Speise; Allergenliste aktuell halten", "nein", CCP_BEGRUENDUNG[0]!),
  ga(BAECKEREI, "Wareneingang Rohstoffe (Mehl, Eier, Milchprodukte)", ["biologisch", "physikalisch", "allergene"], "Schädlinge (z. B. Motten, Käfer) in Mehl und trockenen Zutaten; Keime in zu warm gelieferten Eiern und Milchprodukten; Fremdkörper; falsch gekennzeichnete Zutaten mit Allergenen", "Säcke und Verpackungen auf Befall und Schäden prüfen; Temperatur gekühlter Ware messen; Kennzeichnung und Zutatenlisten prüfen; Lieferschein aufbewahren", "nein", CCP_BEGRUENDUNG[0]!),
  ga(BAECKEREI, "Lagerung Mehl und trockene Zutaten", ["biologisch", "allergene"], "Befall durch Schädlinge; Schimmel bei Feuchtigkeit; Kreuzkontakt (z. B. Nüsse, Sesam, Soja)", "Trocken, verschlossen und vom Boden abgehoben lagern; Schädlingsmonitoring; Zutaten mit Allergenen getrennt und beschriftet lagern", "nein", CCP_BEGRUENDUNG[0]!),
  ga(BAECKEREI, "Backen", ["physikalisch"], "Fremdkörper (z. B. Teile von Blechen, Stikkenwagen oder Holz); nicht durchgebackene Ware", "Bleche und Formen vor Gebrauch auf Schäden prüfen; Backzeit und -temperatur nach Rezeptur einhalten; Sichtkontrolle", "nein", CCP_BEGRUENDUNG[0]!),
  ga(BAECKEREI, "Füllen und Garnieren (Sahne, Creme)", ["biologisch", "allergene"], "Keime aus Sahneautomat, Spritzbeuteln und Händen in nicht durcherhitzte Füllungen; Kreuzkontakt mit Allergenen", "Sahneautomat nach Herstellerangabe täglich reinigen; Einweg-Spritzbeutel; Füllungen gekühlt halten und rasch verarbeiten; Rezepturen mit Allergenen festhalten", "nein", CCP_BEGRUENDUNG[2]!),
  ga(BAECKEREI, "Erhitzen von Cremes und Füllungen", ["biologisch"], "Krankheitserreger aus Eiern und Milch überleben, wenn Vanille- oder Konditorcreme nicht ausreichend erhitzt wird", "Creme unter Rühren durcherhitzen; Temperatur messen und eintragen; danach rasch abkühlen und gekühlt lagern", "ja", CCP_BEGRUENDUNG[3]!),
  ga(BAECKEREI, "Kühllagerung Konditoreiwaren", ["biologisch"], "Keimvermehrung in Torten und Gebäck mit nicht durcherhitzter Füllung oder Auflage bei zu hoher Temperatur", "Kühltemperatur in Kühlraum und Kühltheke messen und eintragen; Ware mit Datum versehen", "ja", CCP_BEGRUENDUNG[3]!),
  ga(BAECKEREI, "Verkauf unverpackter Backwaren", ["biologisch", "allergene"], "Verunreinigung durch Anfassen, Husten oder Niesen an offener Ware; falsche Auskunft zu Allergenen", "Zange oder Handschuh, Spuckschutz bzw. Abdeckung; Geld nicht mit derselben Hand wie die Ware anfassen; Allergenliste an der Theke", "nein", CCP_BEGRUENDUNG[0]!),
  ga(MOBIL, "Transport und Kühlung unterwegs", ["biologisch"], "Keimvermehrung, wenn die Kühlung auf der Fahrt oder am Stand nicht reicht (Hitze, lange Standzeit, Stromausfall)", "Kühlgeräte im Fahrzeug bzw. Kühlboxen mit Kühlakkus; Temperatur bei Abfahrt und am Stand messen und eintragen; nur so viel mitnehmen wie nötig", "ja", CCP_BEGRUENDUNG[3]!),
  ga(MOBIL, "Wasser aus dem Fahrzeugtank", ["biologisch"], "Verkeimtes Wasser aus Tank, Leitungen oder Schläuchen", "Nur Trinkwasser einfüllen, Schläuche für Trinkwasser verwenden und sauber lagern; Tank nach Herstellerangabe reinigen und desinfizieren; Vorgaben des Gesundheitsamts (Anzeige, Untersuchung) einhalten", "nein", CCP_BEGRUENDUNG[0]!),
  ga(MOBIL, "Zubereitung im Fahrzeug", ["biologisch", "allergene"], "Übertragung von Keimen auf engem Raum (Hände, Flächen, rohe und verzehrfertige Ware nah beieinander); Kreuzkontakt mit Allergenen", "Handwaschbecken mit fließendem Wasser, Seife und Einmalhandtüchern nutzen; rohe und verzehrfertige Ware getrennt; Flächen zwischendurch reinigen", "nein", CCP_BEGRUENDUNG[0]!),
  ga(MOBIL, "Erhitzen am Stand", ["biologisch"], "Krankheitserreger überleben bei zu geringer Kerntemperatur (z. B. Bratwurst, Burger, Geflügel)", "Kerntemperatur stichprobenartig mit Einstichthermometer messen und eintragen", "ja", CCP_BEGRUENDUNG[3]!),
  ga(MOBIL, "Heißhalten am Stand", ["biologisch"], "Keimvermehrung, wenn Speisen zu kühl warmgehalten werden", "Temperatur der warmgehaltenen Speisen messen; Heißhaltezeit begrenzen; Reste am Ende des Tages entsorgen", "ja", CCP_BEGRUENDUNG[3]!),
  ga(MOBIL, "Ausgabe am Stand", ["biologisch", "physikalisch", "allergene"], "Verunreinigung durch Staub, Insekten und Kundschaft an offener Ware; falsche Auskunft zu Allergenen", "Ware abdecken, Spuckschutz; Geld und Ware getrennt anfassen; Allergeninformation am Stand", "nein", CCP_BEGRUENDUNG[0]!),
];

const QUELLE_KUEHL = "Lebensmittelüberwachung Mainz; LAVES Niedersachsen (Recherche, Kontrollpunkte der Eigenkontrollen)";
const QUELLE_ERHITZEN = "BfR, Merkblatt „Sicher verpflegt“ (Presseinformation 05/2021): 72 °C an allen Stellen für mindestens zwei Minuten";
const QUELLE_HEISS = "BfR (Presseinformation 05/2021; Merkblatt Heißhalten 2020): mindestens 60 °C an allen Stellen";
const KERN = "an allen Stellen (Kern) mindestens +72 °C für mindestens 2 Minuten";

const ccp = (gruppe: string, schritt: string, gefahr: string, grenzwert: string, ueberwachung: string, wer: string, wann: string, korrektur: string, quelle: string): Vorschlag => ({
  gruppe,
  titel: schritt,
  werte: { schritt, gefahr, grenzwert, ueberwachung, wer, wann, korrektur },
  quelle: `${quelle} – ${PRUEFEN_HACCP}`,
});

/** Kritische Kontrollpunkte (Grundsätze c–e): Grenzwert, Überwachung (wie, wer, wie oft) und Korrekturmaßnahme. */
export const CCP_VORSCHLAEGE: Vorschlag[] = [
  ccp(GASTRO, "Erhitzen – Kerntemperatur", "Krankheitserreger überleben", KERN, "Einstichthermometer in die dickste Stelle", "Koch / Köchin", "bei jeder Charge bzw. stichprobenartig je Gericht (" + RICHTWERT_HACCP + ")", "Weiter erhitzen, bis der Grenzwert erreicht ist; erneut messen; eintragen", QUELLE_ERHITZEN),
  ccp(GASTRO, "Heißhalten", "Auskeimen von Sporen, Keimvermehrung", "mindestens +60 °C an allen Stellen (teils werden mind. +65 °C angegeben, siehe Eigenkontrollen)", "Thermometer in die Speise", "Beschäftigte an der Ausgabe", "bei Beginn der Ausgabe und stichprobenartig während der Ausgabe (" + RICHTWERT_HACCP + ")", "Unter +60 °C: Speise sofort wieder auf Kerntemperatur erhitzen oder entsorgen; Gerät prüfen; eintragen", QUELLE_HEISS),
  ccp(GASTRO, "Abkühlen", "Vermehrung von Sporenbildnern", "von +65 °C auf +10 °C innerhalb von 3 Stunden", "Thermometer, Uhrzeit bei Beginn und Ende", "Koch / Köchin", "bei jedem Abkühlvorgang", "Grenzwert verfehlt: Speise entsorgen; künftig kleinere Mengen, flachere Behälter oder Kaltwasserbad", "BgVV-Temperaturempfehlungen (Recherche, Kontrollpunkt „Abkühlen heißer Speisen“)"),
  ccp(GASTRO, "Lagerung gekühlt – Kühltemperatur", "Keimvermehrung in leicht verderblichen Lebensmitteln", "Kühlschrank höchstens +7 °C; strengere Werte je Ware (z. B. Hackfleisch, Geflügel, Fisch) siehe Kontrollpunkte der Eigenkontrollen", "Thermometer im Gerät ablesen", "Beschäftigte", "täglich zu Arbeitsbeginn", "Ursache beheben (Tür, Thermostat), Ware bewerten und ggf. entsorgen; nachmessen; eintragen", QUELLE_KUEHL),
  ccp(GASTRO, "Regenerieren", "Keime überleben", `${KERN} (Wert für das Garen, für das Regenerieren übertragen – ${PRUEFEN_HACCP})`, "Einstichthermometer", "Koch / Köchin", "bei jeder Charge", "Weiter erhitzen, bis der Grenzwert erreicht ist; Speise nicht ein zweites Mal regenerieren; eintragen", QUELLE_ERHITZEN),
  ccp(BAECKEREI, "Kühllagerung Konditoreiwaren", "Keimvermehrung in nicht durcherhitzten Füllungen", "höchstens +7 °C", "Thermometer in Kühlraum und Kühltheke", "Beschäftigte in Backstube und Verkauf", "täglich zu Arbeitsbeginn und bei Schichtwechsel (" + RICHTWERT_HACCP + ")", "Ursache beheben; betroffene Torten und Teilchen bewerten und ggf. entsorgen; eintragen", "Kontrollpunkt „Kühlung feine Backwaren / Konditorwaren“, " + QUELLE_KUEHL),
  ccp(BAECKEREI, "Erhitzen von Cremes und Füllungen", "Krankheitserreger überleben (z. B. aus Eiern, Milch)", KERN, "Einstichthermometer bzw. Thermometer im Kochkessel", "Konditor / Konditorin", "bei jeder Charge", "Weiter erhitzen, bis der Grenzwert erreicht ist; erneut messen; eintragen", QUELLE_ERHITZEN + " (für Cremes übertragen)"),
  ccp(MOBIL, "Transport und Kühlung unterwegs", "Keimvermehrung auf der Fahrt und am Stand", "höchstens +7 °C; strengere Werte je Ware siehe Kontrollpunkte der Eigenkontrollen", "Thermometer in Kühlgerät bzw. Kühlbox", "Fahrer/in bzw. Standbetreiber/in", "bei Abfahrt, bei Ankunft am Standplatz und mehrmals während des Verkaufs (" + RICHTWERT_HACCP + ")", "Ware bewerten und ggf. entsorgen; Kühlakkus tauschen bzw. Gerät prüfen; eintragen", QUELLE_KUEHL),
  ccp(MOBIL, "Erhitzen am Stand – Kerntemperatur", "Krankheitserreger überleben", KERN, "Einstichthermometer in die dickste Stelle", "Standbetreiber/in", "stichprobenartig je Produkt und Verkaufstag (" + RICHTWERT_HACCP + ")", "Weiter erhitzen, bis der Grenzwert erreicht ist; erneut messen; eintragen", QUELLE_ERHITZEN),
  ccp(MOBIL, "Heißhalten am Stand", "Keimvermehrung", "mindestens +60 °C an allen Stellen", "Thermometer in die Speise", "Standbetreiber/in", "bei Verkaufsbeginn und stichprobenartig (" + RICHTWERT_HACCP + ")", "Unter +60 °C: sofort wieder erhitzen oder entsorgen; eintragen", QUELLE_HEISS),
];

/** Verifizierung (Grundsatz f): regelmäßig prüfen, ob das Verfahren wirkt. */
export const VERIFIZIERUNG: Option[] = [
  { wert: "protokolle_durchsehen", text: "Messprotokolle und Monatsraster regelmäßig durchsehen und abzeichnen (z. B. wöchentlich – " + RICHTWERT_HACCP + ")", quelle: "Art. 5 Abs. 2 Buchst. f VO (EG) Nr. 852/2004" },
  { wert: "thermometer", text: "Thermometer regelmäßig auf Genauigkeit prüfen, z. B. im Vergleich mit einem zweiten Thermometer", quelle: PRUEFEN_HACCP },
  { wert: "abweichungen", text: "Abweichungen und Korrekturmaßnahmen auswerten: Wiederholt sich eine Abweichung, Ursache beheben und das Verfahren anpassen", quelle: "Art. 5 Abs. 2 Buchst. e, f VO (EG) Nr. 852/2004" },
  { wert: "aenderungen", text: "Gefahrenanalyse und CCP überprüfen, sobald sich Produkte, Abläufe, Geräte oder Lieferanten ändern", quelle: "Art. 5 Abs. 2 Unterabs. 2 VO (EG) Nr. 852/2004" },
  { wert: "regelmaessig", text: "Das ganze Verfahren zusätzlich regelmäßig überprüfen (z. B. jährlich – " + RICHTWERT_HACCP + ")", quelle: PRUEFEN_HACCP },
  { wert: "kontrollen", text: "Ergebnisse amtlicher Kontrollen, Beschwerden und Laborbefunde (z. B. Abklatschproben von Flächen) auswerten", quelle: "Bekanntmachung 2022/C 355/01 (Oberflächenuntersuchung als Beispiel der Verifizierung) – " + PRUEFEN_HACCP },
];

/** Dokumentation (Grundsatz g): welche Aufzeichnungen der Betrieb führt. */
export const AUFZEICHNUNGEN: Option[] = [
  { wert: "konzept", text: "Gefahrenanalyse und Festlegung der CCP (dieses Dokument), bei Änderungen auf neuestem Stand", quelle: "Art. 5 Abs. 4 Buchst. b VO (EG) Nr. 852/2004" },
  { wert: "messungen", text: "Messprotokolle bzw. Monatsraster der Kontrollpunkte mit Korrekturmaßnahmen", quelle: "Art. 5 Abs. 2 Buchst. d, e, g VO (EG) Nr. 852/2004" },
  { wert: "wareneingang", text: "Wareneingangskontrollen, Lieferscheine und Rechnungen (auch für die Rückverfolgbarkeit)", quelle: "Art. 18 VO (EG) Nr. 178/2002" },
  { wert: "reinigung", text: "Hygieneplan (Reinigung und Desinfektion) mit Nachweisen", quelle: "Anhang II VO (EG) Nr. 852/2004" },
  { wert: "schulung", text: "Nachweise über Hygieneschulung und Belehrung", quelle: "§ 4 LMHV; § 43 IfSG" },
  { wert: "schaedlinge", text: "Schädlingsmonitoring und Berichte des Fachbetriebs", quelle: "Anhang II Kap. IX Nr. 4 VO (EG) Nr. 852/2004" },
  { wert: "wasser", text: "Foodtruck mit Wassertank: Anzeige beim Gesundheitsamt, Untersuchungsbefunde, Reinigung des Tanks", quelle: "§ 11 Abs. 2 TrinkwV – " + PRUEFEN_HACCP },
];

const PRUEFEN_LM = "fachlich zu prüfen";
const RICHTWERT = "üblicher Richtwert, fachlich zu prüfen";
const zeile = (gruppe: string, thema: string, was: string, wann: string, womit: string, wie: string, wer: string, quelle: string): Vorschlag => ({
  gruppe,
  titel: was,
  werte: { thema, was, wann, womit, wie, wer },
  quelle: `${quelle} – ${PRUEFEN_LM}`,
});

/** Hygieneplan Lebensmittelbetrieb: Zeilen für die Bäckerei (Backstube und Verkauf). */
export const HYGIENE_BAECKEREI: Vorschlag[] = [
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Teig- und Knetmaschinen, Ausrollmaschine", "nach Gebrauch, mindestens täglich", "Spachtel, Reinigungsmittel; Desinfektionsmittel für Lebensmittelbereiche", "Maschine ausschalten und gegen Wiedereinschalten sichern; Teigreste trocken entfernen, reinigen, trocknen lassen", "Beschäftigte Backstube", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Sahneautomat, Spritzbeutel und Tüllen", "nach Gebrauch, mindestens täglich (Sahneautomat nach Herstellerangabe)", "Reinigungsmittel, Desinfektionsmittel; Einweg-Spritzbeutel", "zerlegen, reinigen, desinfizieren, trocken lagern; Einweg-Spritzbeutel nur einmal verwenden", "Beschäftigte Konditorei", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Gärschränke, Bleche, Backformen, Stikkenwagen", "Gärschränke wöchentlich; Bleche und Formen nach Bedarf, bei Verschmutzung sofort", "Reinigungsmittel, Spachtel", "Teig- und Mehlreste entfernen, Feuchtigkeit vermeiden (Schimmel); beschädigte Bleche aussortieren", "Beschäftigte Backstube", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Brotschneidemaschine und Theke", "nach Gebrauch und zum Arbeitsende", "Reinigungsmittel, Desinfektionsmittel", "vom Strom trennen, Krümel entfernen, Messerbereich nur mit Schutzhandschuh reinigen; Thekenflächen reinigen", "Beschäftigte Verkauf", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Schädlingsbekämpfung", "Mehllager und trockene Zutaten", "täglich Sichtkontrolle; Monitoringstellen nach Plan", "Pheromon- bzw. Klebefallen für Vorratsschädlinge, Lageplan", "Säcke vom Boden abgehoben und von der Wand entfernt lagern; auf Motten, Käfer und Gespinste achten; Befall sofort melden, Fachbetrieb beauftragen", "verantwortliche Person", "Anhang II Kap. IX Nr. 4 VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Temperaturkontrollen", "Kühlraum und Kühltheke für Konditoreiwaren", "täglich zu Arbeitsbeginn", "Thermometer; Messprotokoll der Eigenkontrollen (HACCP)", "höchstens +7 °C für Ware mit nicht durcherhitzter Füllung (" + RICHTWERT + "); bei Abweichung Ursache beheben, Ware bewerten, eintragen", "Beschäftigte", "Anhang II Kap. IX Nr. 5 VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Trennung rein/unrein", "Zutaten mit Allergenen (z. B. Nüsse, Sesam, Soja)", "ständig", "beschriftete, verschlossene Behälter; eigene Schaufeln", "getrennt lagern; Rezepturen mit Allergenen festhalten; nach Ware mit Nüssen oder Sesam Geräte reinigen, bevor andere Ware folgt", "alle", "Anhang II Kap. IX Nr. 3 VO (EG) Nr. 852/2004; Art. 44 LMIV"),
  zeile(BAECKEREI, "Personalhygiene", "Verkauf unverpackter Backwaren", "bei jedem Verkauf", "Zange, Einmalhandschuhe, Spuckschutz", "Ware nicht mit der bloßen Hand anfassen; Geld und Ware getrennt anfassen oder Handschuh wechseln; Spuckschutz geschlossen halten", "Beschäftigte Verkauf", "Anhang II Kap. VIII, Kap. IX Nr. 3 VO (EG) Nr. 852/2004"),
];

/** Hygieneplan Lebensmittelbetrieb: Zeilen für Foodtruck und mobilen Verkauf (Anhang II Kap. III VO (EG) Nr. 852/2004). */
export const HYGIENE_FOODTRUCK: Vorschlag[] = [
  zeile(MOBIL, "Trinkwasser", "Wassertank und Schläuche im Fahrzeug", "Tank vor Saisonbeginn und nach Standzeiten reinigen und desinfizieren, nach Herstellerangabe; Wasser täglich frisch", "Trinkwasser; Schläuche und Anschlüsse für Trinkwasser (z. B. nach DVGW W 270 / KTW-BWGL); Reinigungs- und Desinfektionsmittel für Trinkwasseranlagen", "nur Trinkwasser einfüllen; Schläuche sauber, trocken und nicht auf dem Boden lagern; Anschlüsse vor dem Anschließen reinigen; Inbetriebnahme dem Gesundheitsamt anzeigen und Untersuchungen nach dessen Vorgabe machen lassen", "verantwortliche Person", "Anhang II Kap. III Nr. 2 Buchst. e, Kap. VII VO (EG) Nr. 852/2004; § 11 Abs. 2 TrinkwV; Merkblatt Gesundheitsamt Dortmund"),
  zeile(MOBIL, "Personalhygiene", "Handwaschgelegenheit im Fahrzeug", "vor Arbeitsbeginn, nach Pausen und Toilettengang, nach rohem Fleisch oder Geflügel, nach Geld und Abfall", "Handwaschbecken mit fließendem warmem und kaltem Wasser, Flüssigseife, Einmalhandtücher", "gründlich waschen und mit Einmalhandtuch abtrocknen; Becken nur zum Händewaschen nutzen", "alle", "Anhang II Kap. III Nr. 2 Buchst. a VO (EG) Nr. 852/2004"),
  zeile(MOBIL, "Temperaturkontrollen", "Kühlung unterwegs", "bei Abfahrt, bei Ankunft am Standplatz und mehrmals während des Verkaufs", "Kühlgerät im Fahrzeug oder Kühlboxen mit Kühlakkus; Thermometer; Messprotokoll der Eigenkontrollen (HACCP)", "höchstens +7 °C (" + RICHTWERT + "; strengere Werte je Ware nach Herstellerangabe); Kühlkette nicht unterbrechen; bei Abweichung Ware bewerten, eintragen", "Fahrer/in bzw. Standbetreiber/in", "Anhang II Kap. III Nr. 2 Buchst. g, Kap. IX Nr. 5 VO (EG) Nr. 852/2004"),
  zeile(MOBIL, "Abfall", "Abfall und Abwasser", "laufend; Abwassertank und Abfall am Ende jedes Verkaufstags", "verschließbare Abfallbehälter; Abwassertank bzw. Auffangbehälter", "Abfall und Abwasser getrennt von Lebensmitteln sammeln; Abwasser nur an zugelassenen Stellen ablassen, nicht in Gully oder Grünfläche; Fett gesondert entsorgen", "Standbetreiber/in", "Anhang II Kap. III Nr. 2 Buchst. f, Kap. VI VO (EG) Nr. 852/2004"),
  zeile(MOBIL, "Reinigung und Desinfektion", "Standplatzwechsel und Fahrt", "vor der Fahrt und nach dem Aufbau am neuen Standplatz", "Reinigungs- und Desinfektionsmittel, Abdeckungen", "Lebensmittel und Geräte für die Fahrt sichern und abdecken; nach dem Aufbau Arbeitsflächen reinigen; Untergrund und Umgebung auf Schmutz und Schädlinge prüfen; Wasser- und Stromanschluss prüfen", "Standbetreiber/in", "Anhang II Kap. III Nr. 1, Nr. 2 Buchst. b, h VO (EG) Nr. 852/2004"),
];
