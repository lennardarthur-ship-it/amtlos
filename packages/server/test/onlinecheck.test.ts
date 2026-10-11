import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CheckFehler, istPrivateAdresse, normalisiereUrl, onlineCheck, pruefeSeiten, seiteAbrufen, type CheckProfil, type Seite } from "../src/onlinecheck.js";

const seite = (url: string, html: string, headers: Seite["headers"] = {}): Seite => ({ url, status: 200, headers, html });
const PROFIL: CheckProfil = { b2c: true, fernabsatz: true, abo: true, kapitalgesellschaft: true, waren: true };
const befund = (l: ReturnType<typeof pruefeSeiten>, id: string) => l.find((b) => b.id === id);

describe("Online-Check: Netzschutz", () => {
  it("erkennt private, lokale und reservierte Adressen", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])
      expect(istPrivateAdresse(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2a00:1450:4001:80b::200e"]) expect(istPrivateAdresse(ip), ip).toBe(false);
  });

  it("normalisiert Eingaben und lehnt andere Protokolle und Zugangsdaten ab", () => {
    expect(normalisiereUrl("beispiel.de").toString()).toBe("https://beispiel.de/");
    expect(normalisiereUrl("http://beispiel.de/shop#x").toString()).toBe("http://beispiel.de/shop");
    for (const u of ["ftp://beispiel.de", "file:///etc/passwd", "https://user:pw@beispiel.de", "javascript:alert(1)", "intranet"]) expect(() => normalisiereUrl(u), u).toThrow(CheckFehler);
  });

  it("verweigert interne Ziele ohne Erlaubnis, auch über IP-Literale und andere Ports", async () => {
    await expect(seiteAbrufen("http://127.0.0.1/")).rejects.toMatchObject({ code: "ziel_nicht_erlaubt" });
    await expect(seiteAbrufen("http://[::1]/")).rejects.toMatchObject({ code: "ziel_nicht_erlaubt" });
    await expect(seiteAbrufen("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({ code: "ziel_nicht_erlaubt" });
    await expect(seiteAbrufen("https://beispiel.de:8443/")).rejects.toMatchObject({ code: "ziel_nicht_erlaubt" });
    await expect(seiteAbrufen("http://localhost/")).rejects.toMatchObject({ code: "ziel_nicht_erlaubt" });
  });
});

describe("Online-Check: Abruf gegen einen lokalen Testserver", () => {
  let server: http.Server;
  let basis: string;
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/weiter") return res.writeHead(302, { Location: "/" }).end();
      if (req.url === "/intern") return res.writeHead(302, { Location: "http://169.254.169.254/" }).end();
      if (req.url === "/bild") return res.writeHead(200, { "Content-Type": "image/png" }).end("x");
      if (req.url === "/gross") {
        res.writeHead(200, { "Content-Type": "text/html" });
        return res.end("x".repeat(3 * 1024 * 1024));
      }
      if (req.url === "/impressum") return res.writeHead(200, { "Content-Type": "text/html" }).end("<html lang=de><title>Impressum</title><p>Muster GmbH, Amtsgericht Berlin HRB 1, info@muster.example</p></html>");
      if (req.url !== "/") return res.writeHead(404, { "Content-Type": "text/html" }).end("<p>nicht gefunden</p>");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": "sid=1" });
      res.end(`<!doctype html><html lang="de"><head><title>Shop</title><script src="https://www.googletagmanager.com/gtag/js?id=G-1"></script></head>
        <body><a href="/impressum">Impressum</a> <a href="/datenschutz">Datenschutz</a><img src="a.png"><p>Tasse 12,90 €</p></body></html>`);
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    basis = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("folgt Weiterleitungen, prüft jedes Ziel neu, begrenzt Typ und Größe", async () => {
    const s = await seiteAbrufen(`${basis}/weiter`, { privateNetzeErlaubt: true });
    expect(s.url).toBe(`${basis}/`);
    await expect(seiteAbrufen(`${basis}/bild`, { privateNetzeErlaubt: true })).rejects.toMatchObject({ code: "kein_html" });
    await expect(seiteAbrufen(`${basis}/gross`, { privateNetzeErlaubt: true })).rejects.toMatchObject({ code: "zu_gross" });
    await expect(seiteAbrufen(`${basis}/`)).rejects.toMatchObject({ code: "ziel_nicht_erlaubt" });
  });

  it("ganzer Check: findet Impressum, meldet fehlende Datenschutzerklärung, Tracker ohne Einwilligung, Preise ohne Steuerhinweis", async () => {
    const r = await onlineCheck(basis, PROFIL, { privateNetzeErlaubt: true });
    expect(r.seiten).toContain(`${basis}/impressum`);
    expect(befund(r.befunde, "impressum")?.status).toBe("ok");
    expect(befund(r.befunde, "impressum_register")?.status).toBe("ok");
    expect(befund(r.befunde, "impressum_email")?.status).toBe("ok");
    expect(befund(r.befunde, "datenschutz")?.status).toBe("fehlt"); // verlinkt, aber 404
    expect(befund(r.befunde, "tracking_vor_einwilligung")).toMatchObject({ status: "hinweis", werte: { tracker: "Google Tag Manager, Google Analytics" } });
    expect(befund(r.befunde, "einwilligungsbanner")?.status).toBe("fehlt");
    expect(befund(r.befunde, "cookies_ohne_einwilligung")).toMatchObject({ status: "hinweis", werte: { n: 1 } });
    expect(befund(r.befunde, "preisangaben")?.status).toBe("hinweis");
    expect(befund(r.befunde, "a11y_alt")).toMatchObject({ status: "hinweis", werte: { n: 1 } });
    expect(befund(r.befunde, "https")?.status).toBe("fehlt");
    expect(r.befunde[0]!.status).toBe("fehlt"); // priorisiert
  });
});

describe("Online-Check: Prüfregeln", () => {
  const start = (html: string) => seite("https://shop.example/", html);

  it("vollständige Seite ohne Befunde mit Einwilligungsbanner und blockierten Skripten", () => {
    const html = `<html lang="de"><head><title>Shop</title><script src="https://consent.cookiebot.com/uc.js"></script>
      <script type="text/plain" data-cookieconsent="statistics" src="https://www.googletagmanager.com/gtag/js"></script></head>
      <body><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutzerklärung</a><a href="/barrierefreiheit">Barrierefreiheit</a>
      <a href="/kuendigen">Verträge hier kündigen</a><button>Vertrag widerrufen</button><label for="q">Suche</label><input id="q"><img src="a" alt="">
      <p>Preis 9,99 € inkl. MwSt.</p></body></html>`;
    const r = pruefeSeiten({ start: start(html), impressum: seite("https://shop.example/impressum", "<p>kontakt@shop.example Registergericht</p>"), datenschutz: seite("https://shop.example/datenschutz", "<p>…</p>") }, PROFIL);
    const offen = r.filter((b) => b.status === "fehlt" || b.status === "hinweis").map((b) => b.id);
    expect(offen).toEqual([]);
    expect(befund(r, "einwilligungsbanner")).toMatchObject({ status: "ok", werte: { name: "Cookiebot" } });
    expect(befund(r, "gpsr")?.status).toBe("nicht_geprueft");
  });

  it("unterscheidet Widerrufsbutton und bloße Widerrufsbelehrung; Kündigungsbutton nur bei Abos", () => {
    const html = `<html><body><a href="/widerruf">Widerrufsbelehrung</a></body></html>`;
    const r = pruefeSeiten({ start: start(html), impressum: null, datenschutz: null }, { ...PROFIL, abo: false });
    expect(befund(r, "widerrufsbutton")?.status).toBe("hinweis");
    expect(befund(r, "kuendigungsbutton")).toBeUndefined();
    expect(befund(r, "a11y_sprache")?.status).toBe("fehlt");
    const b2b = pruefeSeiten({ start: start(html), impressum: null, datenschutz: null }, { b2c: false, fernabsatz: false, abo: false, kapitalgesellschaft: false, waren: false });
    expect(b2b.map((b) => b.id)).not.toContain("widerrufsbutton");
    expect(b2b.map((b) => b.id)).not.toContain("preisangaben");
  });

  it("meldet den früheren OS-Link und Eingabefelder ohne Beschriftung", () => {
    const html = `<html lang="de"><title>x</title><body><a href="https://ec.europa.eu/consumers/odr">OS-Plattform</a><input name="email"><input type="hidden"></body></html>`;
    const r = pruefeSeiten({ start: start(html), impressum: null, datenschutz: null }, PROFIL);
    expect(befund(r, "os_link")?.status).toBe("hinweis");
    expect(befund(r, "a11y_label")).toMatchObject({ status: "hinweis", werte: { n: 1 } });
  });
});
