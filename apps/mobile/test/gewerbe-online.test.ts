/** Gewerbe online anmelden – Schritt für Schritt: Felder des GewA 1, fehlende Angaben, Bundesland aus der PLZ, Portale, Abhaken. */
import { describe, expect, it } from "vitest";
import { MARKE } from "@amtlos/marke";
import katalog from "../src/pflichten/katalog.json";
import { T as TEXT } from "../src/texte";
import { LEERER_STAND, anlegen, betriebSetzen, felderSetzen, type Stand } from "../src/unterlagen/speicher";
import { ERLAUBNIS_PFLICHTEN, FRAGEBOGEN_PFLICHT, GEWERBE_PFLICHT, GEWERBE_VORLAGE, anmeldetagGueltig, bedarf, datenblattVon, fehlende, fehltText, geltendeErlaubnisse, gewerbeErledigt, gewerbeFelder, nameTeilen, wegFuer } from "../src/gewerbe/felder";
import { ALLE_PORTALE, BUNDESPORTAL, ERLAUBTE_HOSTS, LANDESPORTALE, landErmitteln, portalFuer, portalUrl } from "../src/gewerbe/portale";

const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", strasse: "Gönninger Straße 5", plz: "72770", ort: "Reutlingen", verantwortlich: "Lea Marie Sommer", telefon: "07121 1234", email: "lea@example.de" };
const DATEN = { name: "Lea Marie Sommer", geburtsdatum: "1990-04-12", geburtsort: "Tübingen, Deutschland", staatsangehoerigkeit: "deutsch", wohnanschrift: "Lindenweg 2\n72770 Reutlingen", taetigkeit: "Friseurhandwerk und\nVerkauf von Haarpflegeprodukten", beginn: "2026-11-01", erwerb: "haupt", beschaeftigte: "keine" };
const t = (d: string) => new Date(`${d}T09:00:00Z`);

function mitDatenblatt(daten: Record<string, unknown> = DATEN, betrieb = B): Stand {
  const [s] = anlegen(betriebSetzen(LEERER_STAND, betrieb), GEWERBE_VORLAGE, t("2026-10-20"), "g1");
  return felderSetzen(s, "g1", daten as never, t("2026-10-20"));
}

describe("Felder des GewA 1", () => {
  it("Einzelunternehmen: Werte aus Datenblatt und Betrieb in der Reihenfolge des Vordrucks", () => {
    const s = mitDatenblatt();
    const l = gewerbeFelder({ daten: datenblattVon(s)!.daten, betrieb: s.betrieb, profil: {} });
    const nr = l.map((x) => x.nr ?? 0);
    expect(nr).toEqual([...nr].sort((a, b) => a - b));
    const w = Object.fromEntries(l.map((x) => [x.id, x.wert]));
    expect(w).toMatchObject({ rechtsform: "Einzelunternehmen", geschaeft: "Salon Sonne", name: "Sommer", vornamen: "Lea Marie", geburtsdatum: "12.04.1990", wohnanschrift: "Lindenweg 2, 72770 Reutlingen", betriebsstaette: "Gönninger Straße 5, 72770 Reutlingen", kontakt: "07121 1234, lea@example.de", taetigkeit: "Friseurhandwerk und Verkauf von Haarpflegeprodukten", erwerb: "Nein, Haupterwerb", beginn: "01.11.2026", beschaeftigte: "keine" });
    // Feldnummern wie im amtlichen Vordruck (Anlage 1 GewAnzV)
    const n = Object.fromEntries(l.map((x) => [x.id, x.nr]));
    expect(n).toMatchObject({ geschaeft: 3, name: 4, vornamen: 5, geschlecht: 6, geburtsdatum: 8, geburtsort: 9, staatsangehoerigkeit: 10, wohnanschrift: 11, betriebsstaette: 15, taetigkeit: 18, erwerb: 19, beginn: 20, art: 21, beschaeftigte: 22, niederlassung: 23, grund: 25, erlaubnis: 28 });
    // kein Register beim Einzelunternehmen, keine Pflichtangabe fehlt
    expect(l.some((x) => x.id === "registername" || x.id === "register" || x.id === "vertretung")).toBe(false);
    expect(fehlende(l)).toEqual([]);
    expect(l.find((x) => x.id === "geschlecht")!.status).toBe("portal");
  });
  it("GmbH in Gründung: eingetragener Name, Register entfällt, Geschäftsführung aus „Mein Betrieb“", () => {
    const betrieb = { ...B, name: "Sonne Haar GmbH", rechtsform: "GmbH", vertretung: "Lea Sommer" };
    const s = mitDatenblatt({ ...DATEN, rechtsform: "GmbH" }, betrieb);
    const l = gewerbeFelder({ daten: datenblattVon(s)!.daten, betrieb, profil: { "gesellschaft.handelsregister": "in_gruendung" } });
    const f = (id: string) => l.find((x) => x.id === id)!;
    expect(f("registername")).toMatchObject({ nr: 1, wert: "Sonne Haar GmbH", status: "ok" });
    expect(f("register")).toMatchObject({ nr: 2, status: "entfaellt" });
    expect(f("vertretung")).toMatchObject({ nr: 12, wert: "Lea Sommer" });
    expect(l.some((x) => x.id === "geschaeft")).toBe(false);
  });
  it("Rechtsform und Erwerb ohne Datenblatt aus dem Check", () => {
    const l = gewerbeFelder({ betrieb: B, profil: { rechtsform: "ug", erwerb: "neben" } });
    expect(l.find((x) => x.id === "rechtsform")!.wert).toBe("UG (haftungsbeschränkt)");
    expect(l.find((x) => x.id === "erwerb")!.wert).toBe("Ja, Nebenerwerb");
  });
  it("Handwerk Anlage A: Handwerkskarte als Pflichtangabe (Feld 29)", () => {
    const l = gewerbeFelder({ daten: DATEN, betrieb: B, profil: { "handwerk.anlage": "a" } });
    expect(l.find((x) => x.id === "art")).toMatchObject({ wert: "Handwerk", status: "ok" });
    expect(l.find((x) => x.id === "erlaubnis")).toMatchObject({ nr: 29, label: "Handwerkskarte", status: "fehlt", ergaenzen: "datenblatt" });
  });
  it("Namen teilen: letztes Wort ist der Nachname", () => {
    expect(nameTeilen("  Lea  Marie Sommer ")).toEqual({ name: "Sommer", vornamen: "Lea Marie" });
    expect(nameTeilen("Sommer")).toEqual({ name: "Sommer", vornamen: "" });
  });
});

