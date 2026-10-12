/**
 * Bausteine aus der Recherche vom 12.10.2026 (docs/recherche/2026-10-12) – ERZEUGT von werkzeuge/bausteine-erzeugen.mjs,
 * nicht von Hand ändern. Jeder Baustein trägt einen Kurzbeleg; „unsicher“ = nicht wörtlich an der Primärquelle geprüft.
 * Fachliche Abnahme: PRUEFLISTE T-62.
 */
import type { Option, Vorschlag } from "./typen.js";

export const GEFAEHRDUNGEN: Vorschlag[] = [
 {
  "gruppe": "Friseur",
  "titel": "Ausrutschen, Stolpern und Stürzen durch glatte Böden, Schmierfilme, Unebenheiten oder verrutschende Fußmatten.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Ausrutschen, Stolpern und Stürzen durch glatte Böden, Schmierfilme, Unebenheiten oder verrutschende Fußmatten.",
   "massnahme": "Rutschhemmenden, leicht zu reinigenden Bodenbelag verwenden (mindestens Bewertungsgruppe R 9).\nFußmatten gegen Verrutschen sichern; Bodenschäden sofort beseitigen.\nReinigungsmittel ohne Schmierfilm und sparsam einsetzen."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Versperrte Verkehrs- und Fluchtwege, zu enge Bewegungsflächen, herumstehende bewegliche Geräte.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Versperrte Verkehrs- und Fluchtwege, zu enge Bewegungsflächen, herumstehende bewegliche Geräte.",
   "massnahme": "Geeignete Abstellflächen für bewegliche Geräte (z. B. Climazone) schaffen; ausreichend Bewegungsfläche am Arbeitsplatz.\nFluchtwege und Notausgänge dauerhaft frei halten und kennzeichnen; Flucht- und Rettungsplan erstellen."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Unzureichende Frischluftzufuhr, dadurch Belastung durch Dämpfe und Aerosole von Friseurchemikalien.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Unzureichende Frischluftzufuhr, dadurch Belastung durch Dämpfe und Aerosole von Friseurchemikalien.",
   "massnahme": "Lüftung mit Richtwert 100 m³ Frischluft pro Stunde und Beschäftigtem sicherstellen, auch im Winter (Abluftventilatoren, RLT-Anlage oder Querlüftung).\nHaarspray nur in ausreichend belüfteten Räumen versprühen."
  },
  "quelle": "TRGS 530"
 },
 {
  "gruppe": "Friseur",
  "titel": "Feuchtarbeit (Haare waschen, Arbeiten an feuchtem Haar, häufiges Händewaschen) als Hauptrisikofaktor für Handekzeme.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Feuchtarbeit (Haare waschen, Arbeiten an feuchtem Haar, häufiges Händewaschen) als Hauptrisikofaktor für Handekzeme.",
   "massnahme": "Unvermeidbare Feuchtarbeit auf mehrere Beschäftigte verteilen; hautbelastende und nicht belastende Tätigkeiten abwechseln.\nFeuchtarbeit möglichst unter 4 Stunden täglich halten, angestrebt unter 2 Stunden.\nBeim Haarewaschen langstulpige Einmalhandschuhe (Nitril oder Vinyl) tragen; Hautschutz- und Händehygieneplan anwenden."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Hautkontakt mit Friseurchemikalien (Färbe-, Blondier-, Dauerwellmittel) kann zu Allergien und Hautreizungen führen.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Hautkontakt mit Friseurchemikalien (Färbe-, Blondier-, Dauerwellmittel) kann zu Allergien und Hautreizungen führen.",
   "massnahme": "Fertig portionierte Packungen bevorzugen; sorgfältig dosieren.\nEigener Misch- und Umfüllplatz mit flüssigkeitsdichter, abwaschbarer Arbeitsfläche (entfällt bei geschlossenen Systemen).\nMischen und Auftragen nur mit geeigneten Applikatoren.\nBeim Färben, Blondieren, Dauerwellen und Mischen Friseur-Einmalhandschuhe (DIN EN ISO 374-6) tragen und nach einmaligem Gebrauch entsorgen."
  },
  "quelle": "TRGS 530"
 },
 {
  "gruppe": "Friseur",
  "titel": "Einatmen von Stäuben (Blondiermittel), Dämpfen (Dauerwelle) und Sprühnebel (Haarspray) reizt die Atemwege.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Einatmen von Stäuben (Blondiermittel), Dämpfen (Dauerwelle) und Sprühnebel (Haarspray) reizt die Atemwege.",
   "massnahme": "Für ausreichende Lüftung sorgen.\nSprühnebel, Stäube und Dämpfe nicht einatmen; nicht in Richtung Augen sprühen."
  },
  "quelle": "TRGS 530"
 },
 {
  "gruppe": "Friseur",
  "titel": "Hautschäden durch Reinigungs- und Desinfektionsmittel.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Hautschäden durch Reinigungs- und Desinfektionsmittel.",
   "massnahme": "Desinfektion im Wischverfahren statt Sprühen oder Vernebeln; Desinfektionsmittelbäder abdecken.\nChemikalienbeständige Schutzhandschuhe (DIN EN ISO 374), ggf. mit längerem Schaft, bei Reinigung und Desinfektion tragen."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Brand- und Explosionsgefahr durch alkoholische Desinfektionsmittel, Spraydosen und entzündbare Flüssigkeiten.",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Brand- und Explosionsgefahr durch alkoholische Desinfektionsmittel, Spraydosen und entzündbare Flüssigkeiten.",
   "massnahme": "Brennbare Flüssigkeiten nicht an Arbeitsplätzen, unter Treppen oder in Fluchtwegen lagern; am Arbeitsplatz höchstens den Tagesbedarf.\nSpraydosen nicht über 50 °C erwärmen, nicht in offene Flammen oder beim Rauchen sprühen.\nFeuerlöscher bereitstellen (bis 50 m² Grundfläche Schaumlöscher A/B mit 6 LE), alle zwei Jahre prüfen lassen."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Absturz von Leitern oder Tritten, umkippende Regale, herabfallende Kartons.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Absturz von Leitern oder Tritten, umkippende Regale, herabfallende Kartons.",
   "massnahme": "Nur geeignete Aufstiegshilfen verwenden; schadhafte Leitern sofort aussortieren.\nLeitern im Bestands- und Wartungsplan erfassen und regelmäßig prüfen; Standsicherheit von Regalen regelmäßig prüfen.\nSchwere Lasten unten, leichte oben lagern."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Elektrische Gefährdung durch nicht geprüfte oder beschädigte Elektrogeräte und Anlagen.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Elektrische Gefährdung durch nicht geprüfte oder beschädigte Elektrogeräte und Anlagen.",
   "massnahme": "Alle Geräte und Anlagen in einem Bestands- und Wartungsplan erfassen und Prüftermine festlegen.\nPrüfungen termin- und fachgerecht durchführen lassen und Ergebnisse dokumentieren."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Ungünstige Körperhaltung und langes Stehen bei der Arbeit am Kunden.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Ungünstige Körperhaltung und langes Stehen bei der Arbeit am Kunden.",
   "massnahme": "Frisierstühle und Haarwaschbecken individuell und einfach einstellbar ausführen.\nSitzhocker für Beschäftigte bereitstellen."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Stress und Hektik in Stoßzeiten, zu lange Arbeitszeiten, fehlende oder zu kurze Pausen und Ruhezeiten.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Stress und Hektik in Stoßzeiten, zu lange Arbeitszeiten, fehlende oder zu kurze Pausen und Ruhezeiten.",
   "massnahme": "In Spitzenzeiten ausreichend Personal einsetzen; Zeitpuffer für Übergaben und Pausen einplanen.\nDienstplanung unter Einbeziehung der Wünsche der Beschäftigten.\nHöchstarbeitszeit, Pausen und Ruhezeiten einhalten; Mehrarbeit dokumentieren."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Zeitdruck, Konflikte im Team, unzufriedene Kundschaft sowie Aggressionen und Übergriffe.",
  "werte": {
   "faktor": "psychisch",
   "beschreibung": "Zeitdruck, Konflikte im Team, unzufriedene Kundschaft sowie Aggressionen und Übergriffe.",
   "massnahme": "Aufgaben, Zuständigkeiten und Entscheidungskompetenzen klar regeln, dokumentieren und kommunizieren.\nVerhalten in Notsituationen festlegen; Arbeitspläne so gestalten, dass niemand allein arbeitet.\nBei Konflikten mit Kundschaft Rückendeckung geben und Vermittlungsgespräche anbieten."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Fehlende Kenntnisse über Gefahrstoffe, Hautschutz und Hygieneregeln.",
  "werte": {
   "faktor": "qualifikation",
   "beschreibung": "Fehlende Kenntnisse über Gefahrstoffe, Hautschutz und Hygieneregeln.",
   "massnahme": "Regelmäßig unterweisen und die Unterweisung mit Betriebsanweisung, Reinigungs- und Desinfektionsplan sowie Hautschutzplan verknüpfen.\nUnterweisung dokumentieren (z. B. BGW-Dokumentationshilfe „Nachweis über Schulung/Unterweisung/Einweisung“)."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Verzögerte Hilfe bei Unfällen und Notfällen.",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Verzögerte Hilfe bei Unfällen und Notfällen.",
   "massnahme": "Verbandkasten nach DIN 13157 (Typ C) bereitstellen; Standort allen Beschäftigten bekannt machen.\nAnschrift und Telefonnummer des Rettungsdienstes deutlich aushängen."
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Stolpern, Ausrutschen und Stürzen durch nasse Böden, Schmierfilme, Stufen oder Kabel.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Stolpern, Ausrutschen und Stürzen durch nasse Böden, Schmierfilme, Stufen oder Kabel.",
   "massnahme": "Rutschhemmende Böden und Schmutzfangmatten; Kabel bündeln; Stufenkanten markieren.\nGrundreinigung außerhalb des Publikumsverkehrs; nasse Bereiche mit Warnschildern kennzeichnen.\nFlache, rutschhemmende Schuhe tragen."
  },
  "quelle": "BGW 04-05-080, Stand 03/2023, S. 27–28"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Unzureichende Beleuchtung bei Präzisionsarbeiten sowie an Eingang und Treppen.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Unzureichende Beleuchtung bei Präzisionsarbeiten sowie an Eingang und Treppen.",
   "massnahme": "Arbeitsplätze für Kosmetik- und Sticharbeiten mit mindestens 750 Lux beleuchten (ASR A3.4 beachten).\nEingang und Treppen ausreichend ausleuchten."
  },
  "quelle": "BGW 04-05-080, S. 28, 31, 36, 39; ebenso BGW Sichere Seiten Friseur/Arbeitsplatz (Kosmetik 750 Lux)"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Hautbelastung durch Feuchtarbeit, häufiges Händewaschen, langes Handschuhtragen sowie Desinfektions- und Reinigungsmittel.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Hautbelastung durch Feuchtarbeit, häufiges Händewaschen, langes Handschuhtragen sowie Desinfektions- und Reinigungsmittel.",
   "massnahme": "Feucht- und Trockenarbeit wechseln und zeitlich begrenzen.\npH-neutrale, farb- und duftstofffreie Waschmittel und rückfettende Händedesinfektion bereitstellen; Handschutz- und Händehygieneplan aufstellen.\nLatexfreie Schutzhandschuhe verwenden."
  },
  "quelle": "BGW 04-05-080, S. 21–22"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Kleber, Aktivatoren und Reiniger bei der Nagelmodellage reizen Haut, Augen und Atemwege.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Kleber, Aktivatoren und Reiniger bei der Nagelmodellage reizen Haut, Augen und Atemwege.",
   "massnahme": "Weniger gefährliche Produkte einsetzen; Mengen minimieren.\nAbsaugung am Arbeitsplatz; mindestens Fensterlüftung.\nEntzündbare Mittel kühl und trocken lagern.\nEinmalhandschuhe und Schutzbrille tragen."
  },
  "quelle": "BGW 04-05-080, S. 41"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Einatmen von Stäuben beim Feilen und Fräsen von Kunstnägeln oder Hornhaut.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Einatmen von Stäuben beim Feilen und Fräsen von Kunstnägeln oder Hornhaut.",
   "massnahme": "Absaugung oder Nass-/Sprühtechnik einsetzen.\nFFP2-Maske und Schutzbrille tragen."
  },
  "quelle": "BGW 04-05-080, S. 18, 41"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Infektionsgefahr (z. B. Hepatitis, HIV) durch Blutkontakt sowie Stich- und Schnittverletzungen.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Infektionsgefahr (z. B. Hepatitis, HIV) durch Blutkontakt sowie Stich- und Schnittverletzungen.",
   "massnahme": "Einweglanzetten bzw. Instrumente mit Sicherheitssystem und durchstichsichere Entsorgungsbehälter verwenden.\nInstrumente nach jedem Hautkontakt desinfizieren bzw. aufbereiten; Hygieneplan aufstellen; Verletzungen im Verbandbuch dokumentieren.\nEinmalhandschuhe tragen und beschädigte sofort wechseln."
  },
  "quelle": "BGW 04-05-080, S. 35–36, 39–40, 42"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Sensibilisierung durch Konservierungs- und Duftstoffe in Kosmetikprodukten (z. B. Massageöle, Cremes, Nagellack).",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Sensibilisierung durch Konservierungs- und Duftstoffe in Kosmetikprodukten (z. B. Massageöle, Cremes, Nagellack).",
   "massnahme": "Nur zugelassene, EU-kosmetikkonforme Produkte verwenden; Mengen gering halten.\nBetriebsanweisung erstellen; arbeitsmedizinische Vorsorge berücksichtigen."
  },
  "quelle": "BGW 04-05-080, S. 33, 37"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Augenschäden durch optische Strahlung bei Laser- und IPL-Anwendungen.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Augenschäden durch optische Strahlung bei Laser- und IPL-Anwendungen.",
   "massnahme": "Nur zugelassene Geräte einsetzen; Anwendung nur durch fachkundige Personen (NiSV beachten).\nGeeignete Laser- bzw. Lichtschutzbrille tragen."
  },
  "quelle": "BGW 04-05-080, S. 40"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Stromschlag und Brandgefahr durch beschädigte Geräte, Leitungen oder Lampen, besonders bei Feuchtigkeit.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Stromschlag und Brandgefahr durch beschädigte Geräte, Leitungen oder Lampen, besonders bei Feuchtigkeit.",
   "massnahme": "Geräte mit CE-/GS-Kennzeichnung beschaffen; Fehlerstrom-Schutzschalter (FI/RCD) einsetzen.\nSicht- und Funktionskontrolle vor Benutzung; defekte Geräte sofort aus dem Verkehr ziehen.\nWiederkehrende Prüfung ortsveränderlicher Geräte (je nach Fehlerquote 6 Monate bis 2 Jahre) durch Elektrofachkraft oder befähigte Person."
  },
  "quelle": "BGW 04-05-080, S. 25–26"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Quetsch- und Scherstellen an höhenverstellbaren Behandlungsliegen, unbeabsichtigtes Auslösen der Verstellung.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Quetsch- und Scherstellen an höhenverstellbaren Behandlungsliegen, unbeabsichtigtes Auslösen der Verstellung.",
   "massnahme": "Scherstellen abschirmen; Fußtaste gegen Fehlbedienung sichern; Bewegung nur bei gedrückter Taste.\nLiege bei Reinigung gegen Verstellen sichern; Unterweisung auch für Reinigungskräfte."
  },
  "quelle": "BGW 04-05-080, S. 26–27, 29–30"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Belastung des Muskel-Skelett-Systems durch langes Stehen oder Sitzen, ungünstige Haltung und enge Platzverhältnisse.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Belastung des Muskel-Skelett-Systems durch langes Stehen oder Sitzen, ungünstige Haltung und enge Platzverhältnisse.",
   "massnahme": "Höhen- und neigungsverstellbare Liegen, einstellbare Stühle und Stehhilfen bereitstellen.\nArbeitsmittel körpernah bereitstellen; Wechsel von Stehen und Sitzen sowie Lockerungspausen einplanen."
  },
  "quelle": "BGW 04-05-080, S. 23–24"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Zeit- und Leistungsdruck, häufige Unterbrechungen, Alleinarbeit sowie Aggression oder Überfälle.",
  "werte": {
   "faktor": "psychisch",
   "beschreibung": "Zeit- und Leistungsdruck, häufige Unterbrechungen, Alleinarbeit sowie Aggression oder Überfälle.",
   "massnahme": "Gut beleuchteten Eingang und ggf. Alarmanlage vorsehen.\nMöglichst zu zweit arbeiten; Notfallplan; Bargeldbestand gering halten, Kassenabschluss ohne Publikum.\nDienstplanung mit Wünschen der Beschäftigten; Handlungsspielräume einräumen."
  },
  "quelle": "BGW 04-05-080, S. 30–31"
 },
 {
  "gruppe": "Kosmetik",
  "titel": "Brand durch elektrische Defekte, überhitzte Geräte und entzündbare Desinfektions- und Reinigungsmittel.",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Brand durch elektrische Defekte, überhitzte Geräte und entzündbare Desinfektions- und Reinigungsmittel.",
   "massnahme": "Geeignete Feuerlöscher und Rauchmelder; Fluchtwege kennzeichnen und freihalten.\nBrennbare Stoffe getrennt lagern; Brandschutzhelfer benennen; Unterweisung und Räumungsübungen."
  },
  "quelle": "BGW 04-05-080, S. 19–20"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Ausrutschen und Stürzen auf nassen oder fettigen Böden.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Ausrutschen und Stürzen auf nassen oder fettigen Böden.",
   "massnahme": "Ablaufrinnen bzw. Abläufe unter Kippbratpfannen, Kochkesseln und Entleerungsöffnungen.\nNach der Reinigung möglichst trockenwischen; nasse Bereiche sperren oder kennzeichnen; Speisereste sofort entfernen.\nRutschhemmende Schuhe tragen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.3.2, 3.5, 3.7"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Hohe Temperatur und Feuchte sowie Schadstoffe in der Atemluft durch unzureichende Küchenlüftung; Brandlast im Abluftsystem.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Hohe Temperatur und Feuchte sowie Schadstoffe in der Atemluft durch unzureichende Küchenlüftung; Brandlast im Abluftsystem.",
   "massnahme": "Abluftanlage mit ausreichend dimensionierter Haube und Aerosolabscheidern; Gasgeräte mit der Lüftung koppeln.\nKüchenlüftung vor den Kochgeräten einschalten; Abscheider je nach Verschmutzung, spätestens alle 14 Tage reinigen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.3.3"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Eingeschlossenwerden und Kälteeinwirkung in Kühl- und Tiefkühlräumen.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Eingeschlossenwerden und Kälteeinwirkung in Kühl- und Tiefkühlräumen.",
   "massnahme": "Kühlraumtüren von innen entriegelbar; Ausgänge mit Sicherheitsbeleuchtung oder nachleuchtender Markierung.\nVor dem Abschließen prüfen, dass sich niemand mehr im Kühlraum befindet.\nWarme Kleidung bzw. Kälteschutzkleidung bei längerem Aufenthalt."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.1"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Schnittverletzungen an Messern, Aufschnittmaschinen und Gemüseschneidern.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Schnittverletzungen an Messern, Aufschnittmaschinen und Gemüseschneidern.",
   "massnahme": "Schutzeinrichtungen (Messerschutzring, Restehalter, Fingerschutz, Schutztrichter) funktionsfähig halten.\nStopfer statt Hand verwenden; Maschine vor dem Abstreifen ausschalten; Messer passend zum Einsatzzweck.\nSchnitthemmende Handschuhe bei Schneidwerkzeugen und beim Messerwechsel."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.2"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Schnittverletzungen durch Glasbruch, Scherben und Dosen beim Spülen und Entsorgen.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Schnittverletzungen durch Glasbruch, Scherben und Dosen beim Spülen und Entsorgen.",
   "massnahme": "Sammelbehälter und Hilfsmittel (Schaufel, Besen) für scharfe Abfälle; keine Müllbeutel.\nScharfe Messer nicht in der Spülmaschine reinigen.\nSchnitthemmende Handschuhe beim Umgang mit Glas und scharfen Abfällen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.5, 3.6"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Verbrennungen und Verbrühungen an heißen Oberflächen, durch Dampf und heiße Flüssigkeiten.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Verbrennungen und Verbrühungen an heißen Oberflächen, durch Dampf und heiße Flüssigkeiten.",
   "massnahme": "Druckgargeräte mit sicherer Dampf- und Heißwasserableitung; Deckelgriffe seitlich.\nVor dem Öffnen von Druckgarern Druckausgleich herstellen; Behälter an den schmalen Seiten fassen.\nHitzeschutzhandschuhe tragen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.3.1, 3.3.2"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag.",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Fettbrand und Fettexplosion an Fritteusen durch Überhitzung oder Wassereintrag.",
   "massnahme": "Abstand bzw. Abtrennung zu wasserführenden Geräten; keine Wasserzapfstelle in der Nähe.\nFeuerlöscher der Brandklasse F bereitstellen (bis 50 l Fett mindestens ein geeigneter Löscher).\nFritteusen nie unbeaufsichtigt betreiben; Fett rechtzeitig wechseln; eine im Löschen geübte Person muss anwesend sein."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.3.1"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Hautbelastung durch Wasser und Reinigungsmittel (Feuchtarbeit), insbesondere in der Spülküche.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Hautbelastung durch Wasser und Reinigungsmittel (Feuchtarbeit), insbesondere in der Spülküche.",
   "massnahme": "Wasserkontakt und Handschuhtragezeiten begrenzen.\nHautschutzplan aufstellen (wann welche Handschuhe und Pflege).\nBaumwoll-Unterziehhandschuhe unter flüssigkeitsdichten Handschuhen; pH-hautneutrales Flüssigsyndet."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.2, 3.5"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Verätzungen und Reizungen durch Reinigungsmittel sowie Dämpfe und Aerosole beim Reinigen.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Verätzungen und Reizungen durch Reinigungsmittel sowie Dämpfe und Aerosole beim Reinigen.",
   "massnahme": "Reiniger mit möglichst geringem Gefährdungspotenzial einsetzen.\nAusreichende Belüftung; Sprühlanze statt Hochdruckreiniger.\nNach Anleitung dosieren; Betriebsanweisung und Unterweisung zu Reinigungsmitteln.\nSchutzhandschuhe tragen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.7"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Lärm in der Spülküche durch Geschirr und Geschirrwagen.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Lärm in der Spülküche durch Geschirr und Geschirrwagen.",
   "massnahme": "Lärmarme Geschirrwagen und Räder; raumakustische Maßnahmen.\nArbeitsmedizinische Vorsorge anbieten, wenn 80 dB(A) erreicht werden.\nGehörschutz ab einem Expositionspegel von 80 dB(A) bereitstellen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.5"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Muskel-Skelett-Belastung durch Heben und Tragen schwerer Gebinde und Kochgeschirre.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Muskel-Skelett-Belastung durch Heben und Tragen schwerer Gebinde und Kochgeschirre.",
   "massnahme": "Transporthilfsmittel und Transportwagen nutzen; kleinere Gebinde einkaufen.\nSchwere Lasten zu zweit tragen; Belastung mit der Leitmerkmalmethode beurteilen.\nSicherheitsschuhe beim Transport schwerer Gebinde."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.1, 3.3.2, 3.4"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Umkippen oder Herabfallen von Lagergut.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Umkippen oder Herabfallen von Lagergut.",
   "massnahme": "Regale standsicher aufstellen.\nSchwere Lasten unten, leichtere oben lagern; Lagerbereiche eindeutig zuweisen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.1"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Psychische Belastung durch Zeitdruck, Gästekontakt, Beschwerden und Aggression.",
  "werte": {
   "faktor": "psychisch",
   "beschreibung": "Psychische Belastung durch Zeitdruck, Gästekontakt, Beschwerden und Aggression.",
   "massnahme": "Arbeitsabläufe, Aufgaben und Pausen eindeutig festlegen; Arbeitsplatzrotation.\nSchulung im Umgang mit Gästen, Beschwerden und Aggression; Übergriffe melden."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.4"
 },
 {
  "gruppe": "Gastronomie / Café",
  "titel": "Unerkannte Mängel und Verschleiß an Geräten und Schutzeinrichtungen.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Unerkannte Mängel und Verschleiß an Geräten und Schutzeinrichtungen.",
   "massnahme": "Wartung nach Herstellerangaben; Instandhaltung nur durch fachkundiges Personal.\nWiederkehrende Prüfungen über die Gefährdungsbeurteilung festlegen (befähigte Personen).\nSicherheitseinrichtungen arbeitstäglich vor Arbeitsbeginn auf Funktion prüfen."
  },
  "quelle": "DGUV Regel 110-003, Abschn. 3.8"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Absturz von Anlege- oder Stehleitern durch Standunsicherheit, Abrutschen oder schadhafte Leitern.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Absturz von Anlege- oder Stehleitern durch Standunsicherheit, Abrutschen oder schadhafte Leitern.",
   "massnahme": "Leitern nur einsetzen, wenn kein sichereres Arbeitsmittel möglich ist.\nAnlegeleitern gegen Ausgleiten sichern (Anlegewinkel 65–75° bei Sprossen), 1 m überstehen lassen; Stehleitern nur mit Spreizsicherung, oberste Stufen nicht betreten.\nLeitern jährlich prüfen und im Prüfbuch dokumentieren; schadhafte Leitern aussondern."
  },
  "quelle": "BG BAU Bausteine B 131, B 132 (Stand 07/2021); BG ETEM S285 (Stand 11/23)"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Absturz an Kanten, Öffnungen und Treppenläufen.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Absturz an Kanten, Öffnungen und Treppenläufen.",
   "massnahme": "Seitenschutz an Treppenläufen, Wandöffnungen und Verkehrswegen ab 1,00 m, an übrigen Arbeitsplätzen ab 2,00 m Absturzhöhe.\nÖffnungen umwehren oder fest abdecken."
  },
  "quelle": "BG BAU Baustein B 100"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Gehörschäden durch Lärm von Maschinen und Werkzeugen.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Gehörschäden durch Lärm von Maschinen und Werkzeugen.",
   "massnahme": "Lärmarme Verfahren und lärmgeminderte Geräte einsetzen; Maschinen warten (scharfe Werkzeuge, intakte Gehäuse).\nAb oberem Auslösewert (85 dB(A)) Lärmbereiche kennzeichnen und Lärmminderungsprogramm aufstellen; ab unterem Auslösewert (80 dB(A)) unterweisen und Vorsorge anbieten.\nGehörschutz ab 80 dB(A) bereitstellen, ab 85 dB(A) tragen."
  },
  "quelle": "DGUV-Handlungshilfe „Lärm in der Bauwirtschaft“, Stand 02/2011 (Auslösewerte nach LärmVibrationsArbSchV)"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Einatmen von mineralischem, quarzhaltigem Staub beim Schneiden, Schleifen und Bohren.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Einatmen von mineralischem, quarzhaltigem Staub beim Schneiden, Schleifen und Bohren.",
   "massnahme": "Quarzärmere Materialien prüfen.\nStaubarme Verfahren und direkt abgesaugte Geräte mit Entstauber mindestens Klasse M; Nassbearbeitung.\nMit Industriesaugern (Klasse M oder höher) reinigen statt Kehren oder Abblasen mit Druckluft."
  },
  "quelle": "BG BAU Baustein C 317, Stand 07/2021"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Gesundheitsschäden durch Gefahrstoffe (z. B. Lösemittel, Säuren, Laugen).",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Gesundheitsschäden durch Gefahrstoffe (z. B. Lösemittel, Säuren, Laugen).",
   "massnahme": "Prüfen, ob Stoffe durch weniger schädliche ersetzt werden können.\nSicherheitsdatenblatt für jeden Gefahrstoff bereithalten; Betriebsanweisung erstellen.\nBeschäftigte tätigkeitsbezogen anhand der Betriebsanweisung unterweisen."
  },
  "quelle": "BG ETEM"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Hautgefährdung durch Baustoffe, Reinigungsmittel und Feuchtigkeit.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "Hautgefährdung durch Baustoffe, Reinigungsmittel und Feuchtigkeit.",
   "massnahme": "Ersatzstoffe bzw. Verfahren mit weniger Hautkontakt prüfen.\nChemikalienschutzhandschuhe mit passender Durchbruchszeit tragen; bei Schwitzen Baumwoll-Unterziehhandschuhe.\nHautschutzplan: Hautschutzmittel vor Exposition, schonende Reinigung, Hautpflege in Pausen und nach der Arbeit."
  },
  "quelle": "BG BAU"
 },
 {
  "gruppe": "Handwerk",
  "titel": "UV-Strahlung bei Arbeiten im Freien.",
  "werte": {
   "faktor": "einwirkungen",
   "beschreibung": "UV-Strahlung bei Arbeiten im Freien.",
   "massnahme": "Beschattung des Arbeitsplatzes.\nArbeiten in der Mittagszeit vermeiden.\nKörperbedeckende Kleidung, Kopfschutz, Sonnenschutzbrille; Sonnenschutzmittel mindestens LSF 30, alle 2 Stunden erneuern."
  },
  "quelle": "BG BAU"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Stromschlag durch beschädigte Leitungen und elektrische Betriebsmittel.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Stromschlag durch beschädigte Leitungen und elektrische Betriebsmittel.",
   "massnahme": "Auf Baustellen Steckdosen bis 32 A über Fehlerstrom-Schutzeinrichtung (RCD) mit höchstens 30 mA absichern.\nNur regelmäßig geprüfte Betriebsmittel einsetzen; RCD-Funktion arbeitstäglich kontrollieren.\nArbeiten an elektrischen Anlagen nur durch Elektrofachkräfte."
  },
  "quelle": "BG BAU Bausteine B 171, B 172; A 002"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Unfälle mit Kraftfahrzeugen durch technische Mängel oder ungesicherte Ladung.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Unfälle mit Kraftfahrzeugen durch technische Mängel oder ungesicherte Ladung.",
   "massnahme": "Feste Trennwände, Einbauten und Zurrösen; Ladungssicherung mit Netzen oder Spanngurten.\nRegelmäßige Prüfung durch Fachbetrieb; Fahrerlaubnisse regelmäßig kontrollieren."
  },
  "quelle": "BG ETEM"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Schwere körperliche Belastung durch Heben, Tragen, Zwangshaltungen und Knien.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Schwere körperliche Belastung durch Heben, Tragen, Zwangshaltungen und Knien.",
   "massnahme": "Technische Hilfsmittel für den Materialtransport einsetzen (z. B. Schubkarre, Transportzange, Saugheber); höhenverstellbare Geräte nutzen.\nLastgewichte und Gebindegrößen reduzieren; Transportwege kurz halten; Haltungswechsel und Kurzpausen einplanen.\nIn rückengerechter Hebe- und Tragetechnik unterweisen; Knieschutz verwenden."
  },
  "quelle": "BG BAU Baustein D 506, Stand 07/2021"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Brand- und Explosionsgefahr durch Druckgasflaschen (z. B. Flüssiggas).",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Brand- und Explosionsgefahr durch Druckgasflaschen (z. B. Flüssiggas).",
   "massnahme": "Flaschen gegen Umfallen sichern, Ventile schützen; Lagerung in Kellern, Fluren und Treppenräumen unzulässig.\nNur mit geschlossenen Ventilen und Schutzkappen transportieren, auf Fahrzeugen verzurren; Feuerlöscher mitführen."
  },
  "quelle": "BG BAU Bausteine A 063, A 064, A 065"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Fehlende oder defekte persönliche Schutzausrüstung bzw. fehlende Kenntnis über deren Benutzung.",
  "werte": {
   "faktor": "qualifikation",
   "beschreibung": "Fehlende oder defekte persönliche Schutzausrüstung bzw. fehlende Kenntnis über deren Benutzung.",
   "massnahme": "Bedarfsgerechte PSA bereitstellen (z. B. Helm, Sicherheitsschuhe, Schutzbrille, Gehörschutz, Handschuhe).\nBeschäftigte im Umgang mit der PSA unterweisen."
  },
  "quelle": "BG ETEM"
 },
 {
  "gruppe": "Handwerk",
  "titel": "Arbeitsbedingte psychische Belastungen (z. B. Über-/Unterforderung, Stress, soziale Konflikte).",
  "werte": {
   "faktor": "psychisch",
   "beschreibung": "Arbeitsbedingte psychische Belastungen (z. B. Über-/Unterforderung, Stress, soziale Konflikte).",
   "massnahme": "Problembereiche unter Einbindung der Beschäftigten ermitteln (z. B. Befragung).\nLösungen erarbeiten und umsetzen."
  },
  "quelle": "BG ETEM"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Stolpern, Ausrutschen und Stürzen auf Böden und Verkehrswegen.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Stolpern, Ausrutschen und Stürzen auf Böden und Verkehrswegen.",
   "massnahme": "Ebene, trittsichere Böden; Stolperstellen und Schwellen beseitigen; Sauberlaufzonen.\nWege frei und sauber halten; rutschhemmende Reinigungsmittel; Schnee und Eis im Außenbereich entfernen.\nGeeignetes Schuhwerk tragen."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Ungünstiges Raumklima (Kälte, Zugluft, Hitze).",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Ungünstiges Raumklima (Kälte, Zugluft, Hitze).",
   "massnahme": "Zugluft vermeiden (Türschleier, Windfang); Sonnenschutz außen.\nBüro: Mindesttemperatur 20 °C; bei mehr als 26 °C Getränke und Trinkpausen anbieten."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Unzureichende oder blendende Beleuchtung.",
  "werte": {
   "faktor": "arbeitsstaette",
   "beschreibung": "Unzureichende oder blendende Beleuchtung.",
   "massnahme": "Nennbeleuchtungsstärken einhalten (z. B. Verkaufsraum 300 Lux, Büro 500 Lux); flimmerfreie Leuchten.\nBlendung durch Sonne mit Jalousien oder Rollos vermeiden; Leuchtenabdeckungen reinigen."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Einseitige Körperhaltung bei Bildschirmarbeit.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Einseitige Körperhaltung bei Bildschirmarbeit.",
   "massnahme": "Höhenverstellbarer Schreibtisch (mind. 80 × 160 cm) mit ausreichender Beinfreiheit und ergonomischer Stuhl.\nRegelmäßige Unterbrechung des Sitzens ermöglichen."
  },
  "quelle": "BG ETEM"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Visuelle Belastung bei Bildschirmarbeit.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Visuelle Belastung bei Bildschirmarbeit.",
   "massnahme": "Ausreichend großer, einstellbarer, reflexionsfreier Bildschirm; Aufstellung 90° zum Lichteinfall.\nArbeitsmedizinische Vorsorge (Augen/Sehvermögen) anbieten."
  },
  "quelle": "BG ETEM"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Absturz von Leitern und Tritten.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Absturz von Leitern und Tritten.",
   "massnahme": "Ausreichend geeignete Leitern und Tritte bereitstellen; keine Kisten oder Stühle als Ersatz.\nStandsicher aufstellen, nicht übersteigen oder seitlich hinauslehnen; vor Gebrauch auf Mängel prüfen."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Schnittverletzungen beim Öffnen von Verpackungen mit Messern und Cuttern.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Schnittverletzungen beim Öffnen von Verpackungen mit Messern und Cuttern.",
   "massnahme": "Sicherheitsmesser mit verdeckter oder selbsttätig zurückgezogener Klinge verwenden.\nStumpfe Klingen wechseln, schadhafte Messer aussondern."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Elektrische Gefährdung durch beschädigte Geräte und Leitungen.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Elektrische Gefährdung durch beschädigte Geräte und Leitungen.",
   "massnahme": "Leitungen nicht durch Tür- oder Fensteröffnungen führen; keine hintereinander gesteckten Mehrfachsteckdosen.\nGeräte und Leitungen vor Gebrauch auf Schäden prüfen; schadhafte Geräte sofort aus dem Verkehr ziehen, Reparatur nur durch Elektrofachkraft.\nElektrische Geräte regelmäßig prüfen lassen."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Umstürzende Regale und herabfallendes Lagergut.",
  "werte": {
   "faktor": "arbeitsmittel",
   "beschreibung": "Umstürzende Regale und herabfallendes Lagergut.",
   "massnahme": "Regale standsicher aufstellen; Anfahrschutz anbringen.\nZulässige Fach- und Feldlasten einhalten; Regale regelmäßig prüfen, Mängel sofort melden."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Belastung durch Heben, Tragen, Ziehen und Schieben von Waren.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Belastung durch Heben, Tragen, Ziehen und Schieben von Waren.",
   "massnahme": "Hebe- und Transporthilfen bereitstellen.\nKleinere Gebinde bestellen; schwere Gebinde unten lagern; schwere Lasten zu zweit tragen oder aufteilen; Tätigkeiten wechseln."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Fehlbelastung am Kassen- oder Steharbeitsplatz.",
  "werte": {
   "faktor": "ablaeufe_arbeitszeit",
   "beschreibung": "Fehlbelastung am Kassen- oder Steharbeitsplatz.",
   "massnahme": "Arbeitsfläche auf Ellbogenhöhe; Kasse ergonomisch gestalten; ausreichender Beinfreiraum; Stehhilfe an Steharbeitsplätzen.\nStuhl und Fußstütze personenbezogen einstellen."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Überfallgefahr beim Umgang mit Bargeld.",
  "werte": {
   "faktor": "psychisch",
   "beschreibung": "Überfallgefahr beim Umgang mit Bargeld.",
   "massnahme": "Tresor oder Zeitschloss; Alarmierungsmöglichkeit sicherstellen.\nBargeld regelmäßig abschöpfen, Zählen nicht einsehbar; bargeldloses Bezahlen fördern; Geldtransport unauffällig und zu zweit.\nNotfallplan erstellen; Betriebsanweisung zum Verhalten bei Überfällen."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Psychische Belastungen durch Arbeitsinhalt, Arbeitsorganisation oder soziale Beziehungen.",
  "werte": {
   "faktor": "psychisch",
   "beschreibung": "Psychische Belastungen durch Arbeitsinhalt, Arbeitsorganisation oder soziale Beziehungen.",
   "massnahme": "Belastungen mit anerkannten Verfahren erfassen (Beobachtung, Befragung, Workshop) und Beschäftigte einbinden.\nMaßnahmen ableiten, umsetzen und ihre Wirksamkeit dokumentieren."
  },
  "quelle": "BGHW"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Brandentstehung und unzureichende Möglichkeiten zur Brandbekämpfung und Flucht.",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Brandentstehung und unzureichende Möglichkeiten zur Brandbekämpfung und Flucht.",
   "massnahme": "Geeignete Feuerlöscher in ausreichender Zahl (Prüfung alle zwei Jahre); Standorte kennzeichnen und freihalten.\nNicht benötigte Geräte abschalten; Sicherheitsabstand zu brennbarem Material; Brandschutztüren nicht festkeilen.\nAusreichend Beschäftigte im Umgang mit Feuerlöscheinrichtungen unterweisen und üben lassen."
  },
  "quelle": "BGHW A 131 (Stand 06/2022); § 22 Abs. 2 DGUV Vorschrift 1"
 },
 {
  "gruppe": "Büro / Laden",
  "titel": "Unzureichende Erste Hilfe bei Unfällen.",
  "werte": {
   "faktor": "sonstiges",
   "beschreibung": "Unzureichende Erste Hilfe bei Unfällen.",
   "massnahme": "Verbandmaterial bereitstellen und regelmäßig prüfen.\nErsthelfer benennen und ausbilden (bei 2 bis 20 anwesenden Versicherten mindestens ein Ersthelfer; darüber in Verwaltungs- und Handelsbetrieben 5 %), alle zwei Jahre fortbilden.\nJede Erste-Hilfe-Leistung dokumentieren (z. B. Verbandbuch) und fünf Jahre verfügbar halten."
  },
  "quelle": "§§ 24 Abs. 6, 26 Abs. 1 DGUV Vorschrift 1"
 }
];

