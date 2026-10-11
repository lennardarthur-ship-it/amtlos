import { z } from "zod";

const Schema = z
  .object({
    UMGEBUNG: z.enum(["dev", "test", "staging", "prod"]).default("dev"),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    AUTH_MODUS: z.enum(["oidc", "dev"]).default("oidc"),
    OIDC_ISSUER: z.string().url().optional(),
    OIDC_AUDIENCE: z.string().min(1).optional(),
    DEV_JWT_SECRET: z.string().min(32).optional(),
    WEB_URL: z.string().url().default("http://localhost:3000"),
    API_URL: z.string().url().default("http://localhost:3001"),
    /** Bearer-Token für GET /metriken (Prometheus). Ohne Token ist die Route abgeschaltet. */
    METRIKEN_TOKEN: z.string().min(32).optional(),
    /** Anfragen je Minute und Instanz: angemeldet bzw. ohne Login/mit Einladungs- oder Kalender-Token (E-082). */
    RATE_ANGEMELDET: z.coerce.number().int().positive().default(600),
    RATE_ANONYM: z.coerce.number().int().positive().default(60),
    /** Unveränderliche Dateiablage (Belege, Rechnungen). Verzeichnis auf verschlüsseltem Volume; S3-kompatibel folgt (E-088). */
    ABLAGE_VERZEICHNIS: z.string().min(1).optional(),
    /** Online-Check darf private Netze abrufen (nur dev/test, für lokale Testseiten). In staging/prod verboten (E-097). */
    ONLINECHECK_PRIVATE_NETZE: z.enum(["erlaubt", "verboten"]).default("verboten"),
    /** Online-Checks je Unternehmen und Tag */
    ONLINECHECK_JE_TAG: z.coerce.number().int().positive().default(20),
    /** Abo über Stripe (E-113): ohne Schlüssel ist Bezahlen abgeschaltet (nur Testphase); in staging/prod Pflicht. */
    STRIPE_SECRET_KEY: z.string().min(20).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(20).optional(),
    STRIPE_PREIS_ID: z.string().min(5).optional(),
    /** Länge der Testphase in Tagen (Konfiguration, nicht Code – Spezifikation 9) */
    ABO_TESTTAGE: z.coerce.number().int().min(0).max(365).default(14),
  })
  .superRefine((k, ctx) => {
    if (k.AUTH_MODUS === "oidc" && (!k.OIDC_ISSUER || !k.OIDC_AUDIENCE))
      ctx.addIssue({ code: "custom", message: "AUTH_MODUS=oidc braucht OIDC_ISSUER und OIDC_AUDIENCE" });
    if ((k.UMGEBUNG === "prod" || k.UMGEBUNG === "staging") && !k.ABLAGE_VERZEICHNIS)
      ctx.addIssue({ code: "custom", message: "ABLAGE_VERZEICHNIS ist in staging/prod Pflicht (Belege und Rechnungen müssen dauerhaft liegen)" });
    if ((k.UMGEBUNG === "prod" || k.UMGEBUNG === "staging") && k.ONLINECHECK_PRIVATE_NETZE === "erlaubt")
      ctx.addIssue({ code: "custom", message: "ONLINECHECK_PRIVATE_NETZE=erlaubt ist in staging und prod verboten (SSRF)" });
    if ((k.UMGEBUNG === "prod" || k.UMGEBUNG === "staging") && (!k.STRIPE_SECRET_KEY || !k.STRIPE_WEBHOOK_SECRET || !k.STRIPE_PREIS_ID))
      ctx.addIssue({ code: "custom", message: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET und STRIPE_PREIS_ID sind in staging/prod Pflicht (Abo, E-113)" });
    if (k.AUTH_MODUS === "dev") {
      if (!k.DEV_JWT_SECRET) ctx.addIssue({ code: "custom", message: "AUTH_MODUS=dev braucht DEV_JWT_SECRET (≥ 32 Zeichen)" });
      if (k.UMGEBUNG === "prod" || k.UMGEBUNG === "staging")
        ctx.addIssue({ code: "custom", message: "AUTH_MODUS=dev ist in staging und prod verboten" });
    }
  });

export type Konfiguration = z.infer<typeof Schema>;
export const KONFIGURATION = Symbol("KONFIGURATION");

export function ladeKonfiguration(env: NodeJS.ProcessEnv = process.env): Konfiguration {
  const r = Schema.safeParse(env);
  if (!r.success) throw new Error(`Konfiguration ungültig:\n- ${r.error.issues.map((i) => `${i.path.join(".") || "allgemein"}: ${i.message}`).join("\n- ")}`);
  return r.data;
}
