/**
 * E-188 (Modell Check-Teaser, ersetzt E-156): kostenlos nur das Ausprobieren des Pflichten-Checks – Zahl der Pflichten
 * und die ersten 3 mit Termin und Abhaken. Alles Weitere mit Pro: Rechnungen, E-Rechnung, Belege, Kasse, alle
 * Pflichten mit Erinnerungen, Steuerpaket, Vorlagen, Kontrollmappe, Pflicht-Details, Briefkopf, iCloud, Sync. Ein Ende
 * von Pro sperrt nie eigene Daten: erneut teilen, Storno, vorhandene Entwürfe, Belege, Kassenbuch, Sicherung, Export.
 */
import { describe, expect, it, vi } from "vitest";
import { T as TEXT } from "../src/texte";
import { auswertung, dringlichkeit, type Profil } from "../src/pflichten/check";
import { PFLICHTEN_FREI, PFLICHT_PRO_TEILE, PRO_VORTEILE, ausgabeErlaubt, eRechnungErlaubt, erinnerungenAbgleichen, erinnerungenAktiv, erstellenErlaubt, freiePflichten, kontrollmappeErlaubt, pflichtAnsicht, pflichtSichtbar, type ProFunktion } from "../src/pro/regeln";
import { LEERER_STAND, anlegen, ausgeben, erledigtSetzen, felderSetzen, korrigieren, standAus, stornieren, unterlageVereinen, type Stand } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const RECHNUNG = { kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3\n80333 München", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis: "30", satz: "19" }] };
const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", inhaber: "Alex Muster", steuernummer: "143/123/45678" };
const CAFE: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "kasse.elektronisch": true, "ust.kleinunternehmer": false, gruendungsdatum: "2022-03-01", "ifsg.beschaeftigte": "erstmals" };

function rechnung(s: Stand, id: string, tag: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(tag), id);
  return ausgeben(felderSetzen(s1, id, RECHNUNG, t(tag)), id, t(tag));
}
function vorlage(s: Stand, id: string, tag: string, art = "hygieneplan", teilen = true): Stand {
  const [s1] = anlegen(s, art, t(tag), id);
  return teilen ? ausgeben(s1, id, t(tag)) : s1;
}
const u = (s: Stand, id: string) => s.unterlagen.find((x) => x.id === id)!;

describe("Pflichten-Check ohne Pro: Zahl und die ersten 3 Pflichten (E-188)", () => {
  const a = auswertung(CAFE, "2026-10-13");
  const frei = freiePflichten(a, B, "2026-10-13");

  it("genau 3 freie Pflichten – die dringendsten wie im Überblick, der Rest nur als Zahl", () => {
    expect(PFLICHTEN_FREI).toBe(3);
    expect(a.gilt.length).toBeGreaterThan(10);
    expect(frei.size).toBe(3);
    const d = dringlichkeit(a, { erledigt: {}, unterlagen: [], betrieb: B }, "2026-10-13");
    expect([...frei]).toEqual([...d.jetzt, ...d.naechsteWochen, ...d.imBlick.filter((p) => p.einordnung === "pflicht")].slice(0, 3).map((p) => p.id));
    for (const p of a.gilt) expect(pflichtSichtbar(p.id, false, frei)).toBe(frei.has(p.id));
    for (const p of a.gilt) expect(pflichtSichtbar(p.id, true, frei)).toBe(true);
  });

  it("Abhaken verschiebt die Auswahl nicht – es rückt keine vierte Pflicht nach", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B, profil: CAFE };
    for (const id of frei) s = erledigtSetzen(s, id, "2026-10-13");
    expect([...freiePflichten(a, s.betrieb, "2026-10-13")]).toEqual([...frei]);
  });

  it("die Texte sind ehrlich: nur die Zahl der übrigen Pflichten, kein Titel", () => {
    expect(TEXT.pflichten_gesperrt(38)).toBe("… und 38 weitere Pflichten");
    expect(TEXT.pflichten_gesperrt(1)).toBe("… und 1 weitere Pflicht");
    expect(TEXT.pro_grund.pflichten(0)).toMatch(/ersten 3 Pflichten/);
  });
});

