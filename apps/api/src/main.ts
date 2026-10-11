import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { appModul } from "./app.module.js";
import { METRIKEN, Ratenbegrenzer, zugriffsprotokoll, type Metriken } from "./betrieb.js";
import { ladeKonfiguration, type Konfiguration } from "./konfiguration.js";

export async function erzeugeApp(k: Konfiguration): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(appModul(k), {
    logger: k.UMGEBUNG === "test" ? false : ["error", "warn", "log"],
    bodyParser: false,
  });
  app.useBodyParser("json", { limit: "256kb" });
  const metriken = app.get<Metriken>(METRIKEN);
  app.set("trust proxy", 1);
  app.use(zugriffsprotokoll(metriken, k.UMGEBUNG !== "test"));
  app.use(new Ratenbegrenzer({ angemeldet: k.RATE_ANGEMELDET, anonym: k.RATE_ANONYM, fensterMs: 60_000 }).middleware(metriken));
  app.use(helmet());
  app.enableCors({ origin: [k.WEB_URL], credentials: false, allowedHeaders: ["Authorization", "Content-Type", "X-Unternehmen-Id", "X-Request-Id", "X-Sprache"], exposedHeaders: ["X-Request-Id"] });
  app.enableShutdownHooks();
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const k = ladeKonfiguration();
  const app = await erzeugeApp(k);
  await app.listen(k.PORT);
  console.warn(`Amtlos-API läuft auf Port ${k.PORT} (${k.UMGEBUNG})`);
}
