/**
 * E-166: Kern des HACCP-Verfahrens nach Art. 5 Abs. 2 VO (EG) Nr. 852/2004 für kleine Lebensmittelbetriebe –
 * Gefahrenanalyse je Prozessschritt (Grundsatz a), Bestimmung der kritischen Kontrollpunkte mit einfacher
 * Entscheidungshilfe (b), Grenzwerte, Überwachung und Korrekturmaßnahmen (c–e), Verifizierung (f) und Dokumentation (g).
 * Dazu Hygieneplan-Zeilen für Bäckerei und Foodtruck / mobilen Verkauf.
 *
 * Quellen: Art. 5 VO (EG) Nr. 852/2004 (Wortlaut über gesetze.legal, abgerufen 22.10.2026); Bekanntmachung der Kommission
 * zur Umsetzung von Managementsystemen für Lebensmittelsicherheit (2022/C 355/01, ABl. C 355 vom 16.9.2022) – Flexibilität
 * nach Art und Größe des Betriebs, Temperaturkontrolle als gute Hygienepraxis (Anhang I Nr. 3.12); Entscheidungsbaum für
 * CCP nach Codex Alimentarius CXC 1-1969 (Rev. 2020), Diagramm 2; Temperaturwerte BfR (Presseinformation 13/2024 „Sicher
 * verpflegt“: 72 °C an allen Stellen für mindestens zwei Minuten; Stellungnahme 037/2020: Heißhalten mindestens 60 °C)
 * und die Kühlwerte der Lebensmittelüberwachung aus der Recherche (bausteine.ts, HACCP).
 *
 * Prüfbericht Lebensmittelhygiene (Tim Baum, 22.10.2026, docs/pruefberichte/2026-10-22-lebensmittelhygiene-baum.txt):
 * Kühlen und Kühllagern sind keine CCP, sondern Kontrollpunkte der guten Hygienepraxis (L-022, L-035, L-037; in der
 * CCP-Tabelle als „Kontrollpunkt (GHP)“ gekennzeichnet), je Kontrollpunkt ein Grenzwert, Quellen aktualisiert. Wo der
 * Bericht einen Baustein bestätigt (✔) oder die Änderung (✎) umgesetzt ist, entfällt die Markierung „fachlich zu prüfen“;
 * die übrigen behalten sie (PRUEFLISTE T-131).
 */
import type { Option, Vorschlag } from "./typen.js";

export const PRUEFEN_HACCP = "fachlich zu prüfen";
export const RICHTWERT_HACCP = "üblicher Richtwert, fachlich zu prüfen";

/** Typische Prozessschritte eines kleinen Betriebs – auf dem leeren Blatt je eine Zeile der Gefahrenanalyse. */
export const PROZESSSCHRITTE = ["Wareneingang", "Lagerung gekühlt", "Lagerung tiefgekühlt", "Zubereitung", "Erhitzen", "Heißhalten", "Abkühlen", "Regenerieren", "Ausgabe"] as const;

/** Arten von Gefahren (Gefahrenanalyse). */
export const GEFAHR_ARTEN: Option[] = [
  { wert: "biologisch", text: "biologisch (Keime, Schimmel, Schädlinge)" },
  { wert: "chemisch", text: "chemisch (Reinigungsmittel, Frittierfett, Acrylamid)" },
  { wert: "physikalisch", text: "physikalisch (Fremdkörper wie Glas, Metall, Holz)" },
  { wert: "allergene", text: "Allergene (Kreuzkontakt, falsche Auskunft)" },
];
/** Kurzform der Gefahrenart für die Tabelle. */
export const GEFAHR_KURZ: Record<string, string> = { biologisch: "biologisch", chemisch: "chemisch", physikalisch: "physikalisch", allergene: "Allergene" };

/**
 * Entscheidungshilfe für kritische Kontrollpunkte in einfachen Worten – die vier Fragen des Entscheidungsbaums nach
 * Codex Alimentarius CXC 1-1969 (Rev. 2020), Diagramm 2, der Reihe nach je Gefahr und Prozessschritt. Frage 4 nach dem
 * Prüfbericht Lebensmittelhygiene (L-043–L-046): „oder hält er sie sicher auf einem unbedenklichen Maß“.
 */
export const CCP_FRAGEN = [
  "Lässt sich die Gefahr in diesem Schritt schon mit der Basishygiene (gute Hygienepraxis: Reinigung, Personalhygiene, Kühlung nach Plan) sicher beherrschen? Ja: kein CCP.",
  "Gibt es in diesem Schritt eine gezielte Maßnahme gegen diese Gefahr? Nein: kein CCP – prüfe die folgenden Schritte.",
  "Beseitigt ein späterer Schritt die Gefahr oder senkt er sie auf ein unbedenkliches Maß (z. B. späteres Erhitzen)? Ja: kein CCP hier – der spätere Schritt ist der CCP.",
  "Beseitigt dieser Schritt die Gefahr oder hält er sie sicher auf einem unbedenklichen Maß (z. B. Kerntemperatur, Heißhaltetemperatur)? Ja: CCP. Nein: Ablauf oder Rezept ändern und neu bewerten.",
];
export const CCP_FRAGEN_QUELLE = "Entscheidungsbaum nach Codex Alimentarius CXC 1-1969 (Rev. 2020), Diagramm 2, in einfachen Worten";
/** Hinweis unter der Entscheidungshilfe (Prüfbericht Lebensmittelhygiene, Frage 1). */
export const CCP_HINWEIS = "In kleinen Betrieben ergeben sich meist nur 2–4 CCP – typischerweise Erhitzen, Heißhalten, Abkühlen.";
/**
 * Begründung der CCP-Entscheidung zum Antippen (Quelle: CCP_FRAGEN_QUELLE). Prüfbericht Lebensmittelhygiene: Kühlen ist
 * kein CCP, sondern ein Kontrollpunkt der guten Hygienepraxis mit Aufzeichnung (zweiter Eintrag).
 */
