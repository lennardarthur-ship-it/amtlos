import { createRequire } from "node:module";
import { z } from "zod";

const require = createRequire(import.meta.url);
const fakten = require("@amtlos/rules-schema/fakten.json") as { fakten: { pfad: string; typ: string; werte?: string[] }[] };
const ereignisseKatalog = require("@amtlos/rules-schema/ereignisse.json") as { ereignisse: { typ: string }[] };

export const EREIGNISTYPEN = new Set(ereignisseKatalog.ereignisse.map((e) => e.typ));

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

/** Amtlicher Gemeindeschlüssel: die ersten beiden Stellen sind das Land. */
export const LAND_AUS_AGS: Record<string, string> = {
  "01": "SH", "02": "HH", "03": "NI", "04": "HB", "05": "NW", "06": "HE", "07": "RP", "08": "BW",
  "09": "BY", "10": "SL", "11": "BE", "12": "BB", "13": "MV", "14": "SN", "15": "ST", "16": "TH",
};

function feldSchema(typ: string, werte?: string[]): z.ZodTypeAny {
  switch (typ) {
    case "enum":
      return z.enum(werte as [string, ...string[]]);
    case "enum_liste":
      return z.array(z.enum(werte as [string, ...string[]])).max(werte?.length ?? 50).refine((l) => new Set(l).size === l.length, "Werte doppelt");
    case "bool":
      return z.boolean();
    case "ganzzahl":
      return z.number().int().min(0).max(1_000_000);
    case "betrag":
    case "zahl":
      return z.number().finite().min(0).max(1e12);
    case "datum":
      return z.string().regex(DATUM, "Datum im Format JJJJ-MM-TT");
    default:
      return z.string().trim().min(1).max(200);
  }
}

/**
 * Profil = alle Fakten mit Präfix "profil." (ohne Präfix gespeichert). Alles optional (Onboarding ist
 * unterbrechbar, E-033), unbekannte Schlüssel sind ein Fehler, null löscht eine Angabe.
 */
export const ProfilSchema = z
  .object(
    Object.fromEntries(
      fakten.fakten
        .filter((f) => f.pfad.startsWith("profil."))
        .map((f) => {
          const name = f.pfad.slice("profil.".length);
          const basis =
            name === "gemeinde_ags"
              ? z.string().regex(/^\d{8}$/, "8-stelliger Gemeindeschlüssel")
              : name.startsWith("gewinn.")
                ? z.number().finite().min(-1e12).max(1e12) // Gewinn kann ein Verlust sein
                : feldSchema(f.typ, f.werte);
          return [name, basis.nullable().optional()];
        }),
    ),
  )
  .strict()
  .transform((p) => {
    const sauber = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined));
    // Der Gemeindeschlüssel ist genauer als das Bundesland und bestimmt es (E-111)
    const ags = sauber["gemeinde_ags"] as string | undefined;
    if (ags && LAND_AUS_AGS[ags.slice(0, 2)]) sauber["bundesland"] = LAND_AUS_AGS[ags.slice(0, 2)];
    return sauber;
  });
