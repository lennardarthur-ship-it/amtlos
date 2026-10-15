# ENTSCHEIDUNGEN

Laufendes Entscheidungsprotokoll für Amtlos. Jede Entscheidung hat eine Nummer, ein Datum, einen Status und eine Begründung. Entscheidungen werden nicht gelöscht, sondern durch neue ersetzt (`ersetzt durch E-xxx`).

Status: **angenommen** (vom Product Owner bestätigt) · **vorgeschlagen** (wartet auf OK) · **ersetzt**

---

## Rahmen

### E-001 · Monorepo auf GitHub
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ein Monorepo mit pnpm-Workspaces und Turborepo. Der Product Owner legt das Repo an und gibt es frei.
- **Begründung:** Regel-Engine, Fristberechnung, Typen und Designsystem werden von Web, API, Worker, Studio und später der App geteilt. Getrennte Repos würden Versionsdrift zwischen Server- und Client-Auswertung erzeugen.

### E-002 · Fachliche Freigabe ist der kritische Pfad
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ohne Freigabe durch qualifizierte Prüfer wird keine Regel in prod ausgespielt (Spezifikation 8.3). Bauabschnitte werden technisch fertiggestellt; der Livegang hängt zusätzlich an der Prüfquote des Katalogs.
- Prüfer-Partner (Steuerberater, Rechtsanwalt, Fachkraft für Arbeitssicherheit) sind noch zu gewinnen → Risiko R-01.

### E-003 · Fachsprache im Code
- **Datum:** 2026-10-11 · **Status:** angenommen
- Domänenbegriffe (Tabellen, Spalten, Regel-Felder) auf Deutsch in ASCII (`ausloeser`, `pflicht_instanz`), technische Infrastruktur auf Englisch (`createdAt` nur in Framework-Code, `logger`, `queue`).
- **Begründung:** Die Spezifikation und alle Rechtsquellen sind deutsch. Rechtsbegriffe wie „Betriebsstätte“ oder „Anmeldezeitraum“ verlieren beim Übersetzen Präzision, und Prüfer müssen Regeln ohne Übersetzungsschritt lesen können.

---

## Architektur

### E-010 · Backend: TypeScript mit NestJS
- **Datum:** 2026-10-11 · **Status:** angenommen
- **Begründung:**
  1. Die Regel-Engine und die Fristberechnung sind ein einziges TS-Paket und laufen identisch auf Server, Web und App (offline). Mit Python bräuchten wir zwei Implementierungen und Abgleichstests.
  2. Geteilte Typen (zod) von der Datenbank bis zur UI.
  3. NestJS bietet Module, DI und Guards für eine saubere Modulgrenze je Fachbereich in einem modularen Monolithen.
- **Abgelehnt:** FastAPI (gute Wahl für ML, aber doppelte Engine). Python bleibt für isolierte Worker erlaubt, falls OCR/ML es erfordern.

### E-011 · Modularer Monolith plus wenige isolierte Dienste
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ein API-Prozess und ein Worker-Prozess aus derselben Codebasis. Separat isoliert nur, was andere Sicherheits- oder Laufzeitanforderungen hat:
  - **ERiC-Gateway** (native ELSTER-Bibliothek, eigener Container ohne Internetzugang außer ELSTER, ab Abschnitt 3)
  - **Dokument-Renderer** (HTML→PDF, ab Abschnitt 1)
  - **Crawler** (Headless-Browser, eigenes Netzsegment, ab Abschnitt 7)
  - **KI-Gateway** (einziger Ausgang zum LLM-Anbieter, Protokollierung, PII-Filter, ab Abschnitt 4)
- **Begründung:** Microservices wären für das Team und die Last überdimensioniert. Die Isolation dort, wo fremder Code oder fremde Inhalte verarbeitet werden, ist aber aus Sicherheitsgründen nötig.

### E-012 · Mandantenmodell: Konto → n Unternehmen → Rolle je Unternehmen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ein Konto kann Mitglied mehrerer Unternehmen sein (Nebengewerbe plus GmbH, Steuerberater mit vielen Mandanten). Rollen gelten pro Unternehmen: `inhaber`, `mitarbeiter`, `steuerberater`, `admin`. Plattformrollen (`experte`, `redaktion`, `plattform_admin`, `support`) sind global und geben **keinen** Zugriff auf Mandantendaten.
- Mandantentrennung durch PostgreSQL Row Level Security. Die API setzt pro Transaktion `amtlos.konto_id` und `amtlos.unternehmen_id`. Die App-Datenbankrolle ist nicht Tabelleneigentümer, sodass RLS auch nicht versehentlich umgangen wird (`FORCE ROW LEVEL SECURITY`).

### E-013 · Hosting bei einem deutschen Cloud-Anbieter
- **Datum:** 2026-10-11 · **Status:** angenommen
- Vorschlag: **STACKIT** (Kubernetes, Managed PostgreSQL, Object Storage, Rechenzentren in Deutschland). Fallback: IONOS Cloud.
- Infrastruktur als Code mit OpenTofu. Umgebungen dev, staging, prod in getrennten Projekten.
- **Technisch zu prüfen vor Abschnitt 1:** Object-Lock/WORM für GoBD-Archiv, Managed-Postgres-Version ≥ 16 mit `btree_gist`, Backup-Wiederherstellung je Zeitpunkt.

### E-014 · Identität: selbst gehosteter OIDC-Identity-Provider
- **Datum:** 2026-10-11 · **Status:** angenommen
- Vorschlag: **Zitadel**, selbst gehostet in derselben Umgebung. Passkeys, TOTP, Organisationen, Audit-Log, OIDC. Später SSO für Steuerberater-Kanzleien und White-Label-Partner.
- Alternative: Keycloak (reifer, schwerer im Betrieb). Abgelehnt: SaaS-IdP außerhalb der EU.
- Die Anwendung speichert nur `idp_subject`, E-Mail und Anzeigename.

### E-015 · Warteschlange in PostgreSQL
- **Datum:** 2026-10-11 · **Status:** angenommen
- Hintergrundjobs (Neuberechnung, Erinnerungen, Benachrichtigungen, Exporte) über **pg-boss** in derselben Datenbank.
- **Begründung:** Transaktionale Konsistenz (Ereignis speichern und Neuberechnung einreihen in einer Transaktion), keine zusätzliche Komponente wie Redis. Die zu erwartende Last (Zehntausende Unternehmen, Fristen auf Tagesbasis) liegt weit unter der Grenze.

### E-016 · Objektspeicher für Dokumente, WORM für GoBD
- **Datum:** 2026-10-11 · **Status:** angenommen
- Dateien liegen S3-kompatibel, verschlüsselt, mit SHA-256 in der Datenbank. Aufbewahrungspflichtige Dokumente in einem Bucket mit Object Lock bis `aufbewahrung_bis`.

### E-017 · Beobachtbarkeit
- **Datum:** 2026-10-11 · **Status:** angenommen
- OpenTelemetry → selbst gehosteter Grafana-Stack (Logs, Metriken, Traces). Fehler-Tracking mit selbst gehostetem GlitchTip (Sentry-kompatibel). Keine personenbezogenen Daten in Logs (strukturierte Logs mit Allowlist von Feldern).

### E-018 · Offline-Sync nur anhängend
- **Datum:** 2026-10-11 · **Status:** angenommen
- Offline erfasste Belege, Zeitbuchungen und Unterschriften werden als unveränderliche Ereignisse mit Client-ID und Gerätezeit hochgeladen. Korrekturen sind neue Ereignisse (Storno + Neubuchung), nie Überschreibungen.

### E-019 · Mobile: PWA bis Abschnitt 10, Expo-Gerüst ab Abschnitt 1
- **Datum:** 2026-10-11 · **Status:** umgesetzt in Abschnitt 10 (E-108); das Gerüst entstand erst dort
- Die Web-App ist von Beginn an PWA (installierbar, offline für Belege und Zeiterfassung). `apps/mobile` (Expo) wird in Abschnitt 1 angelegt, nutzt die geteilten Pakete, wird aber erst in Abschnitt 10 im Store veröffentlicht.

### E-020 · KI-Anbieter über austauschbares Gateway
- **Datum:** 2026-10-11 · **Status:** angenommen
- Anbieter mit Datenverarbeitung in der EU und AVV. Alle LLM-Aufrufe laufen über das KI-Gateway (E-011), das den Anbieter austauschbar macht. Auswahl vor Abschnitt 4 (Belegerkennung). Kein LLM in Entscheidungslogik (Spezifikation 10).

---

## Regel-Engine und Katalog

### E-030 · Datenbank ist Quelle der Wahrheit, Repo enthält den Export
- **Datum:** 2026-10-11 · **Status:** angenommen
- Experten bearbeiten Pflichten im Studio (Datenbank). Jede Veröffentlichung eines Katalog-Releases exportiert den vollständigen Katalog als YAML nach `catalog/` und öffnet automatisch einen Pull Request.
- **Begründung:** Experten arbeiten ohne Git. Entwickler bekommen trotzdem lesbare Diffs, CI-Tests gegen Fixtures und eine Historie im Repo. Der Startbestand wird einmalig aus YAML importiert.

### E-031 · Eigenes Regel-DSL in JSON/YAML mit JSON-Schema
- **Datum:** 2026-10-11 · **Status:** angenommen
- Bausteine: `all`, `any`, `not`, Vergleich über einen **Fakt** (`feld`), Ereignistest, Verweis auf Regelwerte. Details in `docs/03-regel-schema.md`.
- **Abgelehnt:** JSONLogic (zu generisch, keine Typprüfung gegen Fakten, schlechte Erklärbarkeit).

### E-032 · Fakten-Katalog als Schnittstelle zwischen Profil und Regeln
- **Datum:** 2026-10-11 · **Status:** angenommen
- Regeln greifen nie direkt auf Profil-JSON zu, sondern auf typisierte **Fakten** (`profil.beschaeftigte.gesamt`, `abgeleitet.ist_kapitalgesellschaft`). Jeder Fakt ist im Code definiert (Typ, Herleitung, Beschreibung) und als Liste exportiert. Das Schema prüft, dass jede Regel nur bekannte Fakten mit passendem Operator nutzt.
- **Begründung:** Profiländerungen brechen keine Regeln unbemerkt; Zählweisen (z. B. Beschäftigte je Gesetz) werden an einer Stelle definiert.

### E-033 · Dreiwertige Logik: gilt / gilt nicht / unbekannt
- **Datum:** 2026-10-11 · **Status:** angenommen
- Fehlt ein Fakt, ist das Ergebnis `unbekannt`, nicht `gilt_nicht`. Unbekannte Pflichten erscheinen als Karte „Angabe fehlt“ mit der konkreten Frage.
- **Begründung:** „Nicht zutreffend“ ist haftungsrechtlich die gefährlichste Aussage (Spezifikation 8, Rückfrage 22). Die Engine darf fehlende Angaben nie als Entlastung werten.

### E-034 · Regelwerte getrennt von Pflichten
- **Datum:** 2026-10-11 · **Status:** angenommen
- Schwellen und Beträge (Mindestlohn, Minijob-Grenze, Kleinunternehmergrenzen, USt-VA-Grenzen) sind eigene versionierte `regelwert`-Datensätze mit Gültigkeitszeitraum, Quelle und Freigabe. Pflichten verweisen per `{ regelwert: id }`. Überlappende freigegebene Gültigkeiten sind in der Datenbank technisch ausgeschlossen.

### E-035 · Gespeicherter Status vs. angezeigter Status
- **Datum:** 2026-10-11 · **Status:** angenommen
- Gespeichert werden nur `offen`, `erledigt`, `nicht_zutreffend`, `entfallen`. „Fällig bald“ und „überfällig“ werden zur Anzeigezeit aus `faellig_am` und heute berechnet.
- **Begründung:** Zeitabhängige Status in der Datenbank veralten über Nacht und brauchen sonst einen fehleranfälligen Batch.

### E-036 · Erledigung bindet an die Regelversion
- **Datum:** 2026-10-11 · **Status:** angenommen
- Jede Erledigung speichert die Pflichtversion, die zu diesem Zeitpunkt galt. Eine neue Version erzeugt nur dann eine neue Aufgabe, wenn sie `erneut_erledigen: true` setzt (z. B. „Datenschutzerklärung muss angepasst werden“).

### E-037 · Fristverschiebung als Attribut je Pflicht
- **Datum:** 2026-10-11 · **Status:** angenommen
- Jede Frist trägt `verschiebung` (z. B. auf nächsten Werktag) und `kalender` (bundeseinheitlich, Bundesland, Gemeinde, Bankarbeitstage). Feiertage auf Gemeindeebene. Die konkrete Verschiebungsregel ist für jede Pflicht `[FACHLICH ZU PRÜFEN]`.

### E-038 · Ungeprüfte Regeln nur außerhalb von prod
- **Datum:** 2026-10-11 · **Status:** angenommen
- In dev und staging können ungeprüfte Versionen mit Banner „ungeprüft“ angezeigt werden. In prod verhindert ein Datenbank-Trigger, dass ein Release ungeprüfte Inhalte enthält; die API prüft zusätzlich.

### E-039 · Vier-Augen-Freigabe mit Qualifikation
- **Datum:** 2026-10-11 · **Status:** angenommen
- Freigabe braucht zwei verschiedene Prüfer, beide nicht Autor der Version, mindestens einer mit zur Kategorie passender Qualifikation (Steuern → Steuerberater; Personal, Datenschutz, Online, Gesellschaft → Rechtsanwalt; Arbeitsschutz → Fachkraft für Arbeitssicherheit oder Rechtsanwalt). Die Zuordnung ist selbst `[FACHLICH ZU PRÜFEN]`.
- `geprueft_von` und `geprueft_am` aus der Spezifikation werden aus den Freigaben abgeleitet, nicht frei eingetragen.

### E-040 · Texte im Katalog zweisprachig, Englisch als Release-Bedingung
- **Datum:** 2026-10-11 · **Status:** angenommen
- Textfelder sind `{ de, en }`. Das Schema verlangt `de`; ein prod-Release verlangt zusätzlich `en`.

---

## Umfang

### E-050 · Rechtsformen in v1
- **Datum:** 2026-10-11 · **Status:** angenommen
- Voll unterstützt: Einzelunternehmen, Freiberuf, GbR, e.K., UG, GmbH, GmbH & Co. KG, PartG/PartG mbB. Alle anderen werden erkannt und an Partner verwiesen; ihr Profil ist erfassbar, Pflichten werden nur aus rechtsformunabhängigen Regeln abgeleitet und deutlich als unvollständig markiert.

### E-051 · Kapitalgesellschaften: Übergabe statt eigener Bilanzierung
- **Datum:** 2026-10-11 · **Status:** angenommen
- Amtlos erfasst Belege und Rechnungen auch für UG/GmbH und übergibt per DATEV-Export an den Steuerberater. Doppelte Buchführung, Jahresabschluss und E-Bilanz macht Amtlos in v1 nicht selbst; es führt Fristen und Prüfliste.

### E-052 · Lohn-Partner per Vergleich in Abschnitt 5
- **Datum:** 2026-10-11 · **Status:** angenommen
- Vergleichskriterien: API für Stammdaten und Status, Systemprüfung für SV-Meldungen, Preis pro Abrechnung, EU-Hosting, White-Label-Fähigkeit.

### E-053 · Online-Check nur für verifizierte Domains
- **Datum:** 2026-10-11 · **Status:** angenommen
- Vollprüfung erst nach Nachweis der Domain-Kontrolle (DNS-TXT oder Meta-Tag). Unverifiziert nur eine stark verkürzte, öffentliche Basisprüfung ohne Detailbericht, mit Ratenlimit.

### E-054 · Katalogwerte unverändert übernehmen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Zahlen und Fristen aus Spezifikation Abschnitt 4 werden wörtlich übernommen, mit `pruef_status: entwurf`. Keine eigenmächtige Nachrecherche oder Korrektur; Abweichungen und Zweifel gehen in `PRUEFLISTE.md`.

---

## Bauabschnitt 1

### E-060 · Worker-Rolle mit eigenen Policies statt Systemkonto
- **Datum:** 2026-10-11 · **Status:** angenommen
- Rolle `amtlos_worker` (Migration 0002) sieht genau das Unternehmen in `amtlos.unternehmen_id`, ohne Mitgliedschaft. Ohne Kontext sieht sie nichts; mandantenübergreifend gibt es nur IDs über `SECURITY DEFINER`-Funktionen (`aktive_unternehmen_ids`, `faellige_erinnerungen`). Profile und Ereignisse darf sie nur lesen.
- **Begründung:** Ein Systemkonto mit Mitgliedschaften in allen Unternehmen wäre ein Generalschlüssel. So bleibt jeder Job auf ein Unternehmen begrenzt; durch Schema-Tests abgesichert.

### E-061 · Profil-Daten ohne Präfix gespeichert
- **Datum:** 2026-10-11 · **Status:** angenommen
- `profil_version.daten` = `{ "rechtsform": …, "ust.kleinunternehmer": … }`; die Engine bekommt daraus `profil.*`-Fakten. Validierung (Typen, Enum-Werte, unbekannte Schlüssel) wird aus `fakten.json` erzeugt; `null` löscht eine Angabe (→ unbekannt). Das Bundesland wird aus dem Gemeindeschlüssel abgeleitet.

### E-062 · Entwicklungs-Login nur außerhalb von staging/prod
- **Datum:** 2026-10-11 · **Status:** angenommen
- `AUTH_MODUS=dev` (HS256, `scripts/dev-token.mjs`) für lokale Entwicklung und Tests. Die Konfigurationsprüfung verweigert den Start mit `dev` in staging und prod.

### E-063 · Sofort-Erinnerung bei sehr nahen Fristen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Liegen alle Vorlauf-Zeitpunkte einer offenen Pflicht schon in der Vergangenheit, wird einmal sofort erinnert, aber nie doppelt (Prüfung auf bereits gesendete Erinnerung).

### E-064 · Migrationen mit Prüfsumme, eigenes Schema `betrieb`
- **Datum:** 2026-10-11 · **Status:** angenommen
- `amtlos-server migrieren` spielt `db/migrations/*.sql` je in einer Transaktion ein, speichert SHA-256 in `betrieb.schema_migration` und bricht ab, wenn eine eingespielte Migration verändert wurde. `db/schema.sql` ist jetzt `db/migrations/0001_basis.sql`.

### E-065 · Neuberechnung transaktional eingereiht und gebündelt
- **Datum:** 2026-10-11 · **Status:** angenommen
- Profiländerung, Ereignis und Erledigung reihen die Neuberechnung in derselben Transaktion ein (pg-boss mit `db`-Option). Queue-Policy `stately` mit Unternehmens-ID als Schlüssel: höchstens ein wartender Job je Unternehmen. Neuberechnung und Erinnerungsplanung laufen im Worker in einer Transaktion.

