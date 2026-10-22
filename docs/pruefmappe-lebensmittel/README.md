# Prüfmappe für die fachliche Prüfung Lebensmittelhygiene

Stand: Oktober 2026. Diese Mappe ist für eine Lebensmitteltechnikerin, Lebensmittelchemikerin oder eine Beraterin für HACCP und Lebensmittelhygiene (bzw. die männlichen Kollegen), idealerweise mit Erfahrung in kleinen Betrieben (Café, Restaurant, Bäckerei, Imbiss, Foodtruck). Sie soll den Prüfauftrag eingrenzen und damit die Kosten planbar machen. Die rechtliche Prüfung hat Rechtsanwalt Dr. Weber übernommen; sie ist hier nicht Gegenstand.

Anbieter: Lang Ventures UG (haftungsbeschränkt) i. G., Reutlingen. App: **Betriebsklar** (iPhone).

## Was Betriebsklar für Lebensmittelbetriebe tut

Betriebsklar ist eine iPhone-App für kleine Betriebe in Deutschland. Für Lebensmittelbetriebe heißt das:

1. **Pflichten-Check:** Wer im Check die Branche „Gastronomie und Lebensmittel“ angibt, sieht aus einem festen Katalog u. a. Registrierung bei der Lebensmittelüberwachung, Eigenkontrollen nach HACCP, Rückverfolgbarkeit, beim Foodtruck die Anzeige des Wassertanks, Hygieneschulung, Belehrung nach § 43 IfSG (Bescheinigung des Gesundheitsamts, Belehrung durch den Arbeitgeber, Wiederholung alle zwei Jahre), Allergenkennzeichnung, Zusatzstoffe bei loser Ware, Mehrweg zum Mitnehmen und die EU-Verpackungsverordnung. Regelbasiert, keine KI, keine Einzelfallprüfung.
2. **Vorlagen, die der Betrieb selbst ausfüllt** und als PDF ausgibt: Eigenkontrollen (HACCP) mit Gefahrenanalyse je Prozessschritt, kritischen Kontrollpunkten (Grenzwert, Überwachung, Korrekturmaßnahme), Verifizierung und Dokumentation, dazu Kontrollpunkte, Messprotokoll und Monatsraster zum Aushängen (seit E-166), Hygieneplan für Lebensmittelbetriebe, Allergenliste zum Aushängen, Belehrung durch den Arbeitgeber nach § 43 IfSG.
3. **Bausteine als Vorschläge:** Gefahrenanalyse und kritische Kontrollpunkte je Branchengruppe (Café/Gastronomie, Bäckerei, Foodtruck); Kontrollpunkte mit Grenzwert, Häufigkeit und Korrekturmaßnahme; Hygieneplan-Zeilen nach Themenbereichen (auch für Bäckerei und Foodtruck); Belehrungsinhalte. Jeder Baustein trägt einen Kurzbeleg (z. B. „Lebensmittelüberwachung Mainz“, „LAVES Niedersachsen“, „Anhang II Kap. IX VO (EG) Nr. 852/2004“). Temperaturwerte und übliche Richtwerte sind im Code als **fachlich zu prüfen** markiert; wo zwei Behörden verschiedene Werte nennen, stehen beide da (PRUEFLISTE T-94). Kein Baustein ist bisher fachlich freigegeben; die App zeigt bei den Vorlagen den Hinweis „Die Vorlagen sind noch nicht von Fachleuten geprüft. Prüfe die Inhalte, bevor du sie verwendest.“
4. **Kontrollmappe:** Die aktuellen Nachweise (darunter HACCP, Hygieneplan, Allergenliste, Belehrung) in einem PDF für eine Kontrolle der Lebensmittelüberwachung.

**Was die App nicht tut:** Sie analysiert und entscheidet nichts selbst – Gefahrenanalyse und CCP-Festlegung sind Vorschläge mit einer Entscheidungshilfe in einfachen Worten, die der Betrieb übernimmt und anpasst. Keine Rezepturen oder Etiketten für vorverpackte Ware, keine Vorlage für Zusatzstoffe und keine für die Hygieneschulung (beides nur als Hinweis im Katalog). Die Verantwortung bleibt beim Lebensmittelunternehmer.

