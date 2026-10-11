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

---

## Offen (juristische Klärung, blockiert die jeweiligen Abschnitte)

| Nr. | Frage | blockiert |
|---|---|---|
| J-1 | ELSTER-Übermittlung über unseren Server mit Nutzerzertifikat noch „Selbsthilfe“ nach StBerG? Darf das Zertifikat kurzzeitig serverseitig verarbeitet werden? | Abschnitt 3, 4 |
| J-2 | Behörden-Postfach: Grenze allgemeine Erklärung ↔ Einzelfallprüfung (RDG) | Abschnitt 9 |
| J-3 | Darstellung „nicht zutreffend“ und „trotzdem prüfen lassen“ | Abschnitt 2 (Livegang) |
| J-4 | Marktplatz: zulässiges Vergütungsmodell nach Berufsrecht | Abschnitt 9 |

Bis zur Klärung: ERiC-Gateway wird so gebaut, dass beide Varianten (serverseitig, lokal beim Nutzer) möglich bleiben; der Marktplatz wird mit Festpreis-Listung/Partner-Abo geplant.
