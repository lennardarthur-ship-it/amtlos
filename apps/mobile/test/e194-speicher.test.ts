/**
 * E-194: Datenverlust bei vielen Daten. Stand in verschlüsselten Teildateien statt in einem AsyncStorage-Eintrag
 * (Android: CursorWindow ~2 MB je Zeile, Datenbank 6 MB), sicherer Umzug aus dem alten Eintrag, kompakte Schreibweise
 * (Logo nur einmal), Sicherungsdatei als Container Stück für Stück (Version 3), alte Sicherungen bleiben lesbar.
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KOMPAKT_AB, istKompakt, kompaktAufloesen, kompaktJson } from "../src/unterlagen/kompakt";
import { SicherungsFehler, ausUtf8, schluesselAusPasswort, sicherungLesen, sicherungMitSchluessel, utf8 } from "../src/unterlagen/sicherung";
import { CONTAINER_KENNUNG, DATENSATZ_HOECHSTENS, TEIL_BYTES, belegeErgaenzt, containerOeffnen, containerSchreiben, textSicherungOeffnen, type Leser } from "../src/unterlagen/sicherungContainer";
import { LEERER_STAND, StandFehler, anlegen, ausgeben, belegSetzen, betriebSetzen, felderSetzen, migrieren, standAus, type Stand } from "../src/unterlagen/speicher";
import { ALT_BEISEITE, ALT_SCHLUESSEL, ALT_VORHER, ERSATZKOPIE, KOPF, LadeFehler, StandAblage, TEIL_ZEICHEN, zerlegen, type AltSpeicher, type Dateisystem } from "../src/unterlagen/standAblage";
import { istTresor, tresorSchliessen } from "../src/unterlagen/tresor";

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const t = (d: string) => new Date(`${d}T09:00:00Z`);
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const LOGO = `data:image/png;base64,${"iVBORw0KGgo".repeat(20_000)}`; // ~220 KB wie ein echtes Logo
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Salon Sonne", strasse: "Hauptstraße 1", plz: "80331", ort: "München", email: "info@salon.example", steuernummer: "143/123/45678", iban: "DE89370400440532013000", logo: LOGO };
/** größte verschlüsselte Teildatei: TEIL_ZEICHEN Zeichen × höchstens 3 Byte + Kennung, Nonce, Tag */
const TEIL_HOECHSTENS = TEIL_ZEICHEN * 3 + 64;

/** Großer Betrieb: n festgeschriebene E-Rechnungen, jede mit Absender-Schnappschuss samt Logo (R12 GoBD). */
function grosserBetrieb(n: number): Stand {
  let s = betriebSetzen(LEERER_STAND, BETRIEB);
  const [s1] = anlegen(s, "rechnung", t("2026-03-02"), "r0");
  s = felderSetzen(s1, "r0", { datum: "2026-03-02", kunde_name: "Kim Beispiel", kunde_anschrift: "Gartenweg 3\n80333 München", kunde_email: "kim@example.org", positionen: [{ bezeichnung: "Haarschnitt", menge: "1", einheit: "", preis: "40,00", satz: "19" }] }, t("2026-03-02"));
  s = ausgeben(s, "r0", t("2026-03-02"));
  const vorlage = s.unterlagen[0]!;
  expect(vorlage.absender?.logo).toBe(LOGO);
  const unterlagen = Array.from({ length: n }, (_, i) => ({ ...vorlage, id: `r${i}`, absender: { ...BETRIEB }, daten: { ...vorlage.daten, nummer: `2026-${String(i + 1).padStart(4, "0")}`, notiz: `Kunde Nr. ${i} – Grüße 😀` } }));
  return { ...s, unterlagen };
}

// ---- Dateisystem und AsyncStorage im Speicher

