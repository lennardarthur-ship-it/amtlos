#!/usr/bin/env node
/**
 * Kern-Umfang (E-110): Mit AMTLOS_UMFANG unbelegt zeigt die Web-App nur die Kernmodule. Erwartet eine laufende
 * Web-App ohne AMTLOS_UMFANG (E2E_KERN_URL, Standard http://localhost:3002) mit AUTH_MODUS=dev, API und Worker.
 */
import { chromium } from "playwright-core";
import { MARKE } from "@amtlos/marke";

const B = process.env.E2E_KERN_URL ?? "http://localhost:3002";
const fehler = [];
const pruefe = (ok, text) => { if (!ok) fehler.push(text); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined, headless: true, args: ["--no-sandbox"] });
try {
  const p = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "de-DE" })).newPage();
  await p.goto(`${B}/anmelden`);
  await p.fill("#kennung", `kern-${Date.now()}`);
  await Promise.all([p.waitForURL(/unternehmen\/neu/), p.click("button")]);
  await p.fill("#name", "Kernbetrieb");
  await Promise.all([p.waitForURL(/onboarding/), p.click("button")]);
  await p.goto(`${B}/heute`);
  const nav = await p.locator('nav[aria-label="Hauptnavigation"] a').allInnerTexts();
  pruefe(nav.join("|") === "Heute|Pflichten|Kalender|Finanzen|Personal|Postfach|Einstellungen|Mehr", `Navigation nicht auf den Kern gekürzt: ${nav.join("|")}`);
  pruefe((await p.locator("#heute-frage").count()) === 0, "Frag-Amtlos-Feld sichtbar, obwohl versteckt");
  for (const pfad of ["/experten", "/frag", "/radar", "/online", "/branche", "/datenschutz", "/kanzlei", "/personal/gefaehrdungsbeurteilungen", "/personal/arbeitsmittel"]) {
    const r = await p.goto(`${B}${pfad}`);
    pruefe(r?.status() === 404, `${pfad}: Status ${r?.status()} statt 404`);
  }
  await p.goto(`${B}/mehr`);
  const mehr = await p.locator("main a").allInnerTexts();
  pruefe(!mehr.some((t) => new RegExp(`Experten|Frag (Amtlos|${MARKE.name})|Was kommt|Mandanten`).test(t)), `„Mehr“ zeigt versteckte Module: ${mehr.join(" | ")}`);
  await p.goto(`${B}/personal`);
  pruefe((await p.getByRole("heading", { name: "Arbeitsschutz" }).count()) === 0, "Arbeitsschutz-Werkzeuge sichtbar");
  await p.goto(`${B}/personal/zeiten`);
  pruefe((await p.getByRole("heading", { level: 1 }).count()) === 1, "Kernseite Arbeitszeiten nicht erreichbar");
} finally {
  await browser.close();
}
if (fehler.length) {
  console.error(`✗ ${fehler.length} Befunde:\n- ${fehler.join("\n- ")}`);
  process.exit(1);
}
console.log("✓ Kern-Umfang: nur Kernmodule sichtbar, versteckte Seiten antworten mit 404");
