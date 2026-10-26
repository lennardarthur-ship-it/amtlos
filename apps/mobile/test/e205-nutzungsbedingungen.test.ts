/**
 * E-205: gemeinsame Nutzungsbedingungen für iPhone und Android (Google Play), vom Rechtsanwalt am 26.10.2026 inhaltlich
 * freigegeben (Mail beim Gründer), noch nicht in Kraft (erst nach der Eintragung der UG).
 * - Der Klauseltext ist der freigegebene Wortlaut: Prüfsumme über alles außer Ziffer 1.1 und „Fassung vom …“.
 * - In Kraft erst mit Fassungsdatum; eine neue Fassung fragt erneut nach der Zustimmung (Ziffer 1.4).
 * - Android verlinkt die gemeinsame Fassung (bis zur Inkraftsetzung als Entwurf) und hat „Abo verwalten“ wie das iPhone.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKE } from "@amtlos/marke";
import { ANBIETER, LINKS, NUTZUNGSBEDINGUNGEN, NUTZUNGSBEDINGUNGEN_BESTAETIGUNG, NUTZUNGSBEDINGUNGEN_PRUEFSUMME, aboVerwaltenLink, nutzungsLink, zustimmungAus, zustimmungNoetig } from "../src/rechtliches";
import { LEERER_STAND, standAus } from "../src/unterlagen/speicher";

const WURZEL = path.resolve(__dirname, "../../..");
const lies = (p: string) => fs.readFileSync(path.join(WURZEL, p), "utf8");
const MD = lies("docs/nutzungsbedingungen-entwurf.md");
/** Absätze, wie die Website sie zeigt (ohne Überschrift 1 und Arbeitsnotizen) */
const absaetze = (md: string) => md.split(/\n\s*\n/).map((a) => a.trim()).filter((a) => a && !a.startsWith("# ") && !a.startsWith(">"));
const pruefsumme = (md: string) =>
  createHash("sha256")
    .update(`${absaetze(md).filter((a) => !a.startsWith("1.1 ") && !a.startsWith("Fassung vom ")).join("\n\n")}\n`)
    .digest("hex")
    .slice(0, 12);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("E-205: Wortlaut der gemeinsamen Fassung", () => {
  it("Klauseltext unverändert gegenüber der Freigabe vom 26.10.2026 (Prüfsumme)", () => {
    expect(pruefsumme(MD)).toBe(NUTZUNGSBEDINGUNGEN_PRUEFSUMME);
    expect(NUTZUNGSBEDINGUNGEN_BESTAETIGUNG).toMatchObject({ art: "mail", datum: "2026-10-26", rolle: "recht", aufbewahrung: "beim Gründer", pruefsumme: NUTZUNGSBEDINGUNGEN_PRUEFSUMME });
  });

  it("jede Änderung am Klauseltext ändert die Prüfsumme – die Inkraftsetzung (Ziffer 1.1, Fassungsdatum) nicht", () => {
    expect(pruefsumme(MD.replace("nicht Apple oder Google.", "nicht Apple."))).not.toBe(NUTZUNGSBEDINGUNGEN_PRUEFSUMME);
    const inKraft = MD.replace(" i. G.,", ",").replace("Registernummer: [nach Eintragung]", "Registernummer: Amtsgericht Stuttgart, HRB 000000").replace("Fassung vom [Datum der Veröffentlichung]", "Fassung vom 15.01.2027");
    expect(inKraft).not.toBe(MD);
    expect(pruefsumme(inKraft)).toBe(NUTZUNGSBEDINGUNGEN_PRUEFSUMME);
  });

  it("Ziffer 1.1 im freigegebenen Wortlaut mit den Angaben aus ANBIETER; Ziffer 11 nur für die iPhone-App; 55 Absätze", () => {
    const z11 = absaetze(MD).find((a) => a.startsWith("1.1 "))!;
    expect(z11.startsWith(`1.1 Diese Bedingungen gelten für die Nutzung der App „${MARKE.name}“ für iPhone und Android (im Folgenden „App“) von ${ANBIETER.name}, ${ANBIETER.anschrift}, vertreten durch ${ANBIETER.vertretung}, Registergericht und Registernummer: `)).toBe(true);
    expect(z11.endsWith(`E-Mail: ${ANBIETER.email} (im Folgenden „wir“).`)).toBe(true);
    expect(MD).toContain("## 11. Apple (nur iPhone-App)");
    expect(absaetze(MD).length).toBe(55);
    // Google-Teile des Rechtsanwalts
    for (const s of ["nicht Apple oder Google", "Familienmediathek", "Google Commerce Limited", "„Zahlungen und Abos“ › „Abos“", "Ein Abo gilt nur auf der Plattform, auf der du es abgeschlossen hast.", "wir veranlassen die Erstattung über Google Play", "in einem Ordner bei einem Cloud-Anbieter"]) expect(MD).toContain(s);
  });

  it("die Android-Liste von E-190 ist ersetzt; keine Namen von Prüfern, keine Mail im Dokument", () => {
    expect(lies("docs/nutzungsbedingungen-android-entwurf.md")).toMatch(/Ersetzt durch die gemeinsame Fassung/);
    expect(MD).not.toMatch(/^(Betreff|Von|An):/m);
    expect(MD).not.toMatch(/Dr\.\s/);
  });
});

