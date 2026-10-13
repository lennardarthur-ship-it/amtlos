/**
 * Kauf von Amtlos Pro über den App Store (E-132), angebunden über RevenueCat (Abos, Belege, Kennzahlen wie MRR und
 * Kündigungen ohne eigenen Server). Ohne Schlüssel (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`, z. B. im Testpaket und in Expo
 * Go) lädt die App das Paket gar nicht und läuft im Testmodus: Pro lässt sich dort testweise einschalten.
 * Preise kommen immer aus dem Store – die App nennt keine eigenen Beträge.
 */
import { Platform } from "react-native";

export const PRO_BERECHTIGUNG = "pro";
const SCHLUESSEL = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";

/** Echte Käufe möglich (eigener Build mit Schlüssel)? Sonst Testmodus. */
export const kaufAktiv = Platform.OS === "ios" && SCHLUESSEL.length > 0;

export interface Angebot {
  id: string;
  titel: string;
  /** Preis wie vom Store geliefert, z. B. „9,99 €“ */
  preis: string;
  /** „monatlich“, „jährlich“ … */
  zeitraum: string;
  /** kostenloser Testzeitraum, z. B. „14 Tage“ – null, wenn keiner */
  test: string | null;
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
function testText(periode: string | undefined | null): string | null {
  const m = periode ? /^P(\d+)([DWMY])$/.exec(periode) : null;
  if (!m) return null;
  const n = Number(m[1]);
  const e = { D: ["Tag", "Tage"], W: ["Woche", "Wochen"], M: ["Monat", "Monate"], Y: ["Jahr", "Jahre"] }[m[2] as "D" | "W" | "M" | "Y"];
  return `${n} ${n === 1 ? e[0] : e[1]}`;
}

/** Hat das Apple-Konto ein aktives Pro-Abo? */
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

/** Angebote aus dem Store (aktuelles „Offering“), Jahresabo zuerst. */
export async function angebote(): Promise<Angebot[]> {
  const p = await laden();
  if (!p) return [];
  const o = await p.getOfferings();
  const pakete = o.current?.availablePackages ?? [];
  return pakete
    .map((pk) => ({
      id: pk.identifier,
      titel: pk.product.title,
      preis: pk.product.priceString,
      zeitraum: ZEITRAUM[pk.product.subscriptionPeriod ?? ""] ?? "",
      test: pk.product.introPrice && pk.product.introPrice.price === 0 ? testText(pk.product.introPrice.period) : null,
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

/** Käufe wiederherstellen (Pflicht im App Store) – z. B. nach Gerätewechsel. */
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
