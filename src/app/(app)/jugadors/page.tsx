import { JugadorsBrowser } from "@/components/jugadors-browser";
import { buildJugadorsList } from "@/lib/jugadors-list";

export const runtime = "nodejs";

function PageChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-5">
      <h1 className="font-display text-3xl tracking-wide text-bone">
        Jugadors
      </h1>
      {children}
    </div>
  );
}

export default function JugadorsPage() {
  try {
    const players = buildJugadorsList();

    if (players.length === 0) {
      return (
        <PageChrome>
          <div className="border border-dashed border-line px-4 py-14 text-center">
            <p className="text-sm text-bone">
              Encara no hi ha jugadors al mercat.
            </p>
            <p className="mt-1.5 text-xs text-mute">
              Quan hi hagi plantilla FCBQ del club, apareixeran aquí ordenats
              per preu.
            </p>
          </div>
        </PageChrome>
      );
    }

    return <JugadorsBrowser players={players} />;
  } catch {
    return (
      <PageChrome>
        <div className="border border-line border-grana/40 bg-grana/10 px-4 py-10 text-center">
          <p className="text-sm text-bone">
            No s&apos;ha pogut carregar el mercat de jugadors.
          </p>
          <p className="mt-1.5 text-xs text-mute">
            Torna-ho a provar d&apos;aquí a un moment. Si continua, avisa
            l&apos;administrador.
          </p>
        </div>
      </PageChrome>
    );
  }
}
