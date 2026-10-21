/**
 * Phase 2.3 (E-156): B2B-Lizenzen. Partner-Zugang zu Pro nur über Apples Abo-Angebotscodes („Code einlösen“ →
 * StoreKit-Einlöseblatt über RevenueCat); „Empfohlen von …“ ist reine Anzeige und schaltet nie etwas frei
 * (App Review 3.1.1: keine eigenen Lizenzschlüssel, QR-Codes o. Ä.).
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PARTNER, partnerAusCode, partnerCodeAusLink, partnerCodeNormal, partnerFuer, partnerIdAus, type Partner } from "../src/partner/partner";
import { codeEinloesenMit, type CodeAdapter } from "../src/pro/code";
import * as kaufWeb from "../src/pro/kauf.web";
import { ausgabeErlaubt, kontrollmappeErlaubt, pflichtAnsicht } from "../src/pro/regeln";
import { sicherungErstellen, sicherungLesen } from "../src/unterlagen/sicherung";
import { LEERER_STAND, MIGRATIONEN, STAND_VERSION, anlegen, migrieren, standAus, zusammenfuehren, type Stand } from "../src/unterlagen/speicher";
import { syncInhalt, syncZusammenfuehren } from "../src/konto/sync";
import { T as TEXT } from "../src/texte";

/** Testpartner – nur hier, nie in der gebündelten Liste. */
const LISTE: Record<string, Partner> = {
  "hwk-musterstadt": { name: "Handwerkskammer Musterstadt", kurz: "HWK Musterstadt", link: "https://example.org/amtlos", hinweis: "Für Mitglieder: Pro über deinen Kammer-Code." },
};
const SRC = path.resolve(__dirname, "../src");
const lies = (p: string) => fs.readFileSync(path.join(SRC, p), "utf8");
const zufall = (n: number) => new Uint8Array(randomBytes(n));

describe("Partner-Code lesen", () => {
  it("die gebündelte Liste ist leer – Partner kommen nur mit Vereinbarung und App-Update", () => {
    expect(Object.keys(PARTNER)).toEqual([]);
    expect(partnerAusCode("hwk-musterstadt")).toBeNull();
  });

  it("Groß-/Kleinschreibung und Leerzeichen am Rand sind egal", () => {
    for (const c of ["hwk-musterstadt", "HWK-MUSTERSTADT", "  Hwk-Musterstadt \n", "HWK -MUSTERSTADT"]) expect(partnerAusCode(c, LISTE)?.id).toBe("hwk-musterstadt");
    expect(partnerAusCode("hwk-musterstadt", LISTE)?.partner.name).toBe("Handwerkskammer Musterstadt");
  });

  it("unbekannte, leere oder seltsame Codes ergeben null", () => {
    for (const c of ["", "   ", "x", "hwk_musterstadt", "../hwk", "constructor", "__proto__", "toString", "a".repeat(41), null, undefined]) expect(partnerAusCode(c as string, LISTE)).toBeNull();
    expect(partnerCodeNormal("KAMMER2027")).toBe("kammer2027");
  });

  it("Deep Link amtlos://partner/<code>; andere Links (Anmeldung, Web) zählen nicht", () => {
    expect(partnerCodeAusLink("amtlos://partner/HWK-Musterstadt")).toBe("hwk-musterstadt");
    expect(partnerCodeAusLink("amtlos://partner/hwk-musterstadt/?quelle=brief")).toBe("hwk-musterstadt");
    expect(partnerCodeAusLink("amtlos:///partner/hwk%2Dmusterstadt")).toBe("hwk-musterstadt");
    for (const u of ["amtlos://anmeldung?code=abc", "https://amtlos.de/partner/hwk-musterstadt", "amtlos://partner/", "amtlos://partner/%E0%A4%A", "andere://partner/hwk-musterstadt", null]) expect(partnerCodeAusLink(u)).toBeNull();
  });

  it("gespeicherte ID ohne Partner in der Liste zeigt nichts (z. B. Partnerschaft beendet)", () => {
    expect(partnerFuer("hwk-musterstadt", LISTE)?.kurz).toBe("HWK Musterstadt");
    expect(partnerFuer("weg", LISTE)).toBeNull();
    expect(partnerFuer(undefined, LISTE)).toBeNull();
    expect(partnerIdAus("hwk-musterstadt")).toBe("hwk-musterstadt");
    for (const w of [42, "", "<script>", { id: "x" }, "A-GROSS"]) expect(partnerIdAus(w)).toBeUndefined();
  });

  it("Texte auf Deutsch: „Empfohlen von …“ und Zugang über Code einlösen", () => {
    expect(TEXT.partner_empfohlen("HWK Musterstadt")).toBe("Empfohlen von HWK Musterstadt");
    expect(TEXT.partner_zugang("HWK Musterstadt")).toBe("Dein Zugang über HWK Musterstadt: Code einlösen");
    expect(TEXT.code_einloesen).toBe("Code einlösen");
    // der Partner-Code verspricht nie Pro
    expect(TEXT.partner_text).toMatch(/schaltet nichts frei/);
  });
});

