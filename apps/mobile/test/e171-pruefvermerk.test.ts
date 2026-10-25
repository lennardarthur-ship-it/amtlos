import { describe, expect, it } from "vitest";
import { ROLLEN, VERMERK_NEUTRAL, istGanzGeprueft, istGeprueft, nennungGilt, pruefVermerk } from "../src/pflichten/pruefer";
import { katalogGeprueft } from "../src/rechtshinweis";

const frei = { status: "freigegeben", geprueft_von: ["recht"], geprueft_am: "2026-10-22", geprueft_version: 3, bestaetigt_am: "2026-10-23" };
const AM = new Date(2026, 10, 1);

describe("E-171 Prüfvermerk je Katalogeintrag", () => {
  it("gilt nur für die geprüfte Version und nur mit schriftlicher Bestätigung (E-196, E-197)", () => {
    expect(istGeprueft(3, frei)).toBe(true);
    expect(istGeprueft(4, frei)).toBe(false); // inhaltlich geändert ⇒ Kennzeichnung entfällt
    expect(istGeprueft(3, { ...frei, status: "entwurf" })).toBe(false);
    expect(istGeprueft(3, { ...frei, geprueft_version: null })).toBe(false);
    expect(istGeprueft(3, undefined)).toBe(false);
    // E-197: ohne schriftliche Bestätigung kein Vermerk, und der Stand liegt nie nach der Bestätigung
    expect(istGeprueft(3, { ...frei, bestaetigt_am: null })).toBe(false);
    expect(istGeprueft(3, { ...frei, geprueft_am: "2026-10-25" })).toBe(false);
  });

  it("nennt die Rolle, nie eine Person (E-196)", () => {
    const v = pruefVermerk(3, frei, AM)!;
    expect(v).toBe("Inhalt fachlich geprüft von einem Rechtsanwalt, Stand 22.10.2026. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.");
    expect(v).not.toMatch(/rechtssicher|garantiert|freigegeben/i);
    expect(pruefVermerk(4, frei)).toBeNull();
    expect(pruefVermerk(3, { ...frei, geprueft_von: ["steuern"] }, AM)).toBe("Fachlich durchgesehen von einem Steuerberater (Stand 22.10.2026) – ohne Gewähr für den Einzelfall.");
    expect(pruefVermerk(3, { ...frei, geprueft_von: ["arbeitsschutz"] }, AM)).toContain("Inhalt fachlich geprüft von einer Fachkraft für Arbeitssicherheit, Stand 22.10.2026.");
  });

  it("Einschränkung des Prüfers steht im Vermerk (Sifa: ohne arbeitsmedizinische Angaben)", () => {
    const p = { ...frei, geprueft_von: ["arbeitsschutz"], einschraenkung: "ohne arbeitsmedizinische Angaben" };
    expect(pruefVermerk(3, p, AM)).toBe("Inhalt fachlich geprüft von einer Fachkraft für Arbeitssicherheit (ohne arbeitsmedizinische Angaben), Stand 22.10.2026. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.");
    expect(istGanzGeprueft(3, p)).toBe(false);
  });

  it("offene Prüfpunkte: „teilweise geprüft“ mit dem offenen Punkt", () => {
    const p = { ...frei, geprueft_von: ["steuern"], offen: ["Übergangsfristen vor dem Start erneut zu prüfen"] };
    expect(pruefVermerk(3, p, AM)).toBe("Teilweise fachlich durchgesehen von einem Steuerberater (Stand 22.10.2026; noch offen: Übergangsfristen vor dem Start erneut zu prüfen) – ohne Gewähr für den Einzelfall.");
    expect(pruefVermerk(3, { ...frei, offen: ["x"] }, AM)).toMatch(/^Inhalt teilweise fachlich geprüft von einem Rechtsanwalt, Stand 22\.10\.2026; noch offen: x\./);
    expect(istGanzGeprueft(3, p)).toBe(false);
    expect(istGanzGeprueft(3, frei)).toBe(true);
  });

  it("Wortlaut der Rollen ohne verbotene Zusätze und ohne Namen", () => {
    for (const r of Object.values(ROLLEN)) {
      expect(r.wortlaut).not.toMatch(/rechtssicher|garantiert|freigegeben/i);
      expect(`${r.von} ${r.bezeichnung}`).not.toMatch(/weber|busch|heckler|koch|baum/i);
    }
  });

  it("Anteil geprüft: keine, teil, alle (nur geltendes Recht; „alle“ nur ohne Einschränkung und offene Punkte)", () => {
    const e = { version: 1, status_recht: "in_kraft", pruefung: { status: "entwurf" } };
    const g = { version: 3, status_recht: "in_kraft", pruefung: frei };
    const radar = { version: 1, status_recht: "geplant", pruefung: { status: "entwurf" } };
    expect(katalogGeprueft([e, radar])).toBe("keine");
    expect(katalogGeprueft([e, g])).toBe("teil");
    expect(katalogGeprueft([g, radar])).toBe("alle");
    expect(katalogGeprueft([g, { ...g, pruefung: { ...frei, offen: ["x"] } }])).toBe("teil");
  });
});

describe("Rolle höchstens zwölf Monate nach dem Prüfdatum (Vereinbarung mit dem Rechtsanwalt § 4 Abs. 3)", () => {
  it("vergleicht das Prüfdatum mit dem Gerätedatum", () => {
    expect(nennungGilt("2026-10-25", 12, new Date(2027, 9, 24))).toBe(true);
    expect(nennungGilt("2026-10-25", 12, new Date(2027, 9, 25))).toBe(false);
    expect(nennungGilt("2026-10-25", undefined, new Date(2030, 0, 1))).toBe(true);
  });
  it("danach der neutrale Vermerk", () => {
    expect(pruefVermerk(3, frei, new Date(2027, 10, 1))).toBe(VERMERK_NEUTRAL.replace("{stand}", "22.10.2026"));
  });
});

describe("Geteilte Prüfung (Lebensmittel): beide Rollen mit ihrem Umfang", () => {
  it("Inhalt vom Lebensmittelfachbeauftragten, Folgen vom Rechtsanwalt", () => {
    const geteilt = { status: "freigegeben", geprueft_von: ["hygiene", "recht"], geprueft_am: "2026-10-23", geprueft_version: 2, bestaetigt_am: "2026-10-23" };
    expect(pruefVermerk(2, geteilt, AM)).toBe("Inhalt fachlich geprüft von einem Lebensmittelfachbeauftragten, die Folgen bei Verstoß von einem Rechtsanwalt, Stand 23.10.2026. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.");
    // nach zwölf Monaten (Rechtsanwalt) ohne Rollen
    expect(pruefVermerk(2, geteilt, new Date(2027, 11, 1))).toBe(VERMERK_NEUTRAL.replace("{stand}", "23.10.2026"));
  });
});
