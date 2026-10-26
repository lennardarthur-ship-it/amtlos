/**
 * Fachlich durchgesehene Vorlagen (zuerst Nachkontrolle Lebensmittelfachbeauftragter, 23.10.2026): Statt „Die Vorlagen sind
 * noch nicht von Fachleuten geprüft …“ zeigt die App bei diesen Vorlagen den Vermerk „Vorlage fachlich durchgesehen von
 * einem … (Stand …)“ – mit der Rolle, nie mit einem Namen (E-196).
 *
 * Der Vermerk gilt nur für den Stand, den der Prüfer gesehen hat: Je Freigabe steht die Prüfsumme aller gedruckten
 * Ausprägungen der Vorlage zum Freigabezeitpunkt (`vorlagenPruefsumme` in index.ts, Ausprägungen in pruefvarianten.ts –
 * seit E-196 auch mit Beispielbetrieben je Rechtsform, jeder Auswahl und Storno). Ändert sich ein Text, ein Baustein, ein
 * Hilfetext oder die Fußzeile, passt die Prüfsumme nicht mehr, und die App zeigt wieder den allgemeinen Hinweis. Die
 * Prüfsumme darf nur nach einer erneuten fachlichen Durchsicht neu eingetragen werden.
 *
 * E-197 (ersetzt die Unterschriftsregel aus E-196): Der Vermerk erscheint nur bei schriftlich bestätigter Freigabe –
 * `bestaetigt_am` (Tag der Bestätigung) und `nachweis` (Art, Datum, Rolle und Umfang der Bestätigung in unseren Worten;
 * der Stand liegt nie danach). E-198/E-199: Das Repository enthält keine Unterlagen der Prüfer – weder Mails noch
 * Berichte noch ausgefüllte Dateien – und keine Namen; alles bewahrt der Gründer auf (`aufbewahrung: "beim Gründer"`).
 * Diese Liste ist zusammen mit docs/freigabe-katalog/freigaben.yaml der einzige Nachweis im Projekt; kein Zitat, kein
 * Dateiverweis. Unterschriebene Blätter wurden auf Wunsch des Gründers am 25.10.2026 entfernt (E-197). Grenzen der Durchsicht (`einschraenkung`) stehen im
 * Vermerk; enthält die Vorlage noch mit „fachlich zu prüfen“ gekennzeichnete Angaben, heißt er „teilweise durchgesehen“.
 * `pruefsumme_alt`: Prüfsumme nach der Rechnung vor E-196 (nur Startwerte und alle Vorschläge ohne Betrieb), zum Nachweis,
 * welche Fassung freigegeben war; `pruefsumme` ist dieselbe Fassung nach der heutigen Rechnung
 * (packages/fachlogik/werkzeuge/pruefsummen-abgleich.py).
 */
import type { Daten } from "./typen.js";
import { FREIGEGEBENE_TEILSUMMEN } from "./geprueft-teilsummen.js";

/** Rollen der Prüfer (wie in docs/freigabe-katalog/freigaben.yaml) und ihre Nennung im Vermerk. */
export const PRUEF_ROLLEN = {
  recht: "von einem Rechtsanwalt",
  steuern: "von einem Steuerberater",
  arbeitsschutz: "von einer Fachkraft für Arbeitssicherheit",
  hygiene: "von einem Lebensmittelfachbeauftragten",
} as const;
export type PruefRolle = keyof typeof PRUEF_ROLLEN;

/**
 * Nachweis einer Vorlagen-Freigabe (E-197, E-198, E-199): was der Prüfer wann bestätigt hat, in unseren Worten. Die
 * Unterlage selbst (Mail, Bericht, ausgefüllte Datei) liegt nicht im Repository, sondern beim Gründer (`aufbewahrung`).
 */
export interface VorlagenNachweis {
  /** `mail` – Bestätigung per E-Mail (Textform); `bericht` – schriftlicher Bericht des Prüfers; `blatt` – vom Prüfer ausgefüllte Datei */
  art: "mail" | "bericht" | "blatt";
  /** Tag der Bestätigung (= `bestaetigt_am`) */
  datum: string;
  /** Rolle des Prüfers (= `rolle` der Freigabe) */
  rolle: PruefRolle;
  /** Was bestätigt ist – in unseren Worten, kein Zitat */
  umfang: string;
  /** Wo die Unterlage aufbewahrt wird – nie im Repository (E-199) */
  aufbewahrung: "beim Gründer";
}

/**
 * Mehrere Freigaben je Vorlage (24.10.2026): Eine Vorlage mit Fassungen (Hygieneplan: Lebensmittelbetrieb, Beauty) kann je
 * Fassung eine eigene Freigabe haben – jede mit eigener Fassung, eigenen Gruppen und eigener Prüfsumme. Die erste Freigabe
 * steht wie bisher direkt am Eintrag, weitere unter `weitere`. `vorlageGeprueft` wählt die Freigabe, deren Fassung zu den
 * Daten der Unterlage passt und deren Prüfsumme zum aktuellen Stand passt.
 */
