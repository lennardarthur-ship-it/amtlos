/**
 * E-216: Gründerentscheidungen vom 27.10.2026 zu T-268 und T-279.
 * T-268: `steuern.ust_voranmeldung` v8 – ein Satz zur Dauerfristverlängerung (Anregung des Steuerberaters), nur aus
 *        Wortlaut, der im bestätigten Katalog schon steht. Bis der Steuerberater v8 bestätigt, kein Vermerk (Mechanismus).
 * T-279: Der Kern-Check fragt in Gesundheit/Pflege und Kosmetik „Welche Daten über Menschen verarbeitest du?“ und – nur
 *        wenn der Datenschutzbeauftragte (v4) danach noch offen wäre – die bestehende Frage nach den Fällen des § 38 BDSG.
 *        Kein Katalogtext, kein Fragetext geändert.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KATALOG, auswertung, checkFragen, offeneKernFragen, type Profil } from "../src/pflichten/check";
import { pruefVermerk, type PruefungRoh } from "../src/pflichten/pruefer";

const WURZEL = path.resolve(__dirname, "../../..");
const AM = new Date(2026, 9, 27);
const heute = "2026-10-27";
type P = { id: string; version: number; erklaerung?: { de: string }; kurz?: { de: string }; aenderungsnotiz?: { de: string }; pruefung?: PruefungRoh };
const pflichten = KATALOG.pflichten as unknown as P[];
const pflicht = (id: string) => pflichten.find((p) => p.id === id)!;

/** genau der ergänzte Satz (steht so auch in PRUEFLISTE für den Steuerberater) */
export const SATZ_DFV =
  "Eine Dauerfristverlängerung bleibt möglich, auch wenn du als Neugründer monatlich abgibst: Die Voranmeldung ist dann einen Monat später fällig (§ 18 Abs. 1 UStG, §§ 46 ff. UStDV), und du zahlst einmal im Jahr eine Sondervorauszahlung – siehe „Sondervorauszahlung zur Umsatzsteuer leisten“.";

describe("T-268: Dauerfristverlängerung in der Umsatzsteuer-Voranmeldung (v8)", () => {
  const va = () => pflicht("steuern.ust_voranmeldung");
  it("v8 enthielt den Satz (E-217: seit v9 in der Fassung des Steuerberaters), mit Änderungsnotiz; der übrige Text von v7 bleibt", () => {
    // E-217: der Steuerberater hat den Satz korrigiert („auf Antrag“, § 18 Abs. 6 UStG, §§ 46 bis 48 UStDV) – v9
    expect(va().version).toBe(9);
    const e = va().erklaerung!.de;
    expect(e).toContain(SATZ_DFV.replace("bleibt möglich", "bleibt auf Antrag möglich").replace("§ 18 Abs. 1 UStG, §§ 46 ff. UStDV", "§ 18 Abs. 6 UStG, §§ 46 bis 48 UStDV"));
    expect(e).toContain("Hast du 2026 oder später gegründet, gibst du ab 2027 im Gründungsjahr und im Folgejahr monatlich ab (§ 18 Abs. 2 Satz 4 UStG).");
    expect(e.endsWith("Amtlos bereitet die Zahlen vor; du übermittelst selbst.") || e.endsWith(" bereitet die Zahlen vor; du übermittelst selbst.")).toBe(true);
    expect(va().aenderungsnotiz!.de).toMatch(/Dauerfristverlängerung/);
  });
  it("kein neuer Inhalt: jede Aussage steht schon im bestätigten Katalog (Neugründer-Radar, Sondervorauszahlung)", () => {
    const radar = pflicht("steuern.ust_va_neugruender_radar");
    const svz = pflicht("steuern.ust_sondervorauszahlung");
    expect(radar.erklaerung!.de).toContain("mit Dauerfristverlängerung einen Monat später (§ 18 Abs. 1 UStG, §§ 46 ff. UStDV)");
    expect(svz.kurz!.de).toContain("zahlst du einmal im Jahr eine Sondervorauszahlung");
    expect(svz.erklaerung!.de).toContain("Bei monatlicher Abgabe mit Dauerfristverlängerung zahlst du");
    // Verweis mit dem Titel des Eintrags (wie „siehe …“ in anderen Einträgen)
    expect(KATALOG.pflichten.some((p) => (p as unknown as { titel: { de: string } }).titel.de === "Sondervorauszahlung zur Umsatzsteuer leisten")).toBe(true);
    // beide Quellen-Einträge sind vom Steuerberater bestätigt
    for (const p of [radar, svz]) expect(pruefVermerk(p.version, p.pruefung, AM), p.id).toMatch(/Steuerberater/);
  });
  it("v8 wurde nie freigegeben (keine Eigenfreigabe); E-217: der Steuerberater hat v9 bestätigt", () => {
    expect(va().pruefung?.geprueft_version ?? null).toBe(9);
    expect(pruefVermerk(va().version, va().pruefung, AM)).toMatch(/Steuerberater/);
    const reg = fs.readFileSync(path.join(WURZEL, "docs/freigabe-katalog/freigaben.yaml"), "utf8");
    expect(reg).not.toMatch(/steuern\.ust_voranmeldung:\n\s+version: 8/);
  });
  it("PRUEFLISTE: Zeile für den Steuerberater mit genau diesem Satz; T-268 entschieden", () => {
    const liste = fs.readFileSync(path.join(WURZEL, "PRUEFLISTE.md"), "utf8");
    const zeile = liste.split("\n").find((z) => /^\| T-28[2-5] \|/.test(z) && z.includes("ust_voranmeldung"));
    expect(zeile).toBeDefined();
    expect(zeile).toContain(SATZ_DFV);
    expect(zeile).toMatch(/\| StB \| E-216 \|$/);
    expect(liste.split("\n").find((z) => z.startsWith("| T-268 |"))).toMatch(/Entschieden 27\.10\.2026 \(Gründer\).*E-216/);
  });
});

