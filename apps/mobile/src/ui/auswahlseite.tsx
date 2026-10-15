import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { T as TEXT } from "../texte";
import { FeldKopf, Karte, Suchfeld, Symbol, T, feldRahmen } from "./bausteine";
import { Unterseite, useNav } from "./navigation";
import { HAARLINIE, istIos, useFarben } from "./thema";
import { Inhalt } from "../seiten/gemeinsam";

interface Option<W extends string> {
  wert: W;
  text: string;
}

/** Liste zum Auswählen auf einer eigenen Seite (wie iOS-Einstellungen): Antippen wählt und geht zurück. */
export function AuswahlSeite<W extends string>({ titel, wert, optionen, aendern }: { titel: string; wert: W | null; optionen: Option<W>[]; aendern: (w: W) => void }) {
  const f = useFarben();
  const nav = useNav();
  const [gewaehlt, setGewaehlt] = useState(wert);
  const [suche, setSuche] = useState("");
  // lange Listen (viele Kunden): mit Suche
  const s = suche.trim().toLocaleLowerCase("de");
  const gezeigt = s ? optionen.filter((o) => o.text.toLocaleLowerCase("de").includes(s)) : optionen;
  return (
    <Unterseite titel={titel}>
      <Inhalt>
        {optionen.length > 8 ? (
          <View style={{ marginBottom: 12 }}>
            <Suchfeld wert={suche} setzen={setSuche} label={TEXT.liste_suchen} />
          </View>
        ) : null}
        {s && !gezeigt.length ? <T leise>{TEXT.keine_treffer}</T> : null}
        <Karte>
          <View accessibilityRole="radiogroup" accessibilityLabel={titel}>
            {gezeigt.map((o, i) => {
              const an = o.wert === gewaehlt;
              return (
                <Pressable
                  key={o.wert}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: an }}
                  aria-checked={an}
                  onPress={() => {
                    if (istIos) void Haptics.selectionAsync();
                    setGewaehlt(o.wert);
                    aendern(o.wert);
                    setTimeout(nav.zurueck, 120);
                  }}
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 10, borderTopWidth: i ? HAARLINIE : 0, borderColor: f.linie, opacity: pressed ? 0.6 : 1 })}
                >
                  <T fett={an} stil={{ flex: 1 }}>{o.text}</T>
                  {an ? <Symbol name="checkmark" groesse={18} farbe={f.amt} gewicht="semibold" /> : null}
                </Pressable>
              );
            })}
          </View>
        </Karte>
      </Inhalt>
    </Unterseite>
  );
}

/**
 * Zeile mit Beschriftung und aktuellem Wert; antippen öffnet die Auswahl auf einer eigenen Seite. Für lange Listen
 * (z. B. Bundesland), die ein Formular sonst um viele Zeilen verlängern würden.
 */
export function AuswahlZeile<W extends string>({ label, wert, optionen, aendern, hilfe, platzhalter }: { label: string; wert: W | null; optionen: Option<W>[]; aendern: (w: W) => void; hilfe?: string; platzhalter?: string }) {
  const f = useFarben();
  const nav = useNav();
  const text = optionen.find((o) => o.wert === wert)?.text;
  return (
    <View style={{ marginTop: 20 }}>
      <FeldKopf label={label} hilfe={hilfe} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: text ?? platzhalter ?? TEXT.auswaehlen }}
        onPress={() => nav.oeffnen(`auswahl-${label}`, () => <AuswahlSeite titel={label} wert={wert} optionen={optionen} aendern={aendern} />)}
        style={({ pressed }) => ({ ...feldRahmen(f), marginTop: 7, paddingRight: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: pressed ? f.flaeche : f.blatt })}
      >
        <T stil={{ flex: 1 }} leise={!text}>{text ?? platzhalter ?? TEXT.auswaehlen}</T>
        <Symbol name="chevron.right" groesse={14} farbe={f.zeiger} gewicht="semibold" />
      </Pressable>
    </View>
  );
}
