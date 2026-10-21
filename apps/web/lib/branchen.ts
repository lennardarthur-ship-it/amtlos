/** Branchenpakete (Spezifikation 4 H): Werkzeuge je Branche. Pflichten kommen aus dem Katalog (Feld `branchen`). */
export const BRANCHEN = ["gastronomie_lebensmittel", "handwerk", "beauty_kosmetik", "gebaeudereinigung", "bau", "transport_logistik", "onlinehandel", "it_agentur_freelancer", "gesundheit_pflege", "immobilien_finanzen", "unterricht_sport_coaching"] as const;
export type Branche = (typeof BRANCHEN)[number];

export type Werkzeug = "w_eigenkontrollen" | "w_allergene" | "w_ifsg" | "w_gb" | "w_geraete" | "w_gefahrstoffe" | "w_online" | "w_dienstleister" | "w_schulungen";
export const WERKZEUG_PFAD: Record<Werkzeug, string> = {
  w_eigenkontrollen: "/branche/eigenkontrollen",
  w_allergene: "/branche/allergene",
  w_ifsg: "/personal/unterweisungen?art=ifsg",
  w_gb: "/personal/gefaehrdungsbeurteilungen",
  w_geraete: "/personal/arbeitsmittel",
  w_gefahrstoffe: "/personal/gefahrstoffe",
  w_online: "/online",
  w_dienstleister: "/datenschutz/dienstleister",
  w_schulungen: "/personal/unterweisungen?art=ki_kompetenz",
};
export const WERKZEUGE: Partial<Record<Branche, Werkzeug[]>> = {
  gastronomie_lebensmittel: ["w_eigenkontrollen", "w_allergene", "w_ifsg", "w_gb"],
  handwerk: ["w_gb", "w_geraete", "w_gefahrstoffe"],
  beauty_kosmetik: ["w_gb", "w_gefahrstoffe"],
  gebaeudereinigung: ["w_gb", "w_gefahrstoffe"],
  bau: ["w_gb", "w_geraete"],
  onlinehandel: ["w_online"],
  it_agentur_freelancer: ["w_dienstleister", "w_schulungen"],
  // R12 (Nutzertest Coach #5): Kurse und Training – Gesundheitsfragen der Teilnehmenden, Dienstleister (Buchung, Video)
  unterricht_sport_coaching: ["w_dienstleister"],
};

/** Branchen aus dem Profil; Onlinehandel gilt auch, wenn ein Onlineshop angegeben ist. */
export function branchenAusProfil(p: Record<string, unknown>): Branche[] {
  const liste = Array.isArray(p["taetigkeit.branchen"]) ? (p["taetigkeit.branchen"] as string[]) : [];
  const kanaele = Array.isArray(p["vertrieb.kanaele"]) ? (p["vertrieb.kanaele"] as string[]) : [];
  const b = new Set(liste.filter((x): x is Branche => (BRANCHEN as readonly string[]).includes(x)));
  if (kanaele.includes("onlineshop")) b.add("onlinehandel");
  return BRANCHEN.filter((x) => b.has(x));
}