describe("Speichern, Migration, Sicherung, Synchronisation", () => {
  const mit = (id?: string): Stand => ({ ...LEERER_STAND, ...(id ? { partnerId: id } : {}) });

  it("Migration 4 → 5: Partner-ID anfangs nicht gesetzt", () => {
    expect(STAND_VERSION).toBe(6);
    expect(MIGRATIONEN[4]!({ version: 4, betrieb: {} })).toHaveProperty("partnerId", undefined);
    const alt = standAus(JSON.stringify({ version: 4, betrieb: { name: "Alt" } }));
    expect(alt.version).toBe(6);
    expect(alt.partnerId).toBeUndefined();
    expect(migrieren({ version: 1 }).version).toBe(6);
    // Stand aus einer neueren App bleibt unangetastet (Ladefehler „version“)
    expect(() => standAus(JSON.stringify({ version: STAND_VERSION + 1 }))).toThrow();
  });

  it("Partner-ID überlebt Speichern und Laden; Unlesbares fällt weg", () => {
    expect(standAus(JSON.stringify(mit("hwk-musterstadt"))).partnerId).toBe("hwk-musterstadt");
    expect(standAus(JSON.stringify({ ...LEERER_STAND, partnerId: "<b>böse</b>" })).partnerId).toBeUndefined();
    expect("partnerId" in standAus(JSON.stringify(mit()))).toBe(false);
  });

  it("die Datensicherung enthält die Partner-ID; Wiederherstellen übernimmt sie nur, wenn keine gesetzt ist", () => {
    const datei = sicherungErstellen(mit("hwk-musterstadt"), "richtig-langes-passwort", zufall, new Date(), 1000);
    expect(datei).not.toContain("hwk-musterstadt");
    const zurueck = sicherungLesen(datei, "richtig-langes-passwort");
    expect(zurueck.partnerId).toBe("hwk-musterstadt");
    expect(zusammenfuehren(mit(), zurueck).stand.partnerId).toBe("hwk-musterstadt");
    expect(zusammenfuehren(mit("anderer-partner"), zurueck).stand.partnerId).toBe("anderer-partner");
    expect("partnerId" in zusammenfuehren(mit(), mit()).stand).toBe(false);
  });

  it("die Partner-ID wird nicht synchronisiert – sie bleibt auf dem Gerät", () => {
    expect("partnerId" in syncInhalt(mit("hwk-musterstadt"))).toBe(false);
    // vom Server kommt keine; die eigene bleibt
    expect(syncZusammenfuehren(mit("hwk-musterstadt"), mit()).stand.partnerId).toBe("hwk-musterstadt");
    expect(syncZusammenfuehren(mit(), syncInhalt(mit("hwk-musterstadt"))).stand.partnerId).toBeUndefined();
  });
});