export const MUTTERSCHUTZ: Option[] = [
 {
  "wert": "keine_massnahmen",
  "text": "Für schwangere oder stillende Frauen werden voraussichtlich keine Schutzmaßnahmen erforderlich sein.",
  "quelle": "§ 10 Abs. 1 Satz 1 Nr. 2 Buchst. a MuSchG"
 },
 {
  "wert": "umgestaltung",
  "text": "Für schwangere oder stillende Frauen wird voraussichtlich eine Umgestaltung der Arbeitsbedingungen nach § 13 Abs. 1 Nr. 1 MuSchG erforderlich sein.",
  "quelle": "§ 10 Abs. 1 Satz 1 Nr. 2 Buchst. b MuSchG"
 },
 {
  "wert": "fortfuehrung_nicht_moeglich",
  "text": "Eine Fortführung der Tätigkeit einer schwangeren oder stillenden Frau an diesem Arbeitsplatz wird voraussichtlich nicht möglich sein.",
  "quelle": "§ 10 Abs. 1 Satz 1 Nr. 2 Buchst. c MuSchG"
 }
];

export const UNTERWEISUNGSTHEMEN: (Option & { branchen: string[] })[] = [
 {
  "wert": "gefaehrdungen_am_eigenen_arbeitsplatz_un",
  "text": "Gefährdungen am eigenen Arbeitsplatz und festgelegte Schutzmaßnahmen (Ergebnis der Gefährdungsbeurteilung)",
  "quelle": "§ 12 ArbSchG",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "erste_hilfe_ersthelfer_standort_verbandk",
  "text": "Erste Hilfe: Ersthelfer, Standort Verbandkasten, Notrufnummer, Dokumentation im Verbandbuch",
  "quelle": "§§ 24, 26 DGUV Vorschrift 1; BGHW A 131",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "brandschutz_verhalten_im_brandfall_umgan",
  "text": "Brandschutz: Verhalten im Brandfall, Umgang mit Feuerlöschern, Flucht- und Rettungswege",
  "quelle": "§ 22 Abs. 2 DGUV Vorschrift 1",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "stolper_rutsch_und_sturzgefahren_ordnung",
  "text": "Stolper-, Rutsch- und Sturzgefahren; Ordnung und Sauberkeit auf Verkehrswegen",
  "quelle": "BGHW",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "sichere_benutzung_von_leitern_und_tritte",
  "text": "Sichere Benutzung von Leitern und Tritten",
  "quelle": "BG ETEM",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "elektrische_geraete_sichtpruefung_vor_be",
  "text": "Elektrische Geräte: Sichtprüfung vor Benutzung, Mängel melden, defekte Geräte nicht benutzen",
  "quelle": "BGW",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "gefahrstoffe_inhalt_der_betriebsanweisun",
  "text": "Gefahrstoffe: Inhalt der Betriebsanweisungen, Gefahren, Schutzmaßnahmen, Zugang zu Sicherheitsdatenblättern",
  "quelle": "BGN",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "hautschutz_hautschutzplan_richtige_schut",
  "text": "Hautschutz: Hautschutzplan, richtige Schutzhandschuhe, Hautreinigung und -pflege",
  "quelle": "TRGS 401",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "persoenliche_schutzausruestung_auswahl_b",
  "text": "Persönliche Schutzausrüstung: Auswahl, Benutzung, Pflege",
  "quelle": "BG ETEM",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "heben_und_tragen_hilfsmittel_rueckengere",
  "text": "Heben und Tragen: Hilfsmittel, rückengerechte Technik",
  "quelle": "BG BAU",
  "branchen": [
   "gastro_cafe",
   "handwerk_allgemein",
   "buero_laden"
  ]
 },
 {
  "wert": "psychische_belastungen_verhalten_bei_kon",
  "text": "Psychische Belastungen: Verhalten bei Konflikten, Aggression und Übergriffen, Unterstützungsangebote",
  "quelle": "BGW",
  "branchen": [
   "alle"
  ]
 },
 {
  "wert": "friseurchemikalien_faerbe_blondier_dauer",
  "text": "Friseurchemikalien (Färbe-, Blondier-, Dauerwellmittel): Mischen, Anwenden, Handschuhpflicht, Lüftung",
  "quelle": "TRGS 530",
  "branchen": [
   "friseur"
  ]
 },
 {
  "wert": "feuchtarbeit_und_hautschutz_im_salon_hau",
  "text": "Feuchtarbeit und Hautschutz im Salon (Hautschutz- und Händehygieneplan)",
  "quelle": "BGW",
  "branchen": [
   "friseur",
   "kosmetik"
  ]
 },
 {
  "wert": "infektionsschutz_und_hygiene_stich_und_s",
  "text": "Infektionsschutz und Hygiene: Stich- und Schnittverletzungen, Umgang mit Blut, Instrumentenaufbereitung",
  "quelle": "BGW",
  "branchen": [
   "kosmetik"
  ]
 },
 {
  "wert": "bedienung_hoehenverstellbarer_behandlung",
  "text": "Bedienung höhenverstellbarer Behandlungsliegen (auch für Reinigungskräfte)",
  "quelle": "BGW",
  "branchen": [
   "kosmetik"
  ]
 },
 {
  "wert": "fritteusen_verbruehungsrisiko_und_fettbr",
  "text": "Fritteusen: Verbrühungsrisiko und Fettbrand, Löschen mit Brandklasse-F-Löscher",
  "quelle": "BGN",
  "branchen": [
   "gastro_cafe"
  ]
 },
 {
  "wert": "laerm_gehoerschutz_ab_80_85_db_a",
  "text": "Lärm: Gehörschutz ab 80/85 dB(A)",
  "quelle": "BG BAU",
  "branchen": [
   "handwerk_allgemein",
   "gastro_cafe"
  ]
 },
 {
  "wert": "staubarmes_arbeiten_absaugung_nassbearbe",
  "text": "Staubarmes Arbeiten (Absaugung, Nassbearbeitung, Reinigung mit Industriesauger)",
  "quelle": "BG BAU",
  "branchen": [
   "handwerk_allgemein"
  ]
 },
 {
  "wert": "umgang_mit_zahlungsmitteln_und_verhalten",
  "text": "Umgang mit Zahlungsmitteln und Verhalten bei Überfällen",
  "quelle": "BGHW",
  "branchen": [
   "buero_laden"
  ]
 },
 {
  "wert": "bildschirmarbeit_einstellung_von_tisch_s",
  "text": "Bildschirmarbeit: Einstellung von Tisch, Stuhl und Bildschirm",
  "quelle": "BG ETEM",
  "branchen": [
   "buero_laden"
  ]
 }
];

