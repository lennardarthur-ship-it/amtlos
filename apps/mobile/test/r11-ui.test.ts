/** Befunde R11 (Oberfläche): Kontrollmappe je Monat, Unvollständiges, Kontrollbereit, BG-Nachweise, „Was hast du schon?“, Texte. */
import { describe, expect, it } from "vitest";
import { auswertung } from "../src/pflichten/check";
import { langBestehend, schonDaKandidaten } from "../src/seiten/schonDa";
import { T as TEXT } from "../src/texte";
import { trennen } from "../src/ui/trennen";
import { BG_NACHWEISE, BG_SCHLUESSEL, bgVorhanden, deckblattHtml, fuerKontrolle, kontrollbereit, mappenAuswahl } from "../src/unterlagen/kontrollmappe";
import { LEERER_STAND, anlegen, ausgeben, betriebSetzen, erledigtSetzen, felderSetzen, type Stand } from "../src/unterlagen/speicher";

const B = { ...LEERER_STAND.betrieb, name: "Glanzwerk", strasse: "Hafenstraße 4", plz: "44137", ort: "Dortmund", verantwortlich: "Dragana Petrović", bundesland: "Nordrhein-Westfalen", steuernummer: "315/123/45678" };
const t = (d: string) => new Date(`${d}T09:00:00Z`);

function mitNachweisen(): Stand {
  let s = betriebSetzen(LEERER_STAND, B);
  const azn = (id: string, monat: string, teilen: boolean) => {
    const [s1] = anlegen(s, "arbeitszeitnachweis", t(`${monat}-28`), id);
    s = felderSetzen(s1, id, { name: "Amira", tage: [{ datum: `${monat}-05`, beginn: "05:00", ende: "09:00", pause: "" }] } as never, t(`${monat}-28`));
    if (teilen) s = ausgeben(s, id, t(`${monat}-28`));
  };
  azn("a1", "2026-09", true);
  azn("a2", "2026-10", true);
  azn("a0", "2024-05", true);
  // unvollständig: Gefährdungsbeurteilung ohne Angaben
  const [s2] = anlegen(s, "gefaehrdungsbeurteilung", t("2026-10-01"), "g1");
  return s2;
}

describe("Kontrollmappe (Reinigung #2, UX #5, Tischlerei #22)", () => {
  it("Zoll: alle Monate der letzten zwei Jahre je Person, mit Monat im Eintrag", () => {
    const a = mappenAuswahl(mitNachweisen(), "2026-10-20");
    const azn = a.eintraege.filter((e) => e.vorlage === "arbeitszeitnachweis");
    expect(azn.map((e) => e.titel).sort()).toEqual(["Arbeitszeitnachweis Oktober 2026 · Amira", "Arbeitszeitnachweis September 2026 · Amira"]);
    expect(azn.every((e) => fuerKontrolle(e.vorlage, "zoll"))).toBe(true);
  });
  it("unvollständige Unterlagen einzeln mit der Zahl fehlender Angaben", () => {
    const a = mappenAuswahl(mitNachweisen(), "2026-10-20");
    expect(a.unvollstaendig).toBe(1);
    expect(a.unvollstaendigListe[0]).toMatchObject({ id: "g1", vorlage: "gefaehrdungsbeurteilung" });
    expect(a.unvollstaendigListe[0]!.fehlt).toBeGreaterThan(0);
    expect(TEXT.r11_mappe_halb_zeile(3)).toBe("3 Angaben fehlen – ergänzen");
  });
  it("Kontrollbereit: x von y Nachweisen", () => {
    const s = mitNachweisen();
    const k = kontrollbereit(s, [{ id: "arbeitsschutz.gefaehrdungsbeurteilung", titel: "GB", vorlagen: ["gefaehrdungsbeurteilung"] }, { id: "arbeitsschutz.erstunterweisung", titel: "UW", vorlagen: ["unterweisung"] }], "2026-10-20");
    expect(k).toEqual({ da: 2, gesamt: 4 });
    expect(TEXT.r11_kontrollbereit(2, 4)).toBe("Für Kontrollen: 2 von 4 Nachweisen da");
  });
  it("BG-Nachweise ohne Vorlage: abhaken, auf dem Deckblatt „vorhanden“", () => {
    let s = mitNachweisen();
    s = erledigtSetzen(s, BG_SCHLUESSEL("ersthelfer"), "2026-10-20");
    expect(bgVorhanden(s.erledigt)).toEqual([BG_NACHWEISE.find((n) => n.id === "ersthelfer")!.titel]);
    expect(deckblattHtml("Glanzwerk", "2026-10-20", [], "Arbeitsschutz und BG", bgVorhanden(s.erledigt))).toContain("Außerdem im Betrieb vorhanden");
    expect(deckblattHtml("Glanzwerk", "2026-10-20", [])).not.toContain("Außerdem im Betrieb vorhanden");
  });
  it("Anamnese gehört nicht in die Mappe, der Ausweis-Hinweis in die Zoll-Mappe", () => {
    expect(fuerKontrolle("anamnese_einwilligung", "alle")).toBe(false);
    expect(fuerKontrolle("ausweis_hinweis", "zoll")).toBe(true);
  });
});

