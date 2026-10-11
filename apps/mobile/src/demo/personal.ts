/**
 * Demo-Server: Personal (wie apps/api/src/personal.controller.ts) – Beschäftigte mit Ereignissen und Profil-Anzahlen,
 * Checkliste, Schwellenwert-Wächter (mit der echten Engine), Unterweisungen mit Bestätigung, Zeiterfassung.
 * Nicht in der Demo: PDF-Protokoll und CSV-Export (dafür braucht es den Server).
 */
import { StandardKalender } from "@amtlos/fristen";
import { auswerten } from "@amtlos/rules-engine";
import { fehler, nichtGefunden, ok, tx, type Kontext, type Modul, type Text } from "./kontext";

const SCHWELLEN = [10, 20, 50, 150, 250];
const ARTEN = ["vollzeit", "teilzeit", "minijob", "azubi", "werkstudent"];
const UNTERWEISUNGSARTEN = ["arbeitsschutz", "ki_kompetenz", "datenschutz", "ifsg"];

interface Beschaeftigter { id: string; vorname: string; nachname: string; art: string; eintritt: string; austritt: string | null; wochenstunden: number | null }
interface Unterweisung {
  id: string; thema: string; inhalt: string; datum: string; durchgefuehrt_von: string; art: string; abgeschlossen_am: string | null; dokument_id: null; erstellt_am: string;
  teilnahmen: { beschaeftigter_id: string; bestaetigt_am: string; name_bestaetigt: string }[];
}
interface Zeit { id: string; beschaeftigter_id: string; beginn: string; ende: string | null; pause_minuten: number; quelle: string; grund: string | null; client_id: string | null; ende_client_id: string | null; storniert: boolean; ersetzt_id: string | null }

const text = (x: unknown, max = 200) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
const datum = (x: unknown) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);

/** Profil-Anzahlen aus der Personalliste nachziehen (wie anzahlenNachziehen/profilNachziehen) – neue Version nur bei Änderung. */
function anzahlenNachziehen(k: Kontext, liste: Beschaeftigter[]) {
  const heute = k.heute();
  const aktiv = liste.filter((b) => !b.austritt || b.austritt >= heute);
  const aenderung: Record<string, number> = { "beschaeftigte.gesamt": aktiv.length };
  for (const art of ARTEN) aenderung[`beschaeftigte.${art}`] = aktiv.filter((b) => b.art === art).length;
  const p = k.stand.profil;
  if (Object.entries(aenderung).every(([s, v]) => p.daten[s] === v)) return;
  k.stand.profil = { ...p, version: p.version + 1, daten: { ...p.daten, ...aenderung }, erstellt_am: k.zeit() };
}
const ereignis = (k: Kontext, typ: string, am: string, payload: Record<string, unknown>) =>
  k.stand.ereignisse.push({ id: k.id("ereignis"), typ, datum: am, erfasst_am: k.zeit(), storniert_ereignis_id: null, payload });

/** Gültige Zeiteinträge: nicht storniert und nicht durch eine Korrektur ersetzt (wie app.zeiteintrag_gueltig). */
const gueltig = (z: Zeit[]) => z.filter((e) => !e.storniert && !z.some((x) => x.ersetzt_id === e.id));
const berlinMonat = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(new Date(iso));

