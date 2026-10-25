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
 * E-196: Der Vermerk erscheint nur bei unterschriebener Freigabe (`unterschrieben_am` und `unterschrift` = Datei mit der
 * Unterschrift unter docs/pruefberichte; der Stand liegt nie danach). Grenzen der Durchsicht (`einschraenkung`) stehen im
 * Vermerk; enthält die Vorlage noch mit „fachlich zu prüfen“ gekennzeichnete Angaben, heißt er „teilweise durchgesehen“.
 * `pruefsumme_alt`: Prüfsumme nach der Rechnung vor E-196 (nur Startwerte und alle Vorschläge ohne Betrieb), zum Nachweis,
 * welche Fassung freigegeben war; `pruefsumme` ist dieselbe Fassung nach der heutigen Rechnung
 * (packages/fachlogik/werkzeuge/pruefsummen-abgleich.py).
 */
import type { Daten } from "./typen.js";

/** Rollen der Prüfer (wie in docs/freigabe-katalog/freigaben.yaml) und ihre Nennung im Vermerk. */
export const PRUEF_ROLLEN = {
  recht: "von einem Rechtsanwalt",
  steuern: "von einem Steuerberater",
  arbeitsschutz: "von einer Fachkraft für Arbeitssicherheit",
  hygiene: "von einem Lebensmittelfachbeauftragten",
} as const;
export type PruefRolle = keyof typeof PRUEF_ROLLEN;

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
  /** Tag der Unterschrift unter der Freigabe; ohne Unterschrift kein Vermerk */
  unterschrieben_am?: string | null;
  /** Datei mit der Unterschrift (docs/pruefberichte/…) */
  unterschrift?: string | null;
  /** Warum die Unterschrift fehlt (nur intern) */
  unterschrift_offen?: string;
  /** Grenze der Durchsicht laut Prüfer, z. B. „ohne arbeitsmedizinische Angaben“ – steht im Vermerk */
  einschraenkung?: string;
  /** Beleg der Freigabe (nur intern, nicht in der App) */
  bezug: string;
  /** SHA-256 (hex) aller gedruckten Ausprägungen zum Freigabezeitpunkt (Rechnung seit E-196) */
  pruefsumme: string;
  /** Prüfsumme derselben Fassung nach der Rechnung vor E-196 (nur zum Nachweis) */
  pruefsumme_alt?: string;
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
  /** Freigaben weiterer Fassungen derselben Vorlage (je eigene Fassung, Gruppen und Prüfsumme) */
  weitere?: readonly Omit<VorlagenFreigabe, "weitere">[];
}

