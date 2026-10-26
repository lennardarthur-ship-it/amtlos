/**
 * E-209 (Befund 10 der externen Prüfung): Beim Einrichten der automatischen Sicherung (neues iPhone, Android-Ordner bei
 * einem Cloud-Anbieter) darf eine vorhandene Sicherung, die sich gerade nicht lesen lässt (iCloud-Platzhalter
 * „.<Name>.icloud“, Lesefehler, 0 Byte), nie überschrieben werden. Ablauf mit einer Ablage im Speicher.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MARKE } from "@amtlos/marke";
import * as logik from "../src/unterlagen/cloudLogik";
import type { Ablage } from "../src/unterlagen/cloudLogik";
import { schluesselAusPasswort, sicherungMitSchluessel } from "../src/unterlagen/sicherung";
import { LEERER_STAND, betriebSetzen } from "../src/unterlagen/speicher";

const APP = path.resolve(__dirname, "..");
const lies = (p: string) => readFileSync(path.join(APP, p), "utf8");

/** Ablage im Speicher; `unlesbar`: Pfade, deren Lesen fehlschlägt (z. B. noch nicht aus iCloud geladen). */
function speicherAblage() {
  const dateien = new Map<string, string>();
  const ordner = new Set<string>([""]);
  const unlesbar = new Set<string>();
  const angestossen: string[] = [];
  const eltern = (p: string) => p.slice(0, p.lastIndexOf("/"));
  const a: Ablage = {
    exists: async (p) => dateien.has(p) || ordner.has(p),
    mkdir: async (p) => void ordner.add(p),
    readdir: async (p) => [...new Set([...dateien.keys(), ...ordner].filter((x) => x !== p && eltern(x) === p).map((x) => x.slice(p.length + 1)))],
    readFile: async (p) => {
      const t = dateien.get(p);
      if (t === undefined || unlesbar.has(p)) throw new Error("nicht lesbar");
      return t;
    },
    writeFile: async (p, t) => {
      if (!ordner.has(eltern(p))) throw new Error(`Ordner fehlt: ${eltern(p)}`);
      dateien.set(p, t);
    },
    unlink: async (p) => void dateien.delete(p),
    rmdir: async (p) => void ordner.delete(p),
    herunterladen: async (p) => void angestossen.push(p),
  };
  return { a, dateien, ordner, unlesbar, angestossen };
}

const zufall = (n: number) => new Uint8Array(randomBytes(n));
const kAlt = schluesselAusPasswort("passwort-des-alten-iphones", zufall, 1000);
const kNeu = schluesselAusPasswort("passwort-des-neuen-iphones", zufall, 1000);
const sicherung = (name: string, k = kNeu) => sicherungMitSchluessel(betriebSetzen(LEERER_STAND, { ...LEERER_STAND.betrieb, name }), k, zufall, new Date("2026-10-25T10:00:00Z"));
const ICLOUD = "/Amtlos";
const AKTUELL = `${ICLOUD}/${MARKE.name}-Sicherung-aktuell.amtlos`;
const PLATZHALTER = `${ICLOUD}/.${MARKE.name}-Sicherung-aktuell.amtlos.icloud`;
const JETZT = new Date("2026-10-26T08:00:00+01:00");
const sofort = { versuche: 3, warten: async () => undefined };

