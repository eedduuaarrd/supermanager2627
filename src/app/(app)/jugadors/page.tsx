import { JugadorsBrowser } from "@/components/jugadors-browser";
import { buildJugadorsList } from "@/lib/jugadors-list";

export const runtime = "nodejs";

export default function JugadorsPage() {
  try {
    const players = buildJugadorsList();

    if (players.length === 0) {
      return (
        <div className="space-y-3 pb-4">
          <h1 className="font-display text-3xl tracking-wide text-bone">
            Jugadors
          </h1>
          <div className="border border-dashed border-line px-4 py-12 text-center">
            <p className="text-sm text-mute">
              Encara no hi ha jugadors al mercat.
            </p>
            <p className="mt-2 text-xs text-mute">
              Quan hi hagi plantilla FCBQ del club, apareixeran aquí ordenats
              per preu.
            </p>
          </div>
        </div>
      );
    }

    return <JugadorsBrowser players={players} />;
  } catch {
    return (
      <div className="space-y-3 pb-4">
        <h1 className="font-display text-3xl tracking-wide text-bone">
          Jugadors
        </h1>
        <div className="border border-line border-grana/40 bg-grana/10 px-4 py-8 text-center">
          <p className="text-sm text-bone">
            No s&apos;ha pogut carregar el mercat de jugadors.
          </p>
          <p className="mt-2 text-xs text-mute">
            Torna-ho a provar d&apos;aquí a un moment. Si continua, avisa
            l&apos;administrador.
          </p>
        </div>
      </div>
    );
  }
}
