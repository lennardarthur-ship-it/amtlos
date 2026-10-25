/**
 * Vorprüfung Recht (21.10.2026, docs/pruefberichte/2026-10-21-vorpruefung-phase-1.pdf, Abschnitte 8 und 9):
 * Datenschutzhinweis (Verantwortlicher, SCC-Fundstelle, Speicherdauer RevenueCat, Aufsichtsbehörde, Sync-Backups),
 * Nutzungsbedingungen „Fassung zur Freigabe“ und die Zustimmung beim ersten Start (§ 305 Abs. 2 BGB) – aktiv erst mit
 * `NUTZUNGSBEDINGUNGEN.freigegeben`. Beide Zustände des Schalters werden geprüft.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MARKE } from "@amtlos/marke";
import { ANBIETER, AUFSICHTSBEHOERDE, DATENSCHUTZ, DATENSCHUTZ_SYNC, LINKS, NUTZUNGSBEDINGUNGEN, PLATZHALTER_RECHT, REVENUECAT_DPA, SCC_FUNDSTELLE, datenschutzAbschnitte, nutzungsLink, zustimmungAus, zustimmungNoetig } from "../src/rechtliches";
import { LEERER_STAND, MIGRATIONEN, STAND_VERSION, migrieren, standAus, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { sicherungErstellen, sicherungLesen } from "../src/unterlagen/sicherung";
import { T as TEXT } from "../src/texte";

const WURZEL = path.resolve(__dirname, "../../..");
const lies = (p: string) => fs.readFileSync(path.join(WURZEL, p), "utf8");
const AN = { ...NUTZUNGSBEDINGUNGEN, freigegeben: true };
const AUS = { ...NUTZUNGSBEDINGUNGEN, freigegeben: false };
const Z = { fassung: NUTZUNGSBEDINGUNGEN.fassung, zeitpunkt: "2026-10-22T09:15:00.000Z" };

describe("Zustimmung zu den Nutzungsbedingungen: Schalter aus (heutiger Stand)", () => {
  it("die eigenen Bedingungen sind noch nicht freigegeben – Apples Standard-EULA bleibt der Link", () => {
    expect(NUTZUNGSBEDINGUNGEN.freigegeben).toBe(false);
    expect(LINKS.nutzung).toBe("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/");
    expect(nutzungsLink()).toBe(LINKS.nutzung);
    expect(nutzungsLink(AUS)).toBe(LINKS.nutzung);
  });

  it("fragt nie – weder beim ersten Start noch mit alter oder fehlender Zustimmung (Rundgang unverändert)", () => {
    expect(zustimmungNoetig(undefined)).toBe(false);
    expect(zustimmungNoetig(undefined, AUS)).toBe(false);
    expect(zustimmungNoetig({ fassung: "2025-01-01", zeitpunkt: Z.zeitpunkt }, AUS)).toBe(false);
    expect(zustimmungNoetig(LEERER_STAND.nutzungsbedingungen)).toBe(false);
  });

  it("Datenschutzhinweis freigegeben (Rechtsanwalt 23.10.2026, Build ohne Sync)", () => {
    expect(DATENSCHUTZ.freigegeben).toBe(true);
  });
});

describe("Zustimmung zu den Nutzungsbedingungen: Schalter an (nach der Freigabe)", () => {
  it("fragt beim ersten Start, nach der Zustimmung nicht mehr, bei einer neuen Fassung erneut", () => {
    expect(zustimmungNoetig(undefined, AN)).toBe(true);
    expect(zustimmungNoetig(Z, AN)).toBe(false);
    expect(zustimmungNoetig({ fassung: "2026-01-01", zeitpunkt: Z.zeitpunkt }, AN)).toBe(true);
    expect(zustimmungNoetig(Z, { ...AN, fassung: "2027-03-01" })).toBe(true);
  });

  it("verlinkt dann die eigenen Bedingungen auf der Website der Marke", () => {
    expect(nutzungsLink(AN)).toBe(`${MARKE.website}/nutzungsbedingungen.html`);
    expect(NUTZUNGSBEDINGUNGEN.url).toBe(`${MARKE.website}/nutzungsbedingungen.html`);
  });

  it("Zustimmungsseite: Kästchen anfangs leer, „Weiter“ erst danach, Link zu Bedingungen und Datenschutzhinweis, kein Konto", () => {
    const q = lies("apps/mobile/src/seiten/Zustimmung.tsx");
    expect(q).toContain("const [an, setAn] = useState(false);");
    expect(q).toContain("deaktiviert={!an}");
    expect(q).toContain('accessibilityRole="checkbox"');
    expect(q).toContain("NUTZUNGSBEDINGUNGEN.url");
    expect(q).toContain("datenschutzAbschnitte(");
    expect(q).toContain("nutzungsbedingungenAnnehmen(NUTZUNGSBEDINGUNGEN.fassung)");
    // bei Ladefehlern nicht fragen – Wiederherstellen bleibt erreichbar
    expect(q).toMatch(/!bereit \|\| ladefehler \|\| !zustimmungNoetig\(zustimmung\)/);
    expect(q).not.toMatch(/anmelden|useKonto|login/i);
    expect(TEXT.vr_akzeptieren).toBe("Ich akzeptiere die Nutzungsbedingungen.");
    expect(TEXT.vr_text_neu("21.10.2026")).toContain("unverändert");
  });

  it("App.tsx legt das Tor nur um die Navigation – Sperre, Partner-Link und Meldungen bleiben außen", () => {
    const app = lies("apps/mobile/src/App.tsx");
    expect(app).toMatch(/<ZustimmungTor>\s*<Rahmen \/>\s*<\/ZustimmungTor>/);
    expect(app.indexOf("<PartnerLink />")).toBeLessThan(app.indexOf("<ZustimmungTor>"));
    const zustand = lies("apps/mobile/src/zustand.tsx");
    expect(zustand).toMatch(/nutzungsbedingungenAnnehmen: \(fassung\) => \{\s*setzen\(\{ \.\.\.aktuell\.current, nutzungsbedingungen: \{ fassung, zeitpunkt: new Date\(\)\.toISOString\(\) \} \}\);\s*schreiben\(\);/);
  });
});

describe("Zustimmung im Stand (Migration 5 → 6)", () => {
  const mit = (z?: Stand["nutzungsbedingungen"]): Stand => ({ ...LEERER_STAND, ...(z ? { nutzungsbedingungen: z } : {}) });

  it("Version 6; ältere Stände haben keine Zustimmung, sonst bleibt alles", () => {
    expect(STAND_VERSION).toBe(8);
    expect(MIGRATIONEN[5]!({ version: 5, partnerId: "x" })).toEqual({ version: 5, partnerId: "x", nutzungsbedingungen: undefined });
    const alt = standAus(JSON.stringify({ version: 5, betrieb: { name: "Alt" } }));
    expect(alt.version).toBe(8);
    expect(alt.betrieb.name).toBe("Alt");
    expect("nutzungsbedingungen" in alt).toBe(false);
    expect(migrieren({ version: 1 }).version).toBe(8);
    expect(() => standAus(JSON.stringify({ version: STAND_VERSION + 1 }))).toThrow();
  });

  it("Fassung und Zeitpunkt bleiben beim Speichern und in der Sicherung erhalten; Unlesbares fällt weg", () => {
    expect(standAus(JSON.stringify(mit(Z))).nutzungsbedingungen).toEqual(Z);
    for (const kaputt of [{ fassung: "gestern", zeitpunkt: Z.zeitpunkt }, { fassung: Z.fassung }, { fassung: Z.fassung, zeitpunkt: 5 }, "ja", [Z]]) {
      expect(zustimmungAus(kaputt)).toBeUndefined();
      expect("nutzungsbedingungen" in standAus(JSON.stringify({ ...LEERER_STAND, nutzungsbedingungen: kaputt }))).toBe(false);
    }
    const zufall = (n: number) => new Uint8Array(randomBytes(n));
    const zurueck = sicherungLesen(sicherungErstellen(mit(Z), "richtig-langes-passwort", zufall, new Date(), 1000), "richtig-langes-passwort");
    expect(zurueck.nutzungsbedingungen).toEqual(Z);
  });

  it("Wiederherstellen: die Zustimmung auf dem Gerät gewinnt", () => {
    const geraet = { fassung: "2027-01-01", zeitpunkt: "2027-01-02T08:00:00.000Z" };
    expect(zusammenfuehren(mit(geraet), mit(Z)).stand.nutzungsbedingungen).toEqual(geraet);
  });
});

describe("Datenschutzhinweis nach der Vorprüfung (Abschnitt 8)", () => {
  const text = (sync: boolean) => datenschutzAbschnitte(sync).map((a) => a.text).join("\n");
  const abschnitt = (sync: boolean, titel: string) => datenschutzAbschnitte(sync).find((a) => a.titel === titel)!.text;

  it("Verantwortlicher aus ANBIETER – mit Rechtsform und Vertretung; Website und App zeigen die Vertretung", () => {
    expect(ANBIETER.name).toMatch(/UG \(haftungsbeschränkt\)/);
    expect(ANBIETER.rechtsform).toBe("Unternehmergesellschaft (haftungsbeschränkt)");
    expect(ANBIETER.vertretung).toBeTruthy();
    expect(lies("apps/mobile/src/seiten/Recht.tsx")).toContain("TEXT.vr_vertreten(ANBIETER.vertretung)");
    expect(lies("apps/website/bauen.mjs")).toContain("Vertreten durch ${esc(A.vertretung)}");
  });

  it("Drittland: SCC mit Fundstelle (Durchführungsbeschluss (EU) 2021/914, Modul 2) und DPA-Adresse – ohne und mit Sync", () => {
    expect(SCC_FUNDSTELLE).toBe("Standardvertragsklauseln der EU-Kommission (Durchführungsbeschluss (EU) 2021/914, Modul 2), Art. 46 Abs. 2 lit. c DSGVO");
    for (const sync of [false, true]) {
      const t = abschnitt(sync, "Empfänger und Drittland");
      expect(t).toContain(SCC_FUNDSTELLE);
      expect(t).toContain(REVENUECAT_DPA);
      expect(t).toContain("ABl. L 199 vom 7.6.2021");
      // Data Privacy Framework nur, wenn belegt – am 21.10.2026 nicht belegbar
      expect(t).not.toMatch(/Data Privacy Framework|DPF|Art\. 45/);
    }
  });

  it("Speicherdauer RevenueCat: Löschfrist nach Abo-Ende (Gründerentscheidung E-159), umgesetzt mit werkzeuge/revenuecat-loeschen.mjs", () => {
    const t = abschnitt(false, "Speicherdauer");
    expect(t).toContain("solange dein Abo besteht");
    expect(t).toContain("Spätestens vier Monate nach Ende deines Abos");
    expect(t).toContain("Endet unser Vertrag, löscht RevenueCat die Daten");
  });

  it("Deine Rechte nennen die zuständige Aufsichtsbehörde (Sitz Reutlingen → Baden-Württemberg)", () => {
    expect(ANBIETER.anschrift).toMatch(/72770 Reutlingen/);
    expect(AUFSICHTSBEHOERDE.land).toBe("Baden-Württemberg");
    expect(AUFSICHTSBEHOERDE.name).toBe("Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg");
    for (const sync of [false, true]) {
      expect(abschnitt(sync, "Deine Rechte")).toContain(AUFSICHTSBEHOERDE.name);
      expect(abschnitt(sync, "Deine Rechte")).toContain("Lautenschlagerstraße 20, 70173 Stuttgart");
    }
  });

  it("Erinnerungen nur lokal; Sync-Zusatz mit Platzhalter für Server-Backups (nur im Sync-Build gemeldet)", () => {
    expect(abschnitt(false, "Erinnerungen")).toContain("Push-Mitteilungen über einen Server nutzt die App nicht");
    expect(DATENSCHUTZ_SYNC.abschnitt.text).toContain(`Sicherungskopien des Servers verschwinden gelöschte Daten nach ${PLATZHALTER_RECHT}`);
    expect(text(false)).not.toContain(PLATZHALTER_RECHT);
  });
});

describe("Nutzungsbedingungen – Fassung zur Freigabe (Abschnitt 9)", () => {
  const md = lies("docs/nutzungsbedingungen-entwurf.md");
  /** Klauseltext ohne Arbeitsnotizen („>“) – das, was die Website zeigt */
  const klauseln = md.split(/\n\s*\n/).filter((a) => !a.trim().startsWith(">")).join("\n\n");

  it("Ziffer 1.1 aus ANBIETER, Fassung passt zu NUTZUNGSBEDINGUNGEN.fassung", () => {
    const z11 = /^1\.1 .*$/m.exec(md)![0];
    for (const w of [ANBIETER.name, ANBIETER.anschrift, ANBIETER.vertretung, ANBIETER.email]) expect(z11).toContain(w);
    expect(z11).toContain("[nach Eintragung]");
    const [, t, m, j] = /Fassung vom (\d{2})\.(\d{2})\.(\d{4})/.exec(md)!;
    expect(`${j}-${m}-${t}`).toBe(NUTZUNGSBEDINGUNGEN.fassung);
    expect(md).toContain("Fassung zur Freigabe");
    expect(md).toContain(MARKE.name);
  });

  it("Vorschläge der Vorprüfung sind eingearbeitet", () => {
    for (const s of [
      "Ob eine Pflicht für dich gilt, hängt von Umständen ab, die die App nicht abfragt.",
      "auch über die Familienfreigabe, soweit die Nutzungsregeln das erlauben",
      "Den Kauf schließt du mit Apple ab; über dein Widerrufsrecht informiert dich Apple beim Kauf.",
      "Rechtsänderung",
      "(Sicherheit)",
      "(technische Anpassung)",
      "§ 327r BGB",
      "Gegenüber Unternehmern verjähren Mängelansprüche in zwölf Monaten ab Bereitstellung; die App wird in der jeweils bereitgestellten Fassung geschuldet. Ansprüche nach Ziffer 8.1 bleiben unberührt.",
      "Das gilt insbesondere für Bußgelder, Abmahnkosten oder Steuernachzahlungen",
      "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
      "sie gelten, wenn du ihnen in der App zustimmst",
      "keine rechtswidrigen Inhalte",
      `umgehst die Sperre der Funktionen von ${MARKE.proName} nicht`,
      "Wir werten keine Inhalte deiner Unterlagen aus.",
      "sind wir für Prüfung, Abwehr und Erledigung des Anspruchs allein verantwortlich",
      "keine eigenen Nutzungsbedingungen von RevenueCat",
      "die Bedingungen von Apple für iCloud",
    ])
      expect(klauseln).toContain(s);
  });

  it("Haftungshöhe gegenüber Unternehmern: Festbetrag 5.000 € je Schadensfall (Gründerentscheidung E-159), keine Grenze nach Jahresentgelt", () => {
    expect(klauseln).toContain("begrenzt auf den vertragstypischen, vorhersehbaren Schaden");
    expect(klauseln).toContain("8.2a Gegenüber Unternehmern ist unsere Haftung nach Ziffer 8.2 auf 5.000 € je Schadensfall begrenzt.");
    expect(klauseln).not.toMatch(/Entgelte der letzten/);
    expect(klauseln).not.toMatch(/\[[^\]]*(Prüfung zu formulieren|Sitz des Anbieters|Firma, Rechtsform)[^\]]*\]/);
  });
});

