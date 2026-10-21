/**
 * E-156 (ersetzt E-154): umgekehrte Bezahlschranke. Kostenlos: Rechnungen ohne Limit, Storno, Pflichten-Überblick,
 * Fristen in der App, alle Vorlagen ausfüllen und ansehen, eine Vorlage je Monat als PDF, erneutes Teilen. Pro:
 * Vorlagen als PDF, Erinnerungen per Mitteilung, Kontrollmappe, Pflicht-Details, Steuerpaket, E-Rechnung erstellen.
 */
import { describe, expect, it, vi } from "vitest";
import { T as TEXT } from "../src/texte";
import { auswertung, type Profil } from "../src/pflichten/check";
import { PFLICHT_PRO_TEILE, PRO_VORTEILE, VORLAGEN_FREI_JE_MONAT, ausgabeErlaubt, eRechnungErlaubt, erinnerungenAbgleichen, erinnerungenAktiv, kontrollmappeErlaubt, pflichtAnsicht, uebrig, verbraucht, type ProFunktion } from "../src/pro/regeln";
import { LEERER_STAND, anlegen, ausgeben, felderSetzen, korrigieren, standAus, stornieren, unterlageVereinen, type Stand } from "../src/unterlagen/speicher";

const t = (d: string) => new Date(`${d}T09:00:00Z`);
const RECHNUNG = { kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3\n80333 München", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis: "30", satz: "19" }] };
const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", inhaber: "Alex Muster", steuernummer: "143/123/45678" };

function rechnung(s: Stand, id: string, tag: string): Stand {
  const [s1] = anlegen(s, "rechnung", t(tag), id);
  return ausgeben(felderSetzen(s1, id, RECHNUNG, t(tag)), id, t(tag));
}
function vorlage(s: Stand, id: string, tag: string, art = "hygieneplan", teilen = true): Stand {
  const [s1] = anlegen(s, art, t(tag), id);
  return teilen ? ausgeben(s1, id, t(tag)) : s1;
}
const u = (s: Stand, id: string) => s.unterlagen.find((x) => x.id === id)!;

describe("Rechnungen sind kostenlos ohne Limit (E-156)", () => {
  it("auch die 30. Rechnung im Monat geht ohne Pro hinaus und verbraucht keine freie Vorlage", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    for (let i = 0; i < 29; i++) s = rechnung(s, `r${i}`, "2026-10-05");
    const [s1, neu] = anlegen(s, "rechnung", t("2026-10-20"), "r29");
    expect(ausgabeErlaubt(s1.unterlagen, neu, false, t("2026-10-20"))).toBe(true);
    expect(verbraucht(s1.unterlagen, t("2026-10-20"))).toBe(0);
    expect(uebrig(s1.unterlagen, t("2026-10-20"))).toBe(VORLAGEN_FREI_JE_MONAT);
  });

  it("Storno ist frei – auch wenn die freie Vorlage verbraucht ist", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = rechnung(s, "r", "2026-10-02");
    s = vorlage(s, "h", "2026-10-03");
    const [s2, st] = stornieren(s, "r", t("2026-10-04"), "st");
    expect(st).not.toBeNull();
    expect(ausgabeErlaubt(s2.unterlagen, st!, false, t("2026-10-04"))).toBe(true);
    // ein Storno einer Vorlage (falls je) zählte ebenfalls nie
    expect(verbraucht(ausgeben(s2, "st", t("2026-10-04")).unterlagen, t("2026-10-20"))).toBe(1);
  });
});

describe("Eine Vorlage je Kalendermonat als PDF (E-156)", () => {
  it("die erste Vorlage ist frei, die zweite braucht Pro, im nächsten Monat ist wieder eine frei", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    const [s1, erste] = anlegen(s, "unterweisung", t("2026-10-02"), "a");
    expect(ausgabeErlaubt(s1.unterlagen, erste, false, t("2026-10-02"))).toBe(true);
    s = ausgeben(s1, "a", t("2026-10-02"));
    const [s2, zweite] = anlegen(s, "gefaehrdungsbeurteilung", t("2026-10-10"), "b");
    expect(ausgabeErlaubt(s2.unterlagen, zweite, false, t("2026-10-10"))).toBe(false);
    expect(ausgabeErlaubt(s2.unterlagen, zweite, true, t("2026-10-10"))).toBe(true);
    // der Entwurf bleibt – im November ist er frei
    expect(ausgabeErlaubt(s2.unterlagen, zweite, false, t("2026-11-01"))).toBe(true);
    expect(TEXT.r12_pro_entwurf("November", VORLAGEN_FREI_JE_MONAT)).toBe("Als Entwurf behalten – am 1. November wieder 1 Vorlage frei");
  });

  it("Monatsgrenze nach deutscher Zeit: 1.11. 00:30 Uhr in Berlin zählt für November", () => {
    // 31.10.2026 23:30 UTC = 1.11. 00:30 Uhr MEZ; 31.10. 22:30 UTC = 31.10. 23:30 Uhr MEZ
    const nov = ausgeben(anlegen(LEERER_STAND, "hygieneplan", new Date("2026-10-31T23:30:00Z"), "n")[0], "n", new Date("2026-10-31T23:30:00Z"));
    expect(verbraucht(nov.unterlagen, new Date("2026-11-15T10:00:00Z"))).toBe(1);
    expect(verbraucht(nov.unterlagen, new Date("2026-10-31T12:00:00Z"))).toBe(0);
    expect(uebrig(nov.unterlagen, new Date("2026-10-31T22:59:00Z"))).toBe(1);
    expect(uebrig(nov.unterlagen, new Date("2026-10-31T23:00:00Z"))).toBe(0);
    const okt = ausgeben(anlegen(LEERER_STAND, "hygieneplan", new Date("2026-10-31T22:30:00Z"), "o")[0], "o", new Date("2026-10-31T22:30:00Z"));
    expect(verbraucht(okt.unterlagen, new Date("2026-10-31T22:45:00Z"))).toBe(1);
    expect(verbraucht(okt.unterlagen, new Date("2026-11-01T08:00:00Z"))).toBe(0);
  });
});

