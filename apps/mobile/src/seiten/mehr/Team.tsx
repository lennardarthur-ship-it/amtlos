import { useState } from "react";
import { Pressable, Share } from "react-native";
import { datumLang, fuelle } from "@amtlos/i18n";
import type { Team as TeamT } from "../../kern/typen";
import { Feld, Hinweis, Karte, Knopf, T, Wahl, Zeile } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useFarben } from "../../ui/thema";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, useAktion, useLaden } from "../gemeinsam";

const ROLLEN = ["mitarbeiter", "steuerberater", "admin", "inhaber"] as const;

/** Team: wer Zugriff hat, jemanden einladen (Link teilen), offene Einladungen zurückziehen. */
export function Team() {
  const { t, sprache, klient, unternehmenId, demo } = useAmtlos();
  const f = useFarben();
  const { daten, neu } = useLaden(() => klient.holen<TeamT>("/v1/team"), [unternehmenId]);
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState<(typeof ROLLEN)[number]>("mitarbeiter");
  const aktion = useAktion();
  const rollen = t.team.rollen as Record<string, string>;
  const rollenText = t.team.rollen_text as Record<string, string>;
  return (
    <Unterseite titel={t.team.titel}>
      <Inhalt>
        <T leise>{t.team.text}</T>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        {daten ? (
          <Karte stil={{ marginTop: 16 }}>
            {daten.mitglieder.map((m, i) => (
              <Zeile key={m.konto_id} titel={`${m.anzeigename}${m.ich ? ` (${t.team.du})` : ""}`} text={`${rollen[m.rolle] ?? m.rolle} · ${m.email}`} letzte={i === daten.mitglieder.length - 1} />
            ))}
          </Karte>
        ) : null}
        {daten?.einladungen.length ? (
          <Gruppe titel={t.team.offen_titel}>
            <Karte>
              {daten.einladungen.map((e, i) => (
                <Zeile
                  key={e.id}
                  titel={e.email}
                  text={`${rollen[e.rolle]} · ${fuelle(t.team.gueltig_bis, { datum: datumLang(e.laeuft_ab.slice(0, 10), sprache) })}`}
                  rechts={
                    <Pressable accessibilityRole="button" accessibilityLabel={fuelle(t.team.widerrufen_von, { email: e.email })} onPress={() => void aktion.ausfuehren(async () => { await klient.schicken(`/v1/einladungen/${e.id}`, "DELETE"); await neu(); })} style={{ minHeight: 40, justifyContent: "center" }}>
                      <T v="klein" farbe={f.frist}>{t.team.widerrufen}</T>
                    </Pressable>
                  }
                  letzte={i === daten.einladungen.length - 1}
                />
              ))}
            </Karte>
          </Gruppe>
        ) : null}
        {daten?.darf_verwalten ? (
          <Gruppe titel={t.team.einladen_titel} fuss={t.team.einladen_text}>
            <Karte stil={{ paddingBottom: 14 }}>
              <Feld label={t.team.email} wert={email} aendern={setEmail} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
              <Wahl label={t.team.rolle} wert={rolle} aendern={setRolle} optionen={ROLLEN.map((r) => ({ wert: r, text: rollen[r]! }))} />
              <T v="caption" leise stil={{ marginTop: 6 }}>{rollenText[rolle]}</T>
              <Knopf
                text={t.team.einladen}
                deaktiviert={!email.includes("@")}
                laedt={aktion.laedt}
                onPress={() =>
                  void aktion.ausfuehren(async () => {
                    const r = await klient.schicken<{ link: string | null }>("/v1/einladungen", "POST", { email, rolle });
                    setEmail("");
                    await neu();
                    if (r.link) await Share.share({ message: r.link });
                  }, demo ? t.mobil.einladung_demo : fuelle(t.team.gesendet, { email }))
                }
                stil={{ marginTop: 16 }}
              />
            </Karte>
          </Gruppe>
        ) : (
          <T v="caption" leise stil={{ marginTop: 12 }}>{t.team.nur_lesen}</T>
        )}
      </Inhalt>
    </Unterseite>
  );
}
