import { createElement, useState } from "react";
import { View } from "react-native";
import { RADIUS, useFarben } from "./thema";
import { BLATT_BREITE, BLATT_BREITE_QUER, vorschauHtml } from "./vorschauHtml";

/** Web (Vorschau, Rundgang; `papier`: ohne Rahmen): iframe auf Blattbreite, verkleinert auf die verfügbare Breite. */
export function Vorschau({ html, quer, hoehe, papier }: { html: string; quer?: boolean; hoehe?: number; papier?: boolean }) {
  const f = useFarben();
  const [breite, setBreite] = useState(0);
  const blatt = quer ? BLATT_BREITE_QUER : BLATT_BREITE;
  const faktor = breite ? breite / blatt : 0;
  return (
    <View
      onLayout={(e) => setBreite(e.nativeEvent.layout.width)}
      pointerEvents={hoehe ? "none" : "auto"}
      style={hoehe ? { height: hoehe, borderRadius: RADIUS.blatt, overflow: "hidden", borderWidth: papier ? 0 : 1, borderColor: f.linie, backgroundColor: "#ffffff" } : { flex: 1, overflow: "hidden", backgroundColor: "#ffffff" }}
    >
      {faktor
        ? createElement("iframe", {
            title: "Vorschau des Dokuments",
            srcDoc: vorschauHtml(html, quer),
            scrolling: hoehe ? "no" : "yes",
            style: { border: 0, width: blatt, transform: `scale(${faktor})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0, ...(hoehe ? { height: hoehe / faktor } : { height: `${100 / faktor}%` }) },
          })
        : null}
    </View>
  );
}
