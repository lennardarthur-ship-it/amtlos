/** Regressionstests zu den Befunden der Prüfrunde 9 (Datenintegrität und Sicherheit der App). */
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { VORLAGEN, type Beleg } from "@amtlos/fachlogik";
import { SyncFehler, dateiEntschluesseln, dateiVerschluesseln, standEntschluesseln, standVerschluesseln, syncZusammenfuehren, synchronisieren, zufallsSchluessel, type SyncUmgebung, type TresorApi } from "../src/konto/sync";
import { fehlendeDateien, passwortSchwaeche, sicherungErstellen, sicherungLesenMitDateien, SicherungsFehler } from "../src/unterlagen/sicherung";
import { LEERER_STAND, StandFehler, allesLoeschenErlaubt, anlegen, ausgabeMoeglich, ausgeben, belegLoeschen, belegSetzen, erledigtSetzen, felderSetzen, loeschen, mehrfachStorniert, neueId, nichtZaehlend, standAus, stornieren, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { tresorOeffnen, tresorSchliessen } from "../src/unterlagen/tresor";
import { umsaetzeFuer } from "../src/unterlagen/ustAusRechnungen";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const t = (iso: string) => new Date(iso);
const B = { ...LEERER_STAND.betrieb, name: "Salon Sonne", steuernummer: "143/123/45678" };
const pos = (preis: string) => [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis, satz: "19" }];
const beleg = (id: string, o: Partial<Beleg> = {}): Beleg => ({ id, datum: "2026-10-02", lieferant: "Friseurbedarf Müller", nummer: null, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 11900 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: null, quelle: "hand", erstellt: "2026-10-02T08:00:00Z", geaendert: "2026-10-02T08:00:00Z", ...o });