describe("Website und Store-Check", () => {
  it("Website: nutzungsbedingungen.html als Entwurf, Impressum mit Rechtsform, Datenschutz mit Kurz-Check und Hosting-Platzhalter", () => {
    const aus = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "web-"));
    execFileSync("node", [path.join(WURZEL, "apps/website/bauen.mjs"), aus, "--entwurf"], { stdio: "pipe" });
    const nb = fs.readFileSync(path.join(aus, "nutzungsbedingungen.html"), "utf8");
    expect(nb).toContain("Entwurf – noch nicht in Kraft");
    expect(nb).toContain('<meta name="robots" content="noindex">');
    expect(nb).not.toContain("Prüfen:");
    expect(nb).not.toContain("Entscheidung (Gründer");
    expect(nb).toContain("Wir werten keine Inhalte deiner Unterlagen aus.");
    // vor der Freigabe nicht verlinkt
    expect(fs.readFileSync(path.join(aus, "index.html"), "utf8")).not.toContain('href="nutzungsbedingungen.html"');
    const imp = fs.readFileSync(path.join(aus, "impressum.html"), "utf8");
    expect(imp).toContain("Unternehmergesellschaft (haftungsbeschränkt)");
    expect(imp).toContain("Lennard Lang");
    const ds = fs.readFileSync(path.join(aus, "datenschutz.html"), "utf8");
    expect(ds).toContain("Der Kurz-Check rechnet nur in deinem Browser");
    expect(ds).toContain("Angaben zum Hosting");
    expect(ds).toContain("Vertreten durch");
    fs.rmSync(aus, { recursive: true, force: true });
  });

  it("der Kurz-Check der Website schickt nichts an einen Server", () => {
    const seite = lies("apps/website/seite.html");
    expect(seite).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|<form|localStorage|https?:\/\/(?!schema\.org)/);
  });

  it("Store-Check meldet die nicht freigegebenen Nutzungsbedingungen als offen", () => {
    let aus = "";
    try {
      execFileSync("node", [path.join(WURZEL, "apps/mobile/werkzeuge/store-check.mjs")], { stdio: "pipe", env: { ...process.env, EXPO_PUBLIC_API_URL: "" } });
    } catch (e) {
      aus = String((e as { stdout?: Buffer }).stdout ?? "");
    }
    expect(aus).toContain("✗ Eigene Nutzungsbedingungen freigegeben");
    expect(aus).toContain("✓ Datenschutzhinweis der App fachlich freigegeben");
  });
});
