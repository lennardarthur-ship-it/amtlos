export const metadata = { title: "Kein Zugang" };

export default function KeinZugang() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-titel font-bold">Kein Zugang zum Studio</h1>
      <p className="mt-2">Dein Konto hat keine Rolle für Redaktion oder Prüfung. Eine Administratorin kann sie vergeben.</p>
      <form action="/auth/abmelden" method="post" className="mt-6">
        <button className="knopf knopf-leise">Abmelden</button>
      </form>
    </main>
  );
}
