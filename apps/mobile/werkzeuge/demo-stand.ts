/**
 * Demo-Stand für Store-Screenshots und Vorführungen (E-132): ein fiktiver Salon mit Rechnungen, Unterlagen,
 * Mitarbeitern und beantwortetem Pflichten-Check – erzeugt mit denselben Funktionen wie die App.
 * Alle Namen und Nummern sind erfunden; die IBAN ist die übliche Beispiel-IBAN.
 *
 *   node werkzeuge/store-bilder.mjs   (baut diese Datei mit esbuild und nutzt den Stand)
 */
import { auswertung } from "../src/pflichten/check";
import { LEERER_STAND, anlegen, ausgeben, bezahltSetzen, erledigtSetzen, felderSetzen, personSetzen, type Stand } from "../src/unterlagen/speicher";

const t = (d: string, h = 9) => new Date(`${d}T${String(h).padStart(2, "0")}:00:00Z`);

export function demoStand(heute = "2026-10-13"): Stand {
  let s: Stand = {
    ...LEERER_STAND,
    betrieb: {
      ...LEERER_STAND.betrieb,
      name: "Salon Sonne",
      strasse: "Hauptstraße 1",
      plz: "80331",
      ort: "München",
      bundesland: "Bayern",
      verantwortlich: "Alex Sonnberg",
      telefon: "089 123456",
      email: "hallo@salon-sonne.example",
      steuernummer: "143/123/45678",
      iban: "DE89370400440532013000",
      bank: "Beispielbank",
      bic: "COBADEFFXXX",
      farbe: "#702434",
      versteuerung: "soll",
    },
    profil: {
      "taetigkeit.branchen": ["beauty_kosmetik"],
      rechtsform: "einzelunternehmen",
      "taetigkeit.einordnung": "gewerbe",
      bundesland: "BY",
      "beschaeftigte.gesamt": 3,
      "kasse.elektronisch": true,
      "online.website": false,
      "ust.kleinunternehmer": false,
      steuerberater: false,
      gruendungsdatum: "2024-03-01",
    },
    proTest: true,
    erinnerungen: true,
    letzteSicherung: t(heute, 8).toISOString(),
  };
  for (const [id, name, rest] of [
    ["k1", "Kim Beispiel", { anschrift: "Gartenweg 3\n80333 München", email: "kim@example.org" }],
    ["k2", "Studio Nord GmbH", { anschrift: "Leopoldstraße 20\n80802 München", email: "buchhaltung@studio-nord.example", ust_idnr: "DE123456789" }],
    ["k3", "Hotel Isar", { anschrift: "Isarring 5\n80805 München", email: "einkauf@hotel-isar.example" }],
  ] as const)
    s = personSetzen(s, "kunde", { id, name, ...rest });
  for (const [id, name, taetigkeit] of [
    ["m1", "Sam Muster", "Friseur/in"],
    ["m2", "Lea Wagner", "Auszubildende"],
  ] as const)
    s = personSetzen(s, "mitarbeiter", { id, name, taetigkeit });

  const rechnungen: [string, string, string, string, [string, string, string][], string | null][] = [
    ["r1", "2026-09-04", "Kim Beispiel", "Gartenweg 3\n80333 München", [["Damenhaarschnitt mit Föhnen", "1", "58,82"], ["Coloration", "1", "75,63"]], "2026-09-10"],
    ["r2", "2026-09-22", "Hotel Isar", "Isarring 5\n80805 München", [["Hochsteckfrisuren Hochzeitsgesellschaft", "6", "65,00"], ["Anfahrt", "1", "25,00"]], "2026-10-01"],
    ["r3", "2026-10-02", "Studio Nord GmbH", "Leopoldstraße 20\n80802 München", [["Styling Fotoproduktion (Stunden)", "8", "55,00"], ["Pflegeprodukte", "4", "18,49"]], null],
    ["r4", "2026-10-09", "Kim Beispiel", "Gartenweg 3\n80333 München", [["Herrenhaarschnitt", "2", "29,41"], ["Bartpflege", "1", "16,81"]], null],
  ];
  for (const [id, datum, kunde, anschrift, pos, bezahlt] of rechnungen) {
    const [s1] = anlegen(s, "rechnung", t(datum), id);
    s = felderSetzen(s1, id, { datum, kunde_name: kunde, kunde_anschrift: anschrift, positionen: pos.map(([bezeichnung, menge, preis]) => ({ bezeichnung, menge, einheit: "", preis, satz: "19" })), hinweis: "Vielen Dank für Ihren Auftrag." }, t(datum));
    s = ausgeben(s, id, t(datum, 10));
    if (bezahlt) s = bezahltSetzen(s, id, bezahlt);
  }
  for (const [id, vorlage, tag] of [
    ["h1", "hygieneplan", "2026-09-15"],
    ["g1", "gefaehrdungsbeurteilung", "2026-09-18"],
    ["s1", "hautschutzplan", "2026-09-18"],
    ["n1", "nachweis_arbeitsbedingungen", "2026-10-05"],
  ] as const) {
    const [s1] = anlegen(s, vorlage, t(tag), id);
    s = s1;
  }
  // ein Teil der Pflichten ist abgehakt – der Fortschritt soll echt aussehen
  const a = auswertung(s.profil, heute);
  for (const p of a.gilt.filter((p) => !p.wiederkehrend).slice(0, 11)) s = erledigtSetzen(s, p.id, "2026-09-20");
  for (const p of a.gruendung) s = erledigtSetzen(s, p.id, "2024-03-01");
  return { ...s, geaendert: t(heute, 8).toISOString() };
}

// als Skript: JSON auf stdout
console.log(JSON.stringify(demoStand()));
