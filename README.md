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
# systemd: EnvironmentFile amb SESSION_SECRET i DATA_DIR
npm run start
```

## Com jugar

1. Obre la URL pública i **Registra’t** (nom, equip fantasy, correu, contrasenya ≥ 8).
2. El **primer compte** del servidor és administrador (pot tancar/simular jornades).
3. A **Equip**: afegeix 8 jugadors (qualsevol mix), tria capità, confirma alineació.
4. Classificació **general** i d’**última jornada** a Classificació.

## Dades

Plantilles FCBQ 2026-27 a `src/data/roster.ts` (snapshot `fcbq-rosters.json`).
L’FCBQ no publica fotos a les fitxes d’estadística → avatar amb inicials.
