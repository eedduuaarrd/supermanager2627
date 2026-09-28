# Supermanager Balaguer

Fantasy bàsquet **mobile-first** del sènior masculí del [Club Bàsquet Balaguer](https://cbbalaguer.cat/) (Noguera, Catalunya). Projecte no oficial: no afiliat a l’ACB, a SuperManager acb ni a Fantasy LaLiga.

## Què pots fer

1. Triar **8 jugadors** del mercat (2 bases, 3 alers, 3 pivots) amb pressupost.
2. Nomenar **capità** (punts ×2, inspirat en Fantasy LaLiga).
3. **Confirmar** l’alineació i **simular la jornada** (valoració + bonus +20% si hi ha victòria, inspirat en SuperManager ACB).
4. Veure **classificació** d’una lliga amics local (rivals mock a `localStorage`).

Estats coberts: mercat buit, carregant partida, error de càrrega / confirmació.

## Com executar

```bash
npm install
npm run dev
```

Obre [http://127.0.0.1:4317](http://127.0.0.1:4317) (port poc habitual; bind a `0.0.0.0`).

```bash
npm run build
npm start -- -p 4317
```

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · `localStorage` (sense auth ni DB).

## Qualitat de la plantilla

- **Documentats**: noms de jugadors del sènior CBB apareguts a Ràdio Balaguer (Nit de l’Esport) i actes públiques (p. ex. CB Cappont 2018). Nombres i posicions assignats per al joc quan no constaven.
- **Placeholders** (etiquetats a la UI): Nil Riera, Gerard Valls, Pau Soler — inventats per completar el mercat.
- **Adrià Ortiz**: documentat com a **entrenador** del sènior (setembre 2026, Ràdio Balaguer); no s’inclou com a jugador actiu.
- L’FCBQ (`basquetcatala.cat`) i `cbbalaguer.cat` bloquejen l’accés automatitzat (reCAPTCHA / Cloudflare); no s’ha pogut baixar la plantilla oficial 2025/26–2026/27.

Detall de fonts: vegeu el resum de recerca del projecte a Context/`internal/balaguer-fantasy-research.md`.

## Normes del joc (resum)

| Element | Regla |
| --- | --- |
| Pressupost | 90.000 € |
| Alineació | 8 jugadors: 2 B / 3 A / 3 P |
| Capità | ×2 punts |
| Puntuació | valoració simulada (± variància); +20% si l’equip guanya i la valoració > 0 |
| Persistència | `localStorage` clau `supermanager-balaguer-v1` |

## Copy

Interfície en **català**.
