import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { KernController, OPENAPI } from "../src/kern.controller.js";
import { PflichtenController } from "../src/pflichten.controller.js";
import { TeamController } from "../src/team.controller.js";
import { ElsterController } from "../src/elster.controller.js";
import { FinanzenController } from "../src/finanzen.controller.js";

// Schlüssel wie in @nestjs/common/constants (nicht als Typ exportiert)
const PATH_METADATA = "path";
const METHOD_METADATA = "method";

/** Liest die Routen samt Rollen aus den Nest-Metadaten – dieselbe Quelle, die der AuthGuard benutzt. */
function routen() {
  const liste: { schluessel: string; rollen: string[] | null; oeffentlich: boolean; unternehmen: boolean }[] = [];
  // BetriebController (/metriken) ist bewusst nicht beschrieben: intern, nur für Prometheus.
  for (const c of [KernController, PflichtenController, TeamController, ElsterController, FinanzenController]) {
    const basis = Reflect.getMetadata(PATH_METADATA, c) as string;
    for (const name of Object.getOwnPropertyNames(c.prototype)) {
      const f = (c.prototype as unknown as Record<string, object>)[name]!;
      const pfad = Reflect.getMetadata(PATH_METADATA, f) as string | undefined;
      if (pfad === undefined || name === "constructor") continue;
      const methode = RequestMethod[Reflect.getMetadata(METHOD_METADATA, f) as number]!.toLowerCase();
      const voll = `/${basis}/${pfad}`.replace(/:([A-Za-z]+)/g, "{$1}");
      liste.push({
        schluessel: `${methode} ${voll}`,
        rollen: (Reflect.getMetadata("amtlos:rollen", f) as string[] | undefined) ?? null,
        oeffentlich: Reflect.getMetadata("amtlos:oeffentlich", f) === true,
        unternehmen: Reflect.getMetadata("amtlos:unternehmen", f) === true,
      });
    }
  }
  return liste;
}

type Op = { "x-rollen"?: string[]; security?: unknown[]; parameters?: { $ref?: string; name?: string; in?: string }[]; responses?: object };
const ops = () => {
  const m = new Map<string, Op>();
  for (const [pfad, eintrag] of Object.entries(OPENAPI.paths as Record<string, Record<string, Op>>))
    for (const [methode, op] of Object.entries(eintrag)) m.set(`${methode} ${pfad}`, op);
  return m;
};

describe("OpenAPI-Beschreibung passt zu den Routen", () => {
  const r = routen();
  const o = ops();

  it("kennt jede Route und keine erfundene", () => {
    expect([...o.keys()].sort()).toEqual(r.map((x) => x.schluessel).sort());
    expect(r.length).toBeGreaterThanOrEqual(25);
  });

  it("nennt dieselben Rollen, Mandanten-Header und öffentlichen Routen", () => {
    for (const x of r) {
      const op = o.get(x.schluessel)!;
      expect(op["x-rollen"] ?? null, `${x.schluessel}: x-rollen`).toEqual(x.rollen);
      expect(Array.isArray(op.security) && op.security.length === 0, `${x.schluessel}: security []`).toBe(x.oeffentlich);
      const mitHeader = (op.parameters ?? []).some((p) => p.$ref === "#/components/parameters/Unternehmen");
      expect(mitHeader, `${x.schluessel}: X-Unternehmen-Id`).toBe(x.unternehmen);
      expect(op.responses, `${x.schluessel}: responses`).toBeTruthy();
    }
  });

  it("alle $ref-Verweise lösen sich auf", () => {
    const text = JSON.stringify(OPENAPI);
    for (const [, ref] of text.matchAll(/"\$ref":"#\/([^"]+)"/g)) {
      const ziel = ref!.split("/").reduce<unknown>((o2, k) => (o2 as Record<string, unknown> | undefined)?.[k], OPENAPI);
      expect(ziel, ref).toBeDefined();
    }
  });
});
