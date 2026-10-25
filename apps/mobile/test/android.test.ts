/**
 * Android-Fassung (E-190): Texte je Plattform (iPhone unverändert, Android ohne Apple-Wörter), Symbole mit Ersatz,
 * Kauf über Google Play, automatische Sicherung in einen Ordner (Ablauf mit einer Ablage im Speicher), Datenschutz-Entwurf,
 * Android-Einstellungen in app.json und eas.json.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MARKE } from "@amtlos/marke";
import { T as TEXT_IOS } from "../src/texte";
import { ANDROID_WOERTER, IOS_WOERTER } from "../src/plattform";
import { schluesselFuer, testAusAngebot } from "../src/pro/storeRegeln";
import * as logik from "../src/unterlagen/cloudLogik";
import type { Ablage } from "../src/unterlagen/cloudLogik";
import { schluesselAusPasswort, schluesselKennung, sicherungMitSchluessel } from "../src/unterlagen/sicherung";
import { LEERER_STAND, betriebSetzen } from "../src/unterlagen/speicher";
import { DATENSCHUTZ, DATENSCHUTZ_ANDROID, NUTZUNGSBEDINGUNGEN, datenschutzAbschnitte, datenschutzFreigegeben, nutzungsLink } from "../src/rechtliches";

const hier = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(hier, "..");
const lies = (p: string) => readFileSync(path.join(APP, p), "utf8");
const IOS_WOERTER_RE = /iPhone|iCloud|Face ID|Touch ID|App Store|Apple|AirDrop|Schlüsselbund/;

/** Alle Zeichenketten eines Textobjekts – Funktionen mit einigen Beispielwerten aufgerufen. */
function alleTexte(v: unknown, tiefe = 0): string[] {
  if (typeof v === "string") return [v];
  if (typeof v === "function") {
    const aus: string[] = [];
    for (const a of [[], [1], [2], [3, 4], ["X"], ["X", "Y"], [true], [false], [null], [1, "X"]] as unknown[][]) {
      try {
        const r = (v as (...x: unknown[]) => unknown)(...a);
        aus.push(...alleTexte(r, tiefe + 1));
      } catch {
        /* Beispielwert passt nicht */
      }
    }
    return aus;
  }
  if (Array.isArray(v)) return v.flatMap((x) => alleTexte(x, tiefe + 1));
  if (v && typeof v === "object" && tiefe < 6) return Object.values(v).flatMap((x) => alleTexte(x, tiefe + 1));
  return [];
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Texte je Plattform (E-190)", () => {
  it("iPhone: die freigegebenen Wörter bleiben, wie sie waren", () => {
    expect(IOS_WOERTER.geraet).toBe("iPhone");
    expect(TEXT_IOS.pro_abo_text).toBe("Das Abo wird über deinen Apple-Account abgerechnet und verlängert sich automatisch, wenn du es nicht mindestens 24 Stunden vor Ende des Zeitraums kündigst. Kündigen und verwalten kannst du es in den Einstellungen deines Apple-Accounts.");
    expect(TEXT_IOS.app_sperre_hilfe).toBe(`${MARKE.name} öffnet sich nur nach Face ID, Touch ID oder Gerätecode.`);
    expect(TEXT_IOS.icloud_auto).toBe("Automatisch in iCloud sichern");
    expect(TEXT_IOS.gespeichert_auto).toBe("Wird automatisch auf diesem iPhone gespeichert.");
    expect(TEXT_IOS.sicherung_text).toContain("in „Dateien“ oder in iCloud Drive ablegen oder per AirDrop senden");
  });

  it("Android: kein Text nennt iPhone, iCloud, Face ID, App Store, Apple oder AirDrop", async () => {
    vi.stubEnv("EXPO_OS", "android");
    vi.resetModules();
    const { T } = await import("../src/texte");
    const treffer = alleTexte(T).filter((t) => IOS_WOERTER_RE.test(t));
    expect(treffer).toEqual([]);
    expect(T.gespeichert_auto).toBe("Wird automatisch auf diesem Smartphone gespeichert.");
    expect(T.icloud_auto).toBe("Automatisch in einen Ordner sichern");
    // Google Play: abgerechnet über das Google-Konto, kündigen in Google Play – ohne Apples 24-Stunden-Satz
    expect(T.pro_abo_text).toMatch(/Google-Konto bei Google Play/);
    expect(T.pro_abo_text).toMatch(/Zahlungen und Abos/);
    expect(T.pro_abo_text).not.toMatch(/24 Stunden/);
    expect(T.app_sperre_hilfe).toContain(ANDROID_WOERTER.sperreVoll);
    expect(T.erinnern_verweigert).toMatch(/Apps › .* › Benachrichtigungen/);
    expect(T.code_nicht_verfuegbar).toMatch(/Google Play/);
    expect(T.pro_kachel.icloud).toBe("Automatische Sicherung");
  });

  it("Web-Vorschau zeigt die iPhone-Fassung, außer für die Play-Bilder (EXPO_PUBLIC_VORSCHAU_PLATTFORM=android)", async () => {
    vi.stubEnv("EXPO_OS", "web");
    vi.resetModules();
    expect((await import("../src/plattform")).ANDROID).toBe(false);
    vi.stubEnv("EXPO_PUBLIC_VORSCHAU_PLATTFORM", "android");
    vi.resetModules();
    expect((await import("../src/plattform")).ANDROID).toBe(true);
  });
});

