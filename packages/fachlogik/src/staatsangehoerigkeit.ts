/**
 * Staatsangehörigkeit (E-238): Auswahl statt Freitext bei Beschäftigten und ein Erkenner für ältere Freitext-Angaben.
 *
 * Was daran hängt, steht im freigegebenen Katalog (personal.aufenthaltstitel, D.38): „Wer nicht die Staatsangehörigkeit
 * eines EU- oder EWR-Staats oder der Schweiz hat, darf nur arbeiten, wenn der Aufenthaltstitel das erlaubt“
 * (§ 4a Abs. 5 AufenthG). Daraus folgt ohne weitere Annahme: Wer (auch) eine Staatsangehörigkeit der EU, des EWR oder
 * der Schweiz hat, fällt nicht darunter – bei mehreren Staatsangehörigkeiten genügt eine davon. Wer staatenlos ist, hat
 * keine solche Staatsangehörigkeit und fällt darunter.
 *
 * Der Erkenner ordnet nur zu, was er sicher kennt (Adjektive in allen Endungen, Länder- und Personenbezeichnungen,
 * ISO-Codes allein, englische Bezeichnungen). Alles andere – Tippfehler, „ungeklärt“, Verneinungen – ist „unbekannt“:
 * die App behandelt die Pflicht dann als „zu prüfen“ und bittet, aus der Liste zu wählen. Nie gilt etwas still als
 * Drittstaat oder still als EU.
 */

/** EU-Staat, EWR-Staat (Island, Liechtenstein, Norwegen) oder die Schweiz. */
export type FreizuegigkeitGruppe = "eu" | "ewr" | "ch";

interface FreierStaat {
  code: string;
  /** Alpha-3-Code (und abweichende Codes wie „EL“ für Griechenland) */
  codes: string[];
  name: string;
  gruppe: FreizuegigkeitGruppe;
  /** Adjektivstämme – erkannt mit jeder Endung (-e, -er, -es, -en, -em) */
  adjektive: string[];
  /** Länder- und Personenbezeichnungen, deutsch und englisch (Personen auch mit -in, -innen, -n) */
  woerter: string[];
}

const S = (code: string, codes: string[], name: string, gruppe: FreizuegigkeitGruppe, adjektive: string[], woerter: string[]): FreierStaat => ({ code, codes, name, gruppe, adjektive, woerter });

