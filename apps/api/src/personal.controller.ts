import { createHash } from "node:crypto";
import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Header, HttpCode, Inject, NotFoundException, Param, Post, Put, Query, UnprocessableEntityException } from "@nestjs/common";
import type PgBoss from "pg-boss";
import { z } from "zod";
import { StandardKalender } from "@amtlos/fristen";
import { auswerten } from "@amtlos/rules-engine";
import { Datenbank, dokumentAblegen, heute, ladeAktivenKatalog, neuberechnungEinreihen, profilZuFakten, unterweisungsprotokollPdf, type Ablage, type Tx } from "@amtlos/server";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { ABLAGE } from "./finanzen.controller.js";
import { pruefe, t, uebersetzeDbFehler, type Text } from "./hilfen.js";
import { WARTESCHLANGE } from "./kern.controller.js";
import { profilNachziehen } from "./profil-sync.js";

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
/** Spezifikation 6.6: Schwellenwert-Wächter für 10, 20, 50, 150, 250 Beschäftigte */
export const SCHWELLEN = [10, 20, 50, 150, 250];

const Uuid = z.string().uuid();
const DATUM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const ART = z.enum(["vollzeit", "teilzeit", "minijob", "azubi", "werkstudent"]);
const BeschaeftigterNeu = z
  .object({ vorname: z.string().trim().min(1).max(100), nachname: z.string().trim().min(1).max(100), art: ART, eintritt: DATUM, wochenstunden: z.number().positive().max(80).nullable().optional() })
  .strict();
const BeschaeftigterAendern = BeschaeftigterNeu.omit({ eintritt: true });
const UNTERWEISUNGSARTEN = ["arbeitsschutz", "ki_kompetenz", "datenschutz"] as const;
const UnterweisungNeu = z
  .object({
    thema: z.string().trim().min(1).max(200), inhalt: z.string().trim().min(1).max(20000), datum: DATUM, durchgefuehrt_von: z.string().trim().min(1).max(200),
    teilnehmer: z.array(Uuid).max(500).default([]), art: z.enum(UNTERWEISUNGSARTEN).default("arbeitsschutz"),
  })
  .strict();
const Bestaetigen = z.object({ beschaeftigter_id: Uuid, name: z.string().trim().min(1).max(200) }).strict();
const Zeitpunkt = z.string().datetime({ offset: true });
const ZeitNachtrag = z.object({ beschaeftigter_id: Uuid, beginn: Zeitpunkt, ende: Zeitpunkt, pause_minuten: z.number().int().min(0).max(1440).default(0), grund: z.string().trim().min(1).max(500) }).strict();
const ZeitKorrektur = z.object({ beginn: Zeitpunkt.optional(), ende: Zeitpunkt.optional(), pause_minuten: z.number().int().min(0).max(1440).optional(), storniert: z.boolean().optional(), grund: z.string().trim().min(1).max(500) }).strict();

const hash = (s: string) => createHash("sha256").update(s).digest();

interface Beschaeftigter { id: string; vorname: string; nachname: string; art: string; eintritt: string; austritt: string | null; wochenstunden: string | null }

