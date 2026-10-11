/**
 * Online-Compliance-Check (Spezifikation 6.8): technischer Check einer Website, kein Rechtsgutachten.
 *
 * Abruf: höchstens wenige Seiten (Startseite, Impressum, Datenschutz), Zeit- und Größenlimit, nur http/https,
 * Schutz gegen Anfragen ins interne Netz (SSRF): jede aufgelöste Adresse wird geprüft, auch nach Weiterleitungen;
 * IP-Literale werden vor der Verbindung geprüft. Private Netze nur, wenn ausdrücklich erlaubt (Entwicklung/Test).
 *
 * Prüfung: reine Funktion über die abgerufenen Seiten – Heuristiken, deren Ergebnis als „ok“, „fehlt“, „Hinweis“
 * oder „nicht geprüft“ angezeigt wird (E-097). Texte liegen in packages/i18n (oc.befunde.*).
 */
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { parse, type HTMLElement } from "node-html-parser";

export interface Seite {
  url: string;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  html: string;
}

export type BefundStatus = "ok" | "fehlt" | "hinweis" | "nicht_geprueft";
export interface Befund {
  id: string;
  status: BefundStatus;
  schwere: "hoch" | "mittel" | "niedrig";
  /** Werte für die Texte, z. B. gefundene Tracker oder Anzahl */
  werte?: Record<string, string | number>;
  pflicht_id?: string;
}

export interface CheckProfil {
  b2c: boolean;
  fernabsatz: boolean;
  abo: boolean;
  kapitalgesellschaft: boolean;
  waren: boolean;
}

export class CheckFehler extends Error {
  constructor(readonly code: "url_ungueltig" | "ziel_nicht_erlaubt" | "nicht_erreichbar" | "kein_html" | "zu_gross" | "zeitueberschreitung", nachricht?: string) {
    super(nachricht ?? code);
  }
}

// ------------------------------------------------------------ Netzschutz

/** Private, lokale, reservierte Adressen (IPv4 und IPv6, inkl. IPv4-mapped). */
export function istPrivateAdresse(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const x = ip.toLowerCase();
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff");
}

export interface AbrufOptionen {
  privateNetzeErlaubt?: boolean;
  zeitlimitMs?: number;
  maxBytes?: number;
  maxWeiterleitungen?: number;
}

/** Normalisiert die Eingabe des Nutzers zu einer http(s)-URL oder wirft. */
export function normalisiereUrl(eingabe: string): URL {
  const roh = eingabe.trim();
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(roh) ? roh : `https://${roh}`);
  } catch {
    throw new CheckFehler("url_ungueltig");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new CheckFehler("url_ungueltig");
  if (u.username || u.password) throw new CheckFehler("url_ungueltig");
  if (!u.hostname.includes(".") && !net.isIP(u.hostname.replace(/^\[|\]$/g, "")) && u.hostname !== "localhost") throw new CheckFehler("url_ungueltig");
  u.hash = "";
  return u;
}

function pruefeZiel(u: URL, o: AbrufOptionen) {
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!o.privateNetzeErlaubt) {
    if (u.port && u.port !== "80" && u.port !== "443") throw new CheckFehler("ziel_nicht_erlaubt", "Nur die Standard-Ports 80 und 443");
    if (host === "localhost" || (net.isIP(host) && istPrivateAdresse(host))) throw new CheckFehler("ziel_nicht_erlaubt");
  }
}

function sichererLookup(erlaubt: boolean): net.LookupFunction {
  return (hostname, options, callback) => {
    dns.lookup(hostname, { all: true, family: (options as dns.LookupOptions).family ?? 0 }, (err, adressen) => {
      if (err) return (callback as (e: Error | null) => void)(err);
      if (!erlaubt && adressen.some((a) => istPrivateAdresse(a.address))) return (callback as (e: Error | null) => void)(new CheckFehler("ziel_nicht_erlaubt"));
      if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, adressen);
      const a = adressen[0]!;
      (callback as (e: null, a: string, f: number) => void)(null, a.address, a.family);
    });
  };
}