describe("Neues nur mit Pro (E-188)", () => {
  it("keine neue Rechnung, Vorlage, kein Beleg, keine Kasse ohne Pro – mit Pro alles", () => {
    expect(erstellenErlaubt(false)).toBe(false);
    expect(erstellenErlaubt(true)).toBe(true);
    const [s1, neu] = anlegen({ ...LEERER_STAND, betrieb: B }, "rechnung", t("2026-10-05"), "r");
    const [, vorl] = anlegen(s1, "unterweisung", t("2026-10-05"), "v");
    expect(ausgabeErlaubt(neu, false)).toBe(false);
    expect(ausgabeErlaubt(vorl, false)).toBe(false);
    expect(ausgabeErlaubt(neu, true)).toBe(true);
  });

  it("vorhandene Entwürfe bleiben ausfüllbar und gespeichert – ohne Pro geht nichts verloren", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = vorlage(s, "frei", "2026-10-02");
    const [s1] = anlegen(s, "allergene", t("2026-10-05"), "entwurf");
    const s2 = felderSetzen(s1, "entwurf", { betrieb: "Café" }, t("2026-10-05"));
    expect(u(s2, "entwurf").daten.betrieb).toBe("Café");
    expect(standAus(JSON.stringify(s2)).unterlagen.map((x) => x.id).sort()).toEqual(["entwurf", "frei"]);
  });
});

describe("Pro sperrt nie eigene Daten (GoBD, App Review 3.1)", () => {
  it("eine ausgegebene Rechnung lässt sich nach dem Ende von Pro erneut teilen und stornieren – das Storno teilen eingeschlossen", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = rechnung(s, "r", "2026-10-02");
    expect(ausgabeErlaubt(u(s, "r"), false)).toBe(true);
    const [s2, st] = stornieren(s, "r", t("2026-10-04"), "st");
    expect(st).not.toBeNull();
    expect(ausgabeErlaubt(st!, false)).toBe(true);
    expect(u(s2, "r").storniertDurch).toBe("st");
  });

  it("eine einmal ausgegebene Vorlage lässt sich immer wieder teilen – auch nach dem Ende von Pro und als Korrektur", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    for (const id of ["a", "b", "c"]) s = vorlage(s, id, "2026-10-03", "arbeitszeitnachweis");
    for (const id of ["a", "b", "c"]) expect(ausgabeErlaubt(u(s, id), false)).toBe(true);
    const k = korrigieren(s, "a", "Stunden nachgetragen", t("2026-10-21"));
    expect(u(k, "a").fassungen?.length).toBe(1);
    expect(ausgabeErlaubt(u(k, "a"), false)).toBe(true);
  });
});

