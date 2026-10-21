import { useEffect, useRef, useState } from "react";
import { Image, Linking, View } from "react-native";
import { partnerAusCode, partnerCodeAusLink, partnerFuer, type Partner } from "../partner/partner";
import { codeEinloesen } from "../pro/kauf";
import { T as TEXT } from "../texte";
import { Feld, Hinweis, Karte, Knopf, T, TextKnopf } from "../ui/bausteine";
import { useMeldung } from "../ui/meldung";
import { Unterseite } from "../ui/navigation";
import { RADIUS, useFarben } from "../ui/thema";
import { useAmtlos, useAktionen, useAmtlosStatus, useStandWahl } from "../zustand";
import { Inhalt } from "./gemeinsam";

/** Partner aus dem Stand (nur Anzeige). */
export function usePartner(): Partner | null {
  const id = useStandWahl((s) => s.partnerId);
  return partnerFuer(id);
}

/**
 * „Code einlösen“ (Phase 2.3): Apples Einlöseblatt für Abo-Angebotscodes, danach die Berechtigung neu abfragen. Ohne
 * Store-Anbindung (Web, Expo Go, Testmodus) ein Hinweis, wo man den Code einlöst. Pro gilt nur, wenn RevenueCat die
 * Berechtigung meldet – hier wird nichts freigeschaltet.
 */
export function useCodeEinloesen(danach?: () => void) {
  const { proAktualisieren } = useAktionen();
  const melden = useMeldung();
  const [hinweis, setHinweis] = useState<"nicht_verfuegbar" | "fehler" | null>(null);
  const [laedt, setLaedt] = useState(false);
  const einloesen = async () => {
    setHinweis(null);
    setLaedt(true);
    try {
      const r = await codeEinloesen();
      if (r === "nicht_verfuegbar") {
        // kurz als Meldung (der Hinweis steht unter dem Knopf, vielleicht unterhalb des sichtbaren Bereichs)
        melden(TEXT.code_nicht_verfuegbar_kurz, "info");
        return setHinweis("nicht_verfuegbar");
      }
      if (r === "pro") {
        // Ergebnis der Berechtigung aus RevenueCat (kauf.ts) – wie nach einem Kauf
        proAktualisieren(true);
        melden(TEXT.code_eingeloest);
        danach?.();
      } else proAktualisieren();
    } catch {
      setHinweis("fehler");
    } finally {
      setLaedt(false);
    }
  };
  return { einloesen, hinweis, laedt };
}

/** TextKnopf „Code einlösen“ samt Hinweis darunter (Bezahlschirm, Mein Betrieb). */
export function CodeEinloesenKnopf({ text, danach, leise }: { text?: string; danach?: () => void; leise?: boolean }) {
  const c = useCodeEinloesen(danach);
  return (
    <View>
      <TextKnopf symbol="giftcard" leise={leise} text={text ?? TEXT.code_einloesen} label={TEXT.code_einloesen} onPress={() => void (c.laedt ? undefined : c.einloesen())} />
      {c.hinweis ? <Hinweis art={c.hinweis === "fehler" ? "fehler" : "info"} text={c.hinweis === "fehler" ? TEXT.code_fehler : TEXT.code_nicht_verfuegbar} /> : null}
    </View>
  );
}

/** Logo eines Partners – Daten-URI oder gebündeltes Bild, nie aus dem Netz. */
function PartnerLogo({ p, groesse }: { p: Partner; groesse: number }) {
  if (p.logo === undefined || p.logo === "") return null;
  const quelle = typeof p.logo === "number" ? p.logo : /^data:image\//.test(p.logo) ? { uri: p.logo } : null;
  if (!quelle) return null;
  return <Image source={quelle} style={{ width: groesse * 2, height: groesse, borderRadius: 3 }} resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} />;
}

/** Kleine Zeile „Empfohlen von …“ (Heute, Bezahlschirm) – nur, wenn ein bekannter Partner gesetzt ist. */
export function PartnerHinweis({ stil }: { stil?: object }) {
  const p = usePartner();
  if (!p) return null;
  const text = TEXT.partner_empfohlen(p.kurz ?? p.name);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={TEXT.partner_empfohlen(p.name)} style={[{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 }, stil]}>
      <PartnerLogo p={p} groesse={16} />
      <T v="caption" leise stil={{ flexShrink: 1 }} numberOfLines={1}>{text}</T>
    </View>
  );
}

