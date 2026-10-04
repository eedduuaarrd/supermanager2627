# Supermanager Balaguer

Fantasy bàsquet multi-usuari dels sèniors del Club Bàsquet Balaguer (FCBQ).

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Auth: registre/login amb cookie JWT (`jose` + `bcryptjs`)
- Persistència: SQLite (`better-sqlite3`) a `DATA_DIR/supermanager.db`
- Proxy públic: Caddy → `127.0.0.1:4317`

## Desenvolupament

```bash
cp .env.example .env.local   # SESSION_SECRET ≥ 32 caràcters
npm install
npm run dev                  # http://0.0.0.0:4317
```

## Producció (VPS)

```bash
npm ci && npm run build
# systemd: EnvironmentFile amb SESSION_SECRET, DATA_DIR, ADMIN_TOKEN
npm run start
```

## Com jugar

1. Obre la URL pública i **Registra’t** (nom, equip fantasy, correu, contrasenya ≥ 8).
2. A **Inici**: gestiona equips fantasy (fins a 5) i mira l’estat de la jornada.
3. A **Equip**: afegeix 8 jugadors (3 pivots, 3 alers, 2 bases) i tria capità — l’alineació es desa sola.
4. Classificació **general** i d’**última jornada** a Classificació.

## Model de jornada (setmanal FCBQ)

Cada **jornada fantasy ≈ els partits d’aquella setmana** dels 4 equips sèniors del club.

- No hi ha simulació aleatòria: es puntua amb el box score FCBQ d’aquella setmana.
- **Punts** = `VAL` si FCBQ el publica; si no, `PM` (+/-). Capità ×2.
- Qui no juga aquella setmana (DNP) suma **0** — no s’inventen partits futurs.
- Variants dual-team (`persona__equip`) es puntuen només amb el partit **del seu** equip.
- L’historial a la fitxa del jugador creix setmana a setmana (append).

### Broker / preus

- Sortida flat **10.000 €** per a tothom.
- Preu teòric = mitjana VAL de temporada × **1.000 €**; cotització limitada a **±15%** vs el preu anterior (rodona 500 €, mín. 500 €).
- Els preus només es mouen quan creix el nombre de partits amb VAL (`update-market-prices.mjs`; `--force` per forçar).
- El **weekend sync** (dissabte/diumenge 23:59) executa el tick automàticament després de puntuar; l’app llegeix les quotes en runtime (sense rebuild).
- A la fitxa del jugador: llindars «pujar / mantenir / baixar» el 15%.

```bash
node scripts/update-market-prices.mjs --seed   # flat 10.000 €
node scripts/update-market-prices.mjs          # un tick si hi ha partits nous
```

### Esquema (SQLite)

| Peça | Contingut |
|------|-----------|
| `meta.current_round` | Jornada fantasy activa (enter) |
| `meta.round_status` | `open` \| `closed` |
| `rounds` | `id`, `label`, `status`, `opened_at`, `scored_at` |
| `lineups` | Alineació per `team_id` + `round` (bloquejada en tancar) |
| `round_scores` | Punts de jornada per equip |
| `src/data/player-stats.json` | Box scores per jugador; cada fila té `round` / `jornada` |

### Operativa setmanal

El snapshot `fcbq-rosters.json` només és honest amb PJ=1. El timer de cap de setmana no el fa servir per puntuar: ingereix el registre per partit i, si falta, no tanca la jornada.

Després d’actualitzar l’snapshot FCBQ a mà (`fcbq-rosters.json` o `--from`):

```bash
# Al VPS (app en marxa), amb ADMIN_TOKEN a l’entorn:
ADMIN_TOKEN=… APP_URL=http://127.0.0.1:4317 node scripts/weekly-jornada.mjs

# Equivalent manual:
node scripts/refresh-fcbq-stats.mjs --from src/data/fcbq-rosters.json
# assigna jocs sense round → jornada actual, puntua i obre la següent
ADMIN_TOKEN=… curl -s -X POST http://127.0.0.1:4317/api/admin/weekly \
  -H 'content-type: application/json' \
  -d '{"token":"…","action":"run"}'
```

Accions API (`POST /api/admin/weekly`, header `x-admin-token` o body `token`, o sessió admin):

| `action` | Efecte |
|----------|--------|
| `refresh` | Hint: refresca amb l’script (no fa scrape aquí) |
| `close` | Puntua i bloqueja la jornada actual (sense avançar) |
| `open` | Obre la següent jornada |
| `run` | `close` + obrir següent (pas típic del cron) |

El tancament de jornada a l’app està desactivat: només via timer/scripts o `POST /api/admin/weekly` amb `ADMIN_TOKEN`.

### Weekend sync (systemd)

Dissabte i diumenge **23:59 Europe/Madrid** (`supermanager-weekend-sync.timer`). Una jornada fantasy és la **setmana del club** (dl–dg, Europe/Madrid), no un sol dia: el dissabte no tanca si encara queda un partit el diumenge, i una segona passada el mateix cap de setmana **no** avança una jornada buida.