export const CCP_BEGRUENDUNG = [
  "Frage 1: mit der Basishygiene beherrscht – kein CCP",
  "Frage 1: mit der Basishygiene beherrscht – Kontrollpunkt mit Aufzeichnung",
  "Frage 2: keine gezielte Maßnahme in diesem Schritt – kein CCP",
  "Frage 3: ein späterer Schritt beseitigt die Gefahr – kein CCP",
  "Frage 4: dieser Schritt beseitigt die Gefahr oder hält sie sicher auf einem unbedenklichen Maß – CCP",
];
const [BASIS, KONTROLLPUNKT, , , CCP] = CCP_BEGRUENDUNG as [string, string, string, string, string];

/**
 * Einstufung einer Zeile der CCP-Tabelle (Prüfbericht Lebensmittelhygiene, L-022, L-035, L-037): Kühlzeilen bleiben in der
 * Tabelle, sind aber Kontrollpunkte der guten Hygienepraxis. Ohne Angabe (frühere Einträge) gilt die Zeile als CCP.
 */
export const CCP_EINSTUFUNG: Option[] = [
  { wert: "ccp", text: "kritischer Kontrollpunkt (CCP)" },
  { wert: "ghp", text: "Kontrollpunkt (GHP) – gute Hygienepraxis mit Aufzeichnung" },
];
export const GHP_KURZ = "Kontrollpunkt (GHP)";
export const GHP_HINWEIS =
  "„Kontrollpunkt (GHP)“: kein kritischer Kontrollpunkt, sondern eine Temperaturkontrolle der guten Hygienepraxis (Bekanntmachung der Kommission 2022/C 355/01, Anhang I Nr. 3.12) – gemessen und aufgezeichnet wird wie bei einem CCP.";

/** Hilfetext zum Grenzwert: ein Wert je Kontrollpunkt, Sollwerte nur als Hinweis (Prüfbericht Lebensmittelhygiene). */
export const GRENZWERT_HILFE =
  "Je Kontrollpunkt ein Grenzwert. Kühlgeräte: Grenzwert höchstens +7 °C, eingestellt wird ein Sollwert von +2 bis +5 °C. Heißhalten: Grenzwert mindestens +60 °C, höchstens 3 Stunden; als Sicherheitszuschlag kannst du +65 °C anstreben.";

/** Hinweis zur Flexibilität für kleine Betriebe (Hilfetext und Fußtext). */
export const HACCP_FLEXIBEL =
  "Kleine Betriebe dürfen das Verfahren einfach halten: Dokumente und Aufzeichnungen müssen der Art und Größe des Betriebs angemessen sein (Art. 5 Abs. 2 Buchst. g VO (EG) Nr. 852/2004); wo die Gefahrenanalyse keinen CCP ergibt, genügt die gute Hygienepraxis (Bekanntmachung der Kommission 2022/C 355/01). Leitlinien für eine gute Hygienepraxis deiner Branche helfen dabei; sie können auch die Temperaturvorgaben der Tier-LMHV ersetzen (Anlage 5 Kap. VII Tier-LMHV): DEHOGA „Leitlinie für eine Gute Hygienepraxis in der Gastronomie“ (3. Aufl. 2022), Leitlinie des Zentralverbands des Deutschen Bäckerhandwerks für das Bäcker- und Konditorenhandwerk (2012), BGN „Leitlinie für eine gute Lebensmittelhygienepraxis in ortsveränderlichen Betriebsstätten“ (2018, für Foodtrucks und Marktstände).";
/** Hinweis (nur in der App): vereinfachte Aufzeichnungen für sehr kleine Betriebe – keine eigene Funktion. */
export const HACCP_VEREINFACHT =
  "Für sehr kleine Betriebe erlaubt die Bekanntmachung der Kommission 2022/C 355/01 (Anhang I Nr. 5) auch Aufzeichnungen nur bei Abweichungen – frag deine Lebensmittelüberwachung, ob sie das für deinen Betrieb akzeptiert.";

/**
 * Aufbewahrung (Grundsatz g): die Verordnung nennt keine feste Dauer (Art. 5 Abs. 4 Buchst. c: „angemessener Zeitraum“);
 * Startwert nach der Empfehlung der Lebensmittelüberwachung (Merkblatt HACCP-Konzept Wetteraukreis 2025).
 */