export const BA_GLIEDERUNG: { nr: string; abschnitt: string; inhalt: string }[] = [
 {
  "nr": "3.2.2",
  "abschnitt": "Arbeitsbereich, Arbeitsplatz, Tätigkeit",
  "inhalt": "Betrieb, Arbeitsbereich, Arbeitsplatz und Tätigkeit, für die die Betriebsanweisung gilt."
 },
 {
  "nr": "3.2.3",
  "abschnitt": "Gefahrstoffe (Bezeichnung)",
  "inhalt": "Bezeichnung, die den Beschäftigten geläufig ist; bei Gemischen in der Regel der Handelsname; Angabe gefahrbestimmender Komponenten empfohlen."
 },
 {
  "nr": "3.2.4",
  "abschnitt": "Gefahren für Mensch und Umwelt",
  "inhalt": "Aus der Gefährdungsbeurteilung abgeleitete Gefahren, H- und EUH-Sätze im Wortlaut oder sinngemäß; weitere Gefährdungen (z. B. Staub, Brand/Explosion); Gefahrenpiktogramme ergänzend."
 },
 {
  "nr": "3.2.5",
  "abschnitt": "Schutzmaßnahmen und Verhaltensregeln",
  "inhalt": "Gegliedert nach technischen und organisatorischen Maßnahmen, Hygiene und Arbeitskleidung sowie persönlicher Schutzausrüstung (Art, Typ, Benutzungshinweise); Hinweise auf Beschäftigungsbeschränkungen empfohlen."
 },
 {
  "nr": "3.2.6",
  "abschnitt": "Verhalten im Gefahrfall",
  "inhalt": "Maßnahmen bei Störungen, Unfällen, Notfällen (z. B. Leckage, Brand); geeignete und ungeeignete Löschmittel; Binde-, Aufsaug- und Neutralisationsmittel; Umweltschutzmaßnahmen; ggf. Hinweis auf Alarm-, Flucht- und Rettungspläne."
 },
 {
  "nr": "3.2.7",
  "abschnitt": "Erste Hilfe",
  "inhalt": "Gegliedert nach Einatmen, Haut- und Augenkontakt, Verschlucken (ggf. Verbrennungen/Erfrierungen); Sofortmaßnahmen, wann ein Arzt hinzuzuziehen ist, was zu unterlassen ist; Ersthelfer, Erste-Hilfe-Einrichtungen, Notrufnummern."
 },
 {
  "nr": "3.2.8",
  "abschnitt": "Sachgerechte Entsorgung",
  "inhalt": "Schutzmaßnahmen für betriebliche und störungsbedingte Abfälle; PSA, Entsorgungsbehälter, Sammelstellen, Aufsaugmittel."
 }
];

export const BA_BAUSTEINE: Record<string, Option[]> = {
 "schutzmassnahmen": [
  {
   "wert": "schutzhandschuhe_bei_den_gekennzeichnete",
   "text": "Schutzhandschuhe bei den gekennzeichneten Tätigkeiten tragen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "schutzhandschuhe_nur_mit_sauberen_trocke",
   "text": "Schutzhandschuhe nur mit sauberen, trockenen Händen anziehen.",
   "quelle": "TRGS 401 Nr. 5.5.3 Abs. 1"
  },
  {
   "wert": "beschaedigte_handschuhe_sofort_austausch",
   "text": "Beschädigte Handschuhe sofort austauschen.",
   "quelle": "BGW"
  },
  {
   "wert": "chemikalienschutzhandschuhe_regelmaessig",
   "text": "Chemikalienschutzhandschuhe regelmäßig, spätestens arbeitstäglich wechseln; maximale Tragedauer beachten.",
   "quelle": "TRGS 401 Nr. 5.5.3 Abs. 4"
  },
  {
   "wert": "bei_aetzenden_stoffen_schutzbrille_trage",
   "text": "Bei ätzenden Stoffen Schutzbrille tragen.",
   "quelle": "BGW 04-05-080, S. 21–22"
  },
  {
   "wert": "produkte_nur_nach_herstellerangaben_anwe",
   "text": "Produkte nur nach Herstellerangaben anwenden; Konzentrate genau nach Anleitung dosieren.",
   "quelle": "BGW"
  },
  {
   "wert": "desinfektion_im_wischverfahren_durchfueh",
   "text": "Desinfektion im Wischverfahren durchführen; nicht sprühen oder vernebeln.",
   "quelle": "BGW"
  },
  {
   "wert": "fuer_ausreichende_lueftung_sorgen_sprueh",
   "text": "Für ausreichende Lüftung sorgen; Sprühnebel, Stäube und Dämpfe nicht einatmen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "am_arbeitsplatz_nicht_essen_trinken_oder",
   "text": "Am Arbeitsplatz nicht essen, trinken oder rauchen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "gefahrstoffe_moeglichst_in_originalbehae",
   "text": "Gefahrstoffe möglichst in Originalbehältern aufbewahren; abgefüllte Stoffe korrekt beschriften; niemals in Lebensmittel- oder Getränkebehälter abfüllen.",
   "quelle": "BGW"
  },
  {
   "wert": "gefahrstoffe_getrennt_von_lebensmitteln_",
   "text": "Gefahrstoffe getrennt von Lebensmitteln und nicht über Augenhöhe lagern.",
   "quelle": "BGW"
  },
  {
   "wert": "am_arbeitsplatz_hoechstens_den_tagesbeda",
   "text": "Am Arbeitsplatz höchstens den Tagesbedarf an entzündbaren Flüssigkeiten bereithalten.",
   "quelle": "BGW"
  },
  {
   "wert": "verunreinigte_oder_mit_chemikalien_getra",
   "text": "Verunreinigte oder mit Chemikalien getränkte Kleidung sofort ablegen und vor dem erneuten Tragen waschen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "arm_und_handschmuck_bei_der_arbeit_ableg",
   "text": "Arm- und Handschmuck bei der Arbeit ablegen.",
   "quelle": "TRGS 530 Nr. 5.1 Abs. 3"
  },
  {
   "wert": "hautschutzplan_beachten",
   "text": "Hautschutzplan beachten.",
   "quelle": "TRGS 401 Nr. 5.5.1 Abs. 6 (Verweis der Betriebsanweisung auf Hand- und Hautschutzplan)"
  }
 ],
 "gefahrfall": [
  {
   "wert": "verschuettete_substanz_sofort_mit_schutz",
   "text": "Verschüttete Substanz sofort mit Schutzhandschuhen aufnehmen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "verunreinigungen_und_behaelterrueckstaen",
   "text": "Verunreinigungen und Behälterrückstände sofort beseitigen; Bindemittel bereithalten.",
   "quelle": "BGW"
  }
 ],
 "erste_hilfe": [
  {
   "wert": "nach_augenkontakt_mit_viel_wasser_spuele",
   "text": "Nach Augenkontakt: mit viel Wasser spülen und ärztlichen Rat einholen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "nach_hautkontakt_mit_viel_wasser_spuelen",
   "text": "Nach Hautkontakt: mit viel Wasser spülen; bei Beschwerden ärztlichen Rat einholen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "nach_einatmen_bei_beschwerden_aerztliche",
   "text": "Nach Einatmen: bei Beschwerden ärztlichen Rat einholen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "nach_verschlucken_aerztlichen_rat_einhol",
   "text": "Nach Verschlucken: ärztlichen Rat einholen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "zum_arzt_gebrauchsanweisung_oder_packung",
   "text": "Zum Arzt Gebrauchsanweisung oder Packung bzw. Behältnis des Produkts mitnehmen.",
   "quelle": "TRGS 530"
  }
 ],
 "entsorgung": [
  {
   "wert": "entsorgung_mit_der_oertlichen_gewerbeabf",
   "text": "Entsorgung mit der örtlichen Gewerbeabfallberatung klären.",
   "quelle": "BGW"
  },
  {
   "wert": "restentleerte_spraydosen_sicher_entsorge",
   "text": "Restentleerte Spraydosen sicher entsorgen; auch geleerte Behälter entzündbarer Flüssigkeiten können Brand- und Explosionsgefahr verursachen.",
   "quelle": "TRGS 530"
  },
  {
   "wert": "nicht_mehr_benoetigte_produkte_fachgerec",
   "text": "Nicht mehr benötigte Produkte fachgerecht entsorgen.",
   "quelle": "BGHW"
  }
 ]
};

export const HAUTSCHUTZ_FRISEUR: Vorschlag[] = [
 {
  "gruppe": "Friseur",
  "titel": "Shampoonieren, Kopfmassage mit Haarbehandlungsmitteln, Pflegemittel auftragen/auswaschen",
  "werte": {
   "anlass": "Shampoonieren, Kopfmassage mit Haarbehandlungsmitteln, Pflegemittel auftragen/auswaschen",
   "schutz": "Hände mit Hautschutzpräparat eincremen",
   "handschuhe": "Einmalhandschuhe, langstulpig (alternativ Waschhandschuhe); laut BGW 2026: Einmalhandschuhe aus Nitril oder Vinyl mit langen Stulpen über das Handgelenk",
   "reinigung": "Hände nur bei Verschmutzung waschen, ggf. mit pH-hautneutralem Reinigungsmittel; gut abtrocknen; eincremen",
   "pflege": "Hände mit Hautpflegepräparat eincremen"
  },
  "quelle": "TRGS 530 / BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Färben, Dauerwelle, Blondierung: Mischen, Auftragen, Überprüfen, Probewickeln, Fixieren",
  "werte": {
   "anlass": "Färben, Dauerwelle, Blondierung: Mischen, Auftragen, Überprüfen, Probewickeln, Fixieren",
   "schutz": "Hände mit Hautschutzpräparat eincremen",
   "handschuhe": "Einmalhandschuhe (keine gepuderten Latexhandschuhe); laut BGW 2026: Friseur-Einmalhandschuhe nach DIN EN ISO 374-6 (Friseur-Symbol)",
   "reinigung": "Hände nur bei Verschmutzung waschen, ggf. mit pH-hautneutralem Reinigungsmittel; gut abtrocknen; eincremen",
   "pflege": "Hände mit Hautpflegepräparat eincremen"
  },
  "quelle": "TRGS 530 / BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Färben, Dauerwelle, Blondierung: Aufemulgieren, Auswaschen",
  "werte": {
   "anlass": "Färben, Dauerwelle, Blondierung: Aufemulgieren, Auswaschen",
   "schutz": "Hände mit Hautschutzpräparat eincremen",
   "handschuhe": "Einmalhandschuhe, langstulpig",
   "reinigung": "Hände nur bei Verschmutzung waschen, ggf. mit pH-hautneutralem Reinigungsmittel; gut abtrocknen; eincremen",
   "pflege": "Hände mit Hautpflegepräparat eincremen"
  },
  "quelle": "TRGS 530 / BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Styling, Kopfmassage ohne Haarbehandlungsmittel",
  "werte": {
   "anlass": "Styling, Kopfmassage ohne Haarbehandlungsmittel",
   "schutz": "Hände mit Hautschutzpräparat eincremen",
   "handschuhe": "Einmalhandschuhe bei empfindlicher Haut",
   "reinigung": "Hände nur bei Verschmutzung waschen, ggf. mit pH-hautneutralem Reinigungsmittel; gut abtrocknen; eincremen",
   "pflege": "Hände mit Hautpflegepräparat eincremen"
  },
  "quelle": "TRGS 530 / BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Reinigung und Desinfektion von Arbeitsgeräten und Räumen",
  "werte": {
   "anlass": "Reinigung und Desinfektion von Arbeitsgeräten und Räumen",
   "schutz": "Hände mit Hautschutzpräparat eincremen",
   "handschuhe": "Haushaltshandschuhe; laut BGW 2026: chemikalienbeständige Schutzhandschuhe nach DIN EN ISO 374, ggf. mit längerem Schaft",
   "reinigung": "Hände nur bei Verschmutzung waschen, ggf. mit pH-hautneutralem Reinigungsmittel; gut abtrocknen; eincremen",
   "pflege": "Hände mit Hautpflegepräparat eincremen"
  },
  "quelle": "TRGS 530 / BGW"
 },
 {
  "gruppe": "Friseur",
  "titel": "Lange Handschuhtragezeiten (alle Tätigkeiten)",
  "werte": {
   "anlass": "Lange Handschuhtragezeiten (alle Tätigkeiten)",
   "schutz": "",
   "handschuhe": "Nahtlose Baumwoll-Unterziehhandschuhe; Handschuhe nur auf vollständig trockene Hände anziehen; beschädigte Handschuhe sofort austauschen",
   "reinigung": "",
   "pflege": ""
  },
  "quelle": "TRGS 530 / BGW"
 }
];

export const ELEKTRO_FRISTEN: (Option & { unsicher?: boolean })[] = [
 {
  "wert": "ortsveraenderliche_elektrische_betriebsm",
  "text": "Ortsveränderliche elektrische Betriebsmittel (soweit benutzt), Verlängerungs- und Geräteanschlussleitungen mit Steckvorrichtungen, Anschlussleitungen mit Stecker, bewegliche Leitungen mit Stecker und Festanschluss – allgemein: Richtwert 6 Monate",
  "quelle": "DGUV Vorschrift 3, Durchführungsanweisung zu § 5, Tabelle 1B"
 },
 {
  "wert": "baustellen",
  "text": "Baustellen: Richtwert 3 Monate, höchstens 1 Jahr bei Fehlerquote unter 2 %",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1B"
 },
 {
  "wert": "fertigungsstaetten_werkstaetten_oder_unt",
  "text": "Fertigungsstätten, Werkstätten oder unter ähnlichen Bedingungen: Richtwert 6 Monate, höchstens 1 Jahr bei Fehlerquote unter 2 %",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1B"
 },
 {
  "wert": "bueros_oder_unter_aehnlichen_bedingungen",
  "text": "Büros oder unter ähnlichen Bedingungen: Richtwert 6 Monate, höchstens 2 Jahre bei Fehlerquote unter 2 %",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1B"
 },
 {
  "wert": "elektrische_anlagen_und_ortsfeste_betrie",
  "text": "Elektrische Anlagen und ortsfeste Betriebsmittel: Richtwert 4 Jahre",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1A"
 },
 {
  "wert": "elektrische_anlagen_und_ortsfeste_betrie",
  "text": "Elektrische Anlagen und ortsfeste Betriebsmittel in Betriebsstätten, Räumen und Anlagen besonderer Art (DIN VDE 0100 Gruppe 700): Richtwert 1 Jahr",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1A"
 },
 {
  "wert": "schutzmassnahmen_mit_fehlerstrom_schutze",
  "text": "Schutzmaßnahmen mit Fehlerstrom-Schutzeinrichtungen in nichtstationären Anlagen (Prüfung auf Wirksamkeit): Richtwert 1 Monat",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1A"
 },
 {
  "wert": "fehlerstrom_differenzstrom_und_fehlerspa",
  "text": "Fehlerstrom-, Differenzstrom- und Fehlerspannungs-Schutzschalter: Betätigen der Prüfeinrichtung durch den Benutzer: Richtwert stationäre Anlagen: 6 Monate; nichtstationäre Anlagen: arbeitstäglich",
  "quelle": "DGUV Vorschrift 3, DA zu § 5, Tabelle 1A",
  "unsicher": true
 }
];

export const GEFAHRSTOFF_ANGABEN: string[] = [
 "Bezeichnung des Gefahrstoffs",
 "Einstufung des Gefahrstoffs oder Angaben zu den gefährlichen Eigenschaften",
 "Angaben zu den im Betrieb verwendeten Mengenbereichen",
 "Bezeichnung der Arbeitsbereiche, in denen Beschäftigte dem Gefahrstoff exponiert sein können",
 "Verweis auf die entsprechenden Sicherheitsdatenblätter"
];

