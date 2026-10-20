import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Controller, Get, Header, Headers, Inject, NotFoundException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import type PgBoss from "pg-boss";
import { Counter, Histogram, Registry, collectDefaultMetrics, Gauge } from "prom-client";
import { JOBS } from "@amtlos/server";
import { Oeffentlich, type Claims } from "./auth.js";
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
  const begrenzt = new Counter({ name: "amtlos_http_begrenzt_total", help: "Wegen Ratenbegrenzung abgewiesene Anfragen", registers: [register] });
  return { register, anfragen, dauer, warteschlange, begrenzt };
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

/**
 * Ratenbegrenzung (E-082): gleitendes Fenster je Schlüssel, im Speicher der Instanz.
 * Schlüssel: Hash des geprüften Bearer-Tokens, sonst die IP (nur flüchtig im Speicher, nie geloggt).
 * Strenger für Routen ohne Login und für Einladungs-Tokens (Ausprobieren erschweren).
 */
export interface Grenzen {
  angemeldet: number;
  anonym: number;
  fensterMs: number;
}

export class Ratenbegrenzer {
  private readonly zaehler = new Map<string, { start: number; anzahl: number }>();
  constructor(private readonly g: Grenzen, private readonly jetzt: () => number = Date.now) {}

  /** true = erlaubt; sonst Sekunden bis zum nächsten Fenster. */
  pruefe(schluessel: string, grenze: number): true | number {
    const t = this.jetzt();
    if (this.zaehler.size > 50_000) for (const [k, v] of this.zaehler) if (t - v.start >= this.g.fensterMs) this.zaehler.delete(k);
    const e = this.zaehler.get(schluessel);
    if (!e || t - e.start >= this.g.fensterMs) {
      this.zaehler.set(schluessel, { start: t, anzahl: 1 });
      return true;
    }
    if (e.anzahl >= grenze) return Math.max(1, Math.ceil((e.start + this.g.fensterMs - t) / 1000));
    e.anzahl++;
    return true;
  }

  middleware(m: Metriken) {
    return (req: Request, res: Response, weiter: NextFunction) => {
      if (req.path === "/v1/gesundheit" || req.path === "/metriken") return weiter();
      const ip = req.ip ?? "?";
      const hash = (x: string) => createHash("sha256").update(x).digest("base64url").slice(0, 22);
      let r: true | number;
      if (req.path.startsWith("/v1/kalender/")) {
        // Kalender-Abos (M8): Google und Outlook holen viele Feeds von wenigen IPs – Schlüssel ist das Token im Pfad.
        // Die IP-Grenze bleibt als großzügige Obergrenze gegen das Durchprobieren erfundener Tokens.
        const ipGrenze = this.pruefe(`k|${ip}`, this.g.anonym * 50);
        r = ipGrenze === true ? this.pruefe(`f|${hash(req.path)}`, this.g.anonym) : ipGrenze;
      } else if (req.amtlosClaims) {
        // Nur geprüfte Tokens zählen als angemeldet (M7): ungültige oder erfundene Tokens fallen unter die IP-Grenze
        const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")![1]!;
        const streng = req.path.startsWith("/v1/einladungen/");
        // zusätzlich je IP: großzügig (×4), damit Büros und Mobilfunk-NAT hinter einer IP nicht ausgebremst werden (E-143)
        const ipGrenze = this.pruefe(`i|${ip}`, this.g.angemeldet * 4);
        r = ipGrenze === true ? this.pruefe(`${streng ? "s" : "n"}|t:${hash(token)}`, streng ? this.g.anonym : this.g.angemeldet) : ipGrenze;
      } else {
        r = this.pruefe(`s|ip:${ip}`, this.g.anonym);
      }
      if (r === true) return weiter();
      m.begrenzt.inc();
      res.setHeader("Retry-After", String(r));
      res.status(429).json({ statusCode: 429, message: "Zu viele Anfragen. Bitte warte einen Moment." });
    };
  }
}

/**
 * Vorfilter (M-2, M7): prüft ein Bearer-Token vollständig, bevor ein Body gelesen wird. Gültige Tokens landen in
 * req.amtlosClaims (der AuthGuard nutzt sie weiter); ungültige werden hier noch nicht abgewiesen – öffentliche Routen
 * gehen weiter, geschützte beantwortet der AuthGuard mit 401.
 */
export function tokenVorpruefung(pruefer: { pruefe(token: string): Promise<Claims> }) {
  return (req: Request, _res: Response, weiter: NextFunction) => {
    const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
    if (!token) return weiter();
    pruefer.pruefe(token).then(
      (c) => {
        req.amtlosClaims = c;
        weiter();
      },
      () => weiter(),
    );
  };
}

/**
 * Große Uploads (Synchronisation, M-2): nur mit geprüftem Token, Content-Length über der Grenze sofort 413, und je IP
 * höchstens wenige gleichzeitig – alles, bevor der Body gelesen wird.
 */
export function grosserUpload(maxBytes: number, gleichzeitigJeIp = 4) {
  const laufend = new Map<string, number>();
  return (req: Request, res: Response, weiter: NextFunction) => {
    if (req.method !== "PUT" && req.method !== "POST") return weiter();
    if (!req.amtlosClaims) return void res.status(401).json({ statusCode: 401, message: "Anmeldung nötig" });
    const laenge = Number(req.headers["content-length"] ?? NaN);
    if (Number.isFinite(laenge) && laenge > maxBytes) return void res.status(413).json({ statusCode: 413, meldung: "Die Datei ist zu groß." });
    const ip = req.ip ?? "?";
    const n = laufend.get(ip) ?? 0;
    if (n >= gleichzeitigJeIp) {
      res.setHeader("Retry-After", "5");
      return void res.status(429).json({ statusCode: 429, message: "Zu viele gleichzeitige Uploads. Bitte warte einen Moment." });
    }
    laufend.set(ip, n + 1);
    let frei = false;
    const freigeben = () => {
      if (frei) return;
      frei = true;
      const rest = (laufend.get(ip) ?? 1) - 1;
      if (rest > 0) laufend.set(ip, rest);
      else laufend.delete(ip);
    };
    res.on("finish", freigeben);
    res.on("close", freigeben);
    weiter();
  };
}
