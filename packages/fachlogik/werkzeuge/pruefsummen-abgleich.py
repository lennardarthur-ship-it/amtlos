"""
E-196: Prüfsummen der freigegebenen Vorlagen nach der neuen Rechnung (alle Ausprägungen, pruefvarianten.ts) – einmal für
den Stand, den der Prüfer freigegeben hat, und einmal für den aktuellen Stand.

Für jede Freigabe in geprueft.ts wird der erste Commit gesucht, in dem ihre Prüfsumme nach der Rechnung vor E-196
(`pruefsumme_alt`) in geprueft.ts steht – das ist die freigegebene Fassung. Die Quellen von packages/fachlogik/src aus diesem Commit werden ausgepackt, die heutige
Rechnung (pruefvarianten.ts) dazugelegt und mit esbuild gebündelt. Gleiche neue Prüfsumme alt und heute = der gedruckte
Inhalt hat sich seit der Freigabe in keiner Ausprägung geändert; die Freigabe gilt mit der neuen Prüfsumme weiter.
Verschieden = der Inhalt hat sich geändert (z. B. Fußzeile der GmbH & Co. KG oder Storno, E-193).

Verglichen wird je Variantengruppe (basis, rf:<Rechtsform>, land:<Land>, ku, bei der Rechnung schlussrechnung, storno,
storno_schluss): Der Vermerk entfällt nur für die Gruppen, deren Teilsumme sich geändert hat. Mit --schreiben werden die
freigegebenen Teilsummen nach src/dokumente/geprueft-teilsummen.ts geschrieben und `pruefsumme` in geprueft.ts auf die
Gesamtsumme der freigegebenen Fassung gesetzt.

    python3 packages/fachlogik/werkzeuge/pruefsummen-abgleich.py <ausgabe.json> [--schreiben]
"""
import glob
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.."))
GEPRUEFT = "packages/fachlogik/src/dokumente/geprueft.ts"
ESBUILD = sorted(glob.glob(os.path.join(ROOT, "node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild")))[-1]

TREIBER = r'''
import * as F from "./packages/fachlogik/src/dokumente/index.ts";
import { KURZ } from "./packages/fachlogik/src/dokumente/ablauf.ts";
import { kanonisch, sha256, sichtbarerText } from "./packages/fachlogik/src/dokumente/geprueft.ts";
import { LEERER_BETRIEB } from "./packages/fachlogik/src/dokumente/typen.ts";
import { gedruckterText, pruefAuspraegungen, pruefstandBerechnen } from "./packages/fachlogik/src/dokumente/pruefvarianten-neu.ts";
const auftraege = JSON.parse(process.env.AUFTRAEGE);
const api = { dokumentHtml: F.dokumentHtml, leereDaten: F.leereDaten, eintragAusVorschlag: F.eintragAusVorschlag, leererBetrieb: LEERER_BETRIEB, kurz: KURZ, kanonisch, sha256, sichtbarerText };
const aus = {};
for (const a of auftraege) {
  const v = F.vorlageFuer(a.id);
  if (!v) { aus[a.schluessel] = null; continue; }
  const alt = typeof F.vorlagenPruefsumme === "function" ? F.vorlagenPruefsumme(v, a.freigabe) : null;
  aus[a.schluessel] = { ...pruefstandBerechnen(v, a.freigabe, api), alt };
  // je Ausprägung der gedruckte Text (für den Bericht, was sich geändert hat)
  const fassung = a.freigabe.fassung ? { [a.freigabe.fassung.feld]: a.freigabe.fassung.wert } : {};
  const passt = (x) => !a.freigabe.gruppen || a.freigabe.gruppen.includes(x.gruppe ?? "");
  const abschnitte = v.abschnitte.map((s) => ({ ...s, felder: s.felder.map((f) => (f.art === "liste" && f.vorschlaege ? { ...f, vorschlaege: f.vorschlaege.filter(passt) } : f)) }));
  aus[a.schluessel].texte = pruefAuspraegungen(v, abschnitte, fassung, a.freigabe.rechtsformen, api).map(({ d, b }) => gedruckterText(api.dokumentHtml(v, d, b), sichtbarerText));
}
console.log(JSON.stringify(aus));
'''