export const HACCP_AUFBEWAHRUNG = "12 Monate, bei haltbarer Ware bis 6 Monate nach Ablauf des MHD";
export const HACCP_AUFBEWAHRUNG_QUELLE = "Art. 5 Abs. 4 Buchst. c VO (EG) Nr. 852/2004 („angemessener Zeitraum“); Empfehlung der Lebensmittelüberwachung, z. B. Wetteraukreis, Merkblatt HACCP-Konzept 2025";
/** Rückruf (Prüfbericht Lebensmittelhygiene, Frage 6): fester Satz bei den Aufzeichnungen. */
export const HACCP_RUECKRUF = "Bei Verdacht auf unsichere Ware: Ware sperren, Lebensmittelüberwachung informieren (Art. 19 VO (EG) Nr. 178/2002).";

const GASTRO = "Gastronomie / Café";
const BAECKEREI = "Bäckerei";
const MOBIL = "Foodtruck / mobiler Verkauf";
const QUELLE_GA = "Art. 5 Abs. 2 Buchst. a, b VO (EG) Nr. 852/2004 – Vorschlag";
const QUELLE_GHP = "Bekanntmachung der Kommission 2022/C 355/01, Anhang I Nr. 3.12 (Temperaturkontrolle als gute Hygienepraxis)";

const ga = (gruppe: string, schritt: string, arten: string[], gefahr: string, lenkung: string, ccp: "ja" | "nein", begruendung: string, quelle?: string): Vorschlag => ({
  gruppe,
  titel: schritt,
  werte: { schritt, arten, gefahr, lenkung, ccp, begruendung },
  quelle: quelle ? `${QUELLE_GA}; ${quelle}` : QUELLE_GA,
});