class SpeicherFs implements Dateisystem {
  dateien = new Map<string, Uint8Array>();
  groessterSchreibvorgang = 0;
  schreibvorgaenge = 0;
  /** liefert true → dieser Schreibvorgang scheitert (Speicher voll, Absturz) */
  scheitern: ((name: string, nr: number) => boolean) | null = null;
  /** verändert gelesene Bytes (beschädigte Datei) */
  verfaelschen: ((name: string) => boolean) | null = null;
  async lesen(name: string) {
    const b = this.dateien.get(name);
    if (!b) return null;
    const c = b.slice();
    if (this.verfaelschen?.(name)) c[c.length - 1] = c[c.length - 1]! ^ 1;
    return c;
  }
  async schreiben(name: string, bytes: Uint8Array) {
    this.schreibvorgaenge++;
    if (this.scheitern?.(name, this.schreibvorgaenge)) throw new Error("Speicher voll");
    this.groessterSchreibvorgang = Math.max(this.groessterSchreibvorgang, bytes.length);
    this.dateien.set(name, bytes.slice());
  }
  async ersetzen(name: string, bytes: Uint8Array) {
    await this.schreiben(`${name}.neu`, bytes);
    this.verschieben(`${name}.neu`, name);
  }
  namen(ordner: string) {
    const p = ordner ? `${ordner}/` : "";
    return [...this.dateien.keys()].filter((k) => k.startsWith(p) && !k.slice(p.length).includes("/")).map((k) => k.slice(p.length));
  }
  loeschen(name: string) {
    this.dateien.delete(name);
  }
  verschieben(von: string, nach: string) {
    const b = this.dateien.get(von);
    if (!b) throw new Error(`fehlt: ${von}`);
    this.dateien.set(nach, b);
    this.dateien.delete(von);
  }
  leeren() {
    this.dateien.clear();
  }
  /** alle Bytes – zum Prüfen, dass nichts im Klartext liegt */
  alles(): string {
    return [...this.dateien.values()].map((b) => Buffer.from(b).toString("latin1")).join("\n");
  }
}

/** AsyncStorage wie auf Android: eine Zeile über ~2 MB lässt sich nicht mehr lesen (CursorWindow), Datenbank 6 MB. */
class AndroidAsyncStorage implements AltSpeicher {
  m = new Map<string, string>();
  constructor(
    private zeile = 2 * 1024 * 1024,
    private gesamt = 6 * 1024 * 1024,
  ) {}
  async getItem(k: string) {
    const v = this.m.get(k);
    if (v !== undefined && v.length > this.zeile) throw new Error("Row too big to fit into CursorWindow requiredPos=0, totalRows=1");
    return v ?? null;
  }
  async setItem(k: string, v: string) {
    const groesse = [...this.m.entries()].filter(([x]) => x !== k).reduce((n, [, w]) => n + w.length, 0) + v.length;
    if (groesse > this.gesamt) throw new Error("database or disk is full (code 13 SQLITE_FULL)");
    this.m.set(k, v);
  }
  async removeItem(k: string) {
    this.m.delete(k);
  }
  async getAllKeys() {
    return [...this.m.keys()];
  }
}

const KEY = zufall(32);
const quelle = (k: Uint8Array | null = KEY) => ({ holen: async (anlegen: boolean) => k ?? (anlegen ? KEY : null) });
const ablage = (fs: SpeicherFs, alt: AltSpeicher, k: Uint8Array | null = KEY, teil?: number) => new StandAblage(fs, alt, quelle(k), () => zufall(12), teil);

describe("Kompakte Schreibweise: großer Text (Logo) nur einmal", () => {
  it("Logo in 300 Absender-Schnappschüssen steht einmal im JSON – Inhalt bleibt byte-gleich", () => {
    const s = grosserBetrieb(300);
    const voll = JSON.stringify(s);
    const kompakt = kompaktJson(s);
    expect(voll.length).toBeGreaterThan(300 * LOGO.length);
    expect(kompakt.length).toBeLessThan(voll.length / 50);
    const zurueck = standAus(kompakt);
    expect(zurueck).toEqual(standAus(voll));
    expect(zurueck.unterlagen.every((u) => u.absender?.logo === LOGO)).toBe(true);
  });

  it("Texte mit „\\u0000“ am Anfang bleiben, wie sie sind; ohne große Texte bleibt es beim gewohnten JSON", () => {
    const s = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "\u0000t0", ort: "\u0000\u0000x" } };
    expect(standAus(kompaktJson(s)).betrieb).toEqual(s.betrieb);
    const klein = { ...LEERER_STAND, betrieb: { ...LEERER_STAND.betrieb, name: "x".repeat(KOMPAKT_AB - 1) } };
    expect(kompaktJson(klein)).toBe(JSON.stringify(klein));
  });

  it("ältere App lehnt die kompakte Schreibweise als „neuere Version“ ab (statt einen leeren Stand zu sehen)", () => {
    const roh = JSON.parse(kompaktJson(grosserBetrieb(2))) as Record<string, unknown>;
    expect(istKompakt(roh)).toBe(true);
    // so hätte eine App vor E-194 gelesen: migrieren ohne Kenntnis des Formats
    expect(() => migrieren(roh)).toThrow(StandFehler);
    expect(() => kompaktAufloesen({ texte: [], stand: { a: "\u0000t5" } })).toThrow();
  });
});