describe("Pro sperrt nie eigene Daten (GoBD, App Review 3.1)", () => {
  it("eine einmal ausgegebene Vorlage lässt sich immer wieder teilen – auch nach dem Ende von Pro und als Korrektur", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    // mit Pro drei Vorlagen geteilt, dann endet Pro
    for (const id of ["a", "b", "c"]) s = vorlage(s, id, "2026-10-03", "arbeitszeitnachweis");
    for (const id of ["a", "b", "c"]) expect(ausgabeErlaubt(s.unterlagen, u(s, id), false, t("2026-10-20"))).toBe(true);
    // Korrektur eines festgeschriebenen Nachweises bleibt frei teilbar (eigene Unterlage, keine neue Vorlage)
    const k = korrigieren(s, "a", "Stunden nachgetragen", t("2026-10-21"));
    expect(u(k, "a").fassungen?.length).toBe(1);
    expect(ausgabeErlaubt(k.unterlagen, u(k, "a"), false, t("2026-10-21"))).toBe(true);
  });

  it("Entwürfe bleiben ausfüllbar und gespeichert – ohne Pro geht nichts verloren", () => {
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = vorlage(s, "frei", "2026-10-02");
    const [s1] = anlegen(s, "allergene", t("2026-10-05"), "entwurf");
    const s2 = felderSetzen(s1, "entwurf", { betrieb: "Café" }, t("2026-10-05"));
    expect(u(s2, "entwurf").daten.betrieb).toBe("Café");
    const zurueck = standAus(JSON.stringify(s2));
    expect(zurueck.unterlagen.map((x) => x.id).sort()).toEqual(["entwurf", "frei"]);
  });
});

describe("Erinnerungen per Mitteilung nur mit Pro (E-156)", () => {
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

describe("Pflicht-Details (E-156)", () => {
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

describe("Kontrollmappe und E-Rechnung (E-156)", () => {
  it("die Mappe braucht Pro – jede Unterlage darin bleibt einzeln teilbar", () => {
    expect(kontrollmappeErlaubt(false)).toBe(false);
    expect(kontrollmappeErlaubt(true)).toBe(true);
    let s: Stand = { ...LEERER_STAND, betrieb: B };
    s = vorlage(s, "hyg", "2026-09-02");
    s = vorlage(s, "unt", "2026-10-02", "unterweisung");
    for (const id of ["hyg", "unt"]) expect(ausgabeErlaubt(s.unterlagen, u(s, id), false, t("2026-10-21"))).toBe(true);
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

describe("Bezahlschirm (E-156)", () => {
  it("„Pflichten erfüllen, Kontrollen bestehen“: Vorlagen als PDF, Erinnerungen und Kontrollmappe zuerst – Texte für jeden Anlass", () => {
    expect(PRO_VORTEILE.slice(0, 4)).toEqual(["pdf", "erinnerungen", "kontrollmappe", "pflicht_details"]);
    const alle: ProFunktion[] = [...PRO_VORTEILE, "ust_uebernahme"];
    for (const f of alle) {
      expect(TEXT.pro_grund[f](1).length).toBeGreaterThan(20);
      expect(TEXT.pro_vorteil[f].titel.length).toBeGreaterThan(3);
      expect(TEXT.pro_kachel[f].length).toBeGreaterThan(3);
      expect(TEXT.r12_pro_anlass[f](1)).toMatch(/Pro/);
    }
    expect(TEXT.r12_pro_anlass.pdf(1)).toBe("Vorlage 2 diesen Monat – mit Pro ohne Limit");
    expect(TEXT.pro_frei_bleibt).toMatch(/Rechnungen[\s\S]*Belege[\s\S]*Kasse[\s\S]*Pflichten-Check[\s\S]*Sicherung/);
    expect(TEXT.pro_pflicht_teaser_titel).toBe("Mit Pro: Erklärung, Folgen, Schritte");
    // keine Beträge im Code – Preise kommen aus dem Store
    const texte = [...alle.map((f) => TEXT.pro_grund[f](1)), ...alle.map((f) => TEXT.pro_vorteil[f].text(1)), TEXT.pro_frei_bleibt, TEXT.pro_wert_text];
    expect(texte.join(" ")).not.toMatch(/\d+,\d\d\s*€/);
    expect(TEXT.pro_rest(1, 1)).toMatch(/1 Vorlage/);
    expect(TEXT.pro_rest(0, 1)).toMatch(/Entwürfe/);
  });
});
