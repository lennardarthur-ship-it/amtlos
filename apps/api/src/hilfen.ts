import { ConflictException, HttpException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PG_FEHLER, pgFehlercode } from "@amtlos/server";
import type { z } from "zod";

export function pruefe<T extends z.ZodTypeAny>(schema: T, daten: unknown): z.output<T> {
  const r = schema.safeParse(daten);
  if (!r.success)
    throw new UnprocessableEntityException({
      meldung: "Eingabe ungültig",
      fehler: r.error.issues.map((i) => ({ feld: i.path.join("."), meldung: i.message })),
    });
  return r.data;
}

/** Datenbankfehler in verständliche HTTP-Antworten übersetzen; RLS-Verstöße wie „nicht gefunden“ behandeln. */
export function uebersetzeDbFehler(e: unknown): never {
  if (e instanceof HttpException) throw e;
  switch (pgFehlercode(e)) {
    case PG_FEHLER.eindeutig:
      throw new ConflictException("Existiert bereits");
    case PG_FEHLER.pruefung:
      throw new UnprocessableEntityException("Eingabe verletzt eine Regel");
    case PG_FEHLER.rls:
    case PG_FEHLER.fremdschluessel:
      throw new NotFoundException("Nicht gefunden");
    default:
      throw e;
  }
}

export type Text = { de: string; en?: string };
export const t = (x: Text | undefined, sprache: "de" | "en"): string | undefined => (x ? (x[sprache] ?? x.de) : undefined);