export const VVT: Vorschlag[] = [
 {
  "titel": "Kundenverwaltung / Kundenkartei",
  "werte": {
   "bezeichnung": "Kundenverwaltung / Kundenkartei",
   "zweck": "Bearbeitung von Aufträgen und Kundenbeziehungen einschließlich Rechnungsstellung; ggf. postalische Werbung an Bestandskunden",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO (Vertrag/vorvertragliche Maßnahmen); Art. 6 Abs. 1 lit. c DSGVO i. V. m. § 147 AO, § 257 HGB (Aufbewahrung); Art. 6 Abs. 1 lit. f DSGVO (postalische Bestandskundenwerbung). Bei Gesundheitsangaben (z. B. Allergien/Unverträglichkeiten in der Friseur-Kundenkartei) ausdrückliche Einwilligung nach Art. 9 Abs. 2 lit. a DSGVO.",
   "betroffene": "Kunden, Interessenten",
   "datenarten": "Name, Anschrift, Kontaktdaten (Telefon, E-Mail), Angaben zum Auftrag / Leistungshistorie, ggf. Bankverbindung, ggf. Gesundheitsdaten (nur mit ausdrücklicher Einwilligung)",
   "empfaenger": "Steuerberater (eigenständiger Verantwortlicher), IT-/Software-Dienstleister (Auftragsverarbeiter)",
   "loeschfrist": "Kundenstammdaten löschen, sobald kein Zweck und keine Aufbewahrungspflicht mehr besteht (z. B. Kunde erteilt über mehrere Jahre keine Aufträge mehr). Rechnungsrelevante Unterlagen: Buchungsbelege 8 Jahre (§ 147 Abs. 1 Nr. 4, Abs. 3 AO; § 257 Abs. 1 Nr. 4, Abs. 4 HGB), Geschäftsbriefe 6 Jahre (§ 147 Abs. 1 Nr. 2, 3 AO; § 257 Abs. 1 Nr. 2, 3 HGB), jeweils ab Ende des Kalenderjahres.",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "BayLDA"
 },
 {
  "titel": "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)",
  "werte": {
   "bezeichnung": "Terminvereinbarung (telefonisch, vor Ort oder Online-Buchung)",
   "zweck": "Planung, Bestätigung und Erinnerung von Kundenterminen",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO; Terminerinnerung per SMS/E-Mail: Art. 6 Abs. 1 lit. b DSGVO, soweit vertragsbezogen, sonst Art. 6 Abs. 1 lit. a DSGVO",
   "betroffene": "Kunden, Interessenten",
   "datenarten": "Name, Telefonnummer / E-Mail, Termin (Datum, Uhrzeit, gewünschte Leistung), ggf. Notizen",
   "empfaenger": "Anbieter des Online-Terminbuchungssystems (Auftragsverarbeiter)",
   "loeschfrist": "Keine spezielle gesetzliche Frist. Löschung nach Wegfall des Zwecks (nach Terminwahrnehmung), soweit die Daten nicht in die Kundenkartei oder Rechnung übernommen werden (Art. 5 Abs. 1 lit. e, Art. 17 Abs. 1 lit. a DSGVO).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "DSGVO"
 },
 {
  "titel": "Rechnungsstellung und Buchhaltung",
  "werte": {
   "bezeichnung": "Rechnungsstellung und Buchhaltung",
   "zweck": "Erstellung von Rechnungen, Finanzbuchhaltung, Erfüllung steuer- und handelsrechtlicher Pflichten",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO; Art. 6 Abs. 1 lit. c DSGVO i. V. m. §§ 140 ff., 147 AO, §§ 238, 257 HGB, § 14 UStG",
   "betroffene": "Kunden, Lieferanten, Geschäftspartner (Ansprechpersonen)",
   "datenarten": "Name, Anschrift, Rechnungs- und Zahlungsdaten, Bankverbindung, ggf. USt-IdNr.",
   "empfaenger": "Steuerberater (eigenständiger Verantwortlicher), Finanzamt, Kreditinstitute, Buchhaltungssoftware-Anbieter (Auftragsverarbeiter)",
   "loeschfrist": "Bücher, Aufzeichnungen, Jahresabschlüsse, Inventare: 10 Jahre; Buchungsbelege: 8 Jahre (seit 01.01.2025); Handels-/Geschäftsbriefe: 6 Jahre – jeweils ab Ende des Kalenderjahres (§ 147 Abs. 1, 3, 4 AO; § 257 Abs. 1, 4, 5 HGB).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "§ 147 AO"
 },
 {
  "titel": "Lohn- und Gehaltsabrechnung",
  "werte": {
   "bezeichnung": "Lohn- und Gehaltsabrechnung",
   "zweck": "Auszahlung der Löhne/Gehälter; Abführung von Sozialabgaben und Steuern",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b und lit. c DSGVO (Arbeitsvertrag; Pflichten aus EStG, SGB IV, AO); für Religionszugehörigkeit (Kirchensteuer) Art. 9 Abs. 2 lit. b DSGVO",
   "betroffene": "Beschäftigte, Auszubildende, Minijobber",
   "datenarten": "Name, Geburtsdatum, Anschrift, Bankverbindung, Lohn-/Entgeltdaten, ggf. Religionszugehörigkeit, Sozialversicherungsdaten, Steuerdaten (Steuer-ID, Steuerklasse, Freibeträge), Angaben zur Berufsgenossenschaft",
   "empfaenger": "Steuerberater / Lohnbüro, Finanzamt, Sozialversicherungsträger / Krankenkassen, Berufsgenossenschaft, Kreditinstitut",
   "loeschfrist": "Lohnbelege als Buchungsbelege 8 Jahre (§ 147 Abs. 1 Nr. 4, Abs. 3 AO); Lohnkonto bis zum Ablauf des sechsten Kalenderjahres nach der letzten Eintragung (§ 41 Abs. 1 EStG).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "BayLDA"
 },
 {
  "titel": "Personalverwaltung (Personalakte, Arbeitszeit)",
  "werte": {
   "bezeichnung": "Personalverwaltung (Personalakte, Arbeitszeit)",
   "zweck": "Personaladministration, Personalführung, Arbeitszeitverwaltung",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b und lit. c DSGVO (Arbeitsvertrag; arbeitsrechtliche Pflichten, z. B. Arbeitszeitaufzeichnung)",
   "betroffene": "Beschäftigte, Auszubildende",
   "datenarten": "Name, Anschrift, Vertragsdaten, Zeitwirtschaftsdaten, Daten zur Arbeitsleistung, Leistungsbeurteilungen, Urlaubs- und Krankheitszeiten (ohne Diagnosen)",
   "empfaenger": "Steuerberater / Lohnbüro, ggf. Anbieter der Zeiterfassungssoftware (Auftragsverarbeiter)",
   "loeschfrist": "Personalakte in der Regel ca. 3 Jahre nach Ausscheiden (BayLDA-Muster; Orientierung an regelmäßiger Verjährung § 195 BGB); steuer-/sozialversicherungsrelevante Unterlagen nach den gesetzlichen Fristen.",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "BayLDA"
 },
 {
  "titel": "Bewerbungsverfahren",
  "werte": {
   "bezeichnung": "Bewerbungsverfahren",
   "zweck": "Durchführung von Bewerbungsverfahren und Auswahl von Beschäftigten",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO (Anbahnung des Beschäftigungsverhältnisses); Aufbewahrung nach Absage zur Abwehr von Ansprüchen: Art. 6 Abs. 1 lit. f DSGVO; Aufnahme in einen Bewerberpool nur mit Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)",
   "betroffene": "Bewerberinnen und Bewerber",
   "datenarten": "Name, Kontaktdaten, Lebenslauf, Zeugnisse, Qualifikationen, Anschreiben, ggf. Gesprächsnotizen",
   "empfaenger": "intern: an der Auswahl beteiligte Personen, ggf. Anbieter einer Bewerbungsplattform (Auftragsverarbeiter)",
   "loeschfrist": "Abgelehnte Bewerber: 6 Monate nach Abschluss des Bewerbungsverfahrens (BayLDA-Muster). Hintergrund: Geltendmachung von Ansprüchen nach § 15 Abs. 4 AGG binnen 2 Monaten ab Zugang der Ablehnung, Klagefrist § 61b Abs. 1 ArbGG 3 Monate nach schriftlicher Geltendmachung.",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "BayLDA"
 },
 {
  "titel": "Betrieb der Website (Hosting, Server-Logfiles)",
  "werte": {
   "bezeichnung": "Betrieb der Website (Hosting, Server-Logfiles)",
   "zweck": "Darstellung des Unternehmens im Internet; technische Bereitstellung und Sicherheit der Website",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an sicherer, funktionsfähiger Bereitstellung); Zugriff auf Endgeräte (Cookies u. Ä.) nur mit Einwilligung nach § 25 Abs. 1 TDDDG, es sei denn unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG)",
   "betroffene": "Website-Besucher",
   "datenarten": "IP-Adresse, Datum und Uhrzeit des Abrufs, abgerufene Seite/Datei, Browser- und Betriebssysteminformationen, Referrer-URL",
   "empfaenger": "Hosting-Dienstleister (Auftragsverarbeiter, AV-Vertrag erforderlich)",
   "loeschfrist": "IP-Adressen in Logfiles nach 30 Tagen (BayLDA-Muster).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "BayLDA"
 },
 {
  "titel": "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)",
  "werte": {
   "bezeichnung": "Kontaktanfragen (Kontaktformular, E-Mail, Telefon)",
   "zweck": "Bearbeitung und Beantwortung von Anfragen",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Anfragen); im Übrigen Art. 6 Abs. 1 lit. f DSGVO (Interesse an der Beantwortung von Anfragen)",
   "betroffene": "Interessenten, Kunden, sonstige anfragende Personen",
   "datenarten": "Name, E-Mail-Adresse / Telefonnummer, Inhalt der Anfrage, Zeitpunkt",
   "empfaenger": "Hosting-/E-Mail-Dienstleister (Auftragsverarbeiter)",
   "loeschfrist": "Nach abschließender Bearbeitung, sofern keine Aufbewahrungspflicht besteht; führt die Anfrage zu einem Geschäft, sind Geschäftsbriefe 6 Jahre aufzubewahren (§ 257 Abs. 1 Nr. 2, 3, Abs. 4 HGB; § 147 Abs. 1 Nr. 2, 3, Abs. 3 AO).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "DSGVO"
 },
 {
  "titel": "Geschäftliche E-Mail-Kommunikation",
  "werte": {
   "bezeichnung": "Geschäftliche E-Mail-Kommunikation",
   "zweck": "Kommunikation mit Kunden, Lieferanten, Behörden und Geschäftspartnern",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO; Art. 6 Abs. 1 lit. f DSGVO; Aufbewahrung von Handelsbriefen: Art. 6 Abs. 1 lit. c DSGVO i. V. m. § 257 HGB, § 147 AO",
   "betroffene": "Kunden, Lieferanten, Geschäftspartner, Beschäftigte",
   "datenarten": "Name, E-Mail-Adresse, Inhalte der Korrespondenz, Metadaten (Zeit, Absender, Empfänger)",
   "empfaenger": "E-Mail-Provider (Auftragsverarbeiter), ggf. IT-Dienstleister",
   "loeschfrist": "Handels- und Geschäftsbriefe (auch per E-Mail): 6 Jahre; E-Mails mit Belegfunktion (z. B. Rechnung): 8 Jahre (§ 257 Abs. 1, 4 HGB; § 147 Abs. 1, 3 AO). Übrige E-Mails nach Zweckerfüllung.",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "§ 257 HGB"
 },
 {
  "titel": "E-Mail-Newsletter / E-Mail-Werbung",
  "werte": {
   "bezeichnung": "E-Mail-Newsletter / E-Mail-Werbung",
   "zweck": "Information über Angebote und Neuigkeiten per E-Mail",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. a DSGVO i. V. m. § 7 Abs. 2 Nr. 2 UWG (Einwilligung, Double-Opt-in); Bestandskunden unter den Voraussetzungen des § 7 Abs. 3 UWG: Art. 6 Abs. 1 lit. f DSGVO",
   "betroffene": "Newsletter-Abonnenten, Bestandskunden",
   "datenarten": "E-Mail-Adresse, ggf. Name, Einwilligungsnachweis (Zeitpunkt, Wortlaut, Bestätigung), ggf. Öffnungs-/Klickdaten (nur mit Einwilligung)",
   "empfaenger": "Newsletter-Versanddienstleister (Auftragsverarbeiter)",
   "loeschfrist": "Löschung der Adresse aus dem Verteiler unverzüglich nach Abmeldung/Widerspruch; der Einwilligungsnachweis darf zur Rechtsverteidigung aufbewahrt werden – Richtwert 3 Jahre (Verjährung § 31 OWiG, § 195 BGB) laut DSK.",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "DSK"
 },
 {
  "titel": "Videoüberwachung (z. B. Verkaufsraum, Eingang, Lager)",
  "werte": {
   "bezeichnung": "Videoüberwachung (z. B. Verkaufsraum, Eingang, Lager)",
   "zweck": "Schutz vor Einbruch, Diebstahl und Vandalismus; Beweissicherung",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse; Interessenabwägung im Einzelfall)",
   "betroffene": "Kunden, Besucher, ggf. Beschäftigte, Lieferanten",
   "datenarten": "Bildaufnahmen (ggf. Zeitstempel)",
   "empfaenger": "im Anlassfall Polizei / Strafverfolgungsbehörden, ggf. Wartungs- oder Sicherheitsdienstleister (Auftragsverarbeiter)",
   "loeschfrist": "Speicherdauer von 72 Stunden ist in der Regel zulässig; längere Speicherung nur mit besonderer Begründung (z. B. Sicherung eines konkreten Vorfalls).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "DSK"
 },
 {
  "titel": "Lieferanten- und Dienstleisterverwaltung",
  "werte": {
   "bezeichnung": "Lieferanten- und Dienstleisterverwaltung",
   "zweck": "Bestellung, Abwicklung und Bezahlung von Waren und Leistungen",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO (bei Einzelunternehmern als Vertragspartner); Art. 6 Abs. 1 lit. f DSGVO (Ansprechpersonen bei Unternehmen); Art. 6 Abs. 1 lit. c DSGVO i. V. m. § 147 AO, § 257 HGB",
   "betroffene": "Ansprechpersonen bei Lieferanten und Dienstleistern, Einzelunternehmer",
   "datenarten": "Name, geschäftliche Kontaktdaten, Bestell- und Rechnungsdaten, Bankverbindung",
   "empfaenger": "Steuerberater (eigenständiger Verantwortlicher), Kreditinstitut",
   "loeschfrist": "Buchungsbelege 8 Jahre, Geschäftsbriefe 6 Jahre (§ 147 Abs. 1, 3 AO; § 257 Abs. 1, 4 HGB); Kontaktdaten nach Ende der Geschäftsbeziehung.",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "§ 147 AO"
 },
 {
  "titel": "Kassensystem und Zahlungsabwicklung (inkl. EC-/Kartenzahlung)",
  "werte": {
   "bezeichnung": "Kassensystem und Zahlungsabwicklung (inkl. EC-/Kartenzahlung)",
   "zweck": "Erfassung von Verkäufen, ordnungsgemäße Kassenführung, Abwicklung unbarer Zahlungen",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. b DSGVO; Art. 6 Abs. 1 lit. c DSGVO i. V. m. §§ 146, 146a, 147 AO",
   "betroffene": "Kunden (bei Kartenzahlung/Kundenkonto), Beschäftigte (Bediener-Kennung)",
   "datenarten": "Kassenbuchungen/Einzelaufzeichnungen, Bediener-ID, bei Kartenzahlung: gekürzte Karten-/Kontodaten, Transaktionsdaten",
   "empfaenger": "Zahlungsdienstleister / Netzbetreiber, Kassensystem-Anbieter (Auftragsverarbeiter bei Cloud-Kassen), Steuerberater, Finanzamt (Kassennachschau/Außenprüfung)",
   "loeschfrist": "Buchungsbelege (Kassenbons, Z-Bons): 8 Jahre; Aufzeichnungen (Kassen-Einzelaufzeichnungen/Journal): 10 Jahre (§ 147 Abs. 1 Nr. 1, 4, Abs. 3 AO).",
   "drittland": "keine Übermittlung in Drittländer"
  },
  "quelle": "BayLDA"
 },
 {
  "titel": "Unternehmensauftritt in sozialen Netzwerken (z. B. Facebook-/Instagram-Seite)",
  "werte": {
   "bezeichnung": "Unternehmensauftritt in sozialen Netzwerken (z. B. Facebook-/Instagram-Seite)",
   "zweck": "Öffentlichkeitsarbeit und Kommunikation mit Interessenten",
   "rechtsgrundlage": "Art. 6 Abs. 1 lit. f DSGVO bzw. Art. 6 Abs. 1 lit. a DSGVO; gemeinsame Verantwortlichkeit mit dem Plattformbetreiber nach Art. 26 DSGVO (EuGH C-210/16)",
   "betroffene": "Besucher und Follower der Seite, Kommentierende",
   "datenarten": "öffentliche Profilangaben, Kommentare, Nachrichten, Reaktionen, von der Plattform bereitgestellte Statistiken (Insights)",
   "empfaenger": "Plattformbetreiber (gemeinsam Verantwortlicher), ggf. mit Übermittlung in die USA",
   "loeschfrist": "Nachrichten nach Erledigung; im Übrigen nach den Einstellungen der Plattform.",
   "drittland": "möglich: USA (Plattformbetreiber); Grundlage laut Datenschutzhinweisen des Anbieters"
  },
  "quelle": "DSK"
 }
];

export const TOM: Vorschlag[] = [
 {
  "gruppe": "Verschlüsselung",
  "titel": "Festplattenverschlüsselung auf allen Laptops (z. B. BitLocker/FileVault)",
  "werte": {
   "schutzziel": "pseudonymisierung_verschluesselung",
   "massnahme": "Festplattenverschlüsselung auf allen Laptops (z. B. BitLocker/FileVault)"
  },
  "quelle": "BSI IT-Grundschutz SYS.3.1 Laptops / CON.1 Kryptokonzept"
 },
 {
  "gruppe": "Verschlüsselung",
  "titel": "Geräteverschlüsselung und Bildschirmsperre mit PIN auf dienstlichen Smartphones und Tablets",
  "werte": {
   "schutzziel": "pseudonymisierung_verschluesselung",
   "massnahme": "Geräteverschlüsselung und Bildschirmsperre mit PIN auf dienstlichen Smartphones und Tablets"
  },
  "quelle": "BSI IT-Grundschutz SYS.3.2.1 Allgemeine Smartphones und Tablets"
 },
 {
  "gruppe": "Verschlüsselung",
  "titel": "Verschlüsselte USB-Sticks/externe Datenträger für personenbezogene Daten",
  "werte": {
   "schutzziel": "pseudonymisierung_verschluesselung",
   "massnahme": "Verschlüsselte USB-Sticks/externe Datenträger für personenbezogene Daten"
  },
  "quelle": "BSI IT-Grundschutz CON.1 Kryptokonzept"
 },
 {
  "gruppe": "Verschlüsselung",
  "titel": "Website ausschließlich über HTTPS (TLS) erreichbar, insbesondere Kontaktformulare",
  "werte": {
   "schutzziel": "pseudonymisierung_verschluesselung",
   "massnahme": "Website ausschließlich über HTTPS (TLS) erreichbar, insbesondere Kontaktformulare"
  },
  "quelle": "BayLDA Muster-VVT Handwerksbetrieb"
 },
 {
  "gruppe": "Verschlüsselung",
  "titel": "Transportverschlüsselung (TLS) beim E-Mail-Versand; vertrauliche Unterlagen nur verschlüsselt versenden",
  "werte": {
   "schutzziel": "pseudonymisierung_verschluesselung",
   "massnahme": "Transportverschlüsselung (TLS) beim E-Mail-Versand; vertrauliche Unterlagen nur verschlüsselt versenden"
  },
  "quelle": "BSI IT-Grundschutz APP.5.3 Allgemeiner E-Mail-Client und -Server"
 },
 {
  "gruppe": "Verschlüsselung",
  "titel": "WLAN mit aktueller Verschlüsselung (WPA2/WPA3) und starkem Passwort; separates Gäste-WLAN",
  "werte": {
   "schutzziel": "pseudonymisierung_verschluesselung",
   "massnahme": "WLAN mit aktueller Verschlüsselung (WPA2/WPA3) und starkem Passwort; separates Gäste-WLAN"
  },
  "quelle": "BSI IT-Grundschutz NET.2.1 WLAN-Betrieb"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Persönliche Benutzerkonten für alle Beschäftigten; keine gemeinsam genutzten Zugänge",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Persönliche Benutzerkonten für alle Beschäftigten; keine gemeinsam genutzten Zugänge"
  },
  "quelle": "BSI IT-Grundschutz ORP.4 Identitäts- und Berechtigungsmanagement"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Starke, individuelle Passwörter; Einsatz eines Passwort-Managers",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Starke, individuelle Passwörter; Einsatz eines Passwort-Managers"
  },
  "quelle": "BayLDA Anforderungen Handwerksbetrieb"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Zwei-Faktor-Authentisierung für E-Mail, Cloud-Dienste und Online-Banking",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Zwei-Faktor-Authentisierung für E-Mail, Cloud-Dienste und Online-Banking"
  },
  "quelle": "BSI IT-Grundschutz ORP.4"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Abgestuftes Berechtigungskonzept: Zugriff nur auf die für die Aufgabe nötigen Daten",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Abgestuftes Berechtigungskonzept: Zugriff nur auf die für die Aufgabe nötigen Daten"
  },
  "quelle": "BayLDA Anforderungen Handwerksbetrieb"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Normale Arbeit mit Standard-Benutzerkonten; Administratorrechte nur für Verwaltungsaufgaben",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Normale Arbeit mit Standard-Benutzerkonten; Administratorrechte nur für Verwaltungsaufgaben"
  },
  "quelle": "BayLDA Muster-VVT"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Automatische Bildschirmsperre nach kurzer Inaktivität",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Automatische Bildschirmsperre nach kurzer Inaktivität"
  },
  "quelle": "BSI IT-Grundschutz SYS.2.1 Allgemeiner Client"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Abschließbare Räume/Schränke für Personal- und Kundenakten",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Abschließbare Räume/Schränke für Personal- und Kundenakten"
  },
  "quelle": "BSI IT-Grundschutz INF.7 Büroarbeitsplatz / INF.1 Allgemeines Gebäude"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Clean-Desk: keine Kundenunterlagen offen im Kundenbereich; Bildschirme nicht von Kunden einsehbar",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Clean-Desk: keine Kundenunterlagen offen im Kundenbereich; Bildschirme nicht von Kunden einsehbar"
  },
  "quelle": "BSI IT-Grundschutz INF.7 Büroarbeitsplatz"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Verpflichtung aller Beschäftigten auf Vertraulichkeit/Datenschutz bei Tätigkeitsbeginn",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Verpflichtung aller Beschäftigten auf Vertraulichkeit/Datenschutz bei Tätigkeitsbeginn"
  },
  "quelle": "BayLDA Anforderungen Handwerksbetrieb"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Akten- und Datenträgervernichtung mit Aktenvernichter bzw. zertifiziertem Entsorger",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Akten- und Datenträgervernichtung mit Aktenvernichter bzw. zertifiziertem Entsorger"
  },
  "quelle": "BayLDA Muster-VVT"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Sicheres Löschen bzw. physische Vernichtung von Festplatten vor Entsorgung oder Weitergabe von Geräten",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Sicheres Löschen bzw. physische Vernichtung von Festplatten vor Entsorgung oder Weitergabe von Geräten"
  },
  "quelle": "BSI IT-Grundschutz CON.6 Löschen und Vernichten"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Auftragsverarbeitungsverträge mit allen Dienstleistern, die Zugriff auf personenbezogene Daten haben (Hosting, Cloud, Fernwartung)",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Auftragsverarbeitungsverträge mit allen Dienstleistern, die Zugriff auf personenbezogene Daten haben (Hosting, Cloud, Fernwartung)"
  },
  "quelle": "Art. 28 DSGVO"
 },
 {
  "gruppe": "Vertraulichkeit",
  "titel": "Fernwartung nur nach Freigabe im Einzelfall und unter Aufsicht",
  "werte": {
   "schutzziel": "vertraulichkeit",
   "massnahme": "Fernwartung nur nach Freigabe im Einzelfall und unter Aufsicht"
  },
  "quelle": "BSI IT-Grundschutz OPS.1.2.5 Fernwartung"
 },
 {
  "gruppe": "Integrität",
  "titel": "Automatische Sicherheitsupdates für Betriebssystem, Browser und Programme aktivieren",
  "werte": {
   "schutzziel": "integritaet",
   "massnahme": "Automatische Sicherheitsupdates für Betriebssystem, Browser und Programme aktivieren"
  },
  "quelle": "BayLDA Muster-VVT"
 },
 {
  "gruppe": "Integrität",
  "titel": "Aktuelle Virenschutz-/Sicherheitssoftware auf allen Rechnern",
  "werte": {
   "schutzziel": "integritaet",
   "massnahme": "Aktuelle Virenschutz-/Sicherheitssoftware auf allen Rechnern"
  },
  "quelle": "BayLDA Muster-VVT"
 },
 {
  "gruppe": "Integrität",
  "titel": "Firewall des Routers und der Endgeräte aktiviert; Router-Firmware aktuell, Standardpasswort geändert",
  "werte": {
   "schutzziel": "integritaet",
   "massnahme": "Firewall des Routers und der Endgeräte aktiviert; Router-Firmware aktuell, Standardpasswort geändert"
  },
  "quelle": "BSI IT-Grundschutz NET.3.2 Firewall"
 },
 {
  "gruppe": "Integrität",
  "titel": "Keine Nutzung privater Geräte und Datenträger für Betriebsdaten ohne Regelung",
  "werte": {
   "schutzziel": "integritaet",
   "massnahme": "Keine Nutzung privater Geräte und Datenträger für Betriebsdaten ohne Regelung"
  },
  "quelle": "BSI IT-Grundschutz SYS.3.2.1 / ORP.1 Organisation"
 },
 {
  "gruppe": "Integrität",
  "titel": "Software nur aus vertrauenswürdigen Quellen; nicht mehr unterstützte Systeme ersetzen",
  "werte": {
   "schutzziel": "integritaet",
   "massnahme": "Software nur aus vertrauenswürdigen Quellen; nicht mehr unterstützte Systeme ersetzen"
  },
  "quelle": "BSI IT-Grundschutz SYS.2.1 / OPS.1.1.3"
 },
 {
  "gruppe": "Integrität",
  "titel": "Protokollierung von Änderungen in Kassen- und Buchhaltungssystemen (manipulationssichere Aufzeichnung, TSE)",
  "werte": {
   "schutzziel": "integritaet",
   "massnahme": "Protokollierung von Änderungen in Kassen- und Buchhaltungssystemen (manipulationssichere Aufzeichnung, TSE)"
  },
  "quelle": "§ 146a AO"
 },
 {
  "gruppe": "Verfügbarkeit",
  "titel": "Regelmäßige Datensicherung (mindestens wöchentlich), z. B. auf externe Festplatte",
  "werte": {
   "schutzziel": "verfuegbarkeit_belastbarkeit",
   "massnahme": "Regelmäßige Datensicherung (mindestens wöchentlich), z. B. auf externe Festplatte"
  },
  "quelle": "BayLDA Muster-VVT"
 },
 {
  "gruppe": "Verfügbarkeit",
  "titel": "Mindestens eine Sicherungskopie getrennt vom Netzwerk bzw. außer Haus aufbewahren (Schutz vor Ransomware, Brand, Diebstahl)",
  "werte": {
   "schutzziel": "verfuegbarkeit_belastbarkeit",
   "massnahme": "Mindestens eine Sicherungskopie getrennt vom Netzwerk bzw. außer Haus aufbewahren (Schutz vor Ransomware, Brand, Diebstahl)"
  },
  "quelle": "BSI IT-Grundschutz CON.3 Datensicherungskonzept"
 },
 {
  "gruppe": "Verfügbarkeit",
  "titel": "Unterbrechungsfreie Stromversorgung oder Überspannungsschutz für zentrale Geräte",
  "werte": {
   "schutzziel": "verfuegbarkeit_belastbarkeit",
   "massnahme": "Unterbrechungsfreie Stromversorgung oder Überspannungsschutz für zentrale Geräte"
  },
  "quelle": "BSI IT-Grundschutz INF.1 Allgemeines Gebäude"
 },
 {
  "gruppe": "Verfügbarkeit",
  "titel": "Sorgfältige Auswahl von Hosting-/Cloud-Anbietern mit Rechenzentrum in der EU",
  "werte": {
   "schutzziel": "verfuegbarkeit_belastbarkeit",
   "massnahme": "Sorgfältige Auswahl von Hosting-/Cloud-Anbietern mit Rechenzentrum in der EU"
  },
  "quelle": "Art. 28 Abs. 1 DSGVO"
 },
 {
  "gruppe": "Wiederherstellung",
  "titel": "Wiederherstellung aus der Datensicherung regelmäßig testen",
  "werte": {
   "schutzziel": "wiederherstellung",
   "massnahme": "Wiederherstellung aus der Datensicherung regelmäßig testen"
  },
  "quelle": "BSI IT-Grundschutz CON.3 Datensicherungskonzept"
 },
 {
  "gruppe": "Wiederherstellung",
  "titel": "Notfall-Kontaktliste (IT-Dienstleister, Bank, Aufsichtsbehörde, Polizei) und Ablauf für Sicherheitsvorfälle bereithalten",
  "werte": {
   "schutzziel": "wiederherstellung",
   "massnahme": "Notfall-Kontaktliste (IT-Dienstleister, Bank, Aufsichtsbehörde, Polizei) und Ablauf für Sicherheitsvorfälle bereithalten"
  },
  "quelle": "BSI IT-Grundschutz DER.2.1 Behandlung von Sicherheitsvorfällen"
 },
 {
  "gruppe": "Wiederherstellung",
  "titel": "Dokumentierte Zugangsdaten für Notfälle sicher hinterlegen (z. B. versiegelter Umschlag im Tresor)",
  "werte": {
   "schutzziel": "wiederherstellung",
   "massnahme": "Dokumentierte Zugangsdaten für Notfälle sicher hinterlegen (z. B. versiegelter Umschlag im Tresor)"
  },
  "quelle": "BSI IT-Grundschutz ORP.4"
 },
 {
  "gruppe": "Überprüfung",
  "titel": "Jährliche Überprüfung des Verzeichnisses der Verarbeitungstätigkeiten und der TOM",
  "werte": {
   "schutzziel": "ueberpruefung",
   "massnahme": "Jährliche Überprüfung des Verzeichnisses der Verarbeitungstätigkeiten und der TOM"
  },
  "quelle": "Art. 24 Abs. 1 Satz 2, Art. 32 Abs. 1 lit. d DSGVO"
 },
 {
  "gruppe": "Überprüfung",
  "titel": "Regelmäßige Sensibilisierung der Beschäftigten (z. B. Phishing, Passwörter, Umgang mit Kundendaten)",
  "werte": {
   "schutzziel": "ueberpruefung",
   "massnahme": "Regelmäßige Sensibilisierung der Beschäftigten (z. B. Phishing, Passwörter, Umgang mit Kundendaten)"
  },
  "quelle": "BSI IT-Grundschutz ORP.3 Sensibilisierung und Schulung zur Information"
 },
 {
  "gruppe": "Überprüfung",
  "titel": "Regelmäßige Kontrolle der vergebenen Benutzerkonten und Berechtigungen; Konten ausgeschiedener Beschäftigter sofort sperren",
  "werte": {
   "schutzziel": "ueberpruefung",
   "massnahme": "Regelmäßige Kontrolle der vergebenen Benutzerkonten und Berechtigungen; Konten ausgeschiedener Beschäftigter sofort sperren"
  },
  "quelle": "BSI IT-Grundschutz ORP.4 / ORP.2 Personal"
 },
 {
  "gruppe": "Überprüfung",
  "titel": "Überprüfung der Auftragsverarbeiter (z. B. Nachweise/Zertifikate anfordern)",
  "werte": {
   "schutzziel": "ueberpruefung",
   "massnahme": "Überprüfung der Auftragsverarbeiter (z. B. Nachweise/Zertifikate anfordern)"
  },
  "quelle": "Art. 28 Abs. 3 lit. h DSGVO"
 },
 {
  "gruppe": "Überprüfung",
  "titel": "Dokumentation aller Datenschutzverletzungen (auch nicht meldepflichtiger)",
  "werte": {
   "schutzziel": "ueberpruefung",
   "massnahme": "Dokumentation aller Datenschutzverletzungen (auch nicht meldepflichtiger)"
  },
  "quelle": "Art. 33 Abs. 5 DSGVO"
 },
 {
  "gruppe": "Überprüfung",
  "titel": "Nutzung des BSI-CyberRisikoCheck (DIN SPEC 27076) als Standortbestimmung",
  "werte": {
   "schutzziel": "ueberpruefung",
   "massnahme": "Nutzung des BSI-CyberRisikoCheck (DIN SPEC 27076) als Standortbestimmung"
  },
  "quelle": "bsi.bund.de"
 }
];

