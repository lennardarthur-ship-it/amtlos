/** Demo-Server: Abo, Team, Benachrichtigungen, Erinnerungen, Geräte, Export und Löschen (wie apps/api konto/team/mobil). */
import { plusTage } from "@amtlos/fristen";
import { fehler, leererStand, ok, type Modul } from "./kontext";

interface Einladung { id: string; email: string; rolle: string; erstellt_am: string; laeuft_ab: string }

export const konto: Modul = (a, k) => {
  const { teile: t, methode: m, s, pfad } = a;
  if (t[0] !== "v1") return undefined;
  const st = k.stand;

  if (pfad === "/v1/abo" && m === "GET") {
    const start = st.unternehmen?.erstellt_am?.slice(0, 10) ?? k.heute();
    return ok({ status: "test", test_bis: plusTage(start, 14), laeuft_bis: null, schreibbar: true, bezahlen_moeglich: false, plan_name: "Amtlos", testtage: 14 });
  }
  if (t[1] === "abo") return fehler(503, "Bezahlen gibt es in der Demo nicht.", "Payment is not available in the demo.", s);

  if (pfad === "/v1/team" && m === "GET")
    return ok({
      mitglieder: [{ konto_id: "demo", anzeigename: "Demo", email: "demo@amtlos.de", rolle: "inhaber", ich: true }],
      einladungen: k.tabelle<Einladung>("einladungen").filter((e) => e.laeuft_ab > k.zeit()),
      darf_verwalten: true,
    });
  if (pfad === "/v1/einladungen" && m === "POST") {
    const email = String(a.koerper.email ?? "").trim().toLowerCase();
    const rolle = String(a.koerper.rolle ?? "mitarbeiter");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fehler(422, "Bitte eine gültige E-Mail-Adresse angeben.", "Please enter a valid email address.", s);
    if (email === "demo@amtlos.de") return fehler(409, "Diese Person ist schon im Team", "This person is already on the team", s);
    const liste = k.tabelle<Einladung>("einladungen");
    st.tabellen.einladungen = liste.filter((e) => e.email !== email);
    const e: Einladung = { id: k.id("einladung"), email, rolle, erstellt_am: k.zeit(), laeuft_ab: new Date(k.jetzt().getTime() + 7 * 86_400_000).toISOString() };
    k.tabelle<Einladung>("einladungen").push(e);
    return ok({ ...e, link: null, demo: true });
  }
  const widerruf = /^\/v1\/einladungen\/([^/]+)$/.exec(pfad);
  if (widerruf && m === "DELETE") {
    const liste = k.tabelle<Einladung>("einladungen");
    if (!liste.some((e) => e.id === widerruf[1])) return fehler(404, "Einladung nicht gefunden", "Invitation not found", s);
    st.tabellen.einladungen = liste.filter((e) => e.id !== widerruf[1]);
    return ok(undefined, 204);
  }
  if (pfad === "/v1/team/verlassen") return fehler(409, "Das Unternehmen braucht mindestens einen Inhaber", "The company needs at least one owner", s);

  if (pfad === "/v1/benachrichtigungen" && m === "GET") return ok([]);
  if (pfad === "/v1/benachrichtigungen/gelesen") return ok({ gelesen: 0 });
  if (pfad === "/v1/benachrichtigungen/einstellungen") {
    if (m === "PUT" && Array.isArray(a.koerper.kanaele)) st.einstellungen.erinnerungen = a.koerper.kanaele;
    const eigene = (st.einstellungen.erinnerungen as { kanal: string; aktiv: boolean; vorlauf_tage: number[] }[] | undefined) ?? null;
    const standard = (kanal: string) => ({ kanal, aktiv: kanal === "email", vorlauf_tage: [14, 3] });
    return ok({ eigene: Boolean(eigene), geraet_vorhanden: false, kanaele: ["email", "push"].map((kanal) => eigene?.find((e) => e.kanal === kanal) ?? standard(kanal)) });
  }
  if (t[1] === "geraete") return m === "DELETE" ? ok(undefined, 204) : m === "GET" ? ok([]) : ok({ id: "demo-geraet" });

  if (pfad === "/v1/export" && m === "GET") return ok({ hinweis: "Demo", ...st });
  if (pfad === "/v1/unternehmen" && m === "DELETE") {
    if (String(a.koerper.name ?? "") !== st.unternehmen?.name) return fehler(400, "Zur Bestätigung den Namen des Unternehmens genau so eingeben", "To confirm, enter the company name exactly", s);
    k.stand = leererStand();
    return ok(undefined, 204);
  }
  if (pfad === "/v1/ich/loeschen") {
    if (st.unternehmen) return fehler(409, "Zuerst alle Unternehmen löschen oder verlassen", "First delete or leave all companies", s);
    return ok(undefined, 204);
  }
  return undefined;
};
