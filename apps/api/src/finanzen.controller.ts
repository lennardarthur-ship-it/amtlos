import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import type PgBoss from "pg-boss";
import { z } from "zod";
import {
  Datenbank,
  dokumentAblegen,
  eRechnungLesen,
  fehlendFuerERechnung,
  heute,
  neuberechnungEinreihen,
  rechnungPdf,
  summen,
  umsatzLaufendesJahr,
  xrechnungXml,
  zugferdPdf,
  type Ablage,
  type ElsterGateway,
  type Position,
  type RechnungsDaten,
  type Tx,
} from "@amtlos/server";
import { KU_HINWEIS, umsaetzeNachSatz, ustZeitraum } from "@amtlos/fachlogik";
import { Kontext, MitUnternehmen, type Anfragekontext } from "./auth.js";
import { ELSTER } from "./elster.controller.js";
import { pruefe, uebersetzeDbFehler } from "./hilfen.js";
import { WARTESCHLANGE } from "./kern.controller.js";

export const ABLAGE = Symbol("ABLAGE");

/** Text auf Rechnungen von Kleinunternehmern. Wortlaut steht nicht in der Spezifikation – PRUEFLISTE T-06. */
export { KU_HINWEIS };

const SCHREIBEN = ["inhaber", "admin", "steuerberater"] as const;
const Uuid = z.string().uuid();
const DATUM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const TEXT = (max = 200) => z.string().trim().min(1).max(max);
const OPT = (max = 200) => z.string().trim().max(max).optional().nullable().transform((x) => x || null);

const StellerSchema = z
  .object({
    name: TEXT(), strasse: TEXT(), plz: TEXT(10), ort: TEXT(), land: z.string().regex(/^[A-Z]{2}$/).default("DE"),
    email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben"), telefon: OPT(40),
    steuernummer: OPT(40), ust_idnr: OPT(20), iban: OPT(40).refine((x) => !x || /^[A-Z]{2}\d{2}[A-Z0-9 ]{10,32}$/.test(x), "IBAN hat nicht die richtige Form"), bic: OPT(11),
  })
  .strict();

const KundeSchema = z
  .object({
    name: TEXT(), strasse: OPT(), plz: OPT(10), ort: OPT(), land: z.string().regex(/^[A-Z]{2}$/).default("DE"),
    email: z.string().trim().email().optional().nullable().or(z.literal("")).transform((x) => x || null),
    ust_idnr: OPT(20), kaeufer_referenz: OPT(100), geschaeftskunde: z.boolean().default(true),
  })
  .strict();

const PositionEingabe = z
  .object({
    bezeichnung: TEXT(300),
    menge: z.number().positive().max(1e7).refine((x) => Math.round(x * 1000) === x * 1000, "höchstens drei Nachkommastellen"),
    einheit: z.enum(["stueck", "stunde", "tag", "monat", "pauschal", "kilogramm"]),
    preis_cent: z.number().int().min(0).max(1e11),
    ust_art: z.enum(["regel", "ermaessigt"]).nullable().default("regel"),
  })
  .strict();

