import { describe, expect, it } from "vitest";
import { RECHNUNG_NEGATIV, RECHNUNG_NULL, RECHNUNG_PLZ_FEHLT, VORLAGEN, cent, emailGueltig, fehlendeAngaben, ibanGueltig, kurztitel, kurztitelListe, leereDaten, neuerEintrag, plzGueltig, vorlageFuer, zahl, type Betrieb, type Daten, type Feld } from "../src/index.js";

const BETRIEB: Betrieb = { name: "Salon Sonne", strasse: "Hauptstr. 1", plz: "12345", ort: "Musterstadt", verantwortlich: "Alex Muster", telefon: "0123 456", email: "info@example.de", steuernummer: "12/345/67890", ust_idnr: "", iban: "", bundesland: "Bayern" };

function rechnung(werte: Partial<Daten>, positionen: Record<string, string>[]): Daten {
  const r = vorlageFuer("rechnung")!;
  return { ...leereDaten(r, BETRIEB, "2026-10-12"), nummer: "2026-001", kunde_name: "Kim Muster", kunde_anschrift: "Weg 1\n12345 Musterstadt", ...werte, positionen: positionen.map((p) => ({ bezeichnung: "Haarschnitt", menge: "1", einheit: "Stück", satz: "19", ...p })) } as Daten;
}

describe("Beträge lesen", () => {
  it("„45,-“ und „45,–“ sind glatte Euro", () => {
    expect(cent("45,-")).toBe(4500);
    expect(cent("45,–")).toBe(4500);
    expect(cent("1.200,--")).toBe(120000);
    expect(cent("45.-")).toBe(4500);
  });
  it("englische Schreibweise „1,234.56“ gilt als unlesbar statt still 1,23 €", () => {
    expect(cent("1,234.56")).toBeNull();
    expect(cent("12,5.0")).toBeNull();
    expect(zahl("1,234.5")).toBeNull();
  });
  it("deutsche Schreibweisen bleiben, wie sie waren", () => {
    expect(cent("1.234,56")).toBe(123456);
    expect(cent("1234.56")).toBe(123456);
    expect(cent("-1.500")).toBe(-150000);
    expect(cent("12")).toBe(1200);
    expect(cent("45 Euro")).toBeNull();
  });
});

describe("Rechnung: Plausibilität vor dem Teilen", () => {
  const r = vorlageFuer("rechnung")!;
  it("vollständige Rechnung: nichts fehlt", () => {
    expect(fehlendeAngaben(r, rechnung({}, [{ preis: "45,00" }]), BETRIEB)).toEqual([]);
  });
  it("unlesbarer Preis: fehlt mit Beispiel – und 0,00 € sperrt das Teilen", () => {
    const f = fehlendeAngaben(r, rechnung({}, [{ preis: "45 Euro" }]), BETRIEB);
    expect(f).toContain("Position: Preis nicht lesbar (z. B. 45,00)");
    expect(f).toContain(RECHNUNG_NULL);
  });
  it("„45,-“ wird gelesen: kein Befund", () => {
    expect(fehlendeAngaben(r, rechnung({}, [{ preis: "45,-" }]), BETRIEB)).toEqual([]);
  });
  it("negativer Rechnungsbetrag nur beim Storno", () => {
    expect(fehlendeAngaben(r, rechnung({}, [{ preis: "-45,00" }]), BETRIEB)).toContain(RECHNUNG_NEGATIV);
    expect(fehlendeAngaben(r, rechnung({ storno_zu: "2026-000" }, [{ preis: "-45,00" }]), BETRIEB)).not.toContain(RECHNUNG_NEGATIV);
    // Nachlass-Zeile in einer positiven Rechnung ist in Ordnung
    expect(fehlendeAngaben(r, rechnung({}, [{ preis: "100,00" }, { bezeichnung: "Nachlass", preis: "-10,00" }]), BETRIEB)).toEqual([]);
  });
  it("PLZ und Ort des Empfängers: in Deutschland Pflicht, im Ausland mit Landzeile nicht geprüft", () => {
    expect(fehlendeAngaben(r, rechnung({ kunde_anschrift: "Weg 1" }, [{ preis: "45,00" }]), BETRIEB)).toContain(RECHNUNG_PLZ_FEHLT);
    expect(fehlendeAngaben(r, rechnung({ kunde_anschrift: "Weg 1\nMusterstadt" }, [{ preis: "45,00" }]), BETRIEB)).toContain(RECHNUNG_PLZ_FEHLT);
    expect(fehlendeAngaben(r, rechnung({ kunde_anschrift: "10 Downing Street\nLondon SW1A 2AA\nVereinigtes Königreich" }, [{ preis: "45,00" }]), BETRIEB)).not.toContain(RECHNUNG_PLZ_FEHLT);
    expect(fehlendeAngaben(r, rechnung({ kunde_anschrift: "Ring 1\nA-1010 Wien" }, [{ preis: "45,00" }]), BETRIEB)).not.toContain(RECHNUNG_PLZ_FEHLT);
  });
  it("Meldungen lassen sich einem Feld zuordnen (Ergänzen im Abschluss)", () => {
    const felder = new Set(r.abschnitte.flatMap((a) => a.felder.map((f) => f.id)));
    for (const [m, feld] of Object.entries(r.pruefenZu ?? {})) expect(felder.has(feld), m).toBe(true);
    expect(r.pruefenZu?.[RECHNUNG_PLZ_FEHLT]).toBe("kunde_anschrift");
  });
  it("neue Position: Einheit „Stück“ vorbelegt; Kleinunternehmer-Schalter unter „Weitere Angaben“", () => {
    const pos = r.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "positionen") as Extract<Feld, { art: "liste" }>;
    expect(neuerEintrag(pos, BETRIEB, "2026-10-12").einheit).toBe("Stück");
    expect(r.abschnitte.flatMap((a) => a.felder).find((f) => f.id === "kleinunternehmer")?.selten).toBe(true);
    // eine neue, unberührte Position zählt nicht als Eintrag
    const d = leereDaten(r, BETRIEB, "2026-10-12");
    expect(fehlendeAngaben(r, d)).toContain("mindestens ein Eintrag: Position");
  });
});