### E-066 · API: NestJS als ESM, Tests mit swc
- **Datum:** 2026-10-11 · **Status:** angenommen
- Alle Pakete sind ES-Module; NestJS läuft ebenfalls als ESM. Vitest nutzt swc, weil esbuild keine Decorator-Metadaten erzeugt. Abhängigkeiten werden explizit mit `@Inject(...)` aufgelöst.

### E-067 · Umgebung fest in der Datenbank
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ob die Datenbank im prod-Modus läuft, steht in `katalog.plattform` (Migration 0003), änderbar nur durch den Eigentümer (`amtlos-server umgebung prod`). Ersetzt die Sitzungsvariable aus E-038, die jeder Dienst selbst hätte setzen können.

### E-068 · Studio spricht direkt mit der Datenbank
- **Datum:** 2026-10-11 · **Status:** angenommen
- Das Studio (apps/studio) nutzt die Rolle `amtlos_studio` direkt statt über die Nutzer-API. Sie kann Katalogdaten schreiben, aber keine Mandantendaten lesen. Zugang nur mit Plattformrolle (`amtlos-server plattformrolle …`).

### E-069 · Release nur konsistent
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ein Release wird abgelehnt, wenn eine enthaltene Pflicht auf einen Regelwert verweist, von dem keine Version im Release ist (in prod: keine freigegebene). Sonst würde die Engine für alle Nutzer „unbekannt“ liefern.

### E-070 · Neue Version zieht ältere ungeprüfte zurück
- **Datum:** 2026-10-11 · **Status:** angenommen
- Beim Anlegen einer Version werden ältere Versionen derselben Pflicht mit Status „Entwurf“ oder „In Prüfung“ auf „Zurückgezogen“ gesetzt. Geprüft wird immer nur der neueste Stand; Freigegebenes bleibt unberührt.

### E-071 · Gemeinsamer Web-Kern
- **Datum:** 2026-10-11 · **Status:** angenommen
- Sitzung (verschlüsseltes Cookie), OIDC-Anmeldung, Entwicklungs-Login und Designsystem liegen in `packages/web-kern` und werden von Web-App und Studio genutzt. Cookie-Namen je Anwendung über `COOKIE_PRAEFIX`.

### E-072 · Erster Start: Fristen vor Amtlos gesammelt bestätigen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Offene Pflichten, die vor dem ersten Profil fällig waren, bietet „Heute“ zur Sammelbestätigung an („Ja, alle erledigt“ oder „Einzeln ansehen“). Jede bestätigte Pflicht bekommt einen Nachweis mit dem Vermerk „Sammelbestätigung“. Sonst begänne jede Nutzung mit einer Wand aus Überfälligem.

### E-073 · Pflichtenliste zeigt 90 Tage, der Kalender alles
- **Datum:** 2026-10-11 · **Status:** angenommen
- Wiederkehrende Pflichten erzeugen zwölf Termine im Jahr. Die Pflichtenliste ohne Filter zeigt deshalb die nächsten 90 Tage und alles ohne Termin; der Kalender und die Filter zeigen alles.

### E-074 · Statusfarbe nie allein
- **Datum:** 2026-10-11 · **Status:** angenommen
- Jeder Status hat Form und Wort: gefüllter Kreis = überfällig, halber Kreis = bald, gestrichelter Kreis = Angabe fehlt, Haken = erledigt, leerer Kreis = offen (WCAG 1.4.1). Offene Pflichten ohne Termin färben den Bereich gelb.

---

## Bauabschnitt 2

### E-075 · Startbestand nur aus der Spezifikation, Lücken sichtbar
- **Datum:** 2026-10-11 · **Status:** angenommen
- Katalog A und C (34 Pflichten) stammen aus Spezifikation Abschnitt 4, erzeugt mit `scripts/katalog_startbestand.py`. Nennt die Spezifikation keine Frist, ist die Pflicht „laufend ohne Termin“; nennt sie keine Folgen, steht ein Platzhalter; jeweils mit Prüfpunkt. Rechtsgrundlagen außerhalb der Spezifikation sind einzeln markiert. Zwei früher ohne Beleg eingetragene Sanktionstexte (USt-VA, Berufsgenossenschaft) wurden durch den Platzhalter ersetzt.

### E-076 · Vor dem Start und im Gründungsjahr keine Vorjahreswerte
- **Datum:** 2026-10-11 · **Status:** angenommen
- Neuer abgeleiteter Fakt `abgeleitet.noch_nicht_gestartet`. Grenzen, die sich auf das Vorjahr beziehen (Kleinunternehmer, § 141 AO), werden vor dem Start und im Gründungsjahr nicht geprüft, statt dauerhaft „Angabe fehlt“ zu zeigen. Optionen, die nur vor dem Start möglich sind (Gründungszuschuss), entfallen nach dem Start. Fachlich zu bestätigen (Prüfpunkte an den Pflichten).

### E-077 · Eine Frage-Karte statt vieler bei unklaren wiederkehrenden Pflichten
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ist offen, ob eine wiederkehrende Pflicht gilt (z. B. Vorauszahlungen), entsteht eine einzige Karte „Angabe fehlt“ ohne Termin statt einer je Termin.

### E-078 · Formular-Editor im Studio, JSON nur noch optional
- **Datum:** 2026-10-11 · **Status:** angenommen
- Die Redaktion bearbeitet Pflichten in Formularen; Auslöser als Baum mit nur passenden Operatoren je Fakt-Typ und Klartext-Vorschau. Prüfmeldungen sind deutsch und nennen bei Varianten (Bedingung, Frist) nur die Fehler der gemeinten Variante.

### E-079 · Einladungen: Link per E-Mail, nur für die eingeladene Adresse
- **Datum:** 2026-10-11 · **Status:** angenommen
- Inhaber und Admins laden per E-Mail ein (Rollen Mitarbeiter, Steuerberatung, Admin; nie Inhaber). Der Link enthält ein 256-Bit-Token; in `app.einladung` steht nur der SHA-256. Annehmen geht nur angemeldet mit genau dieser E-Mail-Adresse, einmalig, bis zum Ablauf nach 7 Tagen (Produktentscheidung). Eine neue Einladung an dieselbe Adresse zieht die alte zurück; Widerruf statt Löschen (Audit-Trigger).
- Die E-Mail verschickt der Worker (Job in derselben Transaktion). Das Token steht dafür im Job; pg-boss archiviert erledigte Jobs einige Tage. Bewusst hingenommen, weil das Token ohne Zugang zum eingeladenen E-Mail-Konto nutzlos ist. Der Link wird dem Einladenden zusätzlich zwei Minuten lang angezeigt (httpOnly-Cookie, nie in der URL).
- Einladungen sehen nur Inhaber und Admins (fremde E-Mail-Adressen). Der letzte Inhaber kann weder entfernt noch herabgestuft werden (Trigger).
- Voraussetzung: Der Identity-Provider liefert nur bestätigte E-Mail-Adressen (Zitadel: Standard). Ohne diese Zusage müsste die API zusätzlich `email_verified` prüfen → Prüfpunkt T-01.

### E-080 · API-Beschreibung als OpenAPI-Datei mit Abgleichtest
- **Datum:** 2026-10-11 · **Status:** angenommen
- `apps/api/openapi.yaml` (OpenAPI 3.1) ist von Hand geschrieben, weil die Eingaben mit Zod geprüft werden und Swagger-Dekoratoren eine zweite Wahrheit wären. Ein Test liest die Routen und Rollen aus den Nest-Metadaten und verlangt, dass die Datei genau diese Routen mit denselben Rollen, demselben Mandanten-Header und denselben öffentlichen Routen beschreibt. Ausgeliefert unter `GET /v1/openapi.json`. Antwortschemas sind bei großen Objekten (Profil, Begründungsbaum) bewusst grob.

### E-081 · Betrieb: strukturierte Zugriffslogs und Prometheus-Metriken, Tracing später
- **Datum:** 2026-10-11 · **Status:** angenommen
- Die API schreibt je Anfrage eine JSON-Zeile (Anfrage-ID, Methode, Routen-Muster, Status, Dauer) und setzt `X-Request-Id`. Routen erscheinen als Muster (`/v1/kalender/:datei`), damit keine Tokens in Logs oder Metriken landen; keine IPs, keine Konto- oder Unternehmens-IDs.
- `GET /metriken` liefert Prometheus-Metriken (Anfragen, Antwortzeiten, wartende Jobs je Warteschlange, Prozesswerte) nur mit `METRIKEN_TOKEN`; ohne Token gibt es die Route nicht.
- OpenTelemetry-Tracing folgt, wenn Hosting und Observability-Anbieter feststehen (dann ohne Codeumbau über den OTLP-Exporter). Bis dahin: Logs + Metriken.

### E-082 · Ratenbegrenzung in der API, je Instanz
- **Datum:** 2026-10-11 · **Status:** angenommen
- Gleitendes Minutenfenster im Speicher: angemeldet 600/min je Token, ohne Login sowie für Einladungs- und Kalender-Tokens 60/min je IP (konfigurierbar). 429 mit `Retry-After`, Zähler `amtlos_http_begrenzt_total`. IPs nur flüchtig im Speicher, nie im Log. Bei mehreren Instanzen gilt die Grenze je Instanz; eine globale Grenze gehört an den Ingress (mit dem Hosting).

### E-083 · Team: Rollen ändern und austreten
- **Datum:** 2026-10-11 · **Status:** angenommen
- Inhaber und Admins ändern Rollen; Inhaber ernennen oder ändern darf nur ein Inhaber. Jedes Mitglied kann selbst austreten (SECURITY-DEFINER-Funktion, weil die Lösch-Policy nur Inhabern/Admins erlaubt). Der letzte Inhaber kann weder herabgestuft werden noch austreten. Die Einladungs-E-Mail geht in der Sprache des Einladenden.

### E-084 · Container: ein Dockerfile, fünf Ziele, Rauchtest in der CI
- **Datum:** 2026-10-11 · **Status:** angenommen
- `docker/Dockerfile` baut api, worker, web, studio und werkzeug (Migrationen, Katalog-Import, Betriebskommandos). Node-Dienste als `pnpm deploy --prod`-Bündel (Workspace-Pakete mit `files: ["dist"]`), Next.js als standalone; das Studio nimmt die Schemas ausdrücklich ins Bündel (`outputFileTracingIncludes`). Ohne Root, ohne Paketmanager. Die CI baut alle Images und startet sie gegen PostgreSQL. Infrastruktur als Code (OpenTofu) folgt mit dem Hosting-Vertrag (E-013).

### E-085 · Neuberechnung gebündelt, nur Änderungen schreiben, Audit ohne Begründungsbaum
- **Datum:** 2026-10-11 · **Status:** angenommen
- Der Lasttest zeigte 39 Unternehmen/s (Ziel verfehlt). Ursachen: eine Anweisung je Instanz, Neuschreiben unveränderter Zeilen, und dadurch je Zeile ein Audit-Eintrag hinter einer globalen Sperre. Jetzt: ein Upsert mit `is distinct from`, ein Update für Entfallenes; Begründungsbaum und Fakten nicht im Audit (reproduzierbar). Ergebnis: Tageswechsel ≈ 149 Unternehmen/s auf 2 Kernen, hochgerechnet 11 min für 100.000. `letzter_lauf_id` zeigt nun auf den letzten Lauf, der die Instanz geändert hat.

## Bauabschnitt 3

### E-086 · ELSTER: Gateway-Schnittstelle jetzt, Übermittlung erst nach Registrierung und J-1
- **Datum:** 2026-10-11 · **Status:** angenommen
- `ElsterGateway` (packages/server) ist die einzige Stelle, über die später übermittelt wird (ERiC in einem isolierten Dienst, docs/01). Bis Herstellerregistrierung und juristische Klärung J-1 vorliegen, liefert das Gateway eine begründete Absage (API: 501 mit Grund und Alternative „Mein ELSTER“). Die Oberfläche bereitet den Fragebogen aus dem Profil vor (Wahl der Kleinunternehmerregelung, Umsatz- und Gewinnprognose laut Spezifikation, plus Stammdaten); Feldnummern des amtlichen Formulars erfinden wir nicht (T-03).

### E-087 · Gründungsassistent aus dem Katalog: phase=gruendung und voraussetzungen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Welche Pflichten zum Assistenten gehören, steht im Katalog (`phase: gruendung`, Katalog A und die Gründungsschritte aus B), die Reihenfolge ergibt sich aus `voraussetzungen` (topologisch), danach Frist und Katalognummer. Offene Voraussetzungen sperren den Erledigen-Knopf („Erst erledigen: …“). Der Validator verbietet Kreise. Eine darüber hinausgehende Reihenfolge (z. B. Notar vor Gewerbeanzeige) nennt die Spezifikation nicht – Prüfpunkt T-04.
- Katalog B (B.14–B.22) als 19 Pflichten aus der Spezifikation; fehlende Fristen sind „laufend ohne Termin“ mit Prüfpunkt, Werte aus B.14 als Regelwerte (Stammkapital, Einzahlung, UG-Rücklage). Neue Fakten `gesellschaft.handelsregister` und `gesellschaft.geschaeftsjahr`; der Onboarding-Schritt „Gesellschaft“ erscheint nur für UG/GmbH. Gewinnangaben dürfen negativ sein; Beträge werden je Sprache gelesen (12.400,50 / 12,400.50).

## Bauabschnitt 4

### E-088 · Finanzen light: GoBD-Grundsätze im Datenmodell, E-Rechnung über eine geprüfte Bibliothek
- **Datum:** 2026-10-11 · **Status:** angenommen
- **Unveränderlich:** Dateien liegen in einer WORM-Ablage (Schlüssel = Unternehmen + SHA-256, nie überschreiben); Dokumente sind in der Datenbank weder änder- noch löschbar (Trigger). Gestellte Rechnungen sind unveränderlich (Trigger), Korrektur nur über eine Stornorechnung mit eigener Nummer und Bezug. Belege werden storniert statt gelöscht. Alles im Audit.
- **Nummern:** fortlaufend je Unternehmen und Jahr (JJJJ-NNNN), vergeben beim Stellen unter Zeilensperre – keine Lücken durch abgebrochene Entwürfe.
- **Rechnen:** Beträge in Cent; Positionen auf Cent gerundet, Steuer je Satz auf die Summe (EN 16931). Steuersätze sind Regelwerte (`steuern.ust.satz_*`), nicht Code; sie stehen nicht in der Spezifikation und sind markiert – ohne Freigabe lässt sich in prod keine Rechnung mit Umsatzsteuer stellen.
- **E-Rechnung:** XRechnung (CII) und ZUGFeRD/Factur-X (Profil XRechnung, PDF/A-3 mit eingebetteter Schrift) über `@e-invoice-eu/core` (gepinnt 3.3.0) statt eigener XML-Erzeugung. Geschäftskunden erhalten beides, Privatkunden ein PDF. Die CI prüft Beispielrechnungen mit dem offiziellen KoSIT-Validator und der XRechnung-Konfiguration.
- **Empfang:** Hochgeladene E-Rechnungen (CII/UBL) werden gelesen und befüllen den Beleg; DOCTYPE/Entitäten werden abgelehnt. Eine vollständige Prüfung beim Empfang braucht den KoSIT-Validator als Dienst (Java) – offen.
- **Kleinunternehmer-Wächter:** Umsatz des Jahres aus den gestellten Rechnungen (netto, Stornos abgezogen) als Fakt `finanzen.umsatz.laufendes_jahr`, nur wenn in Amtlos fakturiert wird; Warnungen bei 80 % und 95 % (Spezifikation C.23) als Katalogpflichten mit Grenzfall-Fixtures.
- **Kassen:** Erfassen einer Kasse meldet „Kasse angeschafft“ und zieht die Profilangaben (elektronische Kasse, Anzahl) als neue Profilversion nach; daraus folgen Meldefrist und TSE-Pflicht.
- **Ablage in Produktion:** Verzeichnis auf verschlüsseltem Volume (`ABLAGE_VERZEICHNIS`, in staging/prod Pflicht); ein S3-kompatibler Objektspeicher mit Object Lock folgt mit dem Hosting.

### E-089 · USt-Voranmeldung nur vorbereiten, ohne Formular-Kennzahlen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Amtlos summiert Umsätze je Steuersatz und Umsatzsteuer aus den Rechnungen (nach Rechnungsdatum) und die Vorsteuer aus den Belegen (nach Belegdatum). Die Kennzahlen des amtlichen Formulars und die Zuordnung (z. B. Leistungs- statt Rechnungsdatum, Soll-/Ist-Versteuerung) stehen nicht in der Spezifikation – Prüfpunkte T-08/T-09. Übermitteln geht erst mit dem ELSTER-Gateway (E-086).

### E-090 · Personal datensparsam, Lohn bleibt beim Partner
- **Datum:** 2026-10-11 · **Status:** angenommen
- Je beschäftigter Person speichert Amtlos nur Vor- und Nachname, Beschäftigungsart, Eintritt, Austritt und (freiwillig) Wochenstunden. Keine Geburtsdaten, Adressen, Sozialversicherungs- oder Steuer-IDs, Bankdaten; Schwangerschaft und Schwerbehinderung nur als Anzahl im Profil, nie je Person (Art. 9 DSGVO).
- Die Profilanzahlen (`beschaeftigte.gesamt`, `…vollzeit` usw.) werden aus der Personalliste nachgezogen (neue Profilversion mit Audit), damit Pflichten, Schwellen und Ampel nicht von Hand gepflegt werden müssen. Gezählt wird, wer nicht vor heute ausgeschieden ist.
- Lohnabrechnung, SV-Meldungen und Lohnsteuer-Anmeldung macht Amtlos nicht selbst (Spezifikation 6.6: Lohnpartner). Bis zur Partnerwahl gibt es einen CSV-Export der Stammdaten und der Arbeitszeiten. Prüfpunkt T-12.
- Einstellung und Austritt laufen über „Personal“ und erzeugen die Ereignisse `einstellung` (beim ersten Mal zusätzlich `erste_einstellung`) und `austritt`; das freie Melden dieser Ereignisse entfällt in der Web-App (sonst Ereignis ohne Person). Navigation: „Personal“ ersetzt „Melden“; „Änderung melden“ steht auf „Heute“.

### E-091 · Pflichten je Ereignis (`je_ereignis`)
- **Datum:** 2026-10-11 · **Status:** angenommen
- Pflichten wie SV-Anmeldung, Sofortmeldung, Nachweisgesetz, Erstunterweisung, Unfallanzeige entstehen je Person bzw. je Vorfall. Neue Fristoption `frist.je_ereignis: true` bei relativen Fristen: die Engine erzeugt eine Instanz je Ereignis mit Periode `aenderung-JJJJMMTT` (Datum des Ereignisses). Mehrere Ereignisse am selben Tag ergeben eine Instanz (eine Erledigung für alle) – bewusst einfach, Prüfpunkt T-15.
- Die Checkliste zur Einstellung ist keine eigene Datenstruktur, sondern die Sicht auf die Instanzen mit der Periode des Eintrittstags.

