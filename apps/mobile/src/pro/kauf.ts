/**
 * Kauf von Amtlos Pro über den App Store bzw. Google Play (E-132, E-190), angebunden über RevenueCat (Abos, Belege,
 * Kennzahlen wie MRR und Kündigungen ohne eigenen Server). Je Plattform ein eigener öffentlicher Schlüssel:
 * `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (beginnt mit „appl_“) bzw. `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (beginnt mit „goog_“,
 * Google Play Billing). Ohne Schlüssel (z. B. im Testpaket und in Expo Go) lädt die App das Paket gar nicht und läuft
 * im Testmodus: Pro lässt sich dort testweise einschalten. Käufe gelten je Plattform (Apple-Account bzw. Google-Konto);
 * plattformübergreifend nur mit Konto und Synchronisation (`proKontoVerbinden`).
 * Preise kommen immer aus dem Store – die App nennt keine eigenen Beträge.
 */
import { Platform } from "react-native";
import { codeEinloesenMit, type CodeErgebnis } from "./code";
import { schluesselFuer, testAusAngebot } from "./storeRegeln";

export const PRO_BERECHTIGUNG = "pro";
const SCHLUESSEL = schluesselFuer(Platform.OS, { ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY });

/** Echte Käufe möglich (eigener Build mit Schlüssel der Plattform)? */
export const kaufAktiv = (Platform.OS === "ios" || Platform.OS === "android") && SCHLUESSEL.length > 0;
/**
 * Testmodus (Pro testweise einschaltbar) nur in Entwicklung, Testpaket und ausdrücklich freigegebenen Builds
 * (`EXPO_PUBLIC_PRO_TESTMODUS=1`, z. B. TestFlight-Beta). Ein Store-Build ohne Schlüssel bekommt Pro nie geschenkt –
 * dort sind Käufe dann „noch nicht verfügbar“.
 */
export const testmodus = !kaufAktiv && (__DEV__ || process.env.EXPO_PUBLIC_PRO_TESTMODUS === "1");
/**
 * Bezahlschirm mit Knopf überhaupt anbieten? Nur mit echtem Kauf oder im Testmodus. Ein Store-Build ohne Schlüssel
 * zeigt weder „Pro testweise einschalten“ noch einen toten Kaufknopf (App-Review B2) – `store-check.mjs` meldet den
 * fehlenden Schlüssel vorher.
 */
export const paywallVerfuegbar = kaufAktiv || testmodus;

export interface Angebot {
  id: string;
  titel: string;
  /** Preis wie vom Store geliefert, z. B. „9,99 €“ */
  preis: string;
  /** „monatlich“, „jährlich“ … */
  zeitraum: string;
  /** „pro Monat“, „pro Jahr“ … – für „danach 49,99 € pro Jahr“ */
  je: string;
  /**
   * kostenloser Testzeitraum, z. B. „14 Tage“ – null, wenn keiner oder wenn das Apple-Konto ihn nicht (mehr) bekommt
   * bzw. die Berechtigung unbekannt ist (App-Review R2)
   */
  test: string | null;
  /** R12: Preis als Zahl aus dem Store (für „spart N %“ beim Jahresabo) – nie ein Betrag aus dem Code */
  betrag?: number;
}

type RC = typeof import("react-native-purchases").default;
let rc: RC | null = null;
let bereit: Promise<RC | null> | null = null;

/** RevenueCat erst bei Bedarf laden und einrichten – in Expo Go/Testpaket nie. */
function laden(): Promise<RC | null> {
  if (!kaufAktiv) return Promise.resolve(null);
  bereit ??= (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("react-native-purchases") as { default: RC };
      mod.default.configure({ apiKey: SCHLUESSEL });
      rc = mod.default;
      return rc;
    } catch {
      return null;
    }
  })();
  return bereit;
}

const ZEITRAUM: Record<string, string> = { P1W: "wöchentlich", P1M: "monatlich", P3M: "vierteljährlich", P6M: "halbjährlich", P1Y: "jährlich" };
const JE: Record<string, string> = { P1W: "pro Woche", P1M: "pro Monat", P3M: "pro Quartal", P6M: "pro Halbjahr", P1Y: "pro Jahr" };
function testText(periode: string | undefined | null): string | null {
  const m = periode ? /^P(\d+)([DWMY])$/.exec(periode) : null;
  if (!m) return null;
  const n = Number(m[1]);
  const e = { D: ["Tag", "Tage"], W: ["Woche", "Wochen"], M: ["Monat", "Monate"], Y: ["Jahr", "Jahre"] }[m[2] as "D" | "W" | "M" | "Y"];
  return `${n} ${n === 1 ? e[0] : e[1]}`;
}

