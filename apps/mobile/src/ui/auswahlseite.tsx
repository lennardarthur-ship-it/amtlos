import { useState } from "react";
import { Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { T as TEXT } from "../texte";
import { FeldKopf, Karte, Symbol, T } from "./bausteine";
import { Unterseite, useNav } from "./navigation";
import { RADIUS, ZIEL, istIos, useFarben } from "./thema";
import { Inhalt } from "../seiten/gemeinsam";

interface Option<W extends string> {
  wert: W;
  text: string;
}

/** Liste zum Auswählen auf einer eigenen Seite (wie iOS-Einstellungen): Antippen wählt und geht zurück. */
function AuswahlSeite<W extends string>({ titel, wert, optionen, aendern }: { titel: string; wert: W | null; optionen: Option<W>[]; aendern: (w: W) => void }) {
  const f = useFarben();
  const nav = useNav();
  const [gewaehlt, setGewaehlt] = useState(wert);
  return (
    <Unterseite titel={titel}>
      <Inhalt>
        <Karte>
          <View accessibilityRole="radiogroup" accessibilityLabel={titel}>
            {optionen.map((o, i) => {
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
                  style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: ZIEL, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: f.linieLeise, opacity: pressed ? 0.6 : 1 })}
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
        style={({ pressed }) => ({ marginTop: 6, minHeight: ZIEL, borderWidth: 1.5, borderColor: f.linie, borderRadius: RADIUS.klein, paddingLeft: 14, paddingRight: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: pressed ? f.papier : f.blatt })}
      >
        <T stil={{ flex: 1 }} leise={!text}>{text ?? platzhalter ?? TEXT.auswaehlen}</T>
        <Symbol name="chevron.right" groesse={16} />
      </Pressable>
    </View>
  );
}
