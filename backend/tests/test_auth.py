"""
SentinelAI - Tests for Authentication Service, Endpoints & Security
Validates seeded demo credentials, Argon2id password verification,
JWT access token issuance, invalid credential handling, and malformed email rejection.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth.security import hash_password, verify_password


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture."""
    return TestClient(app)


def test_password_hashing_and_verification():
    """Verify that password hashing and verification functions correctly with Argon2id."""
    password = "SentinelTestPassword2026!"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_login_success_administrator(client):
    """Test successful authentication with configured administrator credentials."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@sentinelai.internal",
            "password": "SentinelAdmin2026!",
        },
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0
    assert "user" in data
    assert data["user"]["email"] == "admin@sentinelai.internal"
    assert data["user"]["role"] == "ADMIN"
    assert data["user"]["is_active"] is True


def test_login_success_analyst(client):
    """Test successful authentication with configured security analyst credentials."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "analyst@sentinelai.internal",
            "password": "SentinelAnalyst2026!",
        },
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "user" in data
    assert data["user"]["email"] == "analyst@sentinelai.internal"
    assert data["user"]["is_active"] is True


def test_login_failed_invalid_password(client):
    """Test rejection when submitting an incorrect password for an existing account."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "admin@sentinelai.internal",
            "password": "IncorrectPassword123!",
        },
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json().get("detail", "")


def test_login_failed_unknown_email(client):
    """Test rejection when submitting an unprovisioned enterprise email."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "nonexistent.user@sentinelai.internal",
            "password": "SentinelPassword2026!",
        },
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json().get("detail", "")


def test_login_rejects_malformed_concatenated_email(client):
    """
    Test that submitting a concatenated email (e.g. in@sentinelai.internaladmin@sentinelai.internal)
    fails request schema validation with 422 Unprocessable Entity.
    """
    response = client.post(
        "/api/auth/login",
        json={
            "email": "in@sentinelai.internaladmin@sentinelai.internal",
            "password": "SentinelAdmin2026!",
        },
    )
    assert response.status_code == 422, "Pydantic EmailStr should reject multi-@ concatenated emails"


def test_auth_me_with_valid_bearer_token(client):
    """Test accessing current user profile with valid JWT bearer token."""
    login_resp = client.post(
        "/api/auth/login",
        json={
            "email": "admin@sentinelai.internal",
            "password": "SentinelAdmin2026!",
        },
    )
    token = login_resp.json()["access_token"]

    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    user_data = me_resp.json()
    assert user_data["email"] == "admin@sentinelai.internal"
    assert user_data["role"] == "ADMIN"


def test_auth_me_unauthorized_without_token(client):
    """Test rejection when accessing /api/auth/me without authentication or cookies."""
    fresh_client = TestClient(app)
    response = fresh_client.get("/api/auth/me")
    assert response.status_code == 401