def freigaben():
    """Alle Freigaben aus dem gebauten Stand (dist) mit Schlüssel, Parametern und alter Prüfsumme."""
    js = """import('./packages/fachlogik/dist/index.js').then((F) => {
      const out = [];
      for (const [id, f] of Object.entries(F.VORLAGEN_GEPRUEFT)) {
        F.freigabenFuer(id).forEach((x, i) => out.push({ id, schluessel: i ? `${id}#${i}` : id, pruefsumme: x.pruefsumme, pruefsumme_alt: x.pruefsumme_alt, stand: x.stand,
          freigabe: { ...(x.fassung ? { fassung: x.fassung } : {}), ...(x.gruppen ? { gruppen: x.gruppen } : {}), ...(x.rechtsformen ? { rechtsformen: x.rechtsformen } : {}) } }));
      }
      console.log(JSON.stringify(out));
    })"""
    return json.loads(subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout)


def erster_commit(summe):
    r = subprocess.run(["git", "log", "--format=%H", "--reverse", f"-S{summe}", "--", GEPRUEFT], cwd=ROOT, capture_output=True, text=True).stdout.split()
    return r[0] if r else None


def rechnen(commit, auftraege, arbeit):
    ziel = os.path.join(arbeit, commit or "heute")
    os.makedirs(ziel, exist_ok=True)
    if commit:
        tar = subprocess.run(["git", "archive", commit, "packages/fachlogik/src"], cwd=ROOT, capture_output=True, check=True).stdout
        subprocess.run(["tar", "-x", "-C", ziel], input=tar, check=True)
        neu = open(os.path.join(ROOT, "packages/fachlogik/src/dokumente/pruefvarianten.ts"), encoding="utf-8").read()
        open(os.path.join(ziel, "packages/fachlogik/src/dokumente/pruefvarianten-neu.ts"), "w", encoding="utf-8").write(neu)
        treiber = TREIBER
    else:
        treiber = TREIBER.replace("./packages/", ROOT + "/packages/").replace("pruefvarianten-neu.ts", "pruefvarianten.ts")
    open(os.path.join(ziel, "treiber.ts"), "w", encoding="utf-8").write(treiber)
    subprocess.run([ESBUILD, os.path.join(ziel, "treiber.ts"), "--bundle", "--platform=node", "--format=esm", f"--outfile={ziel}/treiber.mjs", "--log-level=error"], check=True)
    env = dict(os.environ, AUFTRAEGE=json.dumps(auftraege))
    return json.loads(subprocess.run(["node", f"{ziel}/treiber.mjs"], capture_output=True, text=True, check=True, env=env).stdout)