**Daten:** Alles bleibt auf dem Gerät. Betriebsklar sieht keine Nutzerdaten. Die Beispiele in den PDFs sind erfunden.

## Inhalt der Mappe

| Datei | Inhalt |
|---|---|
| `vorlagen/*.pdf` | `haccp`, `allergene` und `ifsg_belehrung` in drei Fassungen: `-leer` (Startwerte, zum Ausfüllen von Hand), `-voll` (realistisch ausgefüllt), `-auswahl` (jede Auswahl umgestellt, alle Schalter an). Vom Hygieneplan nur die Fassungen für Lebensmittelbetriebe: `hygieneplan-leer-lebensmittel.pdf`, `hygieneplan-voll-lebensmittel.pdf` (Café mit Backstube). Beispielbetrieb aller Lebensmittel-PDFs: die erfundene „Café-Bäckerei Lindenblüte“ |
| `bausteine.md` | Alle Bausteine dieser Vorlagen nach Vorlage (HACCP nach Gefahrenanalyse, CCP und Kontrollpunkten, Hygieneplan nach Themenbereich), mit Gruppe in der App: Baustein, Inhalt, automatisch herausgezogene Temperaturen und Zeiten, Quelle, Markierung („Temperaturwert: fachlich zu prüfen“, „zwei Behördenwerte“, „fachlich zu prüfen“). Am Ende die kurzen Auswahllisten und die festen Texte (14 Allergene mit Erläuterung, lose Ware, Tätigkeitsverbote und Krankheitszeichen nach § 42 IfSG, Prozessschritte und Entscheidungshilfe für CCP, Themenbereiche des Hygieneplans) |
| `bausteine.csv` | Dieselben Bausteine als Tabelle (Semikolon, UTF-8, für Excel), eine Zeile je Baustein mit Nummer L-…, zum Kommentieren |
| `katalog-lebensmittel.csv` | Katalogeinträge zu Lebensmittelhygiene, HACCP, Rückverfolgbarkeit, Trinkwasser im Foodtruck, Hygieneschulung, Registrierung, IfSG, Allergenen (LMIV/LMIDV), Zusatzstoffen (LMZDV), Mehrweg und Verpackung (VerpackDG, PPWR) – gleiche Spalten wie die Anwalts-Mappe |
| `PRUEFLISTE-lebensmittel.md` | Punkte der Prüfliste, deren Spalte „Wer“ Lebensmittelrecht, Lebensmittelhygiene oder Gesundheitsamt nennt, Punkte für „Fach“ mit Lebensmittel-Bezug, zur Kenntnis die übrigen Punkte mit Lebensmittel-Bezug; Anhang: offene Katalogpunkte dieser Einträge |

`node docs/pruefmappe-lebensmittel/erzeugen.mjs <ziel>` erzeugt die Mappe neu aus dem aktuellen Code.

## Woher die Bausteine kommen

