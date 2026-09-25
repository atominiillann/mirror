import os
import psycopg2
import bcrypt
import random
import math
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import FastAPI, HTTPException, status, WebSocket, WebSocketDisconnect, Depends, Header
from pydantic import BaseModel, Field
from security import verify_password, check_permission
from rules import validate_retention_threshold, validate_route_and_transit, check_disaster_level, check_xeno_priority
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone

SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

app = FastAPI()

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_NAME = os.getenv("DB_NAME", "kaiju")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD")
# Duree trajet. Double pour route maritime
TRAVEL_SECONDS = int(os.getenv("TRAVEL_SECONDS", "30"))
# Duree de coupure des routes apres une catastrophe
BLOCK_SECONDS = int(os.getenv("BLOCK_SECONDS", "120"))
# type de catastrophe
CATASTROPHES = {
    "kaiju_attack": (0.30, True),
    "earthquake":   (0.20, True),
    "tsunami":      (0.25, True),
    "fire":         (0.15, False),
    "flood":        (0.10, False),
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:8080").split(","),
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

def livrer_les_transferts_arrives(cursor):
    cursor.execute(
        "UPDATE transfers SET status = 'done' "
        "WHERE status = 'in_transit' AND arrives_at <= now() "
        "RETURNING resource_name, quantity, target_code"
    )
    for ressource, quantite, cible in cursor.fetchall():
        cursor.execute(
            "UPDATE neighborhood_resources SET current_quantity = current_quantity + %s "
            "WHERE district_code = %s AND resource_name = %s",
            (quantite, cible, ressource)
        )

def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant ou invalide.")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide ou expire.")

    # un compte supprime ou change de role perd ses droits immediatement.
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT email, role, neighborhood_code FROM users WHERE email = %s", (email,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Compte introuvable.")
    return {"email": user[0], "role": user[1], "neighborhood_code": user[2]}

