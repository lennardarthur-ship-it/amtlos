"""
Nachprüfliste je Rolle (E-196): was jede prüfende Person noch prüfen bzw. unterschreiben soll, als Excel-Datei mit Blatt
zum Unterschreiben und E-Mail-Entwurf.

    pnpm --filter @amtlos/fachlogik build
    python3 docs/freigabe-katalog/nachpruefliste.py docs/freigabe-katalog/versand-2026-10-25-nachpruefung

Inhalt je Rolle (recht, steuern, arbeitsschutz, hygiene):
  - Katalogeinträge, die freigegeben sind, deren unterschriebenes Blatt aber nicht vorliegt (Register: `unterschrieben_am`
    fehlt) – mit Version und Quelle der Freigabe,
  - offene Prüfpunkte (offene-punkte.yaml) und Einschränkungen, die der Vermerk jetzt nennt,
  - Vorlagen: fehlende Unterschrift und/oder geänderte Varianten seit der Freigabe (Teilsumme je Variantengruppe freigegeben ↔ heute, E-196);
    PDFs der geänderten Varianten erzeugt apps/mobile/werkzeuge/nachpruef-pdfs.mjs in <rolle>/vorlagen/
    sowie Stellen mit „fachlich zu prüfen“,
  - Steuern: die Konten für § 13b-Eingangsleistungen (SKR03/SKR04),
  - die Nennung der Rolle im Vermerk (statt keines Namens bzw. des Namens).
Der E-Mail-Entwurf beginnt mit „Sehr geehrter Herr [Name],“ – den Namen setzt der Gründer beim Versand ein.
"""
import json
import os
import subprocess
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