describe("Fehlende Angaben", () => {
  it("leeres Datenblatt: Pflichtangaben „fehlt – im Datenblatt ergänzen“ mit Sprung zum Feld", () => {
    const l = gewerbeFelder({ daten: {}, betrieb: { ...B, strasse: "", plz: "", ort: "" }, profil: {} });
    const fehlt = fehlende(l);
    expect(fehlt.map((x) => x.id)).toEqual(expect.arrayContaining(["geburtsdatum", "geburtsort", "staatsangehoerigkeit", "wohnanschrift", "taetigkeit", "beginn", "betriebsstaette"]));
    const geb = fehlt.find((x) => x.id === "geburtsdatum")!;
    expect(geb).toMatchObject({ wert: null, ergaenzen: "datenblatt", datenblattFeld: "geburtsdatum" });
    expect(fehltText(geb)).toBe("fehlt – im Datenblatt ergänzen");
    expect(fehltText(fehlt.find((x) => x.id === "betriebsstaette")!)).toBe("fehlt – in „Mein Betrieb“ ergänzen");
    // freiwillige Angaben fehlen nicht, sie entfallen
    expect(l.find((x) => x.id === "geburtsname")!.status).toBe("entfaellt");
    // vorhandene Werte tragen keinen Ergänzen-Weg
    expect(l.filter((x) => x.status !== "fehlt").every((x) => x.ergaenzen === undefined)).toBe(true);
    expect(TEXT.go_fehlen(1)).toContain("1 Angabe fehlt");
  });
  it("Datenblatt: das jüngste nicht stornierte, auf Wunsch ein bestimmtes", () => {
    const s = mitDatenblatt();
    expect(datenblattVon(s)?.id).toBe("g1");
    expect(datenblattVon(s, "g1")?.id).toBe("g1");
    expect(datenblattVon(LEERER_STAND)).toBeUndefined();
  });
});

describe("Bundesland aus der PLZ", () => {
  it("72770 → Baden-Württemberg, service-bw mit PLZ", () => {
    expect(landErmitteln("72770")).toEqual({ land: "BW", herkunft: "plz", unsicher: false });
    const w = wegFuer(B, {});
    expect(w.portal.land).toBe("BW");
    expect(w.url).toBe("https://www.service-bw.de/zufi/leistungen/496?plz=72770");
    expect(w.gemeinde?.text).toContain("40 €");
  });
  it("eindeutige Regionen und genauere Bereiche", () => {
    expect(landErmitteln("10115").land).toBe("BE");
    expect(landErmitteln("80331").land).toBe("BY");
    expect(landErmitteln("44137").land).toBe("NW");
    expect(landErmitteln("68623").land).toBe("HE");
    expect(landErmitteln("89231").land).toBe("BY");
    expect(landErmitteln("14199").land).toBe("BE");
  });
  it("Grenzregion: Angabe aus „Mein Betrieb“ entscheidet, sonst unsicher", () => {
    expect(landErmitteln("88045")).toEqual({ land: "BW", herkunft: "plz", unsicher: true });
    expect(landErmitteln("88045", "Bayern")).toEqual({ land: "BY", herkunft: "plz_angabe", unsicher: false });
    // eine Angabe, die nicht zur PLZ passt, zählt nicht
    expect(landErmitteln("88045", "Berlin").unsicher).toBe(true);
    expect(landErmitteln("", undefined, "NW")).toEqual({ land: "NW", herkunft: "angabe", unsicher: false });
    expect(landErmitteln("abc")).toEqual({ land: null, herkunft: "keins", unsicher: false });
  });
  it("ohne geprüfte Landesadresse das Bundesportal", () => {
    expect(portalFuer("BY")).toBe(BUNDESPORTAL);
    expect(portalFuer(null)).toBe(BUNDESPORTAL);
    expect(wegFuer({ ...B, plz: "80331", ort: "München" }, {}).url).toBe(BUNDESPORTAL.url);
  });
});