describe("Teildateien: Speichern und Laden großer Stände", () => {
  it("zerlegen trennt nie ein Surrogatpaar", () => {
    const text = `a${"😀".repeat(10)}`;
    for (const n of [1, 2, 3, 4, 5]) {
      const teile = zerlegen(text, n);
      expect(teile.join("")).toBe(text);
      for (const x of teile) expect(() => utf8(x) && ausUtf8(utf8(x))).not.toThrow();
      expect(teile.every((x) => !/[\ud800-\udbff]$/.test(x))).toBe(true);
    }
  });

  it("12 MB Stand: Rundreise über eine neue Instanz, jede Datei klein, nichts im Klartext", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt);
    expect(await a.laden()).toEqual({ text: null, schluessel: KEY });
    // Klartext ohne Kompaktierung, damit er wirklich groß ist (Logo variiert je Rechnung)
    const s = grosserBetrieb(60);
    const gross = JSON.stringify({ ...s, unterlagen: s.unterlagen.map((u, i) => ({ ...u, absender: { ...u.absender!, logo: `${LOGO}${i}` } })) });
    expect(gross.length).toBeGreaterThan(12_000_000);
    await a.speichern(gross, KEY);
    expect(fs.groessterSchreibvorgang).toBeLessThanOrEqual(TEIL_HOECHSTENS);
    expect(fs.namen("").filter((n) => n.endsWith(".teil")).length).toBeGreaterThan(40);
    expect(fs.alles()).not.toContain("Salon Sonne");
    expect(fs.alles()).not.toContain("Kim Beispiel");
    expect(alt.m.size).toBe(0);
    const b = ablage(fs, alt);
    expect((await b.laden()).text).toBe(gross);
  });

  it("neue Generation je Speicherung; die beim Start geladene bleibt als „vorher“, ältere werden aufgeräumt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt, KEY, 10);
    await a.laden();
    await a.speichern('{"n":1,"x":"0123456789abcdef"}', KEY);
    const b = ablage(fs, alt, KEY, 10);
    expect((await b.laden()).text).toBe('{"n":1,"x":"0123456789abcdef"}');
    const gens = () => new Set(fs.namen("").filter((n) => n.endsWith(".teil")).map((n) => n.split("-")[0]));
    const geladen = [...gens()][0];
    for (let i = 2; i < 6; i++) await b.speichern(`{"n":${i},"x":"0123456789abcdef"}`, KEY);
    expect(gens().size).toBe(2);
    expect(gens().has(geladen)).toBe(true);
    const kopf = JSON.parse(ausUtf8(fs.dateien.get(KOPF)!)) as { vorher: { gen: string } };
    expect(kopf.vorher.gen).toBe(geladen);
    expect((await ablage(fs, alt).laden()).text).toBe('{"n":5,"x":"0123456789abcdef"}');
  });

  it("Abbruch mitten im Speichern: die bisherige Fassung gilt weiter, halbe Teile werden entfernt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt, KEY, 8);
    await a.laden();
    await a.speichern('{"fassung":"eins und mehr"}', KEY);
    const vorher = new Set(fs.dateien.keys());
    let n = 0;
    fs.scheitern = (name) => name.endsWith(".teil") && ++n === 2;
    await expect(a.speichern('{"fassung":"zwei und mehr"}', KEY)).rejects.toThrow();
    expect(new Set(fs.dateien.keys())).toEqual(vorher);
    fs.scheitern = (name) => name === `${KOPF}.neu`;
    await expect(a.speichern('{"fassung":"drei und mehr"}', KEY)).rejects.toThrow();
    fs.scheitern = null;
    expect((await ablage(fs, alt).laden()).text).toBe('{"fassung":"eins und mehr"}');
  });

  it("zwei Speicherungen kurz hintereinander überholen sich nie – die letzte gilt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt, KEY, 4);
    await a.laden();
    await Promise.all([a.speichern(`{"a":"${"x".repeat(400)}"}`, KEY), a.speichern('{"b":2}', KEY)]);
    expect((await ablage(fs, alt).laden()).text).toBe('{"b":2}');
  });

  it("Kopf verloren: die neueste vollständige Generation wird gefunden; Zwischenname des Kopfs zählt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt, KEY, 6);
    await a.laden();
    await a.speichern('{"v":"erste Fassung"}', KEY);
    await a.speichern('{"v":"zweite Fassung"}', KEY);
    const kopf = fs.dateien.get(KOPF)!;
    fs.dateien.delete(KOPF);
    expect((await ablage(fs, alt).laden()).text).toBe('{"v":"zweite Fassung"}');
    fs.dateien.delete(KOPF);
    fs.dateien.set(`${KOPF}.neu`, kopf);
    expect((await ablage(fs, alt).laden()).text).toBe('{"v":"zweite Fassung"}');
  });

  it("Schlüssel fehlt oder Teil beschädigt: Ladefehler, nichts wird verändert", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt);
    await a.laden();
    await a.speichern('{"x":1}', KEY);
    const vorher = new Map(fs.dateien);
    await expect(ablage(fs, alt, null).laden()).rejects.toMatchObject({ art: "schluessel" });
    await expect(ablage(fs, alt, zufall(32)).laden()).rejects.toBeInstanceOf(LadeFehler);
    fs.verfaelschen = (n) => n.endsWith(".teil");
    await expect(ablage(fs, alt).laden()).rejects.toMatchObject({ art: "unlesbar" });
    expect(fs.dateien).toEqual(vorher);
  });
});

