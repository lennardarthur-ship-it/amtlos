/**
 * E-220 (7): HTML außerhalb der Vorlagen – Kontrollmappe (Deckblatt mit Personalübersicht und Dienstplan,
 * Tagesabschlüsse, Kassensturz, Entsorgungsbelege) – maskiert jede Eingabe wie die Vorlagen (zentrale Maskierung
 * `htmlMaskieren` aus der Fachlogik: & < > " '). Die Vorlagen selbst prüft packages/fachlogik/test/e220-html-escaping.
 */
import { describe, expect, it } from "vitest";
import { htmlMaskieren, type Beleg, type Kassenabschluss, type Kassensturz } from "@amtlos/fachlogik";
import { deckblattHtml, entsorgungEintraege, kassensturzHtml, tagesabschluesseHtml } from "../src/unterlagen/kontrollmappe";

const ROH = ["<script>alert(1)</script>", "<img src=x onerror=alert(2)>", "</td></tr></table><b>", "\" onload=\"alert(3)", "' onfocus='alert(4)"];
const P = `Ä&B ${ROH.join(" ")} Ende`;
const roh = (html: string) => ROH.filter((r) => html.includes(r));

describe("E-220 (7): zentrale Maskierung", () => {
  it("maskiert & < > \" ' und lässt alles andere stehen", () => {
    expect(htmlMaskieren(`a&b<c>d"e'f Ä ß €`)).toBe("a&amp;b&lt;c&gt;d&quot;e&#39;f Ä ß €");
  });
});

describe("E-220 (7): Kontrollmappe maskiert jede Eingabe", () => {
  it("Deckblatt: Betrieb, Einträge, Personalübersicht (auch Datumsfelder), Dienstplan, Papier, Hinweis", () => {
    const html = deckblattHtml(P, "2026-10-20", [{ id: "x", vorlage: "rechnung", titel: P, bereich: "steuern", datum: P, geteilt: true }], P, [P, { titel: P, am: P }], {
      staette: P,
      personal: [{ name: P, geburtsdatum: P, beginn: P, art: P, wochenstunden: P, entgelt: P, sofortmeldung: P, aufenthaltBis: P }],
      dienstplan: { namen: [P, P], text: P },
      hinweis: P,
    });
    expect(roh(html)).toEqual([]);
  });

  it("Tagesabschlüsse, Kassensturz und Entsorgungsbelege", () => {
    const k = { id: "k1", erstellt: "2026-10-20T10:00:00Z", geaendert: "2026-10-20T10:00:00Z", datum: P, standort: P, zbon: P, tse_seriennr: P, tse_von: P, tse_bis: P, umsatz: [{ satz: 19, brutto_cent: 100 }], karte_cent: 0, bewegungen: [], gutscheine: [], rechnungen_bar: [], notiz: P } as unknown as Kassenabschluss;
    expect(roh(tagesabschluesseHtml([k], P, "2026-10-20"))).toEqual([]);
    const s = { id: "s1", zeitpunkt: "2026-10-20T10:00:00Z", standort: P, anwesend: P, notiz: P, gezaehlt_cent: 100, stueckelung: {} } as unknown as Kassensturz;
    expect(roh(kassensturzHtml(s, P))).toEqual([]);
    const b = { id: "b1", datum: "2026-10-01", lieferant: `Entsorgung ${P}`, nummer: P, notiz: P, steuer: [{ satz: 19, netto_cent: 100, ust_cent: 19, brutto_cent: 119 }] } as unknown as Beleg;
    const e = entsorgungEintraege([b], P, "2026-10-20");
    expect(e.length).toBeGreaterThan(0);
    expect(roh(e[0]!.html!)).toEqual([]);
  });
});
