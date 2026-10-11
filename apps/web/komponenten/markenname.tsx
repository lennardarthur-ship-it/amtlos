import { aktuelleMarke } from "@/lib/marke";
import { t } from "@/lib/sprache";

/** Name der Anwendung: Amtlos oder die Partnermarke mit dem Zusatz „mit Amtlos“. */
export async function Markenname({ className = "text-titel font-bold" }: { className?: string }) {
  const [{ t: x }, m] = await Promise.all([t(), aktuelleMarke()]);
  if (!m) return <span className={className}>{x.app.name}</span>;
  return (
    <span className="inline-flex flex-col">
      <span className={`${className} inline-flex items-center gap-2`}>
        {m.logo_url ? <img src={m.logo_url} alt="" width={28} height={28} className="size-7 object-contain" /> : null}
        {m.name}
      </span>
      <span className="text-klein font-normal text-tinte-leise">{x.app.mit_amtlos}</span>
    </span>
  );
}