- **Recherche vom 12.10.2026** (`docs/recherche/2026-10-12/lebensmittel_beauty.json`): HACCP-Kontrollpunkte aus Merkblättern der Lebensmittelüberwachung (Mainz, LAVES Niedersachsen, BfR, BgVV-Empfehlungen), die 14 Allergene mit Erläuterung, Anforderungen an lose Ware, Inhalte der Belehrung und Tätigkeitsverbote nach § 42 IfSG. Das Skript `packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs` übernimmt sie nach `bausteine.ts`; Korrekturen der Druckfassung (Einheiten, zwei Behördenwerte nebeneinander, Quellen aus dem Drucktext ins Quellenfeld) stehen dort als Liste.
- **Hygieneplan für Lebensmittelbetriebe** (`branchen.ts`, nach der Nachkontrolle von Dr. Weber): 17 Zeilen in neun Themenbereichen, belegt mit Anhang II VO (EG) Nr. 852/2004, LMHV und § 42 IfSG; Zahlen darin als „üblicher Richtwert, fachlich zu prüfen“ gekennzeichnet.
- **HACCP-Kern und Zeilen für Bäckerei und Foodtruck** (`haccp.ts`, E-166): Gefahrenanalyse je Prozessschritt, kritische Kontrollpunkte mit Grenzwert, Überwachung und Korrekturmaßnahme, Verifizierung und Aufzeichnungen; Hygieneplan-Zeilen für Bäckerei (8) und Foodtruck (5). Quellen: Art. 5 VO (EG) Nr. 852/2004 (Wortlaut), Bekanntmachung 2022/C 355/01 (Flexibilität), Entscheidungsbaum nach Codex CXC 1-1969 (Fassung 2023), BfR (72 °C für 2 Minuten, Heißhalten ≥ 60 °C), Kühlwerte aus der Recherche, Anhang II Kap. III VO (EG) Nr. 852/2004 und § 11 Abs. 2 TrinkwV für den Foodtruck. Alles als Vorschlag „fachlich zu prüfen“, Häufigkeiten als „üblicher Richtwert, fachlich zu prüfen“.
- **Branchen:** Gefahrenanalyse, CCP und Hygieneplan haben die Gruppen „Gastronomie / Café“, „Bäckerei“ und „Foodtruck / mobiler Verkauf“; die App zeigt die passende zuerst. Kontrollpunkte, Allergene und IfSG haben keine Gruppe. Imbiss und Laden mit Lebensmitteln sehen die Gastronomie-Vorschläge; eine Gruppe für Metzgereien gibt es nicht.

## Prüfumfang – Vorschlag

### A. HACCP-Vorlage (höchster Nutzen)

`haccp-voll.pdf`, `haccp-leer.pdf` und die HACCP-Bausteine in `bausteine.md`:

- **Gefahrenanalyse und CCP (neu, E-166):** Die Vorlage „Eigenkontrollen (HACCP)“ beginnt jetzt mit einer Gefahrenanalyse je Prozessschritt (Gefahr, Lenkungsmaßnahme, CCP ja/nein mit Begründung), einer Entscheidungshilfe mit vier Fragen, einer Tabelle der kritischen Kontrollpunkte (Grenzwert, Überwachung wie/wer/wie oft, Korrekturmaßnahme) und Verifizierung/Dokumentation; danach wie bisher Kontrollpunkte, Messprotokoll und Monatsraster. Sind Vorschläge und CCP-Entscheidungen für Café, Bäckerei und Foodtruck fachlich richtig, und ist das im Rahmen der Flexibilität nach Art. 5 VO (EG) Nr. 852/2004 für kleine Betriebe angemessen – oder zu viel?
- **Grenzwerte:** je Kontrollpunkt einen verbindlichen Wert mit Quelle festlegen, vor allem dort, wo heute zwei Behördenwerte stehen.
- **Korrekturmaßnahmen und Häufigkeiten:** fachlich richtig und für Kleinbetriebe umsetzbar?
- **Dokumentation:** Messprotokoll, Unterschrift „Geprüft (Datum) / Verantwortliche/r“, Aufbewahrungsdauer.

### B. Hygieneplan Lebensmittel

`hygieneplan-voll-lebensmittel.pdf`, `-leer-lebensmittel.pdf`: Themenbereiche (Reinigung und Desinfektion, Personalhygiene, Schädlingsbekämpfung, Temperaturkontrollen, Wareneingang, Trennung rein/unrein, Abfall, Trinkwasser, Schulungen), Spalten Was / Wann / Womit / Wie / Wer, Häufigkeiten und Temperaturen. Die App weist darauf hin, wenn im Plan eines Lebensmittelbetriebs Themenbereiche fehlen oder Zeilen eines Beauty-Betriebs stehen.

### C. Allergenliste (LMIV / LMIDV)

`allergene-*.pdf`: Matrix Speise × 14 Allergene, Getreide- bzw. Nussart optional, „keines der 14 Hauptallergene“ nur nach ausdrücklicher Bestätigung, Erläuterung der Allergene auf eigenem Blatt, Hinweis „Informationen zu Allergenen erhalten Sie in dieser Übersicht und auf Nachfrage bei unserem Personal.“, Fußnote Art. 44 LMIV i. V. m. § 4 LMIDV.

### D. Belehrung nach § 43 IfSG

