# 04 · Seitenstruktur

Stand: 2026-10-11 · Zahl in Klammern = Bauabschnitt, in dem die Seite entsteht.

## Navigation der Nutzer-App (`apps/web`)

Mobil: untere Leiste mit fünf Einträgen. Desktop: linke Seitenleiste mit denselben Einträgen plus den aktiven Modulen.

| Leiste | Ziel |
|---|---|
| **Heute** | `/heute` |
| **Pflichten** | `/pflichten` |
| **Kalender** | `/kalender` |
| **Erfassen** (+) | Schnellaktion: Beleg fotografieren, Zeit buchen, Brief hochladen, Ereignis melden |
| **Mehr** | Module, Einstellungen, Hilfe |

Module erscheinen nur, wenn das Profil sie aktiviert (z. B. „Personal“ erst ab der ersten Beschäftigten oder geplanter Einstellung).

## Routen

```
/                                   Weiterleitung: angemeldet → /heute, sonst → /anmelden          (1)
/anmelden, /registrieren            OIDC-Flow (Zitadel), Passkey zuerst                              (1)
/einladung/[token]                  Einladung annehmen                                               (1)
/unternehmen/neu                    Unternehmen anlegen; Auswahl bei mehreren Unternehmen            (1)

/onboarding                         Dialogisches Profil, ein Thema je Schritt, unterbrechbar        (2)
  /onboarding/[schritt]             rechtsform · taetigkeit · ort · umsatz · kunden · vertrieb ·
                                    produkte · kasse · beschaeftigte · daten · ki · gesellschafter
/heute                              Ampel je Bereich, „Als Nächstes tun“ (max. 3), Score, Mitteilungen (2)
/pflichten                          Liste, Filter: Bereich, Status, Zeitraum; „Angabe fehlt“ oben   (2)
/pflichten/[pflichtId]              Pflicht-Karte: was, bis wann, warum, was passiert sonst,
                                    „gilt für dich, weil …“, Quellen + Prüfdatum, Erledigen-Knopf,
                                    Historie der Perioden                                           (2)
/pflichten/[pflichtId]/[periode]    eine Instanz: Nachweis hochladen, abhaken, Erinnerung ändern    (2)
/pflichten/nicht-zutreffend         alle als nicht zutreffend bewerteten Pflichten mit Begründung   (2)
/kalender                           Monat / Liste, ICS-Abo, Export                                   (2)
/ereignis/neu                       „Was hat sich geändert?“ – Ereignis melden                      (2)
/dokumente                          alle Dokumente, Filter, Prüfungsmappe erstellen                 (2)
/dokumente/[id]                     Vorschau, Version, Aufbewahrung                                  (2)
/dokumente/erzeugen/[vorlageId]     Fragen → Dokument (PDF/DOCX)                                     (2)

/gruendung                          Gründungsassistent: Schritte mit Abhängigkeiten                 (3)
/gruendung/elster/fragebogen        Fragebogen zur steuerlichen Erfassung, vorausgefüllt           (3)
/gesellschaft                       Cap Table, Gesellschafter, Beschlüsse, Register-Fristen         (3)
/gesellschaft/beschluesse/neu       Beschluss aus Vorlage                                            (3)
/gesellschaft/foerderung            Fördermittel-Matching                                            (3)

/finanzen                           Übersicht: offene Rechnungen, Belege, Kleinunternehmer-Wächter (4)
/finanzen/rechnungen[/neu|/[id]]    Rechnung schreiben, E-Rechnung, Versand                          (4)
/finanzen/eingang                   empfangene E-Rechnungen, Validierung                             (4)
/finanzen/belege[/[id]]             Belege, OCR-Ergebnis bestätigen                                  (4)
/finanzen/bank                      Konten, Umsätze, Zuordnung                                       (4)
/finanzen/umsatzsteuer/[periode]    USt-VA prüfen und selbst übermitteln                             (4)
/finanzen/kasse                     Kassen, Meldung                                                  (4)
/finanzen/export                    DATEV-Export, Steuerberater-Zugang                               (4)

/personal                           Team, Schwellenwert-Wächter                                      (5)
/personal/[personId]                Onboarding-Checkliste je Person                                  (5)
/personal/zeiten                    Zeiterfassung (mobil zuerst), Auswertung, Export                 (5)
/arbeitsschutz                      Gefährdungsbeurteilungen, Unterweisungen, Prüfungen, Erste Hilfe (5)
/arbeitsschutz/unterweisung/[id]    Unterweisung durchführen und unterschreiben                      (5)

/datenschutz                        VVT, TOMs, Dienstleister/AVV, Anfragen, Löschkonzept            (6)
/datenschutz/anfragen/[id]          Betroffenenanfrage mit Fristuhr                                   (6)
/datenschutz/panne                  Notfallknopf: 72-Stunden-Countdown, Meldeentwurf                 (6)
/it-sicherheit/nis2                 Betroffenheitscheck                                               (6)
/ki                                 KI-Systeme, Schulung, Nachweise                                   (6)

/online-check                       Domains, Verifizierung, Berichte                                  (7)
/online-check/[laufId]              Befunde mit Korrekturvorlagen                                     (7)
/produkte                           Registrierungen (Verpackung, Elektro, Batterien), GPSR           (7)

/frag                               „Frag Amtlos“ mit Quellen und Prüfdatum                          (9)
/postfach[/[id]]                    Behörden-Postfach: Upload, Einordnen mit Frist aus dem Brief      (9)
/experten[/[id]]                    Marktplatz: geprüfte Partner, Pakete, Anfrage mit Einwilligung    (9)
/mehr                               Frag, Radar, Experten, Melden, Team, Hilfe (mobil auch Bereiche)  (9)
/radar                              Rechtsänderungen, die dich betreffen würden                       (9)

/einstellungen/profil               Profil bearbeiten (neue Version), Änderungshistorie             (2)
/einstellungen/team                 Mitglieder, Rollen, Einladungen, Steuerberater-Zugang           (1)
/einstellungen/benachrichtigungen   Kanäle, Vorlauf                                                   (2)
/einstellungen/sicherheit           Passkeys, 2FA, Sitzungen, Aktivitätsprotokoll                    (1)
/einstellungen/abo                  Plan, Rechnungen (E-Rechnung), Kündigungsbutton                 (1)
/einstellungen/daten                Datenexport, Konto/Unternehmen löschen                            (1)
/hilfe[/[artikel]]                  Hilfe-Artikel, Glossar der Fachbegriffe                           (2)
/rechtliches/{impressum,datenschutz,agb,barrierefreiheit}                                            (1)
```