describe("Portale", () => {
  it("jede Adresse https, auf erlaubtem Host, mit Quelle und Prüfdatum", () => {
    expect(ALLE_PORTALE.length).toBe(Object.keys(LANDESPORTALE).length + 1);
    for (const p of ALLE_PORTALE) {
      const u = new URL(portalUrl(p, "72770"));
      expect(u.protocol).toBe("https:");
      expect(ERLAUBTE_HOSTS as readonly string[]).toContain(u.host);
      expect(p.quelle.length).toBeGreaterThan(20);
      expect(p.quelleKurz.trim()).not.toBe("");
      expect(p.geprueftAm).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.geprueftAm <= "2026-10-21").toBe(true);
      expect(p.zugang.trim()).not.toBe("");
    }
  });
  it("ohne gültige PLZ fällt der PLZ-Teil weg", () => {
    expect(portalUrl(LANDESPORTALE.BW!, "")).toBe("https://www.service-bw.de/zufi/leistungen/496");
    expect(portalUrl(LANDESPORTALE.BW!, "7277")).not.toContain("{plz}");
  });
  it("„Das brauchst du“: Register bei UG/GmbH, Gebühr je nach Gemeinde, Erlaubnisse nur nach dem Check", () => {
    const bw = wegFuer(B, {});
    const eu = bedarf(bw, "Einzelunternehmen");
    expect(eu.map((x) => x.id)).toEqual(["zugang", "ausweis", "gebuehr"]);
    expect(eu[0]!.text).toContain("Servicekonto BW");
    expect(eu.find((x) => x.id === "gebuehr")!.text).toContain("Reutlingen");
    const gmbh = bedarf(bw, "GmbH", "", ["gruendung.handwerksrolle"]);
    expect(gmbh.map((x) => x.id)).toEqual(["zugang", "ausweis", "register", "gebuehr", "erlaubnis"]);
    expect(gmbh.find((x) => x.id === "register")!.text).toContain("Handelsregisterauszug");
    const berlin = bedarf(wegFuer({ ...B, plz: "10115", ort: "Berlin" }, {}), "Einzelunternehmen");
    expect(berlin.find((x) => x.id === "gebuehr")!.text).toBe("Online 15 €, nur mit Kreditkarte.");
    const muenchen = bedarf(wegFuer({ ...B, plz: "80331", ort: "München" }, {}), "Einzelunternehmen");
    expect(muenchen.find((x) => x.id === "gebuehr")!.text).toContain("je nach Gemeinde");
    expect(geltendeErlaubnisse([{ id: "x" }, { id: "gruendung.reisegewerbekarte" }, { id: "gruendung.erlaubnis_pruefen" }])).toEqual(["gruendung.erlaubnis_pruefen", "gruendung.reisegewerbekarte"]);
  });
  it("Katalog kennt alle verlinkten Pflichten; Hinweis mit der Marke", () => {
    const ids = new Set((katalog as { pflichten: { id: string }[] }).pflichten.map((p) => p.id));
    for (const id of [GEWERBE_PFLICHT, FRAGEBOGEN_PFLICHT, ...ERLAUBNIS_PFLICHTEN]) expect(ids.has(id)).toBe(true);
    expect(TEXT.go_nichts_uebermittelt).toBe(`${MARKE.name} übermittelt nichts an Behörden – du stellst den Antrag selbst im Portal.`);
  });
});

describe("Erledigt markieren", () => {
  it("mit dem Tag der Anmeldung abhaken – nicht in der Zukunft, nicht ungültig", () => {
    const s = mitDatenblatt();
    expect(gewerbeErledigt(s, "2026-10-21", "2026-10-21").erledigt[GEWERBE_PFLICHT]).toBe("2026-10-21");
    expect(gewerbeErledigt(s, "2026-10-01", "2026-10-21").erledigt[GEWERBE_PFLICHT]).toBe("2026-10-01");
    expect(gewerbeErledigt(s, "2026-10-22", "2026-10-21")).toBe(s);
    expect(gewerbeErledigt(s, "2026-02-30", "2026-10-21")).toBe(s);
    expect(anmeldetagGueltig(null, "2026-10-21")).toBe(false);
  });
});
