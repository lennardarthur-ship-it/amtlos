import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import type { Katalog, Pflicht, RegelwertVersion } from "../src/index.js";

export const KATALOG_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../catalog");

const yamlDateien = (dir: string) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort().map((f) => path.join(dir, f)) : [];

export function ladeKatalog(): Katalog {
  const pflichten = yamlDateien(path.join(KATALOG_DIR, "pflichten")).map((f) => YAML.parse(fs.readFileSync(f, "utf8")) as Pflicht);
  const regelwerte = yamlDateien(path.join(KATALOG_DIR, "regelwerte")).flatMap((f) => {
    const x = YAML.parse(fs.readFileSync(f, "utf8")) as RegelwertVersion | RegelwertVersion[];
    return Array.isArray(x) ? x : [x];
  });
  return { pflichten, regelwerte };
}

export interface Fixture {
  datei: string;
  persona: string;
  beschreibung?: string;
  stichtag: string;
  fakten: Record<string, unknown>;
  ereignisse?: { typ: string; datum: string; storniert?: boolean }[];
  erwartet: Record<string, "gilt" | "gilt_nicht" | "unbekannt">;
  termine_enthaelt?: Record<string, [string, string][]>;
  fehlende_fakten?: Record<string, string[]>;
}

export function ladeFixtures(): Fixture[] {
  return yamlDateien(path.join(KATALOG_DIR, "fixtures")).map((f) => ({ datei: path.basename(f), ...(YAML.parse(fs.readFileSync(f, "utf8")) as Omit<Fixture, "datei">) }));
}
