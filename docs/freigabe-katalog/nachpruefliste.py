"""
Nachprüfliste je Rolle (E-196, E-197, E-198): was jede prüfende Person noch prüfen und per E-Mail bestätigen soll, als
Excel-Datei; dazu ein E-Mail-Entwurf. Kein Blatt zum Unterschreiben mehr (E-197): Eine Bestätigung per E-Mail genügt.
E-198: Kein E-Mail-Text im Repository – der Entwurf geht auf die Standardausgabe oder mit `--mail-ziel <ordner>` in einen
Ordner außerhalb des Repositorys (ein Ordner im Repository wird abgelehnt). Im Versandordner liegen nur Listen und PDFs.
E-199: Auch der Versandordner liegt außerhalb des Repositorys (ein Ziel im Repository wird abgelehnt, ziel.py).

    pnpm --filter @amtlos/fachlogik build
    python3 docs/freigabe-katalog/nachpruefliste.py ~/Versand/nachpruefung [--mail-ziel ~/Versand]

Inhalt je Rolle (recht, steuern, arbeitsschutz, hygiene):
  - Katalogeinträge, deren Freigabe ohne schriftliche Bestätigung im Register steht (`nachweis.art` ersetzt/offen) – mit
    Version und Quelle der Freigabe,
  - offene Prüfpunkte (offene-punkte.yaml) und Einschränkungen, die der Vermerk jetzt nennt,
  - Vorlagen: fehlende Bestätigung und/oder geänderte Varianten seit der Freigabe (Teilsumme je Variantengruppe freigegeben ↔ heute, E-196);
    PDFs der geänderten Varianten erzeugt apps/mobile/werkzeuge/nachpruef-pdfs.mjs in <rolle>/vorlagen/
    sowie Stellen mit „fachlich zu prüfen“,
  - die Nennung der Rolle im Vermerk (statt keines Namens bzw. des Namens).
Der E-Mail-Entwurf beginnt mit „Sehr geehrter Herr [Name],“ – den Namen setzt der Gründer beim Versand ein.
"""
import json
import os
import subprocess
import sys


HIER = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HIER, "../.."))
sys.path.insert(0, HIER)
sys.dont_write_bytecode = True
MAIL_ZIEL = None
if "--mail-ziel" in sys.argv:
    _i = sys.argv.index("--mail-ziel")
    MAIL_ZIEL = os.path.abspath(os.path.expanduser(sys.argv[_i + 1]))
    del sys.argv[_i:_i + 2]
    if os.path.commonpath([MAIL_ZIEL, ROOT]) == ROOT:
        raise SystemExit(f"--mail-ziel {MAIL_ZIEL} liegt im Repository – E-Mail-Texte gehören nicht ins Projekt (E-198)")
from ziel import ziel_ausserhalb  # noqa: E402  (E-199: Ziel außerhalb des Repositorys)
ZIEL = ziel_ausserhalb(sys.argv[1] if len(sys.argv) > 1 else None, "Aufruf: python3 docs/freigabe-katalog/nachpruefliste.py <ziel> [--mail-ziel <ordner>]")
from openpyxl import Workbook  # noqa: E402
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side  # noqa: E402
from openpyxl.worksheet.datavalidation import DataValidation  # noqa: E402
import anwenden  # noqa: E402  (Register, Regeln und Auswertung je Eintrag)

STAND = "25.10.2026"
ROLLE = {"recht": ("Rechtsanwalt", "Rechtsanwalt", "von einem Rechtsanwalt"), "steuern": ("Steuerberater", "Steuerberater", "von einem Steuerberater"),
         "arbeitsschutz": ("Fachkraft für Arbeitssicherheit", "Sifa", "von einer Fachkraft für Arbeitssicherheit"),
         "hygiene": ("Lebensmittelfachbeauftragter", "Lebensmittelhygiene", "von einem Lebensmittelfachbeauftragten")}