HIER = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HIER, "../.."))
sys.path.insert(0, HIER)
sys.dont_write_bytecode = True
sys.argv = [sys.argv[0]] + [a for a in sys.argv[1:]]
ZIEL = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HIER, "versand-2026-10-25-nachpruefung"))
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
# § 13b-Eingangsleistungen: Konten wie in packages/fachlogik/src/buchungen.ts (Belege mit Steuerschuldnerschaft)
KONTEN_13B = [
    ("Bauleistung eines im Inland ansässigen Unternehmers (§ 13b Abs. 2 Nr. 4, Abs. 5 Satz 2 UStG), mit Vorsteuerabzug", "3120", "5920"),
    ("Sonstige Leistung eines im übrigen Gemeinschaftsgebiet ansässigen Unternehmers (§ 13b Abs. 1 UStG), mit Vorsteuerabzug", "3123", "5923"),
    ("Bauleistung eines im Inland ansässigen Unternehmers, ohne Vorsteuerabzug (z. B. Kleinunternehmer, Beleg „Vorsteuer abziehbar“ aus)", "3140", "5940"),
    ("Sonstige Leistung eines EU-Unternehmers, ohne Vorsteuerabzug (z. B. Kleinunternehmer)", "3143", "5943"),
]


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
        out.push({ id, schluessel: k, titel: F.vorlageFuer(id).titel, ...f, heute: s.summe, offen: s.offen, unterschrieben: F.freigabeUnterschrieben(f), geaendert, varianten: Object.keys(s.teile).length });
      });
      console.log(JSON.stringify(out));
    })"""
    return node_json(js)


def katalog():
    """Je Eintrag: Auswertung aus anwenden.py und die Freigaben ohne Unterschrift (Version, Quelle, Stand)."""
    out = []
    for pfad, _text, d in anwenden.alle():
        _status, _block, info = anwenden.auswerten(pfad, d)
        info["titel"] = d["titel"]["de"]
        info["katalog_nr"] = d.get("katalog_nr", "")
        info["unsigniert"] = []
        for r in anwenden.register:
            if r.get("unterschrieben_am") or d["id"] not in r["eintraege"]:
                continue
            f = r["eintraege"][d["id"]]
            if anwenden.gueltig(pfad, d, f, r["umfang"]) and not (r.get("felder_fehlen") and r["umfang"] != "sanktion"):
                info["unsigniert"].append({"rolle": r["pruefer"], "umfang": r["umfang"], "version": f["version"], "quelle": f["quelle"], "stand": str(f["stand"]), "grund": fuer_pruefer(r.get("unterschrift_offen", ""))})
        out.append(info)
    return out


def zeilen_fuer(rolle, kat, vorl):
    z = []
    umf = {"alles": "alle Felder", "sanktion": "nur Folgen bei Verstoß", "ohne_sanktion": "alle Felder ohne Folgen bei Verstoß"}
    for e in kat:
        for u in e["unsigniert"]:
            if u["rolle"] == rolle and any(x["rolle"] == rolle for x in e["ohne_unterschrift"]):
                z.append(("Unterschrift fehlt", f"{e['katalog_nr']} {e['id']}", f"v{e['version']}", e["titel"],
                          f"Sie haben diese Fassung freigegeben ({umf[u['umfang']]}; {u['quelle']}, Stand {u['stand'].split('-')[2]}.{u['stand'].split('-')[1]}.{u['stand'][:4]}). "
                          f"Ein unterschriebenes Blatt liegt uns nicht vor ({u['grund']}). Bitte die Freigabe dieser Fassung mit Unterschrift bestätigen."))
        if rolle in e["rollen"] and e["offen"] and e["status"] == "freigegeben" or (rolle in e["rollen"] and e["offen"] and e["ohne_unterschrift"]):
            for t in e["offen"]:
                z.append(("Offener Punkt", f"{e['katalog_nr']} {e['id']}", f"v{e['version']}", e["titel"],
                          f"In unseren Prüfnotizen offen: {t}. Bis zur Klärung zeigt die App „teilweise geprüft – noch offen: {t}“. Bitte prüfen und bestätigen bzw. die Änderung angeben."))
        if rolle in e["rollen"] and e["einschraenkung"]:
            z.append(("Einschränkung", f"{e['katalog_nr']} {e['id']}", f"v{e['version']}", e["titel"],
                      f"Der Vermerk nennt jetzt Ihre Einschränkung: „{'; '.join(e['einschraenkung'])}“. Bitte bestätigen, dass die Einschränkung so richtig wiedergegeben ist."))
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
                         + (", Schlussrechnung, Storno" if v["id"] == "rechnung" else "") + ") sind unverändert; für sie gilt Ihre Freigabe weiter."
                         + (f" Beispiel-PDFs der geänderten Varianten: vorlagen/{', vorlagen/'.join(pdfs)}." if pdfs else ""))
        if not v["unterschrieben"]:
            teile.append(f"Ein unterschriebenes Blatt liegt uns nicht vor ({fuer_pruefer(v.get('unterschrift_offen', ''))}).")
        if v["offen"]:
            teile.append(f"Die Vorlage enthält {v['offen']} Stelle(n) mit „fachlich zu prüfen“ – bis zur Klärung zeigt die App nur „teilweise durchgesehen“.")
        if v.get("einschraenkung"):
            teile.append(f"Der Vermerk nennt Ihre Einschränkung: „{v['einschraenkung']}“.")
        if teile:
            bitte = " Bitte die geänderten Varianten durchsehen und bestätigen." if v["geaendert"] else " Inhalt seit Ihrer Freigabe unverändert – bitte nur die Freigabe mit Unterschrift bestätigen."
            z.append(("Vorlage", v["id"], v["heute"][:12], name, " ".join(teile) + bitte))
    z.append(("Nennung im Vermerk", "alle", "–", "Rolle statt Name",
              f"Die App nennt Personen nicht mehr. Bisher {BISHER[rolle]}; künftig nennt der Vermerk Ihre Rolle: {WORTLAUT[rolle]} "
              "(bei Einschränkungen mit dem Zusatz in Klammern, bei offenen Punkten „teilweise“). Bitte bestätigen, dass die Nennung der Rolle so in Ordnung ist."))
    return z


def konten13b():
    """Steuern (E-196, Teil B): die Konten für § 13b-Eingangsleistungen als eigenes kurzes Blatt."""
    return [("§ 13b-Konto", "buchungen.ts", f"SKR03 {s3} / SKR04 {s4}", fall,
             "Automatikkonto für die Umsatzsteuer und ggf. die Vorsteuer (19 %), gebucht bei Belegen mit Steuerschuldnerschaft des Leistungsempfängers. "
             "Die Kontonummern stammen aus einer internen Prüfrunde; Ihr Prüfbericht vom 21./22.10.2026 bezeichnet sie als richtig (B-3, Frage 4), ein unterschriebenes Blatt dazu liegt nicht vor. "
             "7-%-Fälle und § 13b-Lieferungen (Schrott, Mobilfunk) sind nicht abgebildet. Bitte prüfen und bestätigen.") for fall, s3, s4 in KONTEN_13B]


def mappe(rolle, z, ordner, datei=None, ueberschrift=None):
    titel, kurz, von = ROLLE[rolle]
    wb = Workbook()
    hw = wb.active
    hw.title = "So geht's"
    for r in [[ueberschrift or f"Betriebsklar – Nachprüfliste {titel} (Stand {STAND})"], [""],
              ["Bitte prüfen und bestätigen. Diese Liste nennt alles, was nach unserer Durchsicht der Freigaben noch Ihre Prüfung oder Ihre Unterschrift braucht:"],
              ["• Unterschrift fehlt: Sie haben die Fassung freigegeben, uns liegt aber kein unterschriebenes Blatt vor. Bis dahin zeigt die App bei diesen Einträgen keinen Prüfvermerk."],
              ["• Offener Punkt / Einschränkung: Der Vermerk lautet bis zur Klärung „teilweise geprüft“ bzw. nennt Ihre Einschränkung."],
              ["• Vorlage: ohne unterschriebenes Blatt und/oder eine Variante (Rechtsform, Land, Rechnungsart …) seit Ihrer Freigabe geändert. Je Variante bestimmt eine Prüfsumme die Fassung; eine Änderung betrifft nur ihre Variante."],
              ["• Nennung im Vermerk: Die App nennt keine Namen mehr, sondern die Rolle."],
              [""], ["Je Zeile bitte in Spalte „Entscheidung“ wählen: bestätigt / ändern (Anmerkung) / nicht mein Bereich."],
              ["Am Ende das Blatt „Unterschrift“ ausfüllen und unterschreiben (Scan genügt). Zu geänderten Varianten von Vorlagen liegen PDFs bei (Ordner „vorlagen“)."]]:
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
    us = wb.create_sheet("Unterschrift")
    for r in [[f"Bestätigung der Nachprüfung – {titel}"], [""],
              ["Ich habe die Positionen der Nachprüfliste vom 25.10.2026, die ich in der Spalte „Entscheidung“ mit „bestätigt“ markiert habe, in der jeweils genannten Fassung "
               "(Version bzw. Prüfsumme) fachlich geprüft bzw. durchgesehen. Sie sind nach meiner Prüfung zum genannten Stand zutreffend. Positionen mit „ändern“ oder "
               "„nicht mein Bereich“ sind nicht umfasst; für sie darf kein Vermerk angezeigt werden. Ändert sich ein Eintrag (neue Version) oder eine Vorlage (andere "
               "Prüfsumme), gilt diese Bestätigung dafür nicht mehr. Die Prüfung betrifft die allgemeinen Inhalte, nicht ihre Anwendung im Einzelfall."],
              [""], [f"Anzeige in der App (nur bei bestätigten Positionen, ohne Namen, mit der Rolle): {WORTLAUT[rolle]}"],
              [""], ["Stand der Prüfung:", ""], [""], ["Ort, Datum:", ""], [""], ["Unterschrift:", ""], [""], [f"({titel})"]]:
        us.append(r)
    us["A1"].font = Font(bold=True, size=14)
    for c in ("A7", "A9", "A11"):
        us[c].font = Font(bold=True)
    us.column_dimensions["A"].width = 30
    us.column_dimensions["B"].width = 90
    for r in (3, 5):
        us.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        us.cell(r, 1).alignment = Alignment(wrap_text=True, vertical="top")
        us.row_dimensions[r].height = 90 if r == 3 else 45
    datei = datei or f"Betriebsklar-Nachpruefliste-{kurz}.xlsx"
    wb.save(os.path.join(ordner, datei))
    return datei


def mail(rolle, z, datei, extra=None, vorl=()):
    titel, _, _ = ROLLE[rolle]
    arten = {}
    for art, *_ in z:
        arten[art] = arten.get(art, 0) + 1
    punkte = []
    if arten.get("Unterschrift fehlt"):
        punkte.append(f"- {arten['Unterschrift fehlt']} Katalogeinträge, die Sie freigegeben haben, zu denen uns aber kein unterschriebenes Blatt vorliegt. Bis zu Ihrer Unterschrift zeigt die App dort keinen Prüfvermerk.")
    if arten.get("Offener Punkt"):
        punkte.append(f"- {arten['Offener Punkt']} offene Punkte aus unseren Prüfnotizen; bis zur Klärung heißt der Vermerk dort „teilweise geprüft“.")
    if arten.get("Einschränkung"):
        punkte.append(f"- {arten['Einschränkung']} Einträge, bei denen der Vermerk jetzt Ihre Einschränkung nennt (z. B. „ohne arbeitsmedizinische Angaben“).")
    if arten.get("Vorlage"):
        geaendert = [v for v in vorl if v.get("rolle") == rolle and v["geaendert"]]
        satz = f"- {arten['Vorlage']} Vorlagen: Uns fehlt das unterschriebene Blatt und/oder eine Variante hat sich seit Ihrer Freigabe geändert. Wir prüfen den Inhalt jetzt je Variante (Rechtsform, Land, Rechnungsart …) über alle gedruckten Fassungen; der Vermerk entfällt nur für eine geänderte Variante."
        if geaendert:
            satz += " Geändert: " + "; ".join(f"{v['titel']} ({', '.join(x.replace('rf:', '').replace('storno_schluss', 'Storno einer Schlussrechnung mit Abschlägen').replace('basis', 'Hilfetext im Formular') for x in v['geaendert'])})" for v in geaendert) + " – die PDFs dieser Varianten liegen bei; alle übrigen Vorlagen sind seit Ihrer Freigabe unverändert."
        else:
            satz += " Inhaltlich hat sich seit Ihrer Freigabe nichts geändert."
        punkte.append(satz)
    if extra:
        punkte.append(f"- in einem eigenen kurzen Blatt ({extra}): die vier Konten für § 13b-Eingangsleistungen (SKR03 3120/3123/3140/3143, SKR04 5920/5923/5940/5943). Ihr Prüfbericht vom 21./22.10.2026 bezeichnet sie als richtig; eine unterschriebene Bestätigung fehlt.")
    punkte.append("- die Nennung im Vermerk: Die App nennt keine Personen mehr, nur noch die Rolle (z. B. „von einem Steuerberater“). Bitte bestätigen Sie, dass das so in Ordnung ist.")
    pdfs = sorted(os.listdir(os.path.join(ZIEL, rolle, "vorlagen"))) if os.path.isdir(os.path.join(ZIEL, rolle, "vorlagen")) else []
    anlage_pdfs = "".join(f"- vorlagen/{d}{chr(10)}" for d in pdfs if d.endswith(".pdf"))
    text = f"""Betreff: Betriebsklar – Nachprüfliste {titel}: bitte prüfen und bestätigen

