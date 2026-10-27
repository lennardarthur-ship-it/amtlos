/**
 * E-229 (Steuerberater 27.10.2026, T-303) in der App: Beleg in fremder Währung mit dem tatsächlich gezahlten
 * Euro-Betrag laut Kontoauszug – EÜR-Übernahme, Kassenbuch (bar), Steuerberater-Paket (Fragen, LIESMICH mit
 * Kursdifferenz, Stapel nur Euro wie bestätigt) und Eingabe am Beleg.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { LEERER_STAND, belegSetzen, standAus, type Stand } from "../src/unterlagen/speicher";
import { euerUebernahme, steuerpaket } from "../src/unterlagen/steuerpaket";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (p: string) => readFileSync(path.join(hier, "../src", p), "utf8");
const t = (d: string) => new Date(`${d}T09:00:00Z`);
const SB = { kontenrahmen: "SKR03" as const, beraternummer: "1001", mandantennummer: "42" };
const BASIS: Stand = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "Elektro Brandt", rechtsform: "Einzelunternehmen", steuernummer: "231/100/40001" }, profil: { "ust.kleinunternehmer": false } };
const datei = (p: { zip: Uint8Array }, n: string) => strFromU8(unzipSync(p.zip)[n]!);
const USD: Beleg = { id: "bu", datum: "2026-10-05", lieferant: "Cloud Tools Inc.", nummer: "INV-1001", kategorie: "buero", steuer: [{ satz: 19, brutto_cent: 11006 }], vorsteuer: true, zahlung: "bank", bezahlt: "2026-10-12", erstellt: "2026-10-06T08:00:00.000Z", geaendert: "2026-10-06T08:00:00.000Z", fremd: { waehrung: "USD", steuer: [{ satz: 19, brutto_cent: 11900 }], ust: 1900, kurs: 1.0812, kurs_datum: "2026-10-01", gezahlt_eur_cent: 11180 } };

describe("E-229 (T-303): gezahlter Euro-Betrag in der App", () => {
  it("EÜR-Übernahme: Ausgabe 111,80 € − 17,57 € Vorsteuer (vorher 92,49 € aus dem umgerechneten Betrag)", () => {
    const s = belegSetzen(BASIS, USD, t("2026-10-06"));
    const e = euerUebernahme(s, "2026");
    expect(e.ausgaben.find((z) => z.kategorie === "Übrige unbeschränkt abziehbare Betriebsausgaben")!.betrag).toBe("94,23");
    expect(e.ausgaben.find((z) => z.kategorie === "Gezahlte Vorsteuerbeträge")!.betrag).toBe("17,57");
    expect(standAus(JSON.stringify(s)).belege[0]!.fremd!.gezahlt_eur_cent).toBe(11180);
  });

  it("Steuerberater-Paket: Stapel nur Euro (umgerechnet, E-232: Kursdifferenz als eigene Zeile), Frage und LIESMICH nennen gezahlten Betrag und Kursdifferenz", () => {
    const s = belegSetzen(BASIS, USD, t("2026-10-06"));
    const p = steuerpaket(s, { von: "2026-10-01", bis: "2026-10-31", name: "2026-10" }, SB, {}, "2026-11-01T10:00:00.000Z");
    expect(datei(p, "Buchungsliste_2026-10.csv")).toMatch(/05\.10\.2026;110,06;H;1610;4930;9;INV-1001;/);
    expect(datei(p, "Fragen_2026-10.txt")).toContain("Original 119,00 USD · Kurs 1 € = 1,0812 USD (01.10.2026) · gezahlt laut Kontoauszug 111,80 €");
    const l = datei(p, "LIESMICH.txt");
    expect(l).toContain("INV-1001: umgerechnet 110,06 €, gezahlt 111,80 € am 12.10.2026, Differenz 1,74 €");
    expect(l).toContain("die EÜR rechnet mit dem gezahlten Euro-Betrag (§ 11 Abs. 2 EStG)");
    // E-232 (Steuerberater 27.10.2026, T-331): Konto für Kursdifferenzen festgelegt – eigene Zeile im Stapel
    expect(l).not.toContain("kein Konto für Kursdifferenzen festgelegt");
    // ohne gezahlten Betrag kein Satz (bisherige Pakete unverändert)
    const ohne = steuerpaket(belegSetzen(BASIS, { ...USD, fremd: { ...USD.fremd!, gezahlt_eur_cent: null } }, t("2026-10-06")), { von: "2026-10-01", bis: "2026-10-31", name: "2026-10" }, SB, {}, "2026-11-01T10:00:00.000Z");
    expect(datei(ohne, "LIESMICH.txt")).not.toContain("gezahltem Euro-Betrag");
  });

  it("Eingabe am Beleg: Feld „Gezahlt in Euro (laut Kontoauszug)“ mit Kursdifferenz", () => {
    const b = lies("seiten/Belege.tsx");
    expect(b).toContain("{b.fremd ? <FremdGezahlt b={b} setze={setze} /> : null}");
    expect(b).toContain("gezahlt_eur_cent: x && x > 0 ? x : null");
    expect(lies("texte.ts")).toContain("e229_gezahlt_eur: \"Gezahlt in Euro (laut Kontoauszug)\"");
  });
});
