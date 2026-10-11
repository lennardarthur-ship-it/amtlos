import { describe, expect, it } from "vitest";
import { ExpoPush } from "../src/push.js";

describe("Expo-Push (E-108)", () => {
  it("sendet in Paketen zu 100, meldet abgemeldete Geräte, schickt keine Unternehmensdaten", async () => {
    const aufrufe: { body: unknown[]; kopf: Record<string, string> }[] = [];
    const push = new ExpoPush("geheim", async (_url, init) => {
      const body = JSON.parse(init.body) as { to: string }[];
      aufrufe.push({ body, kopf: init.headers });
      return { ok: true, status: 200, json: async () => ({ data: body.map((b) => (b.to.endsWith("[weg]") ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok" })) }) };
    });
    const tokens = [...Array.from({ length: 150 }, (_, i) => `ExponentPushToken[${i}]`), "ExponentPushToken[weg]"];
    const r = await push.senden({ tokens, titel: "Fällig am 10.11.2026: USt-VA", text: "Öffne Amtlos.", link: "/pflichten/x/y" });
    expect(aufrufe.map((a) => a.body.length)).toEqual([100, 51]);
    expect(aufrufe[0]!.kopf.Authorization).toBe("Bearer geheim");
    expect(aufrufe[0]!.body[0]).toEqual({ to: "ExponentPushToken[0]", title: "Fällig am 10.11.2026: USt-VA", body: "Öffne Amtlos.", data: { link: "/pflichten/x/y" }, sound: "default", priority: "normal" });
    expect(r.ungueltig).toEqual(["ExponentPushToken[weg]"]);
  });

  it("Fehler des Dienstes werden gemeldet (Erinnerung → Status fehler)", async () => {
    const push = new ExpoPush(undefined, async () => ({ ok: false, status: 503, json: async () => ({}) }));
    await expect(push.senden({ tokens: ["ExponentPushToken[1]"], titel: "t", text: "x", link: "/" })).rejects.toThrow(/503/);
  });
});