/** Staaten mit Freizügigkeit – Reihenfolge: Deutschland, dann nach Namen. */
export const FREIE_STAATEN: readonly FreierStaat[] = [
  S("DE", ["DEU", "D", "BRD"], "Deutschland", "eu", ["deutsch"], ["deutschland", "bundesrepublik deutschland", "germany", "german", "germans"]),
  S("BE", ["BEL"], "Belgien", "eu", ["belgisch"], ["belgien", "belgier", "belgium", "belgian"]),
  S("BG", ["BGR"], "Bulgarien", "eu", ["bulgarisch"], ["bulgarien", "bulgare", "bulgarin", "bulgaria", "bulgarian"]),
  S("DK", ["DNK"], "Dänemark", "eu", ["dänisch"], ["dänemark", "däne", "dänin", "denmark", "danish", "dane"]),
  S("EE", ["EST"], "Estland", "eu", ["estnisch", "estländisch"], ["estland", "este", "estin", "estonia", "estonian"]),
  S("FI", ["FIN"], "Finnland", "eu", ["finnisch", "finnländisch"], ["finnland", "finne", "finnin", "finland", "finnish", "finn"]),
  S("FR", ["FRA"], "Frankreich", "eu", ["französisch"], ["frankreich", "franzose", "französin", "france", "french"]),
  S("GR", ["GRC", "EL"], "Griechenland", "eu", ["griechisch"], ["griechenland", "grieche", "griechin", "greece", "greek"]),
  S("IE", ["IRL"], "Irland", "eu", ["irisch"], ["irland", "ire", "irin", "ireland", "irish"]),
  S("IT", ["ITA"], "Italien", "eu", ["italienisch"], ["italien", "italiener", "italy", "italian"]),
  S("HR", ["HRV"], "Kroatien", "eu", ["kroatisch"], ["kroatien", "kroate", "kroatin", "croatia", "croatian"]),
  S("LV", ["LVA"], "Lettland", "eu", ["lettisch", "lettländisch"], ["lettland", "lette", "lettin", "latvia", "latvian"]),
  S("LT", ["LTU"], "Litauen", "eu", ["litauisch"], ["litauen", "litauer", "lithuania", "lithuanian"]),
  S("LU", ["LUX"], "Luxemburg", "eu", ["luxemburgisch"], ["luxemburg", "luxemburger", "luxembourg", "luxembourgish", "luxembourger"]),
  S("MT", ["MLT"], "Malta", "eu", ["maltesisch"], ["malta", "malteser", "maltese"]),
  S("NL", ["NLD"], "Niederlande", "eu", ["niederländisch", "holländisch"], ["niederlande", "holland", "niederländer", "holländer", "netherlands", "dutch"]),
  S("AT", ["AUT"], "Österreich", "eu", ["österreichisch"], ["österreich", "österreicher", "austria", "austrian"]),
  S("PL", ["POL"], "Polen", "eu", ["polnisch"], ["polen", "pole", "polin", "poland", "polish"]),
  S("PT", ["PRT"], "Portugal", "eu", ["portugiesisch"], ["portugal", "portugiese", "portugiesin", "portuguese"]),
  S("RO", ["ROU"], "Rumänien", "eu", ["rumänisch"], ["rumänien", "rumäne", "rumänin", "romania", "romanian"]),
  S("SE", ["SWE"], "Schweden", "eu", ["schwedisch"], ["schweden", "schwede", "schwedin", "sweden", "swedish", "swede"]),
  S("SK", ["SVK"], "Slowakei", "eu", ["slowakisch"], ["slowakei", "slowake", "slowakin", "slovakia", "slovak", "slovakian"]),
  S("SI", ["SVN"], "Slowenien", "eu", ["slowenisch"], ["slowenien", "slowene", "slowenin", "slovenia", "slovenian", "slovene"]),
  S("ES", ["ESP"], "Spanien", "eu", ["spanisch"], ["spanien", "spanier", "spain", "spanish", "spaniard"]),
  S("CZ", ["CZE"], "Tschechien", "eu", ["tschechisch"], ["tschechien", "tscheche", "tschechin", "czechia", "czech"]),
  S("HU", ["HUN"], "Ungarn", "eu", ["ungarisch"], ["ungarn", "ungar", "hungary", "hungarian"]),
  S("CY", ["CYP"], "Zypern", "eu", ["zyprisch", "zypriotisch"], ["zypern", "zypriot", "zypriote", "cyprus", "cypriot"]),
  S("IS", ["ISL"], "Island", "ewr", ["isländisch"], ["island", "isländer", "iceland", "icelandic", "icelander"]),
  S("LI", ["LIE"], "Liechtenstein", "ewr", ["liechtensteinisch"], ["liechtenstein", "liechtensteiner"]),
  S("NO", ["NOR"], "Norwegen", "ewr", ["norwegisch"], ["norwegen", "norweger", "norway", "norwegian"]),
  S("CH", ["CHE"], "Schweiz", "ch", ["schweizerisch", "schweizer"], ["schweiz", "switzerland", "swiss"]),
];

/**
 * Staaten außerhalb von EU, EWR und Schweiz, die der Erkenner sicher kennt (Adjektivstämme, Länder, Personen, englisch).
 * Nur zur Einordnung „außerhalb“ – gedruckt wird immer der eingetragene Text. Was hier fehlt, ist „unbekannt“, nie „EU“.
 */
