/**
 * Nachkontrolle Rechtsanwalt (21.10.2026): Schriftform-Hinweis für die Branchen nach § 2a SchwarzArbG sichtbar – am Anfang
 * des NachwG-Ablaufs (erster Schritt) und im Abschluss vor dem Teilen, nicht erst beim Teilen.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { vorlageFuer } from "@amtlos/fachlogik";
import { T as TEXT } from "../src/texte";

const APP = path.resolve(__dirname, "..");
const quelle = (d: string) => fs.readFileSync(path.join(APP, d), "utf8");
const NW = vorlageFuer("nachweis_arbeitsbedingungen")!;

describe("Schriftform im NachwG-Ablauf", () => {
  it("die Vorlage liefert die Form je Branche", () => {
    expect(NW.formHinweis!({ branche: "friseur_kosmetik" })).toEqual({ form: "schrift", text: expect.stringMatching(/^In deiner Branche gilt die Schriftform: Nachweis ausdrucken, eigenhändig unterschreiben und aushändigen – ein PDF oder eine E-Mail genügt nicht \(§ 2 Abs\. 1 S\. 3 NachwG, § 2a SchwarzArbG\)\./) });
    expect(NW.formHinweis!({ branche: "keine" })!.form).toBe("text");
    expect(vorlageFuer("rechnung")!.formHinweis).toBeUndefined();
  });
  it("Kasten im ersten Schritt und im Abschluss vor den übrigen Hinweisen; kein doppelter Text", () => {
    const ablauf = quelle("src/seiten/Ablauf.tsx");
    // oben im ersten Schritt, sobald die Form feststeht; nach einer Wahl auf dem Bildschirm direkt darunter
    expect(ablauf).toContain('{index === 0 && form && form !== "offen" && !formUnten ? <FormHinweis v={v} d={daten}');
    expect(ablauf).toContain("{formUnten ? <View style={{ marginTop: 16 }}><FormHinweis v={v} d={daten}");
    const abschluss = quelle("src/seiten/Abschluss.tsx");
    const kasten = abschluss.indexOf("<FormHinweis v={v} d={d} />");
    expect(kasten).toBeGreaterThan(0);
    // E-239: die übrigen Hinweise werden vorher geordnet und erst danach gezeichnet (HinweisStapel)
    expect(abschluss).toContain("v.hinweise?.(d, z.stand.betrieb");
    expect(kasten).toBeLessThan(abschluss.indexOf("<HinweisStapel bereit={fertig}"));
    expect(abschluss).toContain('v.formHinweis?.(d)?.form === "schrift"');
    expect(abschluss).toContain(".filter((h) => h !== v.formHinweis?.(d)?.text)");
  });
  it("Überschriften des Kastens", () => {
    expect(TEXT.nk_form_schrift_titel).toBe("Schriftform: ausdrucken und unterschreiben");
    expect(TEXT.nk_form_text_titel).toBe("Textform: PDF genügt");
    expect(TEXT.nk_form_offen_titel).toBe("Form des Nachweises");
  });
});