export interface VorlagenFreigabe {
  /** Stand der Durchsicht (ISO-Datum) – erscheint im Vermerk */
  stand: string;
  /** Rolle des Prüfers (nie ein Name) */
  rolle?: PruefRolle;
  /** Tag der schriftlichen Bestätigung; ohne Bestätigung kein Vermerk */
  bestaetigt_am?: string | null;
  /** Nachweis der Bestätigung (E-198, E-199: ohne die Unterlage selbst) */
  nachweis?: VorlagenNachweis | null;
  /**
   * E-202: weitere schriftliche Bestätigungen derselben Fassung – z. B. die Bestätigung der Zuordnung alt → neu, die
   * frühere Bestätigung, wenn `nachweis` inzwischen auf eine spätere Mail zeigt, oder die Bestätigung durch eine zweite
   * Rolle (Rechtsanwalt bei den Geschäftsbrief-Angaben der Rechnung). Nur Nachweis, nicht im Vermerk.
   */
  weitere_nachweise?: readonly VorlagenNachweis[];
  /** Warum die Bestätigung fehlt (nur intern) */
  nachweis_offen?: string;
  /**
   * E-201: Vermerk ausgesetzt (Grund). Die Freigabe bleibt eingetragen, die App zeigt aber keinen Vermerk – z. B. weil der
   * Prüfer gebeten hat, bis zur Bestätigung der neu gerechneten Prüfsumme (E-196) keinen anzuzeigen.
   */
  vermerk_ausgesetzt?: string;
  /** Grenze der Durchsicht laut Prüfer, z. B. „ohne arbeitsmedizinische Angaben“ – steht im Vermerk */
  einschraenkung?: string;
  /** Worauf die Freigabe beruht, in unseren Worten (nur intern, nicht in der App; die Unterlage liegt beim Gründer) */
  bezug: string;
  /** SHA-256 (hex) aller gedruckten Ausprägungen zum Freigabezeitpunkt (Rechnung seit E-196) */
  pruefsumme: string;
  /** Prüfsumme derselben Fassung nach der Rechnung vor E-196 (nur zum Nachweis) */
  pruefsumme_alt?: string;
  /**
   * Teilsummen der freigegebenen Fassung je Variantengruppe (geprueft-teilsummen.ts): Der Vermerk erscheint für eine
   * Unterlage, wenn alle Gruppen, die sie braucht, unverändert sind (z. B. Rechnung eines Einzelunternehmens, auch wenn
   * sich die Fußzeile der GmbH & Co. KG geändert hat). Ohne Angabe muss die ganze Prüfsumme passen.
   */
  teilsummen?: Readonly<Record<string, string>>;
  /**
   * Freigabe nur für eine Fassung der Vorlage (Hygieneplan: nur Lebensmittelbetrieb): Der Vermerk erscheint nur, wenn
   * das Feld diesen Wert hat; die Prüfsumme wird mit diesem Wert gebildet.
   */
  fassung?: { feld: string; wert: string };
  /** Nur Vorschläge dieser Gruppen gehören zur Freigabe (und zur Prüfsumme) – die übrigen hat der Prüfer nicht gesehen */
  gruppen?: string[];
  /**
   * Freigabe nur für diese Rechtsformen (Schreibweise wie in der Vorlage, z. B. „GmbH“, „OHG“, „KG“): Der Prüfer hat nur
   * Beispiele dieser Rechtsformen gesehen. Rechtsform aus dem Feld „rechtsform“ der Unterlage, sonst aus „Mein Betrieb“;
   * ohne erkennbare Rechtsform (Info-Seite) kein Vermerk. Die Prüfsumme rechnet nur mit Beispielbetrieben dieser Rechtsformen.
   */
  rechtsformen?: readonly string[];
  /**
   * E-200: Nachprüfung nur dieser Variantengruppen (pruefvarianten.ts), z. B. nach einer Änderung allein der Fußzeile der
   * GmbH & Co. KG. Die Teilsummen dieser Gruppen stammen aus der Nachprüfung, alle übrigen aus der ersten Freigabe der
   * Vorlage (geprueft-teilsummen.ts, pruefsummen-abgleich.py) – der Vermerk mit dem Stand der Nachprüfung erscheint also nur
   * für Unterlagen, die eine nachgeprüfte Variante brauchen und deren übrige Varianten seit der ersten Freigabe gleich sind;
   * alle anderen behalten den Vermerk der ersten Freigabe. `pruefsumme_alt` ist hier die Gesamtsumme der Fassung, die der
   * Prüfer zur Nachprüfung bekam.
   */
  varianten?: readonly string[];
  /** Freigaben weiterer Fassungen derselben Vorlage (je eigene Fassung, Gruppen und Prüfsumme) */
  weitere?: readonly Omit<VorlagenFreigabe, "weitere">[];
}