const DRITT_ADJEKTIVE = [
  "türkisch", "ukrainisch", "russisch", "syrisch", "afghanisch", "irakisch", "iranisch", "persisch", "kosovarisch", "kosovanisch", "serbisch", "bosnisch",
  "herzegowinisch", "albanisch", "mazedonisch", "nordmazedonisch", "montenegrinisch", "moldauisch", "moldawisch", "belarussisch", "weißrussisch",
  "georgisch", "armenisch", "aserbaidschanisch", "kasachisch", "usbekisch", "kirgisisch", "tadschikisch", "turkmenisch", "chinesisch", "indisch",
  "pakistanisch", "bangladeschisch", "srilankisch", "nepalesisch", "vietnamesisch", "thailändisch", "philippinisch", "indonesisch", "malaysisch",
  "japanisch", "koreanisch", "südkoreanisch", "nordkoreanisch", "mongolisch", "amerikanisch", "kanadisch", "mexikanisch", "brasilianisch",
  "argentinisch", "kolumbianisch", "venezolanisch", "peruanisch", "chilenisch", "ecuadorianisch", "kubanisch", "dominikanisch", "bolivianisch",
  "paraguayisch", "uruguayisch", "australisch", "neuseeländisch", "britisch", "englisch", "schottisch", "walisisch", "marokkanisch", "algerisch",
  "tunesisch", "libysch", "ägyptisch", "sudanesisch", "eritreisch", "äthiopisch", "somalisch", "kenianisch", "nigerianisch", "ghanaisch",
  "kamerunisch", "senegalesisch", "guineisch", "ivorisch", "kongolesisch", "angolanisch", "südafrikanisch", "togoisch", "togolesisch", "gambisch",
  "malisch", "libanesisch", "jordanisch", "israelisch", "palästinensisch", "saudisch", "saudi-arabisch", "jemenitisch", "emiratisch", "katarisch",
  "kuwaitisch", "omanisch", "bahrainisch", "arabisch", "andorranisch", "monegassisch", "sanmarinesisch", "vatikanisch", "kurdisch", "tschetschenisch",
];
const DRITT_WOERTER = [
  "türkei", "türke", "türkin", "turkey", "türkiye", "turkish", "turk", "ukraine", "ukrainer", "ukrainian", "russland", "russe", "russin", "russia", "russian",
  "syrien", "syrer", "syria", "syrian", "afghanistan", "afghane", "afghanin", "afghan", "irak", "iraker", "iraq", "iraqi", "iran", "iraner", "iranian",
  "kosovo", "kosovare", "kosovarin", "kosovar", "kosovan", "serbien", "serbe", "serbin", "serbia", "serbian", "bosnien", "herzegowina", "bosnier", "bosnia",
  "bosnian", "albanien", "albaner", "albania", "albanian", "mazedonien", "nordmazedonien", "mazedonier", "macedonia", "macedonian", "montenegro",
  "montenegriner", "montenegrin", "moldau", "moldawien", "moldova", "moldovan", "belarus", "weißrussland", "belarusian", "georgien", "georgier",
  "georgian", "armenien", "armenier", "armenia", "armenian", "aserbaidschan", "azerbaijan", "azerbaijani", "kasachstan", "kazakhstan", "kazakh",
  "usbekistan", "uzbekistan", "uzbek", "kirgisistan", "kirgistan", "tadschikistan", "turkmenistan", "china", "chinese", "chinesin", "indien", "inder",
  "india", "indian", "pakistan", "pakistaner", "pakistani", "bangladesch", "bangladesh", "bangladeshi", "sri", "lanka", "srilanka", "nepal", "nepali",
  "vietnam", "vietnamese", "vietnamesin", "thailand", "thai", "philippinen", "philippines", "filipino", "filipina", "indonesien", "indonesia",
  "indonesian", "malaysia", "malaysian", "japan", "japaner", "japanese", "korea", "südkorea", "nordkorea", "koreaner", "korean", "mongolei",
  "usa", "vereinigte", "staaten", "amerika", "amerikaner", "american", "america", "united", "states", "kanada", "kanadier", "canada", "canadian",
  "mexiko", "mexikaner", "mexico", "mexican", "brasilien", "brasilianer", "brazil", "brazilian", "argentinien", "argentinier", "argentina", "argentinian",
  "kolumbien", "kolumbianer", "colombia", "colombian", "venezuela", "venezolaner", "venezuelan", "peru", "peruaner", "peruvian", "chile", "chilene",
  "chilean", "ecuador", "ecuadorian", "kuba", "kubaner", "cuba", "cuban", "bolivien", "bolivia", "paraguay", "uruguay", "australien", "australier",
  "australia", "australian", "neuseeland", "großbritannien", "england", "schottland", "wales", "vereinigtes", "königreich", "brite", "britin",
  "engländer", "schotte", "british", "english", "scottish", "welsh", "kingdom", "britain", "uk", "marokko", "marokkaner", "morocco", "moroccan",
  "algerien", "algerier", "algeria", "algerian", "tunesien", "tunesier", "tunisia", "tunisian", "libyen", "libyer", "libya", "libyan", "ägypten",
  "ägypter", "egypt", "egyptian", "sudan", "sudanese", "eritrea", "eritreer", "eritrean", "äthiopien", "äthiopier", "ethiopia", "ethiopian", "somalia",
  "somalier", "somali", "kenia", "kenianer", "kenya", "kenyan", "nigeria", "nigerianer", "nigerian", "ghana", "ghanaer", "ghanaian", "kamerun",
  "kameruner", "cameroon", "cameroonian", "senegal", "senegalese", "guinea", "elfenbeinküste", "kongo", "kongolese", "congo", "congolese", "angola",
  "angolaner", "südafrika", "südafrikaner", "togo", "togoer", "gambia", "gambier", "mali", "malier", "libanon", "libanese", "lebanon", "lebanese",
  "jordanien", "jordanier", "jordan", "jordanian", "israel", "israeli", "palästina", "palästinenser", "palestine", "palestinian", "saudi", "arabien",
  "arabia", "jemen", "jemenit", "yemen", "yemeni", "emirate", "katar", "qatar", "kuwait", "oman", "bahrain", "andorra", "monaco", "monegasse",
  "marino", "vatikan", "vatikanstadt", "tschetschene",
];
/** ISO-Codes (Alpha-2/3) von Staaten außerhalb – nur erkannt, wenn der Code allein steht (z. B. „TR“). */
const DRITT_CODES = [
  "TR", "TUR", "UA", "UKR", "RU", "RUS", "SY", "SYR", "AF", "AFG", "IQ", "IRQ", "IR", "IRN", "XK", "RS", "SRB", "BA", "BIH", "AL", "ALB", "MK", "MKD",
  "ME", "MNE", "MD", "MDA", "BY", "BLR", "GE", "GEO", "AM", "ARM", "AZ", "AZE", "KZ", "KAZ", "UZ", "UZB", "KG", "TJ", "TM", "CN", "CHN", "IN", "IND",
  "PK", "PAK", "BD", "BGD", "LK", "LKA", "NP", "VN", "VNM", "TH", "THA", "PH", "PHL", "ID", "IDN", "MY", "MYS", "JP", "JPN", "KR", "KOR", "KP", "MN",
  "US", "USA", "CA", "CAN", "MX", "MEX", "BR", "BRA", "AR", "ARG", "CO", "COL", "VE", "VEN", "PE", "PER", "CL", "CHL", "EC", "ECU", "CU", "CUB", "DO",
  "BO", "PY", "UY", "AU", "AUS", "NZ", "GB", "GBR", "UK", "MA", "MAR", "DZ", "DZA", "TN", "TUN", "LY", "LBY", "EG", "EGY", "SD", "ER", "ERI", "ET",
  "ETH", "SO", "SOM", "KE", "KEN", "NG", "NGA", "GH", "GHA", "CM", "CMR", "SN", "SEN", "GN", "CI", "CD", "CG", "AO", "ZA", "TG", "GM", "ML", "LB",
  "LBN", "JO", "JOR", "IL", "ISR", "PS", "SA", "SAU", "YE", "AE", "QA", "KW", "OM", "BH", "AD", "MC", "SM", "VA",
];