describe("Ein Partner-Code schaltet nie etwas frei", () => {
  it("Pro-Regeln kennen keinen Partner – mit Partner und ohne Pro bleibt alles wie ohne Partner", () => {
    let s: Stand = { ...LEERER_STAND, partnerId: "hwk-musterstadt" };
    const [s1, u] = anlegen(s, "hygieneplan", new Date("2026-10-02T09:00:00Z"), "h");
    s = { ...s1, unterlagen: s1.unterlagen.map((x) => (x.id === "h" ? { ...x, ausgegeben: "2026-10-02T09:00:00.000Z" } : x)) };
    const [s2, zweite] = anlegen(s, "unterweisung", new Date("2026-10-03T09:00:00Z"), "w");
    expect(u.id).toBe("h");
    expect(ausgabeErlaubt(s2.unterlagen, zweite, false, new Date("2026-10-03T09:00:00Z"))).toBe(false);
    expect(kontrollmappeErlaubt(false)).toBe(false);
    expect(pflichtAnsicht({ grund: "x", erklaerung: "y" }, false).grund).toBe("");
    expect(s2.proTest).toBe(false);
  });

  it("weder das Partner-Modul noch die Partner-Seite berühren den Pro-Status", () => {
    const quellen = [lies("partner/partner.ts"), lies("seiten/Partner.tsx")];
    for (const q of quellen) {
      expect(q).not.toMatch(/proTest|proTestSetzen|setStorePro|entitlements/);
    }
    // die einzige Stelle in Partner.tsx, die Pro setzt, ist das Ergebnis von codeEinloesen() aus kauf.ts
    const seite = lies("seiten/Partner.tsx");
    expect(seite.match(/proAktualisieren\(/g)?.length).toBe(2);
    expect(seite).toMatch(/const r = await codeEinloesen\(\);[\s\S]*if \(r === "pro"\) \{[\s\S]*proAktualisieren\(true\)/);
    expect(lies("partner/partner.ts")).not.toMatch(/import /);
    // Pro kommt im Zustand nur aus dem Store bzw. dem Testmodus
    expect(lies("zustand.tsx")).toContain("const pro = storePro || (testmodus && stand.proTest);");
  });
});

describe("Code einlösen über RevenueCat (Apples Angebotscodes)", () => {
  const adapter = (aktiv: Record<string, unknown>, fehler?: "blatt" | "info"): CodeAdapter & { aufrufe: string[] } => {
    const aufrufe: string[] = [];
    return {
      aufrufe,
      blattZeigen: vi.fn(async () => {
        aufrufe.push("blatt");
        if (fehler === "blatt") throw new Error("nicht konfiguriert");
      }),
      cacheVerwerfen: vi.fn(async () => {
        aufrufe.push("cache");
      }),
      kundendaten: vi.fn(async () => {
        aufrufe.push("info");
        if (fehler === "info") throw new Error("offline");
        return { entitlements: { active: aktiv } };
      }),
    };
  };

  it("zeigt Apples Blatt, verwirft den Cache und fragt die Berechtigung neu ab – in dieser Reihenfolge", async () => {
    const a = adapter({ pro: { identifier: "pro" } });
    expect(await codeEinloesenMit(a, "pro")).toBe("pro");
    expect(a.aufrufe).toEqual(["blatt", "cache", "info"]);
  });

  it("ohne Berechtigung (abgebrochen, Apple prüft noch) „offen“ – nie selbst freischalten", async () => {
    expect(await codeEinloesenMit(adapter({}), "pro")).toBe("offen");
    expect(await codeEinloesenMit(adapter({ andere: {} }), "pro")).toBe("offen");
    expect(await codeEinloesenMit(adapter({ pro: {} }, "info"), "pro")).toBe("offen");
  });

  it("ein Fehler beim Zeigen des Blatts wird gemeldet", async () => {
    const a = adapter({ pro: {} }, "blatt");
    await expect(codeEinloesenMit(a, "pro")).rejects.toThrow("nicht konfiguriert");
    expect(a.aufrufe).toEqual(["blatt"]);
  });

  it("Web und Testpaket: kein Einlöseblatt, sondern ein Hinweis", async () => {
    expect(kaufWeb.codeEinloesenMoeglich).toBe(false);
    expect(await kaufWeb.codeEinloesen()).toBe("nicht_verfuegbar");
    expect(typeof kaufWeb.proBeobachten(() => undefined)).toBe("function");
    expect(TEXT.code_nicht_verfuegbar).toMatch(/App Store/);
  });

  it("kauf.ts ruft RevenueCat presentCodeRedemptionSheet und frischt die Kundendaten auf", () => {
    const k = lies("pro/kauf.ts");
    expect(k).toMatch(/blattZeigen: \(\) => p\.presentCodeRedemptionSheet\(\)/);
    expect(k).toMatch(/cacheVerwerfen: \(\) => p\.invalidateCustomerInfoCache\(\)/);
    expect(k).toMatch(/addCustomerInfoUpdateListener/);
    // nur iOS mit echtem Kauf
    expect(k).toMatch(/codeEinloesenMoeglich = kaufAktiv && Platform\.OS === "ios"/);
  });
});
