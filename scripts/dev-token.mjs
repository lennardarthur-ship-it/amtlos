#!/usr/bin/env node
// Erzeugt ein Entwicklungs-Token (nur AUTH_MODUS=dev). Aufruf: node scripts/dev-token.mjs <sub> [email]
import { SignJWT } from "jose";
const [sub = "dev", email = `${sub}@example.org`] = process.argv.slice(2);
const geheim = process.env.DEV_JWT_SECRET;
if (!geheim) throw new Error("DEV_JWT_SECRET setzen (wie in apps/api/.env)");
const token = await new SignJWT({ email, name: sub }).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setIssuer("amtlos-dev").setExpirationTime("12h").sign(new TextEncoder().encode(geheim));
console.log(token);
