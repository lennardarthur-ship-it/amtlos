import { Text, View } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Karte as KarteT } from "../kern/api";
import { Absatz, Hinweis, Karte, Titel } from "../ui/bausteine";
import { GROESSE, useFarben } from "../ui/thema";
import { useAmtlos } from "../zustand";
import { Seite, useLaden } from "./gemeinsam";

const RAND = { ueberfaellig: "frist", faellig_bald: "bald" } as const;

export function PflichtKarte({ k }: { k: KarteT }) {
  const { t, sprache } = useAmtlos();
  const f = useFarben();
  const status = (t.status as Record<string, string>)[k.status] ?? k.status;
  return (
    <Karte rand={RAND[k.status as keyof typeof RAND]}>
      <Text style={{ fontSize: GROESSE.gross, fontWeight: "700", color: f.tinte }}>{k.titel}</Text>
      <Absatz stil={{ marginTop: 4 }}>{k.kurz}</Absatz>
      <Text style={{ marginTop: 8, fontSize: GROESSE.klein, fontWeight: "700", color: k.status === "ueberfaellig" ? f.frist : k.status === "faellig_bald" ? f.bald : f.tinteLeise }}>
        {status}
        {k.faellig_am ? ` · ${fuelle(t.pflichten.bis, { datum: datumLang(k.faellig_am, sprache) })}` : ""}
      </Text>
    </Karte>
  );
}

export function Heute() {
  const { t, klient, unternehmenId, wartend, fehlgeschlagen, online } = useAmtlos();
  const f = useFarben();
  const { daten, fehler, laedt, neu } = useLaden(() => klient.heute(), [unternehmenId]);
  return (
    <Seite laedt={laedt} neu={neu}>
      <Titel>{t.heute.titel}</Titel>
      {!online ? <Hinweis text={t.mobil.offline} /> : null}
      {wartend ? <Hinweis text={fuelle(t.mobil.wartend, { n: wartend })} /> : null}
      {fehlgeschlagen.length ? <Hinweis art="fehler" text={fuelle(t.mobil.fehlgeschlagen, { n: fehlgeschlagen.length })} /> : null}
      {fehler ? <Hinweis art="fehler" text={fehler} /> : null}
      {daten ? (
        <View>
          <Text accessibilityRole="header" style={{ fontSize: GROESSE.gross, fontWeight: "700", marginTop: 8, color: f.tinte }}>
            {t.heute.als_naechstes}
          </Text>
          <Absatz leise>
            {[fuelle(t.heute.zaehler_offen, { n: daten.zaehler.offen }), daten.zaehler.ueberfaellig ? fuelle(t.heute.zaehler_ueberfaellig, { n: daten.zaehler.ueberfaellig }) : null].filter(Boolean).join(", ")}
          </Absatz>
          {daten.als_naechstes.length ? daten.als_naechstes.map((k) => <PflichtKarte key={`${k.pflicht_id}|${k.periode}`} k={k} />) : <Absatz>{t.mobil.nichts_offen}</Absatz>}
        </View>
      ) : null}
    </Seite>
  );
}
