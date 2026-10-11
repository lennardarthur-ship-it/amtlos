import { describe, expect, it } from "vitest";
import type { Katalog } from "@amtlos/rules-engine";
import { ApiFehler, ApiKlient } from "../src/kern/api";
import type { Beschaeftigter, Brief, Checkliste, FinanzUebersicht, Gruendung, Rechnung, Termin, UstVa, Zeiten } from "../src/kern/typen";
import { demoAbruf } from "../src/demo/demo";
import katalogJson from "../src/demo/katalog.json";

const katalog = katalogJson as unknown as Katalog;
const JETZT = new Date("2026-10-12T10:00:00Z");

async function startklar(profil: Record<string, unknown> = { rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BE", gruendungsdatum: "2026-09-01" }) {
  const k = new ApiKlient({ basis: "https://demo", token: async () => "demo", unternehmen: () => "demo-unternehmen", sprache: () => "de", abruf: demoAbruf(katalog, () => JETZT) });
  await k.unternehmenAnlegen("Testbetrieb");
  await k.profilSpeichern(profil);
  return k;
}

describe("Demo: Finanzen", () => {
  it("Rechnung: fehlende Angaben werden benannt, danach gestellt mit Nummer, Summen und Umsatz", async () => {
    const k = await startklar();
    const entwurf = await k.schicken<Rechnung>("/v1/rechnungen", "POST", { positionen: [{ bezeichnung: "Beratung", menge: 2, einheit: "stunde", preis_cent: 10000, ust_art: "regel" }], leistungsdatum: "2026-10-01" });
    const fehlt = await k.schicken(`/v1/rechnungen/${entwurf.id}/stellen`, "POST").catch((e: unknown) => e);
    expect(fehlt).toBeInstanceOf(ApiFehler);
    expect((fehlt as ApiFehler).daten.fehlend).toEqual(["steller"]);

    await k.schicken("/v1/rechnungssteller", "PUT", { name: "Testbetrieb", strasse: "Weg 1", plz: "10115", ort: "Berlin", email: "a@b.de", steuernummer: "12/345/67890", telefon: "030 1", iban: "DE02120300000000202051" });
    const kunde = await k.schicken<{ id: string }>("/v1/kunden", "POST", { name: "Kunde GmbH", strasse: "Str. 2", plz: "20095", ort: "Hamburg", email: "k@k.de", geschaeftskunde: true });
    await k.schicken(`/v1/rechnungen/${entwurf.id}`, "PUT", { kunde_id: kunde.id, positionen: [{ bezeichnung: "Beratung", menge: 2, einheit: "stunde", preis_cent: 10000, ust_art: "regel" }], leistungsdatum: "2026-10-01" });
    const r = await k.schicken<Rechnung>(`/v1/rechnungen/${entwurf.id}/stellen`, "POST");
    expect(r.status).toBe("gestellt");
    expect(r.nummer).toBe("2026-0001");
    expect(r.netto_cent).toBe(20000);
    expect(r.ust_cent).toBe(3800); // Regelsatz aus dem Katalog (steuern.ust.satz_regel)
    expect((await k.holen<FinanzUebersicht>("/v1/finanzen/uebersicht")).umsatz_eur).toBe(200);

    const storno = await k.schicken<Rechnung>(`/v1/rechnungen/${r.id}/stornieren`, "POST");
    expect(storno.nummer).toBe("2026-0002");
    expect((await k.holen<FinanzUebersicht>("/v1/finanzen/uebersicht")).umsatz_eur).toBe(0);
  });

  it("USt-Voranmeldung: Umsatzsteuer aus Rechnungen minus Vorsteuer aus Belegen", async () => {
    const k = await startklar();
    await k.schicken("/v1/rechnungssteller", "PUT", { name: "T", strasse: "W 1", plz: "1", ort: "B", email: "a@b.de", steuernummer: "1" });
    const kunde = await k.schicken<{ id: string }>("/v1/kunden", "POST", { name: "Privat", strasse: "S", plz: "1", ort: "O", geschaeftskunde: false });
    const r = await k.schicken<Rechnung>("/v1/rechnungen", "POST", { kunde_id: kunde.id, leistungsdatum: "2026-10-02", positionen: [{ bezeichnung: "X", menge: 1, einheit: "stueck", preis_cent: 10000, ust_art: "regel" }] });
    await k.schicken(`/v1/rechnungen/${r.id}/stellen`, "POST");
    const b = await k.schicken<{ id: string }>("/v1/belege", "POST", {});
    await k.schicken(`/v1/belege/${b.id}`, "PUT", { belegdatum: "2026-10-05", brutto_cent: 1190, ust_cent: 190 });
    const v = await k.holen<UstVa>("/v1/finanzen/ust-voranmeldung?periode=2026-10");
    expect(v.umsatzsteuer_cent).toBe(1900);
    expect(v.vorsteuer_cent).toBe(190);
    expect(v.zahllast_cent).toBe(1710);
  });
});

describe("Demo: Personal", () => {
  it("Einstellung meldet Ereignisse, zieht Anzahlen im Profil nach und erzeugt die Checkliste", async () => {
    const k = await startklar();
    const b = await k.schicken<Beschaeftigter>("/v1/beschaeftigte", "POST", { vorname: "Tom", nachname: "Teig", art: "vollzeit", eintritt: "2026-10-12" });
    expect((await k.profil()).daten["beschaeftigte.gesamt"]).toBe(1);
    const c = await k.holen<Checkliste>(`/v1/beschaeftigte/${b.id}/checkliste`);
    expect(c.schritte.length).toBeGreaterThan(0);
    expect(c.schritte.every((s) => s.anlass === "einstellung")).toBe(true);
  });

  it("Zeiten: Kommen/Gehen und Monatssumme", async () => {
    const k = await startklar();
    const b = await k.schicken<Beschaeftigter>("/v1/beschaeftigte", "POST", { vorname: "A", nachname: "B", art: "minijob", eintritt: "2026-10-01" });
    await k.schicken("/v1/zeiten", "POST", { beschaeftigter_id: b.id, beginn: "2026-10-05T07:00:00.000Z", ende: "2026-10-05T15:30:00.000Z", pause_minuten: 30, grund: "vergessen" });
    const z = await k.holen<Zeiten>("/v1/zeiten?monat=2026-10");
    expect(z.summen_minuten[b.id]).toBe(480);
  });

  it("Unterweisung: Name muss passen, Abschluss erledigt die Erstunterweisung", async () => {
    const k = await startklar();
    const b = await k.schicken<Beschaeftigter>("/v1/beschaeftigte", "POST", { vorname: "Tom", nachname: "Teig", art: "vollzeit", eintritt: "2026-10-01" });
    const u = await k.schicken<{ id: string }>("/v1/unterweisungen", "POST", { thema: "Brandschutz", inhalt: "Fluchtwege", datum: "2026-10-10", durchgefuehrt_von: "Chefin" });
    await expect(k.schicken(`/v1/unterweisungen/${u.id}/bestaetigen`, "POST", { beschaeftigter_id: b.id, name: "Falscher Name" })).rejects.toBeInstanceOf(ApiFehler);
    await k.schicken(`/v1/unterweisungen/${u.id}/bestaetigen`, "POST", { beschaeftigter_id: b.id, name: "tom teig" });
    const vorher = (await k.pflichten()).filter((x) => x.pflicht_id === "arbeitsschutz.erstunterweisung" && x.status !== "erledigt").length;
    const r = await k.schicken<{ erledigte_pflichten: number }>(`/v1/unterweisungen/${u.id}/abschliessen`, "POST");
    expect(r.erledigte_pflichten).toBeGreaterThanOrEqual(vorher > 0 ? 1 : 0);
  });
});

describe("Demo: Postfach, Gründung, Melden", () => {
  it("Brief mit Frist erscheint als Termin; erledigt verschwindet er", async () => {
    const k = await startklar();
    const b = await k.schicken<Brief>("/v1/briefe", "POST", {});
    await k.schicken(`/v1/briefe/${b.id}`, "PUT", { eingang_am: "2026-10-12", absender: "Finanzamt", art: "bescheid", aktenzeichen: "12/345", frist_am: "2026-11-12", frist_art: "einspruch" });
    expect((await k.holen<Termin[]>("/v1/termine")).map((x) => x.datum)).toEqual(["2026-11-12"]);
    await k.schicken(`/v1/briefe/${b.id}/erledigt`, "POST", { datum: "2026-10-20" });
    expect(await k.holen<Termin[]>("/v1/termine")).toEqual([]);
  });

  it("Gründungsassistent liefert geordnete Schritte mit Fortschritt; Fragebogen zeigt Fehlendes", async () => {
    const k = await startklar();
    const g = await k.holen<Gruendung>("/v1/gruendung");
    expect(g.schritte.length).toBeGreaterThan(0);
    expect(g.fortschritt.gesamt).toBeGreaterThan(0);
    const fb = await k.holen<{ abschnitte: unknown[]; fehlend: string[] }>("/v1/gruendung/fragebogen");
    expect(fb.abschnitte.length).toBeGreaterThan(0);
  });

  it("Gemeldetes Ereignis lässt sich zurücknehmen", async () => {
    const k = await startklar();
    const e = await k.schicken<{ id: string }>("/v1/ereignisse", "POST", { typ: "sitzverlegung", datum: "2026-10-01" });
    await k.schicken(`/v1/ereignisse/${e.id}/storno`, "POST");
    const liste = await k.holen<{ id: string; storniert: boolean }[]>("/v1/ereignisse");
    expect(liste.find((x) => x.id === e.id)?.storniert).toBe(true);
  });
});