/** Unterseite „Partner-Code“ unter „Mein Betrieb“: eintragen, ansehen, entfernen. Schaltet nichts frei. */
export function PartnerSeite() {
  const z = useAmtlos();
  const f = useFarben();
  const melden = useMeldung();
  const p = partnerFuer(z.stand.partnerId);
  const [code, setCode] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const uebernehmen = () => {
    const t = partnerAusCode(code);
    if (!t) return setFehler(TEXT.partner_unbekannt);
    setFehler(null);
    setCode("");
    z.partnerSetzen(t.id);
    melden(TEXT.partner_gesetzt(t.partner.name));
  };
  return (
    <Unterseite titel={TEXT.partner_titel}>
      <Inhalt>
        <T leise stil={{ marginBottom: 6 }}>{TEXT.partner_text}</T>
        {p ? (
          <Karte stil={{ paddingVertical: 14, gap: 8, marginTop: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {p.logo !== undefined ? (
                <View style={{ padding: 4, borderRadius: RADIUS.klein, backgroundColor: "#ffffff" }}>
                  <PartnerLogo p={p} groesse={28} />
                </View>
              ) : null}
              <T fett stil={{ flex: 1 }}>{TEXT.partner_empfohlen(p.name)}</T>
            </View>
            {p.hinweis ? <T v="klein" leise>{p.hinweis}</T> : null}
            {!z.pro ? <CodeEinloesenKnopf text={TEXT.partner_zugang(p.kurz ?? p.name)} /> : null}
            {p.link && /^https:\/\//.test(p.link) ? <TextKnopf text={TEXT.partner_link} onPress={() => void Linking.openURL(p.link!).catch(() => undefined)} /> : null}
            <TextKnopf
              gefahr
              text={TEXT.partner_entfernen}
              onPress={() => {
                z.partnerSetzen(null);
                melden(TEXT.partner_entfernt);
              }}
            />
          </Karte>
        ) : null}
        <Feld label={TEXT.partner_feld} wert={code} aendern={(w) => { setCode(w); setFehler(null); }} placeholder={TEXT.partner_beispiel} autoCapitalize="characters" autoCorrect={false} returnKeyType="done" onSubmitEditing={uebernehmen} fehler={fehler} />
        <Knopf ton text={TEXT.partner_uebernehmen} deaktiviert={!code.trim()} onPress={uebernehmen} stil={{ marginTop: 12 }} />
        <T v="caption" leise stil={{ marginTop: 16 }}>{TEXT.partner_datenschutz}</T>
        {!z.pro ? (
          <>
            <View style={{ height: 1, backgroundColor: f.linieLeise, marginVertical: 14 }} />
            <CodeEinloesenKnopf />
          </>
        ) : null}
      </Inhalt>
    </Unterseite>
  );
}

/** Zeilen-Text für „Mein Betrieb“: Name des Partners oder „Kein Partner eingetragen“. */
export function partnerZeileText(id: string | undefined): string {
  return partnerFuer(id)?.name ?? TEXT.partner_keiner;
}

/**
 * Deep Link `amtlos://partner/<code>` (Schema „amtlos“ ist schon registriert): setzt einen bekannten Partner. Erst wenn
 * der Stand geladen ist – im Ladefehler nie (dann wird nichts gespeichert).
 */
export function PartnerLink() {
  const { bereit, ladefehler } = useAmtlosStatus();
  const { partnerSetzen } = useAktionen();
  const melden = useMeldung();
  const erster = useRef(false);
  useEffect(() => {
    if (!bereit || ladefehler) return;
    const verarbeiten = (url: string | null) => {
      const code = partnerCodeAusLink(url);
      if (!code) return;
      const t = partnerAusCode(code);
      if (!t) return melden(TEXT.partner_unbekannt, "info");
      partnerSetzen(t.id);
      melden(TEXT.partner_gesetzt(t.partner.name));
    };
    if (!erster.current) {
      erster.current = true;
      void Linking.getInitialURL().then(verarbeiten).catch(() => undefined);
    }
    const abo = Linking.addEventListener("url", (e) => verarbeiten(e.url));
    return () => abo.remove();
  }, [bereit, ladefehler, partnerSetzen, melden]);
  return null;
}
