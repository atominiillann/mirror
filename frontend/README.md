# Kaiju — Crisis Manager (front)

Frontend React + Vite (TypeScript) de la plateforme de réponse Kaiju : carte interactive de Tokyork,
niveaux de catastrophe par quartier, inventaire des ressources et matrice de permissions rôle × niveau.

## Démarrage

```bash
nvm use            # Node 22 (voir .nvmrc)
npm install
npm run dev        # http://localhost:5173
npm run build
npm run lint
```

## Contenu

- `src/data/mapPaths.ts` — tracés vectoriels des 5 quartiers + baie de Tokyork, vectorisés depuis la
  carte officielle fournie avec le sujet.
- `src/data/city.ts` — modèle métier issu de l'annexe de règles : quartiers, adjacence, route maritime,
  stocks initiaux, seuil de rétention (30 % / 15 %), niveaux 1→5, matrice de permissions.
- `src/components/TokyorkMap.tsx` — carte SVG interactive : survol, sélection clavier/souris, coloration
  par sévérité ou par quartier, corridors terrestres et lanes maritimes, pulsation des quartiers en
  niveau ≥ 4.
- `src/components/QuarterPanel.tsx` — détail du quartier sélectionné : ressources avec part retenue /
  transférable, description du niveau, actions autorisées ou refusées pour le rôle courant.

## À brancher sur le back

Les données sont pour l'instant statiques (`src/data/city.ts`). Points d'intégration prévus :

- `GET /quarters` + `GET /resources` → remplacer `QUARTERS`.
- `PATCH /disaster-level` → `setQuarterLevel` dans `App.tsx`.
- WebSocket (`resource.updated`, `transfer.conflict`, `level.changed`) → mise à jour du state `severity`
  et des stocks, la carte se re-rend automatiquement.

Les règles d'adjacence, rétention et permissions sont dupliquées côté front uniquement pour l'affichage
et le grisage des actions : l'autorité reste le serveur.