/** Gefahrenanalyse: je Prozessschritt Gefahr, Lenkungsmaßnahme und CCP-Entscheidung – Vorschläge je Branchengruppe. */
export const GEFAHRENANALYSE: Vorschlag[] = [
  ga(GASTRO, "Wareneingang", ["biologisch", "physikalisch", "allergene"], "Keime in verdorbener oder zu warm gelieferter Ware; Fremdkörper und Schädlinge in beschädigter Verpackung; fehlende oder falsche Allergenkennzeichnung", "Ware bei Annahme prüfen: Temperatur gekühlter und tiefgekühlter Ware, Verpackung, Kennzeichnung, Mindesthaltbarkeits- und Verbrauchsdatum; Mängel zurückweisen; Kühlware sofort einräumen; Lieferschein aufbewahren", "nein", BASIS),
  ga(GASTRO, "Lagerung gekühlt", ["biologisch", "allergene"], "Vermehrung von Keimen bei zu hoher Temperatur; Übertragung von Keimen von roher auf verzehrfertige Ware; Kreuzkontakt mit Allergenen in offenen Behältern", "Kühltemperatur messen und eintragen; Rohes unten und abgedeckt lagern; zuerst verbrauchen, was zuerst abläuft; Verbrauchsdatum beachten", "nein", KONTROLLPUNKT, QUELLE_GHP),
  ga(GASTRO, "Lagerung tiefgekühlt", ["biologisch"], "Antauen bei Ausfall des Geräts oder offen stehender Tür; Keimvermehrung nach dem Auftauen", "Temperatur messen und eintragen; Ware verpackt und beschriftet lagern; im Kühlschrank auftauen, Auftaudatum beschriften, aufgetaute Ware binnen 24 Stunden verarbeiten; Auftauwasser verwerfen, nicht wieder einfrieren", "nein", BASIS),
  ga(GASTRO, "Zubereitung", ["biologisch", "chemisch", "physikalisch", "allergene"], "Übertragung von Keimen über Hände, Bretter und Messer (rohes Geflügel, Fleisch, Eier auf verzehrfertige Speisen); Reste von Reinigungsmitteln; Fremdkörper (Glas, Schmuck, Verpackungsreste); Kreuzkontakt mit Allergenen", "Händewaschen; Trennung rein/unrein, Schneidbretter nach Farben; Flächen nach rohem Fleisch, Geflügel, Fisch oder Eiern sofort reinigen und desinfizieren; Reinigungsmittel getrennt von Lebensmitteln lagern; Rezepturen mit Allergenen festhalten; kein Glas über offenen Lebensmitteln", "nein", BASIS),
  ga(GASTRO, "Erhitzen", ["biologisch"], "Krankheitserreger (z. B. Salmonellen, Campylobacter) überleben bei zu geringer Kerntemperatur", "Kerntemperatur mit Einstichthermometer messen und eintragen", "ja", CCP),
  ga(GASTRO, "Heißhalten", ["biologisch"], "Sporen (z. B. Bacillus cereus) keimen aus und Keime vermehren sich, wenn Speisen zu kühl warmgehalten werden", "Temperatur der Speisen in der Warmhaltetheke messen; Heißhaltezeit begrenzen; Reste nicht erneut warmhalten", "ja", CCP),
  ga(GASTRO, "Abkühlen", ["biologisch"], "Sporenbildner (z. B. Clostridium perfringens) vermehren sich, wenn große Mengen langsam abkühlen", "In flachen Behältern und kleinen Mengen abkühlen, z. B. im Kaltwasserbad; Temperatur und Uhrzeit messen und eintragen", "ja", CCP),
  ga(GASTRO, "Regenerieren", ["biologisch"], "Keime überleben oder vermehren sich, wenn vorgegarte Speisen nicht ausreichend wieder erhitzt werden", "Speisen zügig und an allen Stellen durcherhitzen; Kerntemperatur messen und eintragen; nur einmal regenerieren", "ja", CCP),
  ga(GASTRO, "Ausgabe", ["biologisch", "allergene"], "Keimvermehrung bei zu langer Standzeit ohne Kühlung; Verunreinigung durch Gäste an offener Ware; falsche Auskunft zu Allergenen", "Kaltspeisen gekühlt ausgeben, Standzeit begrenzen; Spuckschutz bzw. Abdeckung; Vorlegebesteck je Speise; Allergenliste aktuell halten", "nein", BASIS),
  ga(BAECKEREI, "Wareneingang Rohstoffe (Mehl, Eier, Milchprodukte)", ["biologisch", "physikalisch", "allergene"], "Schädlinge (z. B. Motten, Käfer) in Mehl und trockenen Zutaten; Keime in zu warm gelieferten Eiern und Milchprodukten; Fremdkörper; falsch gekennzeichnete Zutaten mit Allergenen", "Säcke und Verpackungen auf Befall und Schäden prüfen; Temperatur gekühlter Ware messen; Kennzeichnung und Zutatenlisten prüfen; Lieferschein aufbewahren", "nein", BASIS),
  ga(BAECKEREI, "Lagerung Mehl und trockene Zutaten", ["biologisch", "allergene"], "Befall durch Schädlinge; Schimmel bei Feuchtigkeit; Kreuzkontakt (z. B. Nüsse, Sesam, Soja)", "Trocken, verschlossen und vom Boden abgehoben lagern; Schädlingsmonitoring; Zutaten mit Allergenen getrennt und beschriftet lagern", "nein", BASIS),
  // Prüfbericht Lebensmittelhygiene (L-032): nicht durchgebackene Ware ist eine biologische Gefahr; Acrylamid-Minimierung
  ga(BAECKEREI, "Backen", ["biologisch", "chemisch", "physikalisch"], "Fremdkörper (z. B. Teile von Blechen, Stikkenwagen oder Holz); Keime in nicht durchgebackener Ware; Acrylamid bei zu dunklem Backen", "Bleche und Formen vor Gebrauch auf Schäden prüfen; Backzeit und -temperatur nach Rezeptur einhalten; Sichtkontrolle; Acrylamid minimieren: goldgelb statt dunkelbraun backen", "nein", BASIS, "VO (EU) 2017/2158 (Acrylamid, Anhang II Teil B)"),
  // Prüfbericht Lebensmittelhygiene (L-033): nach dem Füllen folgt kein Erhitzen – Basishygiene plus Kühlung
  ga(BAECKEREI, "Füllen und Garnieren (Sahne, Creme)", ["biologisch", "allergene"], "Keime aus Sahneautomat, Spritzbeuteln und Händen in nicht durcherhitzte Füllungen; Kreuzkontakt mit Allergenen", "Sahne nur aus pasteurisierter Ware; Sahneautomat nach Herstellerangabe täglich reinigen; Einweg-Spritzbeutel; gefüllte Ware sofort kühlen (≤ +7 °C) und rasch verarbeiten; Rezepturen mit Allergenen festhalten", "nein", BASIS),
  ga(BAECKEREI, "Erhitzen von Cremes und Füllungen", ["biologisch"], "Krankheitserreger aus Eiern und Milch überleben, wenn Vanille- oder Konditorcreme nicht ausreichend erhitzt wird", "Creme unter Rühren durcherhitzen; Temperatur messen und eintragen; danach rasch abkühlen und gekühlt lagern", "ja", CCP),
  ga(BAECKEREI, "Kühllagerung Konditoreiwaren", ["biologisch"], "Keimvermehrung in Torten und Gebäck mit nicht durcherhitzter Füllung oder Auflage bei zu hoher Temperatur", "Kühltemperatur in Kühlraum und Kühltheke messen und eintragen; Ware mit Datum versehen", "nein", KONTROLLPUNKT, QUELLE_GHP),
  ga(BAECKEREI, "Verkauf unverpackter Backwaren", ["biologisch", "allergene"], "Verunreinigung durch Anfassen, Husten oder Niesen an offener Ware; falsche Auskunft zu Allergenen", "Zange oder Handschuh, Spuckschutz bzw. Abdeckung; Geld nicht mit derselben Hand wie die Ware anfassen; Allergenliste an der Theke", "nein", BASIS),
  ga(MOBIL, "Transport und Kühlung unterwegs", ["biologisch"], "Keimvermehrung, wenn die Kühlung auf der Fahrt oder am Stand nicht reicht (Hitze, lange Standzeit, Stromausfall)", "Kühlgeräte im Fahrzeug bzw. Kühlboxen mit Kühlakkus; Temperatur bei Abfahrt und am Stand messen und eintragen; nur so viel mitnehmen wie nötig", "nein", KONTROLLPUNKT, QUELLE_GHP),
  ga(MOBIL, "Wasser aus dem Fahrzeugtank", ["biologisch"], "Verkeimtes Wasser aus Tank, Leitungen oder Schläuchen", "Nur Trinkwasser einfüllen, Schläuche für Trinkwasser verwenden und sauber lagern; Tank nach Herstellerangabe reinigen und desinfizieren; Vorgaben des Gesundheitsamts (Anzeige, Untersuchung) einhalten", "nein", BASIS),
  ga(MOBIL, "Zubereitung im Fahrzeug", ["biologisch", "allergene"], "Übertragung von Keimen auf engem Raum (Hände, Flächen, rohe und verzehrfertige Ware nah beieinander); Kreuzkontakt mit Allergenen", "Handwaschbecken mit fließendem Wasser, Seife und Einmalhandtüchern nutzen; rohe und verzehrfertige Ware getrennt; Flächen zwischendurch reinigen", "nein", BASIS),
  ga(MOBIL, "Erhitzen am Stand", ["biologisch"], "Krankheitserreger überleben bei zu geringer Kerntemperatur (z. B. Bratwurst, Burger, Geflügel)", "Kerntemperatur stichprobenartig mit Einstichthermometer messen und eintragen", "ja", CCP),
  ga(MOBIL, "Heißhalten am Stand", ["biologisch"], "Keimvermehrung, wenn Speisen zu kühl warmgehalten werden", "Temperatur der warmgehaltenen Speisen messen; Heißhaltezeit begrenzen; Reste am Ende des Tages entsorgen", "ja", CCP),
  ga(MOBIL, "Ausgabe am Stand", ["biologisch", "physikalisch", "allergene"], "Verunreinigung durch Staub, Insekten und Kundschaft an offener Ware; falsche Auskunft zu Allergenen", "Ware abdecken, Spuckschutz; Geld und Ware getrennt anfassen; Allergeninformation am Stand", "nein", BASIS),
];