/** Zentrale Liste der fachlich durchgesehenen Vorlagen. */
export const VORLAGEN_GEPRUEFT: Readonly<Record<string, VorlagenFreigabe>> = {
  haccp: { stand: "2026-10-23", rolle: "hygiene", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Prüfvermerk zur Nachkontrolle im Repository ohne Unterschrift (Unterschriftszeile leer)", bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (docs/pruefberichte/2026-10-23-lebensmittel-nachkontrolle-hygiene.md)", pruefsumme: "d865b088727ef038927876516f9fc4d44547a5067b98ba08cef6b3bea5d7a469", pruefsumme_alt: "bf971591cc3e7ab66b744bc12d6b6bfa75793eddb63eaea4b5b2bda5b423db0f" },
  hygieneplan: { stand: "2026-10-23", rolle: "hygiene", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Prüfvermerk zur Nachkontrolle im Repository ohne Unterschrift (Unterschriftszeile leer)", bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (docs/pruefberichte/2026-10-23-lebensmittel-nachkontrolle-hygiene.md)", pruefsumme: "efa3132a1835f59d93cf5555fd598a13e61146b8fad07cbabbbcc25015d8170c", pruefsumme_alt: "941cde2f8ec04fc0ad7eb4ddcb08dc047d36416cadefbff5788f667da7133dd8", fassung: { feld: "art", wert: "lebensmittel" }, gruppen: ["Gastronomie / Café", "Bäckerei", "Foodtruck / mobiler Verkauf"],
    // Rechtsanwalt Runde 4 (25.10.2026): Fassung Friseur/Kosmetik, Abgleich mit Rechtsgrundlagen und AWMF 055-004 (keine medizinische Begutachtung)
    weitere: [{ stand: "2026-10-25", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 25.10.2026 (2026-10-25-runde4-recht-mail.txt) nennt ein unterschriebenes Bestätigungsblatt als Anlage; es liegt nicht im Repository", einschraenkung: "Länderzusatz nur für Bayern geprüft", bezug: "Durchsicht Rechtsanwalt Runde 4 (docs/pruefberichte/2026-10-25-runde4-vorlagen-recht.xlsx)", pruefsumme: "e10ca1471d306e226a97312af89961b9c964cd961340aa1086c6c6e7504bee3f", pruefsumme_alt: "101632b4de7a47f0ce0919fd225eaa82f0e327ac47b79750e2e4274598893c83", fassung: { feld: "art", wert: "beauty" }, gruppen: ["Alle Beauty-Betriebe"] }] },
  allergene: { stand: "2026-10-23", rolle: "hygiene", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Prüfvermerk zur Nachkontrolle im Repository ohne Unterschrift (Unterschriftszeile leer)", bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (docs/pruefberichte/2026-10-23-lebensmittel-nachkontrolle-hygiene.md)", pruefsumme: "bedbe4d72779cf003ac9592e8cd69873550d68a4dffcd2563660dfc8b11af231", pruefsumme_alt: "8d6b015f6491872e3ca492ee2c1b9245890e84428cacecfe914beb90ea85144c" },
  ifsg_belehrung: { stand: "2026-10-23", rolle: "hygiene", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Prüfvermerk zur Nachkontrolle im Repository ohne Unterschrift (Unterschriftszeile leer)", bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (docs/pruefberichte/2026-10-23-lebensmittel-nachkontrolle-hygiene.md)", pruefsumme: "09a6b46168efd5243d8cca4789653f1615c0f7ebd440253a8f7079cbfcd53968", pruefsumme_alt: "2e35d889d03764df32a310aeacc999e2b6151e83afd38520da0c6c36d541ebec" },
  rechnung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: "2026-10-23", unterschrift: "docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-steuern-unterschrieben.jpg", bezug: "Durchsicht Steuerberater 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-steuern.xlsx)", pruefsumme: "291e2da869c3a53b40ad44d46458025f6b4faa91fbe7698efbc71d5ec93ea203", pruefsumme_alt: "8c2e773d415398dea57ab58922035136df2317e273cb2e82db72f0f86a6cda9e" },
  euer: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: "2026-10-23", unterschrift: "docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-steuern-unterschrieben.jpg", bezug: "Durchsicht Steuerberater 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-steuern.xlsx)", pruefsumme: "11961141abd0366b947042d2ab819174f4cb73ad58351309d64e7c0dd98d0643", pruefsumme_alt: "d669212fbf4abf8bfcff24ad65388185ca46f47d513de53cf93e5286010130d2" },
  verfahrensdokumentation: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: "2026-10-23", unterschrift: "docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-steuern-unterschrieben.jpg", bezug: "Durchsicht Steuerberater 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-steuern.xlsx)", pruefsumme: "900addfd4c97fcc989b095a73c7598a9742e067ec71f220eec34c7353d00ad33", pruefsumme_alt: "9d23a5d3f01831910bcec4e93e563d8503a3736b68a73deaaf09d14435fec48b" },
  kassenmeldung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: "2026-10-23", unterschrift: "docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-steuern-unterschrieben.jpg", bezug: "Durchsicht Steuerberater 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-steuern.xlsx)", pruefsumme: "7dc7ad6cb63617a9d49529ca1c44025918f8d73136636969c5e10b0fddb3e5d4", pruefsumme_alt: "d9ac127520bab87ef105e7da71c3c9cebbc7549993ffcb8740ef243dcaa0ee65" },
  lohnkonto: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: "2026-10-23", unterschrift: "docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-steuern-unterschrieben.jpg", bezug: "Durchsicht Steuerberater 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-steuern.xlsx)", pruefsumme: "c3c944218075522b0e08ffd330b67317e8f683054fe6c969852733a9f35a5d4d", pruefsumme_alt: "7210085d37a2e3866d4d15108172b76d61339ee16cce5d3169bd8702393f9428" },
  // gefaehrdungsbeurteilung (Prüfsumme ea0f369a…, Durchsicht Sifa 23.10.2026): Vermerk entfallen – Sifa hat in derselben
  // Durchsicht Bausteine der Vorlage korrigiert (B-054, B-200, B-218, B-226, B-231, B-233, B-236, B-238); erneut vorlegen
  unterweisung: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-arbeitsschutz-mail.txt) nennt ein unterschriebenes Bestätigungsblatt (Scan); es liegt nicht im Repository", bezug: "Durchsicht Sifa 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-arbeitsschutz.xlsx)", pruefsumme: "7893bbb50cc93604bfc84a47f569a1ac598c651c7d5fdad6f48d283e3fe1fd70", pruefsumme_alt: "73c536207bb588fba5cf502a2f83323e56c2fdd6c8b5c2a8b7ada82c4a91e8df" },
  gefahrstoffverzeichnis: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-arbeitsschutz-mail.txt) nennt ein unterschriebenes Bestätigungsblatt (Scan); es liegt nicht im Repository", bezug: "Durchsicht Sifa 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-arbeitsschutz.xlsx)", pruefsumme: "d586681a83ce4fabd22bdddb28870dc0924a0201f99f4f20502147b121490e41", pruefsumme_alt: "e1f81534e968125c84bbece65d414b87460da5c4748a820f243fb09d27e420a6" },
  betriebsanweisung_maschine: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-arbeitsschutz-mail.txt) nennt ein unterschriebenes Bestätigungsblatt (Scan); es liegt nicht im Repository", bezug: "Durchsicht Sifa 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-arbeitsschutz.xlsx)", pruefsumme: "8c0f63e6bfadbdb5360cdea005ec34f356afe398d66f9f5256afae3fba111e95", pruefsumme_alt: "f041a0b042843e6b29e05171e90e4669fefafde1ce37aeb4445f2dd58af1268e" },
  pruefprotokoll_elektro: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-arbeitsschutz-mail.txt) nennt ein unterschriebenes Bestätigungsblatt (Scan); es liegt nicht im Repository", einschraenkung: "ohne die elektrotechnischen Grenzwerte", bezug: "Durchsicht Sifa 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-arbeitsschutz.xlsx)", pruefsumme: "1115b5131c2ec484b722a82ec03fb4a1d2c659e682823fd865fcdc5fade471aa", pruefsumme_alt: "599f83aa64055153e81be987c85ffabc90b5aa02f16e293412b66782161c27c3" },
  datenschutz_dokumentation: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "bd9056f9f642bd9ef84e4d26d9f5a97ef4477f894d53d7f6e845c4ce6f45e51b", pruefsumme_alt: "524dfef7fee994656e460147adcac2fa4a2928dff076141e881ae90912499d28" },
  datenschutzerklaerung_website: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "8aea7f29b7cdf925185f8fa60bb6a8f602ca78d8fb39ff503980186b4e5d0642", pruefsumme_alt: "1b191e90779472b36e0ff8582d5dbb4a73bc40d394d9663d62291aa387db5768" },
  avv: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "97f919eb78c8e6c630c22395c4cadb097944711dd8b55d3b29e88c71a52ca2a1", pruefsumme_alt: "d4a5c48088053795e457ead7dea54f83e15d58a24134484a0c3938c029182811" },
  datenschutzinformation: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "07949652223e21e6922e6db96e31ef985e64bf49e0a5acb3b421eed2fb05213b", pruefsumme_alt: "5f243298c3669fefcf8e3f435e4b813f416a3ab04e1cba91deb88d75eef665c8" },
  datenpanne: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "51717940123afceb25b77800f5858dde2630800166913ae7db7fad8f02d0794b", pruefsumme_alt: "e907682096eabf02baa57c257de08ffde433d31c3ccaba58640119663ddec962" },
  video_hinweisschild: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "591895b30f52d629bd8cca464627a880084a5380896d723737366d176055c9fe", pruefsumme_alt: "9d1a06fbb30f998d3d4561780c495a56403a9bc96fca8c1242c584ce6fd48c75" },
  anamnese_einwilligung: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "d6eaf4d003bf5c5d2eb4475c35f2dadb0ab263014e8ceb96a260bc3e9fb60c36", pruefsumme_alt: "16515a705e3114af069241bdcc4d604055373688dfa43d056c33efd62247bcac" },
  arbeitszeitnachweis: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "f595ed34815d63154195198a0fe6dc60c005a68fa0db136bc25ba27cf2794c57", pruefsumme_alt: "62df8ed29e691294c9e9cb06471cef68b385714e7c79360c0b3cb7ccf1a31a39" },
  nachweis_arbeitsbedingungen: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "81f5c8b341589671980e96f2d3b18d1f3f39fd4d93107e7fecb9b9fa6be19de3", pruefsumme_alt: "c37a8792a9983556a308cf82a8f62e7af408d939f39a9bff617d8df72ae8b40b" },
  ki_kompetenz: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "6c9a0c6780066fe1857ab3e516241448b8f7141c8aa8b216ea00708fa2f1d41a", pruefsumme_alt: "2353e20c509afdfa922e841ecb2042d6bff6d9b40fa8317e86087bb1502218a4" },
  ausweis_hinweis: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "59e5262c024079df6e0f85f708c70358d3f35972413ebe8f1ed99cc83bd0bc6f", pruefsumme_alt: "235a5366934919f9c449f9223d23317360e3f502a9fb4ec8cbbb3d76b9028c27" },
  schluesselquittung: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "03d4fa91feb6ba1bd9c3184517d0a6cc093d65f57fb30cfa8f8b174c2c7d4790", pruefsumme_alt: "2399c8cf81e2fee1fc294ea8de923f6d9c5c4ae05c633a95c3ca78215cffac8f" },
  impressum: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "03f2ec23647d7dfa929314695ab541106330e25cc1e9fb66d4c7ddf68939360c", pruefsumme_alt: "9e79f203766117dd6c5e67a7d2aa51c100bb828689625dbfa15cf077cee9328f" },
  gewerbeanmeldung: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "521a82cc4731fe7066bba51a1202adb2d2527b6e7a10e50976feec8e3d5592bc", pruefsumme_alt: "8324d37f947181f884e29330c41f50c757b5486398ca864c3b2d11ccb610e110" },
  transparenzregister: { stand: "2026-10-23", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 23.10.2026 (2026-10-23-nachpruefung-vorlagen-recht-mail.txt) kündigt das unterschriebene Bestätigungsblatt an; es liegt nicht im Repository", bezug: "Durchsicht Rechtsanwalt 23.10.2026 (docs/pruefberichte/2026-10-23-vorlagen-recht.xlsx)", pruefsumme: "1b428773020198514770db5aff70b721c9712f8cbc3b441b83174e8a300be93d", pruefsumme_alt: "01473dc8aef549c590384275e82fbf08740a1da053f021709174242d73d84116" },
  ust_voranmeldung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "1658a19a843326bdbc5b94c924c46c1cb153e44cce588dcecf544b0014ab4c8a", pruefsumme_alt: "fa59f364368d123e367c2ba3c36eb00e0a68389d050ff36954d2ece6b50d66e4" },
  oss_meldung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "a2b746134812ec9b950ce3ef077733fd94b9bea21e2f6bbbeaf0cc607bc04124", pruefsumme_alt: "f136b58ddfcc5b60337fc499c573ec5b6de28ec0df50092e4b6338c452d1b7b3" },
  zm_meldung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "5dc5e94a8ec8fef2fe41d1686cc428054f2346eb3fea6034c4f0a3f6f8bbc678", pruefsumme_alt: "f7a989efdb3e0291b49ac247e3f199d63950bb8f73f3c6e18f67b8df829a5f71" },
  steuererklaerung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "5a34a0072e9baa43d0aa60bc7cb493bb13fd75f164e95b82140dcdafe378bc01", pruefsumme_alt: "77c6acbdf298c1eb68a3f2caeb8642bbe6c2c05240ac9803bc313b09144d4dce" },
  kassenbuch: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "ac5bf1039bb2c0d613a5ef1701b77072f85eb3a5753c492b26f4d30155aa5c44", pruefsumme_alt: "cda4e6656204d5352af7a559b5fe94f8f7a91b3e67a057dc4fc1321bc85d5f64" },
  aufbewahrung: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "1b052ee4df0de4ec8641dca2079a3c4fb5d446e7aee4e2c21e267a6566723957", pruefsumme_alt: "0582763257c6d3cf28329e42a2cd8bd03f0ed1b16a0a38c64e4244bffb9a6316" },
  sv_meldedaten: { stand: "2026-10-23", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Ergänzung der Bestätigung im Repository trägt keine Unterschrift", bezug: "Durchsicht Steuerberater Runde 3 (Ergänzung der Bestätigung, docs/pruefberichte/2026-10-24-ergaenzung-bestaetigung-steuern.pdf)", pruefsumme: "f60539f8f7c1157dd9fc9fc40eefc2cb0b033e50e6e212f40441c1418e3ebf32", pruefsumme_alt: "71ff4c2ff8209e9d1a6b23654ec65cd96df10370d78a54bad6f7e9660b040ba0" },
  // Rechtsanwalt 25.10.2026 (Mail Runde 5): nur GmbH, OHG und KG; Fassung mit § 106 Abs. 2 Nr. 3 HGB
  handelsregister: { stand: "2026-10-25", rolle: "recht", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Bestätigung per Mail ohne unterschriebenes Blatt", bezug: "Bestätigung Rechtsanwalt per Mail 25.10.2026 (docs/pruefberichte/2026-10-25-runde5-recht-mail.txt)", pruefsumme: "87a97718061fee3b5e380417cb85af7da914971b3b5eafff760960389a84f026", pruefsumme_alt: "e2cd7a14a6c1574814a6725b12104ff0234d3e4d02a52025ec83e3d8f9917338", rechtsformen: ["GmbH", "OHG", "KG"] },
  betriebsanweisung: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Das Blatt im Repository (2026-10-23-bestaetigung-vorlagen-arbeitsschutz-runde3.pdf) trägt keine Unterschrift", einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Durchsicht Sifa, Nachprüfung (Blatt vom 23.10.2026, docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-arbeitsschutz-runde3.pdf; Mail 25.10.2026)", pruefsumme: "d4b49e1661195baa7fe79e1607634e5bfbbf4626b89acd7b3392a22e2a20cf15", pruefsumme_alt: "f477c1d03df509acca567e7f562eace7d3a71b4da991d3c75d0b79e439c3eeec" },
  expositionsverzeichnis: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Das Blatt im Repository (2026-10-23-bestaetigung-vorlagen-arbeitsschutz-runde3.pdf) trägt keine Unterschrift", einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Durchsicht Sifa, Nachprüfung (Blatt vom 23.10.2026, docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-arbeitsschutz-runde3.pdf; Mail 25.10.2026)", pruefsumme: "eb59ca0a4ae968fdfa7e7e93632a4c71b0804f0133663aa2b338ab09df4e6878", pruefsumme_alt: "32867a852a9971b1cde4b4ce6582ec39db483c5f62027d23f7b76666ff629aba" },
  hautschutzplan: { stand: "2026-10-23", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Das Blatt im Repository (2026-10-23-bestaetigung-vorlagen-arbeitsschutz-runde3.pdf) trägt keine Unterschrift", einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Durchsicht Sifa, Nachprüfung (Blatt vom 23.10.2026, docs/pruefberichte/2026-10-23-bestaetigung-vorlagen-arbeitsschutz-runde3.pdf; Mail 25.10.2026)", pruefsumme: "ff21254c0b116c6bcc45a3396b0bdbb7d97bc374e786c671096df879aea38dd0", pruefsumme_alt: "ea45c72ec6fc7ca7918dfcfa40765d0ce1795626d25896389f1136245a943316" },
  gefaehrdungsbeurteilung: { stand: "2026-10-25", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 25.10.2026 nennt einen unterschriebenen Nachtrag (Scan); er liegt nicht im Repository", einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Nachtrag Sifa 25.10.2026 (docs/pruefberichte/2026-10-25-arbeitsschutz-abschluss-mail.txt; B-022, B-105, B-276, B-283 ausgenommen, Abgleich Rechtsanwalt)", pruefsumme: "3c6d3887dc88f380dcf9d4a2882671f002dd41a3a3fece51db8e670de5e598f8", pruefsumme_alt: "1063d59082d4887bbaed62d7f126a2c11e89b0aa5320df61cba0cb7e3bd78b2d" },
  betriebsanweisung_biostoffe: { stand: "2026-10-25", rolle: "arbeitsschutz", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Mail 25.10.2026 nennt einen unterschriebenen Nachtrag (Scan); er liegt nicht im Repository", einschraenkung: "ohne arbeitsmedizinische Angaben", bezug: "Nachtrag Sifa 25.10.2026 (docs/pruefberichte/2026-10-25-arbeitsschutz-abschluss-mail.txt; B-022, B-105, B-276, B-283 ausgenommen, Abgleich Rechtsanwalt)", pruefsumme: "4a810a9df8df5f00df2d7abed1e39932777c207e76135b088e7089e20fddc4bd", pruefsumme_alt: "70fe591f5a3e7e207540c518d96bec16896c92cddd9979ce34abf6f92a636d75" },
  bilanz_guv: { stand: "2026-10-25", rolle: "steuern", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Die Mail vom 25.10.2026 nennt den Nachtrag „unterschrieben“; die angehängte Datei (und 2026-10-25-nachtrag-bilanz-steuern.pdf) trägt keine Unterschrift", bezug: "Nachtrag Steuerberater 25.10.2026 (docs/pruefberichte/2026-10-25-steuern-bilanz-freigabe.eml)", pruefsumme: "b981291ce70ee0847bfb1179c350806225ca61cd08eb0e4132ea5fa885489439", pruefsumme_alt: "5d2246459fe66ccea599cbc1b7cc0845f4b4b35af164b91b617e91cfd8432986" },
  hygieneschulung: { stand: "2026-10-23", rolle: "hygiene", unterschrieben_am: null, unterschrift: null, unterschrift_offen: "Prüfvermerk zur Nachkontrolle im Repository ohne Unterschrift (Unterschriftszeile leer)", bezug: "Nachkontrolle Lebensmittelfachbeauftragter 23.10.2026 (docs/pruefberichte/2026-10-23-lebensmittel-nachkontrolle-hygiene.md)", pruefsumme: "80bcfa6fa500f5632d95f20dc1972aeb7a910f54ce81101e77640e5e5b701dbb", pruefsumme_alt: "1f3bb870b0decd354c4cee8a7ab39bc1465e926e11549c8028c222418549f50e" },
};

/** Alle Freigaben einer Vorlage: die erste (am Eintrag) und die weiteren Fassungen; ohne Freigabe eine leere Liste. */
export function freigabenFuer(id: string, liste: Readonly<Record<string, VorlagenFreigabe>> = VORLAGEN_GEPRUEFT): Omit<VorlagenFreigabe, "weitere">[] {
  const f = liste[id];
  return f ? [f, ...(f.weitere ?? [])] : [];
}

/** Unterschrieben und Stand nicht nach der Unterschrift (E-196)? */
export const freigabeUnterschrieben = (f: Pick<VorlagenFreigabe, "stand" | "unterschrieben_am" | "unterschrift">): boolean =>
  Boolean(f.unterschrieben_am && f.unterschrift && f.stand.slice(0, 10) <= f.unterschrieben_am);

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
