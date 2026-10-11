import { randomUUID, timingSafeEqual } from "node:crypto";
import { Controller, Get, Header, Headers, Inject, NotFoundException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type PgBoss from "pg-boss";
import { Counter, Histogram, Registry, collectDefaultMetrics, Gauge } from "prom-client";
import { JOBS } from "@amtlos/server";
import { Oeffentlich } from "./auth.js";
import { WARTESCHLANGE } from "./kern.controller.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";

/**
 * Betrieb (E-081): strukturierte Zugriffslogs und Prometheus-Metriken.
 * Beides ohne personenbezogene Daten: Route als Muster (/v1/kalender/:datei statt Token), keine IPs,
 * keine Konto- oder Unternehmens-IDs.
 */
export function erzeugeMetriken() {
  const register = new Registry();
  collectDefaultMetrics({ register, prefix: "amtlos_api_" });
  const anfragen = new Counter({ name: "amtlos_http_anfragen_total", help: "HTTP-Anfragen", labelNames: ["methode", "route", "status"], registers: [register] });
  const dauer = new Histogram({
    name: "amtlos_http_dauer_sekunden",
    help: "Antwortzeit",
    labelNames: ["methode", "route"],
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register],
  });
  const warteschlange = new Gauge({ name: "amtlos_warteschlange_wartend", help: "Wartende Jobs je Warteschlange", labelNames: ["queue"], registers: [register] });
  return { register, anfragen, dauer, warteschlange };
}
export type Metriken = ReturnType<typeof erzeugeMetriken>;
export const METRIKEN = Symbol("METRIKEN");

const routeMuster = (req: Request) => (req.route?.path ? `${req.baseUrl ?? ""}${req.route.path as string}` : "unbekannt");

export function zugriffsprotokoll(m: Metriken, protokollieren: boolean) {
  return (req: Request, res: Response, weiter: NextFunction) => {
    const start = process.hrtime.bigint();
    const kopf = req.headers["x-request-id"];
    const id = typeof kopf === "string" && /^[A-Za-z0-9-]{8,64}$/.test(kopf) ? kopf : randomUUID();
    res.setHeader("X-Request-Id", id);
    res.on("finish", () => {
      const sek = Number(process.hrtime.bigint() - start) / 1e9;
      const route = routeMuster(req);
      m.anfragen.inc({ methode: req.method, route, status: String(res.statusCode) });
      m.dauer.observe({ methode: req.method, route }, sek);
      if (protokollieren && route !== "/v1/gesundheit")
        console.warn(JSON.stringify({ zeit: new Date().toISOString(), stufe: res.statusCode >= 500 ? "fehler" : "info", msg: "http", anfrage: id, methode: req.method, route, status: res.statusCode, dauer_ms: Math.round(sek * 1000) }));
    });
    weiter();
  };
}

@Controller()
export class BetriebController {
  constructor(
    @Inject(METRIKEN) private readonly m: Metriken,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  /** Nur mit METRIKEN_TOKEN (Bearer). Ohne konfiguriertes Token gibt es die Route nicht. */
  @Oeffentlich()
  @Get("metriken")
  @Header("Content-Type", "text/plain; version=0.0.4")
  async metriken(@Headers("authorization") auth?: string) {
    const soll = this.k.METRIKEN_TOKEN;
    const ist = /^Bearer (.+)$/.exec(auth ?? "")?.[1] ?? "";
    if (!soll || ist.length !== soll.length || !timingSafeEqual(Buffer.from(ist), Buffer.from(soll))) throw new NotFoundException();
    for (const q of Object.values(JOBS)) this.m.warteschlange.set({ queue: q }, await this.boss.getQueueSize(q).catch(() => -1));
    return this.m.register.metrics();
  }
}