/** Ohne eigene Bedeutung („deutsche Staatsangehörigkeit“, „Staatsbürger der Republik Polen“). */
const FUELLWOERTER = [
  "staatsangehörigkeit", "staatsangehörigkeiten", "staatsangehörige", "staatsangehöriger", "staatsangehöriges", "staatsbürger", "staatsbürgerin",
  "staatsbürgerschaft", "nationalität", "nationalitaet", "nationality", "nationalities", "citizen", "citizenship", "bürger", "bürgerin", "republik",
  "republic", "bundesrepublik", "volksrepublik", "föderation", "federation", "of", "the", "and", "die", "der", "des", "das", "von", "aus", "dem", "staatsangeh",
  "pass", "reisepass", "passport", "doppelte", "doppelt", "doppelstaatler", "doppelstaatlerin", "dual", "zwei", "beide", "mehrere", "sowie", "auch",
  "nationale", "national", "herkunft", "abstammung",
];
/** Verneinung, Vergangenes, Unsicheres – dann ordnet der Erkenner nichts zu („nicht deutsch“, „früher polnisch“, „ungeklärt“). */
const UNSICHER = [
  "nicht", "kein", "keine", "keiner", "ohne", "ehemals", "ehemalig", "ehemalige", "ehemaliger", "früher", "ex", "bis", "beantragt", "beantragen",
  "unbekannt", "unbekannte", "ungeklärt", "ungeklärte", "unklar", "geklärt", "klären", "noch", "wird", "eingebürgert", "einbürgerung", "evtl", "eventuell",
  "vielleicht", "vermutlich", "wahrscheinlich", "unknown", "unclear", "not", "former", "pending", "fragen", "prüfen", "offen",
];
/** Kategorie statt Staat („EU-Bürger“): Freizügigkeit sicher, Staat offen. */
const KATEGORIE_FREI = ["eu", "ewr", "eea", "eu-bürger", "eu-bürgerin", "eu-staat", "eu-staatsangehörig", "eu-ausland", "unionsbürger", "unionsbürgerin"];
const STAATENLOS = ["staatenlos", "staatenlose", "staatenloser", "staatenloses", "stateless"];