export const DSE: Record<string, { titel: string; text: string; quelle?: string; unsicher?: boolean }> = {
 "verantwortlicher": {
  "titel": "Verantwortliche Stelle",
  "text": "Verantwortlich für die Verarbeitung personenbezogener Daten auf dieser Website ist {firmenname}, {strasse_hausnr}, {plz} {ort}. Sie erreichen uns per E-Mail unter {email} und telefonisch unter {telefon}. {optional: Unseren Datenschutzbeauftragten erreichen Sie unter {dsb_kontakt}.} Nachfolgend informieren wir Sie darüber, welche personenbezogenen Daten wir zu welchen Zwecken und auf welcher Rechtsgrundlage verarbeiten.",
  "quelle": "DSGVO",
  "unsicher": true
 },
 "hosting": {
  "titel": "Hosting",
  "text": "Diese Website wird bei {hoster_name}, {hoster_anschrift}, gehostet. Der Anbieter verarbeitet die beim Besuch der Website anfallenden Daten in unserem Auftrag; mit ihm haben wir einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO geschlossen. Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren und zuverlässigen Bereitstellung unserer Website (Art. 6 Abs. 1 lit. f DSGVO).",
  "quelle": "BayLDA",
  "unsicher": true
 },
 "server_logfiles": {
  "titel": "Server-Logfiles",
  "text": "Beim Aufruf unserer Website werden durch den von Ihrem Browser übermittelten Datenaustausch automatisch folgende Daten in Server-Logfiles gespeichert: IP-Adresse, Datum und Uhrzeit des Abrufs, aufgerufene Seite bzw. Datei, übertragene Datenmenge, Browsertyp und -version, Betriebssystem sowie die zuvor besuchte Seite (Referrer). Die Verarbeitung dient der Auslieferung der Website sowie der Gewährleistung von Stabilität und Sicherheit. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt in diesen Zwecken. Die Logfiles werden nach {30} Tagen gelöscht.",
  "quelle": "BayLDA",
  "unsicher": true
 },
 "kontakt": {
  "titel": "Kontakt per E-Mail, Telefon oder Kontaktformular",
  "text": "Wenn Sie uns per E-Mail, telefonisch oder über das Kontaktformular kontaktieren, verarbeiten wir Ihre Angaben (z. B. Name, Kontaktdaten, Inhalt der Anfrage) zur Bearbeitung Ihres Anliegens. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, sofern Ihre Anfrage mit einem Vertrag oder vorvertraglichen Maßnahmen zusammenhängt, im Übrigen unser berechtigtes Interesse an der Beantwortung von Anfragen (Art. 6 Abs. 1 lit. f DSGVO). Wir löschen Ihre Daten, sobald Ihre Anfrage abschließend bearbeitet ist, sofern keine gesetzlichen Aufbewahrungspflichten (z. B. für Geschäftsbriefe, § 257 HGB, § 147 AO) entgegenstehen.",
  "quelle": "§ 257 HGB",
  "unsicher": true
 },
 "cookies_einwilligung": {
  "titel": "Cookies und Einwilligung (§ 25 TDDDG)",
  "text": "Unsere Website verwendet Cookies und ähnliche Technologien. Das Speichern von Informationen auf Ihrem Endgerät oder der Zugriff auf dort bereits gespeicherte Informationen erfolgt nur mit Ihrer Einwilligung (§ 25 Abs. 1 TDDDG), soweit dies nicht unbedingt erforderlich ist, um den von Ihnen ausdrücklich gewünschten Dienst bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG). Ihre Einwilligung holen wir über unser Einwilligungsbanner ein; dort können Sie nicht erforderliche Dienste ebenso einfach ablehnen wie annehmen. Soweit dabei personenbezogene Daten verarbeitet werden, ist Rechtsgrundlage Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft über {link_cookie_einstellungen} widerrufen.",
  "quelle": "DSK"
 },
 "technisch_notwendige_cookies": {
  "titel": "Technisch notwendige Cookies",
  "text": "Einige Cookies sind unbedingt erforderlich, damit die Website bzw. von Ihnen ausdrücklich gewünschte Funktionen (z. B. {Speicherung Ihrer Cookie-Auswahl, Warenkorb, Login}) funktionieren. Für diese Cookies ist nach § 25 Abs. 2 Nr. 2 TDDDG keine Einwilligung erforderlich. Soweit dabei personenbezogene Daten verarbeitet werden, beruht dies auf unserem berechtigten Interesse an einer funktionsfähigen Website (Art. 6 Abs. 1 lit. f DSGVO). Diese Cookies werden {nach Ende der Sitzung / nach {dauer}} gelöscht.",
  "quelle": "DSK"
 },
 "google_maps": {
  "titel": "Google Maps",
  "text": "Auf unserer Website können Sie eine Karte von Google Maps (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) anzeigen lassen. Die Karte wird erst geladen, wenn Sie dem zuvor zugestimmt haben; dabei werden u. a. Ihre IP-Adresse und Informationen zu Ihrem Browser an Google übermittelt, auch an Server in den USA. Rechtsgrundlage ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit widerrufen können. Für Übermittlungen in die USA stützt sich Google auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework (Durchführungsbeschluss (EU) 2023/1795). Weitere Informationen: https://policies.google.com/privacy.",
  "quelle": "DSK",
  "unsicher": true
 },
 "youtube": {
  "titel": "Eingebettete YouTube-Videos",
  "text": "Wir binden Videos der Plattform YouTube (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) im erweiterten Datenschutzmodus ein. Die Videos werden erst geladen, wenn Sie dem zustimmen bzw. das Video aktiv starten; erst dann werden Daten wie Ihre IP-Adresse an YouTube/Google übermittelt und ggf. Cookies auf Ihrem Endgerät gespeichert, auch mit Übermittlung in die USA. Rechtsgrundlage ist Ihre Einwilligung (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO), die Sie jederzeit widerrufen können. Weitere Informationen: https://policies.google.com/privacy.",
  "quelle": "DSK",
  "unsicher": true
 },
 "google_fonts_lokal": {
  "titel": "Schriftarten (lokal eingebunden)",
  "text": "Wir verwenden auf unserer Website Schriftarten (z. B. Google Fonts), die lokal auf unserem eigenen Server gespeichert sind. Beim Aufruf der Website wird keine Verbindung zu Servern von Google oder anderen Drittanbietern hergestellt.",
  "quelle": "Grundlage: Art. 5 Abs. 1 lit. c, Art. 6 DSGVO",
  "unsicher": true
 },
 "google_fonts_extern": {
  "titel": "Google Fonts (extern eingebunden)",
  "text": "Wir binden Schriftarten von Google Fonts (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) ein. Dabei stellt Ihr Browser eine Verbindung zu Servern von Google her, wobei insbesondere Ihre IP-Adresse übermittelt wird. Dies erfolgt nur, wenn Sie zuvor eingewilligt haben (Art. 6 Abs. 1 lit. a DSGVO); die Einwilligung können Sie jederzeit widerrufen. Empfehlung: Schriftarten lokal einbinden, dann entfällt die Übermittlung.",
  "quelle": "Grundlage: Art. 6 Abs. 1 DSGVO. Keine Behördenquelle gefunden",
  "unsicher": true
 },
 "newsletter": {
  "titel": "Newsletter (Double-Opt-in)",
  "text": "Wenn Sie sich für unseren Newsletter anmelden, verwenden wir Ihre E-Mail-Adresse {und Ihren Namen}, um Ihnen regelmäßig Informationen über {themen} zu senden. Nach der Anmeldung erhalten Sie eine E-Mail mit einem Bestätigungslink; erst nach Bestätigung werden Sie in den Verteiler aufgenommen (Double-Opt-in). Wir protokollieren Anmeldung und Bestätigung (Zeitpunkt, Wortlaut der Einwilligung), um die Einwilligung nachweisen zu können. Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Sie können den Newsletter jederzeit über den Abmeldelink in jeder E-Mail oder per Nachricht an {email} abbestellen; den Nachweis Ihrer Einwilligung bewahren wir danach bis zu drei Jahre auf. Der Versand erfolgt über {versanddienstleister}, mit dem wir einen Auftragsverarbeitungsvertrag geschlossen haben.",
  "quelle": "DSK"
 },
 "social_media_links": {
  "titel": "Links zu sozialen Netzwerken",
  "text": "Auf unserer Website finden Sie Links zu unseren Auftritten bei {netzwerke}. Es handelt sich um einfache Verlinkungen; beim Besuch unserer Website werden keine Daten an diese Netzwerke übertragen. Erst wenn Sie einen Link anklicken, gelangen Sie auf die Seite des jeweiligen Anbieters, der dann eigenständig Daten verarbeitet; es gelten dessen Datenschutzhinweise.",
  "quelle": "DSK",
  "unsicher": true
 },
 "online_terminbuchung": {
  "titel": "Online-Terminbuchung über einen Drittanbieter",
  "text": "Für die Online-Terminbuchung nutzen wir den Dienst {anbieter_name}, {anbieter_anschrift}. Dabei verarbeiten wir die von Ihnen eingegebenen Daten (z. B. Name, Kontaktdaten, gewünschter Termin und Leistung), um Ihren Termin zu planen, zu bestätigen und Sie ggf. daran zu erinnern. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Der Anbieter verarbeitet die Daten in unserem Auftrag auf Grundlage eines Vertrags nach Art. 28 DSGVO. Die Daten werden gelöscht, wenn sie für die Terminabwicklung nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.",
  "quelle": "DSK",
  "unsicher": true
 },
 "betroffenenrechte": {
  "titel": "Ihre Rechte",
  "text": "Sie haben das Recht, Auskunft über die von uns verarbeiteten personenbezogenen Daten zu verlangen (Art. 15 DSGVO). Sie können die Berichtigung unrichtiger oder die Vervollständigung unvollständiger Daten verlangen (Art. 16 DSGVO). Sie können die Löschung Ihrer Daten verlangen, soweit keine gesetzliche Aufbewahrungspflicht oder ein anderer Grund nach Art. 17 Abs. 3 DSGVO entgegensteht (Art. 17 DSGVO). Sie können die Einschränkung der Verarbeitung verlangen, etwa solange die Richtigkeit Ihrer Daten geprüft wird (Art. 18 DSGVO). Sie haben das Recht, Daten, die Sie uns auf Grundlage einer Einwilligung oder eines Vertrags bereitgestellt haben, in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten oder übermitteln zu lassen (Art. 20 DSGVO). Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, einer auf Art. 6 Abs. 1 lit. e oder f DSGVO gestützten Verarbeitung zu widersprechen (Art. 21 DSGVO). Zur Ausübung Ihrer Rechte genügt eine Nachricht an {email}.",
  "quelle": "DSGVO"
 },
 "widerruf_einwilligung": {
  "titel": "Widerruf Ihrer Einwilligung",
  "text": "Soweit eine Verarbeitung auf Ihrer Einwilligung beruht, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3 DSGVO). Die Rechtmäßigkeit der bis zum Widerruf erfolgten Verarbeitung bleibt davon unberührt. Der Widerruf ist so einfach möglich wie die Erteilung, z. B. per E-Mail an {email} oder über {link_einstellungen}.",
  "quelle": "DSK"
 },
 "widerspruchsrecht": {
  "titel": "Widerspruchsrecht (Art. 21 DSGVO)",
  "text": "Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung Sie betreffender personenbezogener Daten, die auf Grundlage von Art. 6 Abs. 1 lit. e oder f DSGVO erfolgt, Widerspruch einzulegen. Wir verarbeiten die Daten dann nicht mehr, es sei denn, wir können zwingende schutzwürdige Gründe für die Verarbeitung nachweisen, die Ihre Interessen, Rechte und Freiheiten überwiegen, oder die Verarbeitung dient der Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen. Werden Ihre Daten für Direktwerbung verarbeitet, können Sie dieser Verarbeitung jederzeit ohne Angabe von Gründen widersprechen; die Daten werden dann nicht mehr für diese Zwecke verarbeitet. Der Widerspruch ist formfrei möglich, z. B. an {email}.",
  "quelle": "DSK"
 },
 "beschwerderecht": {
  "titel": "Beschwerderecht bei einer Aufsichtsbehörde",
  "text": "Sie haben unbeschadet anderer Rechtsbehelfe das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde, insbesondere in dem Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes, wenn Sie der Ansicht sind, dass die Verarbeitung Ihrer personenbezogenen Daten gegen die DSGVO verstößt (Art. 77 DSGVO). Die für uns zuständige Aufsichtsbehörde ist: {aufsichtsbehoerde_name}, {aufsichtsbehoerde_ort}, {aufsichtsbehoerde_url}.",
  "quelle": "DSGVO"
 }
};

