import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { json } from "express";
import helmet from "helmet";
import { appModul } from "./app.module.js";
import { TokenPruefer } from "./auth.js";
import { METRIKEN, Ratenbegrenzer, grosserUpload, tokenVorpruefung, zugriffsprotokoll, type Metriken } from "./betrieb.js";
import { FehlerFilter } from "./fehler.js";
import { ladeKonfiguration, vertrauenswuerdigeProxys, type Konfiguration } from "./konfiguration.js";

/** Größter Body der Synchronisation (verschlüsselter Stand bis 30 MB, als JSON etwas mehr). */
const TRESOR_MAX = 40 * 1024 * 1024;

export async function erzeugeApp(k: Konfiguration): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(appModul(k), {
    logger: k.UMGEBUNG === "test" ? false : ["error", "warn", "log"],
    bodyParser: false,
  });
  const metriken = app.get<Metriken>(METRIKEN);
  // Nur bekannten Proxys X-Forwarded-For glauben (G-9, M7) – sonst ist die IP-Grenze mit einem Header umgehbar
  app.set("trust proxy", vertrauenswuerdigeProxys(k.TRUST_PROXY));
  app.useGlobalFilters(new FehlerFilter(k.UMGEBUNG !== "test"));
  // CORS zuerst: auch 401 und 429 der Vorstufen sollen im Browser lesbar ankommen
  app.enableCors({ origin: [k.WEB_URL], credentials: false, allowedHeaders: ["Authorization", "Content-Type", "X-Unternehmen-Id", "X-Request-Id", "X-Sprache"], exposedHeaders: ["X-Request-Id"] });
  app.use(zugriffsprotokoll(metriken, k.UMGEBUNG !== "test"));
  // Token vollständig prüfen, bevor etwas gelesen wird (M-2): die Ratenbegrenzung zählt nur geprüfte Tokens als angemeldet
  app.use(tokenVorpruefung(app.get(TokenPruefer)));
  // Ratenbegrenzung vor dem Einlesen der Anfrage (E-143) – sonst würden große Bodies erst gelesen und dann abgewiesen
  app.use(new Ratenbegrenzer({ angemeldet: k.RATE_ANGEMELDET, anonym: k.RATE_ANONYM, fensterMs: 60_000 }).middleware(metriken));
  // Synchronisation (E-134): verschlüsselter Stand und Belegdateien sind größer als normale Anfragen – nur mit gültiger
  // Anmeldung, Content-Length über der Grenze sofort 413, wenige gleichzeitig je IP; CORS-Vorabfragen und Lesen normal
  app.use("/v1/tresor", grosserUpload(TRESOR_MAX));
  app.use("/v1/tresor", json({ limit: TRESOR_MAX }));
  // rawBody für Webhook-Signaturen (Stripe prüft über den unveränderten Body)
  app.useBodyParser("json", { limit: "256kb", verify: (req: { rawBody?: Buffer }, _res: unknown, buf: Buffer) => { req.rawBody = buf; } });
  app.use(helmet());
  app.enableShutdownHooks();
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const k = ladeKonfiguration();
  const app = await erzeugeApp(k);
  await app.listen(k.PORT);
  console.warn(`Amtlos-API läuft auf Port ${k.PORT} (${k.UMGEBUNG})`);
}
