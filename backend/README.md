# Kaiju Response Platform

Plateforme de coordination des secours de Tokyork pendant une attaque de kaiju.
Backend FastAPI + PostgreSQL, frontend servi par nginx, le tout sous Docker Compose.

## Prerequis

- Docker Engine 24+ et Docker Compose v2 (`docker compose version`)
- Git
- Python 3.11+ uniquement pour lancer les tests hors conteneur

## Installation

```bash
git clone <url-du-depot>
cd B-SPE-331-LIL-3-1-kaiju-1
cp .env.example .env
```

Ouvrez `.env` et remplissez les valeurs. La cle de signature des jetons doit etre
generee aleatoirement :

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

| Variable | Role |
|---|---|
| `POSTGRES_USER` | utilisateur PostgreSQL |
| `POSTGRES_PASSWORD` | mot de passe PostgreSQL |
| `POSTGRES_DB` | nom de la base |
| `SECRET_KEY` | cle de signature des jetons JWT — obligatoire, l'API refuse de demarrer sans elle |
| `DEMO_PASSWORD` | mot de passe des comptes de demonstration ; vide = aucun compte cree |
| `CORS_ORIGINS` | URL du frontend autorisee a appeler l'API |
| `TRAVEL_SECONDS` | duree de base d'un trajet (30 par defaut) ; doublee par la route maritime |
| `BLOCK_SECONDS` | duree de coupure des routes apres une catastrophe (120 par defaut) |
| `DISASTER_EVERY_SECONDS` | intervalle des catastrophes automatiques ; **0 = desactive**, valeur a garder pour les tests |

`.env` n'est jamais commite : il contient des secrets. En deploiement, ces variables
sont saisies dans l'interface de l'hebergeur.

## Lancement

```bash
docker compose up --build
```

- API : http://localhost:3000
- Documentation interactive (Swagger) : http://localhost:3000/docs
- Frontend : http://localhost:8080

Au premier demarrage, l'API cree les tables (`schema.sql` puis `fix.sql`) et les
comptes de demonstration. Pour repartir d'une base vierge :

```bash
docker compose down -v
docker compose up --build
```

## Comptes de demonstration

Mot de passe : la valeur de `DEMO_PASSWORD`.

| Email | Role | Quartier |
|---|---|---|
| `gauthier@kaiju.gov` | QC (Quarter Coordinator) | Apex |
| `illann@kaiju.gov` | LC (Logistics Coordinator) | — |
| `lois@kaiju.gov` | CD (City Director) | — |

L'inscription publique (`POST /register`) cree toujours un QC : les roles LC et CD
ne peuvent pas etre auto-attribues.

## Tests

Tests de bout en bout (pytest + TestClient de FastAPI) contre une vraie base
PostgreSQL. Chaque test repart d'une base vierge, il faut donc une base dediee.

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE kaiju_test;"

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

DB_HOST=localhost DB_NAME=kaiju_test DB_PASSWORD=<POSTGRES_PASSWORD> \
SECRET_KEY=test-secret DEMO_PASSWORD=password123 DISASTER_EVERY_SECONDS=0 pytest -v
```

Ne lancez jamais les tests sur la base `kaiju` : ils la videraient. Gardez
`DISASTER_EVERY_SECONDS=0`, sinon une catastrophe aleatoire peut fausser un test.

Une collection Postman est egalement fournie dans `postman/`.

## Structure

```
backend/     API FastAPI, schema SQL, tests
frontend/    interface web
docs/        description des routes, diagramme entite-relation
docker-compose.yml
```

## Regles implementees

Tirees de `kaiju-rules.pdf` v1.1 :

- 5 quartiers, 7 corridors (A–E, A–W, A–X, E–X, W–X, W–Z, X–Z). Echo et Zion ne sont pas voisins.
- Retention de 30 % du stock initial, arrondi au superieur ; 15 % pour le City Director au niveau 5.
- Matrice des permissions par role et par niveau de crise (1 a 5).
- Un QC n'agit que pour son propre quartier ; seuls un LC ou le CD organisent un transit.
- Route maritime reservee a deux quartiers ayant tous deux un acces a la mer, avec delai double.
- Transit par un quartier voisin de la source et de la cible, soumis a son accord explicite.
- Priorite aux voisins : un transfert lointain est refuse si un voisin de la cible peut fournir.
- Priorite de Xeno : pas de transit par Xeno tant que Xeno est sous son propre seuil.
- WebSockets : mises a jour de ressources, conflits, alertes de niveau, catastrophes.

## Extensions au-dela du sujet

Le sujet ne decrit pas ces mecaniques ; ce sont nos choix.

**Temps de trajet.** Une ressource n'arrive pas instantanement : le stock quitte la
source au depart et n'est credite a la cible qu'apres `TRAVEL_SECONDS` secondes,
doublees par la route maritime. Les livraisons arrivees sont finalisees a la
prochaine lecture ou ecriture de stock, sans tache de fond.

**Catastrophes naturelles.** Cinq types, chacun detruisant une part des ressources
d'un quartier et coupant ou non ses routes pendant `BLOCK_SECONDS` secondes :

| Type | Destruction | Coupe les routes |
|---|---|---|
| `kaiju_attack` | 30 % | oui |
| `tsunami` | 25 % | oui |
| `earthquake` | 20 % | oui |
| `fire` | 15 % | non |
| `flood` | 10 % | non |

Une route coupee disparait des calculs d'adjacence : le quartier isole n'est plus
joignable et ne compte plus comme fournisseur possible.

## Choix techniques

- Le role et le niveau de crise ne sont jamais lus dans la requete du client : le jeton porte l'identite, le role est relu en base a chaque appel, et le niveau vient de la table `game_state`.
- Le seuil de retention est verifie dans la clause `WHERE` de l'`UPDATE`, donc deux transferts simultanes ne peuvent pas passer sous le seuil.
- Un transfert avec quartier intermediaire est enregistre en `pending` ; le stock ne bouge qu'a l'approbation.
- Toute la configuration passe par des variables d'environnement : le meme code tourne en local et en production.