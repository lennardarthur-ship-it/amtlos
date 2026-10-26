/**
 * E-210 (externer Prüfer): Impressum der GmbH & Co. KG nennt die falsche vertretungsberechtigte Person, Rechtsform doppelt
 * im Namen („Muster UG UG (haftungsbeschränkt)“), Datenschutzerklärung und Impressum mit „[bitte ergänzen]“ ohne Warnung.
 */
import { describe, expect, it } from "vitest";
import { KG_KOMPLEMENTAER, LEERER_BETRIEB, PRUEFHINWEIS, pruefHinweisFuer, fehlendeAngaben, firmaMitRechtsform, fussSpalten, komplementaerZeile, offeneLuecken, rechtsformImNamen, vorlageFuer, LUECKEN_IM_TEXT, type Betrieb } from "../src/index.js";

const imp = vorlageFuer("impressum")!;
const dse = vorlageFuer("datenschutzerklaerung_website")!;
const basis: Betrieb = { ...LEERER_BETRIEB, name: "Muster Betrieb", strasse: "Musterstraße 1", plz: "10115", ort: "Musterstadt", telefon: "030 1234567", email: "info@muster.example", bundesland: "Berlin", verantwortlich: "Alex Muster" };
const coKg: Betrieb = {
  ...basis, name: "Muster GmbH & Co. KG", rechtsform: "GmbH & Co. KG", registergericht: "Amtsgericht Musterstadt", registernummer: "HRA 1004", vertretung: "Alex Muster, Kim Beispiel",
  komplementaer: "Muster Verwaltungs GmbH", komplementaer_rechtsform: "GmbH", komplementaer_sitz: "Musterstadt", komplementaer_registergericht: "Amtsgericht Musterstadt", komplementaer_registernummer: "HRB 2001",
};

describe("a) Impressum der GmbH & Co. KG: vertreten durch die Komplementärin, diese durch ihre Geschäftsführer", () => {
  it("nennt die persönlich haftende Gesellschafterin mit Registerangaben und ihre Geschäftsführer", () => {
    const t = imp.alsText!({ vertreten: "Alex Muster, Kim Beispiel" }, coKg);
    expect(t).toContain("Vertreten durch\ndie persönlich haftende Gesellschafterin Muster Verwaltungs GmbH, Sitz Musterstadt, Amtsgericht Musterstadt HRB 2001, diese vertreten durch ihre Geschäftsführer Alex Muster, Kim Beispiel");
    // die Geschäftsführer der Komplementärin vertreten die KG nicht unmittelbar
    expect(t).not.toMatch(/Vertreten durch\nAlex Muster/);
    expect(imp.html({ vertreten: "Alex Muster, Kim Beispiel" }, coKg)).toContain("diese vertreten durch ihre Geschäftsführer Alex Muster, Kim Beispiel");
  });
  it("ein Geschäftsführer: „ihren Geschäftsführer“; UG (haftungsbeschränkt) & Co. KG ebenso", () => {
    const ug: Betrieb = { ...coKg, name: "Muster UG (haftungsbeschränkt) & Co. KG", rechtsform: "UG (haftungsbeschränkt) & Co. KG", vertretung: "Alex Muster", komplementaer: "Muster Verwaltungs UG (haftungsbeschränkt)", komplementaer_rechtsform: "UG (haftungsbeschränkt)" };
    expect(imp.alsText!({}, ug)).toContain("die persönlich haftende Gesellschafterin Muster Verwaltungs UG (haftungsbeschränkt), Sitz Musterstadt, Amtsgericht Musterstadt HRB 2001, diese vertreten durch ihren Geschäftsführer Alex Muster");
  });
  it("schon vollständig eingetragene Vertretung wird nicht verdoppelt", () => {
    const voll = "die persönlich haftende Gesellschafterin Muster Verwaltungs GmbH, diese vertreten durch ihre Geschäftsführerin Kim Beispiel";
    const t = imp.alsText!({ vertreten: voll }, coKg);
    expect(t).toContain(`Vertreten durch\n${voll}`);
    expect(t.match(/Muster Verwaltungs GmbH/g)).toHaveLength(1);
  });
  it("ohne Komplementärin in „Mein Betrieb“: Lücke und Hinweis", () => {
    const ohne: Betrieb = { ...coKg, komplementaer: "" };
    expect(imp.alsText!({}, ohne)).toContain("die persönlich haftende Gesellschafterin [bitte ergänzen], diese vertreten durch ihre Geschäftsführer Alex Muster, Kim Beispiel");
    expect(fehlendeAngaben(imp, {}, ohne).join("\n")).toContain(KG_KOMPLEMENTAER);
  });
  it("Prüfvermerk: entfällt nur für die Co.-KG-Varianten des Impressums (Rechtsanwalt muss die Passage bestätigen)", () => {
    expect(pruefHinweisFuer(imp, {}, coKg)).toBe(PRUEFHINWEIS);
    expect(pruefHinweisFuer(imp, {}, { ...coKg, name: "Muster UG (haftungsbeschränkt) & Co. KG", rechtsform: "UG (haftungsbeschränkt) & Co. KG" })).toBe(PRUEFHINWEIS);
    for (const rf of ["GmbH", "UG (haftungsbeschränkt)", "KG", "OHG", "e. K.", "Einzelunternehmen"]) expect(pruefHinweisFuer(imp, {}, { ...basis, name: `Muster ${rf}`, rechtsform: rf }), rf).not.toBe(PRUEFHINWEIS);
  });
  it("andere Rechtsformen unverändert", () => {
    const gmbh: Betrieb = { ...basis, name: "Muster GmbH", rechtsform: "GmbH", vertretung: "Alex Muster" };
    expect(imp.alsText!({}, gmbh)).toContain("Vertretungsberechtigte Geschäftsführung\nAlex Muster");
    const kg: Betrieb = { ...basis, name: "Muster KG", rechtsform: "KG", vertretung: "Alex Muster" };
    expect(imp.alsText!({}, kg)).toContain("Vertretungsberechtigte Gesellschafter/innen\nAlex Muster");
  });
});

