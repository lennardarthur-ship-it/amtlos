#!/usr/bin/env node
/**
 * Studio-Rundgang: Redaktion bearbeitet eine Pflicht im Formular-Editor, Fehlermeldung bei leerem Titel,
 * neue Pflicht anlegen; axe (WCAG 2.2 AA) auf Übersicht und Editor.
 * Erwartet laufendes Studio (STUDIO_URL, Standard http://localhost:3100) mit AUTH_MODUS=dev und ein Konto
 * „redakteurin“ mit Plattformrolle redaktion. Browser: CHROMIUM_PFAD oder Playwright-Chromium.
 */
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright-core";

const B = process.env.STUDIO_URL ?? "http://localhost:3100";
const fehler = [];
const pruefe = (ok, text) => { if (!ok) fehler.push(text); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined, headless: true, args: ["--no-sandbox"] });
const p = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
const axe = async (name) => {
  await p.waitForFunction(() => document.title.length > 0, null, { timeout: 5000 }).catch(() => undefined);
  const r = await new AxeBuilder({ page: p }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  for (const v of r.violations) fehler.push(`${name}: axe ${v.id} – ${v.help} [${v.nodes.length}×]`);
};
const speichern = async (knopf, muster) => {
  const vorher = p.url();
  await Promise.all([p.waitForURL((u) => u.href !== vorher && muster.test(u.href)), p.getByRole("button", { name: knopf }).click()]);
  return decodeURIComponent(p.url());
};

try {
  await p.goto(`${B}/anmelden`);
  await p.fill("#kennung", "redakteurin");
  await p.click("button");
  await p.waitForSelector("header");
  await axe("uebersicht");

  await p.goto(`${B}/pflichten/arbeitsschutz.gefaehrdungsbeurteilung`);
  await axe("editor");
  await p.getByLabel("In einem Satz (Deutsch)").fill("Bevor jemand bei dir arbeitet, hältst du fest, welche Gefahren es gibt und was du dagegen tust.");
  await p.getByRole("button", { name: "Bedingung hinzufügen" }).first().click();
  await p.getByLabel("Angabe (Fakt)").nth(1).selectOption("profil.beschaeftigte.jugendlich");
  await p.getByLabel("Vergleich", { exact: true }).nth(1).selectOption(">=");
  const vorschau = await p.locator("text=Klartext: Die Pflicht gilt, wenn").locator("..").innerText();
  pruefe(vorschau.includes("profil.beschaeftigte.jugendlich ist mindestens"), "Klartext-Vorschau zeigt neue Bedingung nicht");
  pruefe(/ok=Version \d+ gespeichert/.test(await speichern("Als neue Version speichern", /ok=|fehler=/)), "Speichern einer gültigen Version schlug fehl");

  await p.getByLabel("Titel (Deutsch)").fill("");
  pruefe((await speichern("Als neue Version speichern", /fehler=/)).includes("Titel › Deutsch: darf nicht leer sein"), "Keine verständliche Meldung bei leerem Titel");

  await p.goto(`${B}/pflichten/neu?kategorie=steuern&id=steuern.e2e_${Date.now()}`);
  for (const [feld, wert] of [["Titel (Deutsch)", "E2E-Pflicht"], ["In einem Satz (Deutsch)", "Nur ein Test."], ["Erklärung (Deutsch)", "Nur ein Test."], ["Zuständige Stelle (Deutsch)", "Finanzamt"], ["Was passiert, wenn man es nicht tut (Deutsch)", "Nichts."], ["Rechtsgrundlage 1", "§ 1 Test"], ["Adresse", "https://example.org"]])
    await p.getByLabel(feld).fill(wert);
  await p.getByLabel("Titel", { exact: true }).fill("Testquelle");
  pruefe((await speichern("Pflicht anlegen und zur Prüfung geben", /ok=|fehler=/)).includes("ok=Pflicht angelegt"), "Neue Pflicht konnte nicht angelegt werden");
} finally {
  await browser.close();
}
if (fehler.length) {
  console.error(`✗ ${fehler.length} Befunde:\n- ${fehler.join("\n- ")}`);
  process.exit(1);
}
console.log("✓ Studio-Editor: Bearbeiten, Fehlermeldung, Neuanlage, axe ohne Befunde");
