/**
 * E-209 (Befund 9 der externen Prüfung): Ein festgeschriebener Beleg bzw. eine festgeschriebene Unterlage darf bei
 * Synchronisation und Wiederherstellen nie still durch eine andere Fassung ersetzt werden; die Historie (Beleg-
 * `historie`, Unterlagen-`fassungen`) wird nur ergänzt, nie gekürzt (GoBD, Unveränderbarkeit § 146 Abs. 4 AO).
 * Abweichungen bleiben sichtbar (Konfliktliste bzw. Konfliktkopie).
 */
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { syncZusammenfuehren } from "../src/konto/sync";
import { LEERER_STAND, anlegen, ausgeben, belegSetzen, belegeFestschreiben, belegeVereinen, betriebSetzen, felderSetzen, korrigieren, zusammenfuehren, type Stand, type Unterlage } from "../src/unterlagen/speicher";

const t = (d: string, h = "09:00") => new Date(`${d}T${h}:00Z`);
const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", steuernummer: "143/123/45678" };
const GRUND = "Betrag laut Rechnung korrigiert";
const beleg = (id: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum: "2026-10-02", lieferant: "Friseurbedarf Müller", nummer: `L-${id}`, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: "2026-10-02T08:00:00Z", geaendert: "2026-10-02T08:00:00Z", ...o });

/** Gerät A: Beleg erfasst, festgeschrieben (Paket), dann mit Grund korrigiert – Historie mit einer Fassung. */
function festMitHistorie(): Stand {
  let s = belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02"));
  s = belegeFestschreiben(s, ["b1"], t("2026-10-05"));
  s = belegSetzen(s, { ...s.belege[0]!, steuer: [{ satz: 19, brutto_cent: 12900 }] }, t("2026-10-06"), GRUND);
  return s;
}

