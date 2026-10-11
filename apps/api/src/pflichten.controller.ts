import { createHash, randomBytes } from "node:crypto";
import { Body, Controller, Get, Header, Inject, NotFoundException, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { entscheidendeSaetze, type Knoten } from "@amtlos/rules-engine";
import { Datenbank, heute, ladeAktivenKatalog, neuberechnungEinreihen, type Tx } from "@amtlos/server";
import { Kontext, MitUnternehmen, Oeffentlich, type Anfragekontext } from "./auth.js";
import { BEREICH_JE_KATEGORIE, heuteUebersicht } from "./heute.js";
import { pruefe, t, uebersetzeDbFehler, type Text } from "./hilfen.js";
import { erzeugeIcs } from "./ics.js";
import { fortschritt, offeneVoraussetzungen, ordne } from "./gruendung.js";
import { KONFIGURATION, type Konfiguration } from "./konfiguration.js";
import { WARTESCHLANGE } from "./kern.controller.js";

interface Zeile {
  id: string;
  pflicht_id: string;
  periode: string;
  anzeige_status: string;
  ergebnis: string;
  faellig_am: string | null;
  faellig_roh: string | null;
  begruendung: { knoten: Knoten; hinweise: string[]; regelwerte: { id: string; version: number }[] };
  fehlende_fakten: string[];
  nicht_zutreffend_grund: string | null;
  erledigt_am: string | null;
  version: number;
  pruef_status: string;
  geprueft_von: string[] | null;
  geprueft_am: string | null;
  daten: Record<string, unknown> & {
    titel: Text; kurz: Text; erklaerung: Text; kategorie: string; rechtsgrundlage: string[];
    sanktion: { text: Text; schwere: "niedrig" | "mittel" | "hoch" }; stelle: Text;
    begriffe?: { begriff: Text; erklaerung: Text }[]; kosten?: { text: Text } | null; aktion?: unknown;
    quellen: { titel: string; url: string; abgerufen: string | null }[]; dokumente?: string[];
  };
}

const ABFRAGE = `
  select pi.id, pi.pflicht_id, pi.periode, pi.anzeige_status, pi.ergebnis, pi.faellig_am, pi.faellig_roh, pi.begruendung,
         pi.fehlende_fakten, pi.nicht_zutreffend_grund, pi.erledigt_am, pv.version, pv.pruef_status, pv.daten,
         pr.geprueft_von, pr.geprueft_am
    from app.pflicht_instanz_anzeige pi
    join katalog.pflicht_version pv on pv.id = pi.pflicht_version_id
    join katalog.pflicht_version_pruefung pr on pr.id = pv.id
   where pi.unternehmen_id = $1`;

function karte(z: Zeile, s: "de" | "en") {
  const d = z.daten;
  return {
    pflicht_id: z.pflicht_id,
    periode: z.periode,
    status: z.anzeige_status,
    ergebnis: z.ergebnis,
    faellig_am: z.faellig_am,
    verschoben_von: z.faellig_roh && z.faellig_am && z.faellig_roh !== z.faellig_am ? z.faellig_roh : null,
    titel: t(d.titel, s),
    kurz: t(d.kurz, s),
    kategorie: d.kategorie,
    branchen: (d.branchen as string[] | undefined) ?? [],
    bereich: BEREICH_JE_KATEGORIE[d.kategorie] ?? "gesellschaft",
    sanktion: { text: t(d.sanktion.text, s), schwere: d.sanktion.schwere },
    rechtsgrundlage: d.rechtsgrundlage,
    // gilt: „gilt für dich, weil …“ · unbekannt: diese Bedingungen sind noch zu klären (als Fragen anzeigen)
    warum: z.ergebnis === "gilt" ? entscheidendeSaetze(z.begruendung.knoten, s) : [],
    zu_klaeren: z.ergebnis === "unbekannt" ? entscheidendeSaetze(z.begruendung.knoten, s) : [],
    nicht_zutreffend_grund: z.nicht_zutreffend_grund,
    fehlende_fakten: z.fehlende_fakten,
    hinweise: z.begruendung.hinweise ?? [],
    aktion: d.aktion ?? null,
    pruefung: { status: z.pruef_status, geprueft_von: z.geprueft_von, geprueft_am: z.geprueft_am },
    // E-038: in dev/staging können ungeprüfte Inhalte erscheinen – die Oberfläche zeigt dann ein Banner
    ungeprueft: z.pruef_status !== "freigegeben",
    erledigt_am: z.erledigt_am,
  };
}

const StatusFilter = z.enum(["offen", "faellig_bald", "ueberfaellig", "angabe_fehlt", "erledigt", "nicht_zutreffend", "alle"]).default("alle");
const Erledigen = z.object({ notiz: z.string().max(2000).optional() }).strict();
const PERIODE = /^(einmalig|\d{4}(-(0[1-9]|1[0-2]|Q[1-4]|H[12]))?|aenderung-\d+)$/;

@Controller("v1")
export class PflichtenController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(KONFIGURATION) private readonly k: Konfiguration,
  ) {}

  private laden(k: Anfragekontext, tx: Tx, zusatz = "", werte: unknown[] = []) {
    return tx.abfrage<Zeile>(`${ABFRAGE} ${zusatz} order by pi.faellig_am nulls last, pi.pflicht_id, pi.periode`, [k.unternehmenId, ...werte]);
  }

  @MitUnternehmen()
  @Get("pflichten")
  async liste(@Kontext() k: Anfragekontext, @Query("status") status?: string) {
    const filter = pruefe(StatusFilter, status);
    const zeilen = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      this.laden(k, tx, filter === "alle" ? "and pi.status <> 'entfallen'" : "and pi.anzeige_status = $2", filter === "alle" ? [] : [filter]),
    );
    return zeilen.map((z) => karte(z, k.sprache));
  }

  @MitUnternehmen()
  @Get("pflichten/:pflichtId/:periode")
  async detail(@Kontext() k: Anfragekontext, @Param("pflichtId") pflichtId: string, @Param("periode") periode: string) {
    if (!PERIODE.test(periode)) throw new NotFoundException();
    return this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
      const [z] = await this.laden(k, tx, "and pi.pflicht_id = $2 and pi.periode = $3", [pflichtId, periode]);
      if (!z) throw new NotFoundException("Pflicht nicht gefunden");
      const nachweise = await tx.abfrage("select id, art, notiz, dokument_id, erstellt_am from app.nachweis where pflicht_instanz_id = $1 order by erstellt_am", [z.id]);
      const s = k.sprache;
      const d = z.daten;
      return {
        ...karte(z, s),
        erklaerung: t(d.erklaerung, s),
        begriffe: (d.begriffe ?? []).map((b) => ({ begriff: t(b.begriff, s), erklaerung: t(b.erklaerung, s) })),
        stelle: t(d.stelle, s),
        kosten: d.kosten ? t(d.kosten.text, s) : null,
        quellen: d.quellen,
        dokumente: d.dokumente ?? [],
        pflicht_version: z.version,
        regelwerte: z.begruendung.regelwerte ?? [],
        begruendung: z.begruendung.knoten,
        nachweise,
      };
    });
  }

  @MitUnternehmen("inhaber", "admin", "steuerberater", "mitarbeiter")
  @Post("pflichten/:pflichtId/:periode/erledigen")
  async erledigen(@Kontext() k: Anfragekontext, @Param("pflichtId") pflichtId: string, @Param("periode") periode: string, @Body() body: unknown) {
    const { notiz } = pruefe(Erledigen, body ?? {});
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const i = await tx.eine<{ id: string }>(
          `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $3, erledigt_mit_version_id = pflicht_version_id, aktualisiert_am = now()
            where pflicht_id = $1 and periode = $2 and status = 'offen' returning id`,
          [pflichtId, periode, k.kontoId],
        );
        if (!i) throw new NotFoundException("Keine offene Pflicht mit dieser Periode");
        await tx.abfrage("insert into app.nachweis (unternehmen_id, pflicht_instanz_id, art, notiz, erstellt_von) values ($1, $2, 'bestaetigung', $3, $4)", [
          k.unternehmenId, i.id, notiz ?? null, k.kontoId,
        ]);
        // Abhängige Fristen (Bezug 'pflicht_erledigt') und Erinnerungen neu berechnen
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `erledigt:${pflichtId}:${periode}` });
        return { pflicht_id: pflichtId, periode, status: "erledigt" };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Post("pflichten/:pflichtId/:periode/wieder-oeffnen")
  async wiederOeffnen(@Kontext() k: Anfragekontext, @Param("pflichtId") pflichtId: string, @Param("periode") periode: string) {
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const i = await tx.eine(
          `update app.pflicht_instanz set status = 'offen', erledigt_am = null, erledigt_von = null, erledigt_mit_version_id = null, aktualisiert_am = now()
            where pflicht_id = $1 and periode = $2 and status = 'erledigt' returning id`,
          [pflichtId, periode],
        );
        if (!i) throw new NotFoundException("Keine erledigte Pflicht mit dieser Periode");
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `wieder-offen:${pflichtId}:${periode}` });
        return { pflicht_id: pflichtId, periode, status: "offen" };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen()
  @Get("heute")
  async heute(@Kontext() k: Anfragekontext) {
    const zeilen = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) => this.laden(k, tx, "and pi.status <> 'entfallen'"));
    const karten = new Map(zeilen.map((z) => [`${z.pflicht_id}|${z.periode}`, karte(z, k.sprache)]));
    const u = heuteUebersicht(
      zeilen.map((z) => ({ pflicht_id: z.pflicht_id, periode: z.periode, kategorie: z.daten.kategorie, anzeige_status: z.anzeige_status, faellig_am: z.faellig_am, schwere: z.daten.sanktion.schwere })),
      heute(),
    );
    // Fristen vor dem Start bei Amtlos: beim ersten Profil oft längst erledigt – gesammelt bestätigen lassen
    const vorStart = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      tx.eine<{ anzahl: number; seit: string | null }>(
        `select count(*)::int as anzahl, (select min(erstellt_am)::date::text from app.profil_version where unternehmen_id = $1) as seit
           from app.pflicht_instanz
          where unternehmen_id = $1 and status = 'offen' and faellig_am < (select min(erstellt_am)::date from app.profil_version where unternehmen_id = $1)`,
        [k.unternehmenId],
      ),
    );
    return { ...u, als_naechstes: u.als_naechstes.map((a) => karten.get(`${a.pflicht_id}|${a.periode}`)), vor_start: vorStart };
  }

  /** Sammelbestätigung: alle offenen Pflichten, die vor dem ersten Profil fällig waren, als erledigt markieren. */
  @MitUnternehmen("inhaber", "admin", "steuerberater")
  @Post("pflichten/vor-start-erledigt")
  async vorStartErledigt(@Kontext() k: Anfragekontext) {
    return this.db
      .imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
        const ids = await tx.abfrage<{ id: string }>(
          `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $2, erledigt_mit_version_id = pflicht_version_id, aktualisiert_am = now()
            where unternehmen_id = $1 and status = 'offen'
              and faellig_am < (select min(erstellt_am)::date from app.profil_version where unternehmen_id = $1)
            returning id`,
          [k.unternehmenId, k.kontoId],
        );
        for (const { id } of ids)
          await tx.abfrage(
            "insert into app.nachweis (unternehmen_id, pflicht_instanz_id, art, notiz, erstellt_von) values ($1, $2, 'bestaetigung', 'Vor dem Start bei Amtlos erledigt (Sammelbestätigung)', $3)",
            [k.unternehmenId, id, k.kontoId],
          );
        if (ids.length) await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: "vor-start-erledigt" });
        return { erledigt: ids.length };
      })
      .catch(uebersetzeDbFehler);
  }

  /**
   * Gründungsassistent (6.2): alle Pflichten mit phase=gruendung in der Reihenfolge ihrer Voraussetzungen,
   * mit Sperre („erst … erledigen“) und Fortschritt. Für UG/GmbH zusätzlich die Kennzahlen aus den Regelwerten.
   */
  @MitUnternehmen()
  @Get("gruendung")
  async gruendung(@Kontext() k: Anfragekontext) {
    return this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, async (tx) => {
      const zeilen = await this.laden(k, tx, "and pi.status <> 'entfallen' and pv.daten->>'phase' = 'gruendung'");
      const schritte = zeilen.map((z) => ({
        ...karte(z, k.sprache),
        status: z.anzeige_status,
        katalog_nr: z.daten.katalog_nr as string | undefined,
        voraussetzungen: (z.daten.voraussetzungen as string[] | undefined) ?? [],
        stelle: t(z.daten.stelle, k.sprache),
        kanal: z.daten.kanal as string,
      }));
      const titel = new Map(schritte.map((x) => [x.pflicht_id, x.titel]));
      const geordnet = ordne(schritte.filter((x) => x.status !== "nicht_zutreffend")).map((x) => ({
        ...x,
        gesperrt_durch: offeneVoraussetzungen(x, schritte).map((id) => ({ pflicht_id: id, titel: titel.get(id) })),
      }));
      const profil = await tx.eine<{ daten: Record<string, unknown> }>(
        "select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1",
        [k.unternehmenId],
      );
      const rechtsform = profil?.daten.rechtsform as string | undefined;
      const kennzahlen =
        rechtsform === "gmbh" || rechtsform === "ug"
          ? await tx.abfrage<{ id: string; wert: number; einheit: string; bezeichnung: Text; pruef_status: string }>(
              `select rv.regelwert_id as id, rv.wert::float8 as wert, r.einheit, r.bezeichnung, rv.pruef_status
                 from katalog.aktives_release a
                 join katalog.release_inhalt ri on ri.release_id = a.id and ri.objekt_art = 'regelwert_version'
                 join katalog.regelwert_version rv on rv.id = ri.objekt_id
                 join katalog.regelwert r on r.id = rv.regelwert_id
                where rv.regelwert_id like $1 and rv.gueltig_ab <= $2::date and (rv.gueltig_bis is null or rv.gueltig_bis >= $2::date)
                order by rv.regelwert_id`,
              [`gesellschaft.${rechtsform}.%`, heute()],
            )
          : [];
      return {
        schritte: geordnet,
        fortschritt: fortschritt(schritte),
        kapitalgesellschaft: rechtsform === "gmbh" || rechtsform === "ug" ? rechtsform : null,
        kennzahlen: kennzahlen.map((r) => ({ id: r.id, bezeichnung: t(r.bezeichnung, k.sprache), wert: r.wert, einheit: r.einheit, ungeprueft: r.pruef_status !== "freigegeben" })),
      };
    });
  }

  /** Fachbegriffe aus dem aktiven Katalog (Prinzip 5: jeder Fachbegriff hat eine Ein-Satz-Erklärung). */
  @MitUnternehmen()
  @Get("glossar")
  async glossar(@Kontext() k: Anfragekontext) {
    const aktiv = await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) => ladeAktivenKatalog(tx));
    const begriffe = new Map<string, { begriff: string; erklaerung: string; pflichten: { id: string; titel: string }[] }>();
    for (const p of aktiv?.katalog.pflichten ?? []) {
      for (const b of (p.begriffe as { begriff: Text; erklaerung: Text }[] | undefined) ?? []) {
        const name = t(b.begriff, k.sprache)!;
        const eintrag = begriffe.get(name.toLowerCase()) ?? { begriff: name, erklaerung: t(b.erklaerung, k.sprache)!, pflichten: [] };
        eintrag.pflichten.push({ id: p.id, titel: t(p.titel, k.sprache)! });
        begriffe.set(name.toLowerCase(), eintrag);
      }
    }
    return [...begriffe.values()].sort((a, b) => a.begriff.localeCompare(b.begriff, k.sprache));
  }

  /** Legt ein Kalender-Abo an; das Token wird nur jetzt im Klartext gezeigt (gespeichert als SHA-256). */
  @MitUnternehmen()
  @Post("kalender/abo")
  async kalenderAbo(@Kontext() k: Anfragekontext) {
    const token = randomBytes(32).toString("base64url");
    await this.db.imKontext({ kontoId: k.kontoId, unternehmenId: k.unternehmenId }, (tx) =>
      tx.abfrage("insert into app.kalender_abo (unternehmen_id, konto_id, token_hash) values ($1, $2, $3)", [
        k.unternehmenId, k.kontoId, createHash("sha256").update(token).digest(),
      ]),
    );
    return { url: `${this.k.API_URL}/v1/kalender/${token}.ics` };
  }

  @Oeffentlich()
  @Get("kalender/:datei")
  @Header("Cache-Control", "private, max-age=900")
  async kalenderIcs(@Param("datei") datei: string, @Res() res: Response) {
    const token = /^([A-Za-z0-9_-]{43})\.ics$/.exec(datei)?.[1];
    if (!token) throw new NotFoundException();
    const abo = await this.db.imKontext({}, (tx) =>
      tx.eine<{ konto_id: string; unternehmen_id: string }>("select * from app.kalender_abo_aufloesen($1)", [createHash("sha256").update(token).digest()]),
    );
    if (!abo) throw new NotFoundException();
    const { name, zeilen, sprache } = await this.db.imKontext({ kontoId: abo.konto_id, unternehmenId: abo.unternehmen_id }, async (tx) => ({
      name: (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [abo.unternehmen_id]))?.name ?? "Amtlos",
      sprache: (await tx.eine<{ sprache: "de" | "en" }>("select sprache from app.konto where id = $1", [abo.konto_id]))?.sprache ?? "de",
      zeilen: await tx.abfrage<Zeile>(`${ABFRAGE} and pi.status = 'offen' and pi.faellig_am is not null order by pi.faellig_am`, [abo.unternehmen_id]),
    }));
    const ics = erzeugeIcs(
      `Amtlos – ${name}`,
      zeilen.map((z) => ({
        uid: `${z.id}@amtlos`,
        datum: z.faellig_am!,
        titel: t(z.daten.titel, sprache)!,
        beschreibung: t(z.daten.kurz, sprache),
        url: `${this.k.WEB_URL}/pflichten/${encodeURIComponent(z.pflicht_id)}/${encodeURIComponent(z.periode)}`,
      })),
    );
    res.type("text/calendar; charset=utf-8").send(ics);
  }
}
