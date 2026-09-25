import os
import psycopg2
import pytest
from fastapi.testclient import TestClient
from app import app, get_db_connection

MDP = os.environ["DEMO_PASSWORD"]


@pytest.fixture
def client():
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    cursor.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
    conn.close()
    with TestClient(app) as c:
        yield c


def token(client, email):
    r = client.post("/login", json={"username": email, "password": MDP})
    assert r.status_code == 200, r.text
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def niveau(client, n):
    r = client.patch(f"/crisis-level?level={n}", headers=token(client, "lois@kaiju.gov"))
    assert r.status_code == 200, r.text


def transfert(client, headers, **kw):
    body = {"resource_type": "Hazmat equipment", "quantity": 1}
    body.update(kw)
    return client.post("/transfers", json=body, headers=headers)



def test_donnees(client):
    res = client.get("/resources").json()["resources"]
    assert len(res) == 50
    valeurs = {(r["district_code"], r["resource_name"]): r for r in res}
    assert valeurs[("X", "Medical personnel")]["initial_quantity"] == 3
    assert valeurs[("Z", "Hazmat equipment")]["initial_quantity"] == 10
    assert valeurs[("A", "Medical personnel")]["min_retention"] == 4   

def test_seuil_retention(client):
    niveau(client, 3)
    # Echo 5 Hazmat et doit en garder 2 : 3 transferables pas 4
    h = token(client, "gauthier@kaiju.gov")
    assert transfert(client, h, source_quarter="E", target_quarter="A", quantity=4).status_code == 422
    assert transfert(client, h, source_quarter="E", target_quarter="A", quantity=3).status_code == 201

def testcd_descend_15_pourcent_niveau_5(client):
    niveau(client, 5)
    # Zion 10 Hazmat : 8 transferables a 15 %, seulement 7 a 30 %
    r = transfert(client, token(client, "lois@kaiju.gov"), source_quarter="Z", target_quarter="X", quantity=8)
    assert r.status_code == 201

def test_niveau1_bloque_transfert(client):
    r = transfert(client, token(client, "gauthier@kaiju.gov"), source_quarter="E", target_quarter="A")
    assert r.status_code == 403

def testqc_pas_transit(client):
    niveau(client, 4)
    r = transfert(client, token(client, "gauthier@kaiju.gov"), source_quarter="Z", target_quarter="E",
                  use_sea_route=True)
    assert r.status_code == 403

def test_echo_et_zion_ne_sont_pas_voisins(client):
    niveau(client, 4)
    r = transfert(client, token(client, "illann@kaiju.gov"), source_quarter="Z", target_quarter="E", quantity=4)
    assert r.status_code == 400

def test_route_maritime_exige_deux_quartiers_cotiers(client):
    niveau(client, 4)
    # Apex n'a pas d'acces a la mer
    r = transfert(client, token(client, "illann@kaiju.gov"), source_quarter="Z", target_quarter="A",
                  use_sea_route=True)
    assert r.status_code == 400

def test_intermediaire_doit_etre_voisin_des_deux(client):
    niveau(client, 4)
    h = token(client, "illann@kaiju.gov")
    # Warden n'est pas voisin d'Echo : mauvais intermediaire
    assert transfert(client, h, source_quarter="Z", target_quarter="E", quantity=4,
                     intermediary="W").status_code == 400
    # Xeno est voisin de Zion ET d'Echo : transit valide
    assert transfert(client, h, source_quarter="Z", target_quarter="E", quantity=4,
                     intermediary="X").status_code == 201

def test_priorite_aux_voisins(client):
    niveau(client, 4)
    h = token(client, "illann@kaiju.gov")
    # Apex, voisin d'Echo, peut fournir 1 Hazmat : interdit d'aller le chercher a Zion
    assert transfert(client, h, source_quarter="Z", target_quarter="E", use_sea_route=True).status_code == 400
    # Aucun voisin d'Echo ne peut fournir 4 Hazmat : la route maritime devient legitime
    assert transfert(client, h, source_quarter="Z", target_quarter="E", quantity=4,
                     use_sea_route=True).status_code == 201


def test_seul_le_cd_change_le_niveau(client):
    assert client.patch("/crisis-level?level=3").status_code == 401
    assert client.patch("/crisis-level?level=3", headers=token(client, "gauthier@kaiju.gov")).status_code == 403
    assert client.patch("/crisis-level?level=9", headers=token(client, "lois@kaiju.gov")).status_code == 400
    niveau(client, 3)
    assert client.get("/crisis-level").json() == {"level": 3}

# temps reel
def test_websocket_alerte_de_niveau(client):
    with client.websocket_connect("/ws") as ws:
        niveau(client, 3)
        assert ws.receive_json() == {"event": "crisis_level_alert", "level": 3}

def test_transit_attend_accord_du_quartier_intermediaire(client):
    niveau(client, 4)
    r = transfert(client, token(client, "illann@kaiju.gov"),
                  source_quarter="Z", target_quarter="E", quantity=4, intermediary="X")
    assert r.json()["status"] == "pending"
    tid = r.json()["id"]
    # le QC d'Apex n'est pas le quartier de transit
    assert client.post(f"/transfers/{tid}/approve", headers=token(client, "gauthier@kaiju.gov")).status_code == 403
    # le CD si
    assert client.post(f"/transfers/{tid}/approve", headers=token(client, "lois@kaiju.gov")).status_code == 200