export const AUFSICHT: { land: string; name: string; ort: string; url: string }[] = [
 {
  "land": "Baden-Württemberg",
  "name": "Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg",
  "ort": "Stuttgart",
  "url": "https://www.baden-wuerttemberg.datenschutz.de"
 },
 {
  "land": "Bayern",
  "name": "Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)",
  "ort": "Ansbach",
  "url": "https://www.lda.bayern.de"
 },
 {
  "land": "Berlin",
  "name": "Berliner Beauftragte für Datenschutz und Informationsfreiheit",
  "ort": "Berlin",
  "url": "https://www.datenschutz-berlin.de"
 },
 {
  "land": "Brandenburg",
  "name": "Die Landesbeauftragte für den Datenschutz und für das Recht auf Akteneinsicht Brandenburg",
  "ort": "Kleinmachnow",
  "url": "https://www.lda.brandenburg.de"
 },
 {
  "land": "Bremen",
  "name": "Die Landesbeauftragte für Datenschutz und Informationsfreiheit der Freien Hansestadt Bremen",
  "ort": "Bremen",
  "url": "https://www.datenschutz.bremen.de"
 },
 {
  "land": "Hamburg",
  "name": "Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit",
  "ort": "Hamburg",
  "url": "https://www.datenschutz-hamburg.de"
 },
 {
  "land": "Hessen",
  "name": "Der Hessische Beauftragte für Datenschutz und Informationsfreiheit",
  "ort": "Wiesbaden",
  "url": "https://www.datenschutz.hessen.de"
 },
 {
  "land": "Mecklenburg-Vorpommern",
  "name": "Der Landesbeauftragte für Datenschutz und Informationsfreiheit Mecklenburg-Vorpommern",
  "ort": "Schwerin",
  "url": "https://www.datenschutz-mv.de"
 },
 {
  "land": "Niedersachsen",
  "name": "Der Landesbeauftragte für den Datenschutz Niedersachsen",
  "ort": "Hannover",
  "url": "https://www.lfd.niedersachsen.de"
 },
 {
  "land": "Nordrhein-Westfalen",
  "name": "Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen",
  "ort": "Düsseldorf",
  "url": "https://www.ldi.nrw.de"
 },
 {
  "land": "Rheinland-Pfalz",
  "name": "Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz",
  "ort": "Mainz",
  "url": "https://www.datenschutz.rlp.de"
 },
 {
  "land": "Saarland",
  "name": "Unabhängiges Datenschutzzentrum Saarland – Landesbeauftragte für Datenschutz und Informationsfreiheit",
  "ort": "Saarbrücken",
  "url": "https://datenschutz.saarland.de"
 },
 {
  "land": "Sachsen",
  "name": "Sächsische Datenschutz- und Transparenzbeauftragte",
  "ort": "Dresden",
  "url": "https://www.datenschutz.sachsen.de"
 },
 {
  "land": "Sachsen-Anhalt",
  "name": "Landesbeauftragte für den Datenschutz Sachsen-Anhalt",
  "ort": "Magdeburg",
  "url": "https://datenschutz.sachsen-anhalt.de"
 },
 {
  "land": "Schleswig-Holstein",
  "name": "Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein (ULD)",
  "ort": "Kiel",
  "url": "https://www.datenschutzzentrum.de"
 },
 {
  "land": "Thüringen",
  "name": "Thüringer Landesbeauftragter für den Datenschutz und die Informationsfreiheit",
  "ort": "Erfurt",
  "url": "https://www.tlfdi.de"
 }
];

export const AVV_KLAUSELN: { lit: string; text: string }[] = [
 {
  "lit": "a",
  "text": "Der Auftragnehmer verarbeitet die personenbezogenen Daten ausschließlich auf dokumentierte Weisung des Auftraggebers, auch hinsichtlich Übermittlungen in Drittländer. Ist er gesetzlich zu einer anderen Verarbeitung verpflichtet, teilt er dies dem Auftraggeber vorab mit, soweit das Gesetz dies nicht verbietet. Hält der Auftragnehmer eine Weisung für rechtswidrig, informiert er den Auftraggeber unverzüglich (Art. 28 Abs. 3 UAbs. 2 DSGVO)."
 },
 {
  "lit": "b",
  "text": "Der Auftragnehmer stellt sicher, dass alle mit der Verarbeitung befassten Personen zur Vertraulichkeit verpflichtet sind oder einer angemessenen gesetzlichen Verschwiegenheitspflicht unterliegen."
 },
 {
  "lit": "c",
  "text": "Der Auftragnehmer trifft alle nach Art. 32 DSGVO erforderlichen technischen und organisatorischen Maßnahmen; diese sind in Anlage {nr} beschrieben."
 },
 {
  "lit": "d",
  "text": "Der Auftragnehmer setzt weitere Auftragsverarbeiter (Unterauftragsverarbeiter) nur mit vorheriger gesonderter oder allgemeiner schriftlicher Genehmigung des Auftraggebers ein; bei allgemeiner Genehmigung informiert er über beabsichtigte Änderungen, sodass der Auftraggeber Einspruch erheben kann. Er erlegt Unterauftragsverarbeitern vertraglich dieselben Datenschutzpflichten auf und haftet für deren Einhaltung."
 },
 {
  "lit": "e",
  "text": "Der Auftragnehmer unterstützt den Auftraggeber nach Möglichkeit mit geeigneten technischen und organisatorischen Maßnahmen bei der Beantwortung von Anträgen betroffener Personen (Art. 12–22 DSGVO) und leitet an ihn gerichtete Anträge unverzüglich weiter."
 },
 {
  "lit": "f",
  "text": "Der Auftragnehmer unterstützt den Auftraggeber bei der Einhaltung der Pflichten aus Art. 32 bis 36 DSGVO (Sicherheit, Meldung und Benachrichtigung bei Datenschutzverletzungen, Datenschutz-Folgenabschätzung, vorherige Konsultation). Datenschutzverletzungen meldet er dem Auftraggeber unverzüglich (Art. 33 Abs. 2 DSGVO)."
 },
 {
  "lit": "g",
  "text": "Nach Beendigung des Auftrags löscht der Auftragnehmer nach Wahl des Auftraggebers sämtliche personenbezogenen Daten oder gibt sie zurück und löscht vorhandene Kopien, soweit keine gesetzliche Speicherpflicht besteht. Die Löschung ist auf Verlangen zu bestätigen."
 },
 {
  "lit": "h",
  "text": "Der Auftragnehmer stellt dem Auftraggeber alle zum Nachweis der Einhaltung dieser Pflichten erforderlichen Informationen zur Verfügung und ermöglicht und unterstützt Überprüfungen einschließlich Inspektionen durch den Auftraggeber oder einen von ihm beauftragten Prüfer."
 }
];

export const PANNEN_ARTEN: Option[] = [
 {
  "wert": "ransomware_schadsoftware_angriff_verschl",
  "text": "Ransomware-/Schadsoftware-Angriff (Verschlüsselung, ggf. Abfluss von Daten)",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 2"
 },
 {
  "wert": "datenabfluss_durch_hackerangriff_z_b_auf",
  "text": "Datenabfluss durch Hackerangriff (z. B. auf Website, Online-Shop, Server)",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 3"
 },
 {
  "wert": "unbefugter_zugriff_oder_datenmitnahme_du",
  "text": "Unbefugter Zugriff oder Datenmitnahme durch (ehemalige) Beschäftigte",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 4 (internes menschliches Risiko)"
 },
 {
  "wert": "verlust_oder_diebstahl_von_laptop_smartp",
  "text": "Verlust oder Diebstahl von Laptop, Smartphone, USB-Stick oder Papierunterlagen",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 5"
 },
 {
  "wert": "fehlversand_brief_oder_e_mail_an_falsche",
  "text": "Fehlversand (Brief oder E-Mail an falschen Empfänger, offener E-Mail-Verteiler statt BCC)",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 6"
 },
 {
  "wert": "social_engineering_phishing_z_b_kompromi",
  "text": "Social Engineering / Phishing (z. B. kompromittiertes E-Mail-Konto, Identitätsdiebstahl)",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 7"
 },
 {
  "wert": "unsachgemaesse_entsorgung_von_akten_oder",
  "text": "Unsachgemäße Entsorgung von Akten oder Datenträgern",
  "quelle": "Art. 4 Nr. 12 DSGVO"
 },
 {
  "wert": "datenverlust_ohne_sicherung_z_b_hardware",
  "text": "Datenverlust ohne Sicherung (z. B. Hardwaredefekt, versehentliches Löschen) – Verletzung der Verfügbarkeit",
  "quelle": "EDSA Leitlinien 9/2022 (Vertraulichkeits-, Integritäts- und Verfügbarkeitsverletzung)"
 },
 {
  "wert": "falsch_konfigurierte_freigaben_z_b_oeffe",
  "text": "Falsch konfigurierte Freigaben (z. B. öffentlich abrufbarer Cloud-Ordner)",
  "quelle": "Art. 4 Nr. 12 DSGVO"
 }
];

export const PANNEN_SOFORT: (Option & { unsicher?: boolean })[] = [
 {
  "wert": "vorfall_intern_melden_und_zeitpunkt_der_",
  "text": "Vorfall intern melden und Zeitpunkt der Kenntnisnahme festhalten (Beginn der 72-Stunden-Frist)",
  "quelle": "Art. 33 Abs. 1 DSGVO"
 },
 {
  "wert": "betroffene_geraete_vom_netz_trennen_nich",
  "text": "Betroffene Geräte vom Netz trennen (nicht ausschalten, wenn Spurensicherung nötig), bei Ransomware keine Lösegeldzahlung ohne Beratung",
  "quelle": "EDSA Leitlinien 01/2021 (Ransomware-Fälle)",
  "unsicher": true
 },
 {
  "wert": "kompromittierte_passwoerter_sofort_aende",
  "text": "Kompromittierte Passwörter sofort ändern, Konten sperren, Zwei-Faktor-Authentisierung aktivieren",
  "quelle": "EDSA Leitlinien 01/2021 (Phishing/Social Engineering)",
  "unsicher": true
 },
 {
  "wert": "verlorene_gestohlene_geraete_per_fernzug",
  "text": "Verlorene/gestohlene Geräte per Fernzugriff sperren oder löschen; Diebstahl bei der Polizei anzeigen",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 5",
  "unsicher": true
 },
 {
  "wert": "bei_fehlversand_empfaenger_zur_loeschung",
  "text": "Bei Fehlversand: Empfänger zur Löschung auffordern und Löschung bestätigen lassen; ggf. Rückruf der E-Mail",
  "quelle": "EDSA Leitlinien 01/2021, Kap. 6"
 },
 {
  "wert": "it_dienstleister_bzw_auftragsverarbeiter",
  "text": "IT-Dienstleister bzw. Auftragsverarbeiter einbinden; Ursache ermitteln und Lücke schließen",
  "quelle": "Art. 33 Abs. 3 lit. d DSGVO"
 },
 {
  "wert": "daten_aus_datensicherung_wiederherstelle",
  "text": "Daten aus Datensicherung wiederherstellen, nachdem die Systeme bereinigt sind",
  "quelle": "Art. 32 Abs. 1 lit. c DSGVO"
 },
 {
  "wert": "risiko_fuer_betroffene_bewerten_und_uebe",
  "text": "Risiko für Betroffene bewerten und über Meldung an die Aufsichtsbehörde (72 h) bzw. Benachrichtigung der Betroffenen (hohes Risiko) entscheiden",
  "quelle": "Art. 33, 34 DSGVO; EDSA Leitlinien 9/2022"
 },
 {
  "wert": "vorfall_auswirkungen_und_massnahmen_doku",
  "text": "Vorfall, Auswirkungen und Maßnahmen dokumentieren – auch wenn keine Meldepflicht besteht",
  "quelle": "Art. 33 Abs. 5 DSGVO"
 }
];

export const KU_HINWEIS_NEU: string = "Der Umsatz ist nach § 19 Abs. 1 UStG steuerfrei.";

export const RECHNUNGS_HINWEISE: (Option & { unsicher?: boolean })[] = [
 {
  "wert": "reverse_charge",
  "text": "Steuerschuldnerschaft des Leistungsempfängers",
  "quelle": "§ 14a Abs. 5 UStG",
  "unsicher": true
 },
 {
  "wert": "igl",
  "text": "Steuerfreie innergemeinschaftliche Lieferung (§ 4 Nr. 1 Buchst. b i. V. m. § 6a UStG)",
  "quelle": "§ 14a Abs. 3 UStG",
  "unsicher": true
 },
 {
  "wert": "steuerfrei",
  "text": "Steuerfreie Leistung gemäß § 4 Nr. [Nummer] UStG.",
  "quelle": "§ 14 Abs. 4 Nr. 8 UStG",
  "unsicher": true
 },
 {
  "wert": "gutschrift",
  "text": "Gutschrift",
  "quelle": "§ 14 Abs. 4 Nr. 10 UStG",
  "unsicher": true
 }
];

export const EINHEITEN: string[] = [
 "Stück",
 "Stunde",
 "Minute",
 "Tag",
 "Woche",
 "Monat",
 "Pauschale",
 "Kilogramm",
 "Gramm",
 "Liter",
 "Meter",
 "Quadratmeter",
 "Kubikmeter",
 "Kilometer",
 "Satz/Set",
 "Paket",
 "Kilowattstunde"
];

export const EUER_AUSGABEN: string[] = [
 "Betriebsausgabenpauschalen für bestimmte Berufsgruppen",
 "Waren, Rohstoffe und Hilfsstoffe einschließlich der Nebenkosten",
 "Bezogene Leistungen",
 "Ausgaben für eigenes Personal",
 "AfA auf unbewegliche Wirtschaftsgüter / bewegliche Wirtschaftsgüter / immaterielle Wirtschaftsgüter",
 "Sonderabschreibungen nach § 7g EStG",
 "Herabsetzungsbeträge nach § 7g Absatz 2 EStG",
 "Aufwendungen für geringwertige Wirtschaftsgüter nach § 6 Absatz 2 EStG",
 "Auflösung Sammelposten nach § 6 Absatz 2a EStG",
 "Restbuchwert der ausgeschiedenen Anlagegüter",
 "Miete/Aufwendungen für doppelte Haushaltsführung",
 "Sonstige Aufwendungen für betrieblich genutzte Grundstücke",
 "Übernachtungs- und Reisenebenkosten bei Geschäftsreisen",
 "Schuldzinsen zur Finanzierung von Anschaffungs- und Herstellungskosten von Wirtschaftsgütern des Anlagevermögens",
 "Übrige Schuldzinsen",
 "Gezahlte Vorsteuerbeträge",
 "An das Finanzamt gezahlte und gegebenenfalls verrechnete Umsatzsteuer",
 "Übrige unbeschränkt abziehbare Betriebsausgaben",
 "Geschenke",
 "Bewirtungsaufwendungen",
 "Verpflegungsmehraufwendungen",
 "Aufwendungen für ein häusliches Arbeitszimmer",
 "Sonstige beschränkt abziehbare Betriebsausgaben",
 "Fahrtkosten für nicht zum Betriebsvermögen gehörende Fahrzeuge",
 "Kraftfahrzeugkosten für Wege zwischen Wohnung und Betriebsstätte, Familienheimfahrten",
 "Mindestens abziehbare Kraftfahrzeugkosten für Wege zwischen Wohnung und Betriebsstätte, Familienheimfahrten (Entfernungspauschale)",
 "Nicht abziehbare Beträge (AfA und Restbuchwerte)"
];

export const EUER_EINNAHMEN: string[] = [
 "Umsatzsteuerlicher Kleinunternehmer",
 "Nicht steuerbare Umsätze sowie Umsätze nach § 19 Absatz 3 Satz 1 Nummer 1 und 2 UStG",
 "Land- und Forstwirt (Durchschnittssatzbesteuerung)",
 "Umsatzsteuerpflichtige Betriebseinnahmen",
 "Umsatzsteuerfreie, nicht umsatzsteuerbare Betriebseinnahmen sowie Betriebseinnahmen, für die der Leistungsempfänger die Umsatzsteuer nach § 13b UStG schuldet",
 "Vereinnahmte Umsatzsteuer sowie Umsatzsteuer auf unentgeltliche Wertabgaben",
 "Vom Finanzamt erstattete und gegebenenfalls verrechnete Umsatzsteuer",
 "Veräußerung oder Entnahme von Anlagevermögen",
 "Private Kfz-Nutzung",
 "Sonstige Sach-, Nutzungs- und Leistungsentnahmen"
];