/** Kern-Check durchlaufen wie in der App (wie e212): jede gestellte Frage mit der Vorgabe, sonst Nein / 0 / „keine“ / erste Option. */
function durchlaufen(vorgabe: Profil): Profil {
  let p: Profil = {};
  for (let runde = 0; runde < 12; runde++) {
    let neu = false;
    for (const f of checkFragen(p)) {
      if (f.feld in p) continue;
      const opt = Object.keys(f.optionen ?? {});
      const keine = opt.find((o) => o.startsWith("keine"));
      p = { ...p, [f.feld]: f.feld in vorgabe ? vorgabe[f.feld]! : f.art === "janein" ? false : f.art === "zahl" || f.art === "betrag" ? 0 : f.art === "mehrfach" ? [keine ?? opt[0]!] : f.art === "auswahl" ? opt[0]! : null };
      neu = true;
    }
    if (!neu) break;
  }
  return p;
}
const felder = (p: Profil) => checkFragen(p).map((f) => f.feld);
const dsbOffen = (p: Profil) => auswertung(p, heute).unbekannt.some((x) => x.id === "datenschutz.dsb");
const dsbGilt = (p: Profil) => auswertung(p, heute).gilt.some((x) => x.id === "datenschutz.dsb");

const KOSMETIK: Profil = { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "NI", gruendungsdatum: "2023-01-01", "beschaeftigte.gesamt": 2, "ust.kleinunternehmer": true, "kunden.regionen": ["inland"] };
const PFLEGE: Profil = { "taetigkeit.branchen": ["gesundheit_pflege"], rechtsform: "gmbh", bundesland: "RP", gruendungsdatum: "2023-01-01", "beschaeftigte.gesamt": 15, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", "kunden.regionen": ["inland"] };
const MIT_GESUNDHEIT = { "datenverarbeitung.arten": ["kundendaten", "gesundheitsdaten"] };

describe("T-279: Kern-Check in Gesundheit/Pflege und Kosmetik fragt nach den Daten", () => {
  it.each([["Kosmetik", KOSMETIK], ["Pflegedienst", PFLEGE]] as const)("%s: „Welche Daten über Menschen verarbeitest du?“ im Kern-Check, Datenschutzbeauftragter danach nicht mehr offen", (_n, basis) => {
    const ohne = durchlaufen(basis);
    expect(felder(ohne)).toContain("datenverarbeitung.arten");
    // nur Kundendaten bzw. „Keine“: kein Fall des § 38 BDSG naheliegend – die Folgefrage entfällt, der Eintrag ist entschieden
    expect(felder(ohne)).not.toContain("datenschutz.dsb_gruende");
    expect(dsbOffen(ohne)).toBe(false);
    expect(dsbOffen(durchlaufen({ ...basis, "datenverarbeitung.arten": ["kundendaten"] }))).toBe(false);
    // Gesundheitsdaten: ohne die bestehende Folgefrage bliebe der Eintrag „hängt ab“ – deshalb fragt der Kern-Check sie dann
    const mit = durchlaufen({ ...basis, ...MIT_GESUNDHEIT });
    expect(felder(mit)).toContain("datenschutz.dsb_gruende");
    expect(felder(mit).indexOf("datenschutz.dsb_gruende")).toBe(felder(mit).indexOf("datenverarbeitung.arten") + 1);
    expect(dsbOffen(mit)).toBe(false);
    expect(dsbGilt(mit)).toBe(false);
    expect(dsbGilt(durchlaufen({ ...basis, ...MIT_GESUNDHEIT, "datenschutz.dsb_gruende": ["dsfa_pflichtig"] }))).toBe(true);
    // „Check fortsetzen“: beide Fragen gelten als beantwortet (Datumsfragen lässt der Durchlauf offen)
    for (const x of ["datenverarbeitung.arten", "datenschutz.dsb_gruende"]) expect(offeneKernFragen(mit)).not.toContain(x);
    expect(offeneKernFragen({ ...basis })).toContain("datenverarbeitung.arten");
  });
  it("Fragezahl: eine Frage mehr, bei Gesundheitsdaten, Video oder Ortung zwei", () => {
    // gemessen vor der Änderung (E-216): Kosmetik 27, Pflegedienst 24 Kernfragen (Durchlauf mit Nein/0/„keine“)
    expect(felder(durchlaufen(KOSMETIK))).toHaveLength(28);
    expect(felder(durchlaufen({ ...KOSMETIK, ...MIT_GESUNDHEIT }))).toHaveLength(29);
    expect(felder(durchlaufen(PFLEGE))).toHaveLength(25);
    expect(felder(durchlaufen({ ...PFLEGE, ...MIT_GESUNDHEIT }))).toHaveLength(26);
  });
  it("andere Branchen unverändert: Handwerk ohne Datenfrage; Coaching und Transport mit Datenfrage, aber ohne die Folgefrage", () => {
    const hw = durchlaufen({ ...KOSMETIK, "taetigkeit.branchen": ["handwerk"] });
    expect(felder(hw)).not.toContain("datenverarbeitung.arten");
    expect(felder(hw)).not.toContain("datenschutz.dsb_gruende");
    for (const b of ["unterricht_sport_coaching", "transport_logistik"]) {
      const f = felder(durchlaufen({ ...KOSMETIK, "taetigkeit.branchen": [b], ...MIT_GESUNDHEIT }));
      expect(f, b).toContain("datenverarbeitung.arten");
      expect(f, b).not.toContain("datenschutz.dsb_gruende");
    }
  });
});