/** Kleinbuchstaben, Umlaute ausgeschrieben, ß → ss, übrige Akzente weg. */
export function normStaatText(t: string): string {
  return t
    .toLocaleLowerCase("de")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const ENDUNGEN = ["", "e", "er", "es", "en", "em"];
const PERSONEN_ENDUNGEN = ["", "in", "innen", "n", "en", "s"];

type Treffer = { art: "frei"; code: string } | { art: "dritt" } | { art: "kategorie" } | { art: "staatenlos" };

const WOERTERBUCH = new Map<string, Treffer>();
const CODES = new Map<string, Treffer>();
const setze = (wort: string, t: Treffer) => {
  const k = normStaatText(wort);
  if (!WOERTERBUCH.has(k)) WOERTERBUCH.set(k, t);
};
for (const s of FREIE_STAATEN) {
  const t: Treffer = { art: "frei", code: s.code };
  for (const a of s.adjektive) for (const e of ENDUNGEN) setze(a + e, t);
  for (const w of s.woerter) for (const e of w.includes(" ") ? [""] : PERSONEN_ENDUNGEN) setze(w + e, t);
  for (const c of [s.code, ...s.codes]) CODES.set(normStaatText(c), t);
}
for (const a of DRITT_ADJEKTIVE) for (const e of ENDUNGEN) setze(a + e, { art: "dritt" });
for (const w of DRITT_WOERTER) for (const e of PERSONEN_ENDUNGEN) setze(w + e, { art: "dritt" });
for (const c of DRITT_CODES) if (!CODES.has(normStaatText(c))) CODES.set(normStaatText(c), { art: "dritt" });
for (const w of KATEGORIE_FREI) setze(w, { art: "kategorie" });
for (const w of STAATENLOS) setze(w, { art: "staatenlos" });
const FUELL = new Set(FUELLWOERTER.map(normStaatText));
const UNSICHER_SET = new Set(UNSICHER.map(normStaatText));
/** Mehrwortige Namen, die als Ganzes einem Staat gehören (vor dem Zerlegen in Wörter ersetzt). */
const MEHRWORT: [RegExp, string][] = [
  [/\bbundesrepublik deutschland\b/g, "deutschland"],
  [/\bsri[\s-]+lanka(\w*)\b/g, "srilanka"],
  [/\bsaudi[\s-]+arab(\w*)\b/g, "saudisch"],
  [/\bus[\s-]+amerikan(\w*)\b/g, "amerikanisch"],
];

/** Was der Erkenner aus einem Text herausliest. */
export interface StaatsangehoerigkeitErkannt {
  /**
   * `frei`: (auch) eine Staatsangehörigkeit der EU, des EWR oder der Schweiz – kein Aufenthaltstitel nötig (Katalog D.38);
   * `drittstaat`: sicher nur Staatsangehörigkeiten außerhalb bzw. staatenlos; `unbekannt`: nicht sicher zuzuordnen;
   * `leer`: nichts eingetragen.
   */
  art: "frei" | "drittstaat" | "unbekannt" | "leer";
  /** erkannte Staaten der EU, des EWR und die Schweiz (Codes, z. B. „DE“) */
  staaten: string[];
  /** mindestens eine sicher erkannte Staatsangehörigkeit außerhalb */
  drittstaat: boolean;
  staatenlos: boolean;
  /** Wörter, die der Erkenner nicht kennt (für den Hinweis in der App) */
  unbekannt: string[];
  /** bei Tippfehlern: wahrscheinlich gemeinter Staat der EU, des EWR oder die Schweiz (Code) – nur als Vorschlag */
  vorschlag?: string;
}

/** Damerau-Levenshtein-Abstand (eingeschränkt) – für den Vorschlag bei Tippfehlern („deustch“ → „deutsch“). */
function abstand(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const k = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + k);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  return d[a.length]![b.length]!;
}