### E-092 · Unterweisung mit einfacher elektronischer Signatur, Zeiterfassung nur anhängend
- **Datum:** 2026-10-11 · **Status:** angenommen
- **Unterweisung:** Thema und Inhalt werden gehasht (SHA-256); jede Bestätigung speichert den eingetippten Namen, Zeitpunkt und den Hash des bestätigten Inhalts. Der Name muss zur Person passen (ohne Groß-/Kleinschreibung, Leerzeichen normalisiert). Nach der ersten Bestätigung ist der Inhalt gesperrt, nach dem Abschließen die ganze Unterweisung (Trigger). Abschließen legt ein PDF-Protokoll als unveränderliches Dokument ab, meldet `unterweisung_durchgefuehrt` (→ Wiederholung nach einem Jahr) und erledigt offene Unterweisungspflichten mit dem Protokoll als Nachweis. Ob die einfache elektronische Signatur als Nachweis genügt: T-13.
- **Zeiterfassung:** Einträge sind nur anhängbar; einzige Änderung ist das einmalige Schließen eines offenen Stempels. Nachträge und Korrekturen brauchen einen Grund; eine Korrektur ist ein neuer Eintrag mit Verweis auf den ersetzten (oder eine Stornierung). Gültig ist, was weder ersetzt noch storniert ist (View). Höchstens ein offener Stempel je Person (Unique-Index). Die konkreten Aufzeichnungspflichten (MiLoG, ArbZG nach BAG/EuGH, geplante Neuregelung) sind als Katalogpflichten markiert; T-14.
- Mitarbeitende können stempeln und bestätigen; Nachträge, Korrekturen, Exporte und Stammdaten nur Inhaber, Admin, Steuerberatung.

### E-093 · Schwellenwert-Wächter rechnet mit der Engine
- **Datum:** 2026-10-11 · **Status:** angenommen
- Für 10, 20, 50, 150, 250 Beschäftigte (Spezifikation 6.6) und zusätzlich „eine Person mehr“ wertet die API den aktiven Katalog mit dem heutigen Profil aus, nur die Beschäftigtenzahl verändert, und zeigt je Stufe die Pflichten, die neu hinzukämen. Hängt eine Pflicht von einer noch nicht erfassten Zählweise ab (Ergebnis „unbekannt“), steht sie als „zu prüfen“ da (G-05). Keine eigene Schwellenlogik im Code – die Schwellen sind Regelwerte der Pflichten.

### E-094 · Arbeitsschutz-Dokumentation ohne fachliche Vorgaben im Code
- **Datum:** 2026-10-11 · **Status:** angenommen
- **Gefährdungsbeurteilung** als strukturierte Daten je Arbeitsbereich: Gefährdung (gegliedert nach den Faktoren des § 5 Abs. 3 ArbSchG, Wortlaut zu prüfen T-18) → Risiko (gering/mittel/hoch, Methode zu prüfen T-19) → Maßnahme, Verantwortliche, Termin → Umsetzung → Wirksamkeit. Abschließen erzeugt ein PDF als unveränderliches Dokument und erledigt die Pflicht (mit Häkchen „Mutterschutz“ auch die anlassunabhängige Beurteilung nach MuSchG). Danach ist die Beurteilung gesperrt (Trigger); Umsetzung und Wirksamkeit bleiben nachtragbar, weil Maßnahmen erst danach umgesetzt werden. Änderungen im Betrieb → neue Beurteilung. **Branchenvorlagen** (Spezifikation E.50) sind fachlicher Inhalt und werden nicht erfunden – sie folgen nach Prüfung durch eine Fachkraft (T-20).
- **Elektrische Arbeitsmittel:** Verzeichnis mit Prüfhistorie (nur anhängend). Das Prüfintervall legt der Betrieb fest; Amtlos rechnet nur den nächsten Termin aus (Monatsende beachtet) und zeigt Überfälliges. Keine Standard-Prüffristen im Code.
- **Gefahrstoffe:** Verzeichnis mit Sicherheitsdatenblatt (PDF, unveränderlich abgelegt) und Verzeichnis-PDF auf Abruf. Entfernte Stoffe bleiben im Verlauf.
- Erfassen eines Geräts bzw. Gefahrstoffs setzt die passende Profilangabe (`arbeitsschutz.elektrische_geraete`, `arbeitsschutz.gefahrstoffe`), damit die Pflichten ohne erneutes Onboarding erscheinen.
- Pflicht-Details verlinken auf die Stelle in Amtlos, an der die Pflicht erledigt wird („In Amtlos erledigen“), über `aktion.ziel` bzw. die Pflicht-ID.

### E-095 · Datenschutz-Modul: Struktur statt Inhalt, Fristen aus Ereignissen
- **Datum:** 2026-10-11 · **Status:** angenommen
- **VVT, TOM, Dienstleister:** Amtlos gibt die Gliederung vor (VVT-Felder nach Art. 30, TOM nach den Schutzzielen des Art. 32 Abs. 1, AVV-Status je Dienstleister) und schlägt aus dem Profil nur **Bezeichnungen** von Verarbeitungen vor. Zwecke, Rechtsgrundlagen, Löschfristen und Maßnahmen trägt der Betrieb ein – keine vorformulierten Rechtsinhalte (T-22, T-24). Fehlende Kernangaben werden je Verarbeitung angezeigt. „Stand ablegen“ erzeugt ein PDF (VVT + TOM + Dienstleister) als unveränderliches Dokument und erledigt VVT (≥ 1 Verarbeitung), TOM (≥ 1 umgesetzte Maßnahme) und AVV (alle Auftragsverarbeiter mit Vertrag).
- **Betroffenenanfragen:** Eingang erfassen erzeugt das Ereignis `betroffenenanfrage`; die Pflicht entsteht je Eingangstag (`je_ereignis`, P1M). Die Frist der Anfrage wird mit derselben Monatsregel berechnet (Monatsende). Beantworten erledigt die Pflicht, sobald keine Anfrage dieses Tages mehr offen ist. Gespeichert wird nur, was zur Bearbeitung nötig ist (Name/Kontakt, Art, Antwort in Stichworten).
- **Datenpannen:** Notfallknopf für alle Mitglieder (auch Mitarbeitende), erfasst Zeitpunkt der Entdeckung (unveränderlich) und Beschreibung, meldet `datenpanne`. Countdown stundengenau (72 h), Katalogfrist tagesgenau (P3D, T-23). Bewertung kein/Risiko/hohes Risiko; „kein Risiko“ nur mit Begründung (Datenbank-Check). Meldeentwurf als PDF nach den Mindestangaben des Art. 33 Abs. 3; gemeldet wird über das Portal der Aufsichtsbehörde (keine Schnittstelle). Abschließen dokumentiert jede Panne – auch nicht meldepflichtige (Art. 33 Abs. 5) – unveränderlich; Löschen ist ausgeschlossen.
- **KI-Kompetenz:** keine eigene Schulungstabelle, sondern das Unterweisungsmodul mit `art = ki_kompetenz` (gleiche Bestätigung per Namen, gleiches PDF). Abschließen erledigt `ki.kompetenz`. Die Gliederung im Formular ist nur ein Vorschlag (T-25).
- **NIS2:** Ohne Sektorliste und Größenschwellen in der Spezifikation fragt Amtlos die Betroffenheit als Profilangabe (ja/nein/weiß nicht) ab; daraus folgen Registrierung (Nachfrist 31.7.2026) und Meldepflichten. Ein geführter Betroffenheitscheck folgt nach fachlicher Zulieferung (T-26).

### E-096 · Navigation mit sieben Bereichen
- **Datum:** 2026-10-11 · **Status:** angenommen
- „Datenschutz“ kommt als eigener Navigationspunkt hinzu (Spezifikation 6.7). Damit die Ziele in der mobilen Leiste groß genug bleiben (≥ 44 px Höhe, ≥ 55 px Breite bei 390 px), steht „Einstellungen“ mobil im Kopf statt in der Leiste; am Desktop bleibt es in der Seitenleiste.

### E-097 · Online-Check: synchron, eng begrenzt, SSRF-geschützt, nur Heuristiken
- **Datum:** 2026-10-11 · **Status:** angenommen
- Der Check läuft in der API synchron (Startseite + Impressum + Datenschutz, je ≤ 2 MB, ≤ 8 s, ≤ 3 Weiterleitungen, nur `text/html`). Ein Worker-Job lohnt erst mit tieferem Crawling (Produktseiten, GPSR) oder echtem Browser-Test.
- **SSRF-Schutz:** nur http/https, keine Zugangsdaten in der URL, nur Ports 80/443, jede DNS-Antwort wird vor dem Verbinden geprüft (eigene `lookup`-Funktion, keine Lücke durch DNS-Rebinding zwischen Prüfung und Verbindung), IP-Literale und `localhost` vorab, jede Weiterleitung erneut. Private Netze nur mit `ONLINECHECK_PRIVATE_NETZE=erlaubt` – in staging/prod verboten (Konfigurationsprüfung). Tageslimit je Unternehmen (`ONLINECHECK_JE_TAG`, Standard 20).
- **Prüfung:** reine Funktion über die abgerufenen Seiten, Ergebnis je Befund „ok / fehlt / prüfen / nicht automatisch prüfbar“ mit Schwere und Verweis auf die Pflicht; sortiert nach Dringlichkeit. Tracking wird statisch erkannt (Skripte bekannter Dienste, die ohne Einwilligung geladen werden; durch Consent-Tools blockierte Skripte mit `type="text/plain"` zählen nicht). Barrierefreiheit nur als Basistests (Sprache, Titel, Alternativtexte, Beschriftungen) – keine vollständige WCAG-Prüfung. Die „Korrekturvorlagen“ sind Handlungshinweise, keine Rechtstexte (T-28). Der Prüfumfang folgt dem Profil (z. B. Kündigungsbutton nur bei Abos).
- Ergebnisse sind unveränderlich gespeichert (Verlauf); ein erfolgreicher Check setzt die Profilangabe „Website“.

### E-098 · Mobile Navigation mit „Mehr“
- **Datum:** 2026-10-11 · **Status:** angenommen (ersetzt den mobilen Teil von E-096)
- Mit „Online“ hat die App acht Bereiche. Am Desktop stehen alle in der Seitenleiste. Mobil zeigt die Leiste fünf Bereiche (Heute, Pflichten, Kalender, Finanzen, Personal) und „Mehr“; dort stehen Datenschutz, Online, Änderung melden, Team, Hilfe und Einstellungen. „Mehr“ ist aktiv markiert, wenn man sich in einem dieser Bereiche befindet. Der Notfallknopf für Datenpannen ist zusätzlich von „Heute“ und „Änderung melden“ aus erreichbar.

### E-099 · Branchenpakete: Katalog-Zuordnung plus wenige Werkzeuge
- **Datum:** 2026-10-11 · **Status:** angenommen
- Ein Branchenpaket ist **keine eigene Datenstruktur**: Pflichten tragen im Katalog das Feld `branchen` (vorhandene Pflichten wurden zugeordnet und dafür in neuer Version veröffentlicht, Versionen bleiben unveränderlich). Die Seite „Branche“ zeigt je Branche des Profils die zutreffenden Pflichten und die passenden Werkzeuge. Onlinehandel gilt auch bei angegebenem Onlineshop.
- Katalog H (18 neue Pflichten) für alle neun Branchen der Spezifikation; ausgebaut mit eigenen Werkzeugen ist zuerst die **Gastronomie**: HACCP-Eigenkontrollen (Messpunkte mit vom Betrieb festgelegten Grenzwerten, Messungen nur anhängend, Abweichung nur mit Maßnahme, Grenzwerte je Messung mitgespeichert, Monatsprotokoll), **Allergenliste** je Gericht mit den 14 Hauptallergenen nach Anhang II LMIV (Liste als feste Auswahl, fachlich zu prüfen T-33) und Aushang-PDF, **Belehrung nach § 43 IfSG** als Unterweisungsart, die die Pflicht je Einstellung erledigt. Handwerk, Bau und Beauty nutzen die vorhandenen Arbeitsschutz-Werkzeuge; Onlinehandel den Online-Check; IT die Dienstleister- und KI-Werkzeuge.
- Keine Grenzwerte, Kontrollfrequenzen, Prüffristen oder Verjährungsfristen im Code – wo die Spezifikation sie nicht nennt, sind sie Prüfpunkte.

### E-100 · Frag Amtlos: reine Suche im Katalog, kein Sprachmodell
- **Datum:** 2026-10-11 · **Status:** angenommen
- „Frag Amtlos“ (6.10) antwortet in dieser Stufe **ausschließlich mit den Texten gefundener Katalogobjekte**: bis zu drei Pflichten (Titel, Kurztext, Erklärung, Rechtsgrundlage, Quellen, Prüfstatus mit Datum, „gilt für dich“ aus den Instanzen) und bis zu zwei Regelwerte (die am Stichtag gültige Version). Die Suche ist eine gewichtete Wortsuche (Titel > Fachbegriffe > Kurztext/Rechtsgrundlage > Erklärung) mit Umlaut-Normalisierung und groben Wortstämmen; Pflichten, die für das Unternehmen gelten, werden leicht bevorzugt. Unter einer Mindestpunktzahl antwortet Amtlos „weiß ich nicht sicher“.
- Fragen, die individuelle Steuer- oder Rechtsberatung wären („Soll ich …“, „lohnt sich“, „in meinem Fall“, „Einspruch einlegen“), werden erkannt und auf den Marktplatz verwiesen (StBerG/RDG). Die gefundenen allgemeinen Katalogtexte werden trotzdem gezeigt.
- **Kein Sprachmodell**, solange Anbieter, AVV und EU-Hosting nicht geklärt sind. Die Schnittstelle `KiGateway` ist vorbereitet; ein Modell darf später **nur die gefundenen Passagen umformulieren**, Quellen bleiben die gefundenen Katalogobjekte, `ki_formuliert` wird dann `true` und angezeigt. Fragen werden nicht gespeichert.

### E-101 · Behörden-Postfach: Hochladen und Einordnen von Hand
- **Datum:** 2026-10-11 · **Status:** angenommen
- Briefe werden als unveränderliches Dokument abgelegt (PDF, JPG, PNG bis 15 MB, Dateityp am Inhalt geprüft, doppelte Briefe über den Hash abgewiesen) und **von Hand** eingeordnet: Absender, Art (Bescheid, Mahnung, Anhörung, Auskunftsersuchen, Sonstiges), Aktenzeichen, Betrag, Verknüpfung mit einer Pflicht und die **Frist so, wie sie im Brief steht**. Amtlos berechnet keine Einspruchs- oder Zahlungsfristen aus dem Zugang (Bekanntgabefiktion usw. → T-37).
- Offene Brieffristen und Geräteprüfungen erscheinen als „weitere Termine“ auf „Heute“ (nächste 60 Tage), im Kalender und im ICS-Abo.
- Zu jeder Briefart gibt es eine **allgemeine** Erklärung, nie eine Bewertung des konkreten Bescheids (J-2). Für Einspruch oder Widerspruch verweist die Seite auf den Marktplatz.
- Noch nicht gebaut: Texterkennung (OCR) mit Vorschlag der Felder, KI-Zusammenfassung, Weiterleitung per E-Mail-Adresse je Unternehmen. Sie brauchen einen Anbieter mit AVV, und die Grenze nach J-2 muss geklärt sein.

### E-102 · Experten-Marktplatz ohne Zahlung und Provision
- **Datum:** 2026-10-11 · **Status:** angenommen (bis J-4 geklärt ist)
- Partner (Steuerberatung, Rechtsanwalt, Fachkraft für Arbeitssicherheit, Datenschutzbeauftragte) pflegt die Plattform im Studio (`katalog.partner`). Nur Plattform-Admin oder Redaktion darf das. **Sichtbar sind Partner nur mit eingetragenem Datum der Zulassungsprüfung.** Pakete und Preise sind Angaben des Partners.
- Eine Anfrage braucht eine **ausdrückliche Einwilligung**. Weitergegeben werden immer Name und E-Mail-Adresse (sonst ist keine Antwort möglich), dazu nur die angehakten Angaben zum Unternehmen und die offenen Pflichten. Gespeichert wird genau diese Momentaufnahme. Der Versand läuft über die Warteschlange per E-Mail an den Partner, die Antwort geht direkt an die Nutzerin.
- Amtlos ist an Beauftragung und Bezahlung nicht beteiligt: keine Provision, kein Checkout, keine Bewertungen, bis das Vergütungsmodell nach Berufsrecht geklärt ist (J-4). Partner aus dem eigenen Bundesland oder bundesweit stehen oben.

### E-103 · Rechtsänderungs-Radar und „Was ändert sich für dich?“
- **Datum:** 2026-10-11 · **Status:** angenommen
- Geplante und beschlossene Regeln stehen als normale Pflichten im Katalog, mit `status_recht` entwurf/geplant/beschlossen und einem Block `radar` (Wahrscheinlichkeit, erwartet ab, Checkliste zur Vorbereitung). Die Engine wertet sie wie jede Regel aus, markiert sie aber als Radar. Sie erzeugen **keine Instanzen, Fristen oder Erinnerungen**. Das Radar wird bei jedem Aufruf neu berechnet und nicht gespeichert.
- Zusätzlich zeigt das Radar in Kraft gesetzte Regeln, die in den nächsten 24 Monaten zu gelten beginnen (ausgewertet am Tag des Inkrafttretens), und neue Werte für Regelwerte, die eine geltende Pflicht nutzt (z. B. Mindestlohn alt → neu).
- Benachrichtigungen: Nach einer Neuberechnung, die ein **Release** ausgelöst hat, meldet Amtlos jeder Person des Unternehmens neue zutreffende Pflichten und offene Pflichten, die jetzt in neuer Version gelten. Bis zu 10 Einzelmeldungen, darüber eine Sammelmeldung. Bei der ersten Berechnung eines Unternehmens gibt es keine Meldungen. Meldungen sieht nur die eigene Person (restriktive RLS-Policy). Sie erscheinen auf „Heute“ und lassen sich als gelesen markieren. E-Mail-Versand der Meldungen folgt mit den Benachrichtigungseinstellungen.

### E-104 · Navigation: Postfach in der Seitenleiste, „Mehr“ auch am Desktop
- **Datum:** 2026-10-11 · **Status:** angenommen (ergänzt E-098)
- Am Desktop steht „Postfach“ in der Seitenleiste. „Mehr“ gibt es jetzt auch am Desktop: Es führt zu Frag Amtlos, Radar, Experten, Änderung melden, Team und Hilfe. Mobil zeigt „Mehr“ zusätzlich die Bereiche, die nur am Desktop in der Leiste stehen. Frag Amtlos ist außerdem als Suchfeld auf „Heute“ erreichbar, das Radar von „Heute“ und „Pflichten“.