describe("Symbole auf Android (E-190)", () => {
  // Ersatz-Symbole stehen in bausteine.tsx (react-native lässt sich in Node nicht laden – deshalb aus dem Quelltext)
  const quelle = lies("src/ui/bausteine.tsx");
  const block = /export const FALLBACK[^=]*= \{([\s\S]*?)\n\};/.exec(quelle)![1]!;
  const ersatz = new Map([...block.matchAll(/"([^"]+)": "([^"]+)"/g)].map((m) => [m[1]!, m[2]!] as const));
  const sfDatei = (() => {
    // Liste aller SF-Symbol-Namen aus dem Typpaket von expo-symbols
    const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
    const ordner = readdirSync(pnpm).find((d) => d.startsWith("sf-symbols-typescript@"))!;
    return readFileSync(path.join(pnpm, ordner, "node_modules/sf-symbols-typescript/dist/index.d.ts"), "utf8");
  })();
  const sf = new Set([...sfDatei.matchAll(/["']([a-z0-9.]+)["']/g)].map((m) => m[1]!));

  it("jedes SF Symbol, das die App nutzt, hat ein Ionicons-Zeichen (sonst zeigt Android einen leeren Kreis)", () => {
    const dateien: string[] = [];
    const sammeln = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n);
        if (statSync(p).isDirectory()) sammeln(p);
        else if (/\.tsx?$/.test(n)) dateien.push(p);
      }
    };
    sammeln(path.join(APP, "src"));
    const fehlt = new Set<string>();
    for (const p of dateien) {
      const t = readFileSync(p, "utf8");
      // Symbolnamen stehen als symbol="…", name="…", symbol: "…" oder in Tabellen wie VORTEIL_SYMBOL
      for (const m of t.matchAll(/(?:symbol|symbolAn|name|Symbol)\s*[=:]\s*\{?\s*"([a-z][a-z0-9.]*)"/g)) if (sf.has(m[1]!) && !ersatz.has(m[1]!)) fehlt.add(m[1]!);
      for (const m of t.matchAll(/_SYMBOL[^=]*=\s*\{([^}]*)\}/g)) for (const x of m[1]!.matchAll(/"([a-z][a-z0-9.]*)"/g)) if (sf.has(x[1]!) && !ersatz.has(x[1]!)) fehlt.add(x[1]!);
    }
    expect([...fehlt]).toEqual([]);
  });

  it("jedes Ersatz-Zeichen gibt es in Ionicons", () => {
    const pnpm = path.resolve(APP, "../../node_modules/.pnpm");
    const ordner = readdirSync(pnpm).find((d) => d.startsWith("@expo+vector-icons@"))!;
    const glyphen = JSON.parse(readFileSync(path.join(pnpm, ordner, "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json"), "utf8")) as Record<string, number>;
    expect([...ersatz.values()].filter((n) => !(n in glyphen))).toEqual([]);
  });
});

describe("Kauf über Google Play (E-190)", () => {
  it("je Plattform der eigene RevenueCat-Schlüssel, im Web keiner", () => {
    const env = { ios: "appl_x", android: "goog_y" };
    expect(schluesselFuer("ios", env)).toBe("appl_x");
    expect(schluesselFuer("android", env)).toBe("goog_y");
    expect(schluesselFuer("web", env)).toBe("");
    expect(schluesselFuer("android", { ios: "appl_x" })).toBe("");
  });
  it("kostenlose Phase aus dem Standardangebot von Google Play", () => {
    expect(testAusAngebot({ defaultOption: { freePhase: { billingPeriod: { iso8601: "P14D" } } } })).toBe("P14D");
    expect(testAusAngebot({ defaultOption: { freePhase: null }, introPrice: null })).toBeNull();
    expect(testAusAngebot({ defaultOption: null, introPrice: { price: 0, period: "P2W" } })).toBe("P2W");
    expect(testAusAngebot({ defaultOption: null, introPrice: { price: 1.99, period: "P1M" } })).toBeNull();
  });
  it("kauf.ts liest den Android-Schlüssel und zeigt auf Android kein Einlöseblatt", () => {
    const k = lies("src/pro/kauf.ts");
    expect(k).toContain("EXPO_PUBLIC_REVENUECAT_ANDROID_KEY");
    expect(k).toMatch(/codeEinloesenMoeglich = kaufAktiv && Platform\.OS === "ios"/);
    expect(lies("src/seiten/Pro.tsx")).toMatch(/!partner && !ANDROID \? <CodeEinloesenKnopf/);
  });
});

/** Ablage im Speicher – wie iCloud Drive bzw. ein SAF-Ordner, nur ohne Gerät. */
function speicherAblage(): Ablage & { dateien: Map<string, string>; ordner: Set<string> } {
  const dateien = new Map<string, string>();
  const ordner = new Set<string>([""]);
  const eltern = (p: string) => p.slice(0, p.lastIndexOf("/"));
  return {
    dateien,
    ordner,
    exists: async (p) => dateien.has(p) || ordner.has(p),
    mkdir: async (p) => void ordner.add(p),
    readdir: async (p) => [...new Set([...dateien.keys(), ...ordner].filter((x) => x !== p && eltern(x) === p).map((x) => x.slice(p.length + 1)))],
    readFile: async (p) => {
      const t = dateien.get(p);
      if (t === undefined) throw new Error("fehlt");
      return t;
    },
    writeFile: async (p, t) => {
      if (!ordner.has(eltern(p))) throw new Error(`Ordner fehlt: ${eltern(p)}`);
      dateien.set(p, t);
    },
    unlink: async (p) => void dateien.delete(p),
    rmdir: async (p) => {
      ordner.delete(p);
      for (const k of [...dateien.keys()]) if (k.startsWith(`${p}/`)) dateien.delete(k);
    },
  };
}

describe("Automatische Sicherung in einen Ordner (E-190, gleicher Ablauf wie iCloud)", () => {
  const zufall = (n: number) => new Uint8Array(randomBytes(n));
  const k = schluesselAusPasswort("ein-langes-passwort-fuer-tests", zufall, 1000);
  const stand = (name: string) => sicherungMitSchluessel(betriebSetzen(LEERER_STAND, { ...LEERER_STAND.betrieb, name }), k, zufall, new Date("2026-10-25T10:00:00Z"));

  it("schreibt aktuell, Tag und Woche direkt in den gewählten Ordner; der Tag behält den Stand vom Tagesbeginn", async () => {
    const a = speicherAblage();
    const ort = { ablage: a, ordner: "", ersatzAusWoche: true };
    const montag = new Date("2026-10-26T08:00:00+01:00");
    await logik.schreiben(ort, stand("A"), montag);
    await logik.schreiben(ort, stand("B"), new Date("2026-10-26T15:00:00+01:00"));
    const namen = [...a.dateien.keys()].sort();
    expect(namen).toEqual([`/${MARKE.name}-Sicherung-2026-KW44.amtlos`, `/${MARKE.name}-Sicherung-Tag-2026-10-26.amtlos`, `/${MARKE.name}-Sicherung-aktuell.amtlos`].sort());
    expect(await logik.lesen(ort)).toBe(a.dateien.get(`/${MARKE.name}-Sicherung-aktuell.amtlos`));
    // Tages-Sicherung: der erste Stand des Tages, nicht der spätere
    expect(a.dateien.get(`/${MARKE.name}-Sicherung-Tag-2026-10-26.amtlos`)).not.toBe(a.dateien.get(`/${MARKE.name}-Sicherung-aktuell.amtlos`));
  });

  it("fehlt „aktuell“ (abgebrochenes Ersetzen auf Android), gilt die neueste Wochen-Sicherung", async () => {
    const a = speicherAblage();
    const ort = { ablage: a, ordner: "", ersatzAusWoche: true };
    a.dateien.set(`/${MARKE.name}-Sicherung-2026-KW43.amtlos`, "alt");
    a.dateien.set(`/${MARKE.name}-Sicherung-2026-KW44.amtlos`, "neu");
    expect(await logik.lesen(ort)).toBe("neu");
    // iCloud (ohne Ersatz) bleibt wie bisher: keine aktuelle Sicherung → keine
    expect(await logik.lesen({ ablage: a, ordner: "" })).toBeNull();
  });

  it("Belegdateien einzeln je Schlüssel; Aufräumen löscht Belegordner ohne passende Sicherung", async () => {
    const a = speicherAblage();
    const ort = { ablage: a, ordner: "" };
    const kennung = schluesselKennung(k.salz);
    await logik.dateiSchreiben(ort, kennung, "foto1.jpg", "x");
    expect(await logik.dateien(ort, kennung)).toEqual(new Set(["foto1.jpg"]));
    expect(await logik.dateiLesen(ort, kennung, "foto1.jpg")).toBe("x");
    await logik.dateiSchreiben(ort, "0000", "alt.jpg", "y");
    await logik.schreiben(ort, stand("A"), new Date("2026-10-26T08:00:00+01:00"));
    expect(a.ordner.has(`/Belege-${kennung}`)).toBe(true);
    expect(a.ordner.has("/Belege-0000")).toBe(false);
  });

  it("iCloud: derselbe Ablauf im Ordner „/Amtlos“ (legt ihn an)", async () => {
    const a = speicherAblage();
    await logik.schreiben({ ablage: a, ordner: "/Amtlos" }, stand("A"), new Date("2026-10-26T08:00:00+01:00"));
    expect(a.ordner.has("/Amtlos")).toBe(true);
    expect(a.dateien.has(`/Amtlos/${MARKE.name}-Sicherung-aktuell.amtlos`)).toBe(true);
  });

  it("lesbarer Name des gewählten Ordners", () => {
    expect(logik.ordnerAnzeigeName("content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FBetriebsklar-Sicherung")).toBe("Betriebsklar-Sicherung");
    expect(logik.ordnerAnzeigeName("content://com.google.android.apps.docs.storage/tree/acc%3D1%3Bdoc%3Dencoded%3Dabc")).toBe("Google Drive");
    expect(logik.ordnerAnzeigeName("content://de.beispiel.documents/tree/123")).toBe("Gewählter Ordner");
  });

  it("Android nutzt das Speicherzugriffs-Framework mit dauerhafter Berechtigung und ersetzt Dateien statt sie zu überschreiben", () => {
    const c = lies("src/unterlagen/cloud.android.ts");
    expect(c).toContain("Directory.pickDirectoryAsync()");
    expect(c).toMatch(/if \(alt\) alt\.delete\(\);\s*const neu = d\.createFile\(name, MIME\);/);
    expect(c).toContain("ersatzAusWoche: true");
    // gleiche Funktionen wie iCloud (Sicherung.tsx ruft dieselben auf)
    for (const f of ["cloudVerfuegbar", "cloudSchreiben", "cloudLesen", "cloudDateien", "cloudDateiSchreiben", "cloudDateiLesen", "cloudBeiseitelegen", "ordnerStatus", "ordnerWaehlen", "ordnerVergessen"]) {
      expect(c).toMatch(new RegExp(`export async function ${f}\\(`));
      expect(lies("src/unterlagen/cloud.ts")).toMatch(new RegExp(`export async function ${f}\\(`));
      expect(lies("src/unterlagen/cloud.web.ts")).toMatch(new RegExp(`export async function ${f}\\(`));
    }
  });
});

describe("Rechtstexte auf Android (E-190)", () => {
  it("der freigegebene iPhone-Datenschutzhinweis ist unverändert und gilt weiter als freigegeben", () => {
    expect(DATENSCHUTZ.freigegeben).toBe(true);
    expect(datenschutzAbschnitte(false, false)).toBe(DATENSCHUTZ.abschnitte);
    expect(DATENSCHUTZ.abschnitte[0]!.text).toContain("nur auf deinem iPhone");
    expect(datenschutzFreigegeben(false)).toBe(true);
  });
  it("Android zeigt einen eigenen Entwurf – nicht freigegeben, ohne Apple, mit Google Play und Ordner-Sicherung", () => {
    expect(DATENSCHUTZ_ANDROID.freigegeben).toBe(false);
    expect(datenschutzFreigegeben(true)).toBe(false);
    const t = datenschutzAbschnitte(false, true).map((a) => `${a.titel} ${a.text}`).join("\n");
    expect(t).not.toMatch(IOS_WOERTER_RE);
    expect(t).toMatch(/Google Play/);
    expect(t).toMatch(/Ordnerauswahl von Android/);
    expect(t).toMatch(/Gerätesicherung von Android nimmt diese Daten nicht mit/);
    // gleicher Aufbau wie der freigegebene Text
    expect(DATENSCHUTZ_ANDROID.abschnitte.length).toBe(DATENSCHUTZ.abschnitte.length);
    expect(datenschutzAbschnitte(true, true).map((a) => a.text).join("\n")).not.toMatch(IOS_WOERTER_RE);
  });
  it("Nutzungsbedingungen: auf Android kein Link auf Apples EULA, solange die eigenen nicht freigegeben sind", () => {
    expect(nutzungsLink({ ...NUTZUNGSBEDINGUNGEN, freigegeben: false }, true)).toBe("");
    expect(nutzungsLink({ ...NUTZUNGSBEDINGUNGEN, freigegeben: false }, false)).toMatch(/apple\.com/);
    expect(nutzungsLink({ ...NUTZUNGSBEDINGUNGEN, freigegeben: true }, true)).toBe(NUTZUNGSBEDINGUNGEN.url);
  });
});

describe("Android-Einstellungen (app.json, eas.json)", () => {
  const app = JSON.parse(lies("app.json")).expo;
  const eas = JSON.parse(lies("eas.json"));
  it("Paket, Versionscode, adaptives Symbol mit Monochrom-Fassung, keine Gerätesicherung durch Android", () => {
    expect(app.android.package).toBe("de.amtlos.app");
    expect(Number.isInteger(app.android.versionCode)).toBe(true);
    for (const p of [app.android.adaptiveIcon.foregroundImage, app.android.adaptiveIcon.monochromeImage]) expect(existsSync(path.join(APP, p))).toBe(true);
    // Schlüssel im Android-Schlüsselspeicher wandert nicht mit – eine zurückgespielte App-Sicherung wäre unlesbar
    expect(app.android.allowBackup).toBe(false);
  });
  it("nur nötige Berechtigungen; Medien-, Speicher-, Mikrofon- und Wecker-Rechte gesperrt", () => {
    expect([...app.android.permissions].sort()).toEqual(["android.permission.CAMERA", "android.permission.INTERNET", "android.permission.POST_NOTIFICATIONS", "android.permission.RECEIVE_BOOT_COMPLETED", "android.permission.USE_BIOMETRIC", "android.permission.USE_FINGERPRINT", "android.permission.VIBRATE"]);
    for (const p of ["READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "RECORD_AUDIO", "SYSTEM_ALERT_WINDOW", "SCHEDULE_EXACT_ALARM", "USE_EXACT_ALARM"]) expect(app.android.blockedPermissions).toContain(`android.permission.${p}`);
  });
  it("EAS: APK für interne Tests, AAB für Google Play, Einreichen in den internen Test", () => {
    expect(eas.build.preview.android.buildType).toBe("apk");
    expect(eas.build.production.android.buildType).toBe("app-bundle");
    expect(eas.build.production.env?.EXPO_PUBLIC_PRO_TESTMODUS).toBeUndefined();
    expect(eas.submit.production.android.track).toBe("internal");
    expect(eas.submit.production.android.serviceAccountKeyPath).toMatch(/^\.\/geheim\//);
    expect(lies(".gitignore")).toMatch(/^geheim\/$/m);
  });
});
