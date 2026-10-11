#!/usr/bin/env node
/**
 * End-to-End-Rundgang mit Barrierefreiheitsprüfung (axe, WCAG 2.2 AA) auf jeder Seite.
 * Erwartet laufende Web-App (E2E_URL, Standard http://localhost:3000) mit AUTH_MODUS=dev,
 * API und Worker. Browser: CHROMIUM_PFAD oder der von Playwright installierte Chromium.
 * Bildschirmfotos landen in E2E_BILDER (optional).
 */
import fs from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const B = process.env.E2E_URL ?? "http://localhost:3000";
const BILDER = process.env.E2E_BILDER;
const kennung = `e2e-${Date.now()}`;
const fehler = [];
const pruefe = (bedingung, text) => { if (!bedingung) fehler.push(text); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined, headless: true, args: ["--no-sandbox"] });

async function barrierefrei(seite, name) {
  // Nach Navigation per Server-Aktion setzt Next.js den Titel einen Moment später – nicht den Zwischenzustand prüfen
  await seite.waitForFunction(() => document.title.length > 0, null, { timeout: 5000 }).catch(() => undefined);
  const r = await new AxeBuilder({ page: seite }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  for (const v of r.violations) fehler.push(`${name}: axe ${v.id} (${v.impact}) – ${v.help} [${v.nodes.length}×]`);
  if (BILDER) await seite.screenshot({ path: path.join(BILDER, `${name}.png`), fullPage: true });
}

async function rundgang(farbschema, breite) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: 900 }, colorScheme: farbschema, locale: "de-DE" });
  const p = await ctx.newPage();
  const name = (s) => `${farbschema}-${breite}-${s}`;

  await p.goto(`${B}/anmelden`);
  await barrierefrei(p, name("anmelden"));
  await p.fill("#kennung", `${kennung}-${farbschema}-${breite}`);
  await Promise.all([p.waitForURL(/unternehmen\/neu/), p.click("button")]);
  await barrierefrei(p, name("unternehmen-neu"));
  await p.fill("#name", "Testbetrieb");
  await Promise.all([p.waitForURL(/onboarding\/rechtsform/), p.click("button")]);
  await barrierefrei(p, name("onboarding"));

  const antworten = {
    rechtsform: () => p.check('input[value="einzelunternehmen"]'),
    start: () => p.fill('input[name="gruendungsdatum"]', "2024-03-01"),
    ort: () => p.fill('input[name="gemeinde_ags"]', "11000000"),
    umsatzsteuer: async () => { await p.check('input[name="ust.kleinunternehmer"][value="nein"]'); await p.fill('input[name="ust.zahllast_vorjahr"]', "12.400"); },
    beschaeftigte: () => p.fill('input[name="beschaeftigte.gesamt"]', "2"),
  };
  for (let i = 0; i < 12 && p.url().includes("/onboarding/"); i++) {
    const schritt = p.url().split("/onboarding/")[1].split("?")[0];
    await antworten[schritt]?.();
    await Promise.all([p.waitForURL((u) => !u.href.includes(`/onboarding/${schritt}`)), p.click("form button.knopf:not(.knopf-leise)")]);
  }
  pruefe(p.url().includes("/heute"), `${name("onboarding")}: endet nicht auf /heute (${p.url()})`);

  // Worker rechnet asynchron
  for (let i = 0; i < 20; i++) {
    await p.goto(`${B}/heute`);
    if (await p.locator("#naechstes").count()) break;
    await p.waitForTimeout(500);
  }
  pruefe(await p.locator("#naechstes").count(), `${name("heute")}: keine Aufgaben nach Berechnung`);
  await barrierefrei(p, name("heute"));

  // Sammelbestätigung vor dem Start
  if (await p.locator("#vorstart").count()) {
    await p.click("#vorstart ~ div button, section[aria-labelledby=vorstart] button");
    await p.waitForLoadState("networkidle");
    pruefe(!(await p.locator("#vorstart").count()), `${name("heute")}: Sammelbestätigung bleibt sichtbar`);
  }

  await p.goto(`${B}/pflichten`);
  await barrierefrei(p, name("pflichten"));
  const link = await p.locator("main section ul li a").first().getAttribute("href");
  pruefe(link, `${name("pflichten")}: keine Pflicht in der Liste`);
  await p.goto(`${B}${link}`);
  await barrierefrei(p, name("pflicht"));
  if (await p.getByRole("button", { name: "Als erledigt markieren" }).count()) {
    await p.getByRole("button", { name: "Als erledigt markieren" }).click();
    await p.waitForLoadState("networkidle");
    pruefe(await p.locator(".stempel").count(), `${name("pflicht")}: kein Erledigt-Stempel`);
  }

  for (const seite of ["kalender", "melden", "einstellungen", "hilfe", "pflichten/nicht-zutreffend"]) {
    await p.goto(`${B}/${seite}`);
    await barrierefrei(p, name(seite.replace("/", "-")));
  }

  // Team: einladen, Link nur einmal sichtbar; Eingeladene meldet sich über den Link an und nimmt an
  const gast = `${kennung}-gast-${farbschema}`;
  await p.goto(`${B}/team`);
  await barrierefrei(p, name("team"));
  await p.fill("#email", `${gast}@example.org`);
  await p.check('input[name="rolle"][value="steuerberater"]');
  await p.getByRole("button", { name: "Einladung senden" }).click();
  // Server-Aktion + Redirect abwarten (networkidle kann schon vor dem Klick erreicht sein)
  const einladungsLink = await p.locator('div[role="status"] input').inputValue({ timeout: 15000 }).catch((e) => `FEHLER ${e.message.split("\n")[0]}`);
  pruefe(/\/einladung\/[A-Za-z0-9_-]{43}$/.test(einladungsLink), `${name("team")}: kein Einladungslink (${einladungsLink})`);
  await barrierefrei(p, name("team-eingeladen"));
  // Der Link steht nie in der URL (Verlauf, Logs); er ist zwei Minuten über ein httpOnly-Cookie abrufbar, wie beim Kalender-Abo
  pruefe(!p.url().includes(einladungsLink.split("/").pop() || "§"), `${name("team")}: Token steht in der URL`);
  pruefe(await p.getByText(`${gast}@example.org`).count(), `${name("team")}: offene Einladung fehlt`);

  if (einladungsLink) {
    const ctx2 = await browser.newContext({ viewport: { width: breite, height: 900 }, colorScheme: farbschema, locale: "de-DE" });
    const g = await ctx2.newPage();
    await g.goto(new URL(new URL(einladungsLink).pathname, B).href);
    await barrierefrei(g, name("einladung-anmelden"));
    await Promise.all([g.waitForURL(/anmelden\?weiter=/), g.getByRole("link", { name: "Anmelden und Einladung annehmen" }).click()]);
    await g.fill("#kennung", gast);
    await Promise.all([g.waitForURL(/\/einladung\//), g.click("button")]);
    pruefe(await g.getByText("Testbetrieb").count(), `${name("einladung")}: Unternehmen nicht genannt`);
    await barrierefrei(g, name("einladung"));
    await Promise.all([g.waitForURL(/\/heute/), g.getByRole("button", { name: "Einladung annehmen" }).click()]);
    pruefe(await g.getByText("Testbetrieb").count(), `${name("einladung")}: nach Annahme nicht im Unternehmen`);
    await ctx2.close();
    await p.goto(`${B}/team`);
      pruefe(await p.getByText(gast, { exact: true }).count(), `${name("team")}: neues Mitglied fehlt`);
  }
  await ctx.close();
}

if (BILDER) fs.mkdirSync(BILDER, { recursive: true });
try {
  await rundgang("light", 1280);
  await rundgang("dark", 390);
} finally {
  await browser.close();
}
if (fehler.length) {
  console.error(`✗ ${fehler.length} Befunde:\n- ${fehler.join("\n- ")}`);
  // In GitHub Actions zusätzlich als Annotationen (lesbar ohne Log-Download)
  if (process.env.GITHUB_ACTIONS) for (const f of fehler.slice(0, 10)) console.log(`::error title=E2E Web::${f.replace(/[\r\n]+/g, " ")}`);
  process.exit(1);
}
console.log("✓ Rundgang hell/dunkel, Desktop/mobil ohne Befunde (inkl. axe WCAG 2.2 AA)");