### E-105 · White-Label-Marken: nur Name, zwei geprüfte Farben, Logo
- **Datum:** 2026-10-11 · **Status:** angenommen
- Partner (Steuerberatungen, Kammern, Verbände) bieten Amtlos unter eigener Adresse an. Eine Marke (`katalog.marke`, Pflege nur durch Plattform-Admins im Studio) hat Name, Hostnamen, eine Handlungsfarbe für hell und eine für dunkel, ein optionales Logo (https-Bild) und eine Support-Adresse. Die Web-App erkennt die Marke am Hostnamen (`GET /v1/marke?host=`, öffentlich, fünf Minuten zwischengespeichert). Sie ersetzt „Amtlos“ durch den Markennamen mit dem Zusatz „mit Amtlos“, setzt die Farben als CSS-Variablen und passt den Seitentitel an.
- **Barrierefreiheit bleibt erhalten:** Beide Farben müssen auf allen Flächen des Designsystems mindestens 4,5 : 1 Kontrast erreichen (Prüfung beim Speichern, Kontrastwerte in der Studio-Liste). Abgeleitete Töne entstehen mit `color-mix`. Es gibt kein freies CSS, kein HTML und keinen Logo-Upload: kein Einfallstor für Skripte und keine Verschlechterung der Lesbarkeit.
- Inhalte, Prüfstatus, Datenschutz und Konten bleiben gleich. Unternehmen merken sich die Marke, unter der sie angelegt wurden (`marke_id`, Lizenzbericht im Studio als reine Anzahl). Rechtliche Fragen zu Impressum, Verantwortlichkeit und Vertrag: T-43.

### E-106 · Kanzleien: Mandantenübersicht und Mandanten anlegen
- **Datum:** 2026-10-11 · **Status:** angenommen
- `/kanzlei` zeigt alle Unternehmen der Person mit Ampel, Zählern und der dringendsten Pflicht, Überfälliges zuerst. Die Daten kommen aus einer Transaktion, die den Unternehmenskontext je Unternehmen setzt. RLS gilt also wie bei jedem Einzelaufruf, es gibt keine Sicht über Mandanten hinweg in der Datenbank.
- **Mandant anlegen:** Die Kanzlei wird Mitglied mit Rolle „Steuerberatung“. Die Mandantin erhält eine Einladung als **Inhaberin**. Inhaber-Einladungen sind nur auf diesem Weg möglich (Datenbankregel `mandant_anlage`). Normale Einladungen vergeben nie die Inhaberrolle (E-079). Der Link wird wie bei Team-Einladungen nur einmal angezeigt. Ob die Kanzlei dafür eine Vollmacht oder einen AVV braucht: T-45.

### E-107 · Englische Katalogtexte als Übersetzungsschicht
- **Datum:** 2026-10-11 · **Status:** angenommen
- Veröffentlichte Versionen sind unveränderlich, deshalb hängen Übersetzungen nicht an der Version, sondern am **deutschen Text**: `katalog.uebersetzung (sprache, de, text, status)`, Quelle `catalog/uebersetzungen/en.yaml`. Je Version wird ein lokalisiertes Dokument vorberechnet (`*_lokal`, Trigger bei neuen Versionen, Auffrischen nach Import oder Prüfung). Lesende Stellen verwenden die Sichten `*_anzeige`. Ändert sich der deutsche Text, fehlt die Übersetzung und es erscheint Deutsch.
- Startbestand: 732 Texte, **mit KI übersetzt** (Status `maschinell`), Zahlen und Fundstellen per Test gegen das Original geprüft. Verbindlich ist immer Deutsch. Die englische Oberfläche sagt das unter jeder Seite. Im Studio prüft die Redaktion Texte, geprüfte Einträge gewinnen beim nächsten Import gegen die Datei (Datenbank ist Quelle der Wahrheit, E-030). Ein Test stellt sicher, dass jeder deutsche Katalogtext eine Übersetzung hat.
- **Ersetzt den zweiten Satz von E-040:** `en` muss nicht mehr im Versionsdokument stehen. Die Release-Bedingung für prod lautet künftig, dass jeder deutsche Text eine geprüfte Übersetzung hat. Erzwungen wird das mit dem Livegang (G-24); bis dahin zeigt die App den Hinweis.
- Die Oberfläche schickt ihre Sprache je Anfrage (`X-Sprache`). Die Kontosprache (`PUT /v1/ich/sprache`) bestimmt E-Mails und Push. PDFs für Behörden und Dokumentationen bleiben deutsch.

### E-108 · Mobile App mit Expo, offline stempeln, Push über Expo
- **Datum:** 2026-10-11 · **Status:** angenommen (Store-Veröffentlichung offen)
- `apps/mobile`: React Native mit Expo SDK 54 (die neueste Version, deren Schnittstellen wir sicher kennen), Texte aus `@amtlos/i18n`, Farben aus dem Designsystem, Tippziele ≥ 48 pt, Rollen und Zustände für Screenreader. Funktionen nach Spezifikation „mobil zuerst“: Heute, offene Pflichten, Stempeln, Belege fotografieren, Push. Erledigen mit Nachweis und Formulare bleiben am Computer.
- **Offline-Stempel** (umgesetzt nach E-018): Jeder Stempel bekommt beim Tippen eine `client_id` und den Gerätezeitpunkt und wird zuerst lokal gespeichert, dann übertragen. Die API ist über `client_id` idempotent. Ein Gerätezeitpunkt wird nur angenommen, wenn er höchstens 72 Stunden alt ist und nicht in der Zukunft liegt. Solche Einträge sind als `offline` gekennzeichnet; `erfasst_am` zeigt den Eingang beim Server. Sofort übertragene Stempel nutzen die Serverzeit. Abgelehnte Stempel werden angezeigt, nie stillschweigend verworfen (T-44).
- **Push:** Geräte gehören zum Konto (`app.geraet`, RLS je Konto, Token-Wechsel über eine Funktion). Erinnerungen gehen bei registriertem Gerät zusätzlich als Push. Der Sperrbildschirm zeigt nur Titel und Datum. Ungültige Tokens werden abgemeldet. Versand über den Expo-Push-Dienst, im Worker standardmäßig **aus** (`PUSH_ANBIETER=expo` schaltet ein), weil Expo an APNs/FCM weiterleitet (T-41).
- Anmeldung: OIDC mit PKCE (Identity-Provider offen, E-061). In dev/test stellt `POST /v1/dev/token` ein Token aus (nur mit `AUTH_MODUS=dev`, in staging/prod durch die Konfigurationsprüfung ausgeschlossen). CI bündelt die App für Android und iOS.
- Benachrichtigungseinstellungen (E-Mail/Push, Tage vorher) gibt es jetzt je Person und Unternehmen in Web und API.

### E-109 · Skalierung: Index für jeden RLS-Filter, nur Unterschiede schreiben
- **Datum:** 2026-10-11 · **Status:** angenommen
- Jede Mandantentabelle braucht einen Index mit `unternehmen_id` vorne. Migration 0017 ergänzt 24 fehlende, ein Schematest erzwingt die Regel. Die Erinnerungsplanung schreibt nur noch Unterschiede. Lasttest mit 10.000 Unternehmen und 146 Pflichten: Tageswechsel hochgerechnet 14,8 Minuten für 100.000 Unternehmen, Durchsatz unabhängig von der Mandantenzahl (docs/testberichte/lasttest.md).
- Horizontal: API und Worker sind zustandslos bis auf Prozess-Caches (Katalog je Release, Konten fünf Minuten). Diese Caches sind unkritisch, weil ein neues Release eine neue ID hat. Die Ratenbegrenzung zählt je Prozess (E-082). Bei mehreren API-Instanzen wirkt das Limit also je Instanz; vor dem Livegang gehört sie an den Ingress oder in einen gemeinsamen Speicher (G-23). Worker skalieren über pg-boss (je Unternehmen ein Singleton-Job).

### E-110 · Launch-Umfang: Kernmodule für Gründer, Breite hinter einem Schalter
- **Datum:** 2026-10-11 · **Status:** angenommen
- Zielgruppe der ersten zehn Wochen sind Gründer und Solo-Selbstständige. Sichtbar sind nur Heute, Pflichten, Kalender, Gründung, Finanzen, Personal (ohne Arbeitsschutz-Werkzeuge), Postfach, Team, Einstellungen, Hilfe. Datenschutz-Werkzeuge, Arbeitsschutz-Werkzeuge, Online-Check, Branchen-Werkzeuge, Marktplatz, Frag Amtlos, Radar und Kanzlei sind mit `AMTLOS_UMFANG` (leer = Kern, `alles`, oder Liste) abgeschaltet: keine Navigation, keine Links, Seiten antworten mit 404. Der Code bleibt, die API bleibt. Pflichten dieser Bereiche bleiben im Katalog sichtbar, nur ohne „In Amtlos erledigen“.
- Grund: Jede sichtbare Funktion kostet Erklärung, Support und Prüfaufwand. Für den Aha-Moment zählt nur der Kern. CI testet beide Umfänge (voller Rundgang mit `alles`, Kern-Rundgang mit Standard).

### E-111 · Schnellstart mit fünf Schritten, alles Weitere als Nachfragen
- **Datum:** 2026-10-11 · **Status:** angenommen
- Das Onboarding stellt nur noch die Kernfragen (`schnell: true`): Rechtsform (+ Handelsregister bei Kapitalgesellschaften), Tätigkeit und Branche, Start und **Bundesland** (statt Gemeindeschlüssel), Kleinunternehmerregelung, Beschäftigte. Fünf Schritte, etwa zwei Minuten. Der Gemeindeschlüssel bleibt optional (nur für örtliche Feiertage) und bestimmt das Bundesland, wenn er angegeben ist.
- Alle übrigen Fragen bleiben im Katalog der Fragen und werden als **Nachfragen** gestellt: auf „Heute“ als eine Fragerunde je Thema („Nächste Runde: Steuern – 4 Fragen“), in der Reihenfolge der Schritte, nur unbeantwortete Fragen. Fehlende Angaben erscheinen nicht mehr als einzelne Aufgaben, sondern als diese Runden; in der Dringlichkeit stehen sie hinter allen Fristen eines Jahres.
- Nach dem letzten Schritt aktualisiert sich „Heute“ selbst, bis die erste Berechnung fertig ist, und zeigt dann die Willkommenskarte mit den Zahlen, die zählen: geltende Pflichten und Fristen in den nächsten 90 Tagen.

### E-112 · Heute: eine klare nächste Handlung
- **Datum:** 2026-10-11 · **Status:** angenommen
- Reihenfolge auf „Heute“: Willkommen (einmal) · Erledigt-Bestätigung · Meldungen · **Jetzt dran** (eine Karte mit Knopf) · Danach (zwei Zeilen) · Zähler mit Fortschritt (erledigt in Prozent) · Gründung · Nachfragen · Fristen vor dem Start (leise) · weitere Termine · Melden · Bereiche. Erledigen führt mit Bestätigung zurück auf „Heute“, wo sofort das Nächste steht; die Notiz ist eingeklappt. Fehlerseite innerhalb der App behält die Navigation und sagt, dass die Daten sicher sind.
- Bewusst ohne Lade-Skelett: Die Seiten antworten serverseitig in unter 150 ms; ein aufblitzendes Skelett wäre schlechter als nichts (und machte die E2E-Prüfung unzuverlässig).

### E-113 · Abo: Testphase, dann Stripe; Lesen bleibt immer möglich
- **Datum:** 2026-10-11 · **Status:** angenommen
- Jedes Unternehmen beginnt mit einer Testphase (`ABO_TESTTAGE`, Standard 14; Trigger beim Anlegen). Danach sperrt die API **nur das Schreiben** (HTTP 402 mit Abo-Stand); Lesen, Export, Abo abschließen, Team verlassen und Unternehmen löschen gehen immer. Die Web-App leitet bei 402 auf die Abo-Seite; sieben Tage vor Ende erscheint ein Hinweis. Bei Zahlungsproblemen 14 Tage Kulanz.
- Stripe ohne SDK: Checkout-Session (Abo, automatische Steuer, USt-IdNr.-Erfassung), Kundenportal, Webhook mit Signaturprüfung über den rohen Body und Idempotenz über die Ereignis-ID (`app.abrechnungsereignis`). Der Abo-Status ändert sich nur über Systemfunktionen, nie direkt aus der App. Preis und Plan sind Konfiguration (`STRIPE_PREIS_ID`), ohne Schlüssel ist Bezahlen abgeschaltet (nur Testphase). In staging/prod sind die Stripe-Variablen Pflicht.

### E-114 · Löschen und Export (DSGVO Art. 17 und 20)
- **Datum:** 2026-10-11 · **Status:** angenommen
- **Export:** alle Tabellen des Unternehmens als eine JSON-Datei (Inhaber/Admin); Dateien bleiben einzeln abrufbar.
- **Unternehmen löschen** (nur Inhaber, Name zur Bestätigung): sofort für alle unsichtbar (RLS-Policy prüft `geloescht_am`), Erinnerungen weg, Abo beendet. Nach 30 Tagen löscht der Worker personenbezogene Daten ohne Aufbewahrungspflicht und macht Namen unkenntlich. Belege, Rechnungen, Nachweise, Zeiten und Unterweisungen bleiben bis zur Klärung der Aufbewahrungsfristen (G-09) – ohne Unternehmensnamen und ohne Personennamen.
- **Konto löschen:** nur ohne aktives Unternehmen; E-Mail, Name und Identitätskennung werden unkenntlich (das Konto bleibt als Zeile für Audit und Nachweise, ist aber niemandem mehr zuzuordnen).

### E-115 · Rechtsseiten als Konfiguration mit sichtbarem Entwurfshinweis
- **Datum:** 2026-10-11 · **Status:** angenommen
- Impressum, Datenschutzerklärung und Nutzungsbedingungen liegen als strukturierte Texte in den Übersetzungen; Betreiberangaben kommen aus `RECHT_*`. Solange `RECHT_FREIGEGEBEN` nicht `ja` ist, steht oben der Hinweis, dass die Seite ein Entwurf ist (T-46). Links stehen im Fuß jeder Seite und auf der Anmeldeseite.

### E-116 · Leistungsbudget
- **Datum:** 2026-10-11 · **Status:** angenommen
- Kernseiten antworten serverseitig in unter 1,5 s und sind in unter 3 s vollständig geladen (auf dem CI-Läufer geprüft; lokal unter 150 ms). Die E2E-Prüfung misst das bei jedem Lauf. JavaScript nur, wo es Interaktion braucht (Kopierfeld, Auto-Aktualisierung, Navigation).

### E-117 · App zuerst für iPhone: ruhig, nativ, ein prägendes Element
- **Datum:** 2026-10-11 · **Status:** angenommen
- Die App ist zuerst für iOS gebaut (Android bleibt lauffähig, wird aber nicht gestaltet). Gestaltung folgt dem Designsystem (docs/06): Papier und Tinte, eine Handlungsfarbe, Statusfarben nie allein; Schrift Atkinson Hyperlegible wie im Web; große Titel wie in iOS-Apps; Tippziele 48 pt.
- **Fristblatt** als das eine prägende Element – in jeder Zeile klein, auf der Pflicht-Karte groß. SF Symbols auf iOS (Ionicons als Ersatz), Tableiste mit Unschärfe, dezente Haptik beim Tippen.
- **Ein animierter Moment:** der Erledigt-Stempel (Feder-Animation, Erfolgs-Haptik). Sonst keine Bewegung ohne Anlass.
- **Pflicht-Karte** als Blatt von unten (Seitenvertrag docs/04): Was · Bis wann · Erledigen · Warum · Was sonst · Mehr · Quellen. Erledigen und Wieder öffnen gehen in der App; Angaben ändern bleibt am Computer.
- **Schnellstart und Nachfragen in der App** (dieselben Fragen wie im Web, E-111): Wer sich zuerst auf dem Handy anmeldet, kommt ohne Computer zur ersten Pflichtenliste. „Heute“ zeigt dieselbe eine nächste Handlung wie das Web (E-112).
- **Abo nicht in der App:** Die App zeigt nur den Stand (Testphase, aktiv) und verweist zum Computer – kein Bezahlen und kein Link zum Abschluss in der App, bis die Store-Regeln geklärt sind (T-49).
- Prüfung ohne Simulator über den Web-Export (`apps/mobile/e2e/schau.mjs`); die iOS-Darstellung wird vor dem Store auf echten Geräten geprüft.

### E-118 · Web: Listen zeigen das Terminierte, Unklares gebündelt
- **Datum:** 2026-10-11 · **Status:** angenommen
- „Pflichten“ ohne Filter zeigt nur Pflichten mit klarem Stand. Pflichten mit fehlender Angabe erscheinen als ein Hinweis mit Weg zu den Nachfragen (einzeln über den Filter „Angabe fehlt“); laufende Pflichten ohne Termin stehen eingeklappt am Ende. Auf „Heute“ haben Nebenkarten (Gründung, Nachfragen, vor dem Start) dieselbe ruhige Form; nur „Jetzt dran“ trägt die Statusfarbe als Rahmen.
- Zeilen, die irgendwohin führen, haben Pfeil und Erklärung (`VerweisZeile`); Kästchen und Optionsfelder in der Handlungsfarbe (`accent-color`). Anmeldeseite mit Versprechen und Fristblatt des Tages statt nur einem Formular.

### E-119 · Demo-Modus mit Rechnen auf dem Gerät und Testpaket für Expo Go
- **Datum:** 2026-10-11 (überarbeitet 2026-10-12) · **Status:** angenommen
- Die App hat einen Demo-Modus ohne Server und ohne Konto: „Ohne Konto ausprobieren“. Er startet leer wie die echte App – Unternehmen anlegen, Schnellstart, Nachfragen –, und das Gerät berechnet die Pflichten mit **derselben Regel-Engine und demselben Katalog** wie der Server. Keine Beispieldaten, nichts erfunden.
- Dafür liegen die reinen Teile der Berechnung jetzt in `@amtlos/rules-engine` und werden von Server und App gemeinsam genutzt: `sollInstanzen` (vorher in packages/server), `anzeigeStatus` (TS-Gegenstück zur Sicht `app.pflicht_instanz_anzeige`), `heuteUebersicht`/`dringlichkeit`/`BEREICH_JE_KATEGORIE` (vorher in apps/api). Die Karte (`karte()`) ist in der Demo nachgebildet.
- Katalog fürs Gerät: `werkzeuge/katalog-buendel.mjs` schreibt `src/demo/katalog.json` aus `catalog/` inkl. englischer Übersetzungen nach der Regel von `katalog.lokalisiere`. CI prüft, dass das Bündel aktuell ist.
- Der Demo-Stand (Unternehmen, Profil, Erledigungen) liegt in AsyncStorage und übersteht das Schließen der App; beim Öffnen wird neu gerechnet wie im täglichen Lauf. „Demo beenden“ löscht ihn. Nicht in der Demo: Ereignisse, Beschäftigte, Push, Abo, Web-Links, Rechtsseiten.
- Test: Für alle Fixtures aus `catalog/fixtures` ohne Ereignisse liefert die Demo dieselben Ergebnisse (gilt/gilt nicht/unbekannt) wie die Engine.
- Expo SDK auf 57 angehoben (React Native 0.86, React 19.2), weil die aktuelle Expo-Go-App nur das neueste SDK lädt.
- Testpaket für Expo Go (`werkzeuge/testpaket.sh`): die App ohne Monorepo, Übersetzungen, Engine und Fristen über tsconfig-Pfade eingebettet, `authModus: "demo"`.

