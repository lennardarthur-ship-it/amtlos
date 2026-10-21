#!/usr/bin/env node
/**
 * Studio-Rundgang: Redaktion bearbeitet eine Pflicht im Formular-Editor, Fehlermeldung bei leerem Titel,
 * neue Pflicht anlegen; axe (WCAG 2.2 AA) auf Übersicht und Editor.
 * Erwartet laufendes Studio (STUDIO_URL, Standard http://localhost:3100) mit AUTH_MODUS=dev und ein Konto
 * „redakteurin“ mit Plattformrolle redaktion und ein Konto „plattformadmin“ mit Plattformrolle plattform_admin. Browser: CHROMIUM_PFAD oder Playwright-Chromium.
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

  // Regelwerte: neue Version im Formular, Fehlermeldung, neuer Regelwert
  await p.goto(`${B}/regelwerte`);
  await axe("regelwerte");
  await p.goto(`${B}/regelwerte/steuern.ust_va.grenze_monatlich`);
  await axe("regelwert");
  await p.getByLabel("Wert").fill("9.000");
  pruefe(/ok=Version \d+ gespeichert/.test(await speichern("Als neue Version speichern", /ok=|fehler=/)), "Regelwert-Version konnte nicht gespeichert werden");
  pruefe((await p.locator("table tbody tr").first().innerText()).includes("9000"), "Neue Regelwert-Version zeigt nicht 9000");
  await p.getByLabel("Rechtsgrundlagen").fill("");
  pruefe((await speichern("Als neue Version speichern", /fehler=/)).includes("Rechtsgrundlagen: braucht mindestens 1 Eintrag"), "Keine verständliche Meldung bei fehlender Rechtsgrundlage");
  await p.goto(`${B}/regelwerte/neu`);
  await axe("regelwert-neu");
  for (const [feld, wert] of [["ID", `test.e2e_${Date.now()}`], ["Bezeichnung (Deutsch)", "E2E-Wert"], ["Wert", "13,90"], ["Gültig ab", "2026-01-01"], ["Rechtsgrundlagen", "§ 1 Test"], ["Quelle 1: Titel", "Test"], ["Quelle 1: Adresse", "https://example.org"]])
    await p.getByLabel(feld, { exact: true }).fill(wert);
  pruefe((await speichern("Regelwert anlegen und zur Prüfung geben", /ok=|fehler=/)).includes("ok=Regelwert angelegt"), "Neuer Regelwert konnte nicht angelegt werden");

  // Marktplatz-Partner: ohne geprüfte Zulassung nicht sichtbar schaltbar; mit Zulassung angelegt (für den Web-Rundgang)
  await p.goto(`${B}/partner`);
  await axe("partner");
  const neu = p.locator('section[aria-labelledby="neu"]');
  await neu.locator('input[name="name"]').fill("E2E Steuerkanzlei");
  await neu.locator('input[name="email"]').fill("kanzlei@example.org");
  await neu.locator('textarea[name="pakete"]').fill("Erstberatung | 30 Minuten per Video | 90 € laut Kanzlei");
  await neu.locator('input[name="aktiv"]').check();
  pruefe(/zulassung/i.test(await speichern("Speichern", /fehler=/)), "Partner ohne geprüfte Zulassung wurde sichtbar geschaltet");
  await neu.locator('input[name="name"]').fill("E2E Steuerkanzlei");
  await neu.locator('input[name="email"]').fill("kanzlei@example.org");
  await neu.locator('textarea[name="pakete"]').fill("Erstberatung | 30 Minuten per Video | 90 € laut Kanzlei");
  await neu.locator('input[name="zulassung_geprueft_am"]').fill("2026-01-15");
  await neu.locator('input[name="aktiv"]').check();
  pruefe((await speichern("Speichern", /ok=|fehler=/)).includes("ok=1"), "Partner konnte nicht angelegt werden");

  // Übersetzungen: Redaktion prüft einen englischen Text
  await p.goto(`${B}/uebersetzungen?suche=${encodeURIComponent("Gefährdungsbeurteilung erstellen")}`);
  await axe("uebersetzungen");
  const eintrag = p.locator("li", { hasText: "Gefährdungsbeurteilung erstellen" }).first();
  if (await eintrag.count()) {
    await eintrag.locator('input[name="geprueft"]').check();
    const vorher = p.url();
    await Promise.all([p.waitForURL((u) => u.href !== vorher || true), eintrag.getByRole("button", { name: "Speichern" }).click()]);
    await p.waitForLoadState("networkidle");
    const geprueft = await p
      .getByText(/geprüft am \d{4}-\d{2}-\d{2}/)
      .first()
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    pruefe(geprueft, "Übersetzung wurde nicht als geprüft markiert");
  } else pruefe(false, "Übersetzung „Gefährdungsbeurteilung erstellen“ fehlt");

  // White-Label-Marken: Redaktion darf nicht, Plattform-Admin legt eine Marke für 127.0.0.1 an (für den Web-Rundgang)
  await p.goto(`${B}/marken`);
  pruefe((await p.locator('section[aria-labelledby="neu"]').count()) === 0, "Redaktion sieht das Formular für Marken");
  const admin = await (await browser.newContext({ viewport: { width: 1360, height: 900 } })).newPage();
  await admin.goto(`${B}/anmelden`);
  await admin.fill("#kennung", "plattformadmin");
  await admin.click("button");
  await admin.waitForSelector("header");
  await admin.goto(`${B}/marken`);
  if (!(await admin.getByText("Kanzlei Beispiel").count())) {
    const form = admin.locator('section[aria-labelledby="neu"]');
    await form.locator('input[name="schluessel"]').fill("kanzlei-beispiel");
    await form.locator('input[name="name"]').fill("Kanzlei Beispiel");
    await form.locator('input[name="hosts"]').fill("127.0.0.1");
    await form.locator('input[name="farbe_hell"]').fill("#ffd400");
    const vorher = admin.url();
    await Promise.all([admin.waitForURL((u) => u.href !== vorher), form.getByRole("button", { name: "Speichern" }).click()]);
    pruefe(/Kontrast/.test(decodeURIComponent(admin.url())), "Marke mit zu hellem Gelb wurde nicht abgewiesen");
    await form.locator('input[name="schluessel"]').fill("kanzlei-beispiel");
    await form.locator('input[name="name"]').fill("Kanzlei Beispiel");
    await form.locator('input[name="hosts"]').fill("127.0.0.1");
    await form.locator('input[name="farbe_hell"]').fill("#1f4e8c");
    await form.locator('input[name="farbe_dunkel"]').fill("#8fb8ff");
    const vorher2 = admin.url();
    await Promise.all([admin.waitForURL((u) => u.href !== vorher2), form.getByRole("button", { name: "Speichern" }).click()]);
    pruefe(admin.url().includes("ok=1"), `Marke konnte nicht angelegt werden (${decodeURIComponent(admin.url())})`);
  }
  {
    await admin.waitForFunction(() => document.title.length > 0, null, { timeout: 5000 }).catch(() => undefined);
    const r = await new AxeBuilder({ page: admin }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    for (const v of r.violations) fehler.push(`marken: axe ${v.id} – ${v.help} [${v.nodes.length}×]`);
  }
} finally {
  await browser.close();
}
if (fehler.length) {
  console.error(`✗ ${fehler.length} Befunde:\n- ${fehler.join("\n- ")}`);
  process.exit(1);
}
console.log("✓ Studio: Pflicht-, Regelwert-, Partner- und Marken-Formulare (Bearbeiten, Fehlermeldung, Neuanlage), axe ohne Befunde");
