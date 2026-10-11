import { redirect } from "next/navigation";
import { sitzung } from "@/lib/sitzung";

export default async function Start() {
  redirect((await sitzung()) ? "/heute" : "/anmelden");
}