`ifsg_belehrung-*.pdf`: Inhalte zum Ankreuzen, Tätigkeitsverbote mit Krankheitszeichen in einfachen Worten und Lebensmittel nach § 42 Abs. 2 IfSG im Dokument, Merkblatt des Gesundheitsamts als Anlage, Teilnahmeliste mit Datum der Erstbelehrung, Hinweis bei einer Bescheinigung, die am ersten Arbeitstag älter als drei Monate ist, nächster Termin nach zwei Jahren. Rechtlich hat Dr. Weber die Belehrung bereits geprüft; hier geht es um die fachliche Richtigkeit und Verständlichkeit der Inhalte.

### E. Katalog-Stichprobe

`katalog-lebensmittel.csv`: alle Einträge (Auslöser, Kurztext, Frist), darunter neu Rückverfolgbarkeit und Wassertank im Foodtruck; alle stehen auf Prüfstatus `entwurf`.

## Fragen an die Prüfung

Verdichtet aus `PRUEFLISTE-lebensmittel.md` (Nummern in Klammern).

### HACCP (A)

1. Genügt die Vorlage mit den neuen Abschnitten (Gefahrenanalyse, CCP mit Entscheidungshilfe, Verifizierung, Aufzeichnungen) als HACCP-basiertes Verfahren eines kleinen Betriebs? Sind die vorgeschlagenen Gefahren, Lenkungsmaßnahmen und CCP-Entscheidungen je Prozessschritt richtig, und ist die Entscheidungshilfe in einfachen Worten verständlich und korrekt? (T-34, T-57, T-131)
2. Welcher Grenzwert soll je Kontrollpunkt gelten, wo heute zwei Werte stehen – roheihaltige Lebensmittel (+4 °C oder +7 °C), Heißhalten (+60 °C oder +65 °C), Geflügel (max. +4 °C oder −2 bis +4 °C), Hackfleisch lose (+7 °C oder +4 °C je nach Abgabezeitpunkt)? (T-94, T-106)
3. Stimmen die übrigen Werte mit Quelle: Kühlschrank +4 bis +7 °C, Konsummilch +8 °C, Milcherzeugnisse +10 °C, Fisch +2 °C, Tiefkühlung −18 °C (kurzfristig −15 °C), Speiseeis zur Ausgabe −10 °C, Abkühlen von +65 °C auf +10 °C in drei Stunden (Quelle: Landkreis-Seite mit BgVV-Empfehlungen), Frittierfett 24 % polare Anteile und 160–175 °C, Wareneingangstemperaturen? (T-34)
4. Sind Häufigkeiten und Korrekturmaßnahmen fachlich richtig und praxistauglich (z. B. „Bei Unterbrechung der Kühlkette von mehr als 30 Minuten Lebensmittel entsorgen“)? Sind die CCP-Grenzwerte richtig übertragen – Kerntemperatur 72 °C für 2 Minuten (BfR, für Gemeinschaftseinrichtungen) auf Gastronomie, Regenerieren und Cremes in der Bäckerei? Was fehlt für Café, Bäckerei und Foodtruck? (T-131)
5. Wie lange sind Messprotokolle aufzubewahren? Die Vorlage nennt nur den „angemessenen Zeitraum“ nach Art. 5 Abs. 4 Buchst. c und rät, die Dauer mit der Lebensmittelüberwachung abzustimmen. Genügt die Unterschrift „Geprüft (Datum) / Verantwortliche/r“ je Blatt? (T-34, T-131)

### Hygieneplan (B)

6. Sind die neun Themenbereiche vollständig, oder fehlen z. B. Lagerung, Allergenmanagement oder Rückverfolgbarkeit? Stimmen die neuen Zeilen für Bäckerei (Teigmaschinen, Sahneautomat, Mehllager, Konditoreiwaren, Allergene, Verkauf) und Foodtruck (Wassertank und Schläuche, Handwaschbecken, Kühlung unterwegs, Abfall und Abwasser, Standplatzwechsel)? (T-57, T-131)
7. Stimmen die Richtwerte im Plan – 60 °C Waschprogramm für Reinigungstücher, Schädlingsmonitoring z. B. monatlich, Schulung z. B. jährlich, Kühlgeräte höchstens +7 °C, Tiefkühlgeräte −18 °C? Sind Wareneingang und Temperaturen doppelt geführt (Hygieneplan und HACCP) sinnvoll oder verwirrend? (T-106)
8. Gibt es Unterschiede in der Praxis der Lebensmittelüberwachung nach Bundesländern, die der Plan berücksichtigen sollte? (T-57)