function vorschlagFuer(wort: string): string | undefined {
  if (wort.length < 4) return undefined;
  const grenze = wort.length >= 7 ? 2 : 1;
  let best: { code: string; d: number } | undefined;
  let mehrdeutig = false;
  for (const [w, t] of WOERTERBUCH) {
    if (Math.abs(w.length - wort.length) > grenze) continue;
    const d = abstand(wort, w);
    if (d > grenze) continue;
    const code = t.art === "frei" ? t.code : "andere";
    if (!best || d < best.d) {
      best = { code, d };
      mehrdeutig = false;
    } else if (d === best.d && code !== best.code) mehrdeutig = true;
  }
  return best && !mehrdeutig && best.code !== "andere" ? best.code : undefined;
}

/**
 * Staatsangehörigkeit aus einem Freitext (ältere Angaben, Unterlagen wie Personalfragebogen oder Lohnkonto). Mehrere
 * Angaben („deutsch/türkisch“, „deutsch und polnisch“): eine aus EU, EWR oder Schweiz genügt für `frei`.
 */
export function staatsangehoerigkeitErkennen(text: string | null | undefined): StaatsangehoerigkeitErkannt {
  const roh = (text ?? "").trim();
  const aus: StaatsangehoerigkeitErkannt = { art: "leer", staaten: [], drittstaat: false, staatenlos: false, unbekannt: [] };
  if (!roh) return aus;
  let n = normStaatText(roh);
  for (const [re, ersatz] of MEHRWORT) n = n.replace(re, ersatz);
  let unsicher = /\?/.test(n);
  let kategorie = false;
  // Teile: Komma, Schrägstrich, Semikolon, Plus, Und-Zeichen, Klammern, „und“/„oder“ – dann Wörter (auch Bindestrich)
  const teile = n.split(/[,;/+&|()[\]{}]|\bund\b|\bu\.|\bsowie\b|\band\b|\boder\b|\bor\b/).map((t) => t.trim()).filter(Boolean);
  if (/\boder\b|\bor\b/.test(n)) unsicher = true; // „deutsch oder polnisch“ – welche?
  for (const teil of teile) {
    const woerter = teil.split(/[\s\-–—_:."'„“”‚‘’*]+/).filter(Boolean);
    // ISO-Code allein („DE“, „AT“, „TR“, „D“)
    if (woerter.length === 1 && woerter[0]!.length <= 3 && CODES.has(woerter[0]!)) {
      const t = CODES.get(woerter[0]!)!;
      if (t.art === "frei") aus.staaten.push(t.code);
      else aus.drittstaat = true;
      continue;
    }
    for (const w of woerter) {
      if (FUELL.has(w)) continue;
      if (UNSICHER_SET.has(w)) {
        unsicher = true;
        continue;
      }
      const t = WOERTERBUCH.get(w);
      if (t?.art === "frei") aus.staaten.push(t.code);
      else if (t?.art === "dritt") aus.drittstaat = true;
      else if (t?.art === "staatenlos") aus.staatenlos = true;
      else if (t?.art === "kategorie") kategorie = true;
      // Codes mitten im Text („deutsch (DE)“, „US-amerikanisch“) zählen nicht – ein „in“ oder „es“ ist dort meist ein Wort
      else if (w.length <= 3 && CODES.has(w)) continue;
      else aus.unbekannt.push(w);
    }
  }
  aus.staaten = [...new Set(aus.staaten)];
  if (unsicher) aus.art = "unbekannt";
  else if (aus.staaten.length || kategorie) aus.art = "frei";
  else if (aus.unbekannt.length) aus.art = "unbekannt";
  else if (aus.drittstaat || aus.staatenlos) aus.art = "drittstaat";
  else aus.art = "unbekannt";
  if (aus.art === "unbekannt") {
    const v = aus.unbekannt.map(vorschlagFuer).find(Boolean);
    if (v) aus.vorschlag = v;
  }
  return aus;
}

/** Besondere Werte der Auswahl neben den Staaten. */
export const STAAT_MEHRERE_FREI = "mehrere_frei";
export const STAAT_ANDERE = "andere";
export const STAAT_STAATENLOS = "staatenlos";
export const STAAT_UNGEKLAERT = "ungeklaert";

export const STAAT_NAMEN: Readonly<Record<string, string>> = Object.fromEntries(FREIE_STAATEN.map((s) => [s.code, s.name]));

/** Auswahl im Feld „Staatsangehörigkeit“ einer beschäftigten Person: Deutschland, EU, EWR, Schweiz, dann die übrigen Fälle. */
export const STAAT_OPTIONEN: readonly { wert: string; text: string }[] = [
  ...FREIE_STAATEN.map((s) => ({ wert: s.code, text: s.gruppe === "ewr" ? `${s.name} (EWR)` : s.name })),
  { wert: STAAT_MEHRERE_FREI, text: "Mehrere – darunter EU, EWR oder Schweiz" },
  { wert: STAAT_ANDERE, text: "Anderer Staat (außerhalb von EU, EWR und Schweiz)" },
  { wert: STAAT_STAATENLOS, text: "Staatenlos" },
  { wert: STAAT_UNGEKLAERT, text: "Ungeklärt" },
];
const GUELTIG = new Set(STAAT_OPTIONEN.map((o) => o.wert));

/** Angaben einer Person, soweit es um die Staatsangehörigkeit geht. */
export interface StaatAngaben {
  /** Wert der Auswahl (E-238) */
  staat?: string | null;
  /** Text für die Unterlagen – bei älteren Daten der einzige Eintrag */
  staatsangehoerigkeit?: string | null;
  /** weitere Angaben der Person (gespeicherte Personen sind offene Datensätze) */
  [feld: string]: unknown;
}

/**
 * Auswahl einer Person: die gespeicherte, sonst die aus dem Text sicher erkannte (ein Staat → dieser, mehrere mit einem
 * freien → „mehrere“, nur außerhalb → „anderer Staat“ bzw. „staatenlos“); null, wenn nichts sicher passt.
 */
export function staatAuswahl(p: StaatAngaben): string | null {
  if (typeof p.staat === "string" && GUELTIG.has(p.staat)) return p.staat;
  const e = staatsangehoerigkeitErkennen(p.staatsangehoerigkeit);
  if (e.art === "frei") {
    if (e.staaten.length === 1 && !e.drittstaat && !e.staatenlos) return e.staaten[0]!;
    return e.staaten.length ? STAAT_MEHRERE_FREI : null;
  }
  if (e.art === "drittstaat") return e.drittstaat ? STAAT_ANDERE : STAAT_STAATENLOS;
  return null;
}

/**
 * Einordnung für die Pflichten: `frei` (EU/EWR/Schweiz, auch als eine von mehreren), `drittstaat` (außerhalb oder
 * staatenlos – Katalog D.38 gilt), `unbekannt` (zu prüfen – nie still Drittstaat, nie still ausgeblendet), `leer`.
 */
export function staatsangehoerigkeitArt(p: StaatAngaben): StaatsangehoerigkeitErkannt["art"] {
  if (typeof p.staat === "string" && GUELTIG.has(p.staat)) {
    if (p.staat === STAAT_ANDERE || p.staat === STAAT_STAATENLOS) return "drittstaat";
    if (p.staat === STAAT_UNGEKLAERT) return "unbekannt";
    return "frei";
  }
  return staatsangehoerigkeitErkennen(p.staatsangehoerigkeit).art;
}

/**
 * Text für die Unterlagen nach einer Wahl: Passt der bisherige Text schon zur Wahl (z. B. „deutsch“ bei Deutschland),
 * bleibt er – gedruckt wird dann genau dasselbe wie vorher. Sonst der Name des Staats bzw. „staatenlos“; bei „mehrere“
 * und „anderer Staat“ bleibt das Feld zum Eintragen leer.
 */
export function staatsangehoerigkeitText(wahl: string, bisher: string | null | undefined): string {
  const alt = (bisher ?? "").trim();
  if (alt && staatAuswahl({ staatsangehoerigkeit: alt }) === wahl) return alt;
  if (STAAT_NAMEN[wahl]) return STAAT_NAMEN[wahl]!;
  if (wahl === STAAT_STAATENLOS) return "staatenlos";
  if (wahl === STAAT_UNGEKLAERT) return alt;
  return "";
}