describe("Umzug aus dem alten AsyncStorage-Eintrag", () => {
  const altStand = () => JSON.stringify(grosserBetrieb(3));

  it("verschlüsselter Eintrag: lesen → schreiben → Gegenprobe → Ersatzkopie → erst dann entfernen (auch Vorher und Beiseitegelegtes)", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const klar = altStand();
    const roh = tresorSchliessen(klar, KEY, zufall(12));
    alt.m.set(ALT_SCHLUESSEL, roh);
    alt.m.set(ALT_VORHER, roh);
    alt.m.set(`${ALT_BEISEITE}2026-01-01T00:00:00.000Z`, tresorSchliessen('{"alt":true}', KEY, zufall(12), "beiseite"));
    alt.m.set("amtlos.sicherungsordner.v1", '{"uri":"content://x"}');
    const r = await ablage(fs, alt).laden();
    expect(r.text).toBe(klar);
    expect([...alt.m.keys()]).toEqual(["amtlos.sicherungsordner.v1"]);
    expect(ausUtf8(fs.dateien.get(ERSATZKOPIE)!)).toBe(roh);
    expect(fs.namen("alt")).toContain("vorher.txt");
    expect(fs.namen("beiseite")).toHaveLength(1);
    expect(JSON.parse(ausUtf8(fs.dateien.get(KOPF)!))).toMatchObject({ alt: "migriert" });
    expect(fs.alles()).not.toContain("Salon Sonne");
    // wiederholbar: zweiter Start liest aus den Dateien
    expect((await ablage(fs, alt).laden()).text).toBe(klar);
    expect(await ablage(fs, alt).beiseitegelegteOeffnen([KEY])).toEqual(['{"alt":true}']);
  });

  it("unverschlüsselter alter Eintrag (vor E-129) wird verschlüsselt umgezogen – kein Klartext in Dateien", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const klar = altStand();
    alt.m.set(ALT_SCHLUESSEL, klar);
    expect((await ablage(fs, alt).laden()).text).toBe(klar);
    expect(alt.m.size).toBe(0);
    expect(istTresor(ausUtf8(fs.dateien.get(ERSATZKOPIE)!))).toBe(true);
    expect(fs.alles()).not.toContain("Salon Sonne");
  });

  it("Schreiben scheitert: alter Eintrag bleibt unberührt, Daten sind da; beim nächsten Speichern wird der Umzug nachgeholt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const klar = altStand();
    const roh = tresorSchliessen(klar, KEY, zufall(12));
    alt.m.set(ALT_SCHLUESSEL, roh);
    fs.scheitern = () => true;
    const a = ablage(fs, alt);
    expect((await a.laden()).text).toBe(klar);
    expect(alt.m.get(ALT_SCHLUESSEL)).toBe(roh);
    expect(fs.dateien.size).toBe(0);
    // Neustart ohne Erfolg: wieder aus dem alten Eintrag (idempotent)
    expect((await ablage(fs, alt).laden()).text).toBe(klar);
    fs.scheitern = null;
    await a.speichern('{"neu":true}', KEY);
    expect(alt.m.has(ALT_SCHLUESSEL)).toBe(false);
    expect(ausUtf8(fs.dateien.get(ERSATZKOPIE)!)).toBe(roh);
    expect((await ablage(fs, alt).laden()).text).toBe('{"neu":true}');
  });

  it("Gegenprobe scheitert (Datei liest sich anders zurück): kein Umzug, alter Eintrag bleibt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const klar = altStand();
    alt.m.set(ALT_SCHLUESSEL, tresorSchliessen(klar, KEY, zufall(12)));
    fs.verfaelschen = (n) => n.endsWith(".teil");
    expect((await ablage(fs, alt).laden()).text).toBe(klar);
    expect(alt.m.has(ALT_SCHLUESSEL)).toBe(true);
    expect(fs.dateien.has(KOPF)).toBe(false);
    expect(fs.namen("").filter((n) => n.endsWith(".teil"))).toEqual([]);
  });

  it("alter Eintrag zu groß für das CursorWindow (Android): klarer Ladefehler, nichts überschrieben, Neubeginn möglich, Eintrag bleibt", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage(2 * 1024 * 1024, 100 * 1024 * 1024);
    const s = grosserBetrieb(12);
    const roh = tresorSchliessen(JSON.stringify(s), KEY, zufall(12));
    expect(roh.length).toBeGreaterThan(2 * 1024 * 1024);
    alt.m.set(ALT_SCHLUESSEL, roh);
    await expect(ablage(fs, alt).laden()).rejects.toMatchObject({ art: "zu_gross" });
    expect(alt.m.get(ALT_SCHLUESSEL)).toBe(roh);
    expect(fs.dateien.size).toBe(0);
    // „Sicherung wiederherstellen“ / „Neu beginnen“: beiseitelegen – der zu große Eintrag bleibt stehen
    const a = ablage(fs, alt);
    await a.beiseitelegen(KEY);
    expect(alt.m.get(ALT_SCHLUESSEL)).toBe(roh);
    expect(await a.beiseitegelegtVorhanden()).toBe(true);
    // danach startet die App mit leerem bzw. wiederhergestelltem Stand – nicht wieder mit dem Ladefehler
    const b = ablage(fs, alt);
    expect((await b.laden()).text).toBeNull();
    await b.speichern('{"wiederhergestellt":true}', KEY);
    expect((await ablage(fs, alt).laden()).text).toBe('{"wiederhergestellt":true}');
    expect(alt.m.get(ALT_SCHLUESSEL)).toBe(roh);
    // „Alle Daten löschen“ nach dem Ladefehler lässt ihn ebenfalls stehen
    await b.allesLoeschen(true);
    expect(alt.m.get(ALT_SCHLUESSEL)).toBe(roh);
    // lässt er sich später lesen (z. B. größere Grenze), wird er geöffnet und als Datei beiseitegelegt
    const spaeter = new AndroidAsyncStorage(100 * 1024 * 1024, 100 * 1024 * 1024);
    spaeter.m = alt.m;
    const texte = await ablage(fs, spaeter).beiseitegelegteOeffnen([KEY]);
    expect(texte.some((x) => standAus(x).unterlagen.length === 12)).toBe(true);
    expect(spaeter.m.has(ALT_SCHLUESSEL)).toBe(false);
  });

  it("alter Eintrag unlesbar (falscher Schlüssel, kaputt): Ladefehler, nie ein leerer Stand, nichts geschrieben", async () => {
    for (const roh of [tresorSchliessen('{"a":1}', zufall(32), zufall(12)), "{kaputt", '"nur ein Text"']) {
      const fs = new SpeicherFs();
      const alt = new AndroidAsyncStorage();
      alt.m.set(ALT_SCHLUESSEL, roh);
      await expect(ablage(fs, alt).laden()).rejects.toBeInstanceOf(LadeFehler);
      expect(alt.m.get(ALT_SCHLUESSEL)).toBe(roh);
      expect(fs.dateien.size).toBe(0);
    }
    // verschlüsselt, aber Schlüssel fehlt
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    alt.m.set(ALT_SCHLUESSEL, tresorSchliessen('{"a":1}', KEY, zufall(12)));
    await expect(ablage(fs, alt, null).laden()).rejects.toMatchObject({ art: "schluessel" });
  });

  it("weder Kopf noch Teile, aber eine Ersatzkopie vom Umzug: Ladefehler statt leerer Stand", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    alt.m.set(ALT_SCHLUESSEL, tresorSchliessen('{"a":1}', KEY, zufall(12)));
    await ablage(fs, alt).laden();
    for (const n of [...fs.dateien.keys()]) if (!n.startsWith("alt/")) fs.dateien.delete(n);
    await expect(ablage(fs, alt).laden()).rejects.toMatchObject({ art: "unlesbar" });
  });

  it("nach dem Umzug schreibt eine ältere App erneut in den alten Eintrag: wird beiseitegelegt, nicht verworfen", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    alt.m.set(ALT_SCHLUESSEL, tresorSchliessen('{"a":1}', KEY, zufall(12)));
    await ablage(fs, alt).laden();
    alt.m.set(ALT_SCHLUESSEL, tresorSchliessen('{"a":2}', KEY, zufall(12)));
    expect((await ablage(fs, alt).laden()).text).toBe('{"a":1}');
    expect(alt.m.has(ALT_SCHLUESSEL)).toBe(false);
    expect(await ablage(fs, alt).beiseitegelegteOeffnen([KEY])).toContain('{"a":2}');
  });

  it("Ladefehler beiseitelegen: Teile und alter Eintrag kommen nach „beiseite“ und lassen sich mit dem Schlüssel öffnen; „Alles löschen“ entfernt alles", async () => {
    const fs = new SpeicherFs();
    const alt = new AndroidAsyncStorage();
    const a = ablage(fs, alt);
    await a.laden();
    await a.speichern('{"teil":"neu"}', KEY);
    alt.m.set(ALT_VORHER, '{"vorher":"klar"}');
    const b = ablage(fs, alt, null);
    await expect(b.laden()).rejects.toMatchObject({ art: "schluessel" });
    await b.beiseitelegen(KEY);
    expect(fs.namen("").filter((n) => n.endsWith(".teil"))).toEqual([]);
    expect(alt.m.size).toBe(0);
    expect(fs.alles()).not.toContain("klar");
    const texte = await b.beiseitegelegteOeffnen([zufall(32), KEY]);
    expect(texte).toEqual(expect.arrayContaining(['{"teil":"neu"}', '{"vorher":"klar"}']));
    await b.allesLoeschen(false);
    expect(fs.dateien.size).toBe(0);
    expect(await b.beiseitegelegtVorhanden()).toBe(false);
  });
});

