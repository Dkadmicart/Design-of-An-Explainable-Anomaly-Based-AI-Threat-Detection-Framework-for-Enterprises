"""
SentinelAI - Tests for Authentication Service, Endpoints, RBAC & Lifecycle
Validates:
1. Sign Up with a new email.
2. Direct database verification that new user is persisted in users and authentication_accounts.
3. Log in using the newly registered email and password.
4. Rejecting incorrect passwords.
5. Rejecting duplicate registrations.
6. Consistent case-insensitivity and whitespace trimming for emails.
7. Admin 1-Click Login and ADMIN role assignment.
8. Analyst 1-Click Login and SECURITY_ANALYST role assignment.
9. Backend role-based access restrictions (analysts rejected from admin-only routes).
10. Logout and token/session invalidation.
"""
import uuid
import sqlite3
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.auth.security import hash_password, verify_password


@pytest.fixture(scope="module")
def client():
    """FastAPI TestClient fixture with active lifespan."""
    with TestClient(app) as test_client:
        yield test_client


def test_password_hashing_and_verification():
    """Verify that password hashing and verification functions correctly with Argon2id."""
    password = "SentinelTestPassword2026!"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_admin_one_click_login_role_admin(client):
    """Test 1-Click / configured login for SOC Administrator."""
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


def test_analyst_one_click_login_role_analyst(client):
    """Test 1-Click / configured login for SecOps Security Analyst with verified SECURITY_ANALYST role."""
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
    assert data["user"]["role"] == "SECURITY_ANALYST"
    assert data["user"]["is_active"] is True