const QUELLE_KUEHL = `BgVV 1999; DIN 10508:2019 (über LAVES Niedersachsen, Merkblatt Lagertemperaturen 08/2022); ${QUELLE_GHP}`;
const QUELLE_ERHITZEN = "BfR, Presseinformation 13/2024 „Sicher verpflegt“: 72 °C an allen Stellen für mindestens zwei Minuten; BGN-Leitlinie ortsveränderliche Betriebsstätten 2018 (alternativ 70 °C für 10 Minuten oder 80 °C für 3 Minuten)";
const QUELLE_HEISS = "BfR-Stellungnahme 037/2020; BfR, Presseinformation 13/2024; LAVES Niedersachsen 08/2022; DIN 10508:2019 (+65 °C als Praxiszuschlag, Kreis Paderborn 2026)";
const QUELLE_ABKUEHLEN = "BgVV, Temperaturanforderungen und -empfehlungen für Lebensmittel (1999), Abschnitt 4";
const KERN = "an allen Stellen (Kern) mindestens +72 °C für mindestens 2 Minuten";
const HEISS = "mindestens +60 °C an allen Stellen, höchstens 3 Stunden";
const HEISS_WANN = "bei Beginn der Ausgabe und danach alle 2 Stunden";
const HEISS_KORREKTUR = "Unter +60 °C: Speise sofort auf mindestens +72 °C Kerntemperatur nacherhitzen (nur einmal) oder entsorgen";

const ccp = (gruppe: string, schritt: string, gefahr: string, grenzwert: string, ueberwachung: string, wer: string, wann: string, korrektur: string, quelle: string, einstufung: "ccp" | "ghp" = "ccp"): Vorschlag => ({
  gruppe,
  titel: schritt,
  werte: { schritt, einstufung, gefahr, grenzwert, ueberwachung, wer, wann, korrektur },
  quelle,
});

/**
 * Kritische Kontrollpunkte (Grundsätze c–e): Grenzwert, Überwachung (wie, wer, wie oft) und Korrekturmaßnahme. Die
 * Kühlzeilen sind Kontrollpunkte der guten Hygienepraxis (Einstufung „ghp“) – die Titel bleiben, damit gespeicherte
 * Auswahlen gültig bleiben.
 */