function einmal(u: URL, o: Required<AbrufOptionen>): Promise<Seite & { weiter?: string }> {
  return new Promise((resolve, reject) => {
    const modul = u.protocol === "https:" ? https : http;
    const req = modul.request(
      u,
      {
        method: "GET",
        lookup: sichererLookup(o.privateNetzeErlaubt),
        headers: { "User-Agent": "AmtlosOnlineCheck/1.0", Accept: "text/html,application/xhtml+xml", "Accept-Language": "de,en;q=0.5" },
        timeout: o.zeitlimitMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ url: u.toString(), status, headers: res.headers, html: "", weiter: new URL(res.headers.location, u).toString() });
        }
        const typ = String(res.headers["content-type"] ?? "");
        if (status < 400 && !/html/i.test(typ)) {
          res.resume();
          return reject(new CheckFehler("kein_html"));
        }
        let groesse = 0;
        const teile: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          groesse += c.length;
          if (groesse > o.maxBytes) {
            req.destroy(new CheckFehler("zu_gross"));
            return;
          }
          teile.push(c);
        });
        res.on("end", () => resolve({ url: u.toString(), status, headers: res.headers, html: Buffer.concat(teile).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new CheckFehler("zeitueberschreitung")));
    req.on("error", (e) => reject(e instanceof CheckFehler ? e : new CheckFehler("nicht_erreichbar", (e as Error).message)));
    req.end();
  });
}

/** Eine Seite abrufen, Weiterleitungen einzeln prüfen. */
export async function seiteAbrufen(url: string | URL, optionen: AbrufOptionen = {}): Promise<Seite> {
  const o: Required<AbrufOptionen> = { privateNetzeErlaubt: false, zeitlimitMs: 8000, maxBytes: 2 * 1024 * 1024, maxWeiterleitungen: 3, ...optionen };
  let u = typeof url === "string" ? normalisiereUrl(url) : url;
  for (let i = 0; i <= o.maxWeiterleitungen; i++) {
    pruefeZiel(u, o);
    const s = await einmal(u, o);
    if (!s.weiter) return s;
    u = normalisiereUrl(s.weiter);
  }
  throw new CheckFehler("nicht_erreichbar", "Zu viele Weiterleitungen");
}

// ------------------------------------------------------------ Prüfung

const TRACKER: [RegExp, string][] = [
  [/googletagmanager\.com/i, "Google Tag Manager"],
  [/google-analytics\.com|gtag\/js/i, "Google Analytics"],
  [/connect\.facebook\.net|fbevents\.js/i, "Meta Pixel"],
  [/static\.hotjar\.com|hotjar/i, "Hotjar"],
  [/snap\.licdn\.com/i, "LinkedIn Insight"],
  [/analytics\.tiktok\.com/i, "TikTok Pixel"],
  [/clarity\.ms/i, "Microsoft Clarity"],
  [/doubleclick\.net/i, "DoubleClick"],
];
const EINWILLIGUNG: [RegExp, string][] = [
  [/cookiebot/i, "Cookiebot"],
  [/usercentrics/i, "Usercentrics"],
  [/borlabs/i, "Borlabs Cookie"],
  [/onetrust|cookielaw\.org/i, "OneTrust"],
  [/klaro/i, "Klaro"],
  [/consentmanager/i, "consentmanager"],
  [/complianz/i, "Complianz"],
  [/cookieyes/i, "CookieYes"],
  [/iubenda/i, "iubenda"],
  [/ccm19/i, "CCM19"],
];

const text = (e: HTMLElement) => e.textContent.replace(/\s+/g, " ").trim();

interface Link { href: string; text: string }
function links(dok: HTMLElement, basis: string): Link[] {
  return dok.querySelectorAll("a[href]").flatMap((a) => {
    try {
      return [{ href: new URL(a.getAttribute("href")!, basis).toString(), text: `${text(a)} ${a.getAttribute("aria-label") ?? ""} ${a.getAttribute("title") ?? ""}`.trim() }];
    } catch {
      return [];
    }
  });
}

/** Link auf eine Unterseite finden (Text oder Adresse passt). */
export function findeLink(dok: HTMLElement, basis: string, muster: RegExp): string | null {
  return links(dok, basis).find((l) => muster.test(l.text) || muster.test(new URL(l.href).pathname))?.href ?? null;
}

const IMPRESSUM = /impressum|legal[\s-]?notice|imprint|anbieterkennzeichnung/i;
const DATENSCHUTZ = /datenschutz|privacy|datenschutzerkl/i;

