# API Kaiju — description des routes

Base : `http://localhost:3000`. Documentation interactive : `/docs`.

Les routes protegees attendent l'en-tete `Authorization: Bearer <token>`, obtenu
via `POST /login`. Le role et le quartier sont relus en base a chaque appel, jamais
pris dans le corps de la requete.

Roles : **QC** (Quarter Coordinator, un quartier), **LC** (Logistics Coordinator,
multi-quartiers), **CD** (City Director, ville entiere).

---

## Authentification

### `GET /`
Etat de l'API. Public. → `{"status": "Kaiju API operational"}`

### `POST /register`
Cree un compte. Public. Le role attribue est toujours **QC**.

```json
{"name": "Rico", "email": "rico@kaiju.gov", "password": "secret123", "neighborhood_code": "E"}
```

- `200` — compte cree, avec son `id` et son `role`
- `400` — email deja utilise ou code de quartier inconnu

### `POST /login`
Renvoie un jeton valable 60 minutes. Public.

```json
{"username": "lois@kaiju.gov", "password": "..."}
```

- `200` — `access_token`, `token_type`, `username`, `role`, `neighborhood_code`
- `401` — identifiants invalides. Le message est le meme que l'email existe ou non, pour ne pas reveler quels comptes existent.

---

## Consultation

### `GET /resources`
Etat des stocks. Public : la consultation est autorisee a tous les roles et a tous
les niveaux. Parametre optionnel `?quarter=E`.

Chaque ligne : `district_code`, `resource_name`, `initial_quantity`,
`min_retention`, `current_quantity`.

### `GET /crisis-level`
Niveau de crise courant. Public. → `{"level": 3}`

### `GET /calendar`
Calendrier operationnel : catastrophes passees et transferts, avec leurs dates.
Public.

### `GET /disasters`
Historique des catastrophes seules. Public.

---

## Pilotage de la crise

### `PATCH /crisis-level?level=<1-5>`
Change le niveau de crise. **CD uniquement.** Diffuse l'evenement `crisis_level_alert`.

- `200` — niveau mis a jour
- `400` — niveau hors de 1 a 5
- `401` — jeton absent ou invalide
- `403` — l'appelant n'est pas City Director

### `POST /disasters`
Declenche une catastrophe. **CD uniquement.**

```json
{"type": "kaiju_attack", "district": "X"}
```

Detruit une part des ressources du quartier, coupe ses routes selon le type,
enregistre l'evenement et diffuse `disaster`.

- `201` — `{"type": ..., "district": ..., "losses": 12}`
- `400` — type inconnu
- `403` — l'appelant n'est pas City Director

### `POST /reset`
Remet les stocks a leur valeur initiale et retablit toutes les routes. **CD
uniquement.** Utile avant une demonstration. Diffuse `city_reset`.

---

## Transferts

### `POST /transfers`
Demande un transfert. **Authentification requise.**

```json
{
  "resource_type": "Hazmat equipment",
  "quantity": 4,
  "source_quarter": "Z",
  "target_quarter": "E",
  "use_sea_route": false,
  "intermediary": "X"
}
```

`use_sea_route` et `intermediary` ne servent que si les deux quartiers ne sont pas
voisins.

Verifications, dans l'ordre :

1. **Permission** — l'action deduite (`reserve_local`, `request_adjacent` ou `organize_transit`) est confrontee a la matrice du sujet, selon le role et le niveau de crise courant.
2. **Route** — quartiers voisins, ou route maritime entre deux quartiers cotiers, ou quartier intermediaire voisin des deux. Les routes coupees par une catastrophe sont ignorees.
3. **Priorite aux voisins** — refuse si un voisin de la cible peut fournir sans franchir son propre seuil.
4. **Priorite de Xeno** — pas de transit par Xeno tant que Xeno est sous son seuil.
5. **Seuil de retention** — verifie dans l'`UPDATE` lui-meme, donc resistant aux demandes simultanees.

Reponses :

- `201` avec `"status": "in_transit"` et `travel_seconds` — le convoi part ; la source est debitee, la cible sera creditee a l'arrivee. Diffuse `transfer_departed`.
- `201` avec `"status": "pending"` et un `id` — transit en attente de l'accord du quartier intermediaire ; aucun stock n'a bouge. Diffuse `transfer_pending`.
- `400` — route invalide, ou priorite aux voisins non respectee
- `401` — jeton absent ou invalide
- `403` — role insuffisant a ce niveau, ou QC agissant pour un autre quartier
- `404` — ressource inconnue pour le quartier source
- `422` — quantite nulle ou negative, ou seuil de retention franchi

### `POST /transfers/{id}/approve`
Approuve un transit en attente. **QC du quartier intermediaire, ou CD.** Le stock
quitte alors la source et arrive apres le temps de trajet.

- `200` — le convoi part
- `403` — ni QC du quartier de transit, ni CD
- `404` — transfert introuvable
- `409` — transfert deja traite
- `422` — le stock de la source ne permet plus le transfert

### `POST /transfers/{id}/reject`
Refuse un transit en attente. Memes regles d'acces.

---

## WebSocket

`ws://localhost:3000/ws` — diffusion a tous les clients connectes.

| Evenement | Quand | Contenu |
|---|---|---|
| `resource_update` | un convoi arrive a destination | ressource, source, cible, quantite |
| `transfer_departed` | un convoi part | ressource, source, cible |
| `transfer_pending` | un transit attend un accord | id, quartier intermediaire |
| `transfer_denied` | permission refusee | motif |
| `transfer_conflict` | regle metier violee | motif |
| `crisis_level_alert` | le CD change le niveau | niveau |
| `disaster` | catastrophe declenchee | type, quartier, pertes, duree de coupure |
| `city_reset` | remise a zero par le CD | — |