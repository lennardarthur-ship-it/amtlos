import { useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { festpreisText, gebietText, mailtoLink, sichtbareKanzleien, telLink, type Kanzlei } from "../partner/kanzleien";
import { T as TEXT } from "../texte";
import { Fuss, Hinweis, Karte, Knopf, Marke, Symbol, T, Zeile } from "../ui/bausteine";
import { useNav } from "../ui/navigation";
import { useFarben } from "../ui/thema";
import { heute } from "../unterlagen/speicher";
import { BuehnenBlatt, Gruppe } from "./gemeinsam";

/**
 * „Steuerberatung finden“ (docs/15-partnerkanzleien.md): gelistete Kanzleien mit fester Listungsgebühr, nie gegen
 * Provision. Nur sichtbar, wenn mindestens eine gültige Kanzlei in der gebündelten Liste steht. Die Liste und der
 * Kontakt sind für alle frei; das Paket bleibt eine Pro-Funktion (die Prüfung macht `senden`, wie bisher).
 */

/** Gibt es Kanzleien zum Zeigen? `liste` nur für Tests und die Sichtprüfung. */
export const kanzleienSichtbar = (liste?: readonly Kanzlei[]) => sichtbareKanzleien(heute(), liste).length > 0;

/** Transparenz – steht immer im Bereich, unabhängig von der Zahl der Kanzleien. */
function Transparenz() {
  return (
    <View style={{ marginTop: 10, gap: 4 }}>
      <T v="caption" leise>{TEXT.kanzlei_transparenz}</T>
      <T v="caption" leise>{TEXT.kanzlei_daten}</T>
    </View>
  );
}

/** Abschnitt in „Für die Steuerberatung“. `senden(k)` erstellt das vorhandene Steuerberater-Paket für Kanzlei k. */
export function KanzleienAbschnitt({ senden, kannSenden, pro, erste }: { senden: (k: Kanzlei) => void; kannSenden: boolean; pro: boolean; erste?: boolean }) {
  const nav = useNav();
  const f = useFarben();
  const liste = sichtbareKanzleien(heute());
  if (!liste.length) return null;
  return (
    <Gruppe titel={TEXT.kanzlei_finden} hilfe={TEXT.kanzlei_finden_text} erste={erste}>
      <Karte stil={{ paddingVertical: 4 }}>
        {liste.map((k, i) => (
          <Pressable key={k.id} accessibilityRole="button" accessibilityLabel={`${k.name}, ${k.berufsbezeichnung}, ${k.ort}${k.datev ? `, ${TEXT.kanzlei_datev}` : ""}`} onPress={() => nav.oeffnen(`kanzlei-${k.id}`, () => <KanzleiDetail k={k} senden={senden} kannSenden={kannSenden} pro={pro} />, true)}>
            {({ pressed }) => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 13, borderBottomWidth: i === liste.length - 1 ? 0 : 1, borderColor: f.linieLeise, opacity: pressed ? 0.55 : 1 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <T fett>{k.name}</T>
                  <T v="klein" leise>{`${k.berufsbezeichnung} · ${k.ort}`}</T>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 }}>
                    {k.datev ? <Marke text={TEXT.kanzlei_datev} ton="amt" /> : null}
                    {k.leistungen.slice(0, 3).map((l) => <Marke key={l} text={l} ton="leise" />)}
                  </View>
                  {k.festpreise?.length ? <T v="caption" leise stil={{ marginTop: 5 }}>{festpreisText(k.festpreise[0]!)}</T> : null}
                </View>
                <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" />
              </View>
            )}
          </Pressable>
        ))}
      </Karte>
      <Transparenz />
    </Gruppe>
  );
}

