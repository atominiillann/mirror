# Guide d'installation complet

Ce guide part d'une machine vierge et va jusqu'a l'application qui tourne. Suivez
la section qui correspond a votre systeme, puis reprenez au chapitre « Recuperer
le projet ».

---

## 1. Git

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install -y git
git --version
```

### Windows

Telechargez Git pour Windows sur https://git-scm.com/download/win, puis installez
avec les options par defaut. Utilisez ensuite le terminal « Git Bash ».

### macOS

```bash
xcode-select --install
git --version
```

Configurez votre identite une fois pour toutes :

```bash
git config --global user.name "Prenom Nom"
git config --global user.email "prenom.nom@epitech.eu"
```

---

## 2. Docker et Docker Compose

C'est le seul outil reellement indispensable : la base de donnees, l'API et le
frontend tournent tous dans des conteneurs.

### Ubuntu / Debian

Desinstallez d'abord les anciennes versions qui entrent en conflit :

```bash
for p in docker.io docker-doc docker-compose podman-docker containerd runc; do
  sudo apt remove -y $p
done
```

Ajoutez le depot officiel Docker :

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
| sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
```

Installez Docker Engine et le plugin Compose :

```bash
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Pour utiliser Docker sans `sudo` :

```bash
sudo usermod -aG docker $USER
newgrp docker
```

Verifiez :

```bash
docker --version
docker compose version
docker run --rm hello-world
```

### Windows

1. Activez WSL 2 dans un PowerShell administrateur : `wsl --install`, puis redemarrez.
2. Installez Docker Desktop depuis https://www.docker.com/products/docker-desktop
3. Dans Docker Desktop → Settings → General, cochez « Use the WSL 2 based engine ».
4. Travaillez depuis un terminal Ubuntu (WSL), pas depuis PowerShell : les chemins
   et les fins de ligne posent moins de problemes.

### macOS

Installez Docker Desktop depuis https://www.docker.com/products/docker-desktop en
choisissant la version correspondant a votre processeur (Apple Silicon ou Intel).

**Docker Desktop doit etre lance avant toute commande `docker`.** C'est l'erreur la
plus frequente sous Windows et macOS : `Cannot connect to the Docker daemon`
signifie simplement que l'application n'est pas demarree.

---

## 3. Node.js, via nvm

Necessaire uniquement pour travailler sur le frontend hors conteneur. Docker
compile deja le frontend au build, donc cette etape est facultative pour
simplement lancer le projet.

`nvm` permet d'installer plusieurs versions de Node et de basculer entre elles,
sans droits administrateur.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

Rechargez votre terminal, ou :

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

Installez Node :

```bash
nvm install --lts
nvm use --lts
node --version
npm --version
```

Sous Windows, installez plutot `nvm-windows` depuis
https://github.com/coreybutler/nvm-windows/releases

---

## 4. Python

Necessaire uniquement pour lancer la suite de tests hors conteneur.

### Ubuntu / Debian

```bash
sudo apt install -y python3 python3-pip python3-venv
python3 --version
```

Ubuntu interdit d'installer des paquets Python a l'echelle du systeme (erreur
`externally-managed-environment`). Il faut donc toujours passer par un
environnement virtuel, decrit plus bas.

### Windows / macOS

Telechargez Python 3.11 ou plus recent sur https://www.python.org/downloads/
Sous Windows, cochez « Add Python to PATH » pendant l'installation.

---

## 5. Recuperer le projet

```bash
git clone <url-du-depot>
cd B-SPE-331-LIL-3-1-kaiju-1
```

---

## 6. Configurer les variables d'environnement

Aucun mot de passe n'est ecrit dans le code : tout passe par un fichier `.env`,
qui n'est pas commite.

```bash
cp .env.example .env
```

Generez une cle de signature des jetons :

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Ouvrez `.env` et remplissez au minimum `POSTGRES_PASSWORD`, `SECRET_KEY` et
`DEMO_PASSWORD`. Le detail de chaque variable est dans le README.

Sans `SECRET_KEY`, l'API refuse volontairement de demarrer : mieux vaut une erreur
franche qu'une application qui tourne avec une cle vide.

---

## 7. Lancer l'application

```bash
docker compose up --build
```

Le premier lancement telecharge les images et compile le frontend : comptez
quelques minutes. Les suivants sont quasi instantanes.

- API : http://localhost:3000
- Swagger : http://localhost:3000/docs
- Frontend : http://localhost:8080

Pour lancer en arriere-plan : `docker compose up -d`. Pour suivre les journaux :
`docker compose logs -f backend`. Pour tout arreter : `docker compose down`.

Verifiez que l'API repond :

```bash
curl http://localhost:3000/crisis-level
```

---

## 8. Lancer les tests

Les tests vident la base avant chaque cas : ils doivent viser une base dediee,
jamais `kaiju`.

```bash
docker compose exec db psql -U postgres -c "CREATE DATABASE kaiju_test;"

cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r requirements.txt

DB_HOST=localhost DB_NAME=kaiju_test DB_PASSWORD=<POSTGRES_PASSWORD> \
SECRET_KEY=test-secret DEMO_PASSWORD=password123 DISASTER_EVERY_SECONDS=0 pytest -v
```

Pour sortir de l'environnement virtuel : `deactivate`.

---

## 9. Collection Postman (facultatif)

Installez Postman :

```bash
sudo snap install postman
```

ou telechargez-le sur https://www.postman.com/downloads/

Import → glissez `postman/Kaiju.postman_collection.json`. Verifiez les variables de
la collection (`baseUrl`, `demoPassword`), puis lancez la collection entiere avec
« Run collection ».

---

## Depannage

| Message | Cause | Solution |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker n'est pas demarre | Lancez Docker Desktop, ou `sudo systemctl start docker` |
| `permission denied` sur `/var/run/docker.sock` | utilisateur hors du groupe docker | `sudo usermod -aG docker $USER` puis reconnexion |
| `port is already allocated` | un autre service occupe 3000, 5432 ou 8080 | arretez-le, ou changez le port dans `.env` |
| `KeyError: 'SECRET_KEY'` | variable absente | remplissez `.env`, puis `docker compose up -d --force-recreate backend` |
| `relation "users" does not exist` | base vide | `docker compose down -v` puis `docker compose up --build` |
| `externally-managed-environment` | pip hors environnement virtuel | creez un venv, voir le chapitre 8 |
| `command not found: pytest` | environnement virtuel non active | `source .venv/bin/activate` |
| Le code modifie ne change rien | l'image Docker est l'ancienne | `docker compose up --build -d backend` (un simple `restart` ne suffit pas) |
| Erreurs CORS dans la console du navigateur | `CORS_ORIGINS` ne contient pas l'URL du frontend | corrigez `.env` et recreez le conteneur |