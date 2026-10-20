import { ConflictException, ForbiddenException, HttpException, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PG_FEHLER, pgFehlercode, type Datenbank } from "@amtlos/server";
import type { Response } from "express";
import { z, ZodIssueCode, type ZodErrorMap } from "zod";

/**
 * Deutsche Fehlertexte für Zod (G3): die Oberfläche zeigt sie direkt an. Eigene Texte in den Schemas
 * (z. B. „Datum im Format JJJJ-MM-TT“) haben Vorrang.
 */
const TYPNAME: Record<string, string> = {
  string: "Text", number: "Zahl", integer: "ganze Zahl", boolean: "Ja/Nein", object: "Objekt", array: "Liste",
  null: "leer", undefined: "nichts", date: "Datum", bigint: "Zahl", nan: "keine Zahl",
};
const typ = (x: string) => TYPNAME[x] ?? x;
export const deutscheFehler: ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" ? "Angabe fehlt" : `Erwartet: ${typ(issue.expected)}, erhalten: ${typ(issue.received)}` };
    case ZodIssueCode.unrecognized_keys:
      return { message: `Unbekanntes Feld: ${issue.keys.join(", ")}` };
    case ZodIssueCode.invalid_enum_value:
      return { message: `Ungültiger Wert. Erlaubt: ${issue.options.join(", ")}` };
    case ZodIssueCode.invalid_literal:
      return { message: "Ungültiger Wert" };
    case ZodIssueCode.invalid_union:
    case ZodIssueCode.invalid_union_discriminator:
      return { message: "Ungültige Angabe" };
    case ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "Bitte eine gültige E-Mail-Adresse angeben" };
      if (issue.validation === "url") return { message: "Bitte eine gültige Adresse (URL) angeben" };
      if (issue.validation === "uuid") return { message: "Ungültige Kennung" };
      return { message: "Ungültiges Format" };
    case ZodIssueCode.too_small:
      if (issue.type === "string") return { message: issue.minimum === 1 ? "Darf nicht leer sein" : `Mindestens ${issue.minimum} Zeichen` };
      if (issue.type === "array") return { message: `Mindestens ${issue.minimum} Einträge` };
      return { message: `Mindestens ${issue.minimum}` };
    case ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Höchstens ${issue.maximum} Zeichen` };
      if (issue.type === "array") return { message: `Höchstens ${issue.maximum} Einträge` };
      return { message: `Höchstens ${issue.maximum}` };
    case ZodIssueCode.not_multiple_of:
      return { message: `Muss ein Vielfaches von ${issue.multipleOf} sein` };
    case ZodIssueCode.not_finite:
      return { message: "Muss eine endliche Zahl sein" };
    case ZodIssueCode.invalid_date:
      return { message: "Ungültiges Datum" };
    default:
      return { message: ctx.defaultError === "Invalid input" ? "Ungültige Angabe" : ctx.defaultError };
  }
};
z.setErrorMap(deutscheFehler);

/** Echter Kalendertag (H1): Format JJJJ-MM-TT, Jahr 1900–2199, den Tag gibt es (kein 31.2., kein 0000-00-00). */
export function istKalendertag(x: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x);
  if (!m) return false;
  const [j, mo, t] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (j < 1900 || j > 2199 || mo < 1 || mo > 12 || t < 1) return false;
  return t <= new Date(Date.UTC(j, mo, 0)).getUTCDate();
}
/** Gemeinsame Datumsprüfung aller Eingaben (H1) – Regex allein ließ 2026-02-31 bis in die Datenbank bzw. den Worker. */
export const DATUM = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT")
  .refine(istKalendertag, "Diesen Kalendertag gibt es nicht");

/** Freie JSON-Nutzlast begrenzen (G1): Tiefe und Größe, sonst stürzt pg bei tiefer Verschachtelung ab. */
export function jsonBegrenzt(maxTiefe: number, maxBytes: number) {
  const tiefe = (x: unknown, d: number): number => {
    if (d > maxTiefe || x === null || typeof x !== "object") return d;
    let max = d;
    for (const v of Object.values(x as Record<string, unknown>)) {
      max = Math.max(max, tiefe(v, d + 1));
      if (max > maxTiefe) break;
    }
    return max;
  };
  return z
    .record(z.unknown())
    .refine((x) => tiefe(x, 1) <= maxTiefe, `Höchstens ${maxTiefe} Ebenen verschachtelt`)
    .refine((x) => Buffer.byteLength(JSON.stringify(x)) <= maxBytes, `Höchstens ${Math.round(maxBytes / 1024)} KB`);
}

export function pruefe<T extends z.ZodTypeAny>(schema: T, daten: unknown): z.output<T> {
  const r = schema.safeParse(daten);
  if (!r.success)
    throw new UnprocessableEntityException({
      meldung: "Eingabe ungültig",
      fehler: r.error.issues.map((i) => ({ feld: i.path.join("."), meldung: i.message })),
    });
  return r.data;
}

/**
 * Seitenweise Listen (M9): limit (1–200, Standard 200) und cursor (Versatz, als Text). Die Gesamtzahl steht im Header
 * X-Gesamt, der nächste Cursor in X-Naechster-Cursor (fehlt auf der letzten Seite).
 */
export const MAX_SEITE = 200;
const SeiteSchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_SEITE).default(MAX_SEITE),
  cursor: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export function seite(q: { limit?: string; cursor?: string }): { limit: number; versatz: number } {
  const { limit, cursor } = pruefe(SeiteSchema, { limit: q.limit || undefined, cursor: q.cursor || undefined });
  return { limit, versatz: cursor };
}
/** Header für eine Seite setzen; erwartet Zeilen mit der Spalte gesamt (count(*) over ()), die entfernt wird. */
export function seitenkopf<T extends { gesamt?: number | string }>(res: Response, zeilen: T[], s: { limit: number; versatz: number }): Omit<T, "gesamt">[] {
  const gesamt = zeilen.length ? Number(zeilen[0]!.gesamt) : s.versatz === 0 ? 0 : undefined;
  if (gesamt !== undefined) res.setHeader("X-Gesamt", String(gesamt));
  if (gesamt !== undefined && s.versatz + zeilen.length < gesamt) res.setHeader("X-Naechster-Cursor", String(s.versatz + zeilen.length));
  return zeilen.map(({ gesamt: _g, ...rest }) => rest);
}

/** Datenbankfehler in verständliche HTTP-Antworten übersetzen; RLS-Verstöße wie „nicht gefunden“ behandeln. */
export function uebersetzeDbFehler(e: unknown): never {
  if (e instanceof HttpException) throw e;
  switch (pgFehlercode(e)) {
    case PG_FEHLER.eindeutig:
      throw new ConflictException("Existiert bereits");
    case PG_FEHLER.pruefung:
      throw new UnprocessableEntityException("Eingabe verletzt eine Regel");
    case PG_FEHLER.datumFormat:
    case PG_FEHLER.datumBereich:
    case PG_FEHLER.wertBereich:
    case PG_FEHLER.textFormat:
    case PG_FEHLER.zuTief:
      throw new UnprocessableEntityException("Eingabe ungültig (Datum oder Zahl außerhalb des gültigen Bereichs)");
    case PG_FEHLER.rls:
    case PG_FEHLER.fremdschluessel:
      throw new NotFoundException("Nicht gefunden");
    default:
      throw e;
  }
}

/**
 * E-Mails an Dritte (Einladungen, Mandanten) nur mit bestätigter eigener Adresse (M12). Unbestätigte Adressen übernimmt
 * die Anmeldung gar nicht erst (G-8, Platzhalter …@unbekannt.invalid).
 */
export async function emailBestaetigt(db: Datenbank, kontoId: string): Promise<void> {
  const konto = await db.imKontext({ kontoId }, (tx) => tx.eine<{ email: string }>("select email from app.konto where id = $1", [kontoId]));
  if (!konto || konto.email.endsWith(".invalid"))
    throw new ForbiddenException("Bitte bestätige zuerst deine E-Mail-Adresse bei der Anmeldung. Danach kannst du Einladungen verschicken.");
}

export type Text = { de: string; en?: string };
export const t = (x: Text | undefined, sprache: "de" | "en"): string | undefined => (x ? (x[sprache] ?? x.de) : undefined);