describe("Mein Betrieb: Plausibilität", () => {
  it("IBAN: Prüfsumme mod 97, Länge je Land, Leerzeichen und Kleinbuchstaben egal", () => {
    expect(ibanGueltig("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(ibanGueltig("de89370400440532013000")).toBe(true);
    expect(ibanGueltig("DE89 3704 0044 0532 0130 01")).toBe(false); // Tippfehler
    expect(ibanGueltig("DE98 3704 0044 0532 0130 00")).toBe(false); // Zahlendreher in der Prüfziffer
    expect(ibanGueltig("DE89 3704 0044 0532 0130")).toBe(false); // zu kurz
    expect(ibanGueltig("AT61 1904 3002 3457 3201")).toBe(true);
    expect(ibanGueltig("")).toBe(true);
  });
  it("PLZ fünfstellig, E-Mail mit Punkt in der Domain", () => {
    expect(plzGueltig("10115")).toBe(true);
    expect(plzGueltig("1011")).toBe(false);
    expect(plzGueltig("")).toBe(true);
    expect(emailGueltig("info@salon-sonne.de")).toBe(true);
    expect(emailGueltig("info@salon-sonne")).toBe(false);
    expect(emailGueltig("info salon@x.de")).toBe(false);
  });
});

describe("Kurztitel", () => {
  it("nie mitten in einer Klammer, nie vor einem halben Titel", () => {
    expect(kurztitel("Waschbecken (Haarwaschbecken, Handwaschbecken, Sanitär)")).toBe("Waschbecken (Haarwaschbecken, Handwaschbecken, Sanitär)");
    expect(kurztitel("Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)")).toBe("Tiefkühlung (Tiefkühltruhe/-raum, tiefgefrorene Lebensmittel)");
    expect(kurztitel("Spitze, scharfe, zerbrechliche Gegenstände (Klingen, Lanzetten, Kanülen)")).toBe("Spitze, scharfe, zerbrechliche Gegenstände");
    expect(kurztitel("Lagerung von Reinigungsmitteln; getrennt von Lebensmitteln")).toBe("Lagerung von Reinigungsmitteln");
    expect(kurztitel("Brandgefahr bei Druckgasflaschen (z. B. Flüssiggas)")).toBe("Brandgefahr bei Druckgasflaschen");
    // bisheriges Verhalten bleibt
    expect(kurztitel("Ausrutschen, Stolpern und Stürzen durch glatte Böden, Schmierfilme oder Fußmatten.")).toBe("Ausrutschen, Stolpern und Stürzen");
    expect(kurztitel("Unzureichende Frischluftzufuhr, dadurch Belastung durch Dämpfe")).toBe("Unzureichende Frischluftzufuhr");
  });
  it("in einer Liste: gleiche Kurztitel werden verlängert, bis sie sich unterscheiden", () => {
    expect(kurztitelListe(["Färben, Dauerwelle, Blondierung: Mischen, Auftragen, Überprüfen", "Färben, Dauerwelle, Blondierung: Aufemulgieren, Auswaschen", "Haare waschen"])).toEqual(["Färben, Dauerwelle, Blondierung: Mischen", "Färben, Dauerwelle, Blondierung: Aufemulgieren", "Haare waschen"]);
    expect(kurztitelListe(["Umgang mit Blut – Verletzung des Kunden", "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person"])).toEqual(["Umgang mit Blut – Verletzung des Kunden", "Umgang mit Blut – Stich-/Schnittverletzung der beschäftigten Person"]);
    // gleiche Volltitel bleiben gleich (kein endloses Verlängern)
    expect(kurztitelListe(["Kühlschrank", "Kühlschrank"])).toEqual(["Kühlschrank", "Kühlschrank"]);
  });
  it("alle Vorschlagslisten: eindeutige Kurztitel, keine offene Klammer", () => {
    for (const v of VORLAGEN)
      for (const f of v.abschnitte.flatMap((a) => a.felder))
        if (f.art === "liste" && f.vorschlaege) {
          const titel = f.vorschlaege.map((s) => s.titel);
          const kurz = kurztitelListe(titel);
          expect(new Set(kurz).size, `${v.id}.${f.id}`).toBe(new Set(titel).size);
          for (const k of kurz) expect((k.match(/\(/g) ?? []).length, k).toBe((k.match(/\)/g) ?? []).length);
        }
  });
});
