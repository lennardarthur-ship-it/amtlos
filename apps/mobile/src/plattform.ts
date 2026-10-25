/**
 * Plattform der App (E-190) – ohne react-native, damit Texte und reine Module sie in Tests ohne Gerät nutzen können.
 *
 * `process.env.EXPO_OS` setzt babel-preset-expo beim Bündeln fest ein ("ios", "android", "web"). In den Tests (Vitest,
 * Node) fehlt es – dann gilt die iPhone-Fassung, wie sie geprüft und freigegeben ist. Die Web-Vorschau (Rundgang,
 * Store-Bilder) zeigt ebenfalls die iPhone-Fassung; nur für die Bilder von Google Play baut man den Web-Export mit
 * `EXPO_PUBLIC_VORSCHAU_PLATTFORM=android` und bekommt die Android-Texte.
 */
export type Plattform = "ios" | "android" | "web";

const os = process.env.EXPO_OS;
const vorschau = process.env.EXPO_PUBLIC_VORSCHAU_PLATTFORM;

/** Technische Plattform des Bündels. */
export const PLATTFORM: Plattform = os === "android" ? "android" : os === "web" ? "web" : "ios";
/** Texte und Abläufe in der Android-Fassung (Gerät oder Web-Vorschau für die Play-Bilder). */
export const ANDROID = PLATTFORM === "android" || (PLATTFORM === "web" && vorschau === "android");

/**
 * Wörter, die je Plattform anders heißen. Die iPhone-Werte sind genau die bisherigen Wörter – die Texte auf dem iPhone
 * bleiben damit Buchstabe für Buchstabe gleich (test/android.test.ts vergleicht das).
 */
export interface Woerter {
  /** „iPhone“ / „Smartphone“ – beide sächlich: „auf diesem iPhone“, „dein Smartphone erinnert dich“ */
  geraet: string;
  /** Genitiv: „des iPhones“ / „des Smartphones“ */
  geraetGenitiv: string;
  /** „App Store“ / „Google Play“ */
  store: string;
  /** „Apple-Account“ / „Google-Konto“ */
  konto: string;
  /** Satz, wo man das Abo kündigt */
  aboKuendigen: string;
  /** „Face ID“ / „Fingerabdruck oder Gesichtserkennung“ – Name der Sperre */
  sperre: string;
  /** „Face ID, Touch ID oder Gerätecode“ / „Fingerabdruck, Gesichtserkennung oder die Displaysperre“ */
  sperreVoll: string;
  /** „im Schlüsselbund dieses iPhones“ / „im Android-Schlüsselspeicher dieses Smartphones“ */
  schluesselOrt: string;
  /** Pfad zu den Mitteilungen in den Einstellungen */
  mitteilungenEinstellen: string;
  /** Wo eine Sicherungsdatei landen kann */
  ablageOrte: string;
}

export const IOS_WOERTER: Woerter = {
  geraet: "iPhone",
  geraetGenitiv: "iPhones",
  store: "App Store",
  konto: "Apple-Account",
  aboKuendigen: "in den Einstellungen deines Apple-Accounts",
  sperre: "Face ID",
  sperreVoll: "Face ID, Touch ID oder Gerätecode",
  schluesselOrt: "im Schlüsselbund dieses iPhones",
  mitteilungenEinstellen: "in den Einstellungen unter Mitteilungen",
  ablageOrte: "in „Dateien“ oder in iCloud Drive ablegen oder per AirDrop senden",
};

export const ANDROID_WOERTER: Woerter = {
  geraet: "Smartphone",
  geraetGenitiv: "Smartphones",
  store: "Google Play",
  konto: "Google-Konto",
  aboKuendigen: "in Google Play unter „Zahlungen und Abos“ › „Abos“",
  sperre: "Fingerabdruck oder Gesichtserkennung",
  sperreVoll: "Fingerabdruck, Gesichtserkennung oder die Displaysperre",
  schluesselOrt: "im Android-Schlüsselspeicher dieses Smartphones",
  mitteilungenEinstellen: "in den Einstellungen unter Apps › Benachrichtigungen",
  ablageOrte: "in einem Ordner ablegen (z. B. Google Drive, Nextcloud oder auf dem Smartphone) oder per Quick Share oder E-Mail senden",
};

/** Wörter der laufenden App. */
export const W: Woerter = ANDROID ? ANDROID_WOERTER : IOS_WOERTER;
