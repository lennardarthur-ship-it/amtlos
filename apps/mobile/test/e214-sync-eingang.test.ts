/**
 * E-214 (Steuerberater, 26.10.2026, zu T-252/E-209): Zwei verschiedene Korrekturen desselben festgeschriebenen Belegs
 * auf zwei Geräten – „zuletzt“ muss ein verlässlicher Zeitpunkt sein (Eingang beim Server, nicht die Uhr des Geräts);
 * die nicht übernommene Korrektur bleibt vollständig erhalten (Inhalt, Zeitpunkt, Gerät, Grund) samt Begründung, und der
 * Konflikt steht auch im Änderungsprotokoll (neue Protokollart, Export mit Gerät und Eingang beim Server).
 * Ohne Server (Sicherung, Datei) entscheidet weiter die Uhr der Geräte – vermerkt als „geraetezeit“.
 */
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { Beleg } from "@amtlos/fachlogik";
import { SyncFehler, syncInhalt, syncZusammenfuehren, synchronisieren, zufallsSchluessel, type SyncUmgebung, type TresorApi } from "../src/konto/sync";
import { BELEG_KONFLIKT_GRUND, LEERER_STAND, anlegen, ausgeben, belegSetzen, belegeFestschreiben, felderSetzen, standAus, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { PROTOKOLL_SPALTEN, aenderungsprotokoll } from "../src/unterlagen/steuerpaket";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const t = (d: string) => new Date(d);
const beleg = (id: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum: "2026-10-02", lieferant: "Friseurbedarf Müller", nummer: `L-${id}`, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: "2026-10-02T08:00:00Z", geaendert: "2026-10-02T08:00:00Z", ...o });
const SEIT = "2026-10-01T07:00:00.000Z";

/** Server im Arbeitsspeicher wie die API: Version, 409, Serverzeit des Eingangs und Einrichtung des Tresors (E-214). */
function server() {
  const s = { version: 0, daten: null as string | null, uhr: Date.parse("2026-10-10T10:00:00Z"), seit: SEIT, zeiten: new Map<number, string>() };
  const api: TresorApi = {
    holen: async () => ({ version: s.version, schluessel: "", daten: s.daten, seit: s.seit, geaendert_am: s.zeiten.get(s.version) }),
    speichern: async (version, daten) => {
      if (version !== s.version) throw new SyncFehler("konflikt");
      s.version++;
      s.daten = daten;
      s.uhr += 60_000;
      const empfangen = new Date(s.uhr).toISOString();
      s.zeiten.set(s.version, empfangen);
      return { version: s.version, empfangen, seit: s.seit };
    },
    dateien: async () => [],
    dateiSpeichern: async () => {},
    dateiHolen: async () => null,
  };
  return { s, api };
}

function geraet(api: TresorApi, sync: Uint8Array, start: Stand) {
  const g = { stand: start };
  const u: SyncUmgebung = { api, sync, zufall, lokal: () => g.stand, uebernehmen: (x) => (g.stand = syncZusammenfuehren(g.stand, x).stand), dateiLokal: async () => null, dateiAblegen: async () => {} };
  return { g, u };
}

/** Ausgangslage auf beiden Geräten: Beleg erfasst und festgeschrieben, über den Server synchronisiert. */
async function ausgangslage() {
  const { s, api } = server();
  const sync = zufallsSchluessel(zufall);
  let start = belegSetzen({ ...LEERER_STAND, geraet: "geraet-aaaa-0001" }, beleg("b1"), t("2026-10-02T08:00:00Z"));
  start = belegeFestschreiben(start, ["b1"], t("2026-10-05T09:00:00Z"));
  const a = geraet(api, sync, start);
  await synchronisieren(a.u);
  const b = geraet(api, sync, { ...LEERER_STAND, geraet: "geraet-bbbb-0002" });
  await synchronisieren(b.u);
  expect(b.g.stand.belege[0]!.festgeschrieben).toBe("2026-10-05T09:00:00.000Z");
  return { s, a, b };
}