### E-120 · Alle Kernbereiche auch in der App; gemeinsame Fachlogik
- **Datum:** 2026-10-12 · **Status:** angenommen
- Die App kann alles, was die Web-App im Kernumfang (E-110) kann – außer Dateien herunterladen (PDF/E-Rechnung, CSV-Exporte) und Bezahlen (T-49). Tabs: Heute · Pflichten · Finanzen · Personal · Mehr. Beleg fotografieren steht oben in Finanzen, Stempeln oben in Personal; Gründung, Behördenbriefe, Kalender, Änderung melden, Team, Hilfe und Einstellungen unter „Mehr“.
- Navigation ohne zusätzliche Pakete: ein Stapel je Tab, Unterseiten schieben sich herein, Zurück per Knopf oder Wischen vom linken Rand; erneutes Tippen auf den Tab führt zur ersten Seite. Besuchte Tabs bleiben eingehängt (Scrollposition und Unterseiten bleiben erhalten).
- Fehlende Angaben werden auf der Pflicht-Karte beantwortet – nur die Frage(n), die diese Pflicht klären, nicht der ganze Fragen-Schritt. Gleiche Bearbeitung für Fragebogen und Einstellungen.
- Nach jeder Änderung laden geöffnete Seiten still neu; Formulare werden dabei nicht überschrieben.
- Reine Fachlogik liegt in `@amtlos/fachlogik` (Gründungsreihenfolge, Fragebogen-Vorbereitung, Rechnungssummen, E-Rechnungs-Vollständigkeit, USt-Zeitraum und Umsätze) und `@amtlos/rules-engine` (sollInstanzen, anzeigeStatus, heuteUebersicht). Server, API und der Demo-Modus der App nutzen dieselben Funktionen.
- Der Demo-Server der App ist in Module geteilt (kern, finanzen, personal, postfach, konto) und bildet die Controller nach; Rundgang durch alle Bereiche als Skript (`apps/mobile/e2e/rundgang.mjs`).

### E-121 · Die iPhone-App wird zum Unterlagen-Werkzeug (ersetzt E-117 bis E-120 für die App)
- **Datum:** 2026-10-12 · **Status:** angenommen (Planänderung durch den Gründer)
- Anlass: Rückmeldung „die App erinnert an Dinge, das braucht keiner; sie soll bürokratische Aufgaben übernehmen – ohne Fragebogen, der Nutzer wählt selbst, welche Unterlage er gerade braucht“. Umfang: alles, was man rechtlich als Dokument vorweisen können muss.
- Die App erinnert an nichts mehr: kein Pflichtenplan, kein Heute, kein Kalender, kein Push, kein Fragebogen, kein Konto, kein Server. Drei Tabs: **Unterlagen** (alle Vorlagen nach Bereich, je Vorlage: wozu, Rechtsgrundlage und Quellen aus dem Katalog, „Jetzt ausfüllen“) · **Meine** (angelegte Unterlagen, bearbeiten, Kopie, löschen) · **Mein Betrieb** (einmal eintragen, steht im Kopf jeder Unterlage und füllt Namen und Kontakt vor; Daten sichern, alles löschen).
- 15 Vorlagen decken alle 18 Katalogpflichten mit `automatisierung: dokument_generator` ab (Test prüft das): Gefährdungsbeurteilung (inkl. Mutterschutz, je Gewerk), Unterweisungsnachweis, Gefahrstoffverzeichnis, Betriebsanweisung, Verzeichnis der Verarbeitungstätigkeiten mit TOM und Dienstleistern, Datenschutzinformation, Datenpanne (Dokumentation und Meldeentwurf mit 72-Stunden-Frist), Nachweis der Arbeitsbedingungen, KI-Kompetenz-Schulung, Verfahrensdokumentation (GoBD), Folgebelehrung § 43 IfSG, Allergenliste, Eigenkontrollen (HACCP, auch als leeres Blatt), Hautschutzplan, Hygieneplan.
- Inhalte: Die Vorlagen geben die **Gliederung** vor; den Inhalt trägt der Nutzer ein. Amtlos schreibt keine Rechtstexte. Beispiele in Hilfetexten sind als „z. B.“ gekennzeichnet. Gliederungen, die über bestehende Generatoren hinausgehen, stehen in der Prüfliste (T-52 bis T-57). Jedes PDF trägt „Vorlage noch nicht fachlich geprüft“, bis die Vorlage freigegeben ist.
- Technik: Vorlagen deklarativ in `@amtlos/fachlogik` (`src/dokumente`: Abschnitte und Felder → Formular in der App; `html()` → druckfertiges A4-HTML). Bezeichnungen (Gefährdungsfaktoren, Schutzziele, Allergene, Bewertung Datenpanne) liegen dort und werden vom Server-PDF mitbenutzt. PDF auf dem Gerät mit expo-print, Weitergabe über das Teilen-Menü (Dateien, Mail, AirDrop, Drucken) mit lesbarem Dateinamen; im Web öffnet sich das Dokument in einem Fenster.
- Daten nur auf dem Gerät (AsyncStorage, `amtlos.unterlagen.v1`), speichern bei jeder Eingabe. Fehlende Pflichtangaben werden genannt, verhindern das PDF aber nicht (leere Stellen sind markiert).
- Die App ist nur auf Deutsch: die Unterlagen sind deutsche Dokumente nach deutschem Recht; UI-Texte in `apps/mobile/src/texte.ts`, Formulartexte bei den Vorlagen.
- Katalogauszug fürs Gerät: `werkzeuge/katalog-buendel.mjs` schreibt nur noch die 18 Pflichten (Titel, Kurztext, Rechtsgrundlage, Quellen, Prüfstand) nach `src/unterlagen/katalog.json`; CI prüft die Aktualität.
- Entfernt aus der App (bleibt in der Git-Historie): Demo-Server, API-Client, Anmeldung, Push, alle Seiten aus E-120; Pakete expo-auth-session, -notifications, -secure-store, -image-picker, -web-browser, -crypto, -device, -localization, -constants. Web-App, API und Server bleiben unverändert.

### E-122 · Alle Unterlagen zum Auswählen – auch solche, die über andere Wege ans Amt gehen
- **Datum:** 2026-10-12 · **Status:** angenommen (Wunsch des Gründers: „alles, auch was bei anderen Tools geht – man kann ja selbst auswählen“)
- 18 weitere Vorlagen, zusammen 33: Rechnung, EÜR, Bilanz und GuV, Umsatzsteuer-Voranmeldung, Unterlagen zur Steuererklärung, Kassenbuch, Kassenmeldung (Datenblatt), Aufbewahrungsplan, Datenschutzerklärung für die Website, Vertrag zur Auftragsverarbeitung, Arbeitszeitnachweis (auch Minijob), Personalfragebogen (Daten für die SV-Anmeldung), Lohnkonto, Prüfprotokoll elektrische Geräte, Impressum, Gewerbeanmeldung (Datenblatt), Handelsregister (Vorbereitung), Transparenzregister (wirtschaftlich Berechtigte). KI-Nachweis und Hautschutzplan bleiben.
- Was elektronisch übermittelt werden muss (Voranmeldung, Anlage EÜR, Erklärungen, E-Bilanz, SV-Meldungen, Kassenmeldung), erstellt die App als ausgefüllte bzw. ausgerechnete Unterlage zum Übertragen; sie übermittelt nichts (ELSTER/ERiC bleibt offen, J-1). Gewerbe-, Handels- und Transparenzregister: Datenblätter für Amt, Notar bzw. Portal.
- Amtlos rechnet keine Lohnsteuer und keine Sozialversicherungsbeiträge (Beträge aus der Lohnabrechnung). Die Umsatzsteuer rechnet die App nur aus eingegebenen Nettoumsätzen zu 19 %/7 %; keine Kennzahlen des amtlichen Formulars (T-08).
- Neue Feldarten Betrag und Zahl, „Ergebnis“ in der App (Summen, Zahllast, Überschuss, Endbestand, Arbeitszeit), „Als Text teilen“ für Impressum und Datenschutzerklärung, Prüfungen gegen „Mein Betrieb“ (z. B. Steuernummer auf der Rechnung). „Mein Betrieb“ hat dafür Steuernummer, USt-IdNr. und IBAN. Suche über alle Vorlagen.
- Die Vorlagen verweisen auf die vorhandenen Katalogpflichten (Wozu, Rechtsgrundlage, Quellen); der Katalogauszug enthält jetzt alle Pflichten, die eine Vorlage belegt (43). Das Kassenbuch hat keine eigene Katalogpflicht.
- Der Hinweis für Kleinunternehmer auf Rechnungen liegt jetzt in `@amtlos/fachlogik` (`KU_HINWEIS`) und wird von API und App geteilt.
- Aufbewahrungsfristen 10/8/6 Jahre als Vorschlag im Aufbewahrungsplan (Rechtsstand ab 2025 nach Angabe des Gründers und eigenem Stand, T-58). Der Referentenentwurf zur elektronischen Zeiterfassung (Juni 2026) wird nicht übernommen, solange er nicht geprüft ist.


### E-123 · Unterlagen in Produktqualität: vorgeschriebene Inhalte zum Auswählen, Gestaltung wie ein Dokument aus der Kanzlei
- **Datum:** 2026-10-12 · **Status:** angenommen (Kritik des Gründers: Dokumente sahen nach Prototyp aus; zu viel Freitext, wo es nur wenige Möglichkeiten gibt). Ersetzt in E-121 den Punkt „Amtlos schreibt keine Rechtstexte“ und den PDF-Hinweis „Vorlage noch nicht fachlich geprüft“.
- **Inhalte vorformuliert, Nutzer prüft:** Wo das Gesetz oder eine Regel die Möglichkeiten vorgibt, wählt man aus (Wahl-Felder, Chips, Bausteine) statt zu tippen. Vorformulierte Einträge kommen aus vier Recherchen vom 12.10.2026 (`docs/recherche/2026-10-12/*.json`) und einem unabhängigen Prüfbericht; `packages/fachlogik/werkzeuge/bausteine-erzeugen.mjs` erzeugt daraus `src/dokumente/bausteine.ts` (nicht von Hand bearbeiten). Jeder Baustein trägt eine kurze Quelle und ein Kennzeichen „unsicher“; erfundene Inhalte, Fristen oder Beträge gibt es nicht.
- **Beispiele:** Gefährdungsbeurteilung mit 70 Gefährdungen je Branche (Auswahl mit Filter, übernommen als vollständige Zeile mit Maßnahmen); Mutterschutz-Ergebnis als Pflichtwahl nach § 10 MuSchG; Unterweisungsthemen und nächster Termin nach 12 Monaten; Betriebsanweisung in den TRGS-555-Kästen; Verzeichnis der Verarbeitungstätigkeiten mit 14 Verarbeitungen und 38 TOM; Datenschutzinformation aus den gewählten Verarbeitungen (berechtigte Interessen werden Pflicht, sobald lit. f vorkommt); Datenschutzerklärung aus 17 Modulen mit der zuständigen Aufsichtsbehörde nach Bundesland; AV-Vertrag mit allen acht Pflichten aus Art. 28 Abs. 3 lit. a–h; Nachweis nach § 2 NachwG Nr. 1–15 mit Prüfung gegen Mindestlohn (13,90 € ab 2026, 14,60 € ab 2027) und Mindesturlaub; Personalfragebogen mit SV-Schlüsseln und Minijob-Grenze (603 €); Rechnung mit Pflichtangaben nach § 14 Abs. 4 UStG und Prüfung des Befreiungshinweises bei 0 %; Impressum nach § 5 DDG (zweiter Kontaktweg Pflicht).
- **Gestaltung:** Briefkopf des Betriebs, Titel, Kopfzeile mit Rechtsgrundlage und Stand, nummerierte Abschnitte, Serifenschrift für Text, Linien zum Ausfüllen statt „(noch nicht angegeben)“. Fußzeile mit Betrieb, Dokument, Stand und „Seite x von y“ setzt die App nach dem Drucken mit pdf-lib auf jede Seite (iOS-Druck kennt keine Seitenzahlen).
- **Kein Hinweis „nicht fachlich geprüft“ mehr im PDF** – das Dokument soll so verwendbar sein. Der Hinweis, die Angaben vor Gebrauch zu prüfen, steht in der App am Formular. Offene fachliche Prüfungen bleiben in der Prüfliste (T-62 ff.).
- Hinweis für Kleinunternehmer jetzt „Der Umsatz ist nach § 19 Abs. 1 UStG steuerfrei.“ (Wortlaut nach Neufassung ab 2025, T-63).
- „Mein Betrieb“ hat ein Bundesland (Aufsichtsbehörde Datenschutz).


### E-124 · Geführter Ablauf statt Formularseite, Startseite nach Anlässen, Mitarbeiter und Kunden
- **Datum:** 2026-10-12 · **Status:** angenommen (Kritik des Gründers: „die UX ist extrem schlecht“; Umsetzung der Punkte 1–7)
- **Geführter Ablauf:** Jede Unterlage läuft Schritt für Schritt – ein Abschnitt je Bildschirm, Fortschrittsbalken, unten ein Hauptknopf („Weiter“, im letzten Schritt „Zum Dokument“), Zurück-Pfeil daneben. Der Ablauf läuft im Vollbild ohne Tab-Leiste; „Übersicht“ springt zum Abschluss. Jeder Abschnitt hat jetzt einen Titel.
- **Seltene Felder** (`selten` in der Vorlage, nie Pflicht) stehen hinter „Weitere Angaben (n)“ – außer sie sind ausgefüllt oder werden als fehlend genannt. **Hilfetexte:** kurze als Platzhalter im Feld, längere hinter einem (i).
- **Abschluss:** „Fertig“ bzw. „Fast fertig“ mit den fehlenden Angaben und „Ergänzen“ (springt zum Schritt bzw. zu „Mein Betrieb“), Ergebnis (z. B. Rechnungsbetrag), Vorschau des Dokuments (WebView, im Web iframe; groß ansehen), Übersicht der Schritte, Drucken/Als Text/Kopie/Löschen als Textknöpfe. Hauptknopf „PDF teilen“. Bestehende Unterlagen öffnen beim Abschluss.
- **Direkt loslegen:** Antippen einer Vorlage legt die Unterlage an und startet den Ablauf; die Infoseite (Zweck, Rechtsgrundlage, Quellen) gibt es über „Wozu brauche ich das?“ im ersten Schritt. Eine neue, unveränderte Unterlage verschwindet beim Schließen wieder (ebenso leere neue Listeneinträge).
- **Startseite:** Suche, „Rechnung schreiben“ als Hauptknopf, „Zuletzt bearbeitet“, zehn Anlässe („Ich stelle jemanden ein“, „Ich gründe oder eröffne“, „Im laufenden Betrieb“ …, `ANLAESSE` in `@amtlos/fachlogik`), darunter „Alle 33 Unterlagen“ nach Bereich. Jede Vorlage hat einen Satz in Alltagssprache ohne Paragrafen (`KURZ`).
- **Mitarbeiter und Kunden** (`stand.mitarbeiter`, `stand.kunden`, unter „Mein Betrieb“ bearbeitbar): Vorlagen mit `person` (Rechnung → Kunde; Nachweis, Personalfragebogen, Lohnkonto, Arbeitszeitnachweis → Mitarbeiter) zeigen gespeicherte Personen zur Auswahl und merken neue Angaben beim Weitergehen und Schließen (gleicher Name ergänzt den Eintrag, leere Werte überschreiben nichts). Teilnehmerlisten (Unterweisung, KI-Schulung, IfSG) übernehmen alle Mitarbeiter auf Tipp. **Rechnungsnummern** zählen fortlaufend weiter (`fortlaufend`, `naechsteNummer`), auch beim Kopieren.
- **Eingaben:** Einzeilige Felder mit Vorschlägen sind eine Auswahl mit „Andere …“ statt Textfeld plus Chips; mehrzeilige sind Zeilen zum Ankreuzen plus „Eigenen Text ergänzen“ (gespeichert weiter als Text). Listeneinträge auf eigener Seite statt aufgeklappter Karten. Vorschläge mit kurzem Titel (`kurztitel`) und Details zum Aufklappen, ein Knopf „N übernehmen“ unten.
- **Optik:** ein Hauptknopf je Bildschirm, zweitrangige Handlungen als ruhige Flächen oder Textknöpfe, Felder ohne Karten, mehr Abstand. Neues Paket: react-native-webview 13.16.1 (Version aus Expo SDK 57, läuft in Expo Go).


### E-125 · Verschlüsselte Datensicherung mit Wiederherstellen; Kundenrechnung ohne Rechtsgrundlage im Kopf
- **Datum:** 2026-10-12 · **Status:** angenommen (Investor-Readiness-Review von F. Steinmeyer, Punkte 5, 10, 22, 29; „sofort angehen“)
- **Befund:** „Daten sichern“ gab den ganzen Stand als Text ins Teilen-Menü – mit SV-Nummern, Steuer-IDs und IBANs der Mitarbeiter. Ein Tipp auf Mail oder Messenger hätte eine meldepflichtige Datenpanne sein können. Zurückspielen ging nicht.
- **Jetzt:** Sicherung als Datei, mit einem Passwort (mindestens 10 Zeichen, zweimal eingeben) verschlüsselt: AES-256-GCM (@noble/ciphers), Schlüssel per PBKDF2-SHA256 (@noble/hashes) mit zufälligem Salz und Nonce (expo-crypto). In der Datei steht nichts im Klartext außer Format und Verfahren; die Iterationszahl steht in der Datei (heute 150.000 – rein in JavaScript, weil Expo Go kein natives PBKDF2 hat; auf dem iPhone messen, später erhöhen oder nativ). Die Datei wird nach dem Teilen aus dem Cache gelöscht.
- **Wiederherstellen:** Datei wählen (expo-document-picker), Passwort, Inhalt ansehen („Salon Sonne · 5 Unterlagen · 1 Mitarbeiter · 1 Kunde“), dann alles ersetzen. Falsches Passwort und veränderte Dateien werden erkannt (GCM-Prüfung), fremde Dateien ebenso.
- **Kundendokumente** (`kundendokument`, heute die Rechnung): ohne „Rechtsgrundlage“ und Bereich im Kopf – das gehört in eigene Unterlagen, nicht auf ein Dokument an Kunden. Ersetzt für die Rechnung die Kopfzeile aus E-123.
- **iPad** abgeschaltet (`supportsTablet: false`), bis es ein Tablet-Layout gibt.
- Offen aus dem Review: verschlüsselte lokale Ablage (Punkt 27), alle strategischen Punkte (1–4, 6–9) – siehe `docs/review/status.md`.


