/**
 * E-188 (Modell Check-Teaser): Kasse ohne Pro nur lesbar (GoBD-Aufbewahrung), Bezahlschirm genau einmal nach dem ersten
 * Pflichten-Check (mit „Später“), Neues anlegen nur mit Pro, ohne Pro nur die ersten 3 Pflichten.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { kassenbuchDaten, type Daten, type KassenInhalt } from "@amtlos/fachlogik";
import { syncInhalt, syncZusammenfuehren } from "../src/konto/sync";
import { ausgabeErlaubt, bezahlschirmNachCheck, kasseErfassenErlaubt } from "../src/pro/regeln";
import { T as TEXT } from "../src/texte";
import { kassenMonat } from "../src/unterlagen/kasse";
import { LEERER_STAND, anlegen, kasseKorrigieren, kasseSpeichern, kassenbuchFest, kassenbuchFestschreiben, standAus, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";

const hier = path.dirname(fileURLToPath(import.meta.url));
const lies = (datei: string) => readFileSync(path.resolve(hier, "../src", datei), "utf8");
const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);
const tag = (datum: string, o: Partial<KassenInhalt> = {}): KassenInhalt => ({ datum, zbon: null, umsatz: [{ satz: 19, brutto_cent: 11900 }], karte_cent: 5000, sonstige_cent: 0, bewegungen: [], ...o });

/** mit Pro drei Tage erfasst – danach endet Pro */
function mitKasse(): Stand {
  let s: Stand = { ...LEERER_STAND, profil: { "kasse.elektronisch": true, "ust.kleinunternehmer": false } };
  for (const [i, d] of ["2026-09-01", "2026-09-02", "2026-09-03"].entries()) [s] = kasseSpeichern(s, tag(d, { zbon: String(10 + i), ...(i === 0 ? { anfang_cent: 10000 } : {}) }), t(d, 20), `k${i}`);
  return s;
}