// ---- Sicherungsdatei als Container (Version 3)

/** Schreiber im Speicher: merkt sich die Stücke und den größten Puffer. */
class SpeicherSchreiber {
  stuecke: Uint8Array[] = [];
  groesster = 0;
  async schreiben(b: Uint8Array) {
    this.groesster = Math.max(this.groesster, b.length);
    this.stuecke.push(b.slice());
  }
  bytes(): Uint8Array {
    return Uint8Array.from(Buffer.concat(this.stuecke));
  }
}
/** Leser über einem Puffer; merkt sich die größte Anfrage. */
function leserAus(bytes: Uint8Array, statistik = { groesste: 0, geoeffnet: 0 }): () => Promise<Leser> {
  return async () => {
    statistik.geoeffnet++;
    let pos = 0;
    return {
      lesen: async (n: number) => {
        statistik.groesste = Math.max(statistik.groesste, n);
        const b = bytes.subarray(pos, Math.min(bytes.length, pos + n));
        pos += b.length;
        return b;
      },
    };
  };
}
/** deterministische „Fotos“, ohne alle gleichzeitig zu halten */
const foto = (name: string, groesse: number) => {
  const b = new Uint8Array(groesse);
  let x = createHash("sha256").update(name).digest().readUInt32LE(0) || 1;
  for (let i = 0; i < groesse; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    b[i] = x & 255;
  }
  return b;
};
const hash = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const K = schluesselAusPasswort("sonnenschein-2026", zufall, 1000);