Sehr geehrter Herr [Name],

wir haben unsere Freigaben noch einmal genau mit den unterschriebenen Blättern abgeglichen. Dabei haben wir festgestellt, dass die App den Prüfvermerk an einigen Stellen gezeigt hat, für die uns kein unterschriebenes Blatt vorliegt oder deren Inhalt sich seit Ihrer Freigabe geändert hat. Das haben wir korrigiert: Der Vermerk erscheint jetzt nur noch, wenn eine unterschriebene Freigabe genau diese Fassung abdeckt, und nie mit einem späteren Datum als dem Ihrer Unterschrift.

Bitte prüfen und bestätigen Sie die Positionen in {"den beiliegenden Listen (" + datei + " und " + extra + ")" if extra else "der beiliegenden Liste (" + datei + ")"}:

{chr(10).join(punkte)}

Je Zeile genügt die Auswahl in der Spalte „Entscheidung“; am Ende bitte das Blatt „Unterschrift“ ausfüllen und unterschreiben (Scan genügt).

Mit freundlichen Grüßen

[Absender]

Anlagen:
- {datei}
{"- " + extra + chr(10) if extra else ""}{anlage_pdfs}"""
    return text


if __name__ == "__main__":
    kat = katalog()
    vorl = vorlagen()
    for rolle in ROLLE:
        ordner = os.path.join(ZIEL, rolle)
        os.makedirs(ordner, exist_ok=True)
        z = zeilen_fuer(rolle, kat, vorl)
        datei = mappe(rolle, z, ordner)
        extra = mappe(rolle, konten13b(), ordner, "Betriebsklar-Konten-13b-Steuerberater.xlsx", f"Betriebsklar – Konten für § 13b-Eingangsleistungen (Stand {STAND})") if rolle == "steuern" else None
        open(os.path.join(ordner, "E-Mail.txt"), "w", encoding="utf-8").write(mail(rolle, z, datei, extra, vorl))
        zahl = {}
        for art, *_ in z:
            zahl[art] = zahl.get(art, 0) + 1
        print(rolle, len(z), zahl)
