/** Demo-Server: Konto, Unternehmen, Profil, Pflichten, Heute, Gründung, Ereignisse, Glossar (wie apps/api kern/pflichten/elster). */
import { fortschritt, fragebogenVorbereitung, offeneVoraussetzungen, ordne } from "@amtlos/fachlogik";
import { anzeigeStatus, heuteUebersicht } from "@amtlos/rules-engine";
import { fehler, nichtGefunden, ok, tx, type Modul, type Text } from "./kontext";

const MEIN_ELSTER = { titel: "Mein ELSTER", url: "https://www.elster.de/" };
const ELSTER_STATUS = {
  verfuegbar: false,
  grund: "Die direkte Übermittlung an ELSTER ist noch nicht freigeschaltet. Dafür fehlen die Registrierung von Amtlos als Software-Hersteller bei ELSTER und eine rechtliche Klärung.",
  alternative: MEIN_ELSTER,
};

export const kern: Modul = (a, k) => {
  const { pfad, methode: m, s } = a;
  const st = k.stand;

  if (pfad === "/v1/ich" && m === "GET")
    return ok({ konto: { id: "demo", email: "demo@amtlos.de", anzeigename: "Demo", sprache: s }, unternehmen: st.unternehmen ? [{ id: st.unternehmen.id, name: st.unternehmen.name, rolle: "inhaber" }] : [] });
  if (pfad === "/v1/ich/sprache") return ok(undefined, 204);
  if (pfad === "/v1/unternehmen" && m === "POST") {
    const name = String(a.koerper.name ?? "").trim();
    if (name.length < 1 || name.length > 200) return fehler(422, "Bitte gib einen Namen an.", "Please enter a name.", s);
    st.unternehmen = { id: "demo-unternehmen", name, erstellt_am: k.zeit() };
    return ok({ id: st.unternehmen.id, name, rolle: "inhaber" }, 201);
  }
  if (!st.unternehmen) return fehler(403, "Kein Unternehmen gewählt", "No company selected", s);

  if (pfad === "/v1/profil" && m === "GET") return ok(st.profil);
  if (pfad === "/v1/profil" && m === "PUT") {
    const jetzt = k.zeit();
    st.profil = { version: st.profil.version + 1, daten: { ...((a.koerper.daten as Record<string, unknown>) ?? {}) }, erstellt_am: jetzt, erste_am: st.profil.erste_am ?? jetzt };
    k.neuberechnen();
    return ok({ version: st.profil.version, daten: st.profil.daten });
  }

  if (pfad === "/v1/heute") {
    const heute = k.heute();
    const liste = k.sichtbar();
    const ue = heuteUebersicht(
      liste.map((i) => {
        const p = k.pflichtNachId.get(i.pflicht_id)!;
        return { pflicht_id: i.pflicht_id, periode: i.periode, kategorie: p.kategorie as string, anzeige_status: anzeigeStatus(i, heute), faellig_am: i.faellig_am, schwere: (p.sanktion as { schwere: "niedrig" | "mittel" | "hoch" }).schwere };
      }),
      heute,
    );
    const seit = st.profil.erste_am?.slice(0, 10) ?? null;
    const vorStart = seit ? liste.filter((i) => i.status === "offen" && i.faellig_am && i.faellig_am < seit).length : 0;
    return ok({ ...ue, als_naechstes: ue.als_naechstes.map((x) => k.karte(st.instanzen[`${x.pflicht_id}|${x.periode}`]!, s)), vor_start: { anzahl: vorStart, seit } });
  }

  if (pfad === "/v1/pflichten" && m === "GET") {
    const filter = a.suche.get("status") ?? "alle";
    return ok(k.sichtbar().map((i) => k.karte(i, s)).filter((x) => filter === "alle" || x.status === filter));
  }
  if (pfad === "/v1/pflichten/vor-start-erledigt" && m === "POST") {
    const seit = st.profil.erste_am?.slice(0, 10);
    let n = 0;
    for (const [sk, i] of Object.entries(st.instanzen))
      if (seit && i.status === "offen" && i.faellig_am && i.faellig_am < seit) {
        st.instanzen[sk] = { ...i, status: "erledigt", erledigt_am: k.zeit(), erledigt_mit_version_id: i.pflicht_version_id };
        st.nachweise.push({ id: k.id("nachweis"), schluessel: sk, art: "bestaetigung", notiz: "Vor dem Start bei Amtlos erledigt (Sammelbestätigung)", erstellt_am: k.zeit() });
        n++;
      }
    if (n) k.neuberechnen();
    return ok({ erledigt: n });
  }
  const p = /^\/v1\/pflichten\/([^/]+)\/([^/]+)(?:\/(erledigen|wieder-oeffnen))?$/.exec(pfad);
  if (p) {
    const sk = `${decodeURIComponent(p[1]!)}|${decodeURIComponent(p[2]!)}`;
    const i = st.instanzen[sk];
    if (!i || i.status === "entfallen") return nichtGefunden(s);
    if (p[3] === "erledigen") {
      if (i.status !== "offen") return fehler(404, "Keine offene Pflicht mit dieser Periode", "No open obligation for this period", s);
      st.instanzen[sk] = { ...i, status: "erledigt", erledigt_am: k.zeit(), erledigt_mit_version_id: i.pflicht_version_id };
      const notiz = typeof a.koerper.notiz === "string" && a.koerper.notiz.trim() ? a.koerper.notiz.trim().slice(0, 2000) : null;
      st.nachweise.push({ id: k.id("nachweis"), schluessel: sk, art: "bestaetigung", notiz, erstellt_am: k.zeit() });
      k.neuberechnen(); // abhängige Fristen (Bezug „pflicht_erledigt“) wie auf dem Server
      return ok({ pflicht_id: i.pflicht_id, periode: i.periode, status: "erledigt" });
    }
    if (p[3] === "wieder-oeffnen") {
      if (i.status !== "erledigt") return nichtGefunden(s);
      st.instanzen[sk] = { ...i, status: "offen", erledigt_am: null, erledigt_mit_version_id: null };
      k.neuberechnen();
      return ok({ pflicht_id: i.pflicht_id, periode: i.periode, status: "offen" });
    }
    const d = k.pflichtNachId.get(i.pflicht_id)!;
    return ok({
      ...k.karte(i, s),
      erklaerung: tx(d.erklaerung as Text, s) ?? "",
      begriffe: ((d.begriffe as { begriff: Text; erklaerung: Text }[] | undefined) ?? []).map((b) => ({ begriff: tx(b.begriff, s), erklaerung: tx(b.erklaerung, s) })),
      stelle: tx(d.stelle as Text, s) ?? "",
      kosten: d.kosten ? tx((d.kosten as { text: Text }).text, s) : null,
      quellen: d.quellen ?? [],
      dokumente: d.dokumente ?? [],
      pflicht_version: d.version,
      regelwerte: i.begruendung.regelwerte ?? [],
      begruendung: i.begruendung.knoten,
      nachweise: st.nachweise.filter((n) => n.schluessel === sk).map(({ id, art, notiz, erstellt_am }) => ({ id, art, notiz, dokument_id: null, erstellt_am })),
    });
  }

  if (pfad === "/v1/gruendung") {
    const zeilen = k.sichtbar().filter((i) => k.pflichtNachId.get(i.pflicht_id)!.phase === "gruendung");
    const schritte = zeilen.map((i) => {
      const d = k.pflichtNachId.get(i.pflicht_id)!;
      return { ...k.karte(i, s), katalog_nr: d.katalog_nr as string | undefined, voraussetzungen: (d.voraussetzungen as string[] | undefined) ?? [], stelle: tx(d.stelle as Text, s), kanal: d.kanal as string };
    });
    const titel = new Map(schritte.map((x) => [x.pflicht_id, x.titel]));
    const geordnet = ordne(schritte.filter((x) => x.status !== "nicht_zutreffend")).map((x) => ({
      ...x,
      gesperrt_durch: offeneVoraussetzungen(x, schritte).map((id) => ({ pflicht_id: id, titel: titel.get(id) })),
    }));
    const rechtsform = st.profil.daten.rechtsform as string | undefined;
    const kapital = rechtsform === "gmbh" || rechtsform === "ug" ? rechtsform : null;
    const heute = k.heute();
    const kennzahlen = kapital
      ? (k.katalog.regelwerte as unknown as { id: string; wert: number; einheit: string; bezeichnung: Text; gueltig_ab: string; gueltig_bis: string | null; pruefung?: { status?: string } }[])
          .filter((r) => r.id.startsWith(`gesellschaft.${kapital}.`) && r.gueltig_ab <= heute && (!r.gueltig_bis || r.gueltig_bis >= heute))
          .sort((x, y) => x.id.localeCompare(y.id))
          .map((r) => ({ id: r.id, bezeichnung: tx(r.bezeichnung, s), wert: Number(r.wert), einheit: r.einheit, ungeprueft: r.pruefung?.status !== "freigegeben" }))
      : [];
    return ok({ schritte: geordnet, fortschritt: fortschritt(schritte), kapitalgesellschaft: kapital, kennzahlen });
  }
  if (pfad === "/v1/gruendung/fragebogen") return ok({ ...fragebogenVorbereitung(st.unternehmen.name, st.profil.daten, s), uebermittlung: ELSTER_STATUS });
  if (pfad === "/v1/elster/status") return ok(ELSTER_STATUS);
  if (pfad.startsWith("/v1/elster/") && m === "POST") return { status: 501, wert: { statusCode: 501, message: ELSTER_STATUS.grund, ...ELSTER_STATUS } };

  if (pfad === "/v1/glossar") {
    const begriffe = new Map<string, { begriff: string; erklaerung: string; pflichten: { id: string; titel: string }[] }>();
    for (const pf of k.katalog.pflichten as unknown as { id: string; titel: Text; begriffe?: { begriff: Text; erklaerung: Text }[] }[])
      for (const b of pf.begriffe ?? []) {
        const name = tx(b.begriff, s)!;
        const e = begriffe.get(name.toLowerCase()) ?? { begriff: name, erklaerung: tx(b.erklaerung, s)!, pflichten: [] };
        e.pflichten.push({ id: pf.id, titel: tx(pf.titel, s)! });
        begriffe.set(name.toLowerCase(), e);
      }
    return ok([...begriffe.values()].sort((x, y) => x.begriff.localeCompare(y.begriff, s)));
  }

  if (pfad === "/v1/ereignisse" && m === "GET") {
    const storniert = new Set(st.ereignisse.map((e) => e.storniert_ereignis_id).filter(Boolean));
    return ok(
      [...st.ereignisse]
        .sort((x, y) => y.datum.localeCompare(x.datum) || y.erfasst_am.localeCompare(x.erfasst_am))
        .map((e) => ({ id: e.id, typ: e.typ, datum: e.datum, payload: e.payload, erfasst_am: e.erfasst_am, storniert_ereignis_id: e.storniert_ereignis_id, storniert: storniert.has(e.id) })),
    );
  }
  if (pfad === "/v1/ereignisse" && m === "POST") {
    const typ = String(a.koerper.typ ?? "");
    const datum = String(a.koerper.datum ?? "");
    if (!typ || !/^\d{4}-\d{2}-\d{2}$/.test(datum)) return fehler(422, "Bitte Art und Datum angeben.", "Please enter type and date.", s);
    const id = k.id("ereignis");
    st.ereignisse.push({ id, typ, datum, erfasst_am: k.zeit(), storniert_ereignis_id: null, payload: (a.koerper.payload as Record<string, unknown>) ?? {} });
    k.neuberechnen();
    return ok({ id, typ, datum, wiederholt: false });
  }
  const storno = /^\/v1\/ereignisse\/([^/]+)\/storno$/.exec(pfad);
  if (storno && m === "POST") {
    const alt = st.ereignisse.find((e) => e.id === storno[1] && !e.storniert_ereignis_id);
    if (!alt) return nichtGefunden(s);
    if (!st.ereignisse.some((e) => e.storniert_ereignis_id === alt.id)) {
      st.ereignisse.push({ id: k.id("ereignis"), typ: alt.typ, datum: alt.datum, erfasst_am: k.zeit(), storniert_ereignis_id: alt.id, payload: {} });
      k.neuberechnen();
    }
    return ok({ id: alt.id, storniert: true });
  }
  return undefined;
};
