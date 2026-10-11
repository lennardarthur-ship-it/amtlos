import { describe, expect, it } from "vitest";
import { fortschritt, fragebogenVorbereitung, ordne } from "../src/index.js";

describe("Fachlogik", () => {
  it("ordnet Gründungsschritte nach Voraussetzungen", () => {
    const s = [
      { pflicht_id: "b", periode: "einmalig", status: "offen", faellig_am: null, voraussetzungen: ["a"] },
      { pflicht_id: "a", periode: "einmalig", status: "erledigt", faellig_am: null, voraussetzungen: [] },
    ];
    expect(ordne(s).map((x) => x.pflicht_id)).toEqual(["a", "b"]);
    expect(fortschritt(s)).toEqual({ erledigt: 1, gesamt: 2, fertig: false });
  });
  it("bereitet den Fragebogen aus dem Profil vor und markiert Fehlendes", () => {
    const v = fragebogenVorbereitung("Test", { rechtsform: "einzelunternehmen" }, "de");
    expect(v.abschnitte.length).toBeGreaterThan(0);
    expect(v.fehlend.length).toBeGreaterThan(0);
  });
});