function bedienelemente(dok: HTMLElement): string[] {
  return [...dok.querySelectorAll("a, button, input[type=submit], input[type=button]")].map((e) => `${text(e)} ${e.getAttribute("value") ?? ""} ${e.getAttribute("aria-label") ?? ""}`.trim());
}

/**
 * Prüft die abgerufenen Seiten. `start` ist die Startseite, `impressum`/`datenschutz` die gefundenen Unterseiten (oder null).
 */
export function pruefeSeiten(seiten: { start: Seite; impressum: Seite | null; datenschutz: Seite | null }, profil: CheckProfil): Befund[] {
  const b: Befund[] = [];
  const dok = parse(seiten.start.html);
  const alle = [seiten.start, seiten.impressum, seiten.datenschutz].filter((s): s is Seite => Boolean(s));
  const html = seiten.start.html;

  b.push({ id: "https", status: seiten.start.url.startsWith("https:") ? "ok" : "fehlt", schwere: "mittel" });

  // Impressum und Datenschutz
  b.push({ id: "impressum", status: seiten.impressum ? "ok" : "fehlt", schwere: "hoch", pflicht_id: "online.impressum" });
  if (seiten.impressum) {
    const imp = parse(seiten.impressum.html);
    const t = text(imp);
    const mail = imp.querySelector('a[href^="mailto:"]') !== null || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t) || /\[at\]|\(at\)/i.test(t);
    b.push({ id: "impressum_email", status: mail ? "ok" : "hinweis", schwere: "mittel", pflicht_id: "online.impressum" });
    if (profil.kapitalgesellschaft)
      b.push({ id: "impressum_register", status: /handelsregister|registergericht|\bHRB\b/i.test(t) ? "ok" : "hinweis", schwere: "mittel", pflicht_id: "online.impressum" });
  }
  b.push({ id: "datenschutz", status: seiten.datenschutz ? "ok" : "fehlt", schwere: "hoch", pflicht_id: "online.datenschutzerklaerung" });

  // Tracking und Einwilligung (nur statisch: was die Seite ohne Interaktion lädt)
  const skripte = dok.querySelectorAll("script").filter((s) => !/text\/plain/i.test(s.getAttribute("type") ?? "") && !s.getAttribute("data-cookieconsent") && !s.getAttribute("data-category"));
  const quellen = skripte.map((s) => `${s.getAttribute("src") ?? ""} ${s.getAttribute("src") ? "" : s.textContent.slice(0, 2000)}`).join("\n");
  const tracker = [...new Set(TRACKER.filter(([m]) => m.test(quellen)).map(([, n]) => n))];
  const cmp = EINWILLIGUNG.find(([m]) => m.test(html))?.[1];
  b.push({ id: "tracking_vor_einwilligung", status: tracker.length ? "hinweis" : "ok", schwere: "hoch", werte: tracker.length ? { tracker: tracker.join(", ") } : undefined, pflicht_id: "online.cookie_einwilligung" });
  b.push({ id: "einwilligungsbanner", status: cmp ? "ok" : tracker.length ? "fehlt" : "nicht_geprueft", schwere: tracker.length ? "hoch" : "niedrig", werte: cmp ? { name: cmp } : undefined, pflicht_id: "online.cookie_einwilligung" });
  const cookies = ([] as string[]).concat(seiten.start.headers["set-cookie"] ?? []);
  b.push({ id: "cookies_ohne_einwilligung", status: cookies.length ? "hinweis" : "ok", schwere: "mittel", werte: { n: cookies.length } });

  // Verbraucher: Buttons, Preise, OS-Link
  const elemente = alle.flatMap((s) => bedienelemente(parse(s.html)));
  if (profil.b2c && profil.abo) b.push({ id: "kuendigungsbutton", status: elemente.some((e) => /kündig/i.test(e)) ? "ok" : "fehlt", schwere: "hoch", pflicht_id: "online.kuendigungsbutton" });
  if (profil.b2c && profil.fernabsatz) {
    const button = elemente.some((e) => /widerrufen/i.test(e));
    const belehrung = elemente.some((e) => /widerruf/i.test(e));
    b.push({ id: "widerrufsbutton", status: button ? "ok" : belehrung ? "hinweis" : "fehlt", schwere: "hoch", pflicht_id: "online.widerrufsbutton" });
  }
  if (profil.b2c) {
    const t = text(dok);
    const preise = /\d[\d.,]*\s?(?:€|EUR\b)|€\s?\d/.test(t);
    const steuer = /inkl\.?\s*(gesetzl\.?\s*)?(MwSt|USt|Mehrwertsteuer|Umsatzsteuer)|zzgl\.?\s*(MwSt|USt)/i.test(t);
    b.push({ id: "preisangaben", status: !preise ? "nicht_geprueft" : steuer ? "ok" : "hinweis", schwere: "mittel", pflicht_id: "online.preisangaben" });
  }
  if (alle.some((s) => /ec\.europa\.eu\/consumers\/odr/i.test(s.html))) b.push({ id: "os_link", status: "hinweis", schwere: "niedrig", pflicht_id: "online.os_link" });

  // Barrierefreiheit: automatisierte Basistests (keine vollständige WCAG-Prüfung)
  const lang = dok.querySelector("html")?.getAttribute("lang");
  b.push({ id: "a11y_sprache", status: lang ? "ok" : "fehlt", schwere: "mittel", pflicht_id: "online.barrierefreiheit" });
  b.push({ id: "a11y_titel", status: dok.querySelector("title") && text(dok.querySelector("title")!) ? "ok" : "fehlt", schwere: "niedrig", pflicht_id: "online.barrierefreiheit" });
  const ohneAlt = dok.querySelectorAll("img").filter((i) => i.getAttribute("alt") === undefined).length;
  b.push({ id: "a11y_alt", status: ohneAlt ? "hinweis" : "ok", schwere: "mittel", werte: { n: ohneAlt }, pflicht_id: "online.barrierefreiheit" });
  const labels = new Set(dok.querySelectorAll("label[for]").map((l) => l.getAttribute("for")));
  const ohneLabel = dok
    .querySelectorAll("input, select, textarea")
    .filter((e) => !/^(hidden|submit|button|reset|image)$/i.test(e.getAttribute("type") ?? ""))
    .filter((e) => !(e.id && labels.has(e.id)) && !e.getAttribute("aria-label") && !e.getAttribute("aria-labelledby") && !e.getAttribute("title") && e.closest("label") === null).length;
  b.push({ id: "a11y_label", status: ohneLabel ? "hinweis" : "ok", schwere: "mittel", werte: { n: ohneLabel }, pflicht_id: "online.barrierefreiheit" });
  if (profil.b2c && profil.fernabsatz)
    b.push({ id: "barrierefreiheitserklaerung", status: findeLink(dok, seiten.start.url, /barrierefrei|accessibility/i) ? "ok" : "hinweis", schwere: "mittel", pflicht_id: "online.barrierefreiheit" });

  if (profil.b2c && profil.waren) b.push({ id: "gpsr", status: "nicht_geprueft", schwere: "mittel", pflicht_id: "produkte.gpsr" });

  const rang = { fehlt: 0, hinweis: 1, nicht_geprueft: 2, ok: 3 } as const;
  const gewicht = { hoch: 0, mittel: 1, niedrig: 2 } as const;
  return b.sort((x, y) => rang[x.status] - rang[y.status] || gewicht[x.schwere] - gewicht[y.schwere]);
}

/** Abruf und Prüfung in einem Schritt: Startseite, dann Impressum und Datenschutz (nur gleicher Host). */
export async function onlineCheck(url: string, profil: CheckProfil, optionen: AbrufOptionen = {}) {
  const start = await seiteAbrufen(url, optionen);
  if (start.status >= 400) throw new CheckFehler("nicht_erreichbar", `HTTP ${start.status}`);
  const dok = parse(start.html);
  const host = new URL(start.url).host;
  const unterseite = async (muster: RegExp) => {
    const ziel = findeLink(dok, start.url, muster);
    if (!ziel || new URL(ziel).host !== host) return null;
    if (ziel.split("#")[0] === start.url.split("#")[0]) return start;
    try {
      const s = await seiteAbrufen(ziel, optionen);
      return s.status < 400 ? s : null;
    } catch {
      return null;
    }
  };
  const [impressum, datenschutz] = await Promise.all([unterseite(IMPRESSUM), unterseite(DATENSCHUTZ)]);
  return { url: start.url, seiten: [start.url, impressum?.url, datenschutz?.url].filter(Boolean) as string[], befunde: pruefeSeiten({ start, impressum, datenschutz }, profil) };
}
