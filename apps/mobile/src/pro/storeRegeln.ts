/**
 * Reine Regeln zum Kauf je Store (E-190) – ohne react-native, damit sie sich ohne Gerät testen lassen
 * (test/android.test.ts). Benutzt von `kauf.ts`.
 */

/** Öffentlicher RevenueCat-Schlüssel der Plattform – nie der des anderen Stores (RevenueCat lehnt ihn ab). */
export function schluesselFuer(os: string, env: { ios?: string; android?: string }): string {
  if (os === "ios") return env.ios ?? "";
  if (os === "android") return env.android ?? "";
  return "";
}

/**
 * Google Play (E-190): kostenlose Phase des Standardangebots, das RevenueCat kaufen würde (`defaultOption`). Google
 * liefert ein Angebot mit kostenloser Phase nur Konten, die es bekommen (z. B. „Neukunden“) – deshalb hier keine eigene
 * Berechtigungsabfrage wie auf iOS. Liefert die Dauer im ISO-Format („P14D“) oder null.
 */
export function testAusAngebot(produkt: { defaultOption?: { freePhase?: { billingPeriod?: { iso8601?: string } | null } | null } | null; introPrice?: { price: number; period: string } | null }): string | null {
  const frei = produkt.defaultOption?.freePhase?.billingPeriod?.iso8601;
  if (frei) return frei;
  return produkt.introPrice && produkt.introPrice.price === 0 ? produkt.introPrice.period : null;
}
