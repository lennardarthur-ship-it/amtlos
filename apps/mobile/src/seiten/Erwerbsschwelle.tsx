/**
 * E-227 (Steuerberater 27.10.2026, T-309): Fragen und Lage zur Erwerbsschwelle (§ 1a Abs. 3, 4 UStG) – am Beleg mit
 * innergemeinschaftlichem Erwerb und bei der Übernahme in die Voranmeldung, nur für Kleinunternehmer und Betriebe mit nur
 * steuerfreien Umsätzen. Die Antworten stehen im Profil (`VERZICHT_FELD`, `ueberFeld(jahr)`).
 */
import { View } from "react-native";
import { T as TEXT } from "../texte";
import { Hinweis, T, Wahl } from "../ui/bausteine";
import { useFarben } from "../ui/thema";
import { regelwert } from "../pflichten/check";
import { ERWERBSSCHWELLE_REGELWERT, VERZICHT_FELD, erwerbsschwelleLage, ueberFeld, type ErwerbsschwelleLage } from "../unterlagen/erwerbsschwelle";
import { useAmtlos } from "../zustand";

const EURO = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const euro = (c: number) => `${EURO.format(c / 100)} €`;
const euroGanz = (c: number) => `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(c / 100)} €`;

/** Regelwert der Erwerbsschwelle in Euro (Katalog) – null, wenn er fehlt. */
export const erwerbsschwelleEuro = () => regelwert(ERWERBSSCHWELLE_REGELWERT);

/** Satz zur Lage (ja/nein/offen) mit dem Grund. */
export function lageText(l: ErwerbsschwelleLage): string {
  const s = l.schwelle_cent !== null ? euroGanz(l.schwelle_cent) : "";
  if (l.grund === "verzicht") return TEXT.e227_status.verzicht;
  if (l.grund === "vorjahr") return TEXT.e227_status.vorjahr(String(Number(l.jahr) - 1), s);
  if (l.grund === "angabe") return TEXT.e227_status.angabe(s);
  if (l.grund === "verneint") return TEXT.e227_status.verneint(s);
  return TEXT.e227_status.offen;
}

/** Fragen zur Erwerbsschwelle für ein Kalenderjahr, mit Lage und Hinweis. */
export function ErwerbsschwelleFragen({ jahr }: { jahr: string }) {
  const z = useAmtlos();
  const f = useFarben();
  const l = erwerbsschwelleLage(z.stand.profil, z.stand.belege, jahr, erwerbsschwelleEuro());
  const schwelle = l.schwelle_cent !== null ? euroGanz(l.schwelle_cent) : "";
  const jaNein = (w: boolean | null) => (w === null ? null : w ? "ja" : "nein");
  // die zweite Frage nur, solange Verzicht und Vorjahr laut Belegen nicht schon entscheiden
  const zweite = l.grund !== "verzicht" && l.grund !== "vorjahr" && l.schwelle_cent !== null;
  return (
    <View style={{ marginTop: 8, gap: 6 }}>
      <T v="klein" fett>{TEXT.e227_schwelle_titel}</T>
      <Hinweis art={l.status === "offen" ? "warnung" : "info"} text={lageText(l)} />
      <Wahl label={TEXT.e227_frage_verzicht} wert={jaNein(l.verzicht)} aendern={(w) => z.profilSetzen({ [VERZICHT_FELD]: w === "ja" })} optionen={[{ wert: "ja", text: TEXT.ja }, { wert: "nein", text: TEXT.nein }]} />
      {zweite ? (
        <View>
          <Wahl label={TEXT.e227_frage_ueber(String(Number(jahr) - 1), jahr, schwelle)} wert={jaNein(l.ueber)} aendern={(w) => z.profilSetzen({ [ueberFeld(jahr)]: w === "ja" })} optionen={[{ wert: "ja", text: TEXT.ja }, { wert: "nein", text: TEXT.nein }]} />
          <T v="caption" leise stil={{ marginTop: 4 }}>{TEXT.e227_schwelle_belege(String(Number(jahr) - 1), euro(l.vorjahr_cent), jahr, euro(l.jahr_cent))}</T>
        </View>
      ) : null}
      <T v="caption" farbe={f.amtTief}>{TEXT.e227_schwelle_hinweis(schwelle || "der Erwerbsschwelle")}</T>
    </View>
  );
}