describe("E-209: Einrichten über eine vorhandene, nicht lesbare Sicherung", () => {
  it("Lesefehler (nicht geladen): `schreiben` überschreibt die vorhandene Sicherung nicht und stößt das Laden an", async () => {
    const { a, dateien, unlesbar, angestossen, ordner } = speicherAblage();
    ordner.add(ICLOUD);
    const alt = sicherung("Altes iPhone", kAlt);
    dateien.set(AKTUELL, alt);
    unlesbar.add(AKTUELL);
    await expect(logik.schreiben({ ablage: a, ordner: ICLOUD }, sicherung("Neues iPhone"), JETZT)).rejects.toBeInstanceOf(logik.SicherungUnlesbar);
    expect(dateien.get(AKTUELL)).toBe(alt);
    // nichts anderes geschrieben (keine Tages- oder Wochen-Sicherung mit dem neuen Stand)
    expect([...dateien.keys()]).toEqual([AKTUELL]);
    expect(angestossen).toContain(AKTUELL);
  });

  it("0 Byte (Cloud-Anbieter auf Android liefert noch nichts): nicht überschreiben", async () => {
    const { a, dateien } = speicherAblage();
    const pfad = `/${MARKE.name}-Sicherung-aktuell.amtlos`;
    dateien.set(pfad, "");
    await expect(logik.schreiben({ ablage: a, ordner: "", ersatzAusWoche: true }, sicherung("Neu"), JETZT)).rejects.toMatchObject({ grund: "leer" });
    expect(dateien.get(pfad)).toBe("");
    expect(dateien.size).toBe(1);
  });

  it("nur der iCloud-Platzhalter „.<Name>.icloud“ liegt da: nicht überschreiben, Laden anstoßen", async () => {
    const { a, dateien, ordner, angestossen } = speicherAblage();
    ordner.add(ICLOUD);
    dateien.set(PLATZHALTER, "bplist-platzhalter");
    await expect(logik.schreiben({ ablage: a, ordner: ICLOUD }, sicherung("Neu"), JETZT)).rejects.toMatchObject({ grund: "platzhalter" });
    expect(dateien.has(AKTUELL)).toBe(false);
    expect(angestossen).toContain(AKTUELL);
  });

  it("vorhandeneSicherung: Platzhalter, Lesefehler und 0 Byte heißen „unlesbar“, nie „keine“", async () => {
    const p = speicherAblage();
    p.ordner.add(ICLOUD);
    p.dateien.set(PLATZHALTER, "x");
    expect(await logik.vorhandeneSicherung({ ablage: p.a, ordner: ICLOUD }, sofort)).toEqual({ art: "unlesbar", pfad: AKTUELL, grund: "platzhalter" });
    expect(p.angestossen.length).toBeGreaterThan(0);

    const f = speicherAblage();
    f.ordner.add(ICLOUD);
    f.dateien.set(AKTUELL, sicherung("Alt", kAlt));
    f.unlesbar.add(AKTUELL);
    expect(await logik.vorhandeneSicherung({ ablage: f.a, ordner: ICLOUD }, sofort)).toMatchObject({ art: "unlesbar", grund: "fehler" });
    // die alte Fehlerbehandlung („lesen“ → null) hätte das als „keine Sicherung“ gelesen
    expect(await logik.lesen({ ablage: f.a, ordner: ICLOUD })).toBeNull();

    const l = speicherAblage();
    l.ordner.add(ICLOUD);
    l.dateien.set(AKTUELL, "   ");
    expect(await logik.vorhandeneSicherung({ ablage: l.a, ordner: ICLOUD }, sofort)).toMatchObject({ art: "unlesbar", grund: "leer" });

    const k = speicherAblage();
    expect(await logik.vorhandeneSicherung({ ablage: k.a, ordner: ICLOUD }, sofort)).toEqual({ art: "keine" });
  });

  it("vorhandeneSicherung wartet: wird die Datei während der Versuche geladen, ist sie „lesbar“", async () => {
    const { a, dateien, ordner, unlesbar } = speicherAblage();
    ordner.add(ICLOUD);
    const alt = sicherung("Alt", kAlt);
    dateien.set(AKTUELL, alt);
    unlesbar.add(AKTUELL);
    let gewartet = 0;
    const r = await logik.vorhandeneSicherung({ ablage: a, ordner: ICLOUD }, { versuche: 4, warten: async () => void (++gewartet === 2 && unlesbar.delete(AKTUELL)) });
    expect(r).toEqual({ art: "lesbar", pfad: AKTUELL, text: alt });
  });

  it("ausdrücklich „Ersetzen“ gewählt: dann wird geschrieben", async () => {
    const { a, dateien, ordner, unlesbar } = speicherAblage();
    ordner.add(ICLOUD);
    dateien.set(AKTUELL, sicherung("Alt", kAlt));
    unlesbar.add(AKTUELL);
    const neu = sicherung("Neu");
    await logik.schreiben({ ablage: a, ordner: ICLOUD }, neu, JETZT, { ersetzen: true });
    expect(dateien.get(AKTUELL)).toBe(neu);
  });

  it("lesbar, aber mit anderem Schlüssel (altes Gerät, anderes Passwort): wird vor dem Überschreiben beiseitegelegt", async () => {
    const { a, dateien, ordner } = speicherAblage();
    ordner.add(ICLOUD);
    const alt = sicherung("Alt", kAlt);
    dateien.set(AKTUELL, alt);
    const neu = sicherung("Neu");
    await logik.schreiben({ ablage: a, ordner: ICLOUD }, neu, JETZT);
    expect(dateien.get(AKTUELL)).toBe(neu);
    const vorher = [...dateien.entries()].filter(([n]) => /-Sicherung-vorher-/.test(n));
    expect(vorher.map(([, t]) => t)).toEqual([alt]);
    // gleicher Schlüssel (das eigene Gerät): nichts beiseitegelegt
    await logik.schreiben({ ablage: a, ordner: ICLOUD }, sicherung("Neu 2"), new Date("2026-10-26T09:00:00+01:00"));
    expect([...dateien.keys()].filter((n) => /-Sicherung-vorher-/.test(n))).toHaveLength(1);
  });

  it("beiseitelegen in derselben Minute überschreibt keine schon beiseitegelegte Sicherung; es bleiben die letzten drei", async () => {
    const { a, dateien, ordner } = speicherAblage();
    ordner.add(ICLOUD);
    for (const t of ["eins", "zwei"]) await logik.beiseitelegen({ ablage: a, ordner: ICLOUD }, t, JETZT);
    expect([...dateien.values()].sort()).toEqual(["eins", "zwei"]);
    expect(logik.zuLoeschen(["X-Sicherung-vorher-2026-10-26T07-00.amtlos", "X-Sicherung-vorher-2026-10-26T07-00-2.amtlos", "X-Sicherung-vorher-2026-10-26T07-00-3.amtlos", "X-Sicherung-vorher-2026-10-26T07-01.amtlos"])).toEqual(["X-Sicherung-vorher-2026-10-26T07-00.amtlos"]);
  });

  it("die Einrichtung prüft die vorhandene Sicherung mit `cloudVorhanden` und schreibt bei „unlesbar“ nichts", () => {
    const s = lies("src/seiten/Sicherung.tsx");
    const los = s.slice(s.indexOf("const los = async (ersetzen = false)"), s.indexOf("return (", s.indexOf("const los = async (ersetzen = false)")));
    expect(los).toMatch(/await cloudVorhanden\(\)/);
    expect(los).toMatch(/if \(v\.art === "unlesbar"\) \{\s*setUnlesbar\(true\);\s*return;/);
    expect(los).not.toMatch(/cloudLesen\(/);
    // ersetzen nur nach ausdrücklicher Bestätigung
    expect(s).toMatch(/bestaetigen\(\{ titel: TEXT\.sicherung_unlesbar_ersetzen_wirklich[^]*?if \(ok\) void los\(true\)/);
    for (const f of ["cloud.ts", "cloud.android.ts", "cloud.web.ts"]) expect(lies(`src/unterlagen/${f}`)).toMatch(/export async function cloudVorhanden\(/);
    expect(lies("src/unterlagen/cloud.ts")).toMatch(/herunterladen: \(p\) => CloudStorage\.triggerSync\(p, d\)/);
  });
});
