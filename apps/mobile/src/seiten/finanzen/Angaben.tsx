import { useEffect, useRef, useState } from "react";
import type { Kunde, Steller } from "../../kern/typen";
import { Feld, Hinweis, Karte, Knopf, Schalter, T, Zeile } from "../../ui/bausteine";
import { Unterseite } from "../../ui/navigation";
import { useAmtlos } from "../../zustand";
import { Gruppe, Inhalt, useAktion, useLaden } from "../gemeinsam";

/** Deine Angaben auf Rechnungen und die Kundenliste. `fertig` meldet Änderungen an die aufrufende Seite. */
export function Angaben({ fertig }: { fertig?: () => void } = {}) {
  const { t, klient, unternehmenId, ich } = useAmtlos();
  const { daten, neu } = useLaden(async () => {
    const [steller, kunden] = await Promise.all([klient.holen<Steller>("/v1/rechnungssteller"), klient.holen<Kunde[]>("/v1/kunden")]);
    return { steller, kunden };
  }, [unternehmenId]);
  const [s, setS] = useState<Steller>({});
  const gefuellt = useRef(false);
  useEffect(() => {
    // nur einmal vorausfüllen – stilles Neuladen soll Eingaben nicht überschreiben
    if (!daten || gefuellt.current) return;
    gefuellt.current = true;
    setS({ ...daten.steller, name: daten.steller.name ?? ich?.unternehmen.find((u) => u.id === unternehmenId)?.name ?? "" });
  }, [daten, ich, unternehmenId]);
  const feld = (k: keyof Steller) => ({ wert: (s[k] as string | null | undefined) ?? "", aendern: (w: string) => setS((x) => ({ ...x, [k]: w })) });
  const aktion = useAktion();

  const [kName, setKName] = useState("");
  const [kStrasse, setKStrasse] = useState("");
  const [kPlz, setKPlz] = useState("");
  const [kOrt, setKOrt] = useState("");
  const [kEmail, setKEmail] = useState("");
  const [kGeschaeft, setKGeschaeft] = useState(true);
  const [kForm, setKForm] = useState(false);
  const kunde = useAktion();

  return (
    <Unterseite titel={t.mobil.angaben_kurz}>
      <Inhalt>
        <T leise>{t.angaben.text}</T>
        {aktion.fehler ? <Hinweis art="fehler" text={aktion.fehler} /> : null}
        {aktion.meldung ? <Hinweis art="erfolg" text={aktion.meldung} /> : null}
        <Karte stil={{ marginTop: 12, paddingBottom: 14 }}>
          <Feld label={t.angaben.name} {...feld("name")} />
          <Feld label={t.angaben.strasse} {...feld("strasse")} textContentType="streetAddressLine1" />
          <Feld label={t.angaben.plz} {...feld("plz")} keyboardType="number-pad" textContentType="postalCode" />
          <Feld label={t.angaben.ort} {...feld("ort")} textContentType="addressCity" />
          <Feld label={t.angaben.email} {...feld("email")} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
          <Feld label={t.angaben.telefon} {...feld("telefon")} keyboardType="phone-pad" textContentType="telephoneNumber" />
          <Feld label={t.angaben.steuernummer} {...feld("steuernummer")} keyboardType="numbers-and-punctuation" />
          <Feld label={t.angaben.ust_idnr} {...feld("ust_idnr")} autoCapitalize="characters" />
          <Feld label={t.angaben.iban} {...feld("iban")} autoCapitalize="characters" />
          <Feld label={t.angaben.bic} {...feld("bic")} autoCapitalize="characters" />
          <Knopf
            text={t.angaben.speichern}
            laedt={aktion.laedt}
            onPress={() => void aktion.ausfuehren(async () => { await klient.schicken("/v1/rechnungssteller", "PUT", { ...s, land: s.land ?? "DE" }); fertig?.(); }, t.angaben.gespeichert)}
            stil={{ marginTop: 18 }}
          />
        </Karte>

        <Gruppe titel={t.angaben.kunden}>
          {daten?.kunden.length ? (
            <Karte>
              {daten.kunden.map((k, i) => (
                <Zeile key={k.id} titel={k.name} text={[k.ort, k.geschaeftskunde ? t.angaben.geschaeftlich : t.angaben.privat].filter(Boolean).join(" · ")} letzte={i === daten.kunden.length - 1} />
              ))}
            </Karte>
          ) : null}
          {kunde.fehler ? <Hinweis art="fehler" text={kunde.fehler} /> : null}
          {kForm ? (
            <Karte stil={{ marginTop: 12, paddingBottom: 14 }}>
              <Feld label={t.angaben.kunde_name} wert={kName} aendern={setKName} />
              <Feld label={t.angaben.strasse} wert={kStrasse} aendern={setKStrasse} />
              <Feld label={t.angaben.plz} wert={kPlz} aendern={setKPlz} keyboardType="number-pad" />
              <Feld label={t.angaben.ort} wert={kOrt} aendern={setKOrt} />
              <Feld label={t.angaben.kunde_email} wert={kEmail} aendern={setKEmail} keyboardType="email-address" autoCapitalize="none" />
              <Schalter label={t.angaben.geschaeftskunde} wert={kGeschaeft} aendern={setKGeschaeft} />
              <Knopf
                text={t.angaben.kunde_anlegen}
                deaktiviert={!kName.trim()}
                laedt={kunde.laedt}
                onPress={() =>
                  void kunde.ausfuehren(async () => {
                    await klient.schicken("/v1/kunden", "POST", { name: kName, strasse: kStrasse || null, plz: kPlz || null, ort: kOrt || null, email: kEmail || null, geschaeftskunde: kGeschaeft, land: "DE" });
                    setKForm(false);
                    setKName(""); setKStrasse(""); setKPlz(""); setKOrt(""); setKEmail("");
                    await neu();
                    fertig?.();
                  })
                }
                stil={{ marginTop: 18 }}
              />
            </Karte>
          ) : (
            <Knopf leise text={t.angaben.kunde_neu} symbol="plus" onPress={() => setKForm(true)} stil={{ marginTop: 12 }} />
          )}
        </Gruppe>
      </Inhalt>
    </Unterseite>
  );
}