describe("b) Rechtsform nicht doppelt an den Namen hängen", () => {
  // [Name, Rechtsform, erwartete Firma]
  const faelle: [string, string, string][] = [
    ["Muster UG (haftungsbeschränkt)", "UG (haftungsbeschränkt)", "Muster UG (haftungsbeschränkt)"],
    ["Muster UG", "UG (haftungsbeschränkt)", "Muster UG"],
    ["Muster UG (haftungsbeschraenkt)", "UG (haftungsbeschränkt)", "Muster UG (haftungsbeschraenkt)"],
    ["Muster UG(haftungsbeschränkt)", "UG", "Muster UG(haftungsbeschränkt)"],
    ["Muster ug (Haftungsbeschränkt)", "UG (haftungsbeschränkt)", "Muster ug (Haftungsbeschränkt)"],
    ["Muster Unternehmergesellschaft (haftungsbeschränkt)", "UG (haftungsbeschränkt)", "Muster Unternehmergesellschaft (haftungsbeschränkt)"],
    ["Muster GmbH", "GmbH", "Muster GmbH"],
    ["Muster gmbh", "GmbH", "Muster gmbh"],
    ["Muster G.m.b.H.", "GmbH", "Muster G.m.b.H."],
    ["Muster Gesellschaft mit beschränkter Haftung", "GmbH", "Muster Gesellschaft mit beschränkter Haftung"],
    ["Muster gGmbH", "gGmbH", "Muster gGmbH"],
    ["Muster gGmbH", "GmbH", "Muster gGmbH"],
    ["Muster GmbH & Co. KG", "GmbH & Co. KG", "Muster GmbH & Co. KG"],
    ["Muster GmbH & Co KG", "GmbH & Co. KG", "Muster GmbH & Co KG"],
    ["Muster GmbH u. Co. KG", "GmbH & Co. KG", "Muster GmbH u. Co. KG"],
    ["Muster GmbH&Co.KG", "GmbH & Co. KG", "Muster GmbH&Co.KG"],
    ["Muster UG (haftungsbeschränkt) & Co. KG", "UG (haftungsbeschränkt) & Co. KG", "Muster UG (haftungsbeschränkt) & Co. KG"],
    ["Muster OHG", "OHG", "Muster OHG"],
    ["Muster oHG", "OHG", "Muster oHG"],
    ["Muster KG", "KG", "Muster KG"],
    ["Muster e.K.", "e. K.", "Muster e.K."],
    ["Muster e. K.", "e.K.", "Muster e. K."],
    ["Muster e.Kfm.", "e. K.", "Muster e.Kfm."],
    ["Muster e. Kfr.", "e. K.", "Muster e. Kfr."],
    ["Muster eingetragener Kaufmann", "e. K.", "Muster eingetragener Kaufmann"],
    ["Muster GbR", "GbR", "Muster GbR"],
    ["Muster eGbR", "eGbR", "Muster eGbR"],
    ["Muster PartG", "PartG", "Muster PartG"],
    ["Muster PartG mbB", "PartG mbB", "Muster PartG mbB"],
    ["Muster AG", "AG", "Muster AG"],
    ["Muster Aktiengesellschaft", "AG", "Muster Aktiengesellschaft"],
    // fehlt der Zusatz, wird er angehängt
    ["Muster", "UG (haftungsbeschränkt)", "Muster UG (haftungsbeschränkt)"],
    ["Muster", "GmbH & Co. KG", "Muster GmbH & Co. KG"],
    ["Muster Bau", "GmbH", "Muster Bau GmbH"],
    ["Muster", "e. K.", "Muster e. K."],
    ["Muster Verwaltungs-GmbH", "GmbH", "Muster Verwaltungs-GmbH"],
    ["Muster Verwaltungsgesellschaft mbH", "GmbH", "Muster Verwaltungsgesellschaft mbH"],
    // anderer Zusatz im Namen: nicht noch einen anhängen (den Widerspruch meldet die Prüfung)
    ["Muster KG", "GmbH & Co. KG", "Muster KG"],
    ["Muster GmbH", "UG (haftungsbeschränkt)", "Muster GmbH"],
    ["Muster GmbH & Co. KG", "KG", "Muster GmbH & Co. KG"],
    // Einzelunternehmen: nie anhängen
    ["Muster", "Einzelunternehmen", "Muster"],
    ["Muster", "", "Muster"],
    // Wörter, die nur so aussehen
    ["Augustin Bau", "AG", "Augustin Bau AG"],
    ["Gugelhupf Café", "UG (haftungsbeschränkt)", "Gugelhupf Café UG (haftungsbeschränkt)"],
  ];
  it.each(faelle)("%s + %s → %s", (name, rf, erwartet) => {
    expect(firmaMitRechtsform(name, rf)).toBe(erwartet);
  });
  it("rechtsformImNamen erkennt Schreibvarianten", () => {
    expect(rechtsformImNamen("Muster UG", "UG (haftungsbeschränkt)")).toBe(true);
    expect(rechtsformImNamen("Muster GmbH", "UG (haftungsbeschränkt)")).toBe(false);
    expect(rechtsformImNamen("Muster GmbH & Co. KG", "GmbH")).toBe(false);
    expect(rechtsformImNamen("Muster GmbH & Co. KG", "KG")).toBe(false);
  });
  it("Impressum: kein „UG UG“", () => {
    for (const [name, rf] of [["Muster UG", "UG (haftungsbeschränkt)"], ["Muster UG (haftungsbeschraenkt)", "UG (haftungsbeschränkt)"], ["Muster GmbH & Co KG", "GmbH & Co. KG"], ["Muster e.Kfm.", "e. K."]] as const) {
      const t = imp.alsText!({}, { ...basis, name, rechtsform: rf, vertretung: "Alex Muster" });
      expect(t.split("\n")[3], `${name} / ${rf}`).toBe(name);
    }
    // Rechtsform aus dem Feld der Vorlage
    expect(imp.alsText!({ rechtsform: "UG (haftungsbeschränkt)" }, { ...basis, name: "Muster UG" }).split("\n")[3]).toBe("Muster UG");
  });
  it("Fußzeile und Komplementärin: Rechtsform nicht doppelt", () => {
    const sp = fussSpalten({ ...basis, name: "Muster UG (haftungsbeschraenkt)", rechtsform: "UG (haftungsbeschränkt)", registergericht: "Amtsgericht Musterstadt", registernummer: "HRB 1" }).flat().join("\n");
    expect(sp).toContain("Sitz Musterstadt, Amtsgericht Musterstadt HRB 1");
    expect(sp).not.toMatch(/^UG \(haftungsbeschränkt\), Sitz/m);
    const sp2 = fussSpalten({ ...basis, name: "Muster e.Kfm.", rechtsform: "eingetragener Kaufmann", registergericht: "Amtsgericht Musterstadt", registernummer: "HRA 1" }).flat().join("\n");
    expect(sp2).not.toMatch(/eingetragener Kaufmann, Sitz/);
    expect(komplementaerZeile({ ...coKg, komplementaer: "Muster Verwaltungs G.m.b.H." })).toBe("Persönlich haftende Gesellschafterin: Muster Verwaltungs G.m.b.H., Sitz Musterstadt, Amtsgericht Musterstadt HRB 2001");
  });
});