@app.on_event("startup")
def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT to_regclass('public.users')")
    if cursor.fetchone()[0] is None:
        print("Base vide : création des tables...")
        cursor.execute(open("schema.sql").read())
        cursor.execute(open("fix.sql").read())
        conn.commit()
        print("Tables créées.")

    comptes = [
        ("Gauthier (QC Apex)", "gauthier@kaiju.gov", "QC", "A"),
        ("Illann (Logistics)", "illann@kaiju.gov", "LC", None),
        ("Loïs (City Director)", "lois@kaiju.gov", "CD", None),
    ]
    for name, email, role, quartier in comptes:
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if not cursor.fetchone():
            hashed = bcrypt.hashpw(DEMO_PASSWORD.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor.execute(
                "INSERT INTO users (name, email, password_hash, neighborhood_code, role) "
                "VALUES (%s, %s, %s, %s, %s)",
                (name, email, hashed, quartier, role)
            )
    conn.commit()

    cursor.close()
    conn.close()

class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    neighborhood_code: str

@app.post("/register")
def register_user(user: UserCreate):
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), salt).decode('utf-8')

    role_assigne = "QC"
            
    conn = get_db_connection() 
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash, neighborhood_code, role) 
            VALUES (%s, %s, %s, %s, %s) RETURNING id;
            """,
            (user.name, user.email, hashed_password, user.neighborhood_code, role_assigne)
        )
        new_user_id = cursor.fetchone()[0]
        conn.commit()
        return {"message": "Compte créé avec succès", "id": new_user_id, "role": role_assigne}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Erreur lors de l'inscription. Cet email est peut-être déjà utilisé.")
    finally:
        cursor.close()
        conn.close()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

class LoginRequest(BaseModel):
    username: str
    password: str

class TransferRequest(BaseModel):
    resource_type: str
    quantity: int = Field(gt=0, description="La quantité doit être supérieure à 0")
    source_quarter: str
    target_quarter: str
    use_sea_route: bool = False
    intermediary: str = None

@app.get("/")
def read_root():
    return {"status": "Kaiju API operational"}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.post("/login", status_code=status.HTTP_200_OK)
def login(data: LoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash, role, neighborhood_code FROM users WHERE email = %s", (data.username,))
    user = cursor.fetchone()
    cursor.close()
    conn.close()
    if not user or not verify_password(data.password, user[0]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed: invalid credentials."
        )
    stored_password_hash, role, neighborhood_code = user

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": data.username, "role": role, "neighborhood_code": neighborhood_code}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": data.username,
        "role": role,
        "neighborhood_code": neighborhood_code
    }

@app.get("/resources")
def get_resources(quarter: str = None):
    conn = get_db_connection()
    cursor = conn.cursor()
    livrer_les_transferts_arrives(cursor)
    conn.commit()
    if quarter:
        cursor.execute("SELECT district_code, resource_name, initial_quantity, min_retention, current_quantity FROM neighborhood_resources WHERE district_code = %s", (quarter,))
    else:
        cursor.execute("SELECT district_code, resource_name, initial_quantity, min_retention, current_quantity FROM neighborhood_resources")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    resources_list = [
        {
            "district_code": row[0],
            "resource_name": row[1],
            "initial_quantity": row[2],
            "min_retention": row[3],
            "current_quantity": row[4]
        }
        for row in rows
    ]
    return {
        "quarter": quarter or "all",
        "resources": resources_list
    }

@app.post("/transfers", status_code=status.HTTP_201_CREATED)
async def create_transfer(
    transfer: TransferRequest, 
    current_user: dict = Depends(get_current_user),
):
    user_role = current_user["role"]
    user_neighborhood = current_user.get("neighborhood_code")
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM game_state WHERE key = 'crisis_level'")
    row = cursor.fetchone()
    disaster_level = row[0] if row else 1

    # Les quartiers sont voisins ? 
    cursor.execute(
        "SELECT 1 FROM neighborhood_connections WHERE neighborhood_code_1 = %s AND neighborhood_code_2 = %s "
        "AND (blocked_until IS NULL OR blocked_until <= now())",
        (transfer.source_quarter, transfer.target_quarter)
    )
    is_adjacent = cursor.fetchone() is not None

    if transfer.source_quarter == transfer.target_quarter:
        action = "reserve_local"
    elif is_adjacent:
        action = "request_adjacent"
    else:
        action = "organize_transit"

    allowed, message, code = check_permission(
        user_role=user_role,
        action=action,
        disaster_level=disaster_level,
        source_quarter=transfer.source_quarter,
        target_quarter=transfer.target_quarter,
        user_neighborhood=user_neighborhood
    )
    if not allowed:
        cursor.close()
        conn.close()
        await manager.broadcast({"event": "transfer_denied", "reason": message, "user": current_user["email"]})
        raise HTTPException(status_code=code, detail=message)

    cursor.execute("SELECT current_quantity, min_retention FROM neighborhood_resources WHERE district_code = 'X' AND resource_name = %s", (transfer.resource_type,))
    xeno_res = cursor.fetchone()
    xeno_needs_help = xeno_res is not None and xeno_res[0] < xeno_res[1]
    xeno_valid, xeno_msg = check_xeno_priority(transfer.source_quarter, transfer.target_quarter, transfer.intermediary, xeno_needs_help)
    if not xeno_valid:
        cursor.close()
        conn.close()
        await manager.broadcast({"event": "transfer_conflict", "reason": xeno_msg})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=xeno_msg)

    cursor.execute(
        "SELECT initial_quantity, current_quantity FROM neighborhood_resources WHERE district_code = %s AND resource_name = %s",
        (transfer.source_quarter, transfer.resource_type)
    )
    source_res = cursor.fetchone()
    if not source_res:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Source resource not found.")
    initial_qty, current_qty = source_res

    valid_retention, ret_msg = validate_retention_threshold(
        initial_qty, current_qty, transfer.quantity, user_role, disaster_level
    )
    if not valid_retention:
        cursor.close()
        conn.close()
        await manager.broadcast({"event": "transfer_conflict", "reason": ret_msg})
        raise HTTPException(status_code=422, detail=ret_msg)

    if not is_adjacent:
        cursor.execute(
            """
            SELECT nr.district_code FROM neighborhood_resources nr
            JOIN neighborhood_connections nc ON nc.neighborhood_code_1 = %s AND nc.neighborhood_code_2 = nr.district_code
               AND (nc.blocked_until IS NULL OR nc.blocked_until <= now())
            WHERE nr.resource_name = %s AND nr.current_quantity - nr.min_retention >= %s
            """,
            (transfer.target_quarter, transfer.resource_type, transfer.quantity)
        )
        neighbor_has_stock = cursor.fetchone()
        if neighbor_has_stock:
            cursor.close()
            conn.close()
            err_msg = "Violation de la règle de priorité aux voisins : un quartier voisin direct dispose de la ressource requise."
            await manager.broadcast({"event": "transfer_conflict", "reason": err_msg})
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    cursor.execute("SELECT code FROM neighborhood WHERE sea_access = TRUE")
    sea_access_list = [row[0] for row in cursor.fetchall()]

    cursor.execute("SELECT neighborhood_code_1, neighborhood_code_2 FROM neighborhood_connections "
                   "WHERE blocked_until IS NULL OR blocked_until <= now()")
    connections = cursor.fetchall()

    route_result = validate_route_and_transit(
        transfer.source_quarter, transfer.target_quarter, is_adjacent, sea_access_list,
        transfer.use_sea_route, transfer.intermediary, connections
    )
    valid_route, route_msg, multiplicateur = route_result

    if not valid_route:
        cursor.close()
        conn.close()
        await manager.broadcast({"event": "transfer_conflict", "reason": route_msg})
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=route_msg)

    # rien ne bouge si quartier intermediaire ne donne pas son accord
    if transfer.intermediary:
        cursor.execute("SELECT id FROM users WHERE email = %s", (current_user["email"],))
        demandeur_id = cursor.fetchone()[0]
        cursor.execute(
            "INSERT INTO transfers (resource_name, quantity, source_code, target_code, intermediary_code, status, requested_by) "
            "VALUES (%s, %s, %s, %s, %s, 'pending', %s) RETURNING id",
            (transfer.resource_type, transfer.quantity, transfer.source_quarter,
             transfer.target_quarter, transfer.intermediary, demandeur_id)
        )
        transfer_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        await manager.broadcast({"event": "transfer_pending", "id": transfer_id,
                                 "intermediary": transfer.intermediary})
        return {"status": "pending", "id": transfer_id,
                "message": f"En attente de l'accord du quartier {transfer.intermediary}."}
    
    seuil = 0.15 if (user_role == "CD" and disaster_level == 5) else 0.30
    min_requis = math.ceil(initial_qty * seuil)
    cursor.execute(
        "UPDATE neighborhood_resources SET current_quantity = current_quantity - %s "
        "WHERE district_code = %s AND resource_name = %s AND current_quantity - %s >= %s",
        (transfer.quantity, transfer.source_quarter, transfer.resource_type, transfer.quantity, min_requis)
    )
    if cursor.rowcount == 0:
        conn.rollback()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=422, detail="Stock insuffisant : le seuil de rétention serait franchi.")
    
    # la cible sera creditee a l'arrivee du convoi
    duree = int(TRAVEL_SECONDS * multiplicateur)
    cursor.execute(
        "INSERT INTO transfers (resource_name, quantity, source_code, target_code, status, requested_by, arrives_at) "
        "VALUES (%s, %s, %s, %s, 'in_transit', NULL, now() + (%s || ' seconds')::interval)",
        (transfer.resource_type, transfer.quantity, transfer.source_quarter, transfer.target_quarter, duree)
    )
    conn.commit()
    cursor.close()
    conn.close()

    await manager.broadcast({"event": "transfer_departed", "resource": transfer.resource_type,
                             "source": transfer.source_quarter, "target": transfer.target_quarter})
    return {"status": "in_transit", "travel_seconds": duree}

@app.patch("/crisis-level", status_code=status.HTTP_200_OK)
async def update_crisis_level(level: int, current_user: dict = Depends(get_current_user)):
    valid, message = check_disaster_level(level, "heavy_transfer")
    if current_user["role"] != "CD":
        raise HTTPException(status_code=403, detail="Seul le City Director peut changer le niveau de crise.")
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=message)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO game_state (key, value) VALUES ('crisis_level', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
        """,
        (level,)
    )
    conn.commit()
    cursor.close()
    conn.close()

    await manager.broadcast({
        "event": "crisis_level_alert",
        "level": level
    })
    return {"message": f"Crisis level updated to {level}"}

