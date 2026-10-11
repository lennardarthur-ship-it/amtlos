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
- **Datum:** 2026-10-11 · **Status:** angenommen
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

---

## Offen (juristische Klärung, blockiert die jeweiligen Abschnitte)

| Nr. | Frage | blockiert |
|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch „Selbsthilfe“ nach StBerG? Darf das Zertifikat kurzzeitig serverseitig verarbeitet werden? | Abschnitt 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | Abschnitt 9 |
| J-3 | Darstellung „nicht zutreffend“ und „trotzdem prüfen lassen“ | Abschnitt 2 (Livegang) |
| J-4 | Marktplatz: zulässiges Vergütungsmodell nach Berufsrecht | Abschnitt 9 |

Bis zur Klärung: ERiC-Gateway wird so gebaut, dass beide Varianten (serverseitig, lokal beim Nutzer) möglich bleiben; der Marktplatz wird mit Festpreis-Listung/Partner-Abo geplant.
