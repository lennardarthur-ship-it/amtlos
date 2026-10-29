/**
 * E-210 (externer Prüfer): Datenschutzerklärung und Impressum mit „[bitte ergänzen]“ sahen fertig aus – jetzt gelten Lücken
 * als fehlende Angabe (Liste nicht „fertig“, „Fehlt noch“ am Dokument), Hinweis am Dokument und in der Vorschau, Rückfrage
 * vor Teilen, Drucken und „Als Text teilen“.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LUECKEN_IM_TEXT, vorlageFuer } from "@amtlos/fachlogik";
import { fehltAnzahl } from "../src/unterlagen/ablage";
import { fehltFuer, lueckenFrage } from "../src/unterlagen/pruefung";
import { LEERER_STAND, type Stand, type Unterlage } from "../src/unterlagen/speicher";
import { T as TEXT } from "../src/texte";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const lies = (datei: string) => readFileSync(path.join(HIER, "..", datei), "utf8");
const BETRIEB = { ...LEERER_STAND.betrieb, name: "Café Linde", strasse: "Marktplatz 3", plz: "72764", ort: "Reutlingen", telefon: "07121 123456", email: "info@linde.example", bundesland: "Baden-Württemberg", verantwortlich: "Mara Linde" };
const unterlage = (id: string, vorlage: string, daten: Unterlage["daten"]): Unterlage => ({ id, vorlage, daten, erstellt: "2026-10-26T10:00:00.000Z", geaendert: "2026-10-26T10:00:00.000Z" });

describe("E-210: Lücken im Text von Impressum und Datenschutzerklärung", () => {
  const dseLuecke = unterlage("d1", "datenschutzerklaerung_website", { module: ["hosting", "kontakt"], stand: "2026-10-26" });
  const dseVoll = unterlage("d2", "datenschutzerklaerung_website", { module: ["hosting", "kontakt"], hoster_name: "Muster Hosting GmbH", hoster_anschrift: "Hoststraße 1, 10115 Berlin", stand: "2026-10-26" });
  const impLuecke = unterlage("i1", "impressum", { vertreten: "Mara Linde", register_gericht: "Amtsgericht Stuttgart" });
  const s: Stand = { ...LEERER_STAND, betrieb: BETRIEB, unterlagen: [dseLuecke, dseVoll, impLuecke] };

  it("Lücken zählen als fehlende Angabe – in „Fehlt noch“ und in der Liste (nicht „fertig“)", () => {
    expect(fehltFuer(s, dseLuecke)).toEqual([LUECKEN_IM_TEXT(2)]);
    expect(fehltAnzahl(s, dseLuecke)).toBe(1);
    expect(fehltFuer(s, impLuecke)).toEqual([LUECKEN_IM_TEXT(1)]);
    expect(fehltFuer(s, dseVoll)).toEqual([]);
    expect(fehltAnzahl(s, dseVoll)).toBe(0);
  });

  it("Rückfrage vor dem Weitergeben nur mit Lücken", () => {
    expect(lueckenFrage(vorlageFuer("datenschutzerklaerung_website")!, dseLuecke.daten, BETRIEB)).toEqual({ titel: TEXT.e210_luecken_titel(2), text: TEXT.e210_luecken_text, ja: TEXT.e210_luecken_ja });
    expect(lueckenFrage(vorlageFuer("datenschutzerklaerung_website")!, dseVoll.daten, BETRIEB)).toBeNull();
    expect(lueckenFrage(vorlageFuer("rechnung")!, {}, BETRIEB)).toBeNull();
    expect(TEXT.e210_luecken_titel(1)).toBe("Im Text fehlt noch eine Angabe");
    expect(TEXT.e210_luecken_hinweis(2)).toContain("[bitte ergänzen]");
  });

  it("Abschluss: Hinweis am Dokument und in der Vorschau, Rückfrage vor PDF teilen/drucken und „Als Text teilen“", () => {
    const a = lies("src/seiten/Abschluss.tsx");
    // PDF teilen und drucken laufen beide über `ausgabe`
    const ausgabe = a.slice(a.indexOf("const ausgabe = async"), a.indexOf("const [eFehlt"));
    // E-220 (8b): Betrieb wie gedruckt (festgeschrieben der festgehaltene, sonst „Mein Betrieb“ nach der Pro-Regel)
    expect(ausgabe).toMatch(/lueckenFrage\(v, u\.daten, druckBetrieb\(z\.stand, u, z\.pro\)\)[\s\S]*if \(luecken && !\(await bestaetigen\(luecken\)\)\) return;[\s\S]*pdfAusgabe\(u, /);
    const text = a.slice(a.indexOf("symbol: \"doc.on.doc\""), a.indexOf("symbol: \"plus.circle\""));
    expect(text).toMatch(/lueckenFrage\(v, d, absenderFuer\(z\.stand, u\)\)[\s\S]*bestaetigen\(luecken\)[\s\S]*Share\.share/);
    // E-239: als Blocker (im Kasten „Fehlt noch“ bzw. im eigenen Kasten) – und in der Vorschau
    expect(a.match(/TEXT\.e210_luecken_hinweis\(luecken\)/g)).toHaveLength(2);
    expect(a).toContain("luecken ? blocker(TEXT.e210_luecken_hinweis(luecken)) : null");
  });
});