/** Hat das Apple- bzw. Google-Konto ein aktives Pro-Abo? */
export async function proAktiv(): Promise<boolean> {
  const p = await laden();
  if (!p) return false;
  try {
    const info = await p.getCustomerInfo();
    return Boolean(info.entitlements.active[PRO_BERECHTIGUNG]);
  } catch {
    return false;
  }
}

/**
 * E-200: Stand des Pro-Abos laut Store – aktiv, ob es sich verlängert (RevenueCat `willRenew`; false nach einer Kündigung)
 * und wann es endet bzw. endete (`expirationDate`). null ohne Kauf-Anbindung, ohne Abo oder bei einem Fehler.
 */
export interface AboStand {
  aktiv: boolean;
  verlaengert: boolean;
  endetAm: string | null;
}
export async function aboStand(): Promise<AboStand | null> {
  const p = await laden();
  if (!p) return null;
  try {
    const e = (await p.getCustomerInfo()).entitlements.all[PRO_BERECHTIGUNG];
    return e ? { aktiv: e.isActive, verlaengert: e.willRenew, endetAm: e.expirationDate ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * Darf das Apple-Konto den kostenlosen Testzeitraum nutzen (App-Review R2)? Nur „berechtigt“ zählt; unbekannt, nicht
 * berechtigt oder ein Fehler der Abfrage heißt: kein Testzeitraum anzeigen – lieber ehrlich den Preis als ein Trial,
 * das Apple dann nicht gewährt.
 */
async function testBerechtigt(p: RC, ids: string[]): Promise<Set<string>> {
  const frei = new Set<string>();
  const berechtigt = p.INTRO_ELIGIBILITY_STATUS?.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
  if (!ids.length || berechtigt === undefined) return frei;
  // nach getOfferings() aufrufen: erst dann kennt das SDK auf iOS die Abo-Gruppe. Auf Android meldet RevenueCat die
  // Berechtigung nicht (immer „unbekannt“) – dort zeigt die App den Testzeitraum nur, wenn Google ihn im Angebot liefert
  // (Google Play bietet die kostenlose Phase ohnehin nur berechtigten Konten an, `testAusAngebot`).
  try {
    const r = await p.checkTrialOrIntroductoryPriceEligibility(ids);
    for (const id of ids) if (r[id]?.status === berechtigt) frei.add(id);
  } catch {
    // unbekannt → ohne Testzeitraum
  }
  return frei;
}

/** Angebote aus dem Store (aktuelles „Offering“), Jahresabo zuerst. */
export async function angebote(): Promise<Angebot[]> {
  const p = await laden();
  if (!p) return [];
  const o = await p.getOfferings();
  const pakete = o.current?.availablePackages ?? [];
  // iOS: Testzeitraum nur mit gemeldeter Berechtigung (App-Review R2); Android: aus dem Angebot von Google Play
  const mitTest = Platform.OS === "ios" ? pakete.filter((pk) => pk.product.introPrice?.price === 0).map((pk) => pk.product.identifier) : [];
  const frei = await testBerechtigt(p, mitTest);
  return pakete
    .map((pk) => ({
      id: pk.identifier,
      titel: pk.product.title,
      preis: pk.product.priceString,
      zeitraum: ZEITRAUM[pk.product.subscriptionPeriod ?? ""] ?? "",
      je: JE[pk.product.subscriptionPeriod ?? ""] ?? "",
      test: Platform.OS === "android" ? testText(testAusAngebot(pk.product)) : pk.product.introPrice && pk.product.introPrice.price === 0 && frei.has(pk.product.identifier) ? testText(pk.product.introPrice.period) : null,
      betrag: typeof pk.product.price === "number" ? pk.product.price : undefined,
    }))
    .sort((a, b) => (a.zeitraum === "jährlich" ? -1 : b.zeitraum === "jährlich" ? 1 : 0));
}

/** Kaufen; true bei aktivem Pro danach, false bei Abbruch. Fehler werden geworfen (Anzeige im Bezahlschirm). */
export async function kaufen(id: string): Promise<boolean> {
  const p = await laden();
  if (!p) return false;
  const o = await p.getOfferings();
  const pk = o.current?.availablePackages.find((x) => x.identifier === id);
  if (!pk) throw new Error("Angebot nicht gefunden");
  try {
    const r = await p.purchasePackage(pk);
    return Boolean(r.customerInfo.entitlements.active[PRO_BERECHTIGUNG]);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return false;
    throw e;
  }
}

/** Käufe wiederherstellen (Pflicht im App Store, auch bei Google Play angeboten) – z. B. nach Gerätewechsel. */
export async function wiederherstellen(): Promise<boolean> {
  const p = await laden();
  if (!p) return false;
  const info = await p.restorePurchases();
  return Boolean(info.entitlements.active[PRO_BERECHTIGUNG]);
}

/**
 * Mit Konto (E-134): Käufe der Konto-ID zuordnen, damit der Server Pro für die Synchronisation prüfen kann und Pro auf
 * allen Geräten des Kontos gilt. Liefert, ob Pro danach aktiv ist.
 */
export async function proKontoVerbinden(kontoId: string): Promise<boolean> {
  const p = await laden();
  if (!p) return false;
  try {
    const r = await p.logIn(kontoId);
    return Boolean(r.customerInfo.entitlements.active[PRO_BERECHTIGUNG]);
  } catch {
    return false;
  }
}

/** Beim Abmelden die Zuordnung lösen (RevenueCat legt wieder eine anonyme Kennung an). */
export async function proKontoTrennen(): Promise<void> {
  const p = await laden();
  if (!p) return;
  await p.logOut().catch(() => undefined);
}

/**
 * „Code einlösen“ möglich (Phase 2.3)? Nur mit echtem Kauf auf iOS – Apples Einlöseblatt für Abo-Angebotscodes gibt es
 * erst ab iOS 14 und nur mit StoreKit. Im Web, in Expo Go und im Testmodus zeigt der Bezahlschirm stattdessen einen
 * Hinweis (Code im App Store einlösen). Android (E-190): Google Play hat kein Einlöseblatt in der App – Codes löst man im
 * Play Store ein; der Bezahlschirm zeigt dort keinen Knopf, die Partner-Seite nur den Hinweis.
 */
export const codeEinloesenMoeglich = kaufAktiv && Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 14;

/**
 * Apples Einlöseblatt für Abo-Angebotscodes (z. B. den Code eines Partners) zeigen, danach die Berechtigung neu
 * abfragen. „nicht_verfuegbar“ ohne Kauf (Web, Expo Go, Testmodus). Pro gilt nur, wenn RevenueCat die Berechtigung
 * meldet – die App schaltet nie selbst frei (App Review 3.1.1).
 */
export async function codeEinloesen(): Promise<CodeErgebnis | "nicht_verfuegbar"> {
  if (!codeEinloesenMoeglich) return "nicht_verfuegbar";
  const p = await laden();
  if (!p) return "nicht_verfuegbar";
  return codeEinloesenMit({ blattZeigen: () => p.presentCodeRedemptionSheet(), cacheVerwerfen: () => p.invalidateCustomerInfoCache(), kundendaten: () => p.getCustomerInfo() }, PRO_BERECHTIGUNG);
}

/**
 * Änderungen der Berechtigung beobachten (eingelöster Code, Verlängerung, Kündigung, Kauf auf einem anderen Gerät).
 * Liefert die Abmeldung.
 */
export function proBeobachten(f: (aktiv: boolean) => void): () => void {
  if (!kaufAktiv) return () => undefined;
  let ab: (() => void) | null = null;
  let aus = false;
  void laden().then((p) => {
    if (!p || aus) return;
    const hoerer = (info: { entitlements: { active: Record<string, unknown> } }) => f(Boolean(info.entitlements.active[PRO_BERECHTIGUNG]));
    try {
      p.addCustomerInfoUpdateListener(hoerer);
      ab = () => void p.removeCustomerInfoUpdateListener(hoerer);
    } catch {
      // ohne Beobachtung bleibt die Abfrage beim Wechsel in den Vordergrund
    }
  });
  return () => {
    aus = true;
    ab?.();
  };
}