export const GOBD: { belegeingang: string[]; belegart: string[]; ablage: string[]; papier: string[]; sicherungIntervall: string[]; sicherungOrt: string[]; eRechnung: string } = {
 "belegeingang": [
  "Papier (Post/persönlich)",
  "E-Mail mit PDF-Anhang",
  "Download aus Kunden-/Lieferantenportal",
  "E-Rechnung (XRechnung/ZUGFeRD) per E-Mail oder Portal",
  "Kassensystem/Kassenbericht",
  "Kontoauszug/Bank-Schnittstelle",
  "Eigenbeleg"
 ],
 "belegart": [
  "originär Papier, Ablage in Papier (Muster 4.1)",
  "originär Papier, wird gescannt (ersetzendes Scannen, Muster 4.2)",
  "originär digital (Muster 4.3)"
 ],
 "ablage": [
  "Papierordner (chronologisch/nach Belegart)",
  "Dokumentenmanagementsystem (DMS)",
  "Buchhaltungssoftware mit Belegarchiv",
  "Upload an Steuerberater (z. B. Kanzlei-Portal)",
  "Cloud-Speicher"
 ],
 "papier": [
  "Papier wird nach dem Scannen vernichtet",
  "Papier wird zusätzlich aufbewahrt",
  "Papier wird nur bei Belegen mit Originalpflicht aufbewahrt"
 ],
 "sicherungIntervall": [
  "täglich",
  "wöchentlich",
  "monatlich"
 ],
 "sicherungOrt": [
  "externer Datenträger (Festplatte/NAS) außerhalb der Betriebsräume",
  "Cloud-Backup",
  "durch Softwareanbieter/Rechenzentrum",
  "durch Steuerberater"
 ],
 "eRechnung": "Bei E-Rechnungen muss der strukturierte Teil unveränderbar in seiner ursprünglichen Form aufbewahrt werden."
};

export const KASSEN_ARTEN: string[] = [
 "Computergestützte Kassensysteme / PC-Kassensysteme",
 "Tablet-/App-Kassensysteme",
 "Elektronische Registrierkassen",
 "Taxameter",
 "Wegstreckenzähler"
];

export const TSE_ARTEN: string[] = [
 "USB-TSE",
 "SD-/microSD-TSE",
 "Cloud-TSE",
 "Hardware-TSE im Gerät integriert"
];

export const NACHWG: { angaben: { nr: number; text: string }[]; einleitung: string; kuendigungGrund: string; klagefrist: string; urlaub: string } = {
 "angaben": [
  {
   "nr": 1,
   "text": "der Name und die Anschrift der Vertragsparteien"
  },
  {
   "nr": 2,
   "text": "der Zeitpunkt des Beginns des Arbeitsverhältnisses"
  },
  {
   "nr": 3,
   "text": "bei befristeten Arbeitsverhältnissen: das Enddatum oder die vorhersehbare Dauer des Arbeitsverhältnisses"
  },
  {
   "nr": 4,
   "text": "der Arbeitsort oder, falls der Arbeitnehmer nicht nur an einem bestimmten Arbeitsort tätig sein soll, ein Hinweis darauf, dass der Arbeitnehmer an verschiedenen Orten beschäftigt werden oder seinen Arbeitsort frei wählen kann"
  },
  {
   "nr": 5,
   "text": "eine kurze Charakterisierung oder Beschreibung der vom Arbeitnehmer zu leistenden Tätigkeit"
  },
  {
   "nr": 6,
   "text": "sofern vereinbart, die Dauer der Probezeit"
  },
  {
   "nr": 7,
   "text": "die Zusammensetzung und die Höhe des Arbeitsentgelts einschließlich der Vergütung von Überstunden, der Zuschläge, der Zulagen, Prämien und Sonderzahlungen sowie anderer Bestandteile des Arbeitsentgelts, die jeweils getrennt anzugeben sind, und deren Fälligkeit sowie die Art der Auszahlung"
  },
  {
   "nr": 8,
   "text": "die vereinbarte Arbeitszeit, vereinbarte Ruhepausen und Ruhezeiten sowie bei vereinbarter Schichtarbeit das Schichtsystem, der Schichtrhythmus und Voraussetzungen für Schichtänderungen"
  },
  {
   "nr": 9,
   "text": "bei Arbeit auf Abruf nach § 12 des Teilzeit- und Befristungsgesetzes: a) die Vereinbarung, dass der Arbeitnehmer seine Arbeitsleistung entsprechend dem Arbeitsanfall zu erbringen hat, b) die Zahl der mindestens zu vergütenden Stunden, c) der Zeitrahmen, bestimmt durch Referenztage und Referenzstunden, der für die Erbringung der Arbeitsleistung festgelegt ist, und d) die Frist, innerhalb derer der Arbeitgeber die Lage der Arbeitszeit im Voraus mitzuteilen hat"
  },
  {
   "nr": 10,
   "text": "sofern vereinbart, die Möglichkeit der Anordnung von Überstunden und deren Voraussetzungen"
  },
  {
   "nr": 11,
   "text": "die Dauer des jährlichen Erholungsurlaubs"
  },
  {
   "nr": 12,
   "text": "ein etwaiger Anspruch auf vom Arbeitgeber bereitgestellte Fortbildung"
  },
  {
   "nr": 13,
   "text": "wenn der Arbeitgeber dem Arbeitnehmer eine betriebliche Altersversorgung über einen Versorgungsträger zusagt, der Name und die Anschrift dieses Versorgungsträgers; die Nachweispflicht entfällt, wenn der Versorgungsträger zu dieser Information verpflichtet ist"
  },
  {
   "nr": 14,
   "text": "das bei der Kündigung des Arbeitsverhältnisses von Arbeitgeber und Arbeitnehmer einzuhaltende Verfahren, mindestens das Schriftformerfordernis und die Fristen für die Kündigung des Arbeitsverhältnisses, sowie die Frist zur Erhebung einer Kündigungsschutzklage; § 7 des Kündigungsschutzgesetzes ist auch bei einem nicht ordnungsgemäßen Nachweis der Frist zur Erhebung einer Kündigungsschutzklage anzuwenden"
  },
  {
   "nr": 15,
   "text": "ein in allgemeiner Form gehaltener Hinweis auf die auf das Arbeitsverhältnis anwendbaren Tarifverträge, Betriebs- oder Dienstvereinbarungen sowie Regelungen paritätisch besetzter Kommissionen, die auf der Grundlage kirchlichen Rechts Arbeitsbedingungen für den Bereich kirchlicher Arbeitgeber festlegen"
  }
 ],
 "einleitung": "Der Arbeitgeber hat die wesentlichen Vertragsbedingungen des Arbeitsverhältnisses innerhalb der Fristen des Satzes 4 schriftlich niederzulegen, die Niederschrift zu unterzeichnen und dem Arbeitnehmer auszuhändigen. In die Niederschrift sind mindestens aufzunehmen:",
 "kuendigungGrund": "vier Wochen zum Fünfzehnten oder zum Ende eines Kalendermonats (§ 622 Abs. 1 BGB)",
 "klagefrist": "Kündigungsschutzklage innerhalb von drei Wochen nach Zugang der schriftlichen Kündigung; wird die Frist versäumt, gilt die Kündigung als von Anfang an wirksam (§ 7 KSchG).",
 "urlaub": "Mindestens 24 Werktage im Jahr; als Werktage gelten alle Kalendertage, die nicht Sonn- oder gesetzliche Feiertage sind (Basis Sechs-Tage-Woche). Bei einer Fünf-Tage-Woche entspricht das 20 Arbeitstagen."
};

export const MINDESTLOHN: { ab: string; cent: number }[] = [
 {
  "ab": "2026-01-01",
  "cent": 1390
 },
 {
  "ab": "2027-01-01",
  "cent": 1460
 }
];

export const MINIJOB: { ab: string; cent: number }[] = [
 {
  "ab": "2026-01-01",
  "cent": 60300
 },
 {
  "ab": "2027-01-01",
  "cent": 63300
 }
];

export const SV: { personengruppen: Option[]; schulabschluss: Option[]; ausbildung: Option[]; vertragsform: Option[] } = {
 "personengruppen": [
  {
   "wert": "101",
   "text": "101 – Sozialversicherungspflichtig Beschäftigte ohne besondere Merkmale"
  },
  {
   "wert": "102",
   "text": "102 – Auszubildende ohne besondere Merkmale"
  },
  {
   "wert": "103",
   "text": "103 – Beschäftigte in Altersteilzeit"
  },
  {
   "wert": "105",
   "text": "105 – Praktikanten"
  },
  {
   "wert": "106",
   "text": "106 – Werkstudenten"
  },
  {
   "wert": "109",
   "text": "109 – Geringfügig entlohnte Beschäftigte (Minijob)"
  },
  {
   "wert": "110",
   "text": "110 – Kurzfristig Beschäftigte"
  },
  {
   "wert": "119",
   "text": "119 – Versicherungsfreie Bezieher einer Altersvollrente oder eines Versorgungsbezugs wegen Alters"
  },
  {
   "wert": "120",
   "text": "120 – Versicherungspflichtige Bezieher einer Altersvollrente oder eines Versorgungsbezugs wegen Alters"
  },
  {
   "wert": "121",
   "text": "121 – Auszubildende mit Entgelt bis zur Geringverdienergrenze (325 Euro)"
  },
  {
   "wert": "123",
   "text": "123 – Freiwilligendienstleistende (FSJ, FÖJ, Bundesfreiwilligendienst)"
  },
  {
   "wert": "190",
   "text": "190 – Beschäftigte, die nur in der gesetzlichen Unfallversicherung versichert sind"
  }
 ],
 "schulabschluss": [
  {
   "wert": "1",
   "text": "ohne Schulabschluss"
  },
  {
   "wert": "2",
   "text": "Haupt-/Volksschulabschluss"
  },
  {
   "wert": "3",
   "text": "Mittlere Reife oder gleichwertiger Abschluss"
  },
  {
   "wert": "4",
   "text": "Abitur/Fachabitur"
  },
  {
   "wert": "9",
   "text": "Abschluss unbekannt"
  }
 ],
 "ausbildung": [
  {
   "wert": "1",
   "text": "ohne beruflichen Ausbildungsabschluss"
  },
  {
   "wert": "2",
   "text": "Abschluss einer anerkannten Berufsausbildung"
  },
  {
   "wert": "3",
   "text": "Meister-/Techniker- oder gleichwertiger Fachschulabschluss"
  },
  {
   "wert": "4",
   "text": "Bachelor"
  },
  {
   "wert": "5",
   "text": "Diplom/Magister/Master/Staatsexamen"
  },
  {
   "wert": "6",
   "text": "Promotion"
  },
  {
   "wert": "9",
   "text": "Abschluss unbekannt"
  }
 ],
 "vertragsform": [
  {
   "wert": "1",
   "text": "Vollzeit, unbefristet"
  },
  {
   "wert": "2",
   "text": "Teilzeit, unbefristet"
  },
  {
   "wert": "3",
   "text": "Vollzeit, befristet"
  },
  {
   "wert": "4",
   "text": "Teilzeit, befristet"
  }
 ]
};

export const INTERESSE: Option[] = [
 {
  "wert": "beteiligung",
  "text": "Beteiligung an der Vereinigung, insbesondere Höhe der Kapitalanteile (in %)"
 },
 {
  "wert": "stimmrechte",
  "text": "Ausübung von Stimmrechten (Anteil in %)"
 },
 {
  "wert": "kontrolle_sonstige",
  "text": "Ausübung von Kontrolle auf sonstige Weise, insbesondere aufgrund von Absprachen zwischen Dritten und Anteilseignern oder Stimmrechtsinhabern, aufgrund von Treuhand oder aufgrund der Befugnis zur Ernennung von gesetzlichen Vertretern"
 },
 {
  "wert": "fiktiv",
  "text": "Fiktiver wirtschaftlich Berechtigter: Funktion als gesetzlicher Vertreter, geschäftsführender Gesellschafter oder Partner (wenn keine natürliche Person die Schwellen erreicht, § 3 Abs. 2 Satz 5 GwG)"
 }
];

export const RECHTSFORMEN: string[] = [
 "Einzelunternehmen",
 "e. K.",
 "GbR",
 "eGbR",
 "OHG",
 "KG",
 "GmbH & Co. KG",
 "UG (haftungsbeschränkt)",
 "GmbH"
];

export const AUFBEWAHRUNG: { jahre: string; art: string }[] = [
 {
  "jahre": "10",
  "art": "§ 147 Abs. 1 Nr. 1 AO / § 257 Abs. 1 Nr. 1 HGB: Bücher und Aufzeichnungen (Handelsbücher), Inventare, Jahresabschlüsse, Lageberichte, Eröffnungsbilanz sowie die zu ihrem Verständnis erforderlichen Arbeitsanweisungen und sonstigen Organisationsunterlagen (dazu gehört die Verfahrensdokumentation); außerdem § 147 Abs. 1 Nr. 4a AO (Unterlagen nach Art. 15 Abs. 1 und Art. 163 Zollkodex der Union)"
 },
 {
  "jahre": "8",
  "art": "§ 147 Abs. 1 Nr. 4 AO / § 257 Abs. 1 Nr. 4 HGB: Buchungsbelege, darunter ausgestellte und erhaltene Rechnungen (§ 14b Abs. 1 UStG: acht Jahre)"
 },
 {
  "jahre": "6",
  "art": "Empfangene Handels- oder Geschäftsbriefe, Wiedergaben der abgesandten Handels- oder Geschäftsbriefe, sonstige für die Besteuerung bedeutsame Unterlagen (z. B. Auftrags- und Bestellunterlagen, Preisverzeichnisse)"
 }
];