describe("„Was hast du schon?“ (Berater d)", () => {
  const profil = { "taetigkeit.branchen": ["handwerk"], rechtsform: "einzelunternehmen", "taetigkeit.einordnung": "gewerbe", bundesland: "NW", "beschaeftigte.gesamt": 2, "personal.lohn_durch": "steuerberatung", "kasse.elektronisch": true, "ust.kleinunternehmer": false, gruendungsdatum: "2019-04-01" };
  // R12 (UX #1): schon ab vier Wochen seit Beginn (vorher zwölf Monate)
  it("ab vier Wochen seit Beginn", () => {
    expect(langBestehend(profil, "2026-10-20")).toBe(true);
    expect(langBestehend({ gruendungsdatum: "2026-01-15" }, "2026-10-20")).toBe(true);
    expect(langBestehend({ gruendungsdatum: "2026-09-22" }, "2026-10-20")).toBe(true);
    expect(langBestehend({ gruendungsdatum: "2026-09-23" }, "2026-10-20")).toBe(false);
    expect(langBestehend({}, "2026-10-20")).toBe(false);
  });
  it("nur einmalige, offene, echte Pflichten – nichts, was Lohnbüro oder Steuerberatung macht", () => {
    const a = auswertung(profil, "2026-10-20");
    const l = schonDaKandidaten(a, { erledigt: {}, unterlagen: [], betrieb: B });
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((p) => p.einordnung === "pflicht" && !p.lohnbuero && !p.wiederkehrend && p.erledigung.art !== "laufend")).toBe(true);
    const erste = l[0]!;
    expect(schonDaKandidaten(a, { erledigt: { [erste.id]: "2026-10-20" }, unterlagen: [], betrieb: B }).some((p) => p.id === erste.id)).toBe(false);
  });
});

describe("Texte (Recht #14, #15, UX #2, #14)", () => {
  it("„in Frage kommen“ statt „gelten“, keine Vollständigkeit der Kontrollmappe", () => {
    expect(TEXT.check_einleitung_titel).toContain("in Frage");
    expect(TEXT.ergebnis_titel(3)).toBe("Für deinen Betrieb kommen 3 Pflichten in Frage");
    expect(TEXT.kontrollmappe_art_hilfe.alle).not.toMatch(/was die Stelle sehen muss/);
  });
  it("offene Frage beim Namen", () => {
    expect(TEXT.r10_check_fortsetzen_text(1, "Gehört dein Betrieb zu einer dieser Branchen?", 4)).toBe("Offen: „Gehört dein Betrieb zu einer dieser Branchen?“ – eine Antwort klärt 4 Pflichten.");
  });
  it("Sync-Sätze nur in eigenen Texten", () => {
    expect(TEXT.alles_loeschen_text).not.toMatch(/Synchronisation/);
    expect(TEXT.alles_loeschen_kopien_hinweis).not.toMatch(/Sync/);
    expect(TEXT.r11_alles_loeschen_kopien_sync).toMatch(/Sync-Server/);
  });
});

describe("Silbentrennung (UX #11)", () => {
  const ohne = (t: string) => t.replace(/\u00AD/g, "-");
  it("Fugen-s bleibt am ersten Wortteil, feste Ausnahmen nach Duden", () => {
    expect(ohne(trennen("Betriebsarzt"))).toBe("Be-triebs-arzt");
    expect(ohne(trennen("Jahresabschluss"))).toBe("Jah-res-ab-schluss");
    expect(ohne(trennen("wiederherstellen"))).toBe("wie-der-her-stel-len");
    expect(ohne(trennen("weiterempfehlen"))).toBe("wei-ter-emp-feh-len");
    expect(ohne(trennen("Sicherheitsunterweisung"))).toBe("Si-cher-heits-un-ter-wei-sung");
  });
});