describe("E-214: zwei Korrekturen – es gilt die, die zuletzt beim Server einging", () => {
  it("Gerät B (Uhr nach) korrigiert vor Gerät A, synchronisiert aber danach: B gilt; A bleibt vollständig erhalten und steht im Änderungsprotokoll (vorher galt A nach der Geräteuhr)", async () => {
    const { s, a, b } = await ausgangslage();
    // A korrigiert um 12:00 (Geräteuhr), B um 11:00 – B's Uhr geht nach
    a.g.stand = belegSetzen(a.g.stand, { ...a.g.stand.belege[0]!, steuer: [{ satz: 19, brutto_cent: 12900 }] }, t("2026-10-12T12:00:00Z"), "Betrag laut Rechnung 129,00 €");
    b.g.stand = belegSetzen(b.g.stand, { ...b.g.stand.belege[0]!, kategorie: "buero" }, t("2026-10-12T11:00:00Z"), "Kategorie war falsch");
    expect(a.g.stand.belege[0]!.eingang).toBeUndefined();
    expect(a.g.stand.belege[0]!.geraet).toBe("geraet-aaaa-0001");
    await synchronisieren(a.u); // Version 3 beim Server
    expect(a.g.stand.belege[0]!.eingang).toEqual({ seit: SEIT, version: 3, zeit: s.zeiten.get(3) });
    await synchronisieren(b.u); // Version 4 – B's Korrektur ging zuletzt ein
    const r = b.g.stand.belege[0]!;
    expect(r.kategorie).toBe("buero");
    expect(r.steuer[0]!.brutto_cent).toBe(11900);
    expect(r.eingang).toEqual({ seit: SEIT, version: 4, zeit: s.zeiten.get(4) });
    const nu = r.historie!.find((h) => h.grund === BELEG_KONFLIKT_GRUND)!;
    expect(nu).toMatchObject({ steuer: [{ satz: 19, brutto_cent: 12900 }], bis: "2026-10-12T12:00:00.000Z", geraet: "geraet-aaaa-0001", eingang: { seit: SEIT, version: 3 }, vorrang: "eingang", gegen_geraet: "geraet-bbbb-0002", gegen_geaendert: "2026-10-12T11:00:00.000Z", korrektur_grund: "Betrag laut Rechnung 129,00 €" });
    expect(nu.gegen_eingang).toMatchObject({ seit: SEIT, version: 4 });
    // Gründe beider Korrekturen bleiben in der Historie
    expect(r.historie!.map((h) => h.grund)).toEqual(expect.arrayContaining(["Betrag laut Rechnung 129,00 €", "Kategorie war falsch", BELEG_KONFLIKT_GRUND]));
    const p = b.g.stand.protokoll.filter((x) => x.art === "korrektur_nicht_uebernommen");
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ bezug: "b1", fassung_bis: "2026-10-12T12:00:00.000Z", geraet: "geraet-aaaa-0001", eingang: { seit: SEIT, version: 3 } });
    expect(p[0]!.text).toContain("später beim Synchronisationsserver");
    expect(p[0]!.text).toContain("Grund: Betrag laut Rechnung 129,00 €");
    // A synchronisiert wieder: gleiches Ergebnis, kein zweiter Protokolleintrag, nichts geht verloren
    await synchronisieren(a.u);
    await synchronisieren(b.u);
    await synchronisieren(a.u);
    for (const g of [a.g.stand, b.g.stand]) {
      expect(g.belege[0]!.kategorie).toBe("buero");
      expect(g.belege[0]!.historie!.filter((h) => h.grund === BELEG_KONFLIKT_GRUND)).toHaveLength(1);
      expect(g.protokoll.filter((x) => x.art === "korrektur_nicht_uebernommen")).toHaveLength(1);
    }
    expect(a.g.stand.belege).toEqual(b.g.stand.belege);
  });

  it("scheitert das Hochladen (409), bleibt der lokale Stand unverändert – die vorgemerkte Version gilt nicht", async () => {
    const { a } = await ausgangslage();
    a.g.stand = belegSetzen(a.g.stand, { ...a.g.stand.belege[0]!, notiz: "x" }, t("2026-10-12T12:00:00Z"), "Notiz zur Zahlung ergänzt");
    const vorher = JSON.stringify(a.g.stand);
    const immer409: TresorApi = { ...a.u.api, speichern: async () => Promise.reject(new SyncFehler("konflikt")) };
    await expect(synchronisieren({ ...a.u, api: immer409 })).rejects.toThrow(SyncFehler);
    expect(JSON.stringify(a.g.stand)).toBe(vorher);
  });

  it("Zusammenführen ist symmetrisch: dieselbe Entscheidung in beiden Richtungen", () => {
    let s0 = belegeFestschreiben(belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02T08:00:00Z")), ["b1"], t("2026-10-05T09:00:00Z"));
    s0 = { ...s0, belege: s0.belege.map((x) => ({ ...x, eingang: { seit: SEIT, version: 1 } })) };
    const a = belegSetzen({ ...s0, geraet: "geraet-aaaa-0001" }, { ...s0.belege[0]!, notiz: "A" }, t("2026-10-12T12:00:00Z"), "Grund A: Notiz ergänzt");
    const b = belegSetzen({ ...s0, geraet: "geraet-bbbb-0002" }, { ...s0.belege[0]!, notiz: "B" }, t("2026-10-12T11:00:00Z"), "Grund B: Notiz ergänzt");
    const a2 = { ...a, belege: a.belege.map((x) => ({ ...x, eingang: { seit: SEIT, version: 2 } })) };
    const b2 = { ...b, belege: b.belege.map((x) => ({ ...x, eingang: { seit: SEIT, version: 3 } })) };
    const jetzt = t("2026-10-13T10:00:00Z");
    const x = syncZusammenfuehren(a2, b2, jetzt).stand;
    const y = syncZusammenfuehren(b2, a2, jetzt).stand;
    expect(x.belege[0]!.notiz).toBe("B");
    expect(JSON.stringify(x.belege)).toBe(JSON.stringify(y.belege));
    expect(x.protokoll.map((p) => p.id)).toEqual(y.protokoll.map((p) => p.id));
    // ein neu eingerichteter Tresor (späteres `seit`) zählt wieder ab 1 – und ist trotzdem später
    const neu = { ...a, belege: a.belege.map((z) => ({ ...z, eingang: { seit: "2026-10-11T00:00:00.000Z", version: 1 } })) };
    expect(syncZusammenfuehren(neu, b2, jetzt).stand.belege[0]!.notiz).toBe("A");
  });
});