### E-126 · Pflichten-Check als Einstieg (Mittelweg); Prüfhinweis fest im Check
- **Datum:** 2026-10-12 · **Status:** angenommen (Empfehlung „Weg b“ aus dem Investor-Readiness-Review, vom Gründer übernommen). Hebt für die App den Teil „kein Fragebogen“ aus E-121 auf; Erinnerungen folgen als nächster Schritt, weiter ohne Server.
- **Check:** bis zu 10 Fragen, eine je Bildschirm, Auswahl springt gleich weiter, jede Frage lässt sich überspringen: Branche, Rechtsform (bei UG/GmbH: Handelsregister), Gewerbe oder freier Beruf, Bundesland, Beschäftigte, elektronische Kasse, Website, Kleinunternehmerregelung, Beginn. Die Fragen sind die des bestehenden Fragebogens (`@amtlos/i18n`, Schnellstart E-111 plus Kasse und Website) – keine neuen Inhalte.
- **Rechnen auf dem Gerät:** `@amtlos/rules-engine` wertet den **ganzen Katalog** (146 Pflichten, 29 Regelwerte; `src/pflichten/katalog.json`, erzeugt von `katalog-buendel.mjs`, CI prüft die Aktualität) für das Profil aus – wie der Server. Pflichten im Rechtsänderungs-Radar zählen nicht. Test: Für alle Katalog-Fixtures ohne Ereignisse stimmt das Ergebnis mit den Erwartungen überein.
- **Ergebnis:** „Für deinen Betrieb gelten N Pflichten“, wie viele davon eine Unterlage in Amtlos haben, wie viele laut Katalog „hoch“ eingestuft sind, wie viele von weiteren Angaben abhängen. „Deine Pflichten“ nach Bereich mit Fortschritt; eine Pflicht gilt als erledigt, wenn sie abgehakt ist oder eine vollständige Unterlage der passenden Vorlage existiert. Jede Pflicht zeigt Grund, Zuständigkeit, nächsten Termin, Einstufung, Erklärung, Rechtsgrundlage und Quellen aus dem Katalog und startet die passende Unterlage. Unklare Pflichten: „N weitere Fragen beantworten“ mit genau den fehlenden Angaben.
- **Keine erfundenen Zahlen:** Bußgeldbeträge stehen nicht im Katalog („Folgen noch nicht fachlich erfasst“), deshalb zeigt die App keine – nur die Einstufung „hoch/mittel/niedrig“ aus dem Katalog.
- **Prüfhinweis:** Er steht fest in der Einleitung des Checks („noch nicht von Fachleuten geprüft … ersetzen keine Rechts- oder Steuerberatung“), unter dem Ergebnis, in „Deine Pflichten“, bei jeder Pflicht und im Abschluss jeder Unterlage – nicht im PDF (Rückmeldung F. Steinmeyer zu Punkt 12; AGB folgen).
- **Profil:** Antworten liegen in `stand.profil` (Schlüssel wie im Server-Profil), änderbar unter „Mein Betrieb → Pflichten-Check“; das Bundesland füllt „Mein Betrieb“, solange dort keins steht. Die Branche wählt in den Vorschlägen die passenden Gruppen vor („Passend für dich“), damit ein Malerbetrieb keine Friseurchemikalien sieht.
- **Startseite:** vor dem Check die Einladung „Welche Pflichten gelten für dich?“ als Hauptknopf (Rechnung dann zweitrangig), danach „Deine Pflichten“ mit Fortschritt in Prozent.


### E-127 · Rechnungen festschreiben und stornieren; Pflichten-Check genauer
- **Datum:** 2026-10-12 · **Status:** angenommen (Review L. Reiche vom 12.10., Punkte K5 und K7; beide Reviews einig)
- **Festschreiben (GoBD):** Rechnung und Kassenbuch (`festschreiben`) werden beim ersten Teilen oder Drucken festgeschrieben. Danach lassen sie sich weder ändern noch löschen; die App öffnet sie nur noch im Abschluss („Festgeschrieben am …“). Jede Unterlage merkt sich, wann sie zuerst ausgegeben wurde (`ausgegeben`).
- **Storno statt Ändern:** Eine festgeschriebene Rechnung wird nur per Stornorechnung aufgehoben – neue Nummer, gleiche Positionen mit negativen Preisen, Verweis „storniert die Rechnung Nr. … vom …“; die ursprüngliche bleibt unverändert und zeigt „storniert durch …“. Ein verworfener Storno-Entwurf gibt die Rechnung wieder frei.
- **Nummern:** Eine geteilte Rechnung lässt sich nicht löschen, also wird ihre Nummer nie wieder vergeben. Gelöscht werden können nur Entwürfe, die nie rausgingen. Eine doppelte Nummer (von Hand eingetragen) wird als fehlend gemeldet und blockiert das Teilen.
- **Nur vollständig an Kunden:** Kundendokumente (Rechnung) lassen sich erst teilen oder drucken, wenn alle Pflichtangaben drin sind.
- **Kassenbuch:** heißt jetzt „Kassenbuch (Vorlage zum Ausdrucken)“ und sagt im ersten Schritt und im PDF, dass es kein laufend geführtes, unveränderbares elektronisches Kassenbuch ist; es wird beim Teilen festgeschrieben.
- **Gesellschaften:** „Mein Betrieb“ hat Rechtsform, Registergericht, Registernummer und Geschäftsführung; bei Gesellschaften stehen Sitz, Register und Geschäftsführung unten auf jeder Rechnung (§ 35a GmbHG, § 37a HGB). Leistungsdatum ausgeschrieben statt „= Rechnungsdatum“.
- **Pflichten-Check:** Gründungsschritte (Katalog `phase: gruendung`) stehen bei Betrieben, die seit mehr als sechs Monaten laufen, unter „Aus der Gründung“ (vermutlich erledigt, zählen nicht zu den offenen); nach den Grundfragen bis zu fünf Zusatzfragen, die die meisten unklaren Pflichten klären; „Warum für dich“ aus den tragenden Sätzen der Regel (Engine `entscheidendeSaetze`), bei Pflichten für alle Unternehmen „Gilt für jedes Unternehmen“. „Weiter“ erst mit Antwort, „Überspringen“ als Textknopf.
- **Erledigt:** wiederkehrende Pflichten nur für den nächsten Termin abhaken; durch eine Unterlage nur einmalige bzw. dauerhafte Pflichten und nur, wenn die Unterlage vollständig ist und als PDF geteilt oder gedruckt wurde. Das Lohnkonto zählt nicht mehr als „Lohnabrechnung über geprüfte Software“.
- **Kleinunternehmer** aus dem Check als Startwert jeder Rechnung (`ausProfil`), pro Rechnung änderbar.
- **Daten:** Beim Wechsel in den Hintergrund wird sofort gespeichert; sind gespeicherte Daten unlesbar oder schlägt das Laden fehl, überschreibt die App nichts (bis „Alle Daten löschen“).
- Nicht entschieden (Gründer, Termine mit F. Steinmeyer und L. Reiche): Konto, Server, Synchronisierung, Bezahlung (K1, K6), E-Rechnung in der App (K4), Rechnungen → USt-Voranmeldung → ELSTER-Export (K8).

### E-128 · E-Rechnung, Umsätze für die Voranmeldung, „Jetzt dran“ und Erinnerungen
- **Datum:** 2026-10-13 · **Status:** angenommen vorbehaltlich Termin (Review L. Reiche K4, K7, K8; Review F. Steinmeyer Punkt 6 „lokale Erinnerungen ohne Server“) – kein Server, kein Konto, keine Bezahlung (K1/K6 weiter offen)
- **E-Rechnung (XRechnung 3.0, UBL):** Im Abschluss einer Rechnung „Als E-Rechnung teilen (XRechnung)“. Die Zuordnung Rechnung → UBL liegt jetzt in `@amtlos/fachlogik` (`eRechnungsDokument`, `xrechnungUbl`) und wird von Server und App gemeinsam genutzt. Fehlen Angaben, die XRechnung verlangt (E-Mail und Telefon des Betriebs, IBAN, E-Mail des Empfängers, Anschrift mit PLZ/Ort in der letzten Zeile), nennt die App sie, statt eine ungültige Datei zu erzeugen. 0 % Umsatzsteuer außerhalb der Kleinunternehmerregelung (z. B. Reverse Charge) erzeugt bewusst noch keine E-Rechnung. Die Beispiel-Rechnungen (Server und App, inkl. Storno und Kleinunternehmer) bestehen den KoSIT-Validator mit der XRechnung-3.0.2-Konfiguration. Teilen der E-Rechnung zählt wie das PDF als ausgegeben (festgeschrieben). ZUGFeRD (PDF mit eingebettetem XML) ist nicht enthalten.
- **Kunde:** Rechnungsempfänger und gespeicherte Kunden haben ein Feld E-Mail.
- **Rechnungen → Voranmeldung:** In der Vorlage „Umsatzsteuer-Voranmeldung“ übernimmt eine Karte im ersten Schritt Zeitraum und Umsätze je Steuersatz (19 %, 7 %, steuerfrei/0 %) aus den festgeschriebenen Rechnungen eines Monats oder Quartals; Stornorechnungen zählen negativ, Entwürfe nicht. Zugeordnet wird nach Rechnungsdatum (fachlich zu prüfen, T-69). Eine ELSTER-Übermittlung gibt es weiter nicht.
- **„Jetzt dran“:** „Deine Pflichten“ beginnt mit „Jetzt dran“ (offene Pflichten mit Termin in den nächsten 14 Tagen und wichtige Pflichten ohne Termin) und „Diesen Monat“ (Termin in 15–45 Tagen); darunter alle Pflichten nach Bereich. Die Startseite zeigt die ersten drei aus „Jetzt dran“.
- **Erinnerungen (lokal):** Schalter in „Deine Pflichten“. Die App plant Mitteilungen auf dem Gerät (expo-notifications), 3 Tage vor jedem Termin offener Pflichten um 9 Uhr, höchstens 30, und plant bei jeder Änderung neu (abgehakte Pflichten fallen heraus). Kein Server, keine Push-Dienste; im Web ohne Funktion.
- **Ladefehler sichtbar:** Sind gespeicherte Daten unlesbar, zeigt die App oben einen Hinweis (statt still nichts zu speichern).

### E-129 · Daten geschützt, Voranmeldung nach Leistung oder Zahlung, Pflichten zuerst, Dokumente mit eigener Gestalt
- **Datum:** 2026-10-13 · **Status:** angenommen (Review L. Reiche vom 13.10.2026 nach dem Termin: vier Hauptpunkte, vier kleinere Befunde; Gründer: ELSTER nur als Konzept, iCloud vorbereiten)
- **Verschlüsselte Ablage:** Der gespeicherte Stand liegt nur noch verschlüsselt in AsyncStorage (AES-256-GCM). Der Schlüssel liegt im Schlüsselbund (expo-secure-store, nur dieses Gerät, nur entsperrt). Ältere Daten werden beim ersten Start verschlüsselt. Fehlt der Schlüssel oder passt er nicht, überschreibt die App nichts (Ladefehler-Hinweis). Im Web (Tests) bleibt es unverschlüsselt.
- **App-Sperre:** optional „Mit Face ID sperren“ (expo-local-authentication), sperrt nach jedem Wechsel in den Hintergrund.
- **Löschschutz:** „Alle Daten löschen“ ist gesperrt, solange festgeschriebene Unterlagen (Rechnungen, Kassenbuch) nicht in einer Sicherung nach der letzten Änderung enthalten sind. Die Aufbewahrungsdauer im Hinweis kommt aus dem Katalog-Regelwert `steuern.aufbewahrung.belege_jahre`.
- **Zusammenführen statt Überschreiben:** Eine Sicherung wird nach ID mit dem Gerät zusammengeführt. Festgeschriebene Unterlagen werden nie ersetzt, sonst gewinnt die zuletzt geänderte Fassung, und nur auf dem Gerät Vorhandenes bleibt. Doppelte Rechnungsnummern werden vor dem Zurückspielen gemeldet.
- **Erinnerung an die Sicherung:** Gibt es ungesicherte Änderungen und ist die letzte Sicherung älter als eine Woche (oder gab es noch keine), erscheint auf „Pflichten“ der Hinweis „Zeit für eine Sicherung“.
- **iCloud (vorbereitet):** automatische, verschlüsselte Sicherung nach iCloud Drive im eigenen App-Build (`react-native-cloud-storage`, Config-Plugin). In Expo Go unsichtbar. Einrichtung: docs/09-icloud-sicherung.md.
- **Voranmeldung nach dem richtigen Zeitpunkt:**
  - Wahl „Soll“ (vereinbarte Entgelte, § 13 Abs. 1 Nr. 1 a UStG) oder „Ist“ (vereinnahmte Entgelte, § 13 Abs. 1 Nr. 1 b, § 20 UStG), gemerkt unter „Mein Betrieb“.
  - Soll ordnet nach Leistungsdatum zu, Stornos im Zeitraum des Stornos (§ 17 UStG). Rechnungen mit Leistungszeitraum statt Tag zählen nach Rechnungsdatum und werden gemeldet.
  - Ist ordnet nach Zahlungseingang zu, den man an der festgeschriebenen Rechnung vermerkt („Zahlung eingegangen – heute“ oder anderes Datum, bei Storno die Erstattung). Der Vermerk ändert die Rechnung nicht.
- **Pflichten zuerst:** neuer erster Tab „Pflichten“ mit Einladung zum Check bzw. „Jetzt dran“, Fortschritt und allen Pflichten. „Unterlagen“ ist der zweite Tab.
- **Weniger Unklares:**
  - Statt einer Liste unklarer Pflichten und „33 weitere Fragen“ stehen in „Kurz klären“ die drei Fragen, die am meisten klären, mit „klärt N Pflichten“ direkt beantwortbar.
  - Im Check bis zu acht Zusatzfragen, nach Wirkung sortiert. Der Rest steht nur noch als Textknopf darunter.
  - Neue Grundfrage „Macht eine Steuerberaterin oder ein Steuerberater deine Erklärungen?“ (bestimmt die Fristen).
- **Fristen der Steuererklärungen:**
  - ESt, KSt, GewSt und USt-Jahreserklärung jährlich zum 31. Juli des Folgejahres (§ 149 Abs. 2 AO), mit Steuerberatung Ende Februar des übernächsten Jahres (§ 149 Abs. 3 AO), jeweils nächster Werktag (§ 108 Abs. 3 AO).
  - Ergibt für das Veranlagungsjahr 2026 den 02.08.2027 und für 2025 mit Beratung den 01.03.2027, wie in der Übersicht der Finanzverwaltung Baden-Württemberg.
  - Übergangsfristen bis 2024 sind nicht abgebildet.
- **E-Rechnung ins Ausland:**
  - Anschrift mit Länderzeile („Österreich“) oder Präfix („A-1010“). Ohne beides wird das Land aus der USt-IdNr. des Empfängers bzw. einer fünfstelligen PLZ (Deutschland) bestimmt, sonst fragt die App.
  - 0 % mit Grund: Steuerschuldnerschaft des Empfängers (Kategorie AE), innergemeinschaftliche Lieferung (K, mit Lieferanschrift) oder Steuerbefreiung (E). AE und K verlangen beide USt-IdNr.
  - 13 Beispiele bestehen den KoSIT-Validator (XRechnung 3.0.2).
- **Dokumente mit eigener Gestalt:** Jede Vorlage hat eine Gestalt passend zum Zweck.
  - Geschäftsbrief nach DIN 5008 Form B (Rechnung): Fenster-Anschrift, Informationsblock, Betreff, Zahlungsaufforderung mit Bankverbindung, Fußzeile in Spalten (Anschrift, Kontakt, Bank, Steuer/Register) auf jeder Seite, Falz- und Lochmarken.
  - Vertrag (Nachweis der Arbeitsbedingungen, AVV), Aushang (Hygiene-, Hautschutzplan, Allergene, Betriebsanweisung), Nachweis, Formular (Zusammenstellungen für Behörden) und Handbuch (Verfahrensdokumentation, Datenschutz).
  - „Mein Betrieb“ hat Logo (aus den Fotos, verkleinert), Hausfarbe aus acht druckfesten Farben, Bank, BIC und Website.
  - Eingebettete Schriften „Amtlos Sans“ und „Amtlos Serif“: Teilmengen von Source Sans 3 und Source Serif 4, OFL 1.1, wegen des reservierten Namens umbenannt. Damit sieht das PDF auf jedem Gerät gleich aus.
- **ELSTER:** nicht gebaut. Konzept mit beiden Wegen (Zertifikat des Nutzers oder Übermittlung im Auftrag), Architektur und Aufwand in docs/08-elster-eric.md. Voraussetzung: K1 und J-1.

### E-130 · Jede Vorlage neu gesetzt: sechs Gestalten mit eigenem Aufbau, Randspalte, GiroCode, Kennzahlen
- **Datum:** 2026-10-13 · **Status:** angenommen (Gründer nach R4: „alles neu gestalten, perfekt und maximal überlegt“; E-129 hatte nur die Gestalten eingeführt, die Vorlagen selbst waren noch gleich gebaut)
- **Leitbild:** nicht die Software-Oberfläche, sondern das gut gemachte deutsche Amts- und Kanzleidokument – Vordruck mit Feldnummern, Gesetzestext mit Randnummern, DGUV-Betriebsanweisung, Geschäftsbrief nach DIN 5008. Vollständig beschrieben in docs/10-dokumente-gestaltung.md (Zwecke, Farben, Schriftskala, Seitenregeln, „was absichtlich fehlt“).
- **Das eine prägende Element – die Randspalte:** Bei Nachweis, Vertrag und Handbuch stehen Abschnittsnummer und Rechtsgrundlage links neben dem Text in einer 24 mm breiten Spalte (`h2::before`, `.rand`, `h3 .nr`). Sonst nichts Auffälliges: keine Karten, Schatten, Symbole, Verläufe. Aushänge und Querformat nutzen die volle Breite.
- **Bausteine in `html.ts`** statt freiem HTML je Vorlage: `brief` (DIN 5008 Form B), `parteien` (zwei Spalten), `abschnitt`/`abschnitte` (mit `rand`, Inhaltsübersicht ab fünf Abschnitten), `eintrag` (nummerierte Einträge), `felder` (Feldraster mit Feldnummern), `kennzahlen` (Kz-Zeilen mit Betrag), `uebertragung` (Vermerkzeile „Übermittelt am / Transferticket / Gezahlt am“), `nachsatz`, `tabelle` mit `summe` und `zahlen`, `unterschriften` mit Ort/Datum, `dokument` mit `nummerierung: "paragraph" | "zahl"`, `band`, `klasse`.
- **Je Vorlage:**
  - Rechnung/Storno: Brief mit Anrede, Einleitungssatz, Positionen, Zahlungsblock mit **GiroCode** (EPC069-12 v002, UTF-8, Fehlerkorrektur M; `packages/fachlogik/src/girocode.ts`, `qrcode-generator`), Grußformel; ohne IBAN stattdessen „Zahlbar innerhalb von 14 Tagen“. Folgeseiten mit kleiner Kopfzeile (Dokumentname).
  - USt-Voranmeldung: Kennzahlen 81, 86, 66, 83 wie im Vordruck USt 1 A, Umsätze ohne USt mit Hinweis (gehören in eigene Kz, T-70), Übertragungsvermerk. EÜR: Kennzahlen Ergebnis plus Tabellen mit Summen. Bilanz: zwei Spalten Aktiva/Passiva. Kassenmeldung, Gewerbeanmeldung, Handelsregister, Transparenzregister: Feldraster mit Übertragungsvermerk.
  - Nachweis der Arbeitsbedingungen: Nummerierung 1–15 in der Reihenfolge von § 2 Abs. 1 NachwG (1 = Vertragsparteien in zwei Spalten), Unterschrift „Erhalt bestätigt“. AVV: Parteien, Hauptvertrag-Satz. Datenschutzerklärung, Impressum, Datenschutzinformation, Verfahrensdokumentation: Lesetext in Serife mit Randnummern (Verfahrensdokumentation mit „GoBD Tz. 10.1/10.2“ am Rand, bewusst Abschnittsnummern statt Rn).
  - Verzeichnis der Verarbeitungen: Einträge 2.1, 2.2 … mit „Art. 30 Abs. 1 lit. b–g“ am Rand; Datenpanne: Abschnitte mit „Art. 33 Abs. 3 lit. a … d“.
  - Betriebsanweisung Gefahrstoffe: Aufbau der DGUV Information 211-010 (Titelband, Stoff-Kasten, Felder Gefahren/Schutz/Verhalten/Erste Hilfe/Entsorgung, Notruf), oranges Band `#e0640c` als übliche Kennfarbe, ohne Piktogramme (Lizenz- und Deutungsfragen).
  - Arbeitszeitnachweis, Kassenbuch, Lohnkonto: Summenzeile abgesetzt; Personalfragebogen: Feldraster mit Unterschrift.