/** Blatt zu einer Kanzlei: Angaben, Kontakt (frei) und „Paket an … senden“ (Pro wie das Paket selbst). */
export function KanzleiDetail({ k, senden, kannSenden, pro }: { k: Kanzlei; senden: (k: Kanzlei) => void; kannSenden: boolean; pro: boolean }) {
  const nav = useNav();
  const f = useFarben();
  const [keinMail, setKeinMail] = useState(false);
  const oeffne = (url: string) => void Linking.openURL(url).catch(() => setKeinMail(true));
  const zeile = (titel: string, wert: string, erste?: boolean) => (
    <View style={{ paddingVertical: 10, borderTopWidth: erste ? 0 : 1, borderColor: f.linieLeise }}>
      <T v="caption" fett leise>{titel}</T>
      {/* auswählbar – ohne Mail-App lässt sich die Adresse kopieren */}
      <T v="klein" selectable stil={{ marginTop: 2 }}>{wert}</T>
    </View>
  );
  const paket = () => {
    // erst das Blatt schließen, dann das Paket auf der Seite darunter erstellen (Fortschritt und Hinweise stehen dort)
    nav.zurueck();
    setTimeout(() => senden(k), 350);
  };
  return (
    <BuehnenBlatt
      kopf={TEXT.kanzlei_finden}
      ueber={`${k.berufsbezeichnung} · ${k.ort}`}
      titel={k.name}
      fuss={
        <Fuss>
          <Knopf text={TEXT.mitPro(TEXT.kanzlei_senden(k.kurz ?? k.name), pro)} symbol="square.and.arrow.up" deaktiviert={!kannSenden} onPress={paket} stil={{ flex: 1 }} />
        </Fuss>
      }
    >
      {k.datev ? <View style={{ flexDirection: "row", marginBottom: 10 }}><Marke text={TEXT.kanzlei_datev} ton="amt" /></View> : null}
      <Hinweis text={kannSenden ? TEXT.kanzlei_senden_hinweis(k.email) : TEXT.steuerpaket_leer} />
      <Gruppe titel={TEXT.kanzlei_kontakt}>
        <Karte>
          <Zeile symbol="envelope" ton="amt" titel={TEXT.kanzlei_kontakt_aufnehmen} text={k.email} onPress={() => oeffne(mailtoLink(k.email, TEXT.kanzlei_betreff))} letzte={!k.telefon && !k.web} />
          {k.telefon ? <Zeile symbol="phone" ton="amt" titel={TEXT.kanzlei_anrufen} text={k.telefon} onPress={() => oeffne(telLink(k.telefon!))} letzte={!k.web} /> : null}
          {k.web ? <Zeile symbol="globe" ton="amt" titel={TEXT.kanzlei_web} text={k.web.replace(/^https:\/\//, "")} onPress={() => oeffne(k.web!)} link letzte /> : null}
        </Karte>
        {keinMail ? <Hinweis text={TEXT.kanzlei_kein_mail(k.email)} /> : null}
        <Karte stil={{ paddingTop: 0, marginTop: 12 }}>
          {zeile(TEXT.kanzlei_email, k.email, true)}
          {k.telefon ? zeile(TEXT.kanzlei_telefon, k.telefon) : null}
          {zeile(TEXT.kanzlei_gebiet, gebietText(k.gebiet))}
          {zeile(TEXT.kanzlei_kammer, k.kammer)}
        </Karte>
      </Gruppe>
      <Gruppe titel={TEXT.kanzlei_leistungen}>
        <T v="klein">{k.leistungen.join(" · ")}</T>
      </Gruppe>
      {k.festpreise?.length ? (
        <Gruppe titel={TEXT.kanzlei_festpreise}>
          {k.festpreise.map((p) => <T key={p} v="klein" stil={{ marginBottom: 4 }}>{festpreisText(p)}</T>)}
        </Gruppe>
      ) : null}
      {k.branchen?.length ? (
        <Gruppe titel={TEXT.kanzlei_branchen}>
          <T v="klein">{k.branchen.join(" · ")}</T>
        </Gruppe>
      ) : null}
      <View style={{ marginTop: 24 }}>
        <T v="caption" leise>{TEXT.kanzlei_eigenverantwortlich(k.name)}</T>
        <Transparenz />
      </View>
    </BuehnenBlatt>
  );
}