const RechnungEingabe = z
  .object({
    kunde_id: Uuid.nullable().optional(),
    leistungsdatum: DATUM.nullable().optional(),
    faellig_am: DATUM.nullable().optional(),
    positionen: z.array(PositionEingabe).max(200).default([]),
    hinweis: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

const BelegEingabe = z
  .object({
    belegdatum: DATUM.nullable().optional(),
    lieferant: OPT(),
    belegnummer: OPT(100),
    brutto_cent: z.number().int().min(-1e11).max(1e11).nullable().optional(),
    ust_cent: z.number().int().min(-1e11).max(1e11).nullable().optional(),
    kategorie: OPT(60),
    notiz: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();

const KasseEingabe = z
  .object({
    bezeichnung: TEXT(), art: OPT(), hersteller: OPT(), modell: OPT(), seriennummer: OPT(100), tse_seriennummer: OPT(100),
    betriebsstaette: OPT(), angeschafft_am: DATUM,
  })
  .strict();

/** Minimaler Typ für hochgeladene Dateien (multer). */
interface Datei {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
const ERLAUBTE_TYPEN: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "application/xml": "xml", "text/xml": "xml" };

interface RechnungZeile {
  id: string; nummer: string | null; status: string; art: string; storniert_rechnung_id: string | null; rechnungsdatum: string | null; leistungsdatum: string | null;
  faellig_am: string | null; kunde_id: string | null; kunde: Record<string, unknown> | null; steller: Record<string, unknown> | null;
  positionen: (Omit<Position, "ust_satz"> & { ust_art: "regel" | "ermaessigt" | null; ust_satz?: number | null })[];
  kleinunternehmer: boolean; hinweis: string | null; netto_cent: string; ust_cent: string; brutto_cent: string;
  xml_dokument_id: string | null; pdf_dokument_id: string | null; gestellt_am: string | null;
}

const zahl = (r: RechnungZeile) => ({ ...r, netto_cent: Number(r.netto_cent), ust_cent: Number(r.ust_cent), brutto_cent: Number(r.brutto_cent) });

@Controller("v1")
export class FinanzenController {
  constructor(
    @Inject(Datenbank) private readonly db: Datenbank,
    @Inject(WARTESCHLANGE) private readonly boss: PgBoss,
    @Inject(ABLAGE) private readonly ablage: Ablage,
    @Inject(ELSTER) private readonly elster: ElsterGateway,
  ) {}

  private kontext(k: Anfragekontext) {
    return { kontoId: k.kontoId, unternehmenId: k.unternehmenId };
  }

  private async kleinunternehmer(tx: Tx, unternehmenId: string): Promise<boolean> {
    const p = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [unternehmenId]);
    return p?.daten["ust.kleinunternehmer"] === true;
  }

  /** Steuersätze aus dem aktiven Release, gültig am Stichtag. Fehlen sie (nicht freigegeben), keine Rechnung mit USt. */
  private async steuersaetze(tx: Tx, stichtag: string) {
    const r = await tx.abfrage<{ id: string; version: number; wert: number }>(
      `select rv.regelwert_id as id, rv.version, rv.wert::float8 as wert
         from katalog.aktives_release a
         join katalog.release_inhalt ri on ri.release_id = a.id and ri.objekt_art = 'regelwert_version'
         join katalog.regelwert_version rv on rv.id = ri.objekt_id
        where rv.regelwert_id in ('steuern.ust.satz_regel', 'steuern.ust.satz_ermaessigt')
          and rv.gueltig_ab <= $1::date and (rv.gueltig_bis is null or rv.gueltig_bis >= $1::date)`,
      [stichtag],
    );
    const nach = new Map(r.map((x) => [x.id, x]));
    return { regel: nach.get("steuern.ust.satz_regel"), ermaessigt: nach.get("steuern.ust.satz_ermaessigt") };
  }

  // ------------------------------------------------------------ Rechnungssteller

  @MitUnternehmen()
  @Get("rechnungssteller")
  async steller(@Kontext() k: Anfragekontext) {
    // Leeres Objekt statt null: null wäre ein leerer Antwortkörper (kein gültiges JSON)
    return (await this.db.imKontext(this.kontext(k), (tx) => tx.eine("select * from app.rechnungssteller where unternehmen_id = $1", [k.unternehmenId]))) ?? {};
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("rechnungssteller")
  async stellerSpeichern(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(StellerSchema, body);
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.eine(
        `insert into app.rechnungssteller (unternehmen_id, name, strasse, plz, ort, land, email, telefon, steuernummer, ust_idnr, iban, bic)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (unternehmen_id) do update set name = excluded.name, strasse = excluded.strasse, plz = excluded.plz, ort = excluded.ort,
           land = excluded.land, email = excluded.email, telefon = excluded.telefon, steuernummer = excluded.steuernummer,
           ust_idnr = excluded.ust_idnr, iban = excluded.iban, bic = excluded.bic, aktualisiert_am = now()
         returning *`,
        [k.unternehmenId, d.name, d.strasse, d.plz, d.ort, d.land, d.email, d.telefon, d.steuernummer, d.ust_idnr, d.iban?.replace(/\s/g, "") ?? null, d.bic],
      ),
    );
  }

  // ------------------------------------------------------------ Kunden

  @MitUnternehmen()
  @Get("kunden")
  async kunden(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("select * from app.kunde where unternehmen_id = $1 order by name", [k.unternehmenId]));
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("kunden")
  async kundeAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(KundeSchema, body);
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.eine(
        `insert into app.kunde (unternehmen_id, name, strasse, plz, ort, land, email, ust_idnr, kaeufer_referenz, geschaeftskunde)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning *`,
        [k.unternehmenId, d.name, d.strasse, d.plz, d.ort, d.land, d.email, d.ust_idnr, d.kaeufer_referenz, d.geschaeftskunde],
      ),
    );
  }

  // ------------------------------------------------------------ Rechnungen

  @MitUnternehmen()
  @Get("rechnungen")
  async rechnungen(@Kontext() k: Anfragekontext) {
    const zeilen = await this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage<RechnungZeile>(
        `select r.*, coalesce(r.kunde->>'name', ku.name) as kunde_name from app.rechnung r left join app.kunde ku on ku.id = r.kunde_id
          where r.unternehmen_id = $1 order by (r.status = 'entwurf') desc, r.rechnungsdatum desc nulls first, r.nummer desc`,
        [k.unternehmenId],
      ),
    );
    return zeilen.map(zahl);
  }

  @MitUnternehmen()
  @Get("rechnungen/:id")
  async rechnung(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    const r = await this.db.imKontext(this.kontext(k), (tx) => tx.eine<RechnungZeile>("select * from app.rechnung where id = $1", [id]));
    if (!r) throw new NotFoundException("Rechnung nicht gefunden");
    return zahl(r);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("rechnungen")
  async entwurf(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(RechnungEingabe, body ?? {});
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const ku = await this.kleinunternehmer(tx, k.unternehmenId!);
        const r = await tx.eine<RechnungZeile>(
          `insert into app.rechnung (unternehmen_id, kunde_id, leistungsdatum, faellig_am, positionen, hinweis, kleinunternehmer, erstellt_von)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
          [k.unternehmenId, d.kunde_id ?? null, d.leistungsdatum ?? null, d.faellig_am ?? null, JSON.stringify(ku ? d.positionen.map((p) => ({ ...p, ust_art: null })) : d.positionen), d.hinweis ?? null, ku, k.kontoId],
        );
        return zahl(r!);
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("rechnungen/:id")
  async entwurfSpeichern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(RechnungEingabe, body ?? {});
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const alt = await tx.eine<{ status: string }>("select status from app.rechnung where id = $1", [id]);
        if (!alt) throw new NotFoundException("Rechnung nicht gefunden");
        if (alt.status !== "entwurf") throw new ConflictException("Gestellte Rechnungen können nicht geändert werden – stornieren und neu stellen");
        const ku = await this.kleinunternehmer(tx, k.unternehmenId!);
        const r = await tx.eine<RechnungZeile>(
          `update app.rechnung set kunde_id = $2, leistungsdatum = $3, faellig_am = $4, positionen = $5, hinweis = $6, kleinunternehmer = $7
            where id = $1 returning *`,
          [id, d.kunde_id ?? null, d.leistungsdatum ?? null, d.faellig_am ?? null, JSON.stringify(ku ? d.positionen.map((p) => ({ ...p, ust_art: null })) : d.positionen), d.hinweis ?? null, ku],
        );
        return zahl(r!);
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Delete("rechnungen/:id")
  @HttpCode(204)
  async entwurfLoeschen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    await this.db.imKontext(this.kontext(k), async (tx) => {
      const r = await tx.abfrage("delete from app.rechnung where id = $1 and status = 'entwurf' returning id", [id]);
      if (!r.length) throw new NotFoundException("Kein Entwurf mit dieser ID");
    });
  }

  /**
   * Rechnung stellen: Nummer vergeben (fortlaufend je Jahr), Steller und Kunde einfrieren, Steuersätze aus Regelwerten,
   * PDF bzw. ZUGFeRD und XRechnung erzeugen und unveränderlich ablegen, Neuberechnung (Kleinunternehmer-Wächter).
   */
  @MitUnternehmen(...SCHREIBEN)
  @Post("rechnungen/:id/stellen")
  async stellen(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const r = await tx.eine<RechnungZeile>("select * from app.rechnung where id = $1 for update", [id]);
        if (!r) throw new NotFoundException("Rechnung nicht gefunden");
        if (r.status !== "entwurf") throw new ConflictException("Rechnung ist schon gestellt");
        const steller = await tx.eine<Record<string, string | null>>("select * from app.rechnungssteller where unternehmen_id = $1", [k.unternehmenId]);
        if (!steller) throw new UnprocessableEntityException({ meldung: "Angaben fehlen", fehlend: ["steller"] });
        const kunde = r.kunde_id ? await tx.eine<Record<string, unknown>>("select * from app.kunde where id = $1", [r.kunde_id]) : null;
        if (!kunde) throw new UnprocessableEntityException({ meldung: "Angaben fehlen", fehlend: ["kunde"] });
        const ku = await this.kleinunternehmer(tx, k.unternehmenId!);
        const datum = heute();
        const saetze = await this.steuersaetze(tx, r.leistungsdatum ?? datum);
        const genutzt = new Map<string, { id: string; version: number }>();
        const positionen: Position[] = r.positionen.map((p) => {
          if (ku || p.ust_art === null) return { bezeichnung: p.bezeichnung, menge: p.menge, einheit: p.einheit, preis_cent: p.preis_cent, ust_satz: null };
          const s = saetze[p.ust_art];
          if (!s) throw new UnprocessableEntityException({ meldung: "Der Steuersatz ist noch nicht fachlich freigegeben", fehlend: [`steuersatz.${p.ust_art}`] });
          genutzt.set(s.id, { id: s.id, version: s.version });
          return { bezeichnung: p.bezeichnung, menge: p.menge, einheit: p.einheit, preis_cent: p.preis_cent, ust_satz: s.wert };
        });
        const daten: RechnungsDaten = {
          nummer: "VORLAEUFIG", rechnungsdatum: datum, leistungsdatum: r.leistungsdatum, faellig_am: r.faellig_am,
          steller: steller as unknown as RechnungsDaten["steller"],
          kunde: { ...(kunde as unknown as RechnungsDaten["kunde"]) },
          positionen, kleinunternehmer: ku, hinweis: r.hinweis,
        };
        const fehlend = fehlendFuerERechnung(daten).filter((f) => kunde.geschaeftskunde || !["steller.telefon", "steller.iban", "kunde.email"].includes(f));
        if (fehlend.length) throw new UnprocessableEntityException({ meldung: "Angaben fehlen", fehlend });

        // Fortlaufende Nummer je Jahr (Zeilensperre: keine Lücken, keine Doppelten)
        const jahr = Number(datum.slice(0, 4));
        const n = await tx.eine<{ letzte: number }>(
          `insert into app.rechnungsnummer (unternehmen_id, jahr, letzte) values ($1, $2, 1)
           on conflict (unternehmen_id, jahr) do update set letzte = app.rechnungsnummer.letzte + 1 returning letzte`,
          [k.unternehmenId, jahr],
        );
        daten.nummer = `${jahr}-${String(n!.letzte).padStart(4, "0")}`;
        return this.erzeugenUndStellen(tx, k, r.id, daten, kunde.geschaeftskunde === true, [...genutzt.values()]);
      })
      .catch(uebersetzeDbFehler);
  }

  private async erzeugenUndStellen(tx: Tx, k: Anfragekontext, id: string, daten: RechnungsDaten, eRechnung: boolean, regelwerte: { id: string; version: number }[]) {
    const s = summen(daten.positionen, daten.kleinunternehmer);
    const pdfEinfach = await rechnungPdf(daten, KU_HINWEIS);
    const pdf = eRechnung ? await zugferdPdf(daten, KU_HINWEIS, pdfEinfach) : pdfEinfach;
    const titel = `${daten.art === "storno" ? "Stornorechnung" : "Rechnung"} ${daten.nummer}`;
    const pdfDok = await dokumentAblegen(tx, this.ablage, { unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel, art: "rechnung", quelle: "generiert", mime: "application/pdf", inhalt: pdf, endung: "pdf" });
    const xmlDok = eRechnung
      ? await dokumentAblegen(tx, this.ablage, { unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: `${titel} (XRechnung)`, art: "e_rechnung", quelle: "generiert", mime: "application/xml", inhalt: Buffer.from(await xrechnungXml(daten, KU_HINWEIS)), endung: "xml" })
      : null;
    const r = await tx.eine<RechnungZeile>(
      `update app.rechnung set status = 'gestellt', nummer = $2, rechnungsdatum = $3, steller = $4, kunde = $5, positionen = $6, kleinunternehmer = $7,
              netto_cent = $8, ust_cent = $9, brutto_cent = $10, regelwerte = $11, pdf_dokument_id = $12, xml_dokument_id = $13, gestellt_am = now()
        where id = $1 returning *`,
      [id, daten.nummer, daten.rechnungsdatum, daten.steller, daten.kunde, JSON.stringify(daten.positionen), daten.kleinunternehmer,
       s.netto_cent, s.ust_cent, s.brutto_cent, JSON.stringify(regelwerte), pdfDok.id, xmlDok?.id ?? null],
    );
    await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `rechnung:${daten.nummer}` });
    return zahl(r!);
  }

  /** Storno: neue Rechnung (Typ Rechnungskorrektur) mit Bezug, das Original wird als storniert markiert. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("rechnungen/:id/stornieren")
  async stornieren(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const o = await tx.eine<RechnungZeile>("select * from app.rechnung where id = $1 for update", [id]);
        if (!o) throw new NotFoundException("Rechnung nicht gefunden");
        if (o.status !== "gestellt" || o.art !== "rechnung") throw new ConflictException("Nur gestellte Rechnungen können storniert werden");
        const datum = heute();
        const jahr = Number(datum.slice(0, 4));
        const n = await tx.eine<{ letzte: number }>(
          `insert into app.rechnungsnummer (unternehmen_id, jahr, letzte) values ($1, $2, 1)
           on conflict (unternehmen_id, jahr) do update set letzte = app.rechnungsnummer.letzte + 1 returning letzte`,
          [k.unternehmenId, jahr],
        );
        const neu = await tx.eine<{ id: string }>(
          `insert into app.rechnung (unternehmen_id, art, storniert_rechnung_id, kunde_id, leistungsdatum, positionen, kleinunternehmer, erstellt_von)
           values ($1, 'storno', $2, $3, $4, $5, $6, $7) returning id`,
          [k.unternehmenId, o.id, o.kunde_id, o.leistungsdatum, JSON.stringify(o.positionen), o.kleinunternehmer, k.kontoId],
        );
        const daten: RechnungsDaten = {
          nummer: `${jahr}-${String(n!.letzte).padStart(4, "0")}`, rechnungsdatum: datum, leistungsdatum: o.leistungsdatum, faellig_am: null,
          steller: o.steller as unknown as RechnungsDaten["steller"], kunde: o.kunde as unknown as RechnungsDaten["kunde"],
          positionen: o.positionen as unknown as Position[], kleinunternehmer: o.kleinunternehmer, art: "storno", storniert_nummer: o.nummer,
        };
        const storno = await this.erzeugenUndStellen(tx, k, neu!.id, daten, (o.kunde as { geschaeftskunde?: boolean } | null)?.geschaeftskunde === true, []);
        await tx.abfrage("update app.rechnung set status = 'storniert' where id = $1", [o.id]);
        return storno;
      })
      .catch(uebersetzeDbFehler);
  }

  // ------------------------------------------------------------ Dokumente

  @MitUnternehmen()
  @Get("dokumente/:id/datei")
  async datei(@Kontext() k: Anfragekontext, @Param("id") id: string, @Res() res: Response) {
    pruefe(Uuid, id);
    const d = await this.db.imKontext(this.kontext(k), (tx) => tx.eine<{ titel: string; mime: string; objekt_key: string; sha256: Buffer }>("select titel, mime, objekt_key, sha256 from app.dokument where id = $1", [id]));
    if (!d) throw new NotFoundException("Dokument nicht gefunden");
    const inhalt = await this.ablage.lesen(d.objekt_key);
    const endung = d.objekt_key.split(".").pop();
    res.setHeader("Content-Type", d.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${d.titel.replace(/[^\w.\- ]+/g, "_")}.${endung}"`);
    res.setHeader("X-Content-SHA256", d.sha256.toString("hex"));
    res.setHeader("Cache-Control", "private, no-store");
    res.send(inhalt);
  }

  // ------------------------------------------------------------ Belege

  @MitUnternehmen()
  @Get("belege")
  async belege(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) =>
      tx.abfrage(
        `select b.*, b.brutto_cent::float8 as brutto_cent, b.ust_cent::float8 as ust_cent, d.titel as datei_titel, d.mime
           from app.beleg b join app.dokument d on d.id = b.dokument_id
          where b.unternehmen_id = $1 order by b.belegdatum desc nulls first, b.erfasst_am desc`,
        [k.unternehmenId],
      ),
    );
  }

  /** Beleg hochladen (PDF, Foto oder E-Rechnung als XML). E-Rechnungen werden gelesen und vorbefüllt. */
  @MitUnternehmen(...SCHREIBEN)
  @Post("belege")
  @UseInterceptors(FileInterceptor("datei", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  async belegHochladen(@Kontext() k: Anfragekontext, @UploadedFile() datei: Datei | undefined) {
    if (!datei) throw new BadRequestException("Datei fehlt (Feld „datei“)");
    const endung = ERLAUBTE_TYPEN[datei.mimetype] ?? (datei.originalname.toLowerCase().endsWith(".xml") ? "xml" : undefined);
    if (!endung) throw new UnprocessableEntityException({ meldung: "Nur PDF, JPG, PNG oder E-Rechnung (XML)", fehler: [{ feld: "datei", meldung: "Dateityp nicht erlaubt" }] });
    // Inhalt prüfen statt dem angegebenen Typ zu glauben
    const kopf = datei.buffer.subarray(0, 8);
    const passt =
      (endung === "pdf" && kopf.subarray(0, 5).toString() === "%PDF-") ||
      (endung === "png" && kopf.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (endung === "jpg" && kopf[0] === 0xff && kopf[1] === 0xd8) ||
      (endung === "xml" && /^\s*(<\?xml|<)/.test(datei.buffer.subarray(0, 100).toString("utf8")));
    if (!passt) throw new UnprocessableEntityException({ meldung: "Dateiinhalt passt nicht zum Dateityp", fehler: [{ feld: "datei", meldung: "Inhalt passt nicht zum Typ" }] });

    let gelesen = null;
    if (endung === "xml") {
      try {
        gelesen = eRechnungLesen(datei.buffer.toString("utf8"));
      } catch (e) {
        throw new UnprocessableEntityException({ meldung: "Keine lesbare E-Rechnung", fehler: [{ feld: "datei", meldung: (e as Error).message }] });
      }
    }
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const dok = await dokumentAblegen(tx, this.ablage, {
          unternehmenId: k.unternehmenId!, kontoId: k.kontoId, titel: datei.originalname.slice(0, 200) || "Beleg", art: "beleg", quelle: "upload",
          mime: endung === "xml" ? "application/xml" : datei.mimetype, inhalt: datei.buffer, endung,
        });
        const doppelt = await tx.eine<{ id: string }>("select id from app.beleg where dokument_id = $1", [dok.id]);
        if (doppelt) throw new ConflictException("Dieser Beleg ist schon erfasst");
        return tx.eine(
          `insert into app.beleg (unternehmen_id, dokument_id, belegdatum, lieferant, belegnummer, brutto_cent, ust_cent, quelle, e_rechnung, erfasst_von)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           returning *, brutto_cent::float8 as brutto_cent, ust_cent::float8 as ust_cent`,
          [k.unternehmenId, dok.id, gelesen?.datum ?? null, gelesen?.verkaeufer ?? null, gelesen?.nummer ?? null, gelesen?.brutto_cent ?? null, gelesen?.ust_cent ?? null,
           gelesen ? "e_rechnung" : endung === "pdf" ? "upload" : "foto", gelesen ? JSON.stringify(gelesen) : null, k.kontoId],
        );
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Put("belege/:id")
  async belegSpeichern(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const d = pruefe(BelegEingabe, body);
    const r = await this.db
      .imKontext(this.kontext(k), (tx) =>
        tx.eine(
          `update app.beleg set belegdatum = $2, lieferant = $3, belegnummer = $4, brutto_cent = $5, ust_cent = $6, kategorie = $7, notiz = $8
            where id = $1 and not storniert returning *, brutto_cent::float8 as brutto_cent, ust_cent::float8 as ust_cent`,
          [id, d.belegdatum ?? null, d.lieferant, d.belegnummer, d.brutto_cent ?? null, d.ust_cent ?? null, d.kategorie, d.notiz ?? null],
        ),
      )
      .catch(uebersetzeDbFehler);
    if (!r) throw new NotFoundException("Beleg nicht gefunden");
    return r;
  }

  /** Belege werden nicht gelöscht, sondern als storniert markiert (die Datei bleibt aufbewahrt). */
  @MitUnternehmen(...SCHREIBEN)
  @Post("belege/:id/stornieren")
  async belegStornieren(@Kontext() k: Anfragekontext, @Param("id") id: string) {
    pruefe(Uuid, id);
    const r = await this.db.imKontext(this.kontext(k), (tx) => tx.eine("update app.beleg set storniert = true where id = $1 and not storniert returning id", [id]));
    if (!r) throw new NotFoundException("Beleg nicht gefunden");
    return { id, storniert: true };
  }

  // ------------------------------------------------------------ Auswertungen

  /** Übersicht: Umsatz des Jahres aus Rechnungen, Kleinunternehmergrenze, offene Entwürfe. */
  @MitUnternehmen()
  @Get("finanzen/uebersicht")
  async uebersicht(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const datum = heute();
      const jahr = Number(datum.slice(0, 4));
      const umsatz = await umsatzLaufendesJahr(tx, k.unternehmenId!, jahr);
      const ku = await this.kleinunternehmer(tx, k.unternehmenId!);
      const profil = await tx.eine<{ daten: Record<string, unknown> }>("select daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
      const gruendungsjahr = typeof profil?.daten.gruendungsdatum === "string" && profil.daten.gruendungsdatum.startsWith(String(jahr));
      const grenze = ku
        ? await tx.eine<{ id: string; wert: number; pruef_status: string }>(
            `select rv.regelwert_id as id, rv.wert::float8 as wert, rv.pruef_status
               from katalog.aktives_release a join katalog.release_inhalt ri on ri.release_id = a.id and ri.objekt_art = 'regelwert_version'
               join katalog.regelwert_version rv on rv.id = ri.objekt_id
              where rv.regelwert_id = $1 and rv.gueltig_ab <= $2::date and (rv.gueltig_bis is null or rv.gueltig_bis >= $2::date)`,
            [gruendungsjahr ? "steuern.ustg19.grenze_gruendungsjahr" : "steuern.ustg19.grenze_laufendes_jahr", datum],
          )
        : null;
      const zaehler = await tx.eine<{ entwuerfe: number; belege: number }>(
        "select (select count(*)::int from app.rechnung where unternehmen_id = $1 and status = 'entwurf') as entwuerfe, (select count(*)::int from app.beleg where unternehmen_id = $1 and not storniert) as belege",
        [k.unternehmenId],
      );
      return {
        jahr,
        umsatz_eur: umsatz ?? 0,
        kleinunternehmer: ku,
        grenze: grenze ? { id: grenze.id, wert_eur: grenze.wert, anteil: umsatz === null ? 0 : umsatz / grenze.wert, ungeprueft: grenze.pruef_status !== "freigegeben" } : null,
        ...zaehler,
      };
    });
  }

  /**
   * Vorbereitung der Umsatzsteuer-Voranmeldung für eine Periode (Monat oder Quartal): Umsätze und Umsatzsteuer
   * aus den gestellten Rechnungen (nach Rechnungsdatum), Vorsteuer aus den Belegen (nach Belegdatum).
   * Keine Kennzahlen des amtlichen Formulars (stehen nicht in der Spezifikation, T-08).
   */
  @MitUnternehmen()
  @Get("finanzen/ust-voranmeldung")
  async ustVoranmeldung(@Kontext() k: Anfragekontext, @Query("periode") periode = "") {
    const zeitraum = ustZeitraum(periode);
    if (!zeitraum) throw new BadRequestException("periode im Format JJJJ-MM oder JJJJ-Qn");
    const { von, bis } = zeitraum;
    return this.db.imKontext(this.kontext(k), async (tx) => {
      const rechnungen = await tx.abfrage<{ art: string; kleinunternehmer: boolean; positionen: Position[] }>(
        "select art, kleinunternehmer, positionen from app.rechnung where unternehmen_id = $1 and status <> 'entwurf' and rechnungsdatum between $2 and $3",
        [k.unternehmenId, von, bis],
      );
      const vorsteuer = await tx.eine<{ summe: string | null; anzahl: number; ohne_angabe: number }>(
        `select sum(ust_cent)::text as summe, count(*)::int as anzahl, count(*) filter (where ust_cent is null)::int as ohne_angabe
           from app.beleg where unternehmen_id = $1 and not storniert and belegdatum between $2 and $3`,
        [k.unternehmenId, von, bis],
      );
      const umsaetze = umsaetzeNachSatz(rechnungen);
      const ust = umsaetze.reduce((a, g) => a + g.ust_cent, 0);
      const vst = Number(vorsteuer?.summe ?? 0);
      return {
        periode, von, bis,
        umsaetze, umsatzsteuer_cent: ust, vorsteuer_cent: vst, zahllast_cent: ust - vst,
        rechnungen: rechnungen.length, belege: vorsteuer?.anzahl ?? 0, belege_ohne_steuerangabe: vorsteuer?.ohne_angabe ?? 0,
        uebermittlung: this.elster.status(),
      };
    });
  }

  // ------------------------------------------------------------ Kassen

  @MitUnternehmen()
  @Get("kassen")
  async kassen(@Kontext() k: Anfragekontext) {
    return this.db.imKontext(this.kontext(k), (tx) => tx.abfrage("select * from app.kasse where unternehmen_id = $1 order by angeschafft_am desc", [k.unternehmenId]));
  }

  /**
   * Profilangaben zu Kassen nachziehen (neue Profilversion, nie überschreiben): Wer in Amtlos eine elektronische Kasse
   * erfasst, nutzt eine; die Anzahl entspricht den aktiven Kassen. So greifen TSE- und Meldepflichten ohne Rückfrage.
   */
  private async kassenProfil(tx: Tx, k: Anfragekontext) {
    const p = await tx.eine<{ version: number; daten: Record<string, unknown> }>("select version, daten from app.profil_version where unternehmen_id = $1 order by version desc limit 1", [k.unternehmenId]);
    const anzahl = (await tx.eine<{ n: number }>("select count(*)::int as n from app.kasse where unternehmen_id = $1 and ausser_betrieb_am is null", [k.unternehmenId]))!.n;
    const daten = { ...(p?.daten ?? {}), "kasse.elektronisch": anzahl > 0 ? true : (p?.daten["kasse.elektronisch"] ?? null), "kasse.anzahl": anzahl };
    if (p && p.daten["kasse.elektronisch"] === daten["kasse.elektronisch"] && p.daten["kasse.anzahl"] === anzahl) return;
    await tx.abfrage("insert into app.profil_version (unternehmen_id, version, daten, erstellt_von) values ($1, $2, $3, $4)", [k.unternehmenId, (p?.version ?? 0) + 1, daten, k.kontoId]);
  }

  /** Elektronische Kasse erfassen. Meldet das Ereignis „Kasse angeschafft“ – daraus berechnet Amtlos die Meldefrist (C.33). */
  @MitUnternehmen(...SCHREIBEN)
  @Post("kassen")
  async kasseAnlegen(@Kontext() k: Anfragekontext, @Body() body: unknown) {
    const d = pruefe(KasseEingabe, body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const kasse = await tx.eine<{ id: string }>(
          `insert into app.kasse (unternehmen_id, bezeichnung, art, hersteller, modell, seriennummer, tse_seriennummer, betriebsstaette, angeschafft_am)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
          [k.unternehmenId, d.bezeichnung, d.art, d.hersteller, d.modell, d.seriennummer, d.tse_seriennummer, d.betriebsstaette, d.angeschafft_am],
        );
        await tx.abfrage(
          "insert into app.ereignis (unternehmen_id, typ, eingetreten_am, payload, quelle, erfasst_von) values ($1, 'kasse_angeschafft', $2, $3, 'nutzer', $4)",
          [k.unternehmenId, d.angeschafft_am, { kasse_id: kasse!.id }, k.kontoId],
        );
        await this.kassenProfil(tx, k);
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `kasse:${kasse!.id}` });
        return kasse;
      })
      .catch(uebersetzeDbFehler);
  }

  @MitUnternehmen(...SCHREIBEN)
  @Post("kassen/:id/ausser-betrieb")
  async kasseAusserBetrieb(@Kontext() k: Anfragekontext, @Param("id") id: string, @Body() body: unknown) {
    pruefe(Uuid, id);
    const { datum } = pruefe(z.object({ datum: DATUM }).strict(), body);
    return this.db
      .imKontext(this.kontext(k), async (tx) => {
        const kasse = await tx.eine("update app.kasse set ausser_betrieb_am = $2 where id = $1 and ausser_betrieb_am is null returning *", [id, datum]);
        if (!kasse) throw new NotFoundException("Keine aktive Kasse mit dieser ID");
        await tx.abfrage(
          "insert into app.ereignis (unternehmen_id, typ, eingetreten_am, payload, quelle, erfasst_von) values ($1, 'kasse_ausser_betrieb', $2, $3, 'nutzer', $4)",
          [k.unternehmenId, datum, { kasse_id: id }, k.kontoId],
        );
        await this.kassenProfil(tx, k);
        await neuberechnungEinreihen(this.boss, tx, { unternehmenId: k.unternehmenId!, ausgeloestDurch: `kasse-ausser-betrieb:${id}` });
        return kasse;
      })
      .catch(uebersetzeDbFehler);
  }
}