describe("Sicherungsdatei Version 3: Stück für Stück, nie alles im Speicher", () => {
  it("50 MB Belegfotos: Rundreise; kein Puffer größer als ein Datensatz; Dateien einzeln abgelegt", async () => {
    const namen = Array.from({ length: 25 }, (_, i) => `lx9k${String(i).padStart(4, "0")}ab.jpg`);
    const groesse = (i: number) => 2_000_000 + i * 1000;
    let s = grosserBetrieb(50);
    for (const [i, n] of namen.entries()) s = belegSetzen(s, { id: `b${i}`, datum: "2026-03-03", lieferant: "Friseurbedarf Müller", nummer: `L-${i}`, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 1190 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: n, quelle: "foto", erstellt: "2026-03-03T08:00:00Z", geaendert: "2026-03-03T08:00:00Z" }, t("2026-03-03"));
    const w = new SpeicherSchreiber();
    let gelesenGleichzeitig = 0;
    let offen = 0;
    const fortschritt: number[] = [];
    const { fehlend } = await containerSchreiben(
      w,
      s,
      K,
      zufall,
      {
        namen: [...namen, "lx9kfehlt00.jpg"],
        lesen: async (n) => {
          offen++;
          gelesenGleichzeitig = Math.max(gelesenGleichzeitig, offen);
          const i = namen.indexOf(n);
          offen--;
          return i < 0 ? null : foto(n, groesse(i));
        },
      },
      new Date(),
      (n) => fortschritt.push(n),
    );
    expect(fehlend).toEqual(["lx9kfehlt00.jpg"]);
    expect(gelesenGleichzeitig).toBe(1);
    expect(fortschritt.at(-1)).toBe(26);
    expect(w.groesster).toBeLessThanOrEqual(DATENSATZ_HOECHSTENS);
    const bytes = w.bytes();
    expect(bytes.length).toBeGreaterThan(50_000_000);
    expect(bytes.length).toBeLessThan(52_000_000); // kein Base64 mehr: kaum größer als die Fotos
    const text = Buffer.from(bytes).toString("latin1");
    expect(text.startsWith(ausUtf8(CONTAINER_KENNUNG))).toBe(true);
    expect(text).toContain('"AES-256-GCM"');
    for (const geheim of ["Salon Sonne", "Kim Beispiel", "143/123/45678"]) expect(text).not.toContain(geheim);

    const statistik = { groesste: 0, geoeffnet: 0 };
    const g = await containerOeffnen(leserAus(bytes, statistik), "sonnenschein-2026");
    expect(g.version).toBe(3);
    expect(g.stand.unterlagen).toHaveLength(50);
    expect(g.stand.belege).toHaveLength(25);
    expect(g.stand.betrieb.logo).toBe(LOGO);
    const abgelegt = new Map<string, string>();
    let groessteDatei = 0;
    const r = await g.dateien(
      async (n) => n !== namen[0],
      async (n, b) => {
        groessteDatei = Math.max(groessteDatei, b.length);
        abgelegt.set(n, hash(b));
      },
    );
    expect(r.fehler).toBe(0);
    expect(abgelegt.size).toBe(24);
    for (const [i, n] of namen.entries()) if (i > 0) expect(abgelegt.get(n)).toBe(hash(foto(n, groesse(i))));
    expect(groessteDatei).toBe(groesse(24));
    expect(statistik.groesste).toBeLessThanOrEqual(DATENSATZ_HOECHSTENS);
    expect(statistik.geoeffnet).toBe(2);
    expect(TEIL_BYTES).toBeLessThan(DATENSATZ_HOECHSTENS);
  }, 120_000);

  it("falsches Passwort, veränderter Kopf, vertauschte Datensätze, keine Sicherung", async () => {
    const w = new SpeicherSchreiber();
    await containerSchreiben(w, grosserBetrieb(2), K, zufall, { namen: ["lx9kabc123.jpg"], lesen: async () => foto("a", 1_200_000) });
    const bytes = w.bytes();
    const art = async (b: Uint8Array, pw = "sonnenschein-2026") => {
      try {
        await containerOeffnen(leserAus(b), pw);
        return "ok";
      } catch (e) {
        return e instanceof SicherungsFehler ? e.art : String(e);
      }
    };
    expect(await art(bytes)).toBe("ok");
    expect(await art(bytes, "falsches-passwort-1")).toBe("passwort");
    const kopf = bytes.slice();
    const i = Buffer.from(kopf).indexOf("2026-");
    kopf[i + 3] = kopf[i + 3]! ^ 1; // Erstellt-Datum im Kopf geändert
    expect(await art(kopf)).toBe("passwort");
    expect(await art(utf8("{}"))).toBe("format");
    expect(await art(bytes.subarray(0, 30))).toBe("format");
  });

  it("abgeschnittene oder beschädigte Datei: Stand lesbar, fehlende Belegdateien werden als Fehler gezählt", async () => {
    const namen = ["lx9kaaaa11.jpg", "lx9kbbbb22.jpg", "lx9kcccc33.jpg"];
    let s = grosserBetrieb(1);
    for (const [i, n] of namen.entries()) s = belegSetzen(s, { id: `b${i}`, datum: "2026-03-03", lieferant: "X", nummer: null, kategorie: "waren", steuer: [{ satz: 19, brutto_cent: 100 }], vorsteuer: true, zahlung: "bank", bezahlt: null, notiz: null, datei: n, quelle: "foto", erstellt: "2026-03-03T08:00:00Z", geaendert: "2026-03-03T08:00:00Z" }, t("2026-03-03"));
    const w = new SpeicherSchreiber();
    await containerSchreiben(w, s, K, zufall, { namen, lesen: async (n) => foto(n, 700_000) });
    const bytes = w.bytes();
    const abgeschnitten = bytes.subarray(0, bytes.length - 800_000);
    const g = await containerOeffnen(leserAus(abgeschnitten), "sonnenschein-2026");
    const da: string[] = [];
    const r = await g.dateien(async () => true, async (n) => void da.push(n));
    expect(da).toEqual([namen[0]]);
    expect(r.fehler).toBe(2);
    // eine Datei, die sich nicht ablegen lässt, zählt ebenfalls (G4)
    const g2 = await containerOeffnen(leserAus(bytes), "sonnenschein-2026");
    expect((await g2.dateien(async () => true, async (n) => { if (n === namen[1]) throw new Error("voll"); })).fehler).toBe(1);
  });
});

