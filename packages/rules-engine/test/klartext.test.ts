import { describe, expect, it } from "vitest";
import { bedingungGliederung, dauerAlsText, fristAlsText, gliederungAlsText, wertAlsText } from "../src/index.js";

describe("Klartext", () => {
  it("beschreibt verschachtelte Bedingungen", () => {
    const g = bedingungGliederung({
      all: [
        { feld: "profil.ust.kleinunternehmer", op: "==", wert: false },
        { any: [{ feld: "profil.ust.zahllast_vorjahr", op: ">", wert: { regelwert: "steuern.ust_va.grenze_befreiung" } }, { ereignis: "gruendung", op: "eingetreten", innerhalb: "P1Y" }] },
        { not: { feld: "profil.erwerb", op: "vorhanden" } },
      ],
    });
    expect(gliederungAlsText(g)).toBe(
      [
        "- alle folgenden treffen zu",
        "  - profil.ust.kleinunternehmer ist nein",
        "  - mindestens eines der folgenden trifft zu",
        "    - profil.ust.zahllast_vorjahr ist größer als Regelwert „steuern.ust_va.grenze_befreiung“",
        "    - Ereignis „gruendung“ ist eingetreten innerhalb von 1 Jahr",
        "  - das Folgende trifft nicht zu",
        "    - profil.erwerb ist angegeben",
      ].join("\n"),
    );
  });

  it("formatiert Werte und Dauern", () => {
    expect(wertAlsText(12400.5)).toBe("12.400,5");
    expect(wertAlsText({ regelwert: "x.y", faktor: 0.8 })).toBe("Regelwert „x.y“ × 0,8");
    expect(wertAlsText(["b2b", "b2c"])).toBe("b2b, b2c");
    expect(dauerAlsText("P1M")).toBe("1 Monat");
    expect(dauerAlsText("P3M7D")).toBe("3 Monate 7 Tage");
    expect(dauerAlsText("-P1D")).toBe("minus 1 Tag");
    expect(dauerAlsText("P0D")).toBe("0 Tage");
  });

  it("beschreibt Fristen", () => {
    expect(fristAlsText({ typ: "relativ", bezug: { fakt: "profil.gruendungsdatum" }, versatz: "P7D", verschiebung: { regel: "keine", kalender: "bundeseinheitlich" } })).toBe(
      "7 Tage nach Datum „profil.gruendungsdatum“ (keine Verschiebung)",
    );
    expect(
      fristAlsText({ typ: "wiederkehrend", rhythmus: "keiner", faellig: { art: "feste_termine", termine: ["03-10", "06-10"] }, verschiebung: { regel: "naechster_werktag", kalender: "bundesland" } }),
    ).toBe("keiner, an festen Terminen (03-10, 06-10) (auf den nächsten Werktag)");
  });
});