@app.get("/crisis-level")
def get_crisis_level():
    conn = get_db_connection()
    cursor = conn.cursor()
    livrer_les_transferts_arrives(cursor)
    conn.commit()
    cursor.execute("SELECT value FROM game_state WHERE key = 'crisis_level'")
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return {"level": row[0] if row else 1}

@app.post("/transfers/{transfer_id}/approve")
async def approve_transfer(transfer_id: int, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    livrer_les_transferts_arrives(cursor)
    cursor.execute(
        "SELECT resource_name, quantity, source_code, target_code, intermediary_code, status "
        "FROM transfers WHERE id = %s", (transfer_id,)
    )
    row = cursor.fetchone()
    if not row or row[5] != "pending":
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Transfert introuvable ou deja traite.")
    ressource, quantite, source, cible, intermediaire, _ = row

    # Que QC ou CD peut donner l'accord
    if not (current_user["role"] == "CD" or current_user["neighborhood_code"] == intermediaire):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=403, detail=f"Seul le QC de {intermediaire} ou le CD peut approuver.")

    cursor.execute(
        "UPDATE neighborhood_resources SET current_quantity = current_quantity - %s "
        "WHERE district_code = %s AND resource_name = %s AND current_quantity - %s >= min_retention",
        (quantite, source, ressource, quantite)
    )
    if cursor.rowcount == 0:
        conn.rollback()
        cursor.close()
        conn.close()
        raise HTTPException(status_code=422, detail="Stock insuffisant : le seuil de retention serait franchi.")

    cursor.execute(
        "UPDATE neighborhood_resources SET current_quantity = current_quantity + %s "
        "WHERE district_code = %s AND resource_name = %s",
        (quantite, cible, ressource)
    )
    cursor.execute("UPDATE transfers SET status = 'done' WHERE id = %s", (transfer_id,))
    conn.commit()
    cursor.close()
    conn.close()

    await manager.broadcast({"event": "resource_update", "resource": ressource,
                             "source": source, "target": cible, "quantity": quantite})
    return {"status": "success", "id": transfer_id}