export const personal: Modul = (a, k) => {
  const { teile: t, methode: m, s } = a;
  if (t[0] !== "v1") return undefined;
  const liste = k.tabelle<Beschaeftigter>("beschaeftigte");
  const unterweisungen = k.tabelle<Unterweisung>("unterweisungen");
  const zeiten = k.tabelle<Zeit>("zeiten");

  if (t[1] === "beschaeftigte") {
    if (t.length === 2 && m === "GET") return ok([...liste].sort((x, y) => Number(Boolean(x.austritt)) - Number(Boolean(y.austritt)) || x.nachname.localeCompare(y.nachname) || x.vorname.localeCompare(y.vorname)));
    if (t.length === 2 && m === "POST") {
      const d = a.koerper;
      const vorname = text(d.vorname, 100), nachname = text(d.nachname, 100), eintritt = datum(d.eintritt);
      if (!vorname || !nachname || !eintritt || !ARTEN.includes(String(d.art))) return fehler(422, "Bitte Vorname, Nachname, Art und Eintritt angeben.", "Please enter first name, last name, type and start date.", s);
      const erste = !k.stand.ereignisse.some((e) => (e.typ === "erste_einstellung" || e.typ === "einstellung") && !e.storniert_ereignis_id);
      const b: Beschaeftigter = { id: k.id("person"), vorname, nachname, art: String(d.art), eintritt, austritt: null, wochenstunden: typeof d.wochenstunden === "number" && d.wochenstunden > 0 ? d.wochenstunden : null };
      liste.push(b);
      if (erste) ereignis(k, "erste_einstellung", eintritt, { arbeitsbeginn: eintritt });
      ereignis(k, "einstellung", eintritt, { arbeitsbeginn: eintritt, beschaeftigungsart: b.art, beschaeftigter_id: b.id });
      anzahlenNachziehen(k, liste);
      k.neuberechnen();
      return ok(b);
    }
    const b = liste.find((x) => x.id === t[2]);
    if (!b) return fehler(404, "Beschäftigte Person nicht gefunden", "Employee not found", s);
    if (t.length === 3 && m === "PUT") {
      const d = a.koerper;
      Object.assign(b, { vorname: text(d.vorname, 100) ?? b.vorname, nachname: text(d.nachname, 100) ?? b.nachname, art: ARTEN.includes(String(d.art)) ? String(d.art) : b.art, wochenstunden: typeof d.wochenstunden === "number" ? d.wochenstunden : null });
      anzahlenNachziehen(k, liste);
      k.neuberechnen();
      return ok(b);
    }
    if (t[3] === "austritt" && m === "POST") {
      const am = datum(a.koerper.datum);
      if (b.austritt) return fehler(404, "Keine aktive Beschäftigung mit dieser ID", "No active employment with this ID", s);
      if (!am) return fehler(422, "Bitte ein Datum angeben.", "Please enter a date.", s);
      b.austritt = am;
      ereignis(k, "austritt", am, { ende: am, beschaeftigter_id: b.id });
      anzahlenNachziehen(k, liste);
      k.neuberechnen();
      return ok(b);
    }
    if (t[3] === "checkliste" && m === "GET") {
      const perioden = [`aenderung-${b.eintritt.replaceAll("-", "")}`, ...(b.austritt ? [`aenderung-${b.austritt.replaceAll("-", "")}`] : [])];
      const schritte = k
        .sichtbar()
        .filter((i) => perioden.includes(i.periode))
        .map((i) => {
          const kt = k.karte(i, s);
          return { pflicht_id: i.pflicht_id, periode: i.periode, status: kt.status, faellig_am: i.faellig_am, titel: kt.titel, kurz: kt.kurz, anlass: i.periode === perioden[0] ? "einstellung" : "austritt" };
        });
      return ok({ beschaeftigter: b, schritte });
    }
    return nichtGefunden(s);
  }

  if (t[1] === "personal" && t[2] === "schwellen") {
    if (k.stand.profil.version === 0) return ok({ aktuell: 0, schwellen: [] });
    const stichtag = k.heute();
    const kalender = new StandardKalender();
    const daten = k.stand.profil.daten;
    const aktuell = Number(daten["beschaeftigte.gesamt"] ?? 0);
    const lauf = (gesamt: number) =>
      new Map(auswerten({ katalog: k.katalog, fakten: Object.fromEntries(Object.entries({ ...daten, "beschaeftigte.gesamt": gesamt }).map(([x, v]) => [`profil.${x}`, v])), ereignisse: [], stichtag, kalender }).map((e) => [e.pflicht_id, e]));
    const titel = new Map(k.katalog.pflichten.map((p) => [p.id, tx(p.titel as unknown as Text, s)]));
    let vorher = lauf(aktuell);
    return ok({
      aktuell,
      schwellen: [...new Set([aktuell + 1, ...SCHWELLEN])].filter((x) => x > aktuell).sort((x, y) => x - y).map((ab) => {
        const neu = lauf(ab);
        const kommen = [...neu.values()].filter((e) => !e.radar && e.ergebnis !== "gilt_nicht" && vorher.get(e.pflicht_id)?.ergebnis === "gilt_nicht");
        vorher = neu;
        return { ab, neu: kommen.filter((e) => e.ergebnis === "gilt").map((e) => ({ pflicht_id: e.pflicht_id, titel: titel.get(e.pflicht_id) })), zu_pruefen: kommen.filter((e) => e.ergebnis === "unbekannt").map((e) => ({ pflicht_id: e.pflicht_id, titel: titel.get(e.pflicht_id) })) };
      }).filter((x) => SCHWELLEN.includes(x.ab) || x.neu.length + x.zu_pruefen.length > 0),
    });
  }
  if (t[1] === "personal" && t[2] === "export") return fehler(404, "Den Export gibt es mit einem Konto.", "The export is available with an account.", s);

  if (t[1] === "unterweisungen") {
    if (t.length === 2 && m === "GET") {
      const art = a.suche.get("art");
      return ok(unterweisungen.filter((u) => !art || u.art === art).sort((x, y) => y.datum.localeCompare(x.datum) || y.erstellt_am.localeCompare(x.erstellt_am)).map(({ inhalt: _i, teilnahmen, ...u }) => ({ ...u, bestaetigt: teilnahmen.length })));
    }
    if (t.length === 2 && m === "POST") {
      const d = a.koerper;
      const thema = text(d.thema), inhalt = text(d.inhalt, 20000), am = datum(d.datum), von = text(d.durchgefuehrt_von);
      if (!thema || !inhalt || !am || !von) return fehler(422, "Bitte Thema, Inhalt, Datum und durchführende Person angeben.", "Please enter topic, content, date and instructor.", s);
      const u: Unterweisung = { id: k.id("unterweisung"), thema, inhalt, datum: am, durchgefuehrt_von: von, art: UNTERWEISUNGSARTEN.includes(String(d.art)) ? String(d.art) : "arbeitsschutz", abgeschlossen_am: null, dokument_id: null, erstellt_am: k.zeit(), teilnahmen: [] };
      unterweisungen.push(u);
      return ok({ id: u.id, thema, datum: am, art: u.art });
    }
    const u = unterweisungen.find((x) => x.id === t[2]);
    if (!u) return fehler(404, "Unterweisung nicht gefunden", "Instruction not found", s);
    if (t.length === 3 && m === "GET")
      return ok({ ...u, teilnahmen: u.teilnahmen.map((x) => { const b = liste.find((p) => p.id === x.beschaeftigter_id); return { ...x, vorname: b?.vorname, nachname: b?.nachname }; }) });
    if (t.length === 3 && m === "DELETE") {
      if (u.teilnahmen.length || u.abgeschlossen_am) return fehler(409, "Bestätigte oder abgeschlossene Unterweisungen werden nicht gelöscht", "Confirmed or completed instructions are not deleted", s);
      unterweisungen.splice(unterweisungen.indexOf(u), 1);
      return ok(undefined, 204);
    }
    if (t[3] === "bestaetigen" && m === "POST") {
      if (u.abgeschlossen_am) return fehler(409, "Unterweisung ist schon abgeschlossen", "Instruction already completed", s);
      const b = liste.find((p) => p.id === a.koerper.beschaeftigter_id);
      if (!b) return fehler(404, "Beschäftigte Person nicht gefunden", "Employee not found", s);
      const norm = (x: string) => x.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
      if (norm(String(a.koerper.name ?? "")) !== norm(`${b.vorname} ${b.nachname}`)) return { status: 422, wert: { meldung: s === "en" ? "The name does not match the person" : "Der Name passt nicht zur Person", fehler: [{ feld: "name", meldung: s === "en" ? "Please enter your own full name" : "Bitte den eigenen vollständigen Namen eingeben" }] } };
      if (u.teilnahmen.some((x) => x.beschaeftigter_id === b.id)) return fehler(409, "Schon bestätigt", "Already confirmed", s);
      const tn = { beschaeftigter_id: b.id, bestaetigt_am: k.zeit(), name_bestaetigt: String(a.koerper.name) };
      u.teilnahmen.push(tn);
      return ok(tn);
    }
    if (t[3] === "abschliessen" && m === "POST") {
      if (u.abgeschlossen_am) return fehler(409, "Schon abgeschlossen", "Already completed", s);
      if (!u.teilnahmen.length) return { status: 422, wert: { meldung: s === "en" ? "Nobody has confirmed the instruction yet" : "Noch niemand hat die Unterweisung bestätigt" } };
      u.abgeschlossen_am = k.zeit();
      const perioden = u.teilnahmen.map((x) => `aenderung-${liste.find((p) => p.id === x.beschaeftigter_id)?.eintritt.replaceAll("-", "")}`);
      const bisJahr = `${Number(u.datum.slice(0, 4)) + 1}${u.datum.slice(4)}`;
      let n = 0;
      if (u.art === "arbeitsschutz") ereignis(k, "unterweisung_durchgefuehrt", u.datum, { thema: u.thema, unterweisung_id: u.id });
      for (const [sk, i] of Object.entries(k.stand.instanzen)) {
        if (i.status !== "offen") continue;
        const passt =
          (u.art === "arbeitsschutz" && ((i.pflicht_id === "arbeitsschutz.unterweisung_wiederholen" && (!i.faellig_am || i.faellig_am <= bisJahr)) || (i.pflicht_id === "arbeitsschutz.erstunterweisung" && perioden.includes(i.periode)))) ||
          (u.art === "ifsg" && i.ergebnis === "gilt" && i.pflicht_id === "branche.gastro_ifsg_belehrung" && perioden.includes(i.periode)) ||
          (u.art === "ki_kompetenz" && i.ergebnis === "gilt" && i.pflicht_id === "ki.kompetenz");
        if (!passt) continue;
        k.stand.instanzen[sk] = { ...i, status: "erledigt", erledigt_am: k.zeit(), erledigt_mit_version_id: i.pflicht_version_id };
        k.stand.nachweise.push({ id: k.id("nachweis"), schluessel: sk, art: "generiertes_dokument", notiz: `Unterweisung „${u.thema}“ vom ${u.datum}`, erstellt_am: k.zeit() });
        n++;
      }
      k.neuberechnen();
      return ok({ id: u.id, dokument_id: null, erledigte_pflichten: n });
    }
    return nichtGefunden(s);
  }

  if (t[1] === "zeiten") {
    if (t.length === 2 && m === "GET") {
      const monat = a.suche.get("monat") ?? "";
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return fehler(400, "monat im Format JJJJ-MM", "month as YYYY-MM", s);
      const eintraege = gueltig(zeiten).filter((e) => berlinMonat(e.beginn) === monat).sort((x, y) => x.beginn.localeCompare(y.beginn));
      const minuten = (e: Zeit) => (e.ende ? Math.max(0, Math.round((Date.parse(e.ende) - Date.parse(e.beginn)) / 60000) - e.pause_minuten) : 0);
      const summen: Record<string, number> = {};
      for (const e of eintraege) summen[e.beschaeftigter_id] = (summen[e.beschaeftigter_id] ?? 0) + minuten(e);
      const laufend = zeiten.filter((e) => !e.ende && !e.storniert).map((e) => ({ beschaeftigter_id: e.beschaeftigter_id, beginn: e.beginn }));
      return ok({ monat, eintraege: eintraege.map((e) => ({ id: e.id, beschaeftigter_id: e.beschaeftigter_id, beginn: e.beginn, ende: e.ende, pause_minuten: e.pause_minuten, quelle: e.quelle, grund: e.grund, minuten: minuten(e) })), summen_minuten: summen, laufend });
    }
    if (t[2] === "export") return fehler(404, "Den Export gibt es mit einem Konto.", "The export is available with an account.", s);
    const d = a.koerper;
    if (t[2] === "kommen" && m === "POST") {
      if (d.client_id) {
        const schon = zeiten.find((e) => e.client_id === d.client_id);
        if (schon) return ok(schon);
      }
      if (zeiten.some((e) => e.beschaeftigter_id === d.beschaeftigter_id && !e.ende && !e.storniert)) return fehler(409, "Es läuft schon eine Zeiterfassung für diese Person", "Time tracking is already running for this person", s);
      const e: Zeit = { id: k.id("zeit"), beschaeftigter_id: String(d.beschaeftigter_id), beginn: typeof d.zeitpunkt === "string" ? d.zeitpunkt : k.zeit(), ende: null, pause_minuten: 0, quelle: "stempel", grund: null, client_id: (d.client_id as string) ?? null, ende_client_id: null, storniert: false, ersetzt_id: null };
      zeiten.push(e);
      return ok(e);
    }
    if (t[2] === "gehen" && m === "POST") {
      if (d.client_id) {
        const schon = zeiten.find((e) => e.ende_client_id === d.client_id);
        if (schon) return ok(schon);
      }
      const e = zeiten.find((x) => x.beschaeftigter_id === d.beschaeftigter_id && !x.ende && !x.storniert);
      if (!e) return fehler(404, "Keine laufende Zeiterfassung", "No running time tracking", s);
      Object.assign(e, { ende: typeof d.zeitpunkt === "string" ? d.zeitpunkt : k.zeit(), pause_minuten: Number(d.pause_minuten ?? 0) || 0, ende_client_id: (d.client_id as string) ?? null });
      return ok(e);
    }
    if (t.length === 2 && m === "POST") {
      const grund = text(d.grund, 500);
      if (!grund || typeof d.beginn !== "string" || typeof d.ende !== "string") return fehler(422, "Bitte Beginn, Ende und Grund angeben.", "Please enter start, end and reason.", s);
      const e: Zeit = { id: k.id("zeit"), beschaeftigter_id: String(d.beschaeftigter_id), beginn: d.beginn, ende: d.ende, pause_minuten: Number(d.pause_minuten ?? 0) || 0, quelle: "nachtrag", grund, client_id: null, ende_client_id: null, storniert: false, ersetzt_id: null };
      zeiten.push(e);
      return ok(e);
    }
    if (t[3] === "korrigieren" && m === "POST") {
      const alt = gueltig(zeiten).find((e) => e.id === t[2]);
      const grund = text(d.grund, 500);
      if (!alt) return fehler(404, "Kein gültiger Zeiteintrag mit dieser ID", "No valid time entry with this ID", s);
      if (!grund) return fehler(422, "Bitte einen Grund angeben.", "Please enter a reason.", s);
      if (!alt.ende && !d.storniert) return fehler(409, "Laufende Zeiterfassung erst beenden", "End the running time tracking first", s);
      const e: Zeit = { ...alt, id: k.id("zeit"), beginn: (d.beginn as string) ?? alt.beginn, ende: (d.ende as string) ?? alt.ende ?? k.zeit(), pause_minuten: typeof d.pause_minuten === "number" ? d.pause_minuten : alt.pause_minuten, quelle: "korrektur", grund, storniert: d.storniert === true, ersetzt_id: alt.id, client_id: null, ende_client_id: null };
      zeiten.push(e);
      return ok(e);
    }
  }
  return undefined;
};
