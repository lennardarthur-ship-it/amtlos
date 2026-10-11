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
    const weg = await p.locator("#vorstart").waitFor({ state: "detached", timeout: 15000 }).then(() => true, () => false);
    pruefe(weg, `${name("heute")}: Sammelbestätigung bleibt sichtbar`);
  }

  await p.goto(`${B}/pflichten`);
  await barrierefrei(p, name("pflichten"));
  const link = await p.locator("main section ul li a").first().getAttribute("href");
  pruefe(link, `${name("pflichten")}: keine Pflicht in der Liste`);
  await p.goto(`${B}${link}`);
  await barrierefrei(p, name("pflicht"));
  if (await p.getByRole("button", { name: "Als erledigt markieren" }).count()) {
    await p.getByRole("button", { name: "Als erledigt markieren" }).click();
    const gestempelt = await p.locator(".stempel").first().waitFor({ timeout: 15000 }).then(() => true, () => false);
    pruefe(gestempelt, `${name("pflicht")}: kein Erledigt-Stempel`);
  }

  for (const seite of ["kalender", "melden", "einstellungen", "hilfe", "pflichten/nicht-zutreffend", "gruendung", "gruendung/fragebogen"]) {
    await p.goto(`${B}/${seite}`);
    await barrierefrei(p, name(seite.replace("/", "-")));
  }

  // Finanzen (nur im ersten Durchlauf): Angaben, Kunde, Rechnung stellen, Beleg hochladen, USt vorbereiten
  if (farbschema === "light") {
    await p.goto(`${B}/finanzen`);
    await barrierefrei(p, name("finanzen"));
    await p.goto(`${B}/finanzen/angaben`);
    for (const [id, v] of [["name", "Testbetrieb"], ["strasse", "Weg 1"], ["plz", "10115"], ["ort", "Berlin"], ["email", "test@example.org"], ["telefon", "+49 30 1"], ["steuernummer", "11/222/33333"], ["iban", "DE02120300000000202051"]]) await p.fill(`#${id}`, v);
    await Promise.all([p.waitForURL(/ok=1/), p.getByRole("button", { name: "Angaben speichern" }).click()]);
    await p.locator("summary").click();
    for (const [id, v] of [["k_name", "Kunde AG"], ["k_strasse", "Ring 2"], ["k_plz", "20095"], ["k_ort", "Hamburg"], ["k_email", "rechnung@kunde.example"]]) await p.fill(`#${id}`, v);
    await p.getByRole("button", { name: "Kunden anlegen" }).click();
    await p.getByText("Kunde AG").first().waitFor({ timeout: 10000 });
    await barrierefrei(p, name("finanzen-angaben"));
    await p.goto(`${B}/finanzen/rechnungen`);
    await Promise.all([p.waitForURL(/rechnungen\/[0-9a-f-]{36}/), p.getByRole("button", { name: "Neue Rechnung" }).click()]);
    await p.selectOption("#kunde_id", { label: "Kunde AG" });
    await p.fill("#leistungsdatum", "2026-10-01");
    await p.fill("#p0_bezeichnung", "Beratung");
    await p.fill("#p0_preis", "100,00");
    await barrierefrei(p, name("rechnung-entwurf"));
    await p.getByRole("button", { name: "Rechnung stellen" }).click();
    const gestellt = await p.getByRole("link", { name: "PDF herunterladen" }).waitFor({ timeout: 20000 }).then(() => true, () => false);
    pruefe(gestellt, `${name("rechnung")}: Rechnung wurde nicht gestellt (${p.url()})`);
    if (gestellt) {
      await barrierefrei(p, name("rechnung-gestellt"));
      const pdf = await p.request.get(`${B}${await p.getByRole("link", { name: "PDF herunterladen" }).getAttribute("href")}`);
      pruefe(pdf.ok() && (await pdf.body()).subarray(0, 5).toString() === "%PDF-", `${name("rechnung")}: PDF nicht abrufbar`);
    }
    await p.goto(`${B}/finanzen/belege`);
    await p.setInputFiles("#datei", { name: "quittung.pdf", mimeType: "application/pdf", buffer: Buffer.from(`%PDF-1.4\n% e2e ${Date.now()}\n`) });
    await Promise.all([p.waitForURL(/ok=1|fehler=/), p.getByRole("button", { name: "Hochladen" }).click()]);
    pruefe(p.url().includes("ok=1"), `${name("belege")}: Upload fehlgeschlagen (${p.url()})`);
    await barrierefrei(p, name("belege"));
    await p.goto(`${B}/finanzen/ust?periode=2026-10`);
    await barrierefrei(p, name("ust"));
    await p.goto(`${B}/finanzen/kassen`);
    await barrierefrei(p, name("kassen"));
  }

  // Personal: einstellen, Checkliste, Unterweisung bestätigen und abschließen, Zeiten stempeln
  if (farbschema === "light") {
    await p.goto(`${B}/personal`);
    await barrierefrei(p, name("personal-leer"));
    await p.fill("#vorname", "Tom");
    await p.fill("#nachname", "Teig");
    await p.selectOption("#art", "minijob");
    await p.getByRole("button", { name: "Erfassen" }).click();
    await p.getByText("Tom Teig").first().waitFor({ timeout: 10000 });
    await barrierefrei(p, name("personal"));
    await p.getByRole("link", { name: "Checkliste" }).first().click();
    await p.getByRole("heading", { name: /Checkliste für Tom Teig/ }).waitFor({ timeout: 10000 });
    await barrierefrei(p, name("personal-checkliste"));
    await p.goto(`${B}/personal/unterweisungen`);
    await p.fill("#thema", "Backstube");
    await p.fill("#u-inhalt", "Ofen, Teigmaschine, Fluchtwege");
    await p.fill("#durchgefuehrt_von", "Inhaberin");
    await Promise.all([p.waitForURL(/unterweisungen\/[0-9a-f-]{36}/), p.getByRole("button", { name: "Anlegen" }).click()]);
    await p.fill("#name", "Tom Teig");
    await p.getByRole("button", { name: "Gelesen und verstanden" }).click();
    await p.getByRole("button", { name: "Abschließen und Protokoll ablegen" }).waitFor({ timeout: 10000 });
    await barrierefrei(p, name("unterweisung"));
    await Promise.all([p.waitForURL(/erledigt=/), p.getByRole("button", { name: "Abschließen und Protokoll ablegen" }).click()]);
    const protokoll = p.getByRole("link", { name: "Protokoll (PDF)" });
    pruefe(await protokoll.count(), `${name("unterweisung")}: kein Protokoll-Link`);
    if (await protokoll.count()) {
      const pdf = await p.request.get(`${B}${await protokoll.getAttribute("href")}`);
      pruefe(pdf.ok() && (await pdf.body()).subarray(0, 5).toString() === "%PDF-", `${name("unterweisung")}: Protokoll nicht abrufbar`);
    }
    await barrierefrei(p, name("unterweisung-abgeschlossen"));
    await p.goto(`${B}/personal/zeiten`);
    await p.getByRole("button", { name: "Kommen" }).click();
    await p.getByRole("button", { name: "Gehen" }).waitFor({ timeout: 10000 });
    await barrierefrei(p, name("zeiten-laeuft"));
    await p.getByRole("button", { name: "Gehen" }).click();
    await p.getByRole("button", { name: "Kommen" }).waitFor({ timeout: 10000 });
    pruefe(await p.locator("table.tabelle tbody tr").count(), `${name("zeiten")}: kein Eintrag nach dem Stempeln`);
    // Nachtrag in Ortszeit, dann Korrektur: der korrigierte Eintrag ersetzt den alten
    await p.fill("#n-von", "08:00");
    await p.fill("#n-bis", "12:30");
    await p.fill("#n-pause", "30");
    await p.fill("#n-grund", "Stempeln vergessen");
    await p.getByRole("button", { name: "Nachtragen" }).click();
    await p.getByText("08:00–12:30").waitFor({ timeout: 10000 }).catch(() => pruefe(false, `${name("zeiten")}: Nachtrag fehlt (${p.url()})`));
    const zeile = p.locator("tr", { hasText: "08:00–12:30" });
    await zeile.locator("summary").click();
    await zeile.locator('input[name="bis"]').fill("13:00");
    await zeile.locator('input[name="grund"]').fill("Ende falsch");
    await zeile.getByRole("button", { name: "Korrigieren" }).click();
    await p.getByText("08:00–13:00").waitFor({ timeout: 10000 }).catch(() => pruefe(false, `${name("zeiten")}: Korrektur fehlt (${p.url()})`));
    pruefe((await p.getByText("08:00–12:30").count()) === 0, `${name("zeiten")}: ersetzter Eintrag wird noch als gültig gezeigt`);
    pruefe(await p.getByText("4 Std. 30 Min.").count(), `${name("zeiten")}: Dauer der Korrektur falsch`);
    await barrierefrei(p, name("zeiten"));
  } else {
    for (const seite of ["personal", "personal/unterweisungen", "personal/zeiten"]) {
      await p.goto(`${B}/${seite}`);
      await barrierefrei(p, name(seite.replaceAll("/", "-")));
    }
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
