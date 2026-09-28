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
2. El **primer compte** del servidor és administrador (pot tancar jornades).
3. A **Inici**: gestiona equips fantasy (fins a 5) i mira l’estat de la jornada.
4. A **Equip**: afegeix fins a 8 jugadors (qualsevol mix) i tria capità — l’alineació es desa sola.
5. Classificació **general** i d’**última jornada** a Classificació.

## Model de jornada (setmanal FCBQ)

Cada **jornada fantasy ≈ els partits d’aquella setmana** dels 4 equips sèniors del club.

- No hi ha simulació aleatòria: es puntua amb el box score FCBQ d’aquella setmana.
- **Punts** = `VAL` si FCBQ el publica; si no, `PM` (+/-). Capità ×2.
- Qui no juga aquella setmana (DNP) suma **0** — no s’inventen partits futurs.
- Variants dual-team (`persona__equip`) es puntuen només amb el partit **del seu** equip.
- L’historial a la fitxa del jugador creix setmana a setmana (append).

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

Després d’actualitzar l’snapshot FCBQ (`fcbq-rosters.json` o `--from`):

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

L’admin també pot tancar des de **Classificació** («Tancar jornada (stats FCBQ)»).

## Dades

Plantilles FCBQ 2026-27 a `src/data/roster.ts` (snapshot `fcbq-rosters.json`).
L’FCBQ no publica fotos a les fitxes d’estadística → avatar amb inicials.