### Allergene (C)

9. Sind die Bezeichnungen der 14 Allergene und die Erläuterungen richtig (z. B. Schwellenwert 10 mg/kg bzw. 10 mg/l bei „Schwefeldioxid und Sulphite“, der in der Matrix selbst nicht erscheint)? Soll die Liste Getreide- und Nussart verpflichtend abfragen? (T-33, T-114)
10. Genügt die Matrix mit Punkten der Anforderung aus § 4 LMIDV, bei schriftlicher Information das Wort „Enthält“ voranzustellen? Reichen Aushang, Hinweis auf das Personal und Fußnote für lose Ware in Gastronomie und Bäckerei? (T-33)

### Belehrung nach § 43 IfSG (D)

11. Sind die Belehrungsinhalte, die Krankheitszeichen in einfachen Worten (z. B. „mehr als zwei dünnflüssige Stühle pro Tag“) und die Liste der Lebensmittel fachlich richtig und für Beschäftigte ohne Vorkenntnisse verständlich? (T-57)

### Katalog (E) und Lücken

12. Stimmen Auslöser und Kurztexte der Einträge – besonders Hygieneschulung nach § 4 LMHV (nur Hinweis, keine Vorlage: braucht es einen Schulungsnachweis?), Registrierung, Zusatzstoffe (LMZDV)? (T-114, T-119)
13. Zusatzstoffe: Die App hat dafür nur einen Hinweis zum Abhaken. Soll die Allergenliste um Zusatzstoffe erweitert werden oder braucht es eine eigene Vorlage für Speisekarte und lose Ware?
14. Neu (E-166): Rückverfolgbarkeit (Art. 18 VO (EG) Nr. 178/2002, eine Stufe zurück und vor) und Anzeige des Wassertanks im Foodtruck (§ 11 Abs. 2 TrinkwV, vier Wochen vor Inbetriebnahme). Stimmen Text, Auslöser und Frist – und gilt die Anzeigepflicht für einen Foodtruck, der das Tankwasser nur zum Zubereiten und Händewaschen nutzt? Kennzeichnung vorverpackter Ware und Materialien mit Lebensmittelkontakt fehlen weiter: gehören sie in den Check? (T-133)
15. Welche Unterlagen erwartet die Lebensmittelüberwachung bei einer Routinekontrolle eines Cafés oder einer Bäckerei – fehlt etwas in der Kontrollmappe?

## Offene Lücken

Stand nach E-166 (22.10.2026). Geschlossen: Gefahrenanalyse, CCP mit Entscheidungshilfe, Verifizierung und Dokumentation in der HACCP-Vorlage; Hygieneplan-Zeilen für Bäckerei und Foodtruck; Katalogeinträge Rückverfolgbarkeit und Wassertank im Foodtruck; Beispielbetrieb der PDFs ist ein Café mit Backstube. Weiter offen:

- **Werte ohne Primärquelle:** DIN 10508 (Temperaturen für Lebensmittel) nicht eingesehen; Kerntemperatur 72 °C/2 Minuten stammt aus einem BfR-Merkblatt für Gemeinschaftseinrichtungen und ist für Regenerieren und Cremes nur übertragen; alle Häufigkeiten (z. B. Protokolle wöchentlich durchsehen, Verfahren jährlich überprüfen) sind „üblicher Richtwert, fachlich zu prüfen“; die zwei Behördenwerte der Kontrollpunkte (T-94) stehen weiter nebeneinander.
- **Aufbewahrungsdauer** der Aufzeichnungen: die Verordnung nennt nur einen „angemessenen Zeitraum“ – keine Zahl in der App.
- **Bekanntmachung 2022/C 355/01:** Anhang II (HACCP-Flexibilität) nur auszugsweise gelesen; ob Kleinbetriebe ohne CCP mit der guten Hygienepraxis auskommen, bitte bestätigen.
- **Trinkwasser im Foodtruck:** Anwendung von § 11 Abs. 2 TrinkwV auf Tanks, die nur zum Zubereiten und Händewaschen dienen, und die Untersuchungspflichten (nur aus dem Merkblatt Dortmund) sind ungeklärt; der Check fragt den Tank nicht ab.
- **Rückverfolgbarkeit:** nur über die Branche ausgelöst (nicht für Onlinehändler mit Lebensmitteln ohne diese Branche); Durchführungsverordnung (EU) Nr. 931/2011 nur als Hinweis.
- **Keine Vorlage** für Zusatzstoffe, Hygieneschulung (Schulungsnachweis), Kennzeichnung vorverpackter Ware, Materialien mit Lebensmittelkontakt; keine Gruppe für Metzgereien.
- **Folgen bei Nichterfüllung** (Bußgelder) für HACCP, Registrierung, Rückverfolgbarkeit und Trinkwasser nicht erfasst.

## Nicht Gegenstand dieser Prüfung

- **Rechtliches:** Das hat Rechtsanwalt Dr. Weber geprüft (Prüfbericht vom 21.10.2026), z. B. § 43 IfSG (Fristen, Dokumentation, Bescheinigung auch für Inhaberinnen), die Rechtsgrundlagen der Vorlagen, PPWR und VerpackDG im Katalog. Seine Ergänzungen sind umgesetzt: Die Belehrung führt die Tätigkeitsverbote aus bzw. nennt das Merkblatt als Anlage; der Hygieneplan eines Lebensmittelbetriebs stützt sich auf VO (EG) Nr. 852/2004 und LMHV statt auf die Hygieneverordnung des Landes. Die fachlichen Inhalte von HACCP, Hygieneplan und Allergenliste hat er ausdrücklich an die Lebensmittelhygiene verwiesen.
- Der Hygieneplan für Beauty-Betriebe (Friseur, Kosmetik, Nagelstudio, Fußpflege) und alle Arbeitsschutz-Vorlagen – letztere in einer eigenen Prüfmappe für die Fachkraft für Arbeitssicherheit.
- Steuern, Preisangaben, Jugendschutz, Datenschutz, Technik der App.

Wenn Ihnen dabei trotzdem etwas auffällt, nehmen wir jeden Hinweis gern.

## Was wir nach der Prüfung ändern

- **Gefahrenanalyse, CCP, Hygieneplan Bäckerei/Foodtruck:** Korrekturen in `packages/fachlogik/src/dokumente/haccp.ts`; bestätigte Werte verlieren „fachlich zu prüfen“ bzw. „üblicher Richtwert“.
- **Bausteine aus der Recherche** (HACCP-Kontrollpunkte, Allergene, IfSG): Korrekturen gehen in die Druckfassung von `bausteine.ts` (Korrekturliste in `packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs`; die Recherche selbst bleibt unverändert). Je Kontrollpunkt bleibt dann ein Grenzwert mit der bestätigten Quelle; „zwei Behördenwerte“ und „fachlich zu prüfen“ entfallen.
- **Hygieneplan Lebensmittel:** Zeilen, Häufigkeiten und Richtwerte ändern wir in `branchen.ts`; bestätigte Richtwerte verlieren den Zusatz „üblicher Richtwert, fachlich zu prüfen“.
- **Vorlagen:** Strukturänderungen (z. B. Abschnitte für Gefahrenanalyse) setzen wir um und prüfen die PDFs erneut mit `werkzeuge/dokumente-pruefen.mjs`.
- **Katalog:** Geprüfte Pflichten bekommen `pruefung.status: geprueft`, `geprueft_von`, `geprueft_am` – die App zeigt dann nicht mehr „noch nicht von Fachleuten geprüft“. Neue Pflichten (Fragen 13, 14) nehmen wir nach Ihrer Empfehlung auf.
- Jede Anmerkung wird in `ENTSCHEIDUNGEN.md` dokumentiert und in `PRUEFLISTE.md` mit Datum und Prüfer als erledigt markiert (vor allem T-33, T-34, T-57, T-94, T-106, T-114, T-131, T-133).