/** Stand mit Rechnung r1 (2026-001) als Entwurf, 100,00 € netto */
function basis(): Stand {
  const [s] = anlegen({ ...LEERER_STAND, betrieb: B }, "rechnung", t("2026-10-01T08:00:00Z"), "r1");
  return felderSetzen(s, "r1", { datum: "2026-10-01", kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3\n80333 München", positionen: pos("100,00") }, t("2026-10-01T08:30:00Z"));
}
const fest = () => ausgeben(basis(), "r1", t("2026-10-01T09:00:00Z"));

describe("K1 – zwei verschieden festgeschriebene Fassungen", () => {
  const a = () => ausgeben(felderSetzen(basis(), "r1", { positionen: pos("100,00") }, t("2026-10-05T09:00:00Z")), "r1", t("2026-10-05T10:00:00Z"));
  const b = () => ausgeben(felderSetzen(basis(), "r1", { positionen: pos("250,00") }, t("2026-10-05T09:10:00Z")), "r1", t("2026-10-05T09:30:00Z"));

  it("Synchronisation: nie Inhalt übernehmen, zuerst festgeschriebene gilt, die andere wird Konfliktkopie und gemeldet", () => {
    for (const [l, e] of [[a(), b()], [b(), a()]] as const) {
      const z = syncZusammenfuehren(l, e);
      const r1 = z.stand.unterlagen.find((u) => u.id === "r1")!;
      expect(r1.daten.positionen).toEqual(pos("250,00"));
      expect(r1.festgeschrieben).toBe("2026-10-05T09:30:00.000Z");
      const kopie = z.stand.unterlagen.find((u) => u.konfliktKopieVon === "r1")!;
      expect(kopie.daten.positionen).toEqual(pos("100,00"));
      expect(z.festKonflikte).toEqual(["2026-001"]);
      // Kopie zählt nicht als doppelte Nummer, nicht in der Umsatzsteuer
      expect(z.nummernKonflikte).toEqual([]);
      expect(umsaetzeFuer(z.stand.unterlagen, "2026-10", B)!.werte.umsatz_19).toBe("250,00");
    }
    // beide Geräte kommen zum selben Ergebnis, erneutes Zusammenführen ändert nichts mehr
    const x = syncZusammenfuehren(a(), b()).stand;
    const y = syncZusammenfuehren(b(), a()).stand;
    const ids = (s: Stand) => s.unterlagen.map((u) => u.id).sort();
    expect(ids(x)).toEqual(ids(y));
    expect(ids(syncZusammenfuehren(x, y).stand)).toEqual(ids(x));
  });

  it("Wiederherstellen: ebenso – und eine präparierte Sicherung mit späterem `geaendert` ersetzt nichts", () => {
    const z = zusammenfuehren(a(), b());
    expect(z.festKonflikte).toEqual(["2026-001"]);
    const boese = fest();
    const manipuliert: Stand = { ...boese, unterlagen: boese.unterlagen.map((u) => ({ ...u, daten: { ...u.daten, positionen: pos("1,00") }, geaendert: "2030-01-01T00:00:00Z", festgeschrieben: "2030-01-01T00:00:00Z" })) };
    const r = zusammenfuehren(fest(), manipuliert);
    expect(r.stand.unterlagen.find((u) => u.id === "r1")!.daten.positionen).toEqual(pos("100,00"));
    expect(r.festKonflikte).toEqual(["2026-001"]);
  });

  it("standAus prüft Zeitstempel, verliert aber keine Festschreibung", () => {
    const s = standAus(JSON.stringify({ ...fest(), unterlagen: fest().unterlagen.map((u) => ({ ...u, festgeschrieben: 1, geaendert: "morgen" })) }));
    const u = s.unterlagen[0]!;
    expect(u.festgeschrieben).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(u.geaendert).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("K2 – Doppelstorno auf zwei Geräten", () => {
  it("zählt je Rechnung nur das Storno aus `storniertDurch` und meldet „mehrfach storniert“", () => {
    const [sa] = stornieren(fest(), "r1", t("2026-10-10T09:00:00Z"), "stA");
    const [sb] = stornieren(fest(), "r1", t("2026-10-10T09:05:00Z"), "stB");
    const a = ausgeben(sa, "stA", t("2026-10-10T10:00:00Z"));
    const b = ausgeben(sb, "stB", t("2026-10-10T09:30:00Z"));
    const x = syncZusammenfuehren(a, b);
    const y = syncZusammenfuehren(b, a);
    for (const z of [x, y]) {
      expect(z.stand.unterlagen.find((u) => u.id === "r1")!.storniertDurch).toBe("stB");
      expect(z.mehrfachStorniert).toEqual(["2026-001"]);
      expect([...nichtZaehlend(z.stand.unterlagen)]).toEqual(["stA"]);
      expect(umsaetzeFuer(z.stand.unterlagen, "2026-10", B)!.werte.umsatz_19).toBe("0,00");
    }
    expect(mehrfachStorniert(a.unterlagen)).toEqual([]);
  });
});

describe("M1 – Storno-Verweis bei doppelter Nummer", () => {
  it("verknüpft über die ID, nicht über die mehrdeutige Nummer", () => {
    const s0 = fest();
    // zweite Rechnung mit derselben Nummer (offline auf einem anderen Gerät vergeben)
    const [s1] = anlegen(s0, "rechnung", t("2026-10-01T08:00:00Z"), "rb");
    const s2 = ausgeben(felderSetzen(s1, "rb", { nummer: "2026-001", datum: "2026-10-01", kunde_name: "Alex", kunde_anschrift: "Weg 1\n80331 München", positionen: pos("50,00") }, t("2026-10-01T08:40:00Z")), "rb", t("2026-10-01T09:10:00Z"));
    const [s3] = stornieren(s2, "r1", t("2026-10-10T09:00:00Z"), "stA");
    const z = syncZusammenfuehren(s3, s2);
    expect(z.stand.unterlagen.find((u) => u.id === "rb")!.storniertDurch).toBeUndefined();
    expect(z.stand.unterlagen.find((u) => u.id === "r1")!.storniertDurch).toBe("stA");
  });
});

describe("H1 – festgeschrieben wird genau der Inhalt des PDFs", () => {
  it("schreibt nicht fest, wenn sich die Unterlage seit dem PDF geändert hat", () => {
    const s = basis();
    const pdf = s.unterlagen[0]!.daten;
    const nachSync = felderSetzen(s, "r1", { positionen: pos("999,00") }, t("2026-10-01T08:45:00Z"));
    expect(ausgabeMoeglich(nachSync, "r1", pdf)).toBe(false);
    expect(ausgeben(nachSync, "r1", t("2026-10-01T09:00:00Z"), pdf)).toBe(nachSync);
    const ok = ausgeben(s, "r1", t("2026-10-01T09:00:00Z"), pdf, "ab12");
    expect(ok.unterlagen[0]).toMatchObject({ festgeschrieben: "2026-10-01T09:00:00.000Z", pdfSha256: "ab12" });
  });
});

describe("H2 – Belege in der Aufbewahrungsfrist", () => {
  it("löscht frische oder leere Belege, ältere werden mit Grund ungültig markiert und bleiben samt Datei", () => {
    const s = belegSetzen({ ...LEERER_STAND, betrieb: B }, beleg("b1", { datei: "lx9kabc123.jpg" }), t("2026-10-02T08:00:00Z"));
    expect(belegLoeschen(s, "b1", t("2026-10-02T10:00:00Z")).belege).toEqual([]);
    const spaeter = belegLoeschen(s, "b1", t("2026-11-02T10:00:00Z"), "doppelt");
    expect(spaeter.belege).toEqual([]);
    expect(spaeter.belegArchiv[0]).toMatchObject({ id: "b1", datei: "lx9kabc123.jpg", ungueltig_grund: "doppelt" });
    expect(spaeter.geloescht["b:b1"]).toBeUndefined();
    // der Ungültig-Vermerk erreicht das andere Gerät, der Beleg verschwindet dort nicht spurlos
    const anders = syncZusammenfuehren(s, spaeter).stand;
    expect(anders.belege).toEqual([]);
    expect(anders.belegArchiv.map((b) => b.id)).toEqual(["b1"]);
    // ungültige Belege zählen nicht – überstehen aber Speichern und Sicherung
    expect(standAus(JSON.stringify(spaeter)).belegArchiv).toHaveLength(1);
  });

  it("protokolliert Änderungen an älteren Belegen (je Bearbeitung eine Fassung)", () => {
    let s = belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02T08:00:00Z"));
    s = belegSetzen(s, { ...s.belege[0]!, steuer: [{ satz: 19, brutto_cent: 1 }] }, t("2026-10-20T08:00:00Z"));
    s = belegSetzen(s, { ...s.belege[0]!, steuer: [{ satz: 19, brutto_cent: 12 }] }, t("2026-10-20T08:00:05Z"));
    expect(s.belege[0]!.historie).toHaveLength(1);
    expect(s.belege[0]!.historie![0]!.steuer[0]!.brutto_cent).toBe(11900);
  });

  it("ein ausdrücklich wiederhergestellter Beleg schlägt den Löschvermerk", () => {
    const s = belegSetzen(LEERER_STAND, beleg("b1"), t("2026-10-02T08:00:00Z"));
    const weg = belegLoeschen(s, "b1", t("2026-10-02T09:00:00Z"));
    const wieder = zusammenfuehren(weg, s, t("2026-10-03T09:00:00Z")).stand;
    expect(wieder.belege.map((b) => b.id)).toEqual(["b1"]);
    expect(syncZusammenfuehren(wieder, weg).stand.belege.map((b) => b.id)).toEqual(["b1"]);
  });
});

describe("H3 – eine Sicherung ohne Belegdateien ist nicht vollständig", () => {
  it("nennt fehlende Dateien; ohne sie bleibt „Alle Daten löschen“ gesperrt", () => {
    const s = belegSetzen(LEERER_STAND, beleg("b1", { datei: "lx9kabc123.jpg" }), t("2026-10-02T08:00:00Z"));
    expect(fehlendeDateien(s, {})).toEqual(["lx9kabc123.jpg"]);
    expect(fehlendeDateien(s, { "lx9kabc123.jpg": "AAEC" })).toEqual([]);
    // ohne vollständige Sicherung wird `letzteSicherung` nicht gesetzt – „Alle Daten löschen“ bleibt gesperrt
    expect(allesLoeschenErlaubt(s)).toBe(false);
  });
});

describe("M4 und Versionsprüfung – nichts verwerfen, nichts überschreiben", () => {
  it("bewahrt Unterlagen unbekannter Vorlagen und unlesbare Belege auf und reicht sie weiter", () => {
    const roh = { version: 1, unterlagen: [{ id: "x1", vorlage: "gibt_es_nicht_mehr", daten: { nummer: "A" }, festgeschrieben: "2026-01-01T00:00:00Z" }], belege: [{ id: "bx", datum: "kaputt", lieferant: "Alt" }] };
    const s = standAus(JSON.stringify(roh));
    expect(s.fremd.unterlagen).toEqual(roh.unterlagen);
    expect(s.fremd.belege).toEqual(roh.belege);
    expect(standAus(JSON.stringify(s)).fremd).toEqual(s.fremd);
    expect(syncZusammenfuehren(LEERER_STAND, s).stand.fremd).toEqual(s.fremd);
    expect(zusammenfuehren(LEERER_STAND, s).stand.fremd).toEqual(s.fremd);
  });

  it("wirft bei Unlesbarem und bei Ständen einer neueren App-Version", () => {
    expect(() => standAus("{kaputt")).toThrow(StandFehler);
    expect(() => standAus("[]")).toThrow(StandFehler);
    try {
      standAus(JSON.stringify({ version: 99 }));
      expect.unreachable();
    } catch (e) {
      expect((e as StandFehler).art).toBe("version");
    }
    const k = zufallsSchluessel(zufall);
    expect(() => standEntschluesseln(tresorSchliessen(JSON.stringify({ version: 99 }), k, zufall(12)), k)).toThrow(SyncFehler);
    const datei = sicherungErstellen({ ...LEERER_STAND, version: 99 as Stand["version"] }, "sonnenschein-2026", zufall, new Date(), 1000);
    expect(() => sicherungLesenMitDateien(datei, "sonnenschein-2026")).toThrow(SicherungsFehler);
  });

  it("alle bisher ausgelieferten Vorlagen-IDs gibt es weiter (sonst landen Unterlagen unter „fremd“)", () => {
    // eingefroren mit Stand der Prüfrunde 9 – eine ID darf hier nie verschwinden, nur dazukommen
    const AUSGELIEFERT = ["allergene", "arbeitszeitnachweis", "aufbewahrung", "avv", "betriebsanweisung", "bilanz_guv", "datenpanne", "datenschutz_dokumentation", "datenschutzerklaerung_website", "datenschutzinformation", "euer", "gefaehrdungsbeurteilung", "gefahrstoffverzeichnis", "gewerbeanmeldung", "haccp", "handelsregister", "hautschutzplan", "hygieneplan", "ifsg_belehrung", "impressum", "kassenbuch", "kassenmeldung", "ki_kompetenz", "lohnkonto", "nachweis_arbeitsbedingungen", "pruefprotokoll_elektro", "rechnung", "steuererklaerung", "sv_meldedaten", "transparenzregister", "unterweisung", "ust_voranmeldung", "verfahrensdokumentation"];
    const vorhanden = new Set(VORLAGEN.map((v) => v.id));
    for (const id of AUSGELIEFERT) expect(vorhanden.has(id), id).toBe(true);
  });
});

describe("M7 und G1 – Löschvermerke beim Wiederherstellen, Haken schlüsselweise", () => {
  it("bringt einen auf dem Gerät gelöschten Entwurf nicht zurück", () => {
    const s = basis();
    const weg = loeschen(s, "r1");
    expect(zusammenfuehren(weg, s).stand.unterlagen).toEqual([]);
  });
  it("behält Haken an verschiedenen Pflichten von zwei Geräten – und das Entfernen eines Hakens", () => {
    const a = erledigtSetzen(LEERER_STAND, "p1", "2026-10-01");
    const b = erledigtSetzen(LEERER_STAND, "p2", "2026-10-02");
    expect(Object.keys(syncZusammenfuehren(a, b).stand.erledigt).sort()).toEqual(["p1", "p2"]);
    const beide = syncZusammenfuehren(a, b).stand;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 60_000));
    const ohne = erledigtSetzen(beide, "p1", null);
    vi.useRealTimers();
    expect(Object.keys(syncZusammenfuehren(beide, ohne).stand.erledigt)).toEqual(["p2"]);
  });
});

describe("M5 und M-1 – Dateien und Stand auf dem Server", () => {
  function server() {
    const s = { version: 0, daten: null as string | null, dateien: new Map<string, string>() };
    const api: TresorApi = {
      holen: async () => ({ version: s.version, schluessel: "", daten: s.daten }),
      speichern: async (v, d) => {
        if (v !== s.version) throw new SyncFehler("konflikt");
        s.version++;
        s.daten = d;
        return s.version;
      },
      dateien: async () => [...s.dateien.keys()],
      dateiSpeichern: async (n, d) => void s.dateien.set(n, d),
      dateiHolen: async (n) => s.dateien.get(n) ?? null,
    };
    return { s, api };
  }
  function geraet(api: TresorApi, sync: Uint8Array, start: Stand) {
    const g = { stand: start, dateien: new Map<string, Uint8Array>(), zaehler: 0 };
    const u: SyncUmgebung = { api, sync, konto: "konto-1", zaehlerLesen: async () => g.zaehler, zaehlerMerken: async (n) => void (g.zaehler = Math.max(g.zaehler, n)), zufall, lokal: () => g.stand, uebernehmen: (s) => void (g.stand = syncZusammenfuehren(g.stand, s).stand), dateiLokal: async (n) => g.dateien.get(n) ?? null, dateiAblegen: async (n, b) => void g.dateien.set(n, b) };
    return { g, u };
  }

  it("eine beschädigte oder vertauschte Datei blockiert die Synchronisation nicht und wird gemeldet", async () => {
    const { s, api } = server();
    const sync = zufallsSchluessel(zufall);
    const mit = (n: string) => belegSetzen(LEERER_STAND, beleg(n, { datei: `${n}datei.jpg` }), t("2026-10-02T08:00:00Z"));
    const a = geraet(api, sync, belegSetzen(mit("b1"), beleg("b2", { datei: "b2datei.jpg" }), t("2026-10-02T08:00:00Z")));
    a.g.dateien.set("b1datei.jpg", new Uint8Array([1]));
    a.g.dateien.set("b2datei.jpg", new Uint8Array([2]));
    await synchronisieren(a.u);
    // Server vertauscht: b1 bekommt den Inhalt von b2 (gültig verschlüsselt, aber für einen anderen Namen)
    s.dateien.set("b1datei.jpg", s.dateien.get("b2datei.jpg")!);
    const b = geraet(api, sync, LEERER_STAND);
    const r = await synchronisieren(b.u);
    expect(r.defekteDateien).toEqual(["b1datei.jpg"]);
    expect([...b.g.dateien.get("b2datei.jpg")!]).toEqual([2]);
    expect(b.g.dateien.has("b1datei.jpg")).toBe(false);
  });

  it("bindet den Stand an das Konto und lehnt zurückgespielte Stände ab; Format 1 bleibt lesbar", async () => {
    const { s, api } = server();
    const sync = zufallsSchluessel(zufall);
    const a = geraet(api, sync, fest());
    await synchronisieren(a.u);
    const alt = s.daten!;
    await synchronisieren(a.u);
    expect(() => standEntschluesseln(s.daten!, sync, "anderes-konto")).toThrow(SyncFehler);
    s.daten = alt;
    const fehler = await synchronisieren(a.u).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(SyncFehler);
    expect((fehler as SyncFehler).art).toBe("format");
    // Format 1 (ältere App) ohne Konto weiterhin lesbar
    expect(standEntschluesseln(standVerschluesseln(fest(), sync, zufall(12)), sync).unterlagen).toHaveLength(1);
    expect(dateiEntschluesseln(dateiVerschluesseln(new Uint8Array([7]), sync, zufall(12)), sync, "x1234.jpg")).toEqual(new Uint8Array([7]));
    expect(() => dateiEntschluesseln(dateiVerschluesseln(new Uint8Array([7]), sync, zufall(12), "aaaa1.jpg"), sync, "bbbb1.jpg")).toThrow();
    expect(() => tresorOeffnen(tresorSchliessen("x", sync, zufall(12), "datei:a"), sync)).toThrow();
  });
});

describe("G-1 und H-1 – Dateinamen in Sicherungen, Passwortstärke, IDs", () => {
  it("übernimmt aus einer Sicherung keine Dateinamen mit Pfad", () => {
    const text = sicherungErstellen(LEERER_STAND, "sonnenschein-2026", zufall, new Date(), 1000, { "../../Library/x.jpg": "AAEC", "lx9kabc123.jpg": "AAEC" });
    expect(Object.keys(sicherungLesenMitDateien(text, "sonnenschein-2026").dateien)).toEqual(["lx9kabc123.jpg"]);
  });
  it("lehnt naheliegende Passwörter ab, nimmt lange und Wortsätze", () => {
    for (const pw of ["Sommer2025!", "Passwort1234", "qwertz123456", "aaaaaaaaaaaaaa", "123456789012", "abcabcabcabc", "kurz"]) expect(passwortSchwaeche(pw), pw).not.toBeNull();
    for (const pw of ["Tisch Wolke Fahrrad", "grüne-Tasse-Nordsee", "Kv8#mPq2!xZr"]) expect(passwortSchwaeche(pw), pw).toBeNull();
  });
  it("neue IDs sind kollisionsfest und taugen als Dateiname", () => {
    const ids = new Set(Array.from({ length: 2000 }, () => neueId()));
    expect(ids.size).toBe(2000);
    for (const id of [...ids].slice(0, 20)) expect(id).toMatch(/^[a-z0-9]{20,40}$/);
  });
});
