/**
 * Freigabe-Prüfungen für Katalog und Vorlagen (aus werkzeuge/store-check.mjs herausgelöst, E-240), damit dieselben
 * Startblocker auch vor einem Inhalts-Update gelten (werkzeuge/inhalte-gate.mjs): kein Eintrag in Prüfung oder als
 * Entwurf im Bündel, nichts Zurückgehaltenes, keine offene Prüfmarke, nichts Internes im Bündel, von Pflichten verwendete
 * Regelwerte bestätigt, Vorlagen in der heutigen Fassung bestätigt, kein Vermerk ausgesetzt. Inhalt der Prüfungen
 * unverändert (E-197, E-198, E-200–E-202, E-211, E-223, E-233, E-237).
 *
 *   await freigabePruefungen((bedingung, text) => …)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lies = (p) => fs.readFileSync(path.join(APP, p), "utf8");

/** Meldet jede Prüfung über `pruefe(bedingungErfuellt, text)`. */
export async function freigabePruefungen(pruefe) {
  const katalog = JSON.parse(lies("src/pflichten/katalog.json"));
  const wartend = katalog.pflichten.filter((p) => p.pruefung?.status === "in_pruefung").map((p) => p.id);
  pruefe(!wartend.length, `Katalog: alle freigegebenen Einträge schriftlich bestätigt (E-197, Nachweis ohne Mail im Projekt, E-198)${wartend.length ? ` – ${wartend.length} warten auf die Bestätigung per E-Mail bzw. Nachprüfung (Nachprüfliste beim Gründer, PRUEFLISTE T-200)` : ""}`);
  // E-223: Entwürfe im Bündel sind Startblocker. E-233: Einträge mit `nicht_vor_freigabe` stehen bis zur Freigabe nicht im
  // Bündel (die App zeigt sie nicht) – kein Startblocker, nur genannt; ein Entwurf ohne das Merkmal bleibt Startblocker,
  // auch wenn das Bündel veraltet ist (Prüfung am Katalog selbst).
  {
    const { katalogEntwuerfe, zurueckgehalten } = await import("./interna.mjs");
    const kat = katalogEntwuerfe();
    const entwurf = [...new Set([...katalog.pflichten.filter((p) => p.pruefung?.status === "entwurf").map((p) => p.id), ...kat.blockierend])].sort();
    // E-237: mit Zahl (freigegeben von allen im Bündel) – seit C.37 wieder alle Einträge des Katalogs im Bündel
    const frei = katalog.pflichten.filter((p) => p.pruefung?.status === "freigegeben").length;
    pruefe(!entwurf.length, `Katalog: jeder Eintrag fachlich freigegeben (${frei} von ${katalog.pflichten.length} im Bündel)${entwurf.length ? ` – ${entwurf.length} neue Einträge noch ohne Freigabe (${entwurf.join(", ")}; Prüfpaket beim Gründer, PRUEFLISTE T-198; E-223: Entwürfe sind Startblocker, PRUEFLISTE T-313)` : ""}${kat.zurueckgehalten.length ? ` – bis zur Freigabe zurückgehalten, nicht in der App und kein Startblocker (E-233): ${kat.zurueckgehalten.join(", ")}` : ""}`);
    const imBuendel = katalog.pflichten.filter((p) => kat.zurueckgehalten.includes(p.id) || zurueckgehalten(p)).map((p) => p.id);
    pruefe(!imBuendel.length, `Bündel ohne zurückgehaltene Einträge (E-233, katalog-buendel.mjs)${imBuendel.length ? ` – ${imBuendel.join(", ")} (Bündel neu erzeugen)` : ""}`);
  }
  // E-223 (a): keine freigegebene Fassung mit offener Prüfmarke; (b): nichts Internes im Bündel (katalog.json, Web-Export und
  // Website, falls gebaut) – Regeln in werkzeuge/interna.mjs
  {
    const { markerBefunde, buendelBefunde, auslieferung } = await import("./interna.mjs");
    const marken = markerBefunde();
    pruefe(!marken.length, `Katalog: kein freigegebener Eintrag und kein freigegebener Regelwert mit offener Prüfmarke („[FACHLICH ZU PRÜFEN]“, „TODO“, „Platzhalter“ …; E-223)${marken.length ? ` – ${marken.join("; ")}` : ""}`);
    const intern = auslieferung().flatMap(({ datei, katalog: k }) => buendelBefunde(fs.readFileSync(datei, "utf8"), { katalog: k }).map((b) => `${path.relative(path.join(APP, "../.."), datei)}: ${b}`));
    pruefe(!intern.length, `Bündel ohne interne Prüfnotizen, Prüfmarken und Namen (katalog.json, Web-Export und Website, falls gebaut; E-223)${intern.length ? ` – ${intern.slice(0, 5).join("; ")}` : ""}`);
  }
  // E-211: Regelwerte (Schwellen, Beträge) haben eine eigene Prüfung. Solange ein Wert, auf den eine Pflicht verweist (Auslöser
  // oder Frist), in der heute oder künftig geltenden Version nicht bestätigt ist, sagt der Vermerk der Pflicht das – vor dem
  // Start sollen sie bestätigt sein (Prüfpakete je Rolle: scripts/regelwerte-pruefpaket.py, Übernahme regelwerte-uebernehmen.py).
  {
    const heute = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const bestaetigt = (r) => r.pruefung?.status === "freigegeben" && r.pruefung.geprueft_version === r.version && Boolean(r.pruefung.geprueft_am) && Boolean(r.pruefung.bestaetigt_am) && r.pruefung.geprueft_am <= r.pruefung.bestaetigt_am;
    const verweise = (o, ids = new Set()) => {
      if (Array.isArray(o)) o.forEach((x) => verweise(x, ids));
      else if (o && typeof o === "object") {
        if (typeof o.regelwert === "string") ids.add(o.regelwert);
        Object.values(o).forEach((x) => verweise(x, ids));
      }
      return ids;
    };
    const offenFuer = (ids) => (katalog.regelwerte ?? []).filter((r) => ids.has(r.id) && !(r.gueltig_bis && r.gueltig_bis < heute) && !bestaetigt(r)).map((r) => `${r.id}@${r.version}`);
    const vonPflichten = [...new Set(offenFuer(verweise(katalog.pflichten)))].sort();
    // Werte, die die App selbst anzeigt (regelwert("…") in src/, z. B. Aufbewahrungsfrist beim Löschen)
    const inApp = new Set();
    const quellen = (o) => { for (const e of fs.readdirSync(o, { withFileTypes: true })) { const p = path.join(o, e.name); if (e.isDirectory()) quellen(p); else if (/\.tsx?$/.test(e.name)) for (const m of fs.readFileSync(p, "utf8").matchAll(/\bregelwert\("([a-z0-9_.]+)"\)/g)) inApp.add(m[1]); } };
    quellen(path.join(APP, "src"));
    const angezeigt = offenFuer(inApp).filter((x) => !vonPflichten.includes(x)).sort();
    pruefe(!vonPflichten.length && !angezeigt.length, `Startblocker Regelwerte: von Pflichten verwendete Schwellen und Beträge fachlich bestätigt (E-211)${vonPflichten.length || angezeigt.length ? ` – ${vonPflichten.length} von Pflichten verwendete Regelwert-Versionen noch nicht fachlich bestätigt (${vonPflichten.join(", ")})${angezeigt.length ? `; dazu in der App angezeigt: ${angezeigt.join(", ")}` : ""}; der Vermerk dieser Pflichten nennt den Wert als „noch nicht fachlich bestätigt“ (Prüfpakete je Rolle beim Gründer, PRUEFLISTE T-259)` : ""}`);
  }
  const geprueft = fs.readFileSync(path.join(APP, "../../packages/fachlogik/src/dokumente/geprueft.ts"), "utf8");
  const staende = fs.readFileSync(path.join(APP, "../../packages/fachlogik/src/dokumente/pruefstaende.ts"), "utf8");
  const teilsummen = fs.readFileSync(path.join(APP, "../../packages/fachlogik/src/dokumente/geprueft-teilsummen.ts"), "utf8");
  // heutige und freigegebene Teilsumme je Variantengruppe (Rechtsform, Land, Rechnungsart …)
  const heute = Object.fromEntries([...staende.matchAll(/^ {2}"([\w#]+)": \{ summe: "[0-9a-f]{64}", offen: \d+, teile: (\{[^\n]*\}) \},$/gm)].map((m) => [m[1], JSON.parse(m[2])]));
  const frei = Object.fromEntries([...teilsummen.matchAll(/^ {2}"([\w#]+)": (\{[^\n]*\}),$/gm)].map((m) => [m[1], JSON.parse(m[2])]));
  // Freigaben (weitere Fassungen als „#1“ usw.) mit Tag der schriftlichen Bestätigung
  const freigaben = [];
  // E-202: mehrere weitere Freigaben je Vorlage (je eine Zeile, „#1“, „#2“ … in der Reihenfolge der Zeilen)
  {
    let vorlage = null;
    let n = 0;
    for (const z of geprueft.split("\n")) {
      const kopf = /^ {2}(\w+): \{ stand: "[\d-]+", rolle: "\w+", bestaetigt_am: ("[\d-]+"|null)/.exec(z);
      if (kopf) {
        [vorlage, n] = [kopf[1], 0];
        freigaben.push([kopf[1], kopf[2]]);
        continue;
      }
      if (/^ {2}\w+: \{/.test(z)) [vorlage, n] = [null, 0];
      const w = /^ {4}(?:weitere: \[)?\{ stand: "[\d-]+", rolle: "\w+", bestaetigt_am: ("[\d-]+"|null)/.exec(z);
      if (w && vorlage) freigaben.push([`${vorlage}#${++n}`, w[1]]);
    }
  }
  const ohneBestaetigung = freigaben.filter(([, u]) => u === "null").map(([k]) => k);
  // E-200: eine Variante gilt als bestätigt, wenn irgendeine bestätigte Freigabe derselben Vorlage (auch eine Nachprüfung
  // einzelner Varianten, „#1“) für sie die heutige Teilsumme hat
  const bestaetigt = freigaben.filter(([, u]) => u !== "null").map(([k]) => k);
  const offenJe = new Map();
  for (const k of bestaetigt) {
    const id = k.split("#")[0];
    for (const g of Object.keys(heute[k] ?? frei[k] ?? {})) {
      const ok = bestaetigt.some((x) => x.split("#")[0] === id && frei[x]?.[g] !== undefined && frei[x][g] === heute[x]?.[g]);
      if (!ok) offenJe.set(id, new Set([...(offenJe.get(id) ?? []), g]));
    }
    if (!frei[k] || !heute[k]) offenJe.set(id, new Set([...(offenJe.get(id) ?? []), "(ohne Teilsummen)"]));
  }
  const geaendert = [...offenJe.keys()];
  const gruppen = [...offenJe].flatMap(([id, g]) => [...g].map((x) => `${id}: ${x}`)).sort();
  pruefe(freigaben.length > 0 && !ohneBestaetigung.length && !geaendert.length, `Vorlagen: heutige Fassung schriftlich bestätigt (E-197, Nachweis ohne Mail im Projekt, E-198)${ohneBestaetigung.length || geaendert.length ? ` – ${ohneBestaetigung.length} von ${freigaben.length} Freigaben ohne Bestätigung; ${geaendert.length} ${geaendert.length === 1 ? "Vorlage" : "Vorlagen"} ohne Vermerk in seit der Bestätigung geänderten Varianten (${gruppen.join(", ") || "–"}) (Nachprüfliste, PRUEFLISTE T-204)` : ""}`);
  // E-201: Vermerk auf Bitte des Prüfers ausgesetzt (Bestätigung der neu gerechneten Prüfsumme ausstehend)
  const ausgesetzt = [...geprueft.matchAll(/^ {2}(\w+): \{ stand:[^\n]*vermerk_ausgesetzt: "/gm)].map((m) => m[1]);
  pruefe(!ausgesetzt.length, `Vorlagen: kein Vermerk ausgesetzt (E-201)${ausgesetzt.length ? ` – ${ausgesetzt.length} Freigaben ohne Vermerk, bis der Prüfer die neu gerechnete Prüfsumme bestätigt (${ausgesetzt.join(", ")}; PRUEFLISTE T-216)` : ""}`);
}