describe("c) Lücken „[bitte ergänzen]“ gelten als fehlende Angabe", () => {
  it("Datenschutzerklärung mit Hosting ohne Anbieter: Lücke erkannt", () => {
    const d = { module: ["hosting", "server_logfiles", "kontakt", "widerruf_einwilligung"], logfile_tage: "14" };
    expect(dse.alsText!(d, basis)).toContain("[bitte ergänzen]");
    expect(offeneLuecken(dse, d, basis)).toBe(2);
    expect(fehlendeAngaben(dse, d, basis)).toContain(LUECKEN_IM_TEXT(2));
  });
  it("Impressum mit Registergericht ohne Nummer: Lücke erkannt", () => {
    const d = { vertreten: "Alex Muster", register_gericht: "Amtsgericht Musterstadt" };
    expect(offeneLuecken(imp, d, basis)).toBe(1);
    expect(fehlendeAngaben(imp, d, basis)).toContain(LUECKEN_IM_TEXT(1));
  });
  it("vollständig: keine Lücke, keine Meldung", () => {
    const d = { module: ["hosting", "kontakt"], hoster_name: "Muster Hosting", hoster_anschrift: "Hoststraße 1, 10115 Berlin" };
    expect(offeneLuecken(dse, d, basis)).toBe(0);
    expect(fehlendeAngaben(dse, d, basis).some((x) => x.includes("Lücke"))).toBe(false);
    expect(offeneLuecken(imp, { vertreten: "Alex Muster" }, basis)).toBe(0);
  });
  it("Vorlagen ohne Textfassung: keine Lückenprüfung", () => {
    expect(offeneLuecken(vorlageFuer("rechnung")!, {}, basis)).toBe(0);
  });
});