WORTLAUT = {
    "recht": "„Inhalt fachlich geprüft von einem Rechtsanwalt, Stand …. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.“",
    "steuern": "„Fachlich durchgesehen von einem Steuerberater (Stand …) – ohne Gewähr für den Einzelfall.“",
    "arbeitsschutz": "„Inhalt fachlich geprüft von einer Fachkraft für Arbeitssicherheit, Stand …. Die Prüfung betrifft die allgemeinen Inhalte, nicht deinen Einzelfall.“",
    "hygiene": "„Inhalt fachlich geprüft von einem Lebensmittelfachbeauftragten, die Folgen bei Verstoß von einem Rechtsanwalt, Stand ….“",
}
BISHER = {
    "recht": "ohne Namen: „Inhalt fachlich geprüft, Stand …“ (Ihr Bestätigungsblatt vom 23.10.2026)",
    "steuern": "mit Ihrem Namen und der Kanzlei (Ihre Bestätigung vom 23.10.2026)",
    "arbeitsschutz": "ohne Namen: „Inhalt fachlich geprüft, Stand …“ (Ihre Bestätigung vom 23.10.2026)",
    "hygiene": "ohne Namen: „Inhalt fachlich geprüft (Stand …)“ (Ihre Bestätigung vom 23.10.2026)",
}
def fuer_pruefer(grund):
    """Interne Begründung (Register) für die Prüfer formuliert."""
    return (grund.replace("; es liegt nicht im Repository", "; es liegt uns nicht vor").replace("; er liegt nicht im Repository", "; er liegt uns nicht vor")
            .replace(" im Repository", "").replace("liegt nicht im Repository", "liegt uns nicht vor"))


def node_json(js):
    return json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def vorlagen():
    """Freigaben der Vorlagen (geprueft.ts) mit heutigem Prüfstand (pruefstaende.ts) – aus dem gebauten Paket."""
    js = """import('./packages/fachlogik/dist/index.js').then((F) => {
      const out = [];
      for (const id of Object.keys(F.VORLAGEN_GEPRUEFT)) F.freigabenFuer(id).forEach((f, i) => {
        const k = i ? `${id}#${i}` : id; const s = F.PRUEFSTAENDE[k];
        const frei = f.teilsummen ?? {}; const geaendert = Object.keys(s.teile).filter((g) => frei[g] !== s.teile[g]);
        out.push({ id, schluessel: k, titel: F.vorlageFuer(id).titel, ...f, heute: s.summe, offen: s.offen, bestaetigt: F.freigabeBestaetigt(f), geaendert, varianten: Object.keys(s.teile).length });
      });
      console.log(JSON.stringify(out));
    })"""
    return node_json(js)


def katalog():
    """Je Eintrag: Auswertung aus anwenden.py und die Freigaben ohne schriftliche Bestätigung (Version, Quelle, Stand)."""
    out = []
    for pfad, _text, d in anwenden.alle():
        _status, _block, info = anwenden.auswerten(pfad, d)
        info["titel"] = d["titel"]["de"]
        info["katalog_nr"] = d.get("katalog_nr", "")
        info["unbestaetigt"] = []
        for r in anwenden.register:
            if anwenden.bestaetigt(r) or d["id"] not in r["eintraege"]:
                continue
            f = r["eintraege"][d["id"]]
            if anwenden.gueltig(pfad, d, f, r["umfang"]) and not (r.get("felder_fehlen") and r["umfang"] != "sanktion"):
                info["unbestaetigt"].append({"rolle": r["pruefer"], "umfang": r["umfang"], "version": f["version"], "quelle": f["quelle"], "stand": str(f["stand"]), "grund": fuer_pruefer((r.get("nachweis") or {}).get("umfang", ""))})
        out.append(info)
    return out