@Controller("v1")
export class PersonalController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(ABLAGE) private readonly ablage: Ablage,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  /** Profil-Anzahlen aus der Personalliste: alle, die heute oder künftig beschäftigt sind (ohne Austritt in der Vergangenheit). */
  private async anzahlenNachziehen(tx: Tx, k: Anfragekontext) {
    const a = await tx.eine<Record<string, number>>(
      `select count(*)::int as gesamt,
              count(*) filter (where art = 'vollzeit')::int as vollzeit, count(*) filter (where art = 'teilzeit')::int as teilzeit,
              count(*) filter (where art = 'minijob')::int as minijob, count(*) filter (where art = 'azubi')::int as azubi,
              count(*) filter (where art = 'werkstudent')::int as werkstudent
         from app.beschaeftigter where unternehmen_id = $1 and (austritt is null or austritt >= $2::date)`,
      [k.unternehmenId, heute()],
    );
    await profilNachziehen(tx, k.unternehmenId!, k.kontoId, Object.fromEntries(Object.entries(a!).map(([s, n]) => [`beschaeftigte.${s}`, n])));
  }

  private async ereignis(tx: Tx, k: Anfragekontext, typ: string, datum: string, payload: Record<string, unknown>) {
    await tx.abfrage("insert into app.ereignis (unternehmen_id, typ, eingetreten_am, payload, quelle, erfasst_von) values ($1, $2, $3, $4, 'nutzer', $5)", [
      k.unternehmenId, typ, datum, payload, k.kontoId,
    ]);
  }

  // ------------------------------------------------------------ Beschäftigte

  @MitUnternehmen()
  @Get("beschaeftigte")
  async liste(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage("select *, wochenstunden::float8 as wochenstunden from app.beschaeftigter where unternehmen_id = $1 order by (austritt is not null), nachname, vorname", [k.unternehmenId]),
    );
  }

  /** Einstellung: meldet „Einstellung“ (und beim ersten Mal „erste Einstellung“), zieht die Anzahlen im Profil nach. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("beschaeftigte")
  async einstellen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(BeschaeftigterNeu, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const erste = !(await tx.eine("select 1 from app.ereignis where unternehmen_id = $1 and typ in ('erste_einstellung', 'einstellung') and storniert_ereignis_id is null", [k.unternehmenId]));
        const b = await tx.eine<{ id: string }>(
          "insert into app.beschaeftigter (unternehmen_id, vorname, nachname, art, eintritt, wochenstunden) values ($1, $2, $3, $4, $5, $6) returning *, wochenstunden::float8 as wochenstunden",
          [k.unternehmenId, d.vorname, d.nachname, d.art, d.eintritt, d.wochenstunden ?? null],
        );
        if (erste) await this.ereignis(tx, k, "erste_einstellung", d.eintritt, { arbeitsbeginn: d.eintritt });
        await this.ereignis(tx, k, "einstellung", d.eintritt, { arbeitsbeginn: d.eintritt, beschaeftigungsart: d.art, beschaeftigter_id: b!.id });
        await this.anzahlenNachziehen(tx, k);
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `einstellung:${b!.id}` });
        return b;
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("beschaeftigte/:id")
  async aendern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(BeschaeftigterAendern, body);
    const r = await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const b = await tx.eine("update app.beschaeftigter set vorname = $2, nachname = $3, art = $4, wochenstunden = $5 where id = $1 returning *, wochenstunden::float8 as wochenstunden", [id, d.vorname, d.nachname, d.art, d.wochenstunden ?? null]);
        if (b) {
          await this.anzahlenNachziehen(tx, k);
          await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `beschaeftigter:${id}` });
        }
        return b;
      })
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Beschäftigte Person nicht gefunden");
    return r;
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("beschaeftigte/:id/austritt")
  async austritt(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const { datum } = pruefe(z.object({ datum: DATUM }).strict(), body);
    const r = await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const b = await tx.eine("update app.beschaeftigter set austritt = $2 where id = $1 and austritt is null returning *, wochenstunden::float8 as wochenstunden", [id, datum]);
        if (!b) return null;
        await this.ereignis(tx, k, "austritt", datum, { ende: datum, beschaeftigter_id: id });
        await this.anzahlenNachziehen(tx, k);
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `austritt:${id}` });
        return b;
      })
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Keine aktive Beschäftigung mit dieser ID");
    return r;
  }

  /** Checkliste zur Einstellung: alle Pflichten, die für den Eintrittstag entstanden sind (je_ereignis). */
  @MitUnternehmen()
  @Get("beschaeftigte/:id/checkliste")
  async checkliste(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const b = await tx.eine<Beschaeftigter>("select * from app.beschaeftigter where id = $1", [id]);
      if (!b) throw new NotFoundException("Beschäftigte Person nicht gefunden");
      const perioden = [`aenderung-${b.eintritt.replaceAll("-", "")}`, ...(b.austritt ? [`aenderung-${b.austritt.replaceAll("-", "")}`] : [])];
      const zeilen = await tx.abfrage<{ pflicht_id: string; periode: string; anzeige_status: string; faellig_am: string | null; titel: Text; kurz: Text }>(
        `select pi.pflicht_id, pi.periode, pi.anzeige_status, pi.faellig_am, pv.daten->'titel' as titel, pv.daten->'kurz' as kurz
           from app.pflicht_instanz_anzeige pi join katalog.pflicht_version pv on pv.id = pi.pflicht_version_id
          where pi.unternehmen_id = $1 and pi.periode = any($2) and pi.status <> 'entfallen'
          order by pi.faellig_am nulls last, pi.pflicht_id`,
        [k.unternehmenId, perioden],
      );
      return {
        beschaeftigter: b,
        schritte: zeilen.map((z) => ({ pflicht_id: z.pflicht_id, periode: z.periode, status: z.anzeige_status, faellig_am: z.faellig_am, titel: t(z.titel, k.sprache), kurz: t(z.kurz, k.sprache), anlass: z.periode === perioden[0] ? "einstellung" : "austritt" })),
      };
    });
  }

  /**
   * Schwellenwert-Wächter (6.6): Welche Pflichten kämen bei 10, 20, 50, 150, 250 Beschäftigten hinzu (je Stufe nur die neuen)? Die erste Stufe ist immer „eine Person mehr“, damit niedrige Schwellen (z. B. Ersthelfer) nicht erst bei 10 auftauchen.
   * Berechnet mit dem aktiven Katalog und dem heutigen Profil, nur die Beschäftigtenzahl verändert.
   * Pflichten, deren Zählweise offen ist, erscheinen als „zu prüfen“.
   */
  @MitUnternehmen()
  @Get("personal/schwellen")
  async schwellen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const aktiv = await ladeAktivenKatalog(tx);
      const profil = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
      if (!aktiv || !profil) return { aktuell: 0, schwellen: [] };
      const stichtag = heute();
      const kalender = new StandardKalender();
      const aktuell = Number(profil.daten["beschaeftigte.gesamt"] ?? 0);
      const lauf = (gesamt: number) =>
        new Map(auswerten({ katalog: aktiv.katalog, fakten: profilZuFakten({ ...profil.daten, "beschaeftigte.gesamt": gesamt }), ereignisse: [], stichtag, kalender }).map((e) => [e.pflicht_id, e]));
      const basis = lauf(aktuell);
      const titel = new Map(aktiv.katalog.pflichten.map((p) => [p.id, t(p.titel, k.sprache)]));
      // Je Schwelle nur, was gegenüber der vorigen Stufe neu hinzukommt; leere Zwischenstufe „eine Person mehr“ entfällt
      let vorher = basis;
      return {
        aktuell,
        schwellen: [...new Set([aktuell + 1, ...SCHWELLEN])].filter((s) => s > aktuell).sort((a, b) => a - b).map((s) => {
          const neu = lauf(s);
          const kommen = [...neu.values()].filter((e) => !e.radar && e.ergebnis !== "gilt_nicht" && vorher.get(e.pflicht_id)?.ergebnis === "gilt_nicht");
          vorher = neu;
          return {
            ab: s,
            neu: kommen.filter((e) => e.ergebnis === "gilt").map((e) => ({ pflicht_id: e.pflicht_id, titel: titel.get(e.pflicht_id) })),
            zu_pruefen: kommen.filter((e) => e.ergebnis === "unbekannt").map((e) => ({ pflicht_id: e.pflicht_id, titel: titel.get(e.pflicht_id) })),
          };
        }).filter((x) => SCHWELLEN.includes(x.ab) || x.neu.length + x.zu_pruefen.length > 0),
      };
    });
  }

  /** Stammdaten für den Lohnpartner bzw. die Steuerberatung (CSV, Semikolon, UTF-8 mit BOM für Excel). */
  @MitUnternehmen(...SCHREIBEN)
  @Get("personal/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="beschaeftigte.csv"')
  async export(@Kontext() k: Anfragekontext) {
    const zeilen = await this.db.imKontext(this.kontext(k), (tx) => tx.abfrage<Beschaeftigter>("select * from app.beschaeftigter where unternehmen_id = $1 order by nachname, vorname", [k.unternehmenId]));
    const feld = (x: unknown) => `"${String(x ?? "").replaceAll('"', '""')}"`;
    return "﻿" + ["Nachname;Vorname;Art;Eintritt;Austritt;Wochenstunden", ...zeilen.map((b) => [b.nachname, b.vorname, b.art, b.eintritt, b.austritt, b.wochenstunden].map(feld).join(";"))].join("\r\n") + "\r\n";
  }

  // ------------------------------------------------------------ Unterweisungen

  @MitUnternehmen()
  @Get("unterweisungen")
  async unterweisungen(@Kontext() k: Anfragekontext, @Query("art") art?: string) {
    if (art !== undefined && !(UNTERWEISUNGSARTEN as readonly string[]).includes(art)) throw new BadRequestException("art unbekannt");
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select u.id, u.thema, u.art, u.datum, u.durchgefuehrt_von, u.abgeschlossen_am, u.dokument_id,
                (select count(*)::int from app.unterweisung_teilnahme t where t.unterweisung_id = u.id) as bestaetigt
           from app.unterweisung u where u.unternehmen_id = $1 and ($2::text is null or u.art = $2) order by u.datum desc, u.erstellt_am desc`,
        [k.unternehmenId, art ?? null],
      ),
    );
  }

  @MitUnternehmen()
  @Get("unterweisungen/:id")
  async unterweisung(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const u = await tx.eine<Record<string, unknown> & { inhalt_sha256: Buffer }>("select * from app.unterweisung where id = $1", [id]);
      if (!u) throw new NotFoundException("Unterweisung nicht gefunden");
      const teilnahmen = await tx.abfrage(
        `select t.beschaeftigter_id, b.vorname, b.nachname, t.bestaetigt_am, t.name_bestaetigt
           from app.unterweisung_teilnahme t join app.beschaeftigter b on b.id = t.beschaeftigter_id where t.unterweisung_id = $1 order by b.nachname`,
        [id],
      );
      return { ...u, inhalt_sha256: u.inhalt_sha256.toString("hex"), teilnahmen };
    });
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("unterweisungen")
  async unterweisungAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(UnterweisungNeu, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          `insert into app.unterweisung (unternehmen_id, thema, inhalt, datum, durchgefuehrt_von, inhalt_sha256, erstellt_von, art)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, thema, datum, art`,
          [k.unternehmenId, d.thema, d.inhalt, d.datum, d.durchgefuehrt_von, hash(`${d.thema}\n${d.inhalt}`), k.kontoId, d.art],
        ),
      )
      .catch(uebersetzeDbFehler);
  }

  /**
   * Bestätigung durch die unterwiesene Person (einfache elektronische Signatur, Spezifikation 7): Der eingetippte Name
   * muss zum Namen der Person passen. Gespeichert werden Name, Zeitpunkt und der Hash des bestätigten Inhalts.
   */
  @MitUnternehmen()
  @Post("unterweisungen/:id/bestaetigen")
  async bestaetigen(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(Bestaetigen, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const u = await tx.eine<{ inhalt_sha256: Buffer; abgeschlossen_am: string | null }>("select inhalt_sha256, abgeschlossen_am from app.unterweisung where id = $1", [id]);
        if (!u) throw new NotFoundException("Unterweisung nicht gefunden");
        if (u.abgeschlossen_am) throw new ConflictException("Unterweisung ist schon abgeschlossen");
        const b = await tx.eine<Beschaeftigter>("select * from app.beschaeftigter where id = $1", [d.beschaeftigter_id]);
        if (!b) throw new NotFoundException("Beschäftigte Person nicht gefunden");
        const norm = (s: string) => s.toLocaleLowerCase("de-DE").replace(/\s+/g, " ").trim();
        if (norm(d.name) !== norm(`${b.vorname} ${b.nachname}`)) throw new UnprocessableEntityException({ meldung: "Der Name passt nicht zur Person", fehler: [{ feld: "name", meldung: "Bitte den eigenen vollständigen Namen eingeben" }] });
        const vorhanden = await tx.eine("select 1 from app.unterweisung_teilnahme where unterweisung_id = $1 and beschaeftigter_id = $2", [id, d.beschaeftigter_id]);
        if (vorhanden) throw new ConflictException("Schon bestätigt");
        return tx.eine(
          `insert into app.unterweisung_teilnahme (unternehmen_id, unterweisung_id, beschaeftigter_id, name_bestaetigt, inhalt_sha256, erfasst_von)
           values ($1, $2, $3, $4, $5, $6) returning beschaeftigter_id, bestaetigt_am, name_bestaetigt`,
          [k.unternehmenId, id, d.beschaeftigter_id, d.name, u.inhalt_sha256, k.kontoId],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  /**
   * Abschließen: Protokoll als PDF ablegen, Ereignis „Unterweisung durchgeführt“ (→ Wiedervorlage in einem Jahr),
   * offene Unterweisungspflichten mit dem Protokoll als Nachweis erledigen.
   */
  @MitUnternehmen(...SCHREIBEN)
  @Post("unterweisungen/:id/abschliessen")
  async abschliessen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const u = await tx.eine<{ thema: string; inhalt: string; datum: string; durchgefuehrt_von: string; inhalt_sha256: Buffer; abgeschlossen_am: string | null; art: string }>(
          "select * from app.unterweisung where id = $1 for update",
          [id],
        );
        if (!u) throw new NotFoundException("Unterweisung nicht gefunden");
        if (u.abgeschlossen_am) throw new ConflictException("Schon abgeschlossen");
        const teilnahmen = await tx.abfrage<{ vorname: string; nachname: string; bestaetigt_am: Date; name_bestaetigt: string; eintritt: string }>(
          `select b.vorname, b.nachname, b.eintritt, t.bestaetigt_am, t.name_bestaetigt from app.unterweisung_teilnahme t join app.beschaeftigter b on b.id = t.beschaeftigter_id
            where t.unterweisung_id = $1 order by b.nachname`,
          [id],
        );
        if (!teilnahmen.length) throw new UnprocessableEntityException({ meldung: "Noch niemand hat die Unterweisung bestätigt", fehler: [{ feld: "teilnahmen", meldung: "mindestens eine Bestätigung" }] });
        const unternehmen = (await tx.eine<{ name: string }>("select name from app.unternehmen where id = $1", [k.unternehmenId]))!.name;
        const pdf = await unterweisungsprotokollPdf({
          unternehmen, thema: u.thema, inhalt: u.inhalt, datum: u.datum, durchgefuehrt_von: u.durchgefuehrt_von, inhalt_sha256: u.inhalt_sha256.toString("hex"),
          teilnahmen: teilnahmen.map((x) => ({ name: `${x.vorname} ${x.nachname}`, bestaetigt_am: new Date(x.bestaetigt_am).toISOString(), name_bestaetigt: x.name_bestaetigt })),
        });
        const dok = await dokumentAblegen(tx, this.ablage, { unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `${u.art === "arbeitsschutz" ? "Unterweisung" : "Schulung"} ${u.thema} ${u.datum}`, art: "nachweis", quelle: "generiert", mime: "application/pdf", inhalt: pdf, endung: "pdf" });
        await tx.abfrage("update app.unterweisung set abgeschlossen_am = now(), dokument_id = $2 where id = $1", [id, dok.id]);
        let erledigt: { id: string }[] = [];
        if (u.art === "arbeitsschutz") {
          await this.ereignis(tx, k, "unterweisung_durchgefuehrt", u.datum, { thema: u.thema, unterweisung_id: id });
          // Offene Pflichten erledigen: Wiederholungen bis einschließlich Datum + 1 Jahr und Erstunterweisungen der Teilnehmenden
          const perioden = teilnahmen.map((x) => `aenderung-${x.eintritt.replaceAll("-", "")}`);
          erledigt = await tx.abfrage<{ id: string }>(
            `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $2, erledigt_mit_version_id = pflicht_version_id, aktualisiert_am = now()
              where unternehmen_id = $1 and status = 'offen'
                and ((pflicht_id = 'arbeitsschutz.unterweisung_wiederholen' and (faellig_am is null or faellig_am <= ($3::date + interval '1 year')))
                  or (pflicht_id = 'arbeitsschutz.erstunterweisung' and periode = any($4)))
              returning id`,
            [k.unternehmenId, k.kontoId, u.datum, perioden],
          );
        } else if (u.art === "ki_kompetenz") {
          // KI-Kompetenz (Art. 4 KI-VO): die Schulung ist der Nachweis (E-095)
          erledigt = await tx.abfrage<{ id: string }>(
            `update app.pflicht_instanz set status = 'erledigt', erledigt_am = now(), erledigt_von = $2, erledigt_mit_version_id = pflicht_version_id, aktualisiert_am = now()
              where unternehmen_id = $1 and status = 'offen' and ergebnis = 'gilt' and pflicht_id = 'ki.kompetenz' returning id`,
            [k.unternehmenId, k.kontoId],
          );
        }
        for (const { id: instanz } of erledigt)
          await tx.abfrage("insert into app.nachweis (unternehmen_id, pflicht_instanz_id, art, dokument_id, notiz, erstellt_von) values ($1, $2, 'generiertes_dokument', $3, $4, $5)", [
            k.unternehmenId, instanz, dok.id, `Unterweisung „${u.thema}“ vom ${u.datum}`, k.kontoId,
          ]);
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `unterweisung:${id}` });
        return { id, dokument_id: dok.id, erledigte_pflichten: erledigt.length };
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Delete("unterweisungen/:id")
  @HttpCode(204)
  async unterweisungLoeschen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    await this.db
      .imKontext(this.kontext(k), async (tx) => {
        const r = await tx.abfrage("delete from app.unterweisung where id = $1 returning id", [id]);
        if (!r.length) throw new NotFoundException("Unterweisung nicht gefunden");
      })
      .catch((e) => {
        if (/unterweisung_unveraenderlich/.test(String((e as Error).message))) throw new ConflictException("Bestätigte oder abgeschlossene Unterweisungen werden nicht gelöscht");
        return uebersetzeDbFehler(e);
      });
  }

  // ------------------------------------------------------------ Zeiterfassung

  /** Kommen: offenen Stempel anlegen (höchstens einer je Person). */
  @MitUnternehmen()
  @Post("zeiten/kommen")
  async kommen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { beschaeftigter_id } = pruefe(z.object({ beschaeftigter_id: Uuid }).strict(), body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, quelle, erfasst_von) values ($1, $2, now(), 'stempel', $3) returning *", [k.unternehmenId, beschaeftigter_id, k.kontoId]),
      )
      .catch((e) => {
        if (/zeiteintrag_offen/.test(String((e as Error).message))) throw new ConflictException("Es läuft schon eine Zeiterfassung für diese Person");
        return uebersetzeDbFehler(e);
      });
  }

  @MitUnternehmen()
  @Post("zeiten/gehen")
  async gehen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const { beschaeftigter_id, pause_minuten } = pruefe(z.object({ beschaeftigter_id: Uuid, pause_minuten: z.number().int().min(0).max(1440).default(0) }).strict(), body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine("update app.zeiteintrag set ende = now(), pause_minuten = $2 where beschaeftigter_id = $1 and ende is null and not storniert returning *", [beschaeftigter_id, pause_minuten]),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Keine laufende Zeiterfassung");
    return r;
  }

  /** Nachtrag (mit Grund): vergessene Zeiten. Wird als Nachtrag gekennzeichnet. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("zeiten")
  async nachtrag(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(ZeitNachtrag, body);
    return this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          "insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, ende, pause_minuten, quelle, grund, erfasst_von) values ($1, $2, $3, $4, $5, 'nachtrag', $6, $7) returning *",
          [k.unternehmenId, d.beschaeftigter_id, d.beginn, d.ende, d.pause_minuten, d.grund, k.kontoId],
        ),
      )
      .catch(uebersetzeDbFehler);
  }

  /** Korrektur: neuer Eintrag, der den alten ersetzt (oder storniert). Der alte bleibt sichtbar im Verlauf. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("zeiten/:id/korrigieren")
  async korrigieren(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(ZeitKorrektur, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const alt = await tx.eine<{ beschaeftigter_id: string; beginn: Date; ende: Date | null; pause_minuten: number }>("select * from app.zeiteintrag_gueltig where id = $1", [id]);
        if (!alt) throw new NotFoundException("Kein gültiger Zeiteintrag mit dieser ID");
        if (!alt.ende && !d.storniert) throw new ConflictException("Laufende Zeiterfassung erst beenden");
        return tx.eine(
          `insert into app.zeiteintrag (unternehmen_id, beschaeftigter_id, beginn, ende, pause_minuten, quelle, ersetzt_id, grund, storniert, erfasst_von)
           values ($1, $2, $3, $4, $5, 'korrektur', $6, $7, $8, $9) returning *`,
          [k.unternehmenId, alt.beschaeftigter_id, d.beginn ?? alt.beginn, d.ende ?? alt.ende ?? new Date(), d.pause_minuten ?? alt.pause_minuten, id, d.grund, d.storniert ?? false, k.kontoId],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  /** Zeiten eines Monats (gültige Einträge) mit Summen je Person. */
  @MitUnternehmen()
  @Get("zeiten")
  async zeiten(@Kontext() k: Anfragekontext, @Query("monat") monat = "") {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) throw new BadRequestException("monat im Format JJJJ-MM");
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const eintraege = await tx.abfrage<{ id: string; beschaeftigter_id: string; beginn: Date; ende: Date | null; pause_minuten: number; quelle: string; grund: string | null }>(
        `select z.id, z.beschaeftigter_id, z.beginn, z.ende, z.pause_minuten, z.quelle, z.grund
           from app.zeiteintrag_gueltig z
          where z.unternehmen_id = $1 and (z.beginn at time zone 'Europe/Berlin') >= $2::date and (z.beginn at time zone 'Europe/Berlin') < ($2::date + interval '1 month')
          order by z.beginn`,
        [k.unternehmenId, `${monat}-01`],
      );
      const minuten = (e: (typeof eintraege)[number]) => (e.ende ? Math.max(0, Math.round((e.ende.getTime() - e.beginn.getTime()) / 60000) - e.pause_minuten) : 0);
      const summen: Record<string, number> = {};
      for (const e of eintraege) summen[e.beschaeftigter_id] = (summen[e.beschaeftigter_id] ?? 0) + minuten(e);
      const laufend = await tx.abfrage<{ beschaeftigter_id: string; beginn: Date }>("select beschaeftigter_id, beginn from app.zeiteintrag where unternehmen_id = $1 and ende is null and not storniert", [k.unternehmenId]);
      return { monat, eintraege: eintraege.map((e) => ({ ...e, minuten: minuten(e) })), summen_minuten: summen, laufend };
    });
  }

  /** Export eines Monats als CSV (für Lohnabrechnung und Prüfung). */
  @MitUnternehmen(...SCHREIBEN)
  @Get("zeiten/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="arbeitszeiten.csv"')
  async zeitenExport(@Kontext() k: Anfragekontext, @Query("monat") monat = "") {
    const d = await this.zeiten(k, monat);
    const namen = new Map((await this.liste(k)).map((b) => [b.id as string, `${b.nachname as string}, ${b.vorname as string}`]));
    const zeit = (x: Date | null) => (x ? new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Berlin" }).format(x) : "");
    const feld = (x: unknown) => `"${String(x ?? "").replaceAll('"', '""')}"`;
    return "﻿" + ["Name;Beginn;Ende;Pause (Min.);Arbeitszeit (Min.);Art;Grund", ...d.eintraege.map((e) => [namen.get(e.beschaeftigter_id), zeit(e.beginn), zeit(e.ende), e.pause_minuten, e.minuten, e.quelle, e.grund].map(feld).join(";"))].join("\r\n") + "\r\n";
  }
}