describe("Alte Sicherungen bleiben lesbar (Version 1 und 2, Dateien aus der Zeit vor E-194)", () => {
  const lies = (n: string) => fs.readFileSync(path.join(FIXTURES, n), "utf8");

  it("Version 2 (Stand und Belegfotos als Base64) – Stand und Foto kommen zurück, einzeln abgelegt", async () => {
    const g = textSicherungOeffnen(lies("sicherung-v2-alt.amtlos"), "sonnenschein-2026");
    expect(g.version).toBe(2);
    expect(g.stand.betrieb.name).toBe("Salon Sonne");
    expect(g.stand.unterlagen).toHaveLength(3);
    expect(g.stand.belege[0]?.datei).toBe("lx9kabc123.jpg");
    expect(g.stand.steuerberatung.kontenrahmen).toBe("SKR04");
    const abgelegt: [string, Uint8Array][] = [];
    expect((await g.dateien(async () => true, async (n, b) => void abgelegt.push([n, b]))).fehler).toBe(0);
    expect(abgelegt).toHaveLength(1);
    expect(abgelegt[0]![1]).toEqual(new Uint8Array(3000).map((_, i) => (i * 7) & 255));
    expect(() => textSicherungOeffnen(lies("sicherung-v2-alt.amtlos"), "falsches-passwort-1")).toThrow(SicherungsFehler);
  });

  it("Version 1 (nur der Stand) – Belegdateien der automatischen Sicherung werden je Datei nachgeladen", async () => {
    const g = textSicherungOeffnen(lies("sicherung-v1-alt.amtlos"), "sonnenschein-2026");
    expect(g.version).toBe(1);
    expect(g.stand.unterlagen.every((u) => u.absender?.name === "Salon Sonne")).toBe(true);
    const nachgeladen: string[] = [];
    const q = belegeErgaenzt(g, g.stand, async (n) => (nachgeladen.push(n), new Uint8Array([1, 2, 3])));
    const abgelegt: string[] = [];
    expect((await q.dateien(async () => true, async (n) => void abgelegt.push(n))).fehler).toBe(0);
    expect(nachgeladen).toEqual(["lx9kabc123.jpg"]);
    expect(abgelegt).toEqual(["lx9kabc123.jpg"]);
  });

  it("automatische Sicherung (Version 1) mit kompaktem Stand: gleiche Datei, Logo nur einmal, Rundreise", () => {
    const s = grosserBetrieb(200);
    const text = sicherungMitSchluessel(s, K, zufall);
    expect(text.length).toBeLessThan(JSON.stringify(s).length / 20);
    expect(sicherungLesen(text, "sonnenschein-2026")).toEqual(standAus(JSON.stringify(s)));
  });
});

