import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View, type TextStyle } from "react-native";
import { GROESSE, ZIEL, useFarben } from "./thema";

export function Titel({ children }: { children: ReactNode }) {
  const f = useFarben();
  return (
    <Text accessibilityRole="header" style={{ fontSize: GROESSE.titel, fontWeight: "700", color: f.tinte, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

export function Absatz({ children, leise, stil }: { children: ReactNode; leise?: boolean; stil?: TextStyle }) {
  const f = useFarben();
  return <Text style={{ fontSize: leise ? GROESSE.klein : GROESSE.basis, lineHeight: leise ? 18 : 24, color: leise ? f.tinteLeise : f.tinte, ...stil }}>{children}</Text>;
}

export function Knopf({ text, onPress, leise, gefahr, deaktiviert, laedt }: { text: string; onPress: () => void; leise?: boolean; gefahr?: boolean; deaktiviert?: boolean; laedt?: boolean }) {
  const f = useFarben();
  const farbe = gefahr ? f.frist : f.amt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(deaktiviert || laedt), busy: Boolean(laedt) }}
      disabled={deaktiviert || laedt}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: ZIEL,
        paddingHorizontal: 18,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: leise ? "transparent" : farbe,
        borderWidth: leise ? 2 : 0,
        borderColor: farbe,
        opacity: deaktiviert ? 0.5 : pressed ? 0.85 : 1,
        marginVertical: 6,
      })}
    >
      {laedt ? <ActivityIndicator color={leise ? farbe : f.blatt} /> : <Text style={{ fontSize: GROESSE.basis, fontWeight: "700", color: leise ? farbe : f.blatt }}>{text}</Text>}
    </Pressable>
  );
}

export function Karte({ children, rand }: { children: ReactNode; rand?: "frist" | "bald" | "amt" }) {
  const f = useFarben();
  return <View style={{ backgroundColor: f.blatt, borderRadius: 8, borderWidth: rand ? 2 : 1, borderColor: rand ? f[rand] : f.linie, padding: 14, marginVertical: 6 }}>{children}</View>;
}

/** Hinweis mit Rolle „alert“ (Fehler) oder „text“ (Information); Farbe nie allein (immer Text). */
export function Hinweis({ text, art = "info" }: { text: string; art?: "info" | "fehler" | "erfolg" }) {
  const f = useFarben();
  const hg = art === "fehler" ? f.fristHauch : art === "erfolg" ? f.amtHauch : f.baldHauch;
  const rand = art === "fehler" ? f.frist : art === "erfolg" ? f.amt : f.bald;
  return (
    <View accessibilityRole={art === "fehler" ? "alert" : "text"} accessibilityLiveRegion="polite" style={{ backgroundColor: hg, borderColor: rand, borderWidth: 2, borderRadius: 6, padding: 12, marginVertical: 6 }}>
      <Text style={{ color: f.tinte, fontSize: GROESSE.basis }}>{text}</Text>
    </View>
  );
}