if __name__ == "__main__":
    alle = freigaben()
    je_commit = {}
    for f in alle:
        f["commit"] = erster_commit(f.get("pruefsumme_alt") or f["pruefsumme"])
        je_commit.setdefault(f["commit"], []).append(f)
    # Arbeitsordner unter packages/fachlogik, damit gebündelte Pakete (qrcode-generator) aus node_modules auflösen
    with tempfile.TemporaryDirectory(dir=os.path.join(ROOT, "packages/fachlogik"), prefix=".abgleich-") as arbeit:
        heute = rechnen(None, alle, arbeit)
        ergebnis = []
        for commit, liste in je_commit.items():
            alt = rechnen(commit, liste, arbeit) if commit else {}
            for f in liste:
                a = alt.get(f["schluessel"]) or {}
                h = heute[f["schluessel"]]
                ta, th = a.get("texte") or [], h.get("texte") or []
                geaendert = sorted({w for i in range(max(len(ta), len(th))) if (ta[i] if i < len(ta) else None) != (th[i] if i < len(th) else None)
                                    for w in set((th[i] if i < len(th) else "").split(" ")) - set((ta[i] if i < len(ta) else "").split(" "))})
                ergebnis.append({**f, "neu_freigegeben": a.get("summe"), "alt_bestaetigt": a.get("alt") == (f.get("pruefsumme_alt") or f["pruefsumme"]), "neu_heute": h["summe"], "offen_heute": h["offen"],
                                 "unveraendert": a.get("summe") == h["summe"],
                                 "teile_freigegeben": a.get("teile") or {}, "teile_heute": h.get("teile") or {},
                                 "gruppen_geaendert": sorted(g for g in set(a.get("teile") or {}) | set(h.get("teile") or {}) if (a.get("teile") or {}).get(g) != (h.get("teile") or {}).get(g)),
                                 "auspraegungen_geaendert": sum(1 for i in range(max(len(ta), len(th))) if (ta[i] if i < len(ta) else None) != (th[i] if i < len(th) else None)),
                                 "auspraegungen": len(th), "neue_woerter": geaendert[:40],
                                 # ohne Kopf- und Fußzeile (Meta-Angaben): Änderungen im Dokument selbst
                                 "dokument_geaendert": sum(1 for i in range(max(len(ta), len(th))) if (ta[i] if i < len(ta) else "").split(" ‖ ")[0] != (th[i] if i < len(th) else "").split(" ‖ ")[0]),
                                 "fusszeile_geaendert": sum(1 for i in range(max(len(ta), len(th))) if (ta[i] if i < len(ta) else "").split(" ‖ ")[-1] != (th[i] if i < len(th) else "").split(" ‖ ")[-1])})
                del ergebnis[-1]["neue_woerter"]
                ergebnis[-1]["neue_woerter"] = geaendert[:40]
    json.dump(ergebnis, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for e in ergebnis:
        print(f"{e['schluessel']:32} {e['commit'][:10] if e['commit'] else '-':10} alt ok={e['alt_bestaetigt']!s:5} unverändert={e['unveraendert']!s:5} offen={e['offen_heute']} geändert={','.join(e['gruppen_geaendert']) or '-'}")
    if "--schreiben" in sys.argv:
        zeilen = []
        for e in ergebnis:
            if not e["alt_bestaetigt"] or not e["teile_freigegeben"]:
                continue
            teile = ", ".join(f"{json.dumps(g, ensure_ascii=False)}: \"{t}\"" for g, t in sorted(e["teile_freigegeben"].items()))
            zeilen.append(f"  {json.dumps(e['schluessel'])}: {{ {teile} }},")
        open(os.path.join(ROOT, "packages/fachlogik/src/dokumente/geprueft-teilsummen.ts"), "w", encoding="utf-8").write(
            "/**\n * Erzeugt von werkzeuge/pruefsummen-abgleich.py --schreiben (E-196) – nicht von Hand ändern. Teilsummen der freigegebenen\n"
            " * Fassung je Variantengruppe (pruefvarianten.ts), gerechnet über die Quellen des Commits, in dem die Freigabe eingetragen\n"
            " * wurde. Schlüssel: Vorlage, weitere Freigaben mit „#1“ usw.\n */\n"
            "export const FREIGEGEBENE_TEILSUMMEN: Readonly<Record<string, Readonly<Record<string, string>>>> = {\n" + "\n".join(zeilen) + "\n};\n")
        g = open(os.path.join(ROOT, GEPRUEFT), encoding="utf-8").read()
        for e in ergebnis:
            if e["alt_bestaetigt"] and e["neu_freigegeben"] and e["pruefsumme"] != e["neu_freigegeben"]:
                assert g.count(e["pruefsumme"]) == 1, e["schluessel"]
                g = g.replace(e["pruefsumme"], e["neu_freigegeben"])
        open(os.path.join(ROOT, GEPRUEFT), "w", encoding="utf-8").write(g)
        print(f"✓ {len(zeilen)} Freigaben mit Teilsummen → src/dokumente/geprueft-teilsummen.ts")
