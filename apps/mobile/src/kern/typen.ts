/** Antworttypen der API für die Bereiche jenseits von Heute/Pflichten (wie apps/web/lib/typen.ts und die Controller). */
import type { Karte } from "./api";

export type EinheitId = "stueck" | "stunde" | "tag" | "monat" | "pauschal" | "kilogramm";
export interface Position { bezeichnung: string; menge: number; einheit: EinheitId; preis_cent: number; ust_art?: "regel" | "ermaessigt" | null; ust_satz?: number | null }
export interface Rechnung {
  id: string; nummer: string | null; status: "entwurf" | "gestellt" | "storniert"; art: "rechnung" | "storno"; rechnungsdatum: string | null; leistungsdatum: string | null;
  faellig_am: string | null; kunde_id: string | null; kunde: Kunde | null; kunde_name?: string | null; positionen: Position[]; kleinunternehmer: boolean; hinweis: string | null;
  netto_cent: number; ust_cent: number; brutto_cent: number; pdf_dokument_id: string | null; xml_dokument_id: string | null;
}
export interface Kunde { id: string; name: string; strasse: string | null; plz: string | null; ort: string | null; land: string; email: string | null; ust_idnr: string | null; kaeufer_referenz: string | null; geschaeftskunde: boolean }
export interface Steller { name?: string; strasse?: string; plz?: string; ort?: string; land?: string; email?: string; telefon?: string | null; steuernummer?: string | null; ust_idnr?: string | null; iban?: string | null; bic?: string | null }
export interface Beleg { id: string; belegdatum: string | null; lieferant: string | null; belegnummer: string | null; brutto_cent: number | null; ust_cent: number | null; kategorie: string | null; notiz: string | null; quelle: string; storniert: boolean; erfasst_am: string; datei_titel: string; mime: string }
export interface Kasse { id: string; bezeichnung: string; hersteller: string | null; modell: string | null; seriennummer: string | null; tse_seriennummer: string | null; betriebsstaette: string | null; angeschafft_am: string; ausser_betrieb_am: string | null }
export interface FinanzUebersicht { jahr: number; umsatz_eur: number; kleinunternehmer: boolean; grenze: { id: string; wert_eur: number; anteil: number; ungeprueft: boolean } | null; entwuerfe: number; belege: number }
export interface Uebermittlung { verfuegbar: boolean; grund?: string; alternative?: { titel: string; url: string } }
export interface UstVa { periode: string; von: string; bis: string; umsaetze: { satz: number | null; netto_cent: number; ust_cent: number }[]; umsatzsteuer_cent: number; vorsteuer_cent: number; zahllast_cent: number; rechnungen: number; belege: number; belege_ohne_steuerangabe: number; uebermittlung: Uebermittlung }

export interface Beschaeftigter { id: string; vorname: string; nachname: string; art: string; eintritt: string; austritt: string | null; wochenstunden: number | null }
export interface Checkliste { beschaeftigter: Beschaeftigter; schritte: { pflicht_id: string; periode: string; status: string; faellig_am: string | null; titel: string; kurz: string; anlass: "einstellung" | "austritt" }[] }
export interface Schwellen { aktuell: number; schwellen: { ab: number; neu: { pflicht_id: string; titel: string }[]; zu_pruefen: { pflicht_id: string; titel: string }[] }[] }
export interface UnterweisungKurz { id: string; thema: string; art: string; datum: string; durchgefuehrt_von: string; abgeschlossen_am: string | null; bestaetigt: number }
export interface Unterweisung extends Omit<UnterweisungKurz, "bestaetigt"> { inhalt: string; teilnahmen: { beschaeftigter_id: string; vorname?: string; nachname?: string; bestaetigt_am: string; name_bestaetigt: string }[] }
export interface Zeiten { monat: string; eintraege: { id: string; beschaeftigter_id: string; beginn: string; ende: string | null; pause_minuten: number; quelle: string; grund: string | null; minuten: number }[]; summen_minuten: Record<string, number>; laufend: { beschaeftigter_id: string; beginn: string }[] }

export interface Brief { id: string; eingang_am: string; absender: string; art: string; aktenzeichen: string; frist_am: string | null; frist_art: string | null; betrag_cent: number | null; pflicht_id: string | null; notiz: string | null; erledigt_am: string | null; tage_bis_frist?: number | null }
export interface Termin { id: string; art: "brief" | "pruefung"; datum: string; titel: string; link: string }

export interface GruendungSchritt extends Karte { katalog_nr?: string; voraussetzungen: string[]; stelle?: string; kanal?: string; gesperrt_durch: { pflicht_id: string; titel?: string }[] }
export interface Gruendung { schritte: GruendungSchritt[]; fortschritt: { erledigt: number; gesamt: number; fertig: boolean }; kapitalgesellschaft: "gmbh" | "ug" | null; kennzahlen: { id: string; bezeichnung: string; wert: number; einheit: string; ungeprueft: boolean }[] }
export interface Fragebogen { abschnitte: { titel: string; angaben: { feld: string; label: string; wert: string | null; schritt: string }[] }[]; fehlend: string[]; hinweise: string[]; uebermittlung: Uebermittlung }
export interface Begriff { begriff: string; erklaerung: string; pflichten: { id: string; titel: string }[] }
export interface Ereignis { id: string; typ: string; datum: string; storniert: boolean; storniert_ereignis_id: string | null }
export interface Team { mitglieder: { konto_id: string; anzeigename: string; email: string; rolle: string; ich: boolean }[]; einladungen: { id: string; email: string; rolle: string; laeuft_ab: string }[]; darf_verwalten: boolean }
export interface Erinnerungen { eigene: boolean; geraet_vorhanden: boolean; kanaele: { kanal: "email" | "push"; aktiv: boolean; vorlauf_tage: number[] }[] }