describe("E-214: ohne Server (Wiederherstellen aus Sicherung oder Datei) entscheidet die Uhr der Geräte – vermerkt", () => {
  it("vorrang „geraetezeit“, Protokolleintrag „ohne Eingang beim Server“", () => {
    const s0 = belegeFestschreiben(belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02T08:00:00Z")), ["b1"], t("2026-10-05T09:00:00Z"));
    const geraetA = belegSetzen({ ...s0, geraet: "geraet-aaaa-0001" }, { ...s0.belege[0]!, notiz: "A" }, t("2026-10-12T12:00:00Z"), "Grund A: Notiz ergänzt");
    const sicherungB = belegSetzen({ ...s0, geraet: "geraet-bbbb-0002" }, { ...s0.belege[0]!, notiz: "B" }, t("2026-10-12T11:00:00Z"), "Grund B: Notiz ergänzt");
    const r = zusammenfuehren(geraetA, sicherungB, t("2026-10-13T10:00:00Z"));
    expect(r.belegKonflikte).toEqual([r.stand.belege[0]!.nr]);
    const b = r.stand.belege[0]!;
    expect(b.notiz).toBe("A");
    expect(b.historie!.find((h) => h.grund === BELEG_KONFLIKT_GRUND)).toMatchObject({ notiz: "B", vorrang: "geraetezeit", geraet: "geraet-bbbb-0002", korrektur_grund: "Grund B: Notiz ergänzt" });
    const p = r.stand.protokoll.find((x) => x.art === "korrektur_nicht_uebernommen")!;
    expect(p.text).toContain("nach der Uhr der Geräte");
    expect(p.text).toContain("ohne Eingang beim Server");
    // Export: eigene Zeile mit Gerät und Eingang, die Historie-Zeile steht nicht doppelt
    const zeilen = aenderungsprotokoll(r.stand, { von: "2026-01-01", bis: "2026-12-31", name: "2026" });
    const nu = zeilen.filter((z) => z[3] === "Korrektur bei der Zusammenführung nicht übernommen");
    expect(nu).toHaveLength(1);
    expect(nu[0]![5]).toBe("bbbb-0002".slice(-8));
    expect(nu[0]![6]).toBe("ohne Eingang beim Server");
    expect(zeilen.every((z) => z.length === PROTOKOLL_SPALTEN.length)).toBe(true);
  });
});

describe("E-214: Export, Gerätekennung und Konfliktkopien", () => {
  it("Feldbeschreibung des Änderungsprotokolls nennt Gerät und Eingang beim Server", () => {
    expect(PROTOKOLL_SPALTEN.map((x) => x.name)).toEqual(["Zeitpunkt", "Bereich", "Beleg/Tag", "Vorgang", "Grund bzw. Inhalt", "Gerät", "Eingang beim Server"]);
    expect(PROTOKOLL_SPALTEN[3]!.beschreibung).toContain("Korrektur bei der Zusammenführung nicht übernommen");
    expect(PROTOKOLL_SPALTEN[6]!.beschreibung).toContain("Uhr der Geräte");
  });

  it("die Gerätekennung bleibt auf dem Gerät: nicht synchronisiert, beim Wiederherstellen nicht übernommen, aber gespeichert", () => {
    const s: Stand = { ...LEERER_STAND, geraet: "geraet-aaaa-0001" };
    expect(syncInhalt(s).geraet).toBeUndefined();
    expect(standAus(JSON.stringify(s)).geraet).toBe("geraet-aaaa-0001");
    expect(zusammenfuehren({ ...LEERER_STAND, geraet: "geraet-bbbb-0002" }, s).stand.geraet).toBe("geraet-bbbb-0002");
    expect(standAus(JSON.stringify({ ...s, geraet: "../x" })).geraet).toBeUndefined();
  });

  it("Konfliktkopie einer verschieden festgeschriebenen Unterlage steht im Änderungsprotokoll", () => {
    const [s0] = anlegen(LEERER_STAND, "rechnung", t("2026-10-01T08:00:00Z"), "u1");
    const a = ausgeben(felderSetzen(s0, "u1", { kunde_name: "Kunde A" }, t("2026-10-02T08:00:00Z")), "u1", t("2026-10-02T09:00:00Z"));
    const b = ausgeben(felderSetzen(s0, "u1", { kunde_name: "Kunde B" }, t("2026-10-02T08:30:00Z")), "u1", t("2026-10-02T10:00:00Z"));
    const z = syncZusammenfuehren(a, b, t("2026-10-03T10:00:00Z"));
    expect(z.festKonflikte).toHaveLength(1);
    const p = z.stand.protokoll.filter((x) => x.art === "korrektur_nicht_uebernommen");
    expect(p).toHaveLength(1);
    expect(p[0]!.text).toContain("Konfliktkopie");
    expect(syncZusammenfuehren(z.stand, b, t("2026-10-04T10:00:00Z")).stand.protokoll.filter((x) => x.art === "korrektur_nicht_uebernommen")).toHaveLength(1);
  });
});