describe("Erinnerungen per Mitteilung nur mit Pro", () => {
  const geraet = () => ({ planen: vi.fn(async (_p: string[]) => undefined), allesAbsagen: vi.fn(async () => undefined) });

  it("plant nur mit Pro und eingeschaltetem Schalter", async () => {
    const g = geraet();
    expect(await erinnerungenAbgleichen(true, true, ["t1"], g)).toBe("geplant");
    expect(g.planen).toHaveBeenCalledWith(["t1"]);
    const g2 = geraet();
    expect(await erinnerungenAbgleichen(true, false, ["t1"], g2)).toBe("abgesagt");
    expect(await erinnerungenAbgleichen(false, true, ["t1"], g2)).toBe("abgesagt");
    expect(g2.planen).not.toHaveBeenCalled();
    expect(g2.allesAbsagen).toHaveBeenCalledTimes(2);
  });

  it("endet Pro, werden geplante Mitteilungen abgesagt – der Schalter bleibt gespeichert, mit Pro wird neu geplant", async () => {
    const g = geraet();
    await erinnerungenAbgleichen(true, true, ["t1"], g);
    await erinnerungenAbgleichen(true, false, ["t1"], g);
    expect(g.allesAbsagen).toHaveBeenCalledTimes(1);
    expect(erinnerungenAktiv(true, false)).toBe(false);
    await erinnerungenAbgleichen(true, true, ["t2"], g);
    expect(g.planen).toHaveBeenLastCalledWith(["t2"]);
    // die Fristen selbst stehen ohne Pro in der App – die Auswertung kennt kein Pro
    const a = auswertung({ "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3 } as Profil, "2026-10-13");
    expect(a.gilt.some((p) => p.naechsterTermin)).toBe(true);
  });
});

describe("Pflicht-Details (E-156, in E-188 unverändert)", () => {
  const cafe: Profil = { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "SN", "beschaeftigte.gesamt": 2, "kasse.elektronisch": true, "ust.kleinunternehmer": false, gruendungsdatum: "2022-03-01", "ifsg.beschaeftigte": "erstmals" };
  const a = auswertung(cafe, "2026-10-13");

  it("ohne Pro der Überblick: Titel, Kurztext, Termin – Erklärung, Grund, Stelle, Folgen, Grundlage, Quellen und Vorlagen leer", () => {
    const p = a.gilt.find((x) => x.rechtsgrundlage.length && x.quellen.length && x.erklaerung)!;
    const frei = pflichtAnsicht(p, false);
    expect(frei.titel).toBe(p.titel);
    expect(frei.kurz).toBe(p.kurz);
    expect(frei.naechsterTermin).toBe(p.naechsterTermin);
    expect(frei.teaser).toBe(true);
    for (const k of PFLICHT_PRO_TEILE) {
      const w = frei[k];
      expect(Array.isArray(w) ? w.length : w ? 1 : 0).toBe(0);
    }
    expect(frei.vorlage).toBe(p.vorlage);
    const pro = pflichtAnsicht(p, true);
    expect(pro.erklaerung).toBe(p.erklaerung);
    expect(pro.rechtsgrundlage).toEqual(p.rechtsgrundlage);
    expect(pro.teaser).toBe(false);
  });

  it("Folgen bei Versäumnis kommen aus dem Katalog, nur wenn fachlich erfasst", () => {
    const mit = a.gilt.filter((p) => p.sanktion);
    expect(mit.length).toBeGreaterThan(0);
    expect(mit.every((p) => !/noch nicht fachlich erfasst/.test(p.sanktion!))).toBe(true);
  });
});

describe("Kontrollmappe und E-Rechnung", () => {
  it("die Mappe braucht Pro – jede schon geteilte Unterlage darin bleibt einzeln teilbar", () => {
    expect(kontrollmappeErlaubt(false)).toBe(false);
    expect(kontrollmappeErlaubt(true)).toBe(true);
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = vorlage(s, "hyg", "2026-09-02");
    s = vorlage(s, "unt", "2026-10-02", "unterweisung");
    for (const id of ["hyg", "unt"]) expect(ausgabeErlaubt(u(s, id), false)).toBe(true);
  });

  it("E-Rechnung erstellen braucht Pro; einmal geteilt bleibt sie ohne Pro teilbar – auch nach Sicherung und Zusammenführen", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = rechnung(s, "r", "2026-10-02");
    expect(eRechnungErlaubt(u(s, "r"), false)).toBe(false);
    expect(eRechnungErlaubt(u(s, "r"), true)).toBe(true);
    s = ausgeben(s, "r", t("2026-10-03"), undefined, undefined, undefined, true);
    expect(u(s, "r").eRechnungGeteilt).toBe(t("2026-10-03").toISOString());
    expect(eRechnungErlaubt(u(s, "r"), false)).toBe(true);
    // bleibt beim Lesen erhalten und kommt beim Zusammenführen aus jeder Fassung
    expect(standAus(JSON.stringify(s)).unterlagen[0]!.eRechnungGeteilt).toBe(t("2026-10-03").toISOString());
    const ohne = { ...u(s, "r") };
    delete ohne.eRechnungGeteilt;
    expect(unterlageVereinen(ohne, u(s, "r")).eRechnungGeteilt).toBe(t("2026-10-03").toISOString());
    expect(unterlageVereinen(u(s, "r"), ohne).eRechnungGeteilt).toBe(t("2026-10-03").toISOString());
  });
});

describe("Bezahlschirm (E-188)", () => {
  it("der wiederkehrende Nutzen zuerst: Rechnungen, E-Rechnung, Belege, Kasse, alle Pflichten – Texte für jeden Anlass", () => {
    expect(PRO_VORTEILE).toEqual(["pflichten", "erinnerungen", "pflicht_details", "kontrollmappe", "pdf", "rechnungen", "e_rechnung", "belege", "kasse", "steuerberater", "briefkopf", "icloud", "sync"]);
    const alle: ProFunktion[] = [...PRO_VORTEILE, "ust_uebernahme"];
    for (const f of alle) {
      expect(TEXT.pro_grund[f](3).length).toBeGreaterThan(20);
      expect(TEXT.pro_vorteil[f].titel.length).toBeGreaterThan(3);
      expect(TEXT.pro_kachel[f].length).toBeGreaterThan(3);
      expect(TEXT.r12_pro_anlass[f](3)).toMatch(/Pro/);
    }
    expect(TEXT.pro_frei_bleibt).toMatch(/Pflichten-Check[\s\S]*ersten 3[\s\S]*erneut teilen[\s\S]*stornieren[\s\S]*Belege[\s\S]*Kassenbuch[\s\S]*Sicherung[\s\S]*Löschen/);
    expect(TEXT.pro_frei_bleibt).not.toMatch(/ohne Limit|3 Rechnungen|Vorlage als PDF/);
    expect(TEXT.pro_pflicht_teaser_titel).toBe("Mit Pro: Erklärung, Folgen, Schritte");
    // keine Beträge im Code – Preise kommen aus dem Store
    const texte = [...alle.map((f) => TEXT.pro_grund[f](3)), ...alle.map((f) => TEXT.pro_vorteil[f].text(3)), TEXT.pro_frei_bleibt, TEXT.pro_wert_text, TEXT.pro_check_text];
    expect(texte.join(" ")).not.toMatch(/\d+,\d\d\s*€/);
    expect(TEXT.pro_zeile_frei).toMatch(/Pflichten-Check kostenlos/);
  });
});