def zeilen_fuer(rolle, kat, vorl):
    z = []
    umf = {"alles": "alle Felder", "sanktion": "nur Folgen bei Verstoß", "ohne_sanktion": "alle Felder ohne Folgen bei Verstoß"}
    for e in kat:
        for u in e["unbestaetigt"]:
            if u["rolle"] == rolle and any(x["rolle"] == rolle for x in e["ohne_nachweis"]):
                z.append(("Bestätigung fehlt", f"{e['katalog_nr']} {e['id']}", f"v{e['version']}", e["titel"],
                          f"Sie haben diese Fassung freigegeben ({umf[u['umfang']]}; {u['quelle']}, Stand {u['stand'].split('-')[2]}.{u['stand'].split('-')[1]}.{u['stand'][:4]}). "
                          f"Eine schriftliche Bestätigung liegt uns nicht vor ({u['grund']}). Bitte bestätigen Sie die Freigabe dieser Fassung per E-Mail."))
        if rolle in e["rollen"] and e["offen"] and e["status"] == "freigegeben" or (rolle in e["rollen"] and e["offen"] and e["ohne_nachweis"]):
            for t in e["offen"]:
                z.append(("Offener Punkt", f"{e['katalog_nr']} {e['id']}", f"v{e['version']}", e["titel"],
                          f"In unseren Prüfnotizen offen: {t}. Bis zur Klärung zeigt die App „teilweise geprüft – noch offen: {t}“. Bitte prüfen Sie den Punkt und bestätigen Sie ihn per E-Mail bzw. nennen Sie die Änderung."))
        if rolle in e["rollen"] and e["einschraenkung"]:
            z.append(("Einschränkung", f"{e['katalog_nr']} {e['id']}", f"v{e['version']}", e["titel"],
                      f"Der Vermerk nennt jetzt Ihre Einschränkung: „{'; '.join(e['einschraenkung'])}“. Bitte bestätigen Sie per E-Mail, dass die Einschränkung so richtig wiedergegeben ist."))
    for v in vorl:
        if v.get("rolle") != rolle:
            continue
        name = v["titel"] + (f" (Fassung {v['fassung']['wert']})" if v.get("fassung") else "") + (f" – nur {', '.join(v['rechtsformen'])}" if v.get("rechtsformen") else "")
        teile = []
        if v["geaendert"]:
            namen = {"rf:GmbH & Co. KG": "GmbH & Co. KG", "rf:UG (haftungsbeschränkt) & Co. KG": "UG (haftungsbeschränkt) & Co. KG",
                     "storno_schluss": "Storno einer Schlussrechnung mit Abschlägen (die abgesetzten Abschlagsrechnungen werden mit umgekehrtem Vorzeichen gespiegelt, E-193)",
                     "basis": "Hilfetext eines Formularfelds: „Steuerberater“ statt Ihres Namens (das gedruckte Dokument ist unverändert)"}
            was = "; ".join(namen.get(g, g) for g in v["geaendert"])
            fuss = any(g.endswith("& Co. KG") for g in v["geaendert"])
            pdfs = [f"{v['id']}-{d}.pdf" for g, d in (("rf:GmbH & Co. KG", "gmbh-co-kg"), ("rf:UG (haftungsbeschränkt) & Co. KG", "ug-co-kg"), ("storno_schluss", "storno-schlussrechnung")) if g in v["geaendert"]]
            teile.append(f"Seit Ihrer Freigabe geändert sind nur diese Varianten: {was}"
                         + (" – bei GmbH & Co. KG / UG & Co. KG die Fußzeile mit der Zeile „Persönlich haftende Gesellschafterin: …“ (Angaben der Komplementärin, E-193)" if fuss else "")
                         + f". Die übrigen {v['varianten'] - len(v['geaendert'])} von {v['varianten']} Varianten (Rechtsformen, Länder, Kleinunternehmer"
                         + (", Schlussrechnung, Storno" if v["id"] == "rechnung" else "") + ") sind unverändert; für sie gilt Ihre Freigabe weiter, die App zeigt dort den Vermerk."
                         + (f" Beispiel-PDFs der geänderten Varianten: vorlagen/{', vorlagen/'.join(pdfs)}." if pdfs else ""))
        if not v["bestaetigt"]:
            teile.append(f"Eine schriftliche Bestätigung liegt uns nicht vor ({fuer_pruefer(v.get('nachweis_offen', ''))}).")
        if v["offen"]:
            teile.append(f"Die Vorlage enthält {v['offen']} Stelle(n) mit „fachlich zu prüfen“ – bis zur Klärung zeigt die App nur „teilweise durchgesehen“.")
        if v.get("einschraenkung"):
            teile.append(f"Der Vermerk nennt Ihre Einschränkung: „{v['einschraenkung']}“.")
        if teile:
            if v["geaendert"]:
                bitte = " Bitte sehen Sie die geänderten Varianten durch und bestätigen Sie sie per E-Mail."
            elif not v["bestaetigt"]:
                bitte = " Inhalt seit Ihrer Freigabe unverändert – bitte bestätigen Sie die Freigabe per E-Mail."
            elif v["offen"]:
                bitte = " Ihre Freigabe dieser Fassung liegt uns schriftlich vor. Bitte prüfen Sie die mit „fachlich zu prüfen“ gekennzeichneten Stellen und bestätigen Sie sie per E-Mail bzw. nennen Sie die Änderung."
            else:
                bitte = " Ihre Freigabe dieser Fassung liegt uns schriftlich vor; bitte bestätigen Sie per E-Mail nur, dass der Vermerk so richtig ist."
            z.append(("Vorlage", v["id"], v["heute"][:12], name, " ".join(teile) + bitte))
    z.append(("Nennung im Vermerk", "alle", "–", "Rolle statt Name",
              f"Die App nennt Personen nicht mehr. Bisher {BISHER[rolle]}; künftig nennt der Vermerk Ihre Rolle: {WORTLAUT[rolle]} "
              "(bei Einschränkungen mit dem Zusatz in Klammern, bei offenen Punkten „teilweise“). Bitte bestätigen Sie per E-Mail, dass die Nennung der Rolle so in Ordnung ist."))
    return z


