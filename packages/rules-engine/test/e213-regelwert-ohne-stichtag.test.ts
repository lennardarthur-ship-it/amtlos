/**
 * E-213: Regelwert ohne Stichtag (`gueltig_ab: null`). Zwei Prüfer haben „gültig ab“ ausdrücklich offen gelassen bzw. ohne
 * Datum bestätigt – Entgelttransparenz (kein deutsches Umsetzungsgesetz) und Ersthelfer (seit Inkrafttreten der DGUV
 * Vorschrift 1 beim jeweiligen Träger). Ohne Stichtag gilt der Wert ohne bekannten Anfang; ein Ende (`gueltig_bis`) und
 * eine spätere Version mit Datum begrenzen ihn wie sonst. Der Validator lehnt Überlappungen weiter ab.
 */
import { describe, expect, it } from "vitest";
import { Regelwerte } from "../src/index.js";
import { ladeKatalog } from "./hilfen.js";

describe("E-213: Regelwert ohne Stichtag", () => {
  it("gilt ohne bekannten Anfang, bis zum Ende bzw. bis zur nächsten Version", () => {
    const rw = new Regelwerte([
      { id: "x.y", version: 1, wert: 1, gueltig_ab: null, gueltig_bis: "2026-12-31" },
      { id: "x.y", version: 2, wert: 2, gueltig_ab: "2027-01-01", gueltig_bis: null },
      { id: "a.b", version: 1, wert: 150, gueltig_ab: null, gueltig_bis: null },
    ]);
    expect(rw.zumStichtag("x.y", "1990-01-01")?.wert).toBe(1);
    expect(rw.zumStichtag("x.y", "2026-10-26")?.wert).toBe(1);
    expect(rw.zumStichtag("x.y", "2027-01-01")?.wert).toBe(2);
    expect(rw.zumStichtag("a.b", "2026-10-26")).toEqual({ id: "a.b", version: 1, wert: 150 });
  });

  it("im Katalog: Entgelttransparenz und Ersthelfer ohne Stichtag, gelten heute", () => {
    const k = ladeKatalog();
    for (const id of ["personal.entgelttransparenz.berichtspflicht_schwelle", "arbeitsschutz.ersthelfer.schwelle_versicherte"]) {
      const v = k.regelwerte.filter((r) => r.id === id);
      expect(v.map((r) => [r.version, r.gueltig_ab]), id).toEqual([[2, null]]);
      expect(new Regelwerte(k.regelwerte).zumStichtag(id, "2026-10-26")?.version, id).toBe(2);
    }
  });
});