export const CCP_VORSCHLAEGE: Vorschlag[] = [
  ccp(GASTRO, "Erhitzen – Kerntemperatur", "Krankheitserreger überleben", KERN, "Einstichthermometer in die dickste Stelle", "Koch / Köchin", "bei jeder Charge bzw. stichprobenartig je Gericht und Tag", "Weiter erhitzen, bis der Grenzwert erreicht ist; erneut messen; eintragen", QUELLE_ERHITZEN),
  ccp(GASTRO, "Heißhalten", "Auskeimen von Sporen, Keimvermehrung", HEISS, "Thermometer in die Speise", "Beschäftigte an der Ausgabe", HEISS_WANN, `${HEISS_KORREKTUR}; Gerät prüfen; eintragen`, QUELLE_HEISS),
  ccp(GASTRO, "Abkühlen", "Vermehrung von Sporenbildnern", "von +65 °C auf +10 °C innerhalb von 3 Stunden", "Thermometer, Uhrzeit bei Beginn und Ende", "Koch / Köchin", "bei jedem Abkühlvorgang", "Grenzwert verfehlt: Speise entsorgen; künftig kleinere Mengen, flachere Behälter oder Kaltwasserbad", QUELLE_ABKUEHLEN),
  ccp(GASTRO, "Lagerung gekühlt – Kühltemperatur", "Keimvermehrung in leicht verderblichen Lebensmitteln", "Kühlschrank höchstens +7 °C; strengere Werte je Ware (z. B. Hackfleisch, Geflügel, Fisch) siehe Kontrollpunkte der Eigenkontrollen", "Thermometer im Gerät ablesen", "Beschäftigte", "täglich zu Arbeitsbeginn", "Ursache beheben (Tür, Thermostat), Ware bewerten und ggf. entsorgen; nachmessen; eintragen", QUELLE_KUEHL, "ghp"),
  ccp(GASTRO, "Regenerieren", "Keime überleben", `${KERN}; nur einmal regenerieren`, "Einstichthermometer", "Koch / Köchin", "bei jeder Charge", "Weiter erhitzen, bis der Grenzwert erreicht ist; Speise nicht ein zweites Mal regenerieren; eintragen", QUELLE_ERHITZEN),
  ccp(BAECKEREI, "Kühllagerung Konditoreiwaren", "Keimvermehrung in nicht durcherhitzten Füllungen", "höchstens +7 °C", "Thermometer in Kühlraum und Kühltheke", "Beschäftigte in Backstube und Verkauf", "täglich zu Arbeitsbeginn und bei Schichtwechsel", "Ursache beheben; betroffene Torten und Teilchen bewerten und ggf. entsorgen; eintragen", `Kontrollpunkt „Kühlung feine Backwaren / Konditorwaren“; ${QUELLE_KUEHL}`, "ghp"),
  ccp(BAECKEREI, "Erhitzen von Cremes und Füllungen", "Krankheitserreger überleben (z. B. aus Eiern, Milch)", `${KERN} (Konditorcreme wird in der Praxis aufgekocht)`, "Einstichthermometer bzw. Thermometer im Kochkessel", "Konditor / Konditorin", "bei jeder Charge", "Weiter erhitzen, bis der Grenzwert erreicht ist; erneut messen; eintragen", QUELLE_ERHITZEN),
  ccp(MOBIL, "Transport und Kühlung unterwegs", "Keimvermehrung auf der Fahrt und am Stand", "höchstens +7 °C; strengere Werte je Ware siehe Kontrollpunkte der Eigenkontrollen", "Thermometer in Kühlgerät bzw. Kühlbox", "Fahrer/in bzw. Standbetreiber/in", "bei Abfahrt, bei Ankunft am Standplatz und mehrmals während des Verkaufs", "Ware bewerten und ggf. entsorgen; Kühlakkus tauschen bzw. Gerät prüfen; eintragen", QUELLE_KUEHL, "ghp"),
  ccp(MOBIL, "Erhitzen am Stand – Kerntemperatur", "Krankheitserreger überleben", KERN, "Einstichthermometer in die dickste Stelle", "Standbetreiber/in", "stichprobenartig je Produkt und Verkaufstag", "Weiter erhitzen, bis der Grenzwert erreicht ist; erneut messen; eintragen", QUELLE_ERHITZEN),
  ccp(MOBIL, "Heißhalten am Stand", "Keimvermehrung", HEISS, "Thermometer in die Speise", "Standbetreiber/in", "bei Verkaufsbeginn und danach alle 2 Stunden", `${HEISS_KORREKTUR}; eintragen`, QUELLE_HEISS),
];

const LEITLINIE_KOM = "Bekanntmachung der Kommission 2022/C 355/01, Anhang I Nr. 4";
/** Verifizierung (Grundsatz f): regelmäßig prüfen, ob das Verfahren wirkt. */
export const VERIFIZIERUNG: Option[] = [
  { wert: "protokolle_durchsehen", text: "Messprotokolle und Monatsraster wöchentlich durchsehen und abzeichnen", quelle: `Art. 5 Abs. 2 Buchst. f VO (EG) Nr. 852/2004; ${LEITLINIE_KOM}` },
  { wert: "thermometer", text: "Thermometer monatlich prüfen: im Eiswasser (0 °C) und in kochendem Wasser (100 °C); weicht es um mehr als 1 K ab, ersetzen", quelle: "Art. 5 Abs. 2 Buchst. f VO (EG) Nr. 852/2004" },
  { wert: "abweichungen", text: "Abweichungen und Korrekturmaßnahmen auswerten: Wiederholt sich eine Abweichung, Ursache beheben und das Verfahren anpassen", quelle: "Art. 5 Abs. 2 Buchst. e, f VO (EG) Nr. 852/2004" },
  { wert: "aenderungen", text: "Gefahrenanalyse und CCP überprüfen, sobald sich Produkte, Abläufe, Geräte oder Lieferanten ändern", quelle: "Art. 5 Abs. 2 Unterabs. 2 VO (EG) Nr. 852/2004" },
  { wert: "regelmaessig", text: "Das ganze Verfahren zusätzlich jährlich überprüfen", quelle: LEITLINIE_KOM },
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
  { wert: "wasser", text: "Foodtruck mit Wassertank: Anzeige beim Gesundheitsamt, Untersuchungsbefunde, Reinigung des Tanks", quelle: "§ 11 Abs. 2 TrinkwV" },
];