describe("Anbindung in der App (Quelltext)", () => {
  const src = (p: string) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src", p), "utf8");

  it("der Stand geht nicht mehr über AsyncStorage, sondern über die Teildateien; die Web-Vorschau bleibt im Browser", () => {
    const z = src("zustand.tsx");
    expect(z).not.toContain("AsyncStorage.");
    expect(z).toContain("standSpeicher.laden()");
    expect(z).toContain("standSpeicher.speichern(json, k)");
    expect(z).toContain("kompaktJson(aktuell.current)");
    expect(src("unterlagen/standSpeicher.web.ts")).toContain("AsyncStorage.setItem(ALT_SCHLUESSEL, text)");
  });

  it("Sicherung als Datei schreibt den Container Stück für Stück; Wiederherstellen spielt Belegdateien einzeln ein", () => {
    const q = src("seiten/Sicherung.tsx");
    expect(q).toContain("sicherungTeilen(");
    expect(q).toContain("containerSchreiben(");
    expect(q).toContain("containerOeffnen(datei.leser, pw)");
    expect(q).not.toContain("sicherungErstellen(");
    expect(q).not.toContain("dateienFuerSicherung");
  });

  it("expo-file-system (SDK 58): `write` ist asynchron – Belegdateien und Sicherungsdateien warten darauf", () => {
    for (const d of ["unterlagen/dateien.ts", "unterlagen/sicherungDatei.ts", "unterlagen/standSpeicher.ts"]) {
      for (const zeile of src(d).split("\n").filter((x) => /\.write\(/.test(x))) expect(zeile).toMatch(/await /);
    }
  });
});