describe("E-209: festgeschriebener Beleg bei Synchronisation und Wiederherstellen", () => {
  it("Vorbedingung: lokal festgeschrieben mit Historie", () => {
    const b = festMitHistorie().belege[0]!;
    expect(b.festgeschrieben).toBe("2026-10-05T09:00:00.000Z");
    expect(b.historie).toHaveLength(1);
    expect(b.historie![0]!.grund).toBe(GRUND);
  });

  it("Sync: ein nicht festgeschriebener, später geänderter Stand desselben Belegs ersetzt ihn nicht", () => {
    const lokal = festMitHistorie();
    // anderes Gerät: kennt die Festschreibung nicht, hat den Entwurf später (Uhr vor) geändert
    const entfernt: Stand = { ...LEERER_STAND, belege: [beleg("b1", { lieferant: "Anderer Lieferant", steuer: [{ satz: 19, brutto_cent: 99900 }], geaendert: "2026-10-09T08:00:00Z", nr: lokal.belege[0]!.nr })] };
    const z = syncZusammenfuehren(lokal, entfernt);
    const b = z.stand.belege.find((x) => x.id === "b1")!;
    expect(b.festgeschrieben).toBe("2026-10-05T09:00:00.000Z");
    expect(b.steuer[0]!.brutto_cent).toBe(12900);
    expect(b.lieferant).toBe("Friseurbedarf Müller");
    expect(b.historie).toEqual(lokal.belege[0]!.historie);
    // sichtbar, nicht still
    expect(z.belegKonflikte).toEqual([lokal.belege[0]!.nr]);
    // auch umgekehrt (das andere Gerät führt zusammen)
    const umgekehrt = syncZusammenfuehren(entfernt, lokal).stand.belege.find((x) => x.id === "b1")!;
    expect(umgekehrt.festgeschrieben).toBe("2026-10-05T09:00:00.000Z");
    expect(umgekehrt.steuer[0]!.brutto_cent).toBe(12900);
    expect(umgekehrt.historie).toEqual(lokal.belege[0]!.historie);
  });

  it("Sync: ein älterer Entwurf (vor der Festschreibung) ist kein Konflikt und ändert nichts", () => {
    const lokal = festMitHistorie();
    const entfernt: Stand = { ...LEERER_STAND, belege: [beleg("b1", { nr: lokal.belege[0]!.nr })] };
    const z = syncZusammenfuehren(lokal, entfernt);
    expect(z.stand.belege[0]).toEqual(lokal.belege[0]);
    expect(z.belegKonflikte).toEqual([]);
  });

  it("Sync: ein Löschvermerk vom anderen Gerät entfernt keinen festgeschriebenen Beleg", () => {
    const lokal = festMitHistorie();
    const entfernt: Stand = { ...LEERER_STAND, geloescht: { "b:b1": "2026-12-01T00:00:00Z" } };
    expect(syncZusammenfuehren(lokal, entfernt).stand.belege.map((b) => b.id)).toEqual(["b1"]);
  });

  it("Sync: Historie wird nach Einträgen vereint, nie gekürzt – auch wenn die andere Seite neuer ist", () => {
    const lokal = festMitHistorie();
    // anderes Gerät: derselbe festgeschriebene Beleg, Historie fehlt dort (älterer Stand), aber später nur ungültig markiert
    const ohneHistorie = { ...lokal.belege[0]!, historie: undefined, geaendert: "2026-10-20T08:00:00Z" };
    const z = syncZusammenfuehren(lokal, { ...LEERER_STAND, belege: [ohneHistorie] });
    expect(z.stand.belege[0]!.historie).toEqual(lokal.belege[0]!.historie);
  });

  it("Sync: zwei verschiedene Korrekturen auf zwei Geräten – beide Fassungen bleiben in der Historie, Konflikt sichtbar, stabil", () => {
    let s = belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02"));
    s = belegeFestschreiben(s, ["b1"], t("2026-10-05"));
    const a = belegSetzen(s, { ...s.belege[0]!, steuer: [{ satz: 19, brutto_cent: 12900 }] }, t("2026-10-06"), GRUND);
    const b = belegSetzen(s, { ...s.belege[0]!, notiz: "Skonto vergessen" }, t("2026-10-07"), "Notiz zur Zahlung ergänzt");
    const z = syncZusammenfuehren(a, b);
    const r = z.stand.belege[0]!;
    expect(r.festgeschrieben).toBe("2026-10-05T09:00:00.000Z");
    // Original (beide Historien), und die nicht gewählte Korrektur – keine Fassung geht verloren
    const inhalte = [r, ...(r.historie ?? [])].map((x) => `${x.steuer[0]!.brutto_cent}|${x.notiz ?? ""}`);
    expect(inhalte).toEqual(expect.arrayContaining(["11900|", "12900|", "11900|Skonto vergessen"]));
    expect(z.belegKonflikte).toEqual([r.nr]);
    // beide Richtungen gleich, erneutes Zusammenführen ändert nichts mehr
    expect(syncZusammenfuehren(b, a).stand.belege[0]).toEqual(r);
    const nochmal = syncZusammenfuehren(z.stand, b);
    expect(nochmal.stand.belege[0]).toEqual(r);
    expect(nochmal.belegKonflikte).toEqual([]);
  });

  it("Sync: eine echte Korrektur (Historie enthält die alte Fassung) gilt ohne Konflikt", () => {
    let s = belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02"));
    s = belegeFestschreiben(s, ["b1"], t("2026-10-05"));
    const korrigiert = belegSetzen(s, { ...s.belege[0]!, steuer: [{ satz: 19, brutto_cent: 12900 }] }, t("2026-10-06"), GRUND);
    for (const z of [syncZusammenfuehren(s, korrigiert), syncZusammenfuehren(korrigiert, s)]) {
      expect(z.stand.belege[0]).toEqual(korrigiert.belege[0]);
      expect(z.belegKonflikte).toEqual([]);
    }
  });

  it("belegeVereinen (Sync und Wiederherstellen) ist für festgeschriebene Belege nicht mehr „neuer gewinnt“", () => {
    const fest = festMitHistorie().belege[0]!;
    const neuerEntwurf = { ...fest, festgeschrieben: null, historie: undefined, lieferant: "X", geaendert: "2027-01-01T00:00:00Z" };
    const m = belegeVereinen([fest], [neuerEntwurf]);
    expect(m.get("b1")!.festgeschrieben).toBe(fest.festgeschrieben);
    expect(m.get("b1")!.lieferant).toBe(fest.lieferant);
    expect(m.get("b1")!.historie).toEqual(fest.historie);
  });

  it("Wiederherstellen: eine Sicherung mit älterem/abweichendem Entwurf ersetzt den festgeschriebenen Beleg nicht", () => {
    const aktuell = festMitHistorie();
    const gesichert: Stand = { ...LEERER_STAND, belege: [beleg("b1", { lieferant: "Aus der Sicherung", geaendert: "2026-10-30T08:00:00Z", nr: aktuell.belege[0]!.nr })] };
    const z = zusammenfuehren(aktuell, gesichert);
    const b = z.stand.belege.find((x) => x.id === "b1")!;
    expect(b.festgeschrieben).toBe(aktuell.belege[0]!.festgeschrieben);
    expect(b.lieferant).toBe("Friseurbedarf Müller");
    expect(b.historie).toEqual(aktuell.belege[0]!.historie);
    expect(z.belegKonflikte).toEqual([aktuell.belege[0]!.nr]);
    expect(z.behalten).toBe(1);
    expect(z.aktualisiert).toBe(0);
  });

  it("Wiederherstellen: Historie aus der Sicherung kommt dazu, die des Geräts bleibt", () => {
    const aktuell = festMitHistorie();
    // Sicherung: derselbe Beleg, ältere Fassung ohne Korrektur, aber mit einem frühen Historien-Eintrag (Tippfehler vor der Festschreibung)
    const frueh = { bis: "2026-10-03T00:00:00.000Z", datum: "2026-10-02", lieferant: "Friseurbedarf Mueller", nummer: "L-b1", kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank" as const, bezahlt: null, notiz: null, datei: null };
    const gesichert: Stand = { ...LEERER_STAND, belege: [{ ...aktuell.belege[0]!, historie: [frueh], steuer: [{ satz: 19, brutto_cent: 11900 }], geaendert: "2026-10-05T09:00:00.000Z" }] };
    const b = zusammenfuehren(aktuell, gesichert).stand.belege[0]!;
    expect(b.historie).toHaveLength(2);
    expect(b.historie![0]!.lieferant).toBe("Friseurbedarf Mueller");
    expect(b.historie![1]!.grund).toBe(GRUND);
    expect(b.steuer[0]!.brutto_cent).toBe(12900);
  });
});

describe("E-209: festgeschriebene Unterlage (Rechnung, Nachweis) bei Synchronisation und Wiederherstellen", () => {
  const rechnung = () => {
    const basis = anlegen(betriebSetzen(LEERER_STAND, B), "rechnung", t("2026-10-01"), "r1")[0];
    return { basis, fest: ausgeben(basis, "r1", t("2026-10-02")) };
  };

  it("Entwurf (älter oder später geändert) ersetzt die festgeschriebene Rechnung nicht – Sync und Wiederherstellen", () => {
    const { basis, fest } = rechnung();
    const spaeter = felderSetzen(basis, "r1", { kunde_name: "Anders" }, t("2026-10-09"));
    for (const z of [syncZusammenfuehren(fest, spaeter).stand, syncZusammenfuehren(spaeter, fest).stand, zusammenfuehren(fest, spaeter).stand, zusammenfuehren(spaeter, fest).stand]) {
      const u = z.unterlagen.find((x) => x.id === "r1")!;
      expect(u.festgeschrieben).toBe(fest.unterlagen[0]!.festgeschrieben);
      expect(u.daten).toEqual(fest.unterlagen[0]!.daten);
    }
  });

  it("eine fremde Fassung mit mehr „fassungen“, die die festgeschriebene nicht enthält, verdrängt sie nicht still", () => {
    const { fest } = rechnung();
    const f = fest.unterlagen[0]!;
    // präparierte/abweichende Fassung: angeblich korrigiert, aber ihre Historie kennt die festgeschriebene Fassung nicht
    const fremd: Unterlage = { ...f, festgeschrieben: undefined, daten: { ...f.daten, kunde_name: "Fremd" }, geaendert: "2026-10-10T00:00:00Z", fassungen: [{ daten: { ...f.daten, kunde_name: "Ganz anders" }, festgeschrieben: "2026-09-01T00:00:00Z", ersetzt: "2026-10-10T00:00:00Z" }] };
    for (const z of [syncZusammenfuehren(fest, { ...LEERER_STAND, unterlagen: [fremd] }), zusammenfuehren(fest, { ...LEERER_STAND, unterlagen: [fremd] })]) {
      // die festgeschriebene Fassung bleibt vollständig erhalten (gültig oder als Konfliktkopie) und der Konflikt ist sichtbar
      const erhalten = z.stand.unterlagen.find((u) => u.festgeschrieben === f.festgeschrieben && JSON.stringify(u.daten) === JSON.stringify(f.daten)) ?? z.stand.unterlagen.flatMap((u) => u.fassungen ?? []).find((x) => x.festgeschrieben === f.festgeschrieben && JSON.stringify(x.daten) === JSON.stringify(f.daten));
      expect(erhalten).toBeTruthy();
      expect(z.festKonflikte.length).toBe(1);
    }
  });

  it("eine echte Korrektur (Fassung enthält die festgeschriebene) gilt ohne Konflikt; keine Fassung geht verloren", () => {
    let s = anlegen(betriebSetzen(LEERER_STAND, B), "arbeitszeitnachweis", t("2026-10-01"), "a1")[0];
    s = ausgeben(s, "a1", t("2026-10-02"));
    expect(s.unterlagen[0]!.festgeschrieben).toBeTruthy();
    const korr = korrigieren(s, "a1", "Pause nachgetragen", t("2026-10-03"));
    expect(korr.unterlagen[0]!.fassungen).toHaveLength(1);
    for (const z of [syncZusammenfuehren(s, korr), syncZusammenfuehren(korr, s), zusammenfuehren(s, korr)]) {
      expect(z.festKonflikte).toEqual([]);
      const u = z.stand.unterlagen.find((x) => x.id === "a1")!;
      expect(u.fassungen).toEqual(korr.unterlagen[0]!.fassungen);
    }
  });
});