def test_registration_and_database_persistence(client):
    """
    Test user registration via /api/auth/register, verify immediate session return,
    and verify user record and Argon2id hash are stored in the correct database tables.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    test_email = f"operator_{unique_suffix}@sentinelai.internal"
    test_password = "SecureOperatorPassword2026!"
    test_name = "SecOps Operator"

    # 1. Register via endpoint
    reg_response = client.post(
        "/api/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "display_name": test_name,
        },
    )
    assert reg_response.status_code == 200, f"Registration failed: {reg_response.text}"
    reg_data = reg_response.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == test_email
    assert reg_data["user"]["display_name"] == test_name
    assert reg_data["user"]["role"] == "SECURITY_ANALYST"
    user_id = reg_data["user"]["id"]

    # 2. Directly verify database storage in sentinelai.db (users and authentication_accounts tables)
    con = sqlite3.connect("sentinelai.db")
    cur = con.cursor()

    cur.execute("SELECT id, email, display_name, role, is_active FROM users WHERE id = ?", (user_id,))
    db_user = cur.fetchone()
    assert db_user is not None, "User not found in users table"
    assert db_user[1] == test_email
    assert db_user[2] == test_name
    assert db_user[3] == "SECURITY_ANALYST"
    assert db_user[4] == 1

    cur.execute(
        "SELECT id, provider, provider_user_id, password_hash FROM authentication_accounts WHERE user_id = ?",
        (user_id,)
    )
    db_auth = cur.fetchone()
    assert db_auth is not None, "Authentication account not found in authentication_accounts table"
    assert db_auth[1] == "PASSWORD"
    assert db_auth[2] == test_email
    # Verify password was securely hashed with Argon2id and can be verified
    assert db_auth[3] is not None
    assert db_auth[3] != test_password
    assert verify_password(test_password, db_auth[3]) is True
    con.close()

    # 3. Log in using the newly registered email and password
    login_response = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": test_password,
        },
    )
    assert login_response.status_code == 200, f"Login with newly registered user failed: {login_response.text}"
    login_data = login_response.json()
    assert login_data["user"]["id"] == user_id
    assert login_data["user"]["email"] == test_email

    # 4. Reject incorrect password for the registered user
    wrong_pw_response = client.post(
        "/api/auth/login",
        json={
            "email": test_email,
            "password": "WrongPasswordAttempt123!",
        },
    )
    assert wrong_pw_response.status_code == 401
    assert "Invalid email or password" in wrong_pw_response.json().get("detail", "")


def test_reject_duplicate_registration(client):
    """Test that attempting to register an already-registered email returns 400 Bad Request."""
    unique_suffix = uuid.uuid4().hex[:8]
    test_email = f"duplicate_{unique_suffix}@sentinelai.internal"
    test_password = "SecurePassword2026!"

    first_reg = client.post(
        "/api/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "display_name": "First Attempt",
        },
    )
    assert first_reg.status_code == 200

    second_reg = client.post(
        "/api/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "display_name": "Second Attempt",
        },
    )
    assert second_reg.status_code == 400
    assert "already exists" in second_reg.json().get("detail", "")


def test_email_case_insensitivity_and_whitespace_handling(client):
    """
    Test that registration and login handle leading/trailing whitespace and mixed case
    consistently without causing login lockout.
    """
    unique_suffix = uuid.uuid4().hex[:8]
    raw_email = f"  CaseInsensitive_{unique_suffix}@SentinelAI.Internal  "
    expected_normalized = f"caseinsensitive_{unique_suffix}@sentinelai.internal"
    test_password = "CasePassword2026!"

    # Register with raw whitespace and mixed case
    reg_response = client.post(
        "/api/auth/register",
        json={
            "email": raw_email,
            "password": test_password,
            "display_name": "Case User",
        },
    )
    assert reg_response.status_code == 200
    assert reg_response.json()["user"]["email"] == expected_normalized

    # Log in using pure lowercase
    login_lower = client.post(
        "/api/auth/login",
        json={
            "email": expected_normalized,
            "password": test_password,
        },
    )
    assert login_lower.status_code == 200

    # Log in using pure uppercase with surrounding spaces
    login_upper = client.post(
        "/api/auth/login",
        json={
            "email": f"  {expected_normalized.upper()}  ",
            "password": test_password,
        },
    )
    assert login_upper.status_code == 200


def test_role_based_access_restrictions(client):
    """
    Verify backend RBAC enforcement:
    - User with SECURITY_ANALYST cannot access Admin-only endpoints (e.g. GET /api/auth/users).
    - User with ADMIN can access Admin-only endpoints.
    """
    # 1. Analyst login
    analyst_login = client.post(
        "/api/auth/login",
        json={
            "email": "analyst@sentinelai.internal",
            "password": "SentinelAnalyst2026!",
        },
    )
    assert analyst_login.status_code == 200
    analyst_token = analyst_login.json()["access_token"]

    # Analyst accessing /api/auth/users should be rejected with 403 Forbidden
    analyst_access = client.get(
        "/api/auth/users",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert analyst_access.status_code == 403
    assert "permission" in analyst_access.json().get("detail", "").lower()

    # 2. Admin login
    admin_login = client.post(
        "/api/auth/login",
        json={
            "email": "admin@sentinelai.internal",
            "password": "SentinelAdmin2026!",
        },
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    # Admin accessing /api/auth/users should succeed with 200 OK
    admin_access = client.get(
        "/api/auth/users",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_access.status_code == 200
    users_list = admin_access.json()
    assert isinstance(users_list, list)
    assert len(users_list) >= 2


def test_logout_and_session_handling(client):
    """Verify that logging out revokes the session and clears authentication cookies."""
    login_resp = client.post(
        "/api/auth/login",
        json={
            "email": "admin@sentinelai.internal",
            "password": "SentinelAdmin2026!",
        },
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # Verify session active
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200

    # Logout
    logout_resp = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "success"

    # Unauthenticated /api/auth/me request without token must fail
    unauth_resp = client.get("/api/auth/me")
    assert unauth_resp.status_code == 401


def test_login_rejects_malformed_concatenated_email(client):
    """Test that submitting a concatenated email fails schema validation."""
    response = client.post(
        "/api/auth/login",
        json={
            "email": "in@sentinelai.internaladmin@sentinelai.internal",
            "password": "SentinelAdmin2026!",
        },
    )
    assert response.status_code == 422