class DisasterRequest(BaseModel):
    type: str
    district: str


@app.post("/disasters", status_code=201)
async def declencher_catastrophe(d: DisasterRequest, current_user: dict = Depends(get_current_user)):
    """Declenche une catastrophe sur un quartier. City Director uniquement."""
    if current_user["role"] != "CD":
        raise HTTPException(status_code=403, detail="Seul le City Director peut declencher une catastrophe.")
    if d.type not in CATASTROPHES:
        raise HTTPException(status_code=400, detail=f"Type inconnu. Types possibles : {', '.join(CATASTROPHES)}.")
    part_detruite, coupe_les_routes = CATASTROPHES[d.type]

    conn = get_db_connection()
    cursor = conn.cursor()
    # Une partie des ressources du quartier detruite
    cursor.execute(
        "UPDATE neighborhood_resources SET current_quantity = current_quantity - floor(current_quantity * %s) "
        "WHERE district_code = %s RETURNING floor(current_quantity * %s)",
        (part_detruite, d.district, part_detruite)
    )
    pertes = sum(int(r[0]) for r in cursor.fetchall())

    # Les routes sont coupees pendant un moment
    if coupe_les_routes:
        cursor.execute(
            "UPDATE neighborhood_connections SET blocked_until = now() + (%s || ' seconds')::interval "
            "WHERE neighborhood_code_1 = %s OR neighborhood_code_2 = %s",
            (BLOCK_SECONDS, d.district, d.district)
        )
    conn.commit()
    cursor.close()
    conn.close()

    await manager.broadcast({"event": "disaster", "type": d.type, "district": d.district,
                             "losses": pertes, "blocked_seconds": BLOCK_SECONDS if coupe_les_routes else 0})
    return {"type": d.type, "district": d.district, "losses": pertes}