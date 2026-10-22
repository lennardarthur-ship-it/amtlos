"""
Eine Seite zum Unterschreiben je Prüfer (E-171): Prüfvermerk, Liste der freigegebenen Einträge mit Version, Wortlaut der
Nennung, Unterschriftszeile. Die Einträge kommen aus dem Katalog (`pruefung.geprueft_von` enthält den Prüfer).

    python3 docs/freigabe-katalog/bestaetigung.py <ziel.pdf> "<Prüfer im Katalog>" "<Name, Funktion>" "<Stand TT.MM.JJJJ>" \
        "<Nennung: Text>" [--zusatz "<weiterer Satz>"] [--auch id1,id2]   # --auch: Einträge, die nach Durchsicht dazukommen

Erzeugt eine HTML-Seite und druckt sie mit Chromium (Playwright) als PDF auf eine A4-Seite.
"""
import glob
import html
import os
import subprocess
import sys

import yaml

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../.."))
args = [a for a in sys.argv[1:]]
zusatz = ""
auch = []
if "--zusatz" in args:
    i = args.index("--zusatz"); zusatz = args[i + 1]; del args[i:i + 2]
if "--auch" in args:
    i = args.index("--auch"); auch = [x for x in args[i + 1].split(",") if x]; del args[i:i + 2]
ziel, pruefer, name, stand, nennung = args[:5]

zeilen = []
for pfad in sorted(glob.glob(os.path.join(ROOT, "catalog/pflichten/*.yaml"))):
    d = yaml.safe_load(open(pfad, encoding="utf-8"))
    pr = d.get("pruefung") or {}
    if (pr.get("status") == "freigegeben" and pruefer in (pr.get("geprueft_von") or [])) or d["id"] in auch:
        zeilen.append((str(d.get("katalog_nr", "")), d["id"], d["version"], d["titel"]["de"]))
zeilen.sort(key=lambda z: [int(x) if x.isdigit() else x for x in z[0].replace(".", " ").split()])

n = len(zeilen)
groesse = "6.4pt" if n > 110 else "7.2pt" if n > 60 else "8.5pt"
spalten = 3 if n > 40 else 2
eintraege = "".join(f"<li><b>{html.escape(nr)}</b> {html.escape(i)} <i>v{v}</i></li>" for nr, i, v, _ in zeilen)
seite = f"""<!doctype html><html lang="de"><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 14mm 14mm 12mm; }}
body {{ font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #111; }}
h1 {{ font-size: 14pt; margin: 0 0 2mm; }} p {{ margin: 1.6mm 0; line-height: 1.35; }}
ul {{ columns: {spalten}; column-gap: 5mm; font-size: {groesse}; line-height: 1.28; padding: 0; margin: 2mm 0; list-style: none; }}
li {{ break-inside: avoid; }} i {{ color: #555; }}
.box {{ border: 0.4pt solid #888; padding: 2.5mm 3mm; margin-top: 3mm; }}
.sig {{ display: flex; gap: 10mm; margin-top: 9mm; }} .sig div {{ flex: 1; border-top: 0.6pt solid #111; padding-top: 1mm; font-size: 8.5pt; }}
</style></head><body>
<h1>Bestätigung der fachlichen Prüfung – Pflichtenkatalog Betriebsklar</h1>
<p>Anbieter: Lang Ventures UG (haftungsbeschränkt) i. G., Gomaringer Str. 33, 72770 Reutlingen · App „Betriebsklar“</p>
<p><b>{html.escape(name)}</b> – Stand der Prüfung: {html.escape(stand)}</p>
<p>Ich habe die unten aufgeführten {n} Einträge des Pflichtenkatalogs in der jeweils genannten Fassung (Version) fachlich geprüft.
Sie sind nach meiner Prüfung zum genannten Stand in Rechtsgrundlage, Auslöser, Frist und Folgen zutreffend; meine Anmerkungen
aus den Freigabe-Dateien sind umgesetzt. Die Prüfung betrifft die allgemeinen Katalogtexte, nicht ihre Anwendung auf einen
Einzelfall; spätere Rechtsänderungen sind nicht erfasst. Wird ein Eintrag inhaltlich geändert (neue Version), gilt diese
Bestätigung für ihn nicht mehr, bis er erneut geprüft ist. {html.escape(zusatz)}</p>
<ul>{eintraege}</ul>
<div class="box"><b>Anzeige in der App:</b> {html.escape(nennung)}</div>
<div class="sig"><div>Ort, Datum</div><div>Unterschrift – {html.escape(name)}</div></div>
</body></html>"""
tmp = ziel.replace(".pdf", ".html")
open(tmp, "w", encoding="utf-8").write(seite)
js = f"""const {{ chromium }} = require('playwright-core');
(async () => {{ const b = await chromium.launch({{ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] }});
const p = await b.newPage(); await p.goto('file://{tmp}'); await p.pdf({{ path: '{ziel}', format: 'A4', preferCSSPageSize: true }}); await b.close(); }})();"""
subprocess.run(["node", "-e", js], check=True, cwd=os.path.join(ROOT, "apps/web"))
seiten = subprocess.run(["pdfinfo", ziel], capture_output=True, text=True).stdout
print(f"{n} Einträge →", ziel, [l for l in seiten.splitlines() if l.startswith("Pages")])