export const HACCP: Vorschlag[] = [
 {
  "titel": "Kühllagerung allgemein – Temperaturkontrolle Kühleinrichtungen",
  "werte": {
   "punkt": "Kühllagerung allgemein – Temperaturkontrolle Kühleinrichtungen",
   "grenzwert": "Soll-Temperaturen je Kühleinrichtung festlegen; Kühlschrank +4 bis +7 °C",
   "haeufigkeit": "Ist-Temperatur mindestens einmal täglich messen und dokumentieren",
   "korrektur": "Bei Abweichung bzw. sensorischer Veränderung: Ware entnehmen und ggf. verwerfen, Verantwortliche informieren, Kühltemperatur korrigieren oder Reparaturauftrag an Fachfirma; Korrekturmaßnahme dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Fleisch und Fleischerzeugnisse (frisch)",
  "werte": {
   "punkt": "Kühlung Fleisch und Fleischerzeugnisse (frisch)",
   "grenzwert": "max. +7 °C",
   "haeufigkeit": "täglich (Temperaturkontrolle)",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Innereien / Nebenprodukte der Schlachtung (frisch)",
  "werte": {
   "punkt": "Kühlung Innereien / Nebenprodukte der Schlachtung (frisch)",
   "grenzwert": "max. +3 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "LAVES Niedersachsen"
 },
 {
  "titel": "Kühlung Hackfleisch",
  "werte": {
   "punkt": "Kühlung Hackfleisch",
   "grenzwert": "vorverpackt (SB) bzw. nicht am Ort der Abgabe hergestellt: max. +2; am Ort der Abgabe hergestellt / lose: max. +7 (LAVES: +7 bzw. +4 je nach Abgabezeitpunkt) °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Fleischzubereitungen",
  "werte": {
   "punkt": "Kühlung Fleischzubereitungen",
   "grenzwert": "SB-verpackt max. +4; lose oder selbst verpackt (Einzelhandel) max. +7 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "LAVES Niedersachsen"
 },
 {
  "titel": "Kühlung Geflügelfleisch (auch Federwild, Kleinwild/Hasen)",
  "werte": {
   "punkt": "Kühlung Geflügelfleisch (auch Federwild, Kleinwild/Hasen)",
   "grenzwert": "max. +4 (LAVES: −2 bis max. +4) °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Fisch frisch, gekochte Krebs- und Weichtiere",
  "werte": {
   "punkt": "Kühlung Fisch frisch, gekochte Krebs- und Weichtiere",
   "grenzwert": "max. +2 bzw. in schmelzendem Eis (annähernd Schmelzeistemperatur) °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Räucherfisch, Marinaden, Fischerzeugnisse",
  "werte": {
   "punkt": "Kühlung Räucherfisch, Marinaden, Fischerzeugnisse",
   "grenzwert": "max. +7 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Milch (Konsummilch)",
  "werte": {
   "punkt": "Kühlung Milch (Konsummilch)",
   "grenzwert": "max. +8 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Milcherzeugnisse, Käse (außer Hartkäse), Butter, Frischkäse",
  "werte": {
   "punkt": "Kühlung Milcherzeugnisse, Käse (außer Hartkäse), Butter, Frischkäse",
   "grenzwert": "max. +10 (sofern Hersteller nichts anderes angibt) °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung Eiprodukte / roheihaltige Lebensmittel",
  "werte": {
   "punkt": "Kühlung Eiprodukte / roheihaltige Lebensmittel",
   "grenzwert": "Eiprodukte max. +4; roheihaltige Lebensmittel: Mainz +7, LAVES +4 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Kühlung feine Backwaren / Konditorwaren mit nicht durcherhitzter Füllung oder Auflage; Feinkost-, Obst-/Gemüsesalate, belegte Brötchen, Desserts",
  "werte": {
   "punkt": "Kühlung feine Backwaren / Konditorwaren mit nicht durcherhitzter Füllung oder Auflage; Feinkost-, Obst-/Gemüsesalate, belegte Brötchen, Desserts",
   "grenzwert": "max. +7 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware entnehmen/ggf. verwerfen, Kühlung korrigieren, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)",
  "werte": {
   "punkt": "Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)",
   "grenzwert": "−18 oder kälter; kurzfristig bis −15 zulässig °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware prüfen, ggf. verwerfen (nicht wieder einfrieren, wenn angetaut), Gerät korrigieren/Reparatur, dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Speiseeis",
  "werte": {
   "punkt": "Speiseeis",
   "grenzwert": "Lagerung als Tiefkühlware −18; Speiseeis zum Ausportionieren / Eistresen zur Ausgabe max. −10 °C",
   "haeufigkeit": "täglich",
   "korrektur": "Ware prüfen, angetautes Eis verwerfen, Gerät korrigieren/Reparatur, dokumentieren."
  },
  "quelle": "LAVES Niedersachsen"
 },
 {
  "titel": "Heißhalten / Ausgabetemperatur warmer Speisen",
  "werte": {
   "punkt": "Heißhalten / Ausgabetemperatur warmer Speisen",
   "grenzwert": "mindestens +60 an allen Stellen bzw. im Kern (BfR 2020, LAVES, Mainz). Älterer Wert +65 (BfR 2008, BgVV, DIN-Normen, LAVES-Merkblatt B. cereus: mind. +65 °C für max. 3 Stunden)",
   "haeufigkeit": "stichprobenartig bei Ausgabe (Mainz)",
   "korrektur": "Zu kalte warme Speisen bis zum Aufkochen nacherhitzen; sonst verwerfen; dokumentieren."
  },
  "quelle": "BfR"
 },
 {
  "titel": "Ausgabetemperatur Kaltspeisen und Salate",
  "werte": {
   "punkt": "Ausgabetemperatur Kaltspeisen und Salate",
   "grenzwert": "max. +7 °C",
   "haeufigkeit": "stichprobenartig",
   "korrektur": "Bei Unterbrechung der Kühlkette > 30 Minuten Lebensmittel entsorgen (Mainz); dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Abkühlen heißer Speisen",
  "werte": {
   "punkt": "Abkühlen heißer Speisen",
   "grenzwert": "Bereich von +65 auf +10 innerhalb von 3 Stunden durchschreiten °C / h",
   "haeufigkeit": "",
   "korrektur": "Bei Überschreitung: Speise nicht weiter lagern, verwerfen; Abkühlverfahren (flache Behälter, Schnellkühler) anpassen."
  },
  "quelle": "oberallgaeu.org"
 },
 {
  "titel": "Wareneingangskontrolle",
  "werte": {
   "punkt": "Wareneingangskontrolle",
   "grenzwert": "Temperatur bei Anlieferung: Tiefkühlware −18 (kurzfristig −15); Fleisch/Fleischerzeugnisse +4 (Mainz-Formular); Fisch +2; Hackfleisch +2; Geflügel/Wild +4. Außerdem: keine Verunreinigungen, einwandfreie Verpackung, einwandfreier Geruch, gültiges MHD, Beschaffenheit des Lieferfahrzeugs, Kennzeichnung °C / Sichtprüfung",
   "haeufigkeit": "stichprobenartig bei jeder Lieferung; Dokumentation z. B. durch Vermerk auf Lieferschein oder Rechnung",
   "korrektur": "Zurückweisung der Ware; Mängel und Maßnahme dokumentieren (Datum, Lieferung, Mangel, Korrekturmaßnahme, Handzeichen)."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Frittierfett – polare Anteile",
  "werte": {
   "punkt": "Frittierfett – polare Anteile",
   "grenzwert": "24 % polare Anteile = Grenze der Genusstauglichkeit (DGF-Empfehlung) → Fett wechseln; Frittiertemperatur mind. +160 °C, max. +175 °C",
   "haeufigkeit": "keine feste Frequenz belegt; Wechselzeitpunkt nach Durchsatz über Eigenkontrollen ermitteln; Temperaturkontrollen und Fettwechsel dokumentieren",
   "korrektur": "Fett wechseln bei Erreichen des Grenzwerts oder Verderbsmerkmalen (stechender, kratziger Geruch/Geschmack, bläulicher Rauch, verstärkte Schaumbildung); nach Gebrauch filtrieren, in Ruhephasen abdecken; Fritteuse entleeren und reinigen; Altfett in verschließbaren Behältern bis zur Abholung durch Fachfirma lagern."
  },
  "quelle": "zvl.jena.de"
 },
 {
  "titel": "Reinigung und Desinfektion (Reinigungsplan Küche)",
  "werte": {
   "punkt": "Reinigung und Desinfektion (Reinigungsplan Küche)",
   "grenzwert": "Reinigungsplan vorhanden und ausgehängt; Intervalle eingehalten Sichtkontrolle",
   "haeufigkeit": "Fußböden, Arbeitstische, Theken, Behälter, Waschbecken: täglich (Waschbecken-Desinfektion wöchentlich); Schneidebretter, Geräte, Abfallbehälter: nach Benutzung; Tische nach Fleisch/Geflügel/Fisch/Ei: sofort nach Gebrauch; Türen: wöchentlich; Abzugshaube/Filter: mind. monatlich; Kühlräume/-einrichtungen: mind. wöchentlich; Tiefkühleinrichtungen: mind. vierteljährlich; Trockenlager: wöchentlich; Grundreinigung: vierteljährlich; Personal-WC: täglich (Desinfektion wöchentlich)",
   "korrektur": "Nachreinigen; Plan/Intervalle anpassen; Personal unterweisen."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 },
 {
  "titel": "Schädlingsmonitoring",
  "werte": {
   "punkt": "Schädlingsmonitoring",
   "grenzwert": "kein Befall Sichtkontrolle",
   "haeufigkeit": "regelmäßige vorbeugende optische Kontrollen, mindestens einmal pro Quartal, dokumentiert",
   "korrektur": "Bekämpfung (ggf. Fachfirma); Datum, Bereich, Feststellung, Art der Bekämpfung, Ausführender dokumentieren."
  },
  "quelle": "Lebensmittelüberwachung Mainz"
 }
];

export const ALLERGENE_UMFANG: { bezeichnung: string; umfasst: string }[] = [
 {
  "bezeichnung": "Glutenhaltiges Getreide",
  "umfasst": "namentlich Weizen (wie Dinkel und Khorasan-Weizen), Roggen, Gerste, Hafer oder Hybridstämme davon, sowie daraus hergestellte Erzeugnisse"
 },
 {
  "bezeichnung": "Krebstiere",
  "umfasst": "Krebstiere und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Eier",
  "umfasst": "Eier und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Fische",
  "umfasst": "Fische und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Erdnüsse",
  "umfasst": "Erdnüsse und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Sojabohnen",
  "umfasst": "Sojabohnen und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Milch",
  "umfasst": "Milch und daraus gewonnene Erzeugnisse (einschließlich Laktose)"
 },
 {
  "bezeichnung": "Schalenfrüchte",
  "umfasst": "namentlich Mandeln (Amygdalus communis L.), Haselnüsse (Corylus avellana), Walnüsse (Juglans regia), Kaschunüsse (Anacardium occidentale), Pecannüsse (Carya illinoiesis (Wangenh.) K. Koch), Paranüsse (Bertholletia excelsa), Pistazien (Pistacia vera), Macadamia- oder Queenslandnüsse (Macadamia ternifolia) sowie daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Sellerie",
  "umfasst": "Sellerie und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Senf",
  "umfasst": "Senf und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Sesamsamen",
  "umfasst": "Sesamsamen und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Schwefeldioxid und Sulphite",
  "umfasst": "in Konzentrationen von mehr als 10 mg/kg oder 10 mg/l als insgesamt vorhandenes SO2, die für verzehrfertige oder gemäß den Anweisungen des Herstellers in den ursprünglichen Zustand zurückgeführte Erzeugnisse zu berechnen sind"
 },
 {
  "bezeichnung": "Lupinen",
  "umfasst": "Lupinen und daraus gewonnene Erzeugnisse"
 },
 {
  "bezeichnung": "Weichtiere",
  "umfasst": "Weichtiere und daraus gewonnene Erzeugnisse"
 }
];

export const LOSE_WARE: { formen: string[]; anforderung: string; rechtsgrundlage: string } = {
 "formen": [
  "Schild auf oder in der Nähe des Lebensmittels (auch Buffet)",
  "Speise- und Getränkekarten oder Preisverzeichnisse, auch in Fußnoten oder Endnoten",
  "Aushang in der Verkaufsstätte",
  "sonstige schriftliche oder elektronische Information, sofern unmittelbar und leicht zugänglich und beim Lebensmittel oder auf einem Aushang darauf hingewiesen wird, wie/wo die Information erfolgt"
 ],
 "anforderung": "bezogen auf das jeweilige Lebensmittel „gut sichtbar, deutlich und gut lesbar“; bei schriftlicher Information ist den Allergenen das Wort „Enthält“ voranzustellen.",
 "rechtsgrundlage": "Art. 44 LMIV i. V. m. § 4 LMIDV (Lebensmittelinformations-Durchführungsverordnung)"
};

export const IFSG: { inhalte: string[]; personen: string[]; lebensmittel: string[]; symptome: string[] } = {
 "inhalte": [
  "Tätigkeitsverbote und Beschäftigungsverbote nach § 42 Abs. 1 (Krankheiten, Symptome, Ausscheider)",
  "betroffene Lebensmittel nach § 42 Abs. 2 und Tätigkeit in Küchen von Gaststätten und Gemeinschaftsverpflegung",
  "Pflicht, Hinderungsgründe nach Aufnahme der Tätigkeit dem Arbeitgeber unverzüglich mitzuteilen (§ 43 Abs. 2)",
  "Pflicht des Arbeitgebers zur Belehrung nach Aufnahme der Tätigkeit und danach alle zwei Jahre, mit Dokumentation (§ 43 Abs. 4)",
  "Aufbewahrungs- und Vorlagepflicht für Bescheinigung und letzte Dokumentation (§ 43 Abs. 5)",
  "bei Krankheitszeichen ärztlichen Rat einholen und mitteilen, dass man mit Lebensmitteln arbeitet (Merkblatt Gesundheitsamt)"
 ],
 "personen": [
  "Personen, die an Typhus abdominalis, Paratyphus, Cholera, Shigellenruhr, Salmonellose, einer anderen infektiösen Gastroenteritis oder Virushepatitis A oder E erkrankt oder dessen verdächtig sind",
  "Personen, die an infizierten Wunden oder an Hautkrankheiten erkrankt sind, bei denen die Möglichkeit besteht, dass deren Krankheitserreger über Lebensmittel übertragen werden können",
  "Personen, die die Krankheitserreger Shigellen, Salmonellen, enterohämorrhagische Escherichia coli oder Choleravibrionen ausscheiden"
 ],
 "lebensmittel": [
  "1. Fleisch, Geflügelfleisch und Erzeugnisse daraus",
  "2. Milch und Erzeugnisse auf Milchbasis",
  "3. Fische, Krebse oder Weichtiere und Erzeugnisse daraus",
  "4. Eiprodukte",
  "5. Säuglings- und Kleinkindernahrung",
  "6. Speiseeis und Speiseeishalberzeugnisse",
  "7. Backwaren mit nicht durchgebackener oder durcherhitzter Füllung oder Auflage",
  "8. Feinkost-, Rohkost- und Kartoffelsalate, Marinaden, Mayonnaisen, andere emulgierte Soßen, Nahrungshefen",
  "9. Sprossen und Keimlinge zum Rohverzehr sowie Samen zur Herstellung von Sprossen und Keimlingen zum Rohverzehr"
 ],
 "symptome": [
  "Durchfall (mehr als zwei dünnflüssige Stühle pro Tag), ggf. mit Übelkeit, Erbrechen und Fieber (akute infektiöse Gastroenteritis)",
  "hohes Fieber mit schweren Kopf-, Bauch- oder Gelenkschmerzen und Verstopfung, nach einigen Tagen schwerer Durchfall (Typhus/Paratyphus)",
  "Schwäche, Appetitlosigkeit, Gelbfärbung der Haut und der Augäpfel (Virushepatitis A oder E)",
  "Wunden oder offene Hautstellen, die gerötet, schmierig belegt, nässend oder geschwollen sind (infizierte Wunden/Hauterkrankungen)",
  "Nachweis von Salmonellen, Shigellen, EHEC oder Choleravibrionen im Stuhl, auch ohne Krankheitszeichen (Ausscheider)"
 ]
};

export const HYGIENE: Vorschlag[] = [
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Händewaschen",
  "werte": {
   "was": "Händewaschen",
   "wann": "Arbeitsbeginn, nach Pausen/Essen, nach Toilettenbesuch, bei sichtbarer Verschmutzung",
   "womit": "Flüssigseife aus Spender (keine Stückseife), Einmalhandtücher",
   "wie": "Hände gründlich waschen, abspülen und sorgfältig abtrocknen",
   "wer": "alle Beschäftigten"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Hygienische Händedesinfektion",
  "werte": {
   "was": "Hygienische Händedesinfektion",
   "wann": "vor hautverletzenden oder hautnahen Behandlungen (z. B. Nagelhautbearbeitung, Fußpflege, invasive Kosmetik), nach Ausziehen der Handschuhe, nach Kontakt mit Blut/Körperflüssigkeiten, nach Stich-/Schnittverletzung",
   "womit": "VAH-gelistetes alkoholisches Händedesinfektionsmittel",
   "wie": "ca. 3–5 ml auf trockene Hände geben, alle Handpartien einreiben und Hände während der gesamten Einwirkzeit feucht halten; Einwirkzeit nach Herstellerangabe/VAH-Liste (meist 30 Sekunden)",
   "wer": "behandelnde Person"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Einmalhandschuhe (Infektionsschutz)",
  "werte": {
   "was": "Einmalhandschuhe (Infektionsschutz)",
   "wann": "bei möglichem Kontakt mit Blut, Wundsekret oder verletzter Haut; bei verletzenden Tätigkeiten",
   "womit": "allergenarme Einmalhandschuhe",
   "wie": "für jeden Kunden neue Handschuhe; bei Beschädigung sofort wechseln; danach Händedesinfektion",
   "wer": "behandelnde Person"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Hautdesinfektion beim Kunden",
  "werte": {
   "was": "Hautdesinfektion beim Kunden",
   "wann": "vor hautverletzenden Eingriffen",
   "womit": "VAH-gelistetes, viruswirksames Hautdesinfektionsmittel (Originalgebinde, nicht umfüllen)",
   "wie": "auf trockene Haut sprühen oder mit sterilem Tupfer auftragen; Einwirkzeit nach Herstellerangabe einhalten (Rahmenhygieneplan: > 1 Minute); nicht ins Gesicht sprühen",
   "wer": "behandelnde Person"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Instrumente ohne Verletzungsrisiko (Kämme, Bürsten, Wickler, Scheren, Rasierpinsel)",
  "werte": {
   "was": "Instrumente ohne Verletzungsrisiko (Kämme, Bürsten, Wickler, Scheren, Rasierpinsel)",
   "wann": "nach Behandlung bei Bedarf und am Arbeitstagsende; bei Kontakt mit Blut, Sekreten oder unklaren Hautveränderungen sofort",
   "womit": "Wasser und fettlösender Reiniger; bei Kontamination VAH-gelistetes Instrumentendesinfektionsmittel nach Herstellerangabe",
   "wie": "Haare/Hautschuppen entfernen, nass reinigen, trocknen; bei Blut/Sekret zuerst Tauchdesinfektion (Einwirkzeit abwarten), dann reinigen",
   "wer": "Beschäftigte"
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Instrumente mit Verletzungsrisiko (Rasiermesser, Klingen, Scherköpfe, Nagelhautschere/-zange, Pinzetten, Hautraspeln, Maniküre-/Pediküreinstrumente)",
  "werte": {
   "was": "Instrumente mit Verletzungsrisiko (Rasiermesser, Klingen, Scherköpfe, Nagelhautschere/-zange, Pinzetten, Hautraspeln, Maniküre-/Pediküreinstrumente)",
   "wann": "nach jeder Kundin / jedem Kunden",
   "womit": "vorzugsweise Einwegklingen; sonst VAH-gelistetes, viruswirksames Instrumentendesinfektionsmittel nach Herstellerangabe (Bayern: mind. begrenzt viruzid)",
   "wie": "Einwegartikel nach einmaliger Verwendung entsorgen; Mehrweginstrumente zerlegt vollständig einlegen (Einwirkzeit ab letztem eingelegten Teil), abspülen, reinigen, trocknen, trocken und geschützt lagern; Lösung bei sichtbarer Verschmutzung sofort, sonst täglich wechseln",
   "wer": "Beschäftigte"
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Instrumente, die die Haut bestimmungsgemäß verletzen bzw. in/unter die Haut gelangen (z. B. Lanzetten, Komedonenheber bei invasiver Anwendung, Fräser bei Wundkontakt)",
  "werte": {
   "was": "Instrumente, die die Haut bestimmungsgemäß verletzen bzw. in/unter die Haut gelangen (z. B. Lanzetten, Komedonenheber bei invasiver Anwendung, Fräser bei Wundkontakt)",
   "wann": "vor jeder Wiederverwendung",
   "womit": "sterile Einwegprodukte oder validiertes Sterilisationsverfahren (vorzugsweise Dampfsterilisation 121 °C oder 134 °C)",
   "wie": "reinigen, desinfizieren, spülen, trocknen, prüfen, verpacken (Sterilgutverpackung, Chargen-/Datumskennzeichnung), sterilisieren, geschützt lagern; Sterilisationsparameter dokumentieren",
   "wer": "unterwiesene Beschäftigte"
  },
  "quelle": "gesetze-bayern.de"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Arbeitsplatz / Arbeits- und Ablageflächen",
  "werte": {
   "was": "Arbeitsplatz / Arbeits- und Ablageflächen",
   "wann": "nach jeder Behandlung reinigen; vor jedem hautverletzenden Eingriff reinigen und desinfizieren; mind. täglich; bei Blut-/Sekretkontamination sofort",
   "womit": "Reinigungslösung; VAH-gelistetes Flächendesinfektionsmittel nach Herstellerangabe",
   "wie": "aufräumen, grobe Verschmutzung entfernen, abwischen; Wischdesinfektion (keine Sprühdesinfektion)",
   "wer": "Beschäftigte"
  },
  "quelle": "gesetze-bayern.de"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Behandlungsliege / Behandlungsstuhl / Kopfstützen",
  "werte": {
   "was": "Behandlungsliege / Behandlungsstuhl / Kopfstützen",
   "wann": "nach jedem Kunden",
   "womit": "Reinigungsmittel, frische Einmal- oder Stoffunterlage; bei Kunden mit Hautinfektion bzw. Kontamination VAH-gelistetes Flächendesinfektionsmittel",
   "wie": "Unterlage wechseln, Flächen abwischen; bei Kontamination wischdesinfizieren",
   "wer": "Beschäftigte"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Waschbecken (Haarwaschbecken, Handwaschbecken, Sanitär)",
  "werte": {
   "was": "Waschbecken (Haarwaschbecken, Handwaschbecken, Sanitär)",
   "wann": "nach jeder Behandlung bzw. mind. arbeitstäglich; nach Kontamination",
   "womit": "Reinigungslösung; bei Kontamination mit Körperflüssigkeiten Desinfektionsmittel",
   "wie": "reinigen; nach Kontakt mit Körperflüssigkeiten desinfizieren",
   "wer": "Beschäftigte"
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Fußboden",
  "werte": {
   "was": "Fußboden",
   "wann": "täglich nach Arbeitsende (Friseur: grob nach jeder Behandlung); bei Blutkontamination sofort",
   "womit": "Reinigungslösung, sauberer Wischbezug; bei Kontamination Flächendesinfektionsmittel",
   "wie": "ausfegen, feucht wischen; Blut zuerst mit getränktem Einmaltuch/Zellstoff aufnehmen, dann wischdesinfizieren",
   "wer": "Beschäftigte / Reinigungskraft"
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Wäsche: Handtücher, Kundenumhänge, Abdecktücher, Arbeitskleidung",
  "werte": {
   "was": "Wäsche: Handtücher, Kundenumhänge, Abdecktücher, Arbeitskleidung",
   "wann": "nach jeder Kundin / jedem Kunden",
   "womit": "Vollwaschmittel bzw. desinfizierendes Waschverfahren",
   "wie": "in Wäschebeutel/-behälter sammeln, getrennt von Reinigungstüchern; bei mindestens 60 °C waschen (bewährt: 60 °C plus Maschinentrocknung); Umhänge nur mit Papierhalskrause; bei Blut-/Sekretverschmutzung bei 60 °C waschen oder entsorgen",
   "wer": "Beschäftigte"
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Reinigungsutensilien (Wischlappen, Bodentücher, Wischbezüge)",
  "werte": {
   "was": "Reinigungsutensilien (Wischlappen, Bodentücher, Wischbezüge)",
   "wann": "täglich nach der Reinigung",
   "womit": "Vollwaschmittel; Haushalts- oder langstulpige Handschuhe",
   "wie": "bei mindestens 60 °C waschen; Besen von Haaren befreien",
   "wer": "Beschäftigte"
  },
  "quelle": "BGW"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Abfall allgemein",
  "werte": {
   "was": "Abfall allgemein",
   "wann": "laufend; Behälter täglich leeren",
   "womit": "Abfallbehälter mit Deckel (fußbedient bzw. berührungsfrei) und flüssigkeitsdichtem Kunststoffsack",
   "wie": "am Arbeitsplatz sammeln; blutbehaftete Abfälle in feuchtigkeitsdichten Behältern",
   "wer": "Beschäftigte"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Spitze, scharfe, zerbrechliche Gegenstände (Klingen, Lanzetten, Kanülen)",
  "werte": {
   "was": "Spitze, scharfe, zerbrechliche Gegenstände (Klingen, Lanzetten, Kanülen)",
   "wann": "unmittelbar nach Gebrauch",
   "womit": "stich-, bruch- und durchstichfester, verschließbarer Behälter",
   "wie": "direkt einwerfen, nicht zurückstecken; Behälter fest verschließen und über den Hausmüll entsorgen",
   "wer": "behandelnde Person"
  },
  "quelle": "gesetze-bayern.de"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Umgang mit Blut – Verletzung des Kunden",
  "werte": {
   "was": "Umgang mit Blut – Verletzung des Kunden",
   "wann": "bei unbeabsichtigter Verletzung",
   "womit": "Einmalhandschuhe, steriler Tupfer, zugelassenes Wund-/Hautantiseptikum, Pflaster",
   "wie": "Blutung nicht mit ungeschützten Händen berühren; mit sterilem Tupfer und leichtem Druck stillen, Wunde desinfizieren, Pflaster; bei größeren Wunden Arzt; kontaminierte Flächen und Instrumente sofort desinfizieren",
   "wer": "behandelnde Person"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person",
  "werte": {
   "was": "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person",
   "wann": "sofort nach Verletzung",
   "womit": "Hautantiseptikum (VAH-gelistet), Verbandmaterial, Verbandbuch",
   "wie": "Blutfluss fördern, Wunde mind. 1 Minute desinfizieren, abdecken; Infektionsstatus des Kunden erfragen (Hepatitis, HIV); unverzüglich Hausarzt bzw. Durchgangsarzt (ggf. Postexpositionsprophylaxe); Unfall im Verbandbuch dokumentieren",
   "wer": "betroffene Person / Arbeitgeber"
  },
  "quelle": "Rahmenhygieneplan"
 },
 {
  "gruppe": "Alle Beauty-Betriebe",
  "titel": "Hygieneplan pflegen und Personal unterweisen",
  "werte": {
   "was": "Hygieneplan pflegen und Personal unterweisen",
   "wann": "jährlich überprüfen und aktualisieren; Unterweisung mind. jährlich",
   "womit": "schriftlicher bzw. elektronischer Hygieneplan, Unterweisungsnachweis",
   "wie": "Plan jederzeit einsehbar halten; Belehrung der Mitarbeitenden schriftlich dokumentieren",
   "wer": "Inhaber/in"
  },
  "quelle": "Rahmenhygieneplan"
 }
];