def mappe(rolle, z, ordner, datei=None, ueberschrift=None):
    titel, kurz, von = ROLLE[rolle]
    wb = Workbook()
    hw = wb.active
    hw.title = "So geht's"
    for r in [[ueberschrift or f"Betriebsklar – Nachprüfliste {titel} (Stand {STAND})"], [""],
              ["Bitte prüfen Sie die Positionen und bestätigen Sie sie per E-Mail. Diese Liste nennt alles, was nach unserer Durchsicht der Freigaben noch Ihre Prüfung oder Bestätigung braucht:"],
              ["• Bestätigung fehlt: Sie haben die Fassung freigegeben, uns liegt aber keine schriftliche Bestätigung vor. Bis dahin zeigt die App bei diesen Einträgen keinen Prüfvermerk."],
              ["• Offener Punkt / Einschränkung: Der Vermerk lautet bis zur Klärung „teilweise geprüft“ bzw. nennt Ihre Einschränkung."],
              ["• Vorlage: ohne schriftliche Bestätigung und/oder eine Variante (Rechtsform, Land, Rechnungsart …) seit Ihrer Freigabe geändert. Je Variante bestimmt eine Prüfsumme die Fassung; eine Änderung betrifft nur ihre Variante."],
              ["• Nennung im Vermerk: Die App nennt keine Namen mehr, sondern die Rolle."],
              [""], ["Je Zeile bitte in Spalte „Entscheidung“ wählen: bestätigt / ändern (Anmerkung) / nicht mein Bereich."],
              ["Bestätigen Sie bitte per E-Mail – eine Unterschrift ist nicht nötig. Es genügt eine kurze Antwort mit den Nummern der bestätigten Positionen, oder Sie schicken diese Datei mit ausgefüllter Spalte „Entscheidung“ mit Ihrer Antwort zurück. Zu geänderten Varianten von Vorlagen liegen PDFs bei (Ordner „vorlagen“)."]]:
        hw.append(r)
    hw["A1"].font = Font(bold=True, size=14)
    hw.column_dimensions["A"].width = 140
    ws = wb.create_sheet("Nachprüfliste")
    kopf = ["Nr.", "Art", "Eintrag / Vorlage", "Fassung", "Titel", "Was zu prüfen ist", "Entscheidung", "Anmerkung"]
    ws.append(kopf)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="1F4E5A")
        c.alignment = Alignment(wrap_text=True, vertical="top")
    duenn = Side(style="thin", color="999999")
    for i, (art, eintrag, fassung, titel_e, was) in enumerate(z, 1):
        ws.append([i, art, eintrag, fassung, titel_e, was, "", ""])
    for row in ws.iter_rows(min_row=1, max_row=len(z) + 1, max_col=len(kopf)):
        for c in row:
            c.alignment = Alignment(wrap_text=True, vertical="top")
            c.border = Border(top=duenn, bottom=duenn, left=duenn, right=duenn)
    dv = DataValidation(type="list", formula1='"bestätigt,ändern (Anmerkung),nicht mein Bereich"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"G2:G{len(z) + 1}")
    for col, w in zip("ABCDEFGH", [5, 18, 34, 16, 34, 80, 18, 40]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    ws.page_setup.orientation = "landscape"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    datei = datei or f"Betriebsklar-Nachpruefliste-{kurz}.xlsx"
    wb.save(os.path.join(ordner, datei))
    return datei


def mail(rolle, z, datei, vorl=()):
    titel, _, _ = ROLLE[rolle]
    arten = {}
    for art, *_ in z:
        arten[art] = arten.get(art, 0) + 1
    punkte = []
    if arten.get("Bestätigung fehlt"):
        punkte.append(f"- {arten['Bestätigung fehlt']} Katalogeinträge, die Sie freigegeben haben, zu denen uns aber keine schriftliche Bestätigung vorliegt. Bis dahin zeigt die App dort keinen Prüfvermerk.")
    if arten.get("Offener Punkt"):
        punkte.append(f"- {arten['Offener Punkt']} offene Punkte aus unseren Prüfnotizen; bis zur Klärung heißt der Vermerk dort „teilweise geprüft“.")
    if arten.get("Einschränkung"):
        punkte.append(f"- {arten['Einschränkung']} Einträge, bei denen der Vermerk Ihre Einschränkung nennt (z. B. „ohne arbeitsmedizinische Angaben“).")
    if arten.get("Vorlage"):
        geaendert = [v for v in vorl if v.get("rolle") == rolle and v["geaendert"]]
        satz = f"- {arten['Vorlage']} {'Vorlage' if arten['Vorlage'] == 1 else 'Vorlagen'}. Ihre Freigaben liegen uns schriftlich vor; der Vermerk gilt je Variante (Rechtsform, Land, Rechnungsart …) nur für die Fassung, die Sie gesehen haben."
        if geaendert:
            satz += " Seit Ihrer Freigabe geändert: " + "; ".join(f"{v['titel']} ({', '.join(x.replace('rf:', '').replace('storno_schluss', 'Storno einer Schlussrechnung mit Abschlägen').replace('basis', 'Hilfetext im Formular') for x in v['geaendert'])})" for v in geaendert) + " – nur dort fehlt der Vermerk; die PDFs dieser Varianten liegen bei."
        punkte.append(satz)
    punkte.append("- die Nennung im Vermerk: Die App nennt keine Personen mehr, nur noch die Rolle (z. B. „von einem Steuerberater“).")
    nummern = "\n".join(f"  {i}. {art}: {eintrag} ({fassung}) – {titel_e}" for i, (art, eintrag, fassung, titel_e, _was) in enumerate(z, 1))
    beispiel = f"Position 1 der Nachprüfliste vom {STAND} ist bestätigt" if len(z) == 1 else f"Die Positionen 1 bis {len(z)} der Nachprüfliste vom {STAND} sind bestätigt"
    pdfs = sorted(os.listdir(os.path.join(ZIEL, rolle, "vorlagen"))) if os.path.isdir(os.path.join(ZIEL, rolle, "vorlagen")) else []
    anlage_pdfs = "".join(f"- vorlagen/{d}{chr(10)}" for d in pdfs if d.endswith(".pdf"))
    text = f"""Betreff: Betriebsklar – Nachprüfliste {titel}: bitte per E-Mail bestätigen

Sehr geehrter Herr [Name],

wir haben die Prüfvermerke in der App noch einmal mit Ihren schriftlichen Freigaben abgeglichen. Der Vermerk erscheint nur für die Fassung, die Sie bestätigt haben, und nie mit einem späteren Datum als dem Ihrer Bestätigung. Für die folgenden Punkte brauchen wir noch Ihre Prüfung bzw. Bestätigung:

{chr(10).join(punkte)}

Die Einzelheiten stehen in der beiliegenden Liste ({datei}). Bitte bestätigen Sie per E-Mail, welche dieser Positionen zutreffen:

{nummern}

Eine kurze Antwort genügt, zum Beispiel: „{beispiel}“ – Positionen, die Sie ändern möchten, nennen Sie bitte mit der Änderung. Sie können auch die Spalte „Entscheidung“ ausfüllen und die Datei mit Ihrer Antwort zurückschicken. Eine Unterschrift ist nicht nötig.

Mit freundlichen Grüßen

[Absender]

Anlagen:
- {datei}
{anlage_pdfs}"""
    return text


if __name__ == "__main__":
    kat = katalog()
    vorl = vorlagen()
    for rolle in ROLLE:
        ordner = os.path.join(ZIEL, rolle)
        os.makedirs(ordner, exist_ok=True)
        z = zeilen_fuer(rolle, kat, vorl)
        datei = mappe(rolle, z, ordner)
        text = mail(rolle, z, datei, vorl)
        if MAIL_ZIEL:  # E-198: nur außerhalb des Repositorys
            os.makedirs(MAIL_ZIEL, exist_ok=True)
            open(os.path.join(MAIL_ZIEL, f"{rolle}-E-Mail.txt"), "w", encoding="utf-8").write(text)
        else:
            print(f"----- E-Mail-Entwurf {rolle} (nicht gespeichert) -----", text, sep="\n")
        zahl = {}
        for art, *_ in z:
            zahl[art] = zahl.get(art, 0) + 1
        print(rolle, len(z), zahl)
