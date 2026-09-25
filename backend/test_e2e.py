from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_read_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "Kaiju API operational"}

def test_get_resources():
    response = client.get("/resources")
    assert response.status_code == 200
    assert "resources" in response.json()

def test_crisis_level_validation():
    response = client.patch("/crisis-level?level=6")
    assert response.status_code == 400

    response = client.patch("/crisis-level?level=3")
    assert response.status_code == 200
    assert response.json() == {"message": "Crisis level updated to 3"}

def test_login_invalid_user():
    response = client.post("/login", json={"username": "wrong@kaiju.gov", "password": "wrongpassword"})
    assert response.status_code == 401