describe("Kasse ohne Pro (E-188, GoBD § 147 AO)", () => {
  it("neue Kassendaten erfassen gehört zu Pro", () => {
    expect(kasseErfassenErlaubt(false)).toBe(false);
    expect(kasseErfassenErlaubt(true)).toBe(true);
  });

  it("erfasste Tage bleiben nach dem Ende von Pro vollständig da – Monatsübersicht und Kassenbuch rechnen ohne Pro", () => {
    const s = standAus(JSON.stringify(mitKasse()));
    expect(s.kasse).toHaveLength(3);
    const m = kassenMonat(s, "2026-09");
    expect(m.abschluesse).toHaveLength(3);
    expect(m.brutto).toBe(3 * 11900);
    const daten = kassenbuchDaten(s.kasse, s.belege, "2026-09", new Map(), "");
    expect(daten).not.toBeNull();
  });

  it("das Kassenbuch erfasster Tage lässt sich ohne Pro teilen, drucken und festschreiben – auch erneut", () => {
    const s = mitKasse();
    const daten = kassenbuchDaten(s.kasse, s.belege, "2026-09", new Map(), "") as unknown as Daten;
    const [, kb] = anlegen(s, "kassenbuch", t("2026-10-01"), "kb");
    expect(ausgabeErlaubt(kb, false)).toBe(true);
    const fest = kassenbuchFestschreiben(s, "2026-09", "", daten, "ab".repeat(32), t("2026-10-02"));
    expect(kassenbuchFest(fest, "2026-09", "")?.festgeschrieben).toBeTruthy();
    const kbFest = fest.unterlagen.find((u) => u.vorlage === "kassenbuch")!;
    expect(ausgabeErlaubt(kbFest, false)).toBe(true);
  });

  it("ein erfasster Tag lässt sich ohne Pro mit Grund korrigieren – die Korrektur ist Pflicht, keine neue Erfassung", () => {
    const s = kasseKorrigieren(mitKasse(), "k1", tag("2026-09-02", { zbon: "11", karte_cent: 4000 }), "Kartenzahlung doppelt gebucht", t("2026-10-05"));
    expect(s.kasse.find((k) => k.id === "k1")?.historie?.length).toBe(1);
  });

  it("die Oberfläche: Erfassen fragt Pro ab, Ansehen, Korrigieren und Kassenbuch-Teilen nie", () => {
    const q = lies("seiten/Kasse.tsx");
    // „Tagesabschluss erfassen“ über die Sperre; ein erfasster Tag öffnet ohne
    expect(q).toMatch(/const neu = \(\) => erfassen\(/);
    expect(q).toMatch(/const oeffnen = \(id: string\) => nav\.oeffnen\(`kasse-\$\{id\}`/);
    // Speichern eines neuen Tages nur mit Pro – Korrekturen (alt) immer
    expect(q).toMatch(/if \(!alt && !kasseErfassenErlaubt\(z\.pro\)\)/);
    // das Kassenbuch teilt ohne Pro-Prüfung
    const kassenbuch = q.slice(q.indexOf("function KassenbuchSeite"), q.indexOf("export function KassenTagSeite"));
    expect(kassenbuch).toMatch(/pdfTeilen/);
    expect(kassenbuch).not.toMatch(/sperre|kasseErfassenErlaubt|z\.pro/);
    expect(TEXT.r12_kostenlos).toMatch(/mit Pro[\s\S]*korrigierst[\s\S]*Kassenbuch[\s\S]*ohne Pro/);
  });
});

describe("Bezahlschirm nach dem ersten Pflichten-Check (E-188)", () => {
  it("genau einmal: nur ohne Pro, wenn der Store geantwortet hat, der Bezahlschirm angeboten wird und noch nicht gezeigt wurde", () => {
    const basis = { pro: false, proBekannt: true, verfuegbar: true };
    expect(bezahlschirmNachCheck(basis)).toBe(true);
    expect(bezahlschirmNachCheck({ ...basis, gezeigt: "2026-10-25T10:00:00.000Z" })).toBe(false);
    expect(bezahlschirmNachCheck({ ...basis, pro: true })).toBe(false);
    expect(bezahlschirmNachCheck({ ...basis, proBekannt: false })).toBe(false);
    // Store-Build ohne Kauf (App-Review B2): nie
    expect(bezahlschirmNachCheck({ ...basis, verfuegbar: false })).toBe(false);
  });

  it("der Vermerk bleibt gespeichert und in der Sicherung, wird aber nicht synchronisiert", () => {
    const s: Stand = { ...LEERER_STAND, bezahlschirmNachCheck: "2026-10-25T10:00:00.000Z" };
    expect(standAus(JSON.stringify(s)).bezahlschirmNachCheck).toBe("2026-10-25T10:00:00.000Z");
    expect(standAus(JSON.stringify({ ...LEERER_STAND, bezahlschirmNachCheck: 5 })).bezahlschirmNachCheck).toBeUndefined();
    expect("bezahlschirmNachCheck" in syncInhalt(s)).toBe(false);
    expect(syncZusammenfuehren(s, syncInhalt(LEERER_STAND)).stand.bezahlschirmNachCheck).toBe("2026-10-25T10:00:00.000Z");
    expect(zusammenfuehren(s, LEERER_STAND).stand.bezahlschirmNachCheck).toBe("2026-10-25T10:00:00.000Z");
  });

  it("der Check vermerkt ihn vor dem Öffnen und öffnet den Bezahlschirm über dem Ergebnis – der Check schließt sich nicht", () => {
    const q = lies("seiten/Check.tsx");
    const block = q.slice(q.indexOf("const ergebnisDa"), q.indexOf("const schliessen"));
    expect(block).toMatch(/voll && Boolean\(a\) && !schon/);
    expect(block).toMatch(/bezahlschirmNachCheck\(\{ pro: z\.pro, proBekannt: z\.proBekannt, verfuegbar: paywallVerfuegbar, gezeigt: z\.stand\.bezahlschirmNachCheck \}\)/);
    expect(block.indexOf("bezahlschirmNachCheckVermerken()")).toBeLessThan(block.indexOf("nav.oeffnen"));
    expect(block).toMatch(/<ProSeite anlass="check" anzahl=\{zahl\.pflichten\} \/>/);
    expect(block).not.toMatch(/nav\.zurueck|tabWechseln/);
  });

  it("„Später“ ist deutlich sichtbar und schließt nur den Bezahlschirm; Überschrift mit der Zahl der Pflichten (E-189)", () => {
    const q = lies("seiten/Pro.tsx");
    expect(q).toMatch(/\{spaeter \? <Knopf ton text=\{TEXT\.pro_spaeter\} onPress=\{nav\.zurueck\} \/> : null\}/);
    expect(q).toMatch(/const spaeter = anlass === "check" && !z\.pro/);
    expect(TEXT.pro_spaeter).toBe("Später");
    expect(TEXT.pro_check_titel(41)).toBe("41 Pflichten kommen für dich in Frage");
    expect(TEXT.pro_check_titel(0)).toBe("Damit du keine Frist verpasst");
    expect(TEXT.pro_check_text).toMatch(/kostenlos/);
  });

  it("der Vermerk wird nur einmal gesetzt (zweiter Aufruf ändert nichts)", () => {
    const q = lies("zustand.tsx");
    const block = q.slice(q.indexOf("bezahlschirmNachCheckVermerken: () =>"), q.indexOf("partnerSetzen: (id) =>"));
    expect(block).toMatch(/if \(aktuell\.current\.bezahlschirmNachCheck\) return;/);
  });
});

describe("Oberfläche ohne Pro (E-188)", () => {
  it("neue Unterlage (Rechnung, Vorlage) und Kopie öffnen ohne Pro den Bezahlschirm, ohne einen leeren Entwurf anzulegen", () => {
    const q = lies("seiten/starten.tsx");
    expect(q).toMatch(/if \(erstellenErlaubt\(pro\)\) return los\(\);\s*nav\.oeffnen\("pro", \(\) => <ProSeite grund=\{ausgabeGrund\(\{ vorlage: vorlageId \}\)\} danach=\{los\} \/>, true\);/);
    const a = lies("seiten/Abschluss.tsx");
    expect(a).toMatch(/if \(!erstellenErlaubt\(z\.pro\) && !sperre\(ausgabeGrund\(u\)\)\) return;\s*const k = z\.kopieren\(id\);/);
    // das Storno einer ausgegebenen Rechnung prüft kein Pro (GoBD)
    const storno = a.slice(a.indexOf("TEXT.storno_wirklich") - 400, a.indexOf("TEXT.storno_angelegt"));
    expect(storno).not.toMatch(/sperre|erstellenErlaubt|z\.pro/);
  });

  it("„Beleg erfassen“ zeigt ohne Pro den Bezahlschirm – vorhandene Belege bleiben", () => {
    const q = lies("seiten/Belege.tsx");
    expect(q).toMatch(/if \(!erstellenErlaubt\(z\.pro\)\) return <ProSeite grund="belege" \/>;/);
  });

  it("„Deine Pflichten“ ohne Pro: die freien Pflichten und die übrigen nur als Zahl; Detail gesperrter Pflichten gesperrt; kein Jahresraster; kein „Was hast du schon?“ im Check", () => {
    const q = lies("seiten/Pflichten.tsx");
    expect(q).toMatch(/return frei \? <PflichtenFrei frei=\{frei\} \/> : <PflichtenAlle \/>;/);
    expect(q).toMatch(/if \(frei && !frei\.has\(id\)\) return/);
    expect(q).toMatch(/\{z\.pro \? <Jahresraster/);
    const frei = q.slice(q.indexOf("function PflichtenFrei"), q.indexOf("function PflichtenAlle"));
    expect(frei).not.toMatch(/a\.kommend|a\.gruendung|SchonErledigt|Jahresraster/);
    const c = lies("seiten/Check.tsx");
    expect(c).toMatch(/const schon = Boolean\(a\) && z\.pro &&/);
    // E-192: „… und N weitere Pflichten“ zählt nur echte Pflichten (`weiterePflichten`, wie `zaehlung`)
    expect(c).toMatch(/<GesperrtePflichten anzahl=\{weiterePflichten\(a, frei\)\} \/>/);
    const h = lies("seiten/Heute.tsx");
    expect(h).toMatch(/filter\(\(p\) => !frei \|\| frei\.has\(p\.id\)\)/);
  });
});