Les estadístiques del timer surten del registre **per partit** (msstats, Chrome com els calendaris). Les mitjanes de plantilla amb PJ>1 no es fan servir per puntuar. Si el scrape falla, el calendari no es refresca, o falta el box score d’un partit ja jugat, el sync **no** puntua ni avança.

```bash
npm run test:weekend-sync
node scripts/weekend-sync.mjs --dry-run   # decisió amb els JSON locals; no fa scrape ni tanca
ADMIN_TOKEN=… APP_URL=http://127.0.0.1:4317 npm run weekend-sync
```

Al VPS: `systemctl status supermanager-weekend-sync.timer` i `journalctl -u supermanager-weekend-sync.service -n 100 --no-pager`. Dissabte s’espera `week-still-open` si hi ha partit diumenge; diumenge, una sola `action=run`; una segona execució la mateixa setmana, `already-scored-this-week` o `no-club-fixtures`. Log: `/var/log/supermanager-weekend-sync.log`.
Unitats a `deploy/systemd/`.

**Equip ideal** (diumenge 23:59 Europe/Madrid, dins el mateix sync): desa l’alineació dels millors VAL reals de la jornada que aquell run acaba de tancar (3 pivots, 3 alers, 2 bases). El botó d’Inici mostra aquesta jornada desada — amb la jornada 2 oberta, J1 — i no es mou fins al diumenge següent. Si falten resultats, es manté l’últim equip vàlid. Dissabte no el canvia.

```bash
npm run test:ideal-team
```

### Notificacions push

Web Push (VAPID) cap als navegadors que s’hi subscriuen. No hi ha un altre proveïdor.

- **Equip ideal:** el mateix diumenge 23:59 Europe/Madrid, només si el sync desa la jornada que acaba de tancar. Títol `Supermanager`, cos `Ja pots consultar l'equip ideal de la jornada X.`
- **Inici de jornada:** cada minut (`supermanager-push-jornada.timer`) comprova el primer tip-off real d’aquesta setmana de Madrid. En el moment del xiulet: `La jornada X ja ha començat.` Si el tip-off ja ha passat de 20 minuts, o la jornada ja està tancada, no s’envia.
- **Final de partit:** quan un partit del club té marcador i box score reals, a l’instant (no al tancament de diumenge). Títol `Supermanager`, dues línies: `Teixidó 81–65 Cappont.` i `Destacat: Joan Boladeres (VAL 24).` El destacat és el jugador del Balaguer amb més VAL d’aquell partit (PTS − faltes − TL fallats + ±). Només es puntuen els jugadors d’aquell partit; la pista d’Equip mostra aquest VAL. Els partits amb tip-off anterior a la primera execució no s’envien ni es reescriuen. El procés de l’app ja ho comprova cada minut; el timer `supermanager-match-live.timer` és opcional.

Cada avís surt una sola vegada per jornada, a totes les subscripcions desades. Cal que l’usuari hagi iniciat sessió. En obrir l’app, si aquest dispositiu encara no hi està subscrit, es demana el permís del navegador (el mateix que **Activa les notificacions** a Compte). Si es tanca amb «Ara no», no es torna a demanar en aquella sessió. Si el permís queda bloquejat, no es torna a obrir el diàleg del navegador. A l’iPhone, a més, l’app ha d’estar a la pantalla d’inici (iOS 16.4+) — Safari en una pestanya no rep Web Push, i el diàleg ho diu.

Claus: `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` a l’entorn, o bé el servidor les crea a `DATA_DIR/vapid.json` el primer cop. No es fa un enviament de jornades ja començades o ja tancades.

```bash
npm run test:push
```

### Backup SQLite (systemd)

Diari **03:15 Europe/Madrid** (`supermanager-db-backup.timer`): còpia a `data/backups/supermanager-YYYYMMDD.db`, retenció 14 dies. Log: `/var/log/supermanager-db-backup.log`.

### Bloqueig d'alineació (tip-off)

`lockAt = min(tipOff)` dels partits dels 4 equips del club per a la jornada.
Sense tip-off publicat → alineació oberta (no s'inventen hores; msstats porta data/local-visitant/rival).
`PUT /api/lineup` → 403 en català si bloquejada. `/api/round` exposa `lockAt`, `locked`, `nextMatches`.

### Equips nous (plantilla inicial)

`fantasy_teams.transfer_phase = 'initial'` al crear → canvis **il·limitats** fins al primer tip-off de la jornada.
Quan `lineup_lock_at` s’assoleix, tots els equips `initial` passen a `normal` (màx. 3 canvis). El tip-off bloqueja tothom.

## Dades

Plantilles FCBQ 2026-27 a `src/data/roster.ts` (snapshot `fcbq-rosters.json`).
L’FCBQ no publica fotos a les fitxes d’estadística → avatar amb inicials.