- **Prüfstand:** alle 33 Vorlagen plus lange Rechnung (34 Positionen) und Storno mit zwei realistischen Betrieben (Salon mit Logo, GmbH) als Vorschau-Bild und Chromium-PDF gerendert, gestempelte Fußzeilen/Kopfzeilen über `fusszeile.ts` geprüft, GiroCode mit zbar dekodiert (Nutzdaten byteweise richtig). Tests: `packages/fachlogik/test/gestaltung.test.ts`.
- **Noch nicht:** Angebot, Lieferschein, Mahnung; ZUGFeRD (PDF/A-3 mit eingebettetem XML); Druckprobe auf dem iPhone (expo-print mit Rändern je Gestalt); Fensterkuvert-Probe (T-75).

### E-131 · Die App in Profi-Qualität: Übersicht statt Formularwüste, Startseite, Ablage mit Überblick, native Eingaben
- **Datum:** 2026-10-13 · **Status:** angenommen (Gründer: „die App, die jetzt da ist, in allen Aspekten professionell und unicorn-reif machen“ – kein Ausbau)
- **Audit:** alle Bildschirme des Rundgangs hell und dunkel gesichtet, jede Bausteindatei gelesen. Befund: solide Basis; was fehlte, waren Struktur bei „Mein Betrieb“, ein echter erster Bildschirm, Überblick in der Ablage, native Eingabehilfen, Rückmeldungen und ein eigenes App-Symbol.
- **Tabs:** Pflichten · Vorlagen · Unterlagen · Mein Betrieb. „Vorlagen“ ist der Ort zum Erstellen, „Unterlagen“ die eigene Ablage – vorher hießen beide Tabs „Unterlagen/Meine“.
- **Mein Betrieb** als Übersicht wie in den iOS-Einstellungen: Kopf mit Logo bzw. Anfangsbuchstabe in der Hausfarbe, dann Zeilen „Angaben zum Betrieb“, „Steuer und Bank“, „Briefkopf“, „Gesellschaft“ mit Zusammenfassung des Inhalts, jede auf einer eigenen Seite; Mitarbeiter und Kunden als eigene Listen mit Anzahl; Bundesland auf einer Auswahlseite (`ui/auswahlseite.tsx`) statt 16 Zeilen im Formular. Der erste Eintrag („Betrieb eintragen“ aus Vorlagen) zeigt weiter das ganze Formular.
- **Startseite** vor dem Check: Einladung zum Check plus „So hilft dir Amtlos“ (Pflichten, Unterlagen, Rechnungen, alles bleibt bei dir) mit direkten Wegen „Rechnung schreiben“ und „Alle Vorlagen ansehen“.
- **Unterlagen (Ablage):** Karte mit Anzahl und Summe der offenen Rechnungen (brutto, ohne Stornos; antippen filtert), Filter Alle · Rechnungen · Offen · Entwürfe (nur, wenn sie etwas bewirken), Suche ab sechs Unterlagen (Name, Nummer, Kunde). Reine Funktionen in `unterlagen/ablage.ts`.
- **Eingaben:** nativer iPhone-Kalender hinter einem Kalender-Knopf neben jedem Datumsfeld (`@react-native-community/datetimepicker`, Web bleibt Textfeld); „Fertig“-Leiste über Zahlen-, Telefon- und Datumstastaturen (InputAccessoryView); Zahlungsziel als kurze Chips (7 · 14 · 30 Tage · Sofort), der Rechnungstext bleibt „Zahlbar innerhalb von … Tagen“; Titel von Unterseiten schrumpfen statt abzubrechen.
- **Rückmeldung:** kurze Meldung am unteren Rand mit Haptik (`ui/meldung.tsx`) nach Kopie, Storno, Löschen, Zahlungsvermerk, übernommenen Vorschlägen; Auf- und Zuklappen (Weitere Angaben, Hilfe, Listen, Rückfragen) weich animiert (`weich()`).
- **Leistung:** Fortschritt, Dringlichkeit und offene Fragen im Pflichten-Tab werden nur neu gerechnet, wenn sich Haken, Unterlagen oder Antworten ändern (useMemo) – nicht bei jedem Tippen in einem Ablauf.
- **App-Paket:** eigenes Symbol (Blatt mit Stempel und Haken, `assets/icon.svg` → `icon.png`), Startbild als Glyphe auf Grün (hell) bzw. Dunkel, Version 0.2.0 in `src/version.ts` = `app.json` = `package.json` (Test), `CFBundleDevelopmentRegion` de, Android-Adaptive-Icon. Export-Compliance (`ITSAppUsesNonExemptEncryption`) bewusst nicht gesetzt: T-77.
- **Geprüft:** Rundgang hell und dunkel ohne Befunde (an die neue Struktur angepasst), alle 33 Vorlagen durchgeklickt, 41 App-Tests, Lint und Typecheck sauber (inkl. entfernter überflüssiger eslint-Direktive im erzeugten Schriftmodul).

### E-132 · Geschäftsmodell und Startpaket: Amtlos Pro, Store-Reife, Landingpage, Wachstumsplan
- **Datum:** 2026-10-13 · **Status:** angenommen (Gründer: „Alles inkl. Abo“ bei K1; Ziel „nach Veröffentlichung und Marketing ein Unicorn“)
- **Amtlos Pro (Abo über den App Store):** Kostenlos bleiben Pflichten-Check, Erinnerungen, alle Vorlagen ausfüllen, Sicherung als Datei, Wiederherstellen, Storno, erneutes Teilen und 5 erste Ausgaben (PDF teilen/drucken) je Kalendermonat (`src/pro/regeln.ts`, `FREI_JE_MONAT`). Pro: unbegrenzt teilen, E-Rechnung, Umsätze für die Voranmeldung mit einem Tipp, iCloud-Sicherung einschalten, Briefkopf (Logo, Hausfarbe; ohne Pro neutral im Dokument, gespeichert bleibt er).
  - Grundsatz: Pro sperrt nie eigene Daten, nie eine Korrektur, nie die Sicherung. Eine laufende iCloud-Sicherung läuft weiter, wenn Pro endet.
  - Kauf über RevenueCat (`src/pro/kauf.ts`, Berechtigung `pro`, Offering `default`), erst geladen, wenn `EXPO_PUBLIC_REVENUECAT_IOS_KEY` gesetzt ist. Ohne Schlüssel (Testpaket, Expo Go, Web) läuft die App im **Testmodus**: Pro lässt sich testweise einschalten (`Stand.proTest`).
  - Bezahlschirm (`seiten/Pro.tsx`) mit Grund, Vorteilen, Freiumfang, Angeboten aus dem Store (Preis und Testzeitraum vom Store, keine Beträge im Code), Abo-Pflichtangaben, Nutzungsbedingungen (Apple-Standard-EULA), Datenschutz, „Käufe wiederherstellen“.
- **Bitte um Bewertung** (`src/pro/bewertung.ts`): nach dem dritten Erfolgsmoment (erste Ausgabe einer Rechnung, Check fertig, Zahlung vermerkt), höchstens alle 120 Tage, über `expo-store-review`.
- **Rechtliches in der App** (`src/rechtliches.ts`, `seiten/Recht.tsx`): Impressum aus Anbieterangaben (leer = „folgt“), Datenschutzhinweis, der beschreibt, was der Code tut (Freigabe offen, T-77), „Amtlos weiterempfehlen“, Hilfe-Link, Nutzungsbedingungen. Gruppe „Über Amtlos“ unter „Mein Betrieb“, Pro-Zeile oben.
- **Store-Startpaket:** `eas.json` (development, preview, production; Submit-IDs leer), Privacy Manifest in `app.json` (kein Tracking, Kaufhistorie nicht verknüpft, Gründe für UserDefaults und Dateizeitstempel), Store-Texte `store/de.json` mit Grenztest, Store-Bilder 1290 × 2796 aus echten Bildschirmen mit Demo-Stand (`werkzeuge/demo-stand.ts`, `werkzeuge/store-bilder.mjs`), Prüfskript `werkzeuge/store-check.mjs` (zeigt 14 offene Punkte, die Firma, Apple-Konto oder Fachprüfung brauchen), Anleitung `docs/11-store-start.md`.
- **Landingpage** `apps/website` (statisch; `node apps/website/bauen.mjs`): Mini-Pflichten-Check mit echten Zahlen aus dem Katalog (`werkzeuge/website-profile.ts` → `profile.json`), Bildschirme, Leistungen mit Rechtsgrundlagen in der Randspalte, E-Rechnungs-Fahrplan (BMF), Preise ohne Beträge, Fragen. Impressum/Datenschutz-Seiten verlinkt, aber noch nicht vorhanden (brauchen Anbieterangaben).
- **Wachstumsplan** als Dokument (Recherche mit Quellen): Ziel 67–111 Mio. € ARR für 1 Mrd. € bei 9–15x; Pro allein trägt das nicht, der Weg führt über ein Betriebs-Abo (E-Rechnung empfangen, Belege, Steuerberater-Export, Sync) und den Steuerberater-Kanal. Preisvorschlag 12,99 €/Monat bzw. 99,99 €/Jahr mit 14 Tagen Test; Experimente: E-Rechnung kostenlos, Bezahlschirm nach dem Check.
- **Korrektur:** Demo-Stand nutzte den Branchenschlüssel `beauty` statt `beauty_kosmetik` (Store-Bilder neu erzeugt).

### E-133 · Belege und E-Rechnungen empfangen, Vorsteuer und EÜR aus Daten, Paket für die Steuerberatung
- **Datum:** 2026-10-13 · **Status:** angenommen (Wachstumsplan: Umsatz pro Betrieb heben; Gründer: „tu alles, was du tun kannst“)
- **Herkunft:** Die Fachlogik (`belege.ts`, `erechnungLesen.ts`, `buchungen.ts` mit Tests) kam in Commit ff527fd ins Repo, ohne dass diese Sitzung sie geschrieben hat – vermutlich aus einer parallelen Sitzung im selben Arbeitsverzeichnis. Sie wurde gesichtet und unverändert übernommen (nur Verweise auf E-133/T-79). Ein eigener, doppelter Parser wurde verworfen.
- **Belege in der App:** `Stand.belege` (geprüft mit `belegAus`), erfassen per Foto (Kamera oder Fotos, 1600 px JPEG), Datei (PDF, Bild, XML) oder von Hand. Eine E-Rechnung – XRechnung (UBL/CII) oder ZUGFeRD/Factur-X-PDF – füllt den Beleg selbst aus; die Originaldatei wird byte-genau und verschlüsselt im App-Ordner abgelegt (`unterlagen/dateien.ts`, gleicher Schlüssel wie der Stand). Bearbeiten mit Beträgen je Steuersatz, Vorsteuer-Schalter, Kategorie (Alltagssprache → Zeile der Anlage EÜR), Zahlungsweg und Zahltag.
- **Kostenlos:** Belege erfassen und E-Rechnungen empfangen (seit 2025 für jeden Betrieb Pflicht – Einstiegsgrund). **Pro:** Übernahme in Voranmeldung und EÜR und das Steuerberater-Paket.
- **Aufbewahrung:** Belege zählen als aufbewahrungspflichtig (Löschschutz, Sicherungs-Erinnerung); Löschen eines einzelnen Belegs warnt.
- **Sicherung Version 2:** enthält die Belegdateien (Base64) im verschlüsselten Inhalt; Version 1 bleibt lesbar. Zusammenführen von Belegen nach ID, Neueres gewinnt. iCloud-Sicherung nimmt die Dateien mit.
- **Voranmeldung:** Vorsteuer (Kz 66) aus Belegen nach Belegdatum (§ 15 Abs. 1 UStG), Zeiträume auch nur mit Belegen; Belege mit USt, aber ohne Vorsteuerabzug werden genannt.
- **EÜR:** „Aus Rechnungen und Belegen übernehmen“ je Jahr – Einnahmen netto und vereinnahmte USt nach Zahlungseingang, Ausgaben je Kategorie nach Zahltag, gezahlte Vorsteuer als eigene Zeile; Anschaffungen über 800 € werden als Hinweis genannt (Abschreibung von Hand).
- **Paket für die Steuerberatung** (`unterlagen/steuerpaket.ts`, Mein Betrieb): Zeitraum (Monat, Quartal, Jahr), Kontenrahmen SKR03/SKR04, Berater- und Mandantennummer; ZIP mit DATEV-Buchungsstapel (EXTF 700, ungeprüft – steht in der LIESMICH), Buchungsliste, Rechnungs- und Belegliste (CSV, Semikolon, UTF-8 mit BOM), XRechnungen der Ausgangsrechnungen (wenn vollständig) und den Beleg-Originalen.
- **Gefunden im Rundgang:** Die Steuerberater-Seite lag mit ihrem Knopf unter der Tab-Leiste – öffnet jetzt im Vollbild.
- **Geprüft:** 54 App-Tests (neu: belege.test.ts), Rundgang hell und dunkel mit echtem E-Rechnungs-Empfang über die Dateiauswahl und heruntergeladenem Paket.

### E-134 · Konto und Ende-zu-Ende-verschlüsselte Synchronisation (iPhone-App)
- **Datum:** 2026-10-13 · **Status:** angenommen (Gründer: „ja“ zum Vorschlag „Konto und Synchronisation“)
- **Warum:** Größter Abwanderungs- und Verlustgrund einer rein lokalen App ist das verlorene oder neue iPhone; zweites Gerät (Inhaberin und Büro) ist der Einstieg ins Team. Ohne Synchronisation bleibt Amtlos ein Werkzeug, mit ihr wird es das System, in dem der Betrieb lebt.
- **Grundsatz:** Der Server sieht nie Klartext. Je Konto ein zufälliger 32-Byte-Sync-Schlüssel; auf dem Server liegt er nur in einer Hülle (PBKDF2-SHA256, 150.000 Runden, AES-256-GCM) aus dem Sync-Passwort. Stand und Belegdateien gehen nur verschlüsselt hinaus (Format `amtlos-tresor`). Das Sync-Passwort verlässt das Gerät nie; Amtlos kann es nicht zurücksetzen (Verlust: Daten bleiben auf den Geräten, Sync wird neu eingerichtet).
- **Server** (`app.tresor`, `app.tresor_datei`, Migration 0019, RLS je Konto): `GET/POST/PUT/DELETE /v1/tresor`, `PUT /v1/tresor/schluessel`, `GET/PUT /v1/tresor/dateien/:name`. Optimistisches Sperren über einen Versionszähler (409 → holen, zusammenführen, neu versuchen, höchstens dreimal). Dateinamen unveränderlich. 40 MB Grenze nur für diese Pfade. Mit `REVENUECAT_SECRET_KEY` prüft der Server Pro (402), ohne Netz zu RevenueCat wird nicht ausgesperrt. `konto_loeschen()` löscht die Sync-Daten mit.
- **Zusammenführen** (`konto/sync.ts`, rein und getestet): je Unterlage, Beleg, Person gewinnt die zuletzt geänderte Fassung; festgeschriebene Unterlagen werden nie ersetzt, Zahlungs-, Storno- und Ausgabevermerke wandern mit; Löschvermerke (`geloescht`) verhindern Wiederauferstehung, außer das Element wurde danach anderswo geändert; Betrieb, Pflichten-Check, Haken und Steuerberatung nach Zeitpunkt der letzten Änderung (`zeiten`). Gerätegebunden und nie synchronisiert: Face ID, Erinnerungen, iCloud-Sicherung, Bewertungsbitte, Testmodus, letzte Sicherung. Doppelt vergebene Rechnungsnummern (zwei Geräte offline) werden gemeldet, nicht still umnummeriert.
- **Anmeldung:** OIDC mit PKCE über den Systembrowser (`expo-auth-session`), Tokens im Schlüsselbund, Erneuern über Refresh-Token; ohne `EXPO_PUBLIC_OIDC_ISSUER` Entwicklungszugang `POST /v1/dev/token` (vom Server in staging/prod verboten). Abgelaufene Anmeldung entfernt nur die Sitzung, der Sync-Schlüssel bleibt. Schlüssel eines anderen Kontos wird verworfen.
- **Nur mit Server im Build:** ohne `EXPO_PUBLIC_API_URL` (Testpaket, Expo Go) zeigt die App nichts davon und bleibt rein lokal – Datenschutzhinweis und Texte unter „Deine Daten“ passen sich an (`datenschutzAbschnitte`).
- **App:** „Mein Betrieb → Deine Daten → Auf mehreren Geräten“: anmelden, Sync-Passwort wählen bzw. auf dem neuen Gerät eingeben, Stand und Zeitpunkt, „Jetzt synchronisieren“, Sync-Passwort ändern, Synchronisation beenden (löscht Serverdaten; andere Geräte merken es und hören auf), abmelden, **Konto löschen in der App** (App-Store-Richtlinie 5.1.1(v)). Automatisch 4 s nach einer Änderung und beim Öffnen der App. „Alle Daten löschen“ beendet die Synchronisation auf dem Gerät zuerst – sonst kämen die Daten zurück.
- **Pro:** neue Pro-Funktion „sync“ (auf dem Bezahlschirm nur in Builds mit Server). Ohne Pro pausiert die Synchronisation, die Daten bleiben. Käufe werden mit `Purchases.logIn(Konto-ID)` dem Konto zugeordnet – Pro gilt dann auf allen Geräten.
- **Geprüft:** 12 neue App-Tests (Hülle, Verschlüsselung, Zusammenführen mit Löschvermerken und Festschreibung, Synchronisieren gegen einen Server im Speicher inkl. 409, HTTP-Fehlerarten), API-Test „Synchronisation“, neuer Rundgang `e2e/sync.mjs` mit zwei Geräten gegen die echte API (falsches Passwort, Zusammenführen beider Seiten, kein Klartext auf dem Server, Beenden auf B bemerkt A, Konto löschen). Fachlich offen: T-80.