describe("E-205: in Kraft erst nach der Eintragung – dann erneute Zustimmung", () => {
  it("heute nicht in Kraft: Platzhalter statt Fassungsdatum, keine Zustimmung beim Start", () => {
    expect(NUTZUNGSBEDINGUNGEN.freigegeben).toBe(false);
    expect(NUTZUNGSBEDINGUNGEN.fassung).toBe("");
    expect(MD).toMatch(/^Fassung vom \[Datum der Veröffentlichung\]$/m);
    expect(MD).toContain("i. G.");
    expect(zustimmungNoetig(undefined)).toBe(false);
    expect(zustimmungNoetig({ fassung: "2026-10-23", zeitpunkt: "2026-10-24T08:00:00.000Z" })).toBe(false);
  });

  it("neue Fassung (neues Datum) fragt erneut – auch wer der iPhone-Fassung vom 23.10.2026 zugestimmt hat", () => {
    const inKraft = { ...NUTZUNGSBEDINGUNGEN, freigegeben: true, fassung: "2027-01-15" };
    const alt = { fassung: "2026-10-23", zeitpunkt: "2026-10-24T08:00:00.000Z" };
    expect(zustimmungNoetig(alt, inKraft)).toBe(true);
    expect(zustimmungNoetig(undefined, inKraft)).toBe(true);
    // nach der Zustimmung (gespeichert, neu geladen) nicht mehr – bis zur nächsten Fassung
    const neu = { fassung: inKraft.fassung, zeitpunkt: "2027-01-16T07:30:00.000Z" };
    const geladen = standAus(JSON.stringify({ ...LEERER_STAND, nutzungsbedingungen: neu })).nutzungsbedingungen;
    expect(geladen).toEqual(neu);
    expect(zustimmungNoetig(geladen, inKraft)).toBe(false);
    expect(zustimmungNoetig(geladen, { ...inKraft, fassung: "2027-06-01" })).toBe(true);
    // eine Zustimmung ohne gültiges Fassungsdatum zählt nicht
    expect(zustimmungAus({ fassung: "", zeitpunkt: neu.zeitpunkt })).toBeUndefined();
  });

  it("Website-Build: Entwurf mit Platzhalter, Hinweis nur zur iPhone-App, kein Arbeitsvermerk", () => {
    const aus = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "web-"));
    execFileSync("node", [path.join(WURZEL, "apps/website/bauen.mjs"), aus, "--entwurf"], { stdio: "pipe" });
    const nb = fs.readFileSync(path.join(aus, "nutzungsbedingungen.html"), "utf8");
    expect(nb).toContain("Entwurf – noch nicht in Kraft. Bis dahin gilt für die iPhone-App der");
    expect(nb).toContain("Fassung vom [Datum der Veröffentlichung]");
    expect(nb).toContain("<h2>11. Apple (nur iPhone-App)</h2>");
    expect(nb).not.toContain("Inkraftsetzung");
    expect(nb).not.toContain("NUTZUNGSBEDINGUNGEN");
    expect(nb).toContain('<meta name="robots" content="noindex">');
  });
});

describe("E-205: App", () => {
  it("Link „Nutzungsbedingungen“: Android die gemeinsame Seite, iPhone bis zur Inkraftsetzung Apples EULA, danach beide dieselbe Seite", () => {
    expect(nutzungsLink(NUTZUNGSBEDINGUNGEN, true)).toBe(`${MARKE.website}/nutzungsbedingungen.html`);
    expect(nutzungsLink(NUTZUNGSBEDINGUNGEN, false)).toBe(LINKS.nutzung);
    const inKraft = { ...NUTZUNGSBEDINGUNGEN, freigegeben: true, fassung: "2027-01-15" };
    expect(nutzungsLink(inKraft, false)).toBe(nutzungsLink(inKraft, true));
  });

  it("„Abo verwalten“: Google Play mit dem Paket aus app.json, App Store mit der Abo-Seite", () => {
    const app = JSON.parse(lies("apps/mobile/app.json")).expo;
    expect(aboVerwaltenLink(true)).toBe(`https://play.google.com/store/account/subscriptions?package=${app.android.package}`);
    expect(aboVerwaltenLink(false)).toBe("https://apps.apple.com/account/subscriptions");
    const recht = lies("apps/mobile/src/seiten/Recht.tsx");
    expect(recht).toMatch(/TEXT\.abo_verwalten,[^\n]*aboVerwaltenLink\(\)/);
  });

  it("Bezahlschirm Android: Preis mit Zeitraum, Testende, automatische Verlängerung und Kündigungsweg ohne weiteren Schritt", async () => {
    vi.stubEnv("EXPO_OS", "android");
    vi.resetModules();
    const { T } = await import("../src/texte");
    const { preisZeile } = await import("../src/pro/bezahltext");
    expect(preisZeile({ preis: "49,99 €", zeitraum: "jährlich", je: "pro Jahr", test: "14 Tage" })).toBe("14 Tage kostenlos, danach 49,99 € pro Jahr");
    expect(T.pro_kuendbar).toMatch(/Verlängert sich automatisch/);
    expect(T.pro_abo_text).toContain("Google Play unter „Zahlungen und Abos“ › „Abos“");
    expect(T.abo_verwalten_text).toMatch(/Google Play/);
    // die Zeile über dem Kaufknopf steht direkt im Fuß des Bezahlschirms (kein Aufklappen)
    expect(lies("apps/mobile/src/seiten/Pro.tsx")).toMatch(/preisZeile\(gewaehlt\)[\s\S]{0,200}TEXT\.pro_kuendbar/);
  });
});