## Studio (`apps/studio`, nur Plattformrollen)

```
/                                   Übersicht: Prüfquote je Kategorie, offene Freigaben, Radar-Fälligkeiten
/pflichten                          Liste mit Prüfstatus, Filter nach Kategorie/Katalog-Nr.
/pflichten/[id]                     Versionen, Diff zwischen Versionen
/pflichten/[id]/bearbeiten          Formular-Editor (kein YAML nötig), Live-Schema-Prüfung,
                                    Vorschau der Pflicht-Karte DE/EN, Begründungsvorschau
/pflichten/[id]/testlauf            Fixtures: welche Ergebnisse ändern sich gegenüber Release
/regelwerte[/[id]]                  Zeitstrahl der Versionen, Überlappungsprüfung
/fakten                             Fakten-Katalog (lesend, gepflegt im Code)
/fixtures[/[id]]                    Profil-Fixtures anlegen und pflegen
/quellen                            Quellen, Abrufdatum, Archivkopie, tote Links
/freigaben                          Prüfungs-Warteschlange je Prüfer und Qualifikation
/releases[/[nummer]]                Release zusammenstellen, Auswirkung (Anzahl betroffener Unternehmen),
                                    veröffentlichen, Export-PR
/radar                              Rechtsänderungen pflegen
/vorlagen[/[id]]                    Vorlagen-Editor mit Vorschau aus Fixture-Profil
/mitteilungen                       „Was ändert sich für dich?“ je Release
/pruefliste                         alle [FACHLICH ZU PRÜFEN]-Punkte aus Katalog und PRUEFLISTE.md
/experten                           Prüfer und Qualifikationen verwalten (nur plattform_admin)
/partner                            Marktplatz-Partner pflegen, Zulassungsprüfung (Admin/Redaktion) (9)
```

## Seitenvertrag „Pflicht-Karte“ (Spezifikation 11)

Jede Pflicht-Karte zeigt in dieser Reihenfolge:

1. **Was** – `titel`, `kurz`
2. **Bis wann** – Fälligkeit, ggf. „verschoben wegen Feiertag“, Status-Chip
3. **Erledigen-Knopf** – aus `aktion`
4. **Warum gilt das für dich** – Begründung aus der Engine, aufklappbar
5. **Was passiert sonst** – `sanktion.text`
6. **Mehr** – Erklärung, Fachbegriffe, zuständige Stelle, Kosten
7. **Quellen** – Rechtsgrundlage, Quellen-Links, „geprüft von … am …“
8. Hinweis „ersetzt keine Steuer- oder Rechtsberatung“ nur bei Kategorien Steuern und Gesellschaft sowie bei `angabe_fehlt` (Spezifikation 8.4)