### E-135 · Qualitätsdurchgang: das Bestehende auf Profi-Niveau, keine neuen Funktionen
- **Datum:** 2026-10-13 · **Status:** angenommen (Gründer: „du sollst das, was schon da ist, auf das maximale Level bringen“)
- **Vorgehen:** zwei unabhängige Prüfungen (Code auf Fehler und Datenverlust; Texte und Barrierefreiheit), eigene Sichtprüfung aller Rundgang-Bildschirme hell und dunkel, danach eine dritte, unabhängige Gegenprüfung der Korrekturen.
- **Steuerzahlen:** Storno einer Rechnung mit Rabattzeile ergab falsche USt-VA, EÜR, DATEV und XRechnung (Vorzeichen doppelt gedreht) – behoben. Nachlasszeilen stehen in der XRechnung mit positivem Preis und negativer Menge (BR-27). Mengen mit bis zu vier Nachkommastellen (2,345 kg) werden nicht mehr auf Cent gerundet.
- **Daten:** Zusammenführen (Synchronisation und Wiederherstellen) vereint zwei Fassungen feldweise – festgeschrieben schlägt Entwurf, erste Ausgabe nach dem früheren Datum, Storno-Verweis aus jeder Fassung, Zahlung nach eigenem Zeitstempel (`bezahltGeaendert`); entfernte Zahlungen und verworfene Storno-Entwürfe kommen nicht zurück. Festgeschriebene Fassung aus einer Sicherung schlägt den Entwurf auf dem Gerät.
- **Ehrliche Erfolgsmeldungen:** Bricht man das Teilen-Menü ab, gilt eine Rechnung nicht mehr als geteilt (kein Festschreiben, kein Freikontingent) und eine Sicherung nicht als erstellt (Löschsperre bleibt). iOS nutzt dafür das Teilen-Menü von React Native, das den Abbruch meldet. Abgebrochener Druck ist kein Fehler.
- **Ladefehler:** statt eines Banners über der App ein eigener Bildschirm – noch einmal versuchen, Sicherung wiederherstellen (wird jetzt auch gespeichert, die unlesbaren Daten werden beiseitegelegt) oder ohne Sicherung neu beginnen.
- **iCloud-Sicherung:** Belegfotos einzeln und nur einmal hochgeladen (Ordner je Schlüssel), Hauptdatei ohne Fotos – keine Speicher- und Akkulast mehr bei jeder Änderung. Einschalten auf einem neuen iPhone übernimmt eine vorhandene Sicherung (gleiches Passwort) oder legt sie beiseite, statt sie zu überschreiben.
- **Weitere Fehler:** unmögliche Daten (31.02.) abgelehnt; Freikontingent nach deutschem Kalendermonat; Kopie einer Rechnung mit heutigem Datum; doppelte Nummern einmal je Liste berechnet und Listen ab 50 Einträgen in Schritten (flüssig bei vielen Unterlagen); Synchronisation markiert nichts als geändert, wenn nichts neu ist, und hängt nicht mehr fest.
- **Barrierefreiheit:** VoiceOver sagt Meldungen und Fehler an (iOS kennt keine Live-Regionen), Knöpfe behalten beim Laden ihren Namen, Feldfehler hängen am Feld, Zwei-Finger-Z führt zurück, der Pflichten-Check springt mit VoiceOver nicht von selbst weiter, Kopfzeilen wachsen mit der Schrift (zweizeilige Titel), Rahmen von Eingabefeldern mit mindestens 3:1 Kontrast (neues Token `rahmen`), Pro-Fläche im Dunkelmodus lesbar, Tippziele ≥ 44 pt, passende Tastaturen ohne Autokorrektur für E-Mail, IBAN, USt-IdNr., Steuer-ID; Minus für Nachlass im Preisfeld.
- **Texte:** einheitlich „Unterlage“ (statt „Dokument“) und „Vorlage in Amtlos“, Grammatik („so viele, wie du willst“, „Die Nummern … kommen“), eigene Fehlermeldungen für E-Rechnung, Paket und Wiederherstellen von Käufen, Bestätigung nach dem Wiederherstellen, „Erstattung vermerkt“ beim Storno, Mitteilungen statt Benachrichtigungen, Aufbewahrungsdauer aus dem Katalog, keine „kein Konto, kein Server“-Aussagen mehr, wo das mit Synchronisation nicht stimmt, ungenutzte Texte entfernt.
- **Bewusst offen:** Die Sicherung als Datei packt weiterhin alle Belegfotos in eine Datei (eine Datei zum Weitergeben ist der Zweck); bei sehr vielen Fotos dauert sie entsprechend.
- **Geprüft:** 73 App-Tests (neu u. a. pruefbefunde.test.ts, Zusammenführen mit Storno/Zahlung), 3 neue Fachlogik-Tests (storno-nachlass.test.ts), Rundgang hell und dunkel, Sync-Rundgang mit zwei Geräten.

### E-136 · Zweiter Qualitätsdurchgang: Dokumente, erste Rechnung, Listen, Pflichten, Marktauftritt
- **Datum:** 2026-10-13 · **Status:** angenommen (Gründer: „noch nicht reif für den großen Markt – perfektioniere das Bestehende weiter, volle Freiheit“)
- **Vorgehen:** drei unabhängige Prüfungen aus Nutzersicht – alle 33 Vorlagen als PDF (je realistisch, Grenzfall, leer; 105 PDFs), erster Start und Alltag eines neuen Nutzers auf 393/375/320 pt hell und dunkel mit 300 Rechnungen, Store-Seite/Website/Symbol – dann Umsetzung und Nachprüfung auf neuen Bildern. Keine neuen Funktionen.
- **Dokumente:** Pflichtangaben der Gesellschaft in der Fußzeile nie mehr gekürzt (vorher „Amtsgericht Münche…“); lange Empfängeranschrift überdeckt den Betreff nicht mehr; Unterschrift nie allein auf einer Seite; Betriebsanweisung und KI-Schulung wieder ein Blatt; Prüfprotokoll quer mit „Ort, Datum“; Zahlenköpfe rechtsbündig; Brief im DIN-Satzspiegel ohne Verkleinerung; Bilanz-Summen auf einer Linie; Lohnkonto rechtsbündig; Allergenliste als Matrix; keine erfundene „00:00 Uhr“ bei Datenpannen; Ort im AVV; IBAN in Vierergruppen; Kopfzeile ab Seite 2. Neues Prüfwerkzeug `werkzeuge/dokumente-pruefen.mjs` (Satzspiegel, Unterschrift allein, Aushang > 1 Blatt) – läuft jetzt in der CI.
- **Erste Rechnung ohne Sackgasse:** ohne eingetragenen Betrieb zeigt Schritt 1 „Von wem ist die Rechnung?“; fehlen am Ende Absenderangaben, heißt der Hauptknopf „Absender ergänzen“ und öffnet nur Angaben und Steuer/Bank mit „Fertig – zurück“. Nach dem Teilen „Rechnung geteilt“ (grün) statt „Festgeschrieben“ (Warnung). Erster Schritt heißt „Eckdaten“.
- **Listen:** Rechnungen zeigen Kunde, Betrag, Nummer, Rechnungsdatum und Status; Stornos „Stornorechnung … zu …“; Filter Rechnungen/Offen nach Rechnungsdatum; Belege mit Betrag rechts; Zahlung vermerken verschiebt nichts mehr (Zeitstempel nur bei Inhaltsänderungen, Zahlung hat `bezahltGeaendert`). Berechnungen zwischengespeichert, Zeilen memoisiert. Bei mehr als 6 Kunden: die letzten 5 als Chips, alle über eine Auswahl mit Suche; Suche auch in Mitarbeiter-/Kundenliste.
- **Pflichten:** „Kurz klären“ stellt nur Fragen, die für den Betrieb gelten (keine Investoren-Frage beim Einzelunternehmen), bei Gleichstand in Katalogreihenfolge. Pflichten-Check: Grundfragen mit ehrlichem Fortschritt, danach Zwischenschirm „Geschafft – dein Ergebnis steht“ mit freiwilligen Zusatzfragen und eigenem Fortschritt; „Überspringen“ statt grauem „Weiter“; Minijob-Frage verständlich. Ergebnis mit „Mit diesen 3 fängst du an“; im Tab Prozent erst ab dem ersten Haken, vollständige Liste eingeklappt, „Wichtig“ nur, wo es unterscheidet. Pflicht abhaken als Knopf mit Bestätigung und „Erledigt am …“.
- **Einheitliches Erscheinungsbild:** ein Auswahl-Stil (Hauch, Rahmen, Häkchen), Orange nur für echte Warnungen, Zahlen ohne Tabellenziffern außerhalb von Tabellen, Rückfragen vor Löschen/Storno/Beenden als System-Dialog, ruhige Pro-Zeile, Pro-Funktionen vorab mit „· Pro“ gekennzeichnet, Bezahlschirm mit dem Grund oben und „Immer kostenlos“ als Karte, freiwillige Felder „optional“, Beleg „Fertig“ mit Rückmeldung, Sicherung danach „Fertig“ statt erneut „Sicherung erstellen“, Startseite mit „Rechnung schreiben“ ohne Scrollen, leere Ablage mit klaren Knöpfen, Seitentitel = Tabname, ein Prüfhinweis-Wortlaut.
- **Marktauftritt:** Store-Texte neu (Name „Amtlos: Rechnung & Pflichten“, Untertitel, Werbetext, Suchbegriffe, Beschreibung mit Pro-Kennzeichnung, ohne „Behörden“ – die App fragt keine Leitweg-ID ab), vollständige Hinweise für Apples Prüfung, Bilder neu sortiert mit Lupe; Website mit echtem `<head>` (SEO, OG, JSON-LD ohne Preis), selbst gehosteten Schriften (kein Google), Impressum/Datenschutz aus `rechtliches.ts` (fehlende Angaben „folgt vor dem Start“), Kontrast, Tippflächen. Version 1.0.0.
- **Bewusst offen:** Übertrag/Zwischensumme bei mehrseitigen Rechnungen (braucht Seitenmessung im Druck), GHS-Piktogramme in der Betriebsanweisung (Entscheidung offen, docs/10), typografisches Minus, App-Symbol (Empfehlung in docs/11), Kategorie-Vorbelegung bei Belegen, Ziffernform der Schrift (Atkinson: Null mit Punkt).
- **Geprüft:** Pipeline grün; Rundgang hell und dunkel (angepasst an die neuen Abläufe), Sync-Rundgang, Dokumentprüfung ohne Befunde; neuer CI-Job „iPhone-App“ führt alle drei aus.

### E-137 · Neues Erscheinungsbild der iPhone-App: eine Marke mit Website, Dokumenten und App-Symbol
- **Datum:** 2026-10-15 · **Status:** angenommen (Gründer: „das Design muss perfekt sein, als wäre die App von einem 100-köpfigen Team von Grafikdesign-Spezialisten – alles komplett auf Profi-App, nicht zusammengebaut wirken“)
- **Grundsatz:** keine neuen Funktionen, keine Textänderungen; nur Gestaltung. Die App übernimmt die Gestaltung, die Website, Dokumente und App-Symbol schon hatten. Bisher sprach sie als einziges Teil der Marke eine andere Schrift.
- **Schrift:** Amtlos Serif (Source Serif 4, Halbfett) für Seitentitel und Abschnittsüberschriften, Amtlos Sans (Source Sans 3) für alles andere – dieselben OFL-Dateien wie in den PDFs (`assets/schriften`). Atkinson Hyperlegible entfällt in der App (das Paket ist entfernt). Grund: Die durchgestrichene Null wirkte in Rechnungsnummern, Beträgen und Daten fremd („2Ø26-ØØ1“). Außerdem passt die App jetzt zu den Dokumenten, die sie erzeugt. Auszeichnung im Text ist Halbfett, Beträge sind fett mit gleich breiten Ziffern. Die Skala ist an die kleinere x-Höhe angepasst (13,5 / 15,5 / 17,5 / 21 / 27 / 34). Die Web-App (`packages/web-kern`) bleibt vorerst bei Atkinson.
- **Farben:** Werte wie auf der Website (Papier `#f2f4f1`, Tinte `#17232e`, Amtsgrün unverändert). Neue Rollen:
  - `flaeche`: ruhige Füllung für Suchfeld, neutrale Hinweise und Zurück-Knopf.
  - `zeiger`: Listenpfeile.
  - `amtText`: Schrift auf Amtsgrün; im Dunkelmodus dunkel wie auf der Website.
  - `buehne`: die eine dunkelgrüne Fläche für Einladung und Pro.
  Rahmen von Eingabefeldern bleiben ≥ 3:1.
- **Flächen:** Karten hell mit weichem Schatten statt Haarlinie, dunkel mit Rahmen. Ecken: 12 (Felder, Hinweise), 14 (Knöpfe), 18 (Karten), 24 (Bühne); Chips rund. Trennlinien als Haarlinie, in Listen ab dem Text eingerückt wie in iOS.
- **Bildzeichen:** Der Stempel aus dem App-Symbol (doppelter Ring mit Haken, −12°) ist das eine wiederkehrende Motiv. Er steht als Wasserzeichen auf der Bühne, bei leeren Listen, beim Check-Ergebnis und bei fertigen bzw. geteilten Unterlagen. Listenzeilen tragen getönte Symbol-Kacheln: grün normal, bernstein bei fehlenden Angaben, grau neutral. Personen erscheinen mit Initialen.
- **Bausteine:** Knöpfe sind 52 pt hoch und geben beim Drücken leicht nach. Gewählte Chips sind amtsgrün gefüllt und tragen weiter ein Häkchen (Farbe nie allein). Listenauswahl mit Radiokreis. Felder zeigen im Fokus einen grünen 2-pt-Rahmen, ohne dass der Text springt. Abläufe haben einen runden Schließen-Knopf und einen ruhigen Zurück-Knopf. Die Summenzeile steht unter doppelter Linie wie auf dem Dokument. Ergebnisse erscheinen als Zeilen mit Symbol. „Weitere Möglichkeiten“ ist eine Liste statt loser Textlinks.
- **Seiten:**
  - Pflichten-Start mit Bühne und zwei Schnellzugriff-Kacheln; dieselben Kacheln im Tab „Vorlagen“.
  - Pflichten-Übersicht mit Fortschrittskarte.
  - Pro mit Bühne.
  - Sperre und Ladefehler mit großer Kachel.
  - Store- und Website-Bilder neu erzeugt, Überschriften dort ebenfalls in Amtlos Serif.
  - `store-bilder.mjs` wählt die erste Pflicht unter „Jetzt dran“ unabhängig vom Tag.
- **Geprüft:** Typprüfung, Lint, Unit-Tests; Rundgang hell und dunkel ohne Befunde; Sync-Rundgang. Die Sichtprüfung lief über den Web-Export. SF Symbols, Schatten und Haptik wirken nur auf dem iPhone (→ PRUEFLISTE T-82).

### E-138 · Neuer Aufbau: „Heute“, „+“ zum Erstellen, Fristblatt, Rechnungsstatus
- **Datum:** 2026-10-15 · **Status:** angenommen. Wunsch des Gründers: „Zweck und Nutzen maximieren, Qualität statt Quantität, maximal Profi-App-Niveau – nicht wie ein Prototyp, sondern wie die beste in dem Bereich“.
- **Vorbild:** wie die führenden Werkzeug- und Finanz-Apps aufgebaut sind. Ein Startbildschirm mit dem, was zählt. Ein zentraler Ort zum Erstellen. Status auf einen Blick. Termine in Tagen statt nur als Datum.
- **Tabs:** Heute · Pflichten · (+) · Unterlagen · Mein Betrieb. Der Tab „Vorlagen“ entfällt.
- **Erstellen (+):** öffnet ein Blatt „Neu erstellen“ mit Suche, Rechnung, Beleg, zuletzt Bearbeitetem und Anlässen. Wer etwas wählt, landet im Ablauf im aktuellen Tab, und das Blatt schließt sich. Jedes Öffnen beginnt auf der ersten Seite.
- **Heute:** zeigt der Reihe nach:
  - Datum und Gruß.
  - Den Sicherungshinweis, falls fällig.
  - Vor dem Check die Einladung, danach „Als Nächstes“ mit bis zu drei Pflichten.
  - Zwei Kennzahlen: „Offen“ (brutto, mit „davon überfällig“) und „Im Monat berechnet“. Stornos ziehen ab, es zählt das Rechnungsdatum.
  - Schnellzugriffe und das zuletzt Bearbeitete.
- **Fristblatt:** Termine erscheinen als Abreißkalender. Den Status zeigt ein Streifen: rot überfällig, bernstein bis 14 Tage, grün erledigt. Dazu steht ein Text wie „In 11 Tagen fällig“, „Morgen fällig“ oder „Seit 3 Tagen überfällig“. Das gilt für Pflichtenlisten, „Heute“ und die Pflicht-Seite. Für VoiceOver steht das Datum im Text.
- **Rechnungsstatus:** Rechnungen tragen eine Plakette: Entwurf, Offen, Überfällig, Bezahlt oder Storniert. „Überfällig“ heißt: offen und über dem eigenen Zahlungsziel der Rechnung (Rechnungsdatum plus Tage; „sofort“ = Rechnungsdatum). Es ist keine rechtliche Bewertung, Mahnfristen sind nicht berührt. Die Zahlungskarte zeigt „Fällig bis …“ bzw. „Überfällig – fällig war der …“.
- **Geprüft:** Unit-Tests für Monatssumme, Fälligkeit und Überfälligkeit; Rundgang hell und dunkel an den neuen Aufbau angepasst; Store- und Website-Bilder neu.

---

## Offen (juristische Klärung, blockiert die jeweiligen Abschnitte)

| Nr. | Frage | blockiert |
|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch „Selbsthilfe“ nach StBerG? Darf das Zertifikat kurzzeitig serverseitig verarbeitet werden? | Abschnitt 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | Abschnitt 9 |
| J-3 | Darstellung „nicht zutreffend“ und „trotzdem prüfen lassen“ | Abschnitt 2 (Livegang) |
| J-4 | Marktplatz: zulässiges Vergütungsmodell nach Berufsrecht | Abschnitt 9 |

Bis zur Klärung: ERiC-Gateway wird so gebaut, dass beide Varianten (serverseitig, lokal beim Nutzer) möglich bleiben; der Marktplatz wird mit Festpreis-Listung/Partner-Abo geplant.
