"""
Anlage 1 zur Vereinbarung Pflege und Widerruf (Rechtsanwalt): alle von ihm bestätigten Inhalte mit der Version bzw.
Prüfsumme, die er bestätigt hat. Bei „nur Folgen bei Verstoß“ (Lebensmittel) die von ihm gesehene Version und der
Hinweis, ob die Folgen seitdem unverändert sind.

    python3 docs/freigabe-katalog/anlage1-recht.py <ziel.pdf>
"""
import glob, html, os, re, subprocess, sys
import yaml
HIER = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HIER, "../.."))
os.chdir(ROOT)
src = open(os.path.join(HIER, "anwenden.py")).read().split('if __name__ == "__main__":')[0]
g = {"__file__": os.path.join(HIER, "anwenden.py")}; exec(src, g)
W = g["RECHT"]
rows = []
for p in sorted(glob.glob("catalog/pflichten/*.yaml")):
    d = yaml.safe_load(open(p)); pr = d.get("pruefung") or {}
    if pr.get("status") != "freigegeben" or W not in (pr.get("geprueft_von") or []):
        continue
    u = [uu for pp, uu in g["BENOETIGT"][g["gebiet"](d)] if pp == W][0]
    f = g["frei"][(W, u)][d["id"]]
    if u == "sanktion":
        umfang = "nur Folgen bei Verstoß" + ("" if f["version"] == d["version"] else f"; Folgen seit v{f['version']} unverändert, übrige Felder in v{d['version']} von Lebensmittelfachbeauftragter bestätigt")
    else:
        umfang = "nur rechtliche Seite" if d["id"] == "arbeitsschutz.arbeitsmedizinische_vorsorge" else ""
    rows.append((d.get("katalog_nr", ""), d["id"], f["version"], umfang, f["stand"]))
rows.sort(key=lambda z: [int(x) if x.isdigit() else x for x in str(z[0]).replace(".", " ").split()])
gp = open("packages/fachlogik/src/dokumente/geprueft.ts").read()
vorl = [(i, s, h[:12], "") for i, s, h in re.findall(r'\n\s+(\w+): \{ stand: "([\d-]+)", bezug: RECHT, pruefsumme: "([0-9a-f]{64})"', gp)]
vorl += [("hygieneplan (Fassung Friseur/Kosmetik, Beauty-Vorschläge)", "2026-10-25", "101632b4de7a", "Abgleich mit Rechtsgrundlagen und AWMF 055-004; Länderzusatz nur für Bayern geprüft"),
         ("handelsregister", "2026-10-25", "e2cd7a14a6c1", "nur GmbH, OHG, KG")]
texte = [("Datenschutzhinweis der App (Build ohne Sync)", "2026-10-23", "892aa8818e0e"), ("Impressum der Website (Vor-UG)", "2026-10-23", "004a6165d087"),
         ("Nutzungsbedingungen, Fassung 23.10.2026 – inhaltlich; Inkraftsetzung erst nach Eintragung", "2026-10-24", "813eaae2978f"),
         ("Baustein B-276 (Betriebsanweisung Biostoffe), Abgleich mit AWMF 055-004", "2026-10-25", "fb9435f46ccf"),
         ("Baustein B-283 (Betriebsanweisung Biostoffe), nur rechtliche Seite", "2026-10-24", "eedd5b3ffeca"),
         ("Zeile Grenzwerte im Prüfprotokoll elektrische Geräte, Quellenabgleich DIN EN 50678/50699", "2026-10-24", "88409edcac2d"),
         ("Baustein B-022 (Gefährdungsbeurteilung), Abgleich mit AWMF 055-004", "2026-10-25", "4ebe1832df64"),
         ("Baustein B-105 (Gefährdungsbeurteilung), Abgleich mit AWMF 055-004 und § 11 Abs. 5 BioStoffV", "2026-10-25", "c716e2dc257b")]
ka = "".join(f"<tr><td>{html.escape(str(a))}</td><td>{b}</td><td>v{c}</td><td>{html.escape(e)}</td><td>{dd}</td></tr>" for a, b, c, e, dd in rows)
vo = "".join(f"<tr><td>{html.escape(a)}</td><td>{b}</td><td><code>{c}</code></td><td>{html.escape(e)}</td></tr>" for a, b, c, e in vorl)
te = "".join(f"<tr><td>{html.escape(a)}</td><td>{b}</td><td><code>{c}</code></td></tr>" for a, b, c in texte)
CSS = "body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:8pt;color:#111}h1{font-size:12pt}h2{font-size:9.5pt;margin:3mm 0 1mm}table{border-collapse:collapse;width:100%;font-size:7pt}td,th{border-bottom:.3pt solid #aaa;padding:.5mm 1mm;text-align:left;vertical-align:top}th{border-bottom:.7pt solid #111}"
page = f"""<!doctype html><meta charset=utf-8><style>@page{{size:A4;margin:12mm}}{CSS}</style>
<h1>Anlage 1 – Von Rechtsanwalt bestätigte Inhalte (Stand 25.10.2026, bereinigt)</h1>
<p>Je Eintrag die Version bzw. Prüfsumme, die Rechtsanwalt bestätigt hat (Bestätigungsblätter vom 23., 24. und 25.10.2026, Mail vom 25.10.2026). Ein Prüfvermerk erscheint in der App nur, solange die bestätigten Felder unverändert sind.</p>
<h2>A. Pflichtenkatalog ({len(rows)} Einträge)</h2><table><tr><th>Nr</th><th>ID</th><th>bestätigt</th><th>Umfang / Hinweis</th><th>Stand</th></tr>{ka}</table>
<h2>B. Vorlagen ({len(vorl)})</h2><table><tr><th>Vorlage</th><th>Stand</th><th>Prüfsumme</th><th>Umfang</th></tr>{vo}</table>
<h2>C. Texte und Einzelpunkte</h2><table><tr><th>Text</th><th>Stand</th><th>Prüfsumme</th></tr>{te}</table>"""
ziel = os.path.abspath(sys.argv[1]); t = ziel[:-4] + ".html"; open(t, "w").write(page)
s = f"""const {{ chromium }} = require('playwright-core');(async()=>{{const b=await chromium.launch({{executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox']}});const p=await b.newPage();await p.goto('file://{t}');await p.pdf({{path:'{ziel}',format:'A4',preferCSSPageSize:true}});await b.close();}})();"""
subprocess.run(["node", "-e", s], check=True, cwd=os.path.join(ROOT, "apps/web")); os.remove(t)
print(len(rows), "Einträge,", len(vorl), "Vorlagen →", ziel)