const BGN_LEITLINIE = "BGN-Leitlinie ortsveränderliche Betriebsstätten (2018)";
/** Hygieneplan-Zeile (Bäckerei, Foodtruck): vom Prüfbericht Lebensmittelhygiene bestätigt (L-108–L-120), daher ohne „fachlich zu prüfen“. */
const zeile = (gruppe: string, thema: string, was: string, wann: string, womit: string, wie: string, wer: string, quelle: string): Vorschlag => ({
  gruppe,
  titel: was,
  werte: { thema, was, wann, womit, wie, wer },
  quelle,
});
/** Temperaturzeilen im Hygieneplan: der Grenzwert steht nur in den Eigenkontrollen (Prüfbericht Lebensmittelhygiene, Frage 7). */
export const GRENZWERT_HACCP = "Grenzwert laut Eigenkontrollen (HACCP)";

/** Hygieneplan Lebensmittelbetrieb: Zeilen für die Bäckerei (Backstube und Verkauf) – vom Prüfbericht bestätigt und ergänzt. */
export const HYGIENE_BAECKEREI: Vorschlag[] = [
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Teig- und Knetmaschinen, Ausrollmaschine", "nach Gebrauch, mindestens täglich", "Spachtel, Reinigungsmittel; Desinfektionsmittel für Lebensmittelbereiche", "Maschine ausschalten und gegen Wiedereinschalten sichern; Teigreste trocken entfernen, reinigen, trocknen lassen", "Beschäftigte Backstube", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Sahneautomat, Spritzbeutel und Tüllen", "nach Gebrauch, mindestens täglich (Sahneautomat nach Herstellerangabe)", "Reinigungsmittel, Desinfektionsmittel; Einweg-Spritzbeutel", "zerlegen, reinigen, desinfizieren, trocken lagern; Einweg-Spritzbeutel nur einmal verwenden; Sahne nur aus pasteurisierter Ware, Restsahne täglich entsorgen", "Beschäftigte Konditorei", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Gärschränke, Bleche, Backformen, Stikkenwagen", "Gärschränke wöchentlich, dabei auf Schimmel prüfen; Bleche und Formen nach Bedarf, bei Verschmutzung sofort", "Reinigungsmittel, Spachtel", "Teig- und Mehlreste entfernen, Feuchtigkeit vermeiden (Schimmel); beschädigte Bleche aussortieren", "Beschäftigte Backstube", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Reinigung und Desinfektion", "Brotschneidemaschine und Theke", "nach Gebrauch und zum Arbeitsende", "Reinigungsmittel, Desinfektionsmittel", "vom Strom trennen, Krümel entfernen, Messerbereich nur mit Schutzhandschuh reinigen; Thekenflächen reinigen", "Beschäftigte Verkauf", "Anhang II Kap. V VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Schädlingsbekämpfung", "Mehllager und trockene Zutaten", "täglich Sichtkontrolle; Monitoringstellen nach Plan", "Pheromon- bzw. Klebefallen für Vorratsschädlinge, Lageplan", "Säcke vom Boden abgehoben und von der Wand entfernt lagern; Mehlsäcke nach Anbruch verschlossen lagern; Mehlsilo und Behälter im leeren Zustand reinigen; auf Motten, Käfer und Gespinste achten; Befall sofort melden, Fachbetrieb beauftragen", "verantwortliche Person", "Anhang II Kap. IX Nr. 4 VO (EG) Nr. 852/2004"),
  zeile(BAECKEREI, "Temperaturkontrollen", "Kühlraum und Kühltheke für Konditoreiwaren", "täglich zu Arbeitsbeginn", "Thermometer; Messprotokoll der Eigenkontrollen (HACCP)", `Temperatur ablesen und eintragen; ${GRENZWERT_HACCP}; bei Abweichung Ursache beheben, Ware bewerten, eintragen`, "Beschäftigte", "Anhang II Kap. IX Nr. 5 VO (EG) Nr. 852/2004"),
  // Prüfbericht Lebensmittelhygiene (L-114): eigener Themenbereich „Allergenmanagement“ statt „Trennung rein/unrein“
  zeile(BAECKEREI, "Allergenmanagement", "Zutaten mit Allergenen (z. B. Nüsse, Sesam, Soja)", "ständig", "beschriftete, verschlossene Behälter; eigene Schaufeln", "getrennt lagern; Rezepturen mit Allergenen festhalten; nach Ware mit Nüssen oder Sesam Geräte reinigen, bevor andere Ware folgt", "alle", "Anhang II Kap. IX Nr. 3 VO (EG) Nr. 852/2004; Art. 44 LMIV"),
  zeile(BAECKEREI, "Personalhygiene", "Verkauf unverpackter Backwaren", "bei jedem Verkauf", "Zange, Einmalhandschuhe, Spuckschutz", "Ware nicht mit der bloßen Hand anfassen – die Zange genügt; Einmalhandschuhe ersetzen das Händewaschen nicht; Geld und Ware getrennt anfassen oder Handschuh wechseln; Spuckschutz geschlossen halten", "Beschäftigte Verkauf", "Anhang II Kap. VIII, Kap. IX Nr. 3 VO (EG) Nr. 852/2004"),
];

