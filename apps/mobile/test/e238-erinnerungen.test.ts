/**
 * E-238 (Gründerbefund 29.10.2026): Erinnerungen kamen nur, solange man die App ab und zu öffnet.
 * (a) Android: keine Grenze wie beim iPhone – alle Termine der zwölf Monate werden geplant; nach einem Neustart setzt
 *     expo-notifications sie selbst neu (Empfänger für BOOT_COMPLETED in der Bibliothek, Berechtigung in app.json).
 * (b) iPhone (64): eine Mitteilung je Tag mit allen Fristen des Tages; Fälligkeitstag, drei Tage vorher und die erste
 *     Erinnerung an Versäumtes gehen vor weiteren Erinnerungen an Versäumtes und „falls es für dich gilt“; der Hinweis
 *     „App öffnen“ bleibt die letzte Mitteilung. Reichweite vorher/nachher gemessen.
 * (c) „Fristen in den Kalender übernehmen“: Kalenderdatei (RFC 5545) mit festen UIDs, ganztägig, VALARM, CRLF, gefaltet.
 * (d) Hilfetexte bleiben ehrlich.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEERER_STAND, erledigtSetzen } from "../src/unterlagen/speicher";
import { auswertung, terminStand, type Auswertung, type Profil } from "../src/pflichten/check";
import { MAX_MITTEILUNGEN, MAX_MITTEILUNGEN_ANDROID, UEBERFAELLIG_TAGE, erinnerungen, erinnerungsPlan, maxMitteilungen, mitteilung, type Erinnerung, type ErinnerungsPlan } from "../src/pflichten/erinnerungsplan";
import { fristenIcs, icsFalten, icsText, kalenderDateiname, kalenderTermine, kalenderUid, utcIcs, vorherTrigger } from "../src/pflichten/kalender";
import { T as TEXT } from "../src/texte";

const hier = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(hier, "..");
const lies = (p: string) => readFileSync(path.join(APP, p), "utf8");
const betrieb = LEERER_STAND.betrieb;
const imCheck = (p: Profil, am = "2026-10-25T08:00:00.000Z") => Object.fromEntries(Object.keys(p).map((k) => [`profil:${k}`, am]));
const stand = (p: Profil, heute: string, erledigt: Record<string, string> = {}) => {
  const a = terminStand(auswertung(p, heute), { erledigt, zeiten: imCheck(p) }, heute);
  return { a, e: { erledigt, zeiten: imCheck(p), unterlagen: [], betrieb, heute } };
};

/** typische Betriebe (wie in e192/e207/e212) */
const PROFILE: Record<string, Profil> = {
  "Einzelunternehmen Handwerk, Kleinunternehmer": { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", "gesellschaft.handelsregister": false, "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": true, gruendungsdatum: "2023-01-01", steuerberater: false, "online.website": false, "einkauf.eu_unternehmen": false, "einkauf.ausland_unternehmen": false },
  "Agentur, Voranmeldung monatlich": { "taetigkeit.branchen": ["it_agentur_freelancer"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BE", "beschaeftigte.gesamt": 0, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", "ust.dauerfristverlaengerung": false, gruendungsdatum: "2024-01-01", steuerberater: false, "online.website": true, "gewinn.vorjahr": 45000, "vorauszahlung.est": true, "vorauszahlung.gewst": true },
  "Salon mit 3 Beschäftigten": { "taetigkeit.branchen": ["beauty_kosmetik"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "BY", "beschaeftigte.gesamt": 3, "kasse.elektronisch": true, "online.website": false, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", gruendungsdatum: "2024-03-01" },
  "GmbH, Café mit 8 Beschäftigten": { "taetigkeit.branchen": ["gastronomie_lebensmittel"], rechtsform: "gmbh", "taetigkeit.einordnung": "gewerbe", bundesland: "HH", "beschaeftigte.gesamt": 8, "beschaeftigte.minijob": 3, "kasse.elektronisch": true, "online.website": true, "ust.kleinunternehmer": false, "ust.voranmeldung_rhythmus": "monatlich", "ust.dauerfristverlaengerung": true, "personal.lohnsteuer_anmeldezeitraum": "monatlich", gruendungsdatum: "2022-05-01", "vorauszahlung.est": true, "vorauszahlung.gewst": true, "gewinn.vorjahr": 80000 },
};

/** Plan wie vor E-238: die ersten `max - 1` Tage nach Datum, dann der Hinweis (nur zum Vergleich der Reichweite) */
function planVorher(a: Auswertung, e: Parameters<typeof erinnerungen>[1], heute: string, max: number): ErinnerungsPlan {
  const tage = new Map<string, Erinnerung[]>();
  for (const x of erinnerungen(a, e, heute)) tage.set(x.am, [...(tage.get(x.am) ?? []), x]);
  const alle = [...tage.entries()].map(([am, l]) => mitteilung(am, l));
  if (alle.length < max) return { mitteilungen: alle, geplantBis: null };
  const m = alle.slice(0, max - 1);
  return { mitteilungen: m, geplantBis: m[m.length - 1]!.am };
}
/** Bis wann ist jede Kern-Erinnerung (Fälligkeitstag, drei Tage vorher, erste an Versäumtes) geplant? */
function reichweite(plan: ErinnerungsPlan, heute: string): string {
  return plan.geplantBis ?? `vollständig (${plan.mitteilungen.filter((m) => !m.weiterplanen || m.erinnerungen.length).length} Tage, ${heute} + 12 Monate)`;
}

describe("(a) Android: alle Termine der zwölf Monate, auch nach einem Neustart", () => {
  it("Höchstzahl: iPhone 60 (Grenze 64), Android 400 (Grenze des Systems 500 Wecker je App)", () => {
    expect(maxMitteilungen("ios")).toBe(MAX_MITTEILUNGEN);
    expect(MAX_MITTEILUNGEN).toBeLessThan(64);
    expect(maxMitteilungen("android")).toBe(MAX_MITTEILUNGEN_ANDROID);
    expect(MAX_MITTEILUNGEN_ANDROID).toBeLessThan(500);
    // die App übergibt die Höchstzahl des Geräts
    expect(lies("src/seiten/Pflichten.tsx")).toMatch(/erinnerungsPlan\(a, \{ erledigt, unterlagen, betrieb \}, tag, \{ max: maxMitteilungen\(PLATTFORM\) \}\)/);
  });
  for (const [name, p] of Object.entries(PROFILE))
    it(`${name}: Android plant jede Erinnerung der zwölf Monate; die letzte Mitteilung ist der Hinweis`, () => {
      const heute = "2026-10-29";
      const { a, e } = stand(p, heute);
      const plan = erinnerungsPlan(a, e, heute, { max: maxMitteilungen("android") });
      expect(plan.geplantBis).toBeNull();
      const geplant = new Set(plan.mitteilungen.flatMap((m) => m.erinnerungen.map((x) => `${x.pflichtId}|${x.termin}|${x.am}`)));
      for (const x of erinnerungen(a, e, heute)) expect(geplant.has(`${x.pflichtId}|${x.termin}|${x.am}`)).toBe(true);
      expect(plan.mitteilungen[plan.mitteilungen.length - 1]!.weiterplanen).toBe(true);
      expect(plan.mitteilungen.length).toBeLessThanOrEqual(MAX_MITTEILUNGEN_ANDROID);
    });
  it("Neustart: expo-notifications speichert geplante Mitteilungen und setzt sie nach dem Hochfahren neu; Berechtigung in app.json", () => {
    const req = createRequire(path.join(APP, "package.json"));
    const wurzel = path.dirname(req.resolve("expo-notifications/package.json"));
    const manifest = readFileSync(path.join(wurzel, "android/src/main/AndroidManifest.xml"), "utf8");
    expect(manifest).toContain("android.intent.action.BOOT_COMPLETED");
    expect(manifest).toContain("android.intent.action.MY_PACKAGE_REPLACED");
    const dienst = readFileSync(path.join(wurzel, "android/src/main/java/expo/modules/notifications/service/delegates/ExpoSchedulingDelegate.kt"), "utf8");
    expect(dienst).toMatch(/fun setupScheduledNotifications\(\)[\s\S]{0,200}store\.allNotificationRequests\.forEach/);
    const app = JSON.parse(lies("app.json")) as { expo: { android: { permissions: string[]; blockedPermissions: string[] } } };
    expect(app.expo.android.permissions).toContain("android.permission.RECEIVE_BOOT_COMPLETED");
    expect(app.expo.android.blockedPermissions).not.toContain("android.permission.RECEIVE_BOOT_COMPLETED");
  });
});

describe("(b) iPhone: eine Mitteilung je Tag, Kern zuerst, Hinweis als letzte", () => {
  it("Reichweite typischer Betriebe vorher/nachher (iPhone, 60) – nie kürzer, Android immer vollständig", () => {
    const heute = "2026-10-29";
    const zeilen: string[] = [];
    for (const [name, p] of Object.entries(PROFILE)) {
      const { a, e } = stand(p, heute);
      const vorher = planVorher(a, e, heute, MAX_MITTEILUNGEN);
      const nachher = erinnerungsPlan(a, e, heute);
      const android = erinnerungsPlan(a, e, heute, { max: MAX_MITTEILUNGEN_ANDROID });
      zeilen.push(`${name}: Tage mit Erinnerung ${new Set(erinnerungen(a, e, heute).map((x) => x.am)).size}; iPhone vorher ${reichweite(vorher, heute)} → nachher ${reichweite(nachher, heute)}; Android ${reichweite(android, heute)}`);
      if (vorher.geplantBis && nachher.geplantBis) expect(nachher.geplantBis >= vorher.geplantBis).toBe(true);
      if (!vorher.geplantBis) expect(nachher.geplantBis).toBeNull();
      expect(android.geplantBis).toBeNull();
    }
    // gemessen am 29.10.2026 (ENTSCHEIDUNGEN E-238): Salon 25.07.2027 → 21.08.2027, Café-GmbH 09.07.2027 → 28.07.2027
    expect(zeilen).toHaveLength(Object.keys(PROFILE).length);
  });
  it("Versäumtes und Einträge „falls es für dich gilt“ verdrängen keine Fälligkeit – Plan reicht weiter als vorher", () => {
    // Salon am 12.11.: Voranmeldung 10.11. versäumt (Erinnerungen 13.11., 20.11., 27.11.) – dazu die monatlichen Termine
    const p = PROFILE["Salon mit 3 Beschäftigten"]!;
    const heute = "2026-11-12";
    const { a, e } = stand(p, heute);
    const vorher = planVorher(a, e, heute, MAX_MITTEILUNGEN);
    const nachher = erinnerungsPlan(a, e, heute);
    expect(vorher.geplantBis).not.toBeNull();
    expect(nachher.geplantBis).not.toBeNull();
    expect(nachher.geplantBis! > vorher.geplantBis!).toBe(true);
    expect(nachher.mitteilungen).toHaveLength(MAX_MITTEILUNGEN);
    const letzte = nachher.mitteilungen[nachher.mitteilungen.length - 1]!;
    expect(letzte.weiterplanen).toBe(true);
    expect(letzte.am > nachher.geplantBis!).toBe(true);
    // jede Kern-Erinnerung bis „geplant bis“ ist im Plan
    const alle = erinnerungen(a, e, heute);
    const erst = new Map<string, string>();
    for (const x of alle) if (x.art === "ueberfaellig" && !erst.has(`${x.pflichtId}|${x.termin}`)) erst.set(`${x.pflichtId}|${x.termin}`, x.am);
    const kern = alle.filter((x) => !x.vielleicht && (x.art !== "ueberfaellig" || erst.get(`${x.pflichtId}|${x.termin}`) === x.am));
    const geplant = new Set(nachher.mitteilungen.flatMap((m) => m.erinnerungen.map((x) => `${x.pflichtId}|${x.termin}|${x.am}`)));
    for (const x of kern.filter((x) => x.am <= nachher.geplantBis!)) expect(geplant.has(`${x.pflichtId}|${x.termin}|${x.am}`)).toBe(true);
    // die erste Erinnerung an das Versäumte bleibt (morgen); spätere nur, wo ohnehin eine Mitteilung ist
    const va = nachher.mitteilungen.flatMap((m) => m.erinnerungen).filter((x) => x.art === "ueberfaellig" && x.pflichtId === "steuern.ust_voranmeldung");
    expect(va[0]!.am).toBe("2026-11-13");
    expect(UEBERFAELLIG_TAGE[0]).toBe(1);
    // eine Mitteilung je Tag
    const tage = nachher.mitteilungen.map((m) => m.am);
    expect(new Set(tage).size).toBe(tage.length);
    expect(tage).toEqual([...tage].sort());
  });
  it("alles passt: unverändert alle Erinnerungen und der Hinweis elf Monate nach heute", () => {
    const p = PROFILE["Einzelunternehmen Handwerk, Kleinunternehmer"]!;
    const { a, e } = stand(p, "2026-10-29");
    const plan = erinnerungsPlan(a, e, "2026-10-29");
    expect(plan.geplantBis).toBeNull();
    expect(plan.mitteilungen.filter((m) => m.weiterplanen)).toHaveLength(1);
    expect(plan.mitteilungen[plan.mitteilungen.length - 1]!.weiterplanen).toBe(true);
  });
});

describe("(c) Fristen in den Kalender übernehmen", () => {
  const heute = "2026-10-29";
  const jetzt = new Date("2026-10-29T09:15:00+01:00");
  const p = PROFILE["Agentur, Voranmeldung monatlich"]!;
  const { a, e } = stand(p, heute);
  const termine = kalenderTermine(a, e, heute);
  const ics = fristenIcs(termine, heute, jetzt);
  const entfaltet = ics.replace(/\r\n /g, "");
  const ereignisse = entfaltet.split("BEGIN:VEVENT").slice(1);

  it("gültiger Rahmen: VCALENDAR 2.0, PRODID, ein VEVENT je Termin, jede Zeile mit CRLF, keine nackten LF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(termine.length).toBeGreaterThan(10);
    expect(ereignisse).toHaveLength(termine.length);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe((ics.match(/END:VEVENT/g) ?? []).length);
    expect((ics.match(/BEGIN:VALARM/g) ?? []).length).toBe((ics.match(/END:VALARM/g) ?? []).length);
  });
  it("gefaltet: keine Zeile über 75 Byte, nie mitten in einem Umlaut; entfaltet wieder der volle Text", () => {
    for (const zeile of ics.split("\r\n")) expect(Buffer.byteLength(zeile, "utf8")).toBeLessThanOrEqual(75);
    const lang = `DESCRIPTION:${"Übermitteln äöü ß – ".repeat(12)}`;
    const gefaltet = icsFalten(lang);
    for (const z of gefaltet.split("\r\n")) {
      expect(Buffer.byteLength(z, "utf8")).toBeLessThanOrEqual(75);
      expect(Buffer.from(z, "utf8").toString("utf8")).toBe(z);
    }
    expect(gefaltet.split("\r\n").slice(1).every((z) => z.startsWith(" "))).toBe(true);
    expect(gefaltet.replace(/\r\n /g, "")).toBe(lang);
    expect(icsFalten("kurz")).toBe("kurz");
  });
  it("Text maskiert (Komma, Semikolon, Backslash, Zeilenumbruch)", () => {
    expect(icsText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
  it("ganztägig am Datum der App (ohne Umweg über UTC), DTEND am Folgetag – auch über den Jahreswechsel", () => {
    for (const t of termine) {
      const ev = ereignisse.find((x) => x.includes(`UID:${t.uid}\r\n`))!;
      expect(ev).toContain(`DTSTART;VALUE=DATE:${t.datum.replace(/-/g, "")}\r\n`);
    }
    const silvester = fristenIcs([{ uid: kalenderUid("steuern.test", "2026-12-31"), pflichtId: "steuern.test", titel: "Test", datum: "2026-12-31", vielleicht: false, uebermitteln: false }], heute, jetzt);
    expect(silvester).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n");
    // Zeitumstellung (28.03.2027): Erinnerung bleibt 9 Uhr – relative Dauer vor Tagesbeginn, keine feste UTC-Zeit
    expect(vorherTrigger(3, 9)).toBe("-P2DT15H");
    expect(vorherTrigger(1, 9)).toBe("-PT15H");
    expect(vorherTrigger(0, 9)).toBe("PT9H");
  });
  it("DTSTAMP in UTC: 29.10.2026 9:15 Uhr in Berlin (MEZ) → 08:15Z", () => {
    expect(utcIcs(jetzt)).toBe("20261029T081500Z");
    expect(ics).toContain("DTSTAMP:20261029T081500Z\r\n");
    expect(utcIcs(new Date("2026-07-01T09:15:00+02:00"))).toBe("20260701T071500Z");
  });
  it("Erinnerungen (VALARM): drei Tage vorher um 9 Uhr und am Tag um 9 Uhr; „falls es für dich gilt“ nur vorher", () => {
    for (const ev of ereignisse) {
      expect(ev).toContain("BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-P2DT15H\r\n");
      const n = (ev.match(/BEGIN:VALARM/g) ?? []).length;
      if (ev.includes("(falls es für dich gilt)")) expect(n).toBe(1);
      else {
        expect(n).toBe(2);
        expect(ev).toContain("TRIGGER:PT9H\r\n");
      }
    }
  });
  it("feste UIDs: zweiter Export (später, nach einer Änderung) hat dieselben UIDs – Kalender aktualisieren statt doppeln", () => {
    const uids = termine.map((t) => t.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(uids.every((u) => /^[A-Za-z0-9._-]+-\d{8}@[a-z0-9.-]+$/.test(u))).toBe(true);
    const spaeter = fristenIcs(kalenderTermine(a, e, heute), heute, new Date("2026-11-05T10:00:00Z"));
    const uidsSpaeter = [...spaeter.replace(/\r\n /g, "").matchAll(/^UID:(.+)$/gm)].map((m) => m[1]!.trim());
    expect(uidsSpaeter).toEqual(uids);
    expect(kalenderUid("steuern.ust_voranmeldung", "2026-11-10")).toBe(kalenderUid("steuern.ust_voranmeldung", "2026-11-10"));
    expect(kalenderDateiname(heute)).toMatch(/\.ics$/);
  });
  it("dieselben Termine wie die Erinnerungen: nichts Vergangenes, abgehakter Termin fehlt, Lohnbüro nicht, höchstens zwölf Monate", () => {
    const erinnert = new Set(erinnerungen(a, e, heute).filter((x) => x.art !== "ueberfaellig").map((x) => `${x.pflichtId}|${x.termin}`));
    expect(new Set(termine.map((t) => `${t.pflichtId}|${t.datum}`))).toEqual(erinnert);
    expect(termine.every((t) => t.datum >= heute && t.datum <= "2027-10-29")).toBe(true);
    const va = a.gilt.find((x) => x.id === "steuern.ust_voranmeldung")!;
    const erledigt = erledigtSetzen(LEERER_STAND, va.id, heute, va.naechsterTermin).erledigt;
    const ohne = kalenderTermine(a, { ...e, erledigt }, heute);
    expect(ohne.some((t) => t.pflichtId === va.id && t.datum === va.naechsterTermin)).toBe(false);
    expect(ohne.some((t) => t.pflichtId === va.id && t.datum > va.naechsterTermin!)).toBe(true);
    const salon = stand({ ...PROFILE["Salon mit 3 Beschäftigten"]!, "personal.lohn_durch": "lohnbuero" }, heute);
    expect(kalenderTermine(salon.a, salon.e, heute).some((t) => t.pflichtId === "personal.beitragsnachweis")).toBe(false);
  });
  it("gehört wie die Erinnerungen zu Pro; ohne Kalenderzugriff (Teilen-Menü, keine neue Berechtigung)", () => {
    const seite = lies("src/seiten/Pflichten.tsx");
    expect(seite).toMatch(/function KalenderExport\(\)[\s\S]{0,1200}sperre\("erinnerungen"\)/);
    expect(seite).toMatch(/dateiTeilenBytes\(kalenderDateiname\(tag\), new TextEncoder\(\)\.encode\(ics\), "text\/calendar"\)/);
    expect(lies("package.json")).not.toMatch(/expo-calendar/);
    expect(lies("app.json")).not.toMatch(/CALENDAR|NSCalendars/);
    expect(TEXT.e238_kalender_hilfe).toMatch(/übernimm sie erneut/);
    expect(TEXT.e238_kalender_hilfe).toMatch(/drei Tage vorher und am Tag selbst um 9 Uhr/);
  });
});

describe("(d) Hilfetexte", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("iPhone: keine Zusage „alle Fristen der zwölf Monate“; Android: alle Fristen der zwölf Monate, auch nach einem Neustart", async () => {
    expect(TEXT.erinnern_hilfe).not.toMatch(/alle Fristen der nächsten zwölf Monate/);
    expect(TEXT.erinnern_hilfe).toMatch(/bevor der Plan endet, meldet sich dein iPhone/);
    expect(TEXT.erinnern_geplant_bis("01.06.2027")).toMatch(/Kalender/);
    vi.stubEnv("EXPO_OS", "android");
    vi.resetModules();
    const { T } = await import("../src/texte");
    expect(T.erinnern_hilfe).toMatch(/alle Fristen der nächsten zwölf Monate, auch über einen Neustart des Smartphones hinweg/);
    expect(T.erinnern_hilfe).toMatch(/bevor der Plan endet, meldet sich dein Smartphone/);
  });
});