/** Freigaben wie eingetragen (ohne Teilsummen) */
const FREIGABEN: Readonly<Record<string, VorlagenFreigabe>> = {
  haccp: { stand: "2026-10-23", rolle: "hygiene", bestaetigt_am: "2026-10-23", nachweis: { art: "bericht", datum: "2026-10-23", rolle: "hygiene", umfang: "Freigabe der fünf Lebensmittel-Vorlagen (Eigenkontrollen, Hygieneplan Lebensmittelbetrieb, Allergenliste, Belehrung nach § 43 IfSG, Schulungsnachweis) im schriftlichen Bericht zur Nachkontrolle", aufbewahrung: "beim Gründer" }, bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (schriftlicher Bericht, beim Gründer)", pruefsumme: "58d605e11929c83675aea99685ae7b83f7c500a0b4cd5ebff99ad2486855571a", pruefsumme_alt: "bf971591cc3e7ab66b744bc12d6b6bfa75793eddb63eaea4b5b2bda5b423db0f" },
  hygieneplan: { stand: "2026-10-23", rolle: "hygiene", bestaetigt_am: "2026-10-23", nachweis: { art: "bericht", datum: "2026-10-23", rolle: "hygiene", umfang: "Freigabe der fünf Lebensmittel-Vorlagen (Eigenkontrollen, Hygieneplan Lebensmittelbetrieb, Allergenliste, Belehrung nach § 43 IfSG, Schulungsnachweis) im schriftlichen Bericht zur Nachkontrolle", aufbewahrung: "beim Gründer" }, bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (schriftlicher Bericht, beim Gründer)", pruefsumme: "95846129d50787908bbcc4ab82883bf9b94a0f8abe83ae5eb60ecbd3b9bceae6", pruefsumme_alt: "941cde2f8ec04fc0ad7eb4ddcb08dc047d36416cadefbff5788f667da7133dd8", fassung: { feld: "art", wert: "lebensmittel" }, gruppen: ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"],
    // Rechtsanwalt Runde 4 (25.10.2026): Fassung Friseur/Kosmetik, Abgleich mit Rechtsgrundlagen und AWMF 055-004 (keine medizinische Begutachtung)
    weitere: [{ stand: "2026-10-25", rolle: "recht", bestaetigt_am: "2026-10-25", nachweis: { art: "mail", datum: "2026-10-25", rolle: "recht", umfang: "Hygieneplan, Fassung Friseur/Kosmetik (Prüfsumme 101632b4de7a), bestätigt mit der ausgefüllten Freigabe-Datei Runde 4; Länderzusätze nur für Bayern abgeglichen", aufbewahrung: "beim Gründer" }, einschraenkung: "Länderzusatz nur für Bayern geprüft", bezug: "Durchsicht Rechtsanwalt Runde 4 (ausgefüllte Freigabe-Datei, beim Gründer)", pruefsumme: "e1cf092f9b77cfd455d2e6d99afbdbd99de6b57c0f8b79197957de0106b8cd37", pruefsumme_alt: "101632b4de7a47f0ce0919fd225eaa82f0e327ac47b79750e2e4274598893c83", fassung: { feld: "art", wert: "beauty" }, gruppen: ["Alle Beauty-Betriebe"] }] },
  allergene: { stand: "2026-10-23", rolle: "hygiene", bestaetigt_am: "2026-10-23", nachweis: { art: "bericht", datum: "2026-10-23", rolle: "hygiene", umfang: "Freigabe der fünf Lebensmittel-Vorlagen (Eigenkontrollen, Hygieneplan Lebensmittelbetrieb, Allergenliste, Belehrung nach § 43 IfSG, Schulungsnachweis) im schriftlichen Bericht zur Nachkontrolle", aufbewahrung: "beim Gründer" }, bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (schriftlicher Bericht, beim Gründer)", pruefsumme: "eaa49d404283dae90058bf35a626e09a543b7c6b63847301df4eade9fee7bb19", pruefsumme_alt: "8d6b015f6491872e3ca492ee2c1b9245890e84428cacecfe914beb90ea85144c" },
  ifsg_belehrung: { stand: "2026-10-23", rolle: "hygiene", bestaetigt_am: "2026-10-23", nachweis: { art: "bericht", datum: "2026-10-23", rolle: "hygiene", umfang: "Freigabe der fünf Lebensmittel-Vorlagen (Eigenkontrollen, Hygieneplan Lebensmittelbetrieb, Allergenliste, Belehrung nach § 43 IfSG, Schulungsnachweis) im schriftlichen Bericht zur Nachkontrolle", aufbewahrung: "beim Gründer" }, bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (schriftlicher Bericht, beim Gründer)", pruefsumme: "85ab09092299d629899df78bce140c2cd066ee5c6396a4bd4ecfd80c68caa13b", pruefsumme_alt: "2e35d889d03764df32a310aeacc999e2b6151e83afd38520da0c6c36d541ebec" },
  rechnung: { stand: "2026-10-23", rolle: "steuern", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "steuern", umfang: "Freigabe von fünf Vorlagen – Rechnung, Kassenmeldung, Lohnkonto-Übersicht, EÜR und Verfahrensdokumentation – mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); das unterschriebene Blatt vom 23.10.2026 lag zusätzlich vor und wurde am 25.10.2026 auf Wunsch des Gründers aus dem Projekt entfernt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "300b8ca36b03ff07f86c86ff736a375f7b2fe33b686890a2ca26d171321891ea", pruefsumme_alt: "8c2e773d415398dea57ab58922035136df2317e273cb2e82db72f0f86a6cda9e",
    // E-200 (Steuerberater, 26.10.2026): Nachprüfung nur der Varianten GmbH & Co. KG und UG (haftungsbeschränkt) & Co. KG – die
    // übrigen Teilsummen sind die der Freigabe vom 23.10.2026 (Storno der Schlussrechnung bleibt beim alten Stand, also ohne Vermerk)
    weitere: [{ stand: "2026-10-26", rolle: "steuern", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "steuern", umfang: "Nachprüfung der Rechnung in den Varianten GmbH & Co. KG und UG (haftungsbeschränkt) & Co. KG: Inhalt bestätigt; die Fundstelle § 125 HGB (seit dem MoPeG, 1.1.2024) und die Bezeichnung „Geschäftsführer der Komplementärin“ (statt „Geschäftsführung“) in Fußzeile und XRechnung hatten die Prüfer selbst erbeten (Steuerberater und Rechtsanwalt die Fundstelle, Rechtsanwalt die Bezeichnung). Nicht Teil dieser Bestätigung: das Storno einer Schlussrechnung mit Abschlägen (geänderte Darstellung, erst nach Durchsicht des neuen Beispiel-PDFs)", aufbewahrung: "beim Gründer" }, bezug: "Antwort des Steuerberaters vom 26.10.2026 auf die Nachprüfliste (Beispiel-PDFs GmbH & Co. KG und UG & Co. KG, beim Gründer)", weitere_nachweise: [{ art: "mail", datum: "2026-10-26", rolle: "recht", umfang: "Zweite Antwort vom 26.10.2026: Geschäftsbrief-Angaben der Rechnung in den Varianten GmbH & Co. KG (Teilsumme 23c88b1f276727cac2d24354) und UG (haftungsbeschränkt) & Co. KG (812e83e7dd0d3ece9374f9c6) bestätigt – nur § 125 Abs. 1, § 177a HGB und § 35a GmbHG, steuerliche Angaben nicht umfasst (E-202)", aufbewahrung: "beim Gründer" }], varianten: ["rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"], pruefsumme: "9f841cc908989e5c87c5d5057131a75d2e70a45c28326b737602da4ad64f3a10", pruefsumme_alt: "75a201030d662e82a3bf81d8c977b7d6c6f1070a3d1376c78ced398475b97ebb" },
    // E-202 (Steuerberater, 26.10.2026): Storno der Schlussrechnung bestätigt – Teilsummen von Storno und Co.-KG-Varianten aus
    // dieser Fassung, alle übrigen aus der Freigabe vom 23.10.2026
    { stand: "2026-10-26", rolle: "steuern", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "steuern", umfang: "Zweite Antwort vom 26.10.2026: Storno einer Schlussrechnung mit Abschlägen (Beispiel-PDF mit gespiegelten Vorzeichen und Satz zu den bestehenden Abschlagsrechnungen) bestätigt – die Rechnung ist damit in allen Varianten freigegeben (zusammen mit der Nachprüfung der Co.-KG-Varianten vom selben Tag). Die zwei Änderungen der XRechnung des Stornos (Anmerkung wie der Satz auf dem PDF, Datum der stornierten Rechnung im Verweis) hatte er vorab freigegeben; sie ändern den gedruckten Text nicht (E-202)", aufbewahrung: "beim Gründer" }, bezug: "Zweite Antwort des Steuerberaters vom 26.10.2026 (Beispiel-PDF Storno der Schlussrechnung, beim Gründer)", varianten: ["storno_schluss", "rf:GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG"], pruefsumme: "75a201030d662e82a3bf81d8c977b7d6c6f1070a3d1376c78ced398475b97ebb", pruefsumme_alt: "75a201030d662e82a3bf81d8c977b7d6c6f1070a3d1376c78ced398475b97ebb" }],
  },
  euer: { stand: "2026-10-23", rolle: "steuern", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "steuern", umfang: "Freigabe von fünf Vorlagen – Rechnung, Kassenmeldung, Lohnkonto-Übersicht, EÜR und Verfahrensdokumentation – mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); das unterschriebene Blatt vom 23.10.2026 lag zusätzlich vor und wurde am 25.10.2026 auf Wunsch des Gründers aus dem Projekt entfernt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "1269f5896d33eb941ea4419e118f074eaf12a8fd5207c630eae060a2a4b9b1a9", pruefsumme_alt: "d669212fbf4abf8bfcff24ad65388185ca46f47d513de53cf93e5286010130d2" },
  verfahrensdokumentation: { stand: "2026-10-23", rolle: "steuern", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "steuern", umfang: "Freigabe von fünf Vorlagen – Rechnung, Kassenmeldung, Lohnkonto-Übersicht, EÜR und Verfahrensdokumentation – mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); das unterschriebene Blatt vom 23.10.2026 lag zusätzlich vor und wurde am 25.10.2026 auf Wunsch des Gründers aus dem Projekt entfernt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "0d34f1bf5d632df7ca522399a5a905fb7447d40b67ad92e8fb374fa198bee17b", pruefsumme_alt: "9d23a5d3f01831910bcec4e93e563d8503a3736b68a73deaaf09d14435fec48b" },
  kassenmeldung: { stand: "2026-10-23", rolle: "steuern", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "steuern", umfang: "Freigabe von fünf Vorlagen – Rechnung, Kassenmeldung, Lohnkonto-Übersicht, EÜR und Verfahrensdokumentation – mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); das unterschriebene Blatt vom 23.10.2026 lag zusätzlich vor und wurde am 25.10.2026 auf Wunsch des Gründers aus dem Projekt entfernt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "02979c4cad3a3bcb0df59aae4e0300fc498ed08c42d6f8781176928c56cc99f6", pruefsumme_alt: "d9ac127520bab87ef105e7da71c3c9cebbc7549993ffcb8740ef243dcaa0ee65" },
  lohnkonto: { stand: "2026-10-23", rolle: "steuern", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "steuern", umfang: "Freigabe von fünf Vorlagen – Rechnung, Kassenmeldung, Lohnkonto-Übersicht, EÜR und Verfahrensdokumentation – mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); das unterschriebene Blatt vom 23.10.2026 lag zusätzlich vor und wurde am 25.10.2026 auf Wunsch des Gründers aus dem Projekt entfernt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "a9dcb1a0e0f548df060e4d8f6405cd49aacfc0c9692c21bda50ff5195136184c", pruefsumme_alt: "7210085d37a2e3866d4d15108172b76d61339ee16cce5d3169bd8702393f9428" },
  // gefaehrdungsbeurteilung (Prüfsumme ea0f369a…, Durchsicht Sifa 23.10.2026): Vermerk entfallen – Sifa hat in derselben
  // Durchsicht Bausteine der Vorlage korrigiert (B-054, B-200, B-218, B-226, B-231, B-233, B-236, B-238); erneut vorlegen
  unterweisung: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme 57c388f4fc2e entspricht der freigegebenen (73c536207bb5); der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-23", rolle: "arbeitsschutz", umfang: "Freigabe von Unterweisungsnachweis, Gefahrstoffverzeichnis, Betriebsanweisung Maschinen und Prüfprotokoll elektrische Geräte mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); die damals ebenfalls freigegebene Gefährdungsbeurteilung ist später geändert und eigens bestätigt", aufbewahrung: "beim Gründer" }], bezug: "Durchsicht Sifa 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "57c388f4fc2e1f360aaeeccc73a54a0e210d96bf3622dc675be1f0aec7d47747", pruefsumme_alt: "73c536207bb588fba5cf502a2f83323e56c2fdd6c8b5c2a8b7ada82c4a91e8df",
    // E-202 (Sifa 26.10.2026): Fassung nach dem Streichen von „fachlich zu prüfen“ bei 40 bestätigten Bausteinen
    weitere: [{ stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: 40 der 41 mit „fachlich zu prüfen“ markierten Bausteine bestätigt; mit seiner ausdrücklichen Erlaubnis ist der Vermerk dort gestrichen – die so geänderte Fassung gilt als von ihm freigegeben (Vorabfreigabe). B-105 (Nadelstichverletzungen) bleibt markiert und ausgenommen, bis ein Betriebsarzt bestätigt (E-202)", aufbewahrung: "beim Gründer" }, bezug: "Zweite Antwort der Fachkraft für Arbeitssicherheit vom 26.10.2026 (Bausteine mit Nummer und Text, beim Gründer)", pruefsumme: "5e067208bfb62bbdc7f696362949cccde41a2753e9ebc6f4a5b4a0401da3b2e8", pruefsumme_alt: "5e067208bfb62bbdc7f696362949cccde41a2753e9ebc6f4a5b4a0401da3b2e8" }] },
  gefahrstoffverzeichnis: { stand: "2026-10-23", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "arbeitsschutz", umfang: "Freigabe von Unterweisungsnachweis, Gefahrstoffverzeichnis, Betriebsanweisung Maschinen und Prüfprotokoll elektrische Geräte mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); die damals ebenfalls freigegebene Gefährdungsbeurteilung ist später geändert und eigens bestätigt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Sifa 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "c41d2dfd49b4da6bd4bd7e47adba26d7297cf1148d9e0d56d10f4a632b6d9173", pruefsumme_alt: "e1f81534e968125c84bbece65d414b87460da5c4748a820f243fb09d27e420a6" },
  betriebsanweisung_maschine: { stand: "2026-10-23", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "arbeitsschutz", umfang: "Freigabe von Unterweisungsnachweis, Gefahrstoffverzeichnis, Betriebsanweisung Maschinen und Prüfprotokoll elektrische Geräte mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); die damals ebenfalls freigegebene Gefährdungsbeurteilung ist später geändert und eigens bestätigt", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Sifa 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "5c56ef6f40046fb69e86382d7fbf4a34525cfc6ef7d1cca66651805ac4496f9e", pruefsumme_alt: "f041a0b042843e6b29e05171e90e4669fefafde1ce37aeb4445f2dd58af1268e" },
  pruefprotokoll_elektro: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme fc087228e53a entspricht der freigegebenen (599f83aa6405), ohne die elektrotechnischen Grenzwerte; der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-23", rolle: "arbeitsschutz", umfang: "Freigabe von Unterweisungsnachweis, Gefahrstoffverzeichnis, Betriebsanweisung Maschinen und Prüfprotokoll elektrische Geräte mit der ausgefüllten Freigabe-Datei (Prüfsumme je Vorlage); die damals ebenfalls freigegebene Gefährdungsbeurteilung ist später geändert und eigens bestätigt", aufbewahrung: "beim Gründer" }], einschraenkung: "ohne die elektrotechnischen Grenzwerte", bezug: "Durchsicht Sifa 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "fc087228e53a15c55ec54c6b4d798aca0bad3e3719471a027159aa052172c993", pruefsumme_alt: "599f83aa64055153e81be987c85ffabc90b5aa02f16e293412b66782161c27c3" },
  datenschutz_dokumentation: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "c5d2853a2c801e343f20e2b163c45c0e072775e75fd0444f9fb1df1c81954042", pruefsumme_alt: "524dfef7fee994656e460147adcac2fa4a2928dff076141e881ae90912499d28" },
  datenschutzerklaerung_website: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-26", rolle: "recht", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung 1b191e907794 → a93921de34f2 bestätigt, Texte Wort für Wort verglichen (E-202)", aufbewahrung: "beim Gründer" }], bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "a93921de34f22ab0cd7055a1053a875f536d04f889bf750f0f85fa957d104321", pruefsumme_alt: "1b191e90779472b36e0ff8582d5dbb4a73bc40d394d9663d62291aa387db5768",
    // E-202 (Rechtsanwalt 26.10.2026): vorab freigegebene Fassung
    weitere: [{ stand: "2026-10-26", rolle: "recht", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "recht", umfang: "Zweite Antwort vom 26.10.2026: Bausteine „Online-Kurse und Beratungen per Videokonferenz“ und „Zahlungsdienstleister“ bestätigt, Vermerk „fachlich zu prüfen“ dort gestrichen; beim Zahlungsdienstleister seine vorab freigegebene Fassung „in der Regel in eigener Verantwortung“ übernommen – die so geänderte Fassung gilt ohne erneute Vorlage als von ihm freigegeben (E-202)", aufbewahrung: "beim Gründer" }, bezug: "Zweite Antwort des Rechtsanwalts vom 26.10.2026 (beim Gründer)", pruefsumme: "74ad815a4c54771007d5005632d9e9ea5e053eaa65b61affecb4ebeec78441e2", pruefsumme_alt: "74ad815a4c54771007d5005632d9e9ea5e053eaa65b61affecb4ebeec78441e2" }] },
  avv: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "811a35c4f67297c3057fab3948a238d9fe38e1d3dd2a104e2a73a5f94fd9cca0", pruefsumme_alt: "d4a5c48088053795e457ead7dea54f83e15d58a24134484a0c3938c029182811" },
  datenschutzinformation: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "a02e07c89bf6b544d34c87fd3421fae6b4be892ee20f93ed91816ee7d71e1ee9", pruefsumme_alt: "5f243298c3669fefcf8e3f435e4b813f416a3ab04e1cba91deb88d75eef665c8" },
  datenpanne: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "4f7e8ca8b18db4a0d0b19692aa43720d15285f3a5a6f0f218d6882e7ca31d3ae", pruefsumme_alt: "e907682096eabf02baa57c257de08ffde433d31c3ccaba58640119663ddec962" },
  video_hinweisschild: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-26", rolle: "recht", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung 9d1a06fbb30f → a6bfb823f90b bestätigt, Texte Wort für Wort verglichen (E-202)", aufbewahrung: "beim Gründer" }], bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "a6bfb823f90bfffa0548c528c2e4efaef31c1055422c64b5cc0cd957df3b49c6", pruefsumme_alt: "9d1a06fbb30f998d3d4561780c495a56403a9bc96fca8c1242c584ce6fd48c75",
    // E-202 (Rechtsanwalt 26.10.2026): vorab freigegebene Fassung
    weitere: [{ stand: "2026-10-26", rolle: "recht", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "recht", umfang: "Zweite Antwort vom 26.10.2026: Hilfetext „Überwachung“ bestätigt, dort nur „– fachlich zu prüfen“ gestrichen; der Schlusssatz auf Seite 2 entfällt im Druck (kein Prüfvermerk auf einem Aushang für Kundschaft). Mit diesen zwei Streichungen und sonst unverändertem Text gilt die neue Fassung ohne erneute Vorlage als von ihm freigegeben (E-202)", aufbewahrung: "beim Gründer" }, bezug: "Zweite Antwort des Rechtsanwalts vom 26.10.2026 (beim Gründer)", pruefsumme: "58fc78439f30d039f69ae4898fb0fe1d639ec3d0d7d3dd62fc586dde625221c5", pruefsumme_alt: "58fc78439f30d039f69ae4898fb0fe1d639ec3d0d7d3dd62fc586dde625221c5" }] },
  anamnese_einwilligung: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "ad558f108ab11931135b7ae0a9b3f0247d64fd942d44e47df9edf209a4721937", pruefsumme_alt: "16515a705e3114af069241bdcc4d604055373688dfa43d056c33efd62247bcac" },
  arbeitszeitnachweis: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "3006e5c133a4fcaceb251c9b3c9f760c825b64b00fe0c8e605a9349de452dd01", pruefsumme_alt: "62df8ed29e691294c9e9cb06471cef68b385714e7c79360c0b3cb7ccf1a31a39" },
  nachweis_arbeitsbedingungen: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "f6130d2b1c65fe388c18f0886652702bf8ba904dd09d0417ead376dbcccdf0b9", pruefsumme_alt: "c37a8792a9983556a308cf82a8f62e7af408d939f39a9bff617d8df72ae8b40b" },
  ki_kompetenz: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "a0ce2389b3cbbf3044f2e70b9943c827582908248b606a3dab996081e236c5ba", pruefsumme_alt: "2353e20c509afdfa922e841ecb2042d6bff6d9b40fa8317e86087bb1502218a4" },
  ausweis_hinweis: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "a8d0aaca445b5a872a0befbb46247d8bc69b3ec33ba3c39242ae117f8d195112", pruefsumme_alt: "235a5366934919f9c449f9223d23317360e3f502a9fb4ec8cbbb3d76b9028c27" },
  schluesselquittung: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "3951cb4e226fd35e0c5c659dbe075bffa8f593afe143f3eacd3bda8423860e2b", pruefsumme_alt: "2399c8cf81e2fee1fc294ea8de923f6d9c5c4ae05c633a95c3ca78215cffac8f" },
  impressum: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "407eef48f7ba38b14cbdde7ffe693704fecbd3bd048d835a3b1f977dd239ff42", pruefsumme_alt: "9e79f203766117dd6c5e67a7d2aa51c100bb828689625dbfa15cf077cee9328f" },
  gewerbeanmeldung: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "2967ec09f195aa9c0d6e371dd5b2d05c81fbfc847ade20b59b33a087983f813c", pruefsumme_alt: "8324d37f947181f884e29330c41f50c757b5486398ca864c3b2d11ccb610e110" },
  transparenzregister: { stand: "2026-10-23", rolle: "recht", bestaetigt_am: "2026-10-23", nachweis: { art: "mail", datum: "2026-10-23", rolle: "recht", umfang: "Nachprüfung Teil B: Vorlagen und Texte mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die drei Positionen mit Änderungswunsch gehören nicht dazu", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Rechtsanwalt 23.10.2026 (ausgefüllte Freigabe-Datei mit Prüfsumme je Vorlage, beim Gründer)", pruefsumme: "3b0b44db4548741bf9b34d3b918727d01733139f10bc9af2e73666a1ebf62093", pruefsumme_alt: "01473dc8aef549c590384275e82fbf08740a1da053f021709174242d73d84116" },
  ust_voranmeldung: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "c0939d610d67512fd04ee8cd5335927d3c8ab7d8b3e47c9e8b5343e1601ba231", pruefsumme_alt: "fa59f364368d123e367c2ba3c36eb00e0a68389d050ff36954d2ece6b50d66e4" },
  oss_meldung: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "4416d2cf8a9cef24c39c7040b5ebff412a65aff80202a8c03bb86c1106d295fc", pruefsumme_alt: "f136b58ddfcc5b60337fc499c573ec5b6de28ec0df50092e4b6338c452d1b7b3" },
  zm_meldung: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "332a518a08d55a8859a86b04345151c7844b0a2a4e4f33e3eb091e70867288eb", pruefsumme_alt: "f7a989efdb3e0291b49ac247e3f199d63950bb8f73f3c6e18f67b8df829a5f71" },
  steuererklaerung: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "c5f459479a0669355d95de8245a3bd5f85035834917b68ad747c1d4b5382aee5", pruefsumme_alt: "77c6acbdf298c1eb68a3f2caeb8642bbe6c2c05240ac9803bc313b09144d4dce" },
  kassenbuch: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "9cad79a55cbc35c7481683ba3bbe4d248d7309adec6ca5d3801563c079c7f6d9", pruefsumme_alt: "cda4e6656204d5352af7a559b5fe94f8f7a91b3e67a057dc4fc1321bc85d5f64" },
  aufbewahrung: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "0ebd0adde12aab7814a8fd5b60395c836d4125fc2f6dd35db094d38a0fd2d7af", pruefsumme_alt: "0582763257c6d3cf28329e42a2cd8bd03f0ed1b16a0a38c64e4244bffb9a6316" },
  sv_meldedaten: { stand: "2026-10-24", rolle: "steuern", bestaetigt_am: "2026-10-24", nachweis: { art: "mail", datum: "2026-10-24", rolle: "steuern", umfang: "Runde 3: 7 von 8 vorgelegten Vorlagen mit der ausgefüllten Freigabe-Datei freigegeben (Prüfsumme je Vorlage); die Bilanz/GuV folgte eigens", aufbewahrung: "beim Gründer" }, bezug: "Durchsicht Steuerberater Runde 3 (ausgefüllte Freigabe-Datei und Ergänzung der Bestätigung, beim Gründer)", pruefsumme: "6823730ddb1478087a20eeb6d2c932dffa1c7479f3a6f48b337f51b2056bdcac", pruefsumme_alt: "71ff4c2ff8209e9d1a6b23654ec65cd96df10370d78a54bad6f7e9660b040ba0" },
  // Rechtsanwalt 25.10.2026 (Mail Runde 5): nur GmbH, OHG und KG; Fassung mit § 106 Abs. 2 Nr. 3 HGB
  handelsregister: { stand: "2026-10-25", rolle: "recht", bestaetigt_am: "2026-10-25", nachweis: { art: "mail", datum: "2026-10-25", rolle: "recht", umfang: "Bestätigung der Vorlage in der Fassung mit der Prüfsumme e2cd7a14a6c1, nur für GmbH, OHG und KG; der zunächst geäußerte Vorbehalt ist mit der Mail desselben Tages (Runde 6) aufgehoben", aufbewahrung: "beim Gründer" }, bezug: "Bestätigung Rechtsanwalt per Mail 25.10.2026 (Runde 5 und 6; Mail beim Gründer)", pruefsumme: "615ef77b91abd7e70a4369fa71eb8c60f5512f78a2af74dcd582e472a1e60f78", pruefsumme_alt: "e2cd7a14a6c1574814a6725b12104ff0234d3e4d02a52025ec83e3d8f9917338", rechtsformen: ["GmbH", "OHG", "KG"] },
  betriebsanweisung: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme 125ecb14e239 entspricht der freigegebenen (f477c1d03df5); der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-25", rolle: "arbeitsschutz", umfang: "Bestätigung, dass das Blatt vom 23.10.2026 mit der Prüfsumme je Vorlage für Betriebsanweisung, Expositionsverzeichnis und Hautschutzplan weiter gilt (unverändert seitdem)", aufbewahrung: "beim Gründer" }], bezug: "Durchsicht Sifa, Nachprüfung (Blatt vom 23.10.2026 und Mail 25.10.2026, beim Gründer)", pruefsumme: "125ecb14e239f83a1d171770d4f1bb91f5131c22b477b16992919d2a78468477", pruefsumme_alt: "f477c1d03df509acca567e7f562eace7d3a71b4da991d3c75d0b79e439c3eeec" },
  expositionsverzeichnis: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme 2d674875e004 entspricht der freigegebenen (32867a852a99); der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-25", rolle: "arbeitsschutz", umfang: "Bestätigung, dass das Blatt vom 23.10.2026 mit der Prüfsumme je Vorlage für Betriebsanweisung, Expositionsverzeichnis und Hautschutzplan weiter gilt (unverändert seitdem)", aufbewahrung: "beim Gründer" }], bezug: "Durchsicht Sifa, Nachprüfung (Blatt vom 23.10.2026 und Mail 25.10.2026, beim Gründer)", pruefsumme: "2d674875e004bc770761fd556174f358caa96c210d397683147e1bedc8f1e581", pruefsumme_alt: "32867a852a9971b1cde4b4ce6582ec39db483c5f62027d23f7b76666ff629aba" },
  hautschutzplan: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme c912c9a88d21 entspricht der freigegebenen (ea45c72ec6fc); der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-25", rolle: "arbeitsschutz", umfang: "Bestätigung, dass das Blatt vom 23.10.2026 mit der Prüfsumme je Vorlage für Betriebsanweisung, Expositionsverzeichnis und Hautschutzplan weiter gilt (unverändert seitdem)", aufbewahrung: "beim Gründer" }], bezug: "Durchsicht Sifa, Nachprüfung (Blatt vom 23.10.2026 und Mail 25.10.2026, beim Gründer)", pruefsumme: "c912c9a88d2173b4c1792dff8cb26f8ccb86ba46523394948019df63e272cd9b", pruefsumme_alt: "ea45c72ec6fc7ca7918dfcfa40765d0ce1795626d25896389f1136245a943316",
    // E-202 (Sifa 26.10.2026): Fassung nach dem Streichen von „fachlich zu prüfen“ bei 40 bestätigten Bausteinen
    weitere: [{ stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: 40 der 41 mit „fachlich zu prüfen“ markierten Bausteine bestätigt; mit seiner ausdrücklichen Erlaubnis ist der Vermerk dort gestrichen – die so geänderte Fassung gilt als von ihm freigegeben (Vorabfreigabe). B-105 (Nadelstichverletzungen) bleibt markiert und ausgenommen, bis ein Betriebsarzt bestätigt (E-202)", aufbewahrung: "beim Gründer" }, bezug: "Zweite Antwort der Fachkraft für Arbeitssicherheit vom 26.10.2026 (Bausteine mit Nummer und Text, beim Gründer)", pruefsumme: "708e703a9f76850e0d5f619669ede9caa220dcfaf7f0292889c0704a00330789", pruefsumme_alt: "708e703a9f76850e0d5f619669ede9caa220dcfaf7f0292889c0704a00330789" }] },
  gefaehrdungsbeurteilung: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme 757c3dfb104a entspricht der freigegebenen (1063d59082d4), ohne arbeitsmedizinische Angaben; der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-25", rolle: "arbeitsschutz", umfang: "Freigabe der aktuellen Fassungen nach Abgleich der PDFs (Gefährdungsbeurteilung 1063d59082d4, Betriebsanweisung Biostoffe 70fe591f5a3e); geänderte arbeitsmedizinische Stellen ausgenommen", aufbewahrung: "beim Gründer" }], einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Nachtrag Sifa 25.10.2026 (Mail beim Gründer; B-022, B-105, B-276, B-283 ausgenommen, Abgleich Rechtsanwalt)", pruefsumme: "757c3dfb104a097e5b3aa17a37630fb6e2a53b4af54f94e30f1543f1b6752394", pruefsumme_alt: "1063d59082d4887bbaed62d7f126a2c11e89b0aa5320df61cba0cb7e3bd78b2d",
    // E-202 (Sifa 26.10.2026): Fassung nach dem Streichen von „fachlich zu prüfen“ bei 40 bestätigten Bausteinen
    weitere: [{ stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: 40 der 41 mit „fachlich zu prüfen“ markierten Bausteine bestätigt; mit seiner ausdrücklichen Erlaubnis ist der Vermerk dort gestrichen – die so geänderte Fassung gilt als von ihm freigegeben (Vorabfreigabe). B-105 (Nadelstichverletzungen) bleibt markiert und ausgenommen, bis ein Betriebsarzt bestätigt (E-202)", aufbewahrung: "beim Gründer" }, einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Zweite Antwort der Fachkraft für Arbeitssicherheit vom 26.10.2026 (Bausteine mit Nummer und Text, beim Gründer)", pruefsumme: "b7e6e8a27845c72de3f39b4f321b5f8c781caa2d0e23be9d99dd3181af4c443c", pruefsumme_alt: "b7e6e8a27845c72de3f39b4f321b5f8c781caa2d0e23be9d99dd3181af4c443c" }] },
  betriebsanweisung_biostoffe: { stand: "2026-10-26", rolle: "arbeitsschutz", bestaetigt_am: "2026-10-26", nachweis: { art: "mail", datum: "2026-10-26", rolle: "arbeitsschutz", umfang: "Zweite Antwort vom 26.10.2026: Zuordnung der Prüfsummen bestätigt – die Fassung mit der heutigen Prüfsumme 339064dff284 entspricht der freigegebenen (70fe591f5a3e), ohne arbeitsmedizinische Angaben; der Vermerk erscheint wieder (E-202)", aufbewahrung: "beim Gründer" }, weitere_nachweise: [{ art: "mail", datum: "2026-10-25", rolle: "arbeitsschutz", umfang: "Freigabe der aktuellen Fassungen nach Abgleich der PDFs (Gefährdungsbeurteilung 1063d59082d4, Betriebsanweisung Biostoffe 70fe591f5a3e); geänderte arbeitsmedizinische Stellen ausgenommen", aufbewahrung: "beim Gründer" }], einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Nachtrag Sifa 25.10.2026 (Mail beim Gründer; B-022, B-105, B-276, B-283 ausgenommen, Abgleich Rechtsanwalt)", pruefsumme: "339064dff284b5e207fc6702eb2563fe8b2871e7b39de3e3cce5db2f968f0974", pruefsumme_alt: "70fe591f5a3e7e207540c518d96bec16896c92cddd9979ce34abf6f92a636d75" },
  bilanz_guv: { stand: "2026-10-25", rolle: "steuern", bestaetigt_am: "2026-10-25", nachweis: { art: "mail", datum: "2026-10-25", rolle: "steuern", umfang: "Freigabe der Bilanz/GuV in der Fassung mit der Prüfsumme 5d2246459fe6 nach der Korrektur der Steuerzeile in allen Beispielen", aufbewahrung: "beim Gründer" }, bezug: "Nachtrag Steuerberater 25.10.2026 (Mail beim Gründer)", pruefsumme: "a266993aadfd3125a42cc48f0415aa69a7dbd1a24361d5418ef947c9afc78d69", pruefsumme_alt: "5d2246459fe66ccea599cbc1b7cc0845f4b4b35af164b91b617e91cfd8432986" },
  hygieneschulung: { stand: "2026-10-23", rolle: "hygiene", bestaetigt_am: "2026-10-23", nachweis: { art: "bericht", datum: "2026-10-23", rolle: "hygiene", umfang: "Freigabe der fünf Lebensmittel-Vorlagen (Eigenkontrollen, Hygieneplan Lebensmittelbetrieb, Allergenliste, Belehrung nach § 43 IfSG, Schulungsnachweis) im schriftlichen Bericht zur Nachkontrolle", aufbewahrung: "beim Gründer" }, bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (schriftlicher Bericht, beim Gründer)", pruefsumme: "b6ad9163b59b92ad8592b34889a2f93f5a765f37e2f64b3f12d17d1a7ab08d08", pruefsumme_alt: "1f3bb870b0decd354c4cee8a7ab39bc1465e926e11549c8028c222418549f50e" },
};

/** Zentrale Liste der fachlich durchgesehenen Vorlagen – mit den freigegebenen Teilsummen je Variantengruppe. */
export const VORLAGEN_GEPRUEFT: Readonly<Record<string, VorlagenFreigabe>> = Object.fromEntries(
  Object.entries(FREIGABEN).map(([id, f]) => [
    id,
    { ...f, teilsummen: FREIGEGEBENE_TEILSUMMEN[id], ...(f.weitere ? { weitere: f.weitere.map((w, i) => ({ ...w, teilsummen: FREIGEGEBENE_TEILSUMMEN[`${id}#${i + 1}`] })) } : {}) },
  ]),
);

/** Alle Freigaben einer Vorlage: die erste (am Eintrag) und die weiteren Fassungen; ohne Freigabe eine leere Liste. */
export function freigabenFuer(id: string, liste: Readonly<Record<string, VorlagenFreigabe>> = VORLAGEN_GEPRUEFT): Omit<VorlagenFreigabe, "weitere">[] {
  const f = liste[id];
  return f ? [f, ...(f.weitere ?? [])] : [];
}

/** Schriftlich bestätigt (Nachweis mit dem Tag der Bestätigung) und Stand nicht nach der Bestätigung (E-197, E-198)? */
export const freigabeBestaetigt = (f: Pick<VorlagenFreigabe, "stand" | "bestaetigt_am" | "nachweis">): boolean =>
  Boolean(f.bestaetigt_am && f.nachweis?.umfang && f.nachweis.datum === f.bestaetigt_am && f.stand.slice(0, 10) <= f.bestaetigt_am);

/**
 * Vermerk in der App: „Vorlage fachlich durchgesehen von einem Steuerberater (Stand 23.10.2026)“ – mit Rolle und
 * Einschränkung, bei offenen Stellen („fachlich zu prüfen“) „teilweise“. Ohne Rolle der frühere Wortlaut des Prüfers.
 */
export function geprueftVermerk(stand: string, f?: Pick<VorlagenFreigabe, "rolle" | "einschraenkung">, offen = 0): string {
  const datum = stand.slice(0, 10).split("-").reverse().join(".");
  if (!f?.rolle) return `Vorlagen fachlich durchgesehen (Stand ${datum})`;
  const von = `${PRUEF_ROLLEN[f.rolle]}${f.einschraenkung ? ` (${f.einschraenkung})` : ""}`;
  return offen > 0
    ? `Vorlage teilweise fachlich durchgesehen ${von} (Stand ${datum}) – mit „fachlich zu prüfen“ gekennzeichnete Angaben sind noch offen`
    : `Vorlage fachlich durchgesehen ${von} (Stand ${datum})`;
}

/** Fassung passt (ohne Angabe: immer). Ohne Daten (Info-Seite einer Vorlage mit Fassungen) gilt die Freigabe nicht. */
export function fassungPasst(f: Pick<VorlagenFreigabe, "fassung">, d?: Daten): boolean {
  if (!f.fassung) return true;
  return d !== undefined && d[f.fassung.feld] === f.fassung.wert;
}

/** JSON mit sortierten Schlüsseln; Funktionen und `undefined` entfallen (wie bei JSON.stringify). */
export function kanonisch(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x) ?? "null";
  if (Array.isArray(x)) return `[${x.map((e) => (e === undefined || typeof e === "function" ? "null" : kanonisch(e))).join(",")}]`;
  const o = x as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined && typeof o[k] !== "function")
    .sort()
    .map((k) => `${JSON.stringify(k)}:${kanonisch(o[k])}`)
    .join(",")}}`;
}

/** Sichtbarer Text eines HTML-Dokuments: ohne <style>/<script>, ohne Tags und Attribute, Leerraum zusammengefasst. */
export function sichtbarerText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function utf8(s: string): number[] {
  const b: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) b.push(c);
    else if (c < 0x800) b.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) b.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else b.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return b;
}

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

/** SHA-256 (FIPS 180-4) eines Textes in UTF-8, hexadezimal – ohne Node- oder Browser-APIs (läuft auch in der App). */
export function sha256(text: string): string {
  const b = utf8(text);
  const laenge = b.length * 8;
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  // Länge in Bit als 64-Bit-Zahl (Big Endian); Texte hier sind weit unter 2^32 Bit
  b.push(0, 0, 0, 0, (laenge >>> 24) & 255, (laenge >>> 16) & 255, (laenge >>> 8) & 255, laenge & 255);
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let i = 0; i < b.length; i += 64) {
    for (let t = 0; t < 16; t++) w[t] = (b[i + 4 * t]! << 24) | (b[i + 4 * t + 1]! << 16) | (b[i + 4 * t + 2]! << 8) | b[i + 4 * t + 3]!;
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(w[t - 15]!, 7) ^ rotr(w[t - 15]!, 18) ^ (w[t - 15]! >>> 3);
      const s1 = rotr(w[t - 2]!, 17) ^ rotr(w[t - 2]!, 19) ^ (w[t - 2]! >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) | 0;
    }
    let [a, bb, c, d, e, f, g, hh] = h as [number, number, number, number, number, number, number, number];
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t]! + w[t]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = bb;
      bb = a;
      a = (t1 + t2) | 0;
    }
    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + bb) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
    h[5] = (h[5]! + f) | 0;
    h[6] = (h[6]! + g) | 0;
    h[7] = (h[7]! + hh) | 0;
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