/** Hygieneplan Lebensmittelbetrieb: Zeilen für Foodtruck und mobilen Verkauf (Anhang II Kap. III VO (EG) Nr. 852/2004; BGN-Leitlinie 2018). */
export const HYGIENE_FOODTRUCK: Vorschlag[] = [
  zeile(MOBIL, "Trinkwasser", "Wassertank und Schläuche im Fahrzeug", "Tank vor Saisonbeginn und nach Standzeiten reinigen und desinfizieren, nach Herstellerangabe; Wasser täglich frisch, Restwasser täglich ablassen", "Trinkwasser; Schläuche und Anschlüsse für Trinkwasser (z. B. nach DVGW W 270 / KTW-BWGL); Reinigungs- und Desinfektionsmittel für Trinkwasseranlagen", "nur Trinkwasser einfüllen; Eiswürfel und Wasser für Lebensmittel nur aus Trinkwasser; Schläuche sauber, trocken und nicht auf dem Boden lagern; Anschlüsse vor dem Anschließen reinigen; Tank nach Saisonende leer und trocken lagern; Inbetriebnahme dem Gesundheitsamt anzeigen und Untersuchungen nach dessen Vorgabe machen lassen", "verantwortliche Person", `Anhang II Kap. III Nr. 2 Buchst. e, Kap. VII VO (EG) Nr. 852/2004; § 11 Abs. 2 TrinkwV; Merkblatt Gesundheitsamt Dortmund; ${BGN_LEITLINIE} Nr. 1.7`),
  zeile(MOBIL, "Personalhygiene", "Handwaschgelegenheit im Fahrzeug", "vor Arbeitsbeginn, nach Pausen und Toilettengang, nach rohem Fleisch oder Geflügel, nach Geld und Abfall", "Handwaschbecken mit fließendem warmem und kaltem Wasser, Flüssigseife, Einmalhandtücher", "gründlich waschen und mit Einmalhandtuch abtrocknen; Becken nur zum Händewaschen nutzen; Warmwasser ist Pflicht beim Umgang mit Fleisch, Geflügel, Fisch und Speiseeis – ohne Handwaschbecken mit Warmwasser kein Umgang mit rohem Fleisch", "alle", `Anhang II Kap. III Nr. 2 Buchst. a VO (EG) Nr. 852/2004; ${BGN_LEITLINIE} Nr. 1.1.8`),
  zeile(MOBIL, "Temperaturkontrollen", "Kühlung unterwegs", "bei Abfahrt, bei Ankunft am Standplatz und mehrmals während des Verkaufs", "Kühlgerät im Fahrzeug oder Kühlboxen mit Kühlakkus; Thermometer; Messprotokoll der Eigenkontrollen (HACCP)", `Temperatur ablesen und eintragen; ${GRENZWERT_HACCP}; Kühlkette nicht unterbrechen; bei Abweichung Ware bewerten, eintragen`, "Fahrer/in bzw. Standbetreiber/in", "Anhang II Kap. III Nr. 2 Buchst. g, Kap. IX Nr. 5 VO (EG) Nr. 852/2004"),
  zeile(MOBIL, "Abfall", "Abfall und Abwasser", "laufend; Abwassertank und Abfall am Ende jedes Verkaufstags", "verschließbare Abfallbehälter; Abwassertank bzw. Auffangbehälter", "Abfall und Abwasser getrennt von Lebensmitteln sammeln; Abwasser nur an zugelassenen Stellen ablassen, nicht in Gully oder Grünfläche; Fett gesondert entsorgen, nicht in den Abwassertank", "Standbetreiber/in", `Anhang II Kap. III Nr. 2 Buchst. f, Kap. VI VO (EG) Nr. 852/2004; ${BGN_LEITLINIE} Nr. 1.7.5`),
  zeile(MOBIL, "Reinigung und Desinfektion", "Standplatzwechsel und Fahrt", "vor der Fahrt und nach dem Aufbau am neuen Standplatz", "Reinigungs- und Desinfektionsmittel, Abdeckungen", "Lebensmittel und Geräte für die Fahrt sichern und abdecken; nach dem Aufbau Arbeitsflächen reinigen; Untergrund und Umgebung auf Schmutz und Schädlinge prüfen; Standplatz mit Abstand zu Abfallcontainern, keine Tiere; Wasser- und Stromanschluss prüfen", "Standbetreiber/in", "Anhang II Kap. III Nr. 1, Nr. 2 Buchst. b, h VO (EG) Nr. 852/2004"),
];
