"""
SentinelAI - Authentication & Enterprise User Management API Routes
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.database.session import get_db
from app.models.database import (
    User, AuthenticationAccount, AuditLog, UserRole, AuthProviderType
)
from app.auth.schemas import (
    LoginRequest, RegisterRequest, GoogleLoginRequest, AuthResponse, UserResponse,
    TokenResponse, UserInviteRequest, UpdateRoleRequest, UpdateStatusRequest,
    ForgotPasswordRequest, ResetPasswordRequest, AuditLogResponse
)
from app.auth.providers.password import PasswordAuthProvider
from app.auth.providers.google import GoogleOAuthProvider
from app.auth.service import (
    check_rate_limit, record_login_attempt, resolve_and_authorize_identity,
    create_user_session, refresh_user_session, invalidate_session,
    invalidate_all_user_sessions, request_password_reset, complete_password_reset,
    create_audit_log, register_new_user
)
from app.auth.security import hash_password
from app.auth.dependencies import get_current_user, require_admin

logger = logging.getLogger("sentinelai.auth.routes")
settings = get_settings()

router = APIRouter()

# Instantiate modular auth providers
password_provider = PasswordAuthProvider()
google_provider = GoogleOAuthProvider()


def _format_user_response(user: User) -> UserResponse:
    """Format User model into sanitized UserResponse."""
    providers = []
    if hasattr(user, "auth_accounts") and user.auth_accounts:
        providers = [acc.provider.value for acc in user.auth_accounts]
    
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        is_active=user.is_active,
        mfa_enabled=user.mfa_enabled,
        organization_id=user.organization_id,
        avatar_url=getattr(user, "avatar_url", None),
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        auth_providers=providers,
    )


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set secure HttpOnly cookies for session storage."""
    response.set_cookie(
        key="sentinelai_access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key="sentinelai_refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/api/auth",
    )


def _clear_auth_cookies(response: Response):
    """Clear session cookies."""
    response.delete_cookie("sentinelai_access_token", path="/")
    response.delete_cookie("sentinelai_refresh_token", path="/api/auth")


# ─── Public Authentication Endpoints ────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
async def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate using work email and password.
    Enforces rate limiting, Argon2id verification, session generation, and audit logging.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Rate limiting check
    if await check_rate_limit(credentials.email, db) or (client_ip and await check_rate_limit(client_ip, db)):
        await create_audit_log(
            db=db,
            action="LOGIN_BLOCKED_RATE_LIMITED",
            resource="auth:login",
            status_code="REJECTED",
            ip_address=client_ip,
            details={"email": credentials.email},
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again in 15 minutes.",
        )

    # 1. Provider authentication
    auth_result = await password_provider.authenticate(credentials, db)

    # 2. Central identity resolution & authorization
    user = await resolve_and_authorize_identity(auth_result, db, ip_address=client_ip)

    # 3. Session generation
    access_token, refresh_token, expires_in = await create_user_session(
        user, db, ip_address=client_ip, user_agent=user_agent
    )

    # Set secure cookies
    _set_auth_cookies(response, access_token, refresh_token)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=_format_user_response(user),
    )


@router.post("/register", response_model=AuthResponse)
async def register(
    credentials: RegisterRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new user account with work email and password.
    Creates user record, establishes session, sets secure cookies, and logs in immediately.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    user = await register_new_user(
        email=credentials.email,
        password=credentials.password,
        display_name=credentials.display_name,
        db=db,
        ip_address=client_ip,
    )

    access_token, refresh_token, expires_in = await create_user_session(
        user, db, ip_address=client_ip, user_agent=user_agent
    )

    _set_auth_cookies(response, access_token, refresh_token)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=_format_user_response(user),
    )


@router.post("/google", response_model=AuthResponse)
async def google_login(
    payload: GoogleLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate via Google OAuth / OIDC ID token.
    Validates token against Google, resolves against authorized SentinelAI users,
    and returns a standardized SentinelAI session.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # 1. Google provider verification
    auth_result = await google_provider.authenticate(payload, db)

    # 2. Central identity resolution & authorization
    user = await resolve_and_authorize_identity(auth_result, db, ip_address=client_ip)

    # 3. Session generation
    access_token, refresh_token, expires_in = await create_user_session(
        user, db, ip_address=client_ip, user_agent=user_agent
    )

    # Set secure cookies
    _set_auth_cookies(response, access_token, refresh_token)

    return AuthResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
        user=_format_user_response(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Issue a new access token using the secure session refresh token.
    """
    refresh_token_val = request.cookies.get("sentinelai_refresh_token")
    if not refresh_token_val:
        # Check authorization header or body fallback
        auth_header = request.headers.get("x-refresh-token")
        refresh_token_val = auth_header

    if not refresh_token_val:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token was not provided.",
        )

    new_access_token, user = await refresh_user_session(refresh_token_val, db)
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

    response.set_cookie(
        key="sentinelai_access_token",
        value=new_access_token,
        max_age=expires_in,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        path="/",
    )

    return TokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    current_user: Optional[User] = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Invalidate active user session, clear cookies, and record audit log.
    """
    refresh_token_val = request.cookies.get("sentinelai_refresh_token")
    if refresh_token_val:
        await invalidate_session(refresh_token_val, db, user_id=current_user.id if current_user else None)

    _clear_auth_cookies(response)
    return {"status": "success", "message": "Logged out successfully."}


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    """
    Get authenticated user profile and permissions.
    """
    return _format_user_response(current_user)


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Initiate enterprise password recovery.
    Always returns a generic message to prevent email enumeration.
    """
    client_ip = request.client.host if request.client else None
    reset_token = await request_password_reset(payload.email, db, ip_address=client_ip)
    
    # In a production environment with SMTP configured, this sends an email with the link.
    # For zero-config local verification, we also provide the reset token in the internal log
    if reset_token:
        logger.info(f"[PASSWORD RESET] Generated reset token for {payload.email}: {reset_token}")

    return {
        "status": "success",
        "message": "If an account with this email exists, password reset instructions have been sent.",
        # For testing convenience in development environment:
        "dev_reset_token": reset_token if settings.DEBUG else None,
    }


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Complete password reset with a valid token.
    Updates password hash with Argon2id and invalidates all existing sessions.
    """
    client_ip = request.client.host if request.client else None
    success = await complete_password_reset(payload.token, payload.new_password, db, ip_address=client_ip)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset token is invalid, expired, or has already been used.",
        )

    return {"status": "success", "message": "Password has been reset successfully. You may now sign in."}


# ─── Admin User Management Endpoints (RBAC: ADMIN only) ──────────────────────

@router.get("/users", response_model=List[UserResponse])
async def list_users(
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    (Admin only) List all enterprise users with status, role, and auth providers.
    """
    stmt = (
        select(User)
        .options(selectinload(User.auth_accounts))
        .order_by(desc(User.created_at))
    )
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [_format_user_response(u) for u in users]


@router.post("/users/invite", response_model=UserResponse)
async def invite_user(
    payload: UserInviteRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    (Admin only) Provision or invite a new enterprise user.
    """
    norm_email = payload.email.strip().lower()

    # Check if user exists
    stmt = select(User).where(User.email == norm_email)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    new_user = User(
        email=norm_email,
        display_name=payload.display_name,
        role=payload.role,
        is_active=True,
        mfa_enabled=False,
    )
    db.add(new_user)
    await db.flush()

    # If initial password provided, create password auth account
    if payload.initial_password:
        auth_acc = AuthenticationAccount(
            user_id=new_user.id,
            provider=AuthProviderType.PASSWORD,
            provider_user_id=norm_email,
            password_hash=hash_password(payload.initial_password),
        )
        db.add(auth_acc)

    await db.commit()
    await db.refresh(new_user, ["auth_accounts"])

    await create_audit_log(
        db=db,
        action="USER_INVITED",
        resource=f"user:{new_user.id}",
        status_code="SUCCESS",
        user_id=admin_user.id,
        details={"invited_email": norm_email, "role": payload.role.value},
    )

    return _format_user_response(new_user)


@router.patch("/users/{user_id}/status", response_model=UserResponse)
async def update_user_status(
    user_id: str,
    payload: UpdateStatusRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    (Admin only) Enable or disable an enterprise user account.
    Disabling immediately revokes all active sessions.
    """
    if user_id == admin_user.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot disable their own account.",
        )

    stmt = select(User).options(selectinload(User.auth_accounts)).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    target_user.is_active = payload.is_active

    if not payload.is_active:
        # Revoke all active sessions immediately
        await invalidate_all_user_sessions(target_user.id, db)

    await db.commit()

    await create_audit_log(
        db=db,
        action="USER_STATUS_UPDATED",
        resource=f"user:{user_id}",
        status_code="SUCCESS",
        user_id=admin_user.id,
        details={"new_active_status": payload.is_active, "target_email": target_user.email},
    )

    return _format_user_response(target_user)


@router.patch("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: str,
    payload: UpdateRoleRequest,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    (Admin only) Change an enterprise user's RBAC role.
    """
    if user_id == admin_user.id and payload.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Administrators cannot demote their own role.",
        )

    stmt = select(User).options(selectinload(User.auth_accounts)).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    old_role = target_user.role.value
    target_user.role = payload.role
    await db.commit()

    await create_audit_log(
        db=db,
        action="USER_ROLE_UPDATED",
        resource=f"user:{user_id}",
        status_code="SUCCESS",
        user_id=admin_user.id,
        details={"old_role": old_role, "new_role": payload.role.value, "target_email": target_user.email},
    )

    return _format_user_response(target_user)


@router.post("/users/{user_id}/revoke-sessions")
async def revoke_user_sessions(
    user_id: str,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    (Admin only) Immediately revoke all active sessions for a target user.
    """
    await invalidate_all_user_sessions(user_id, db)
    await create_audit_log(
        db=db,
        action="SESSIONS_REVOKED_BY_ADMIN",
        resource=f"user:{user_id}",
        status_code="SUCCESS",
        user_id=admin_user.id,
    )
    return {"status": "success", "message": "All active sessions for this user have been revoked."}


@router.get("/audit-logs", response_model=List[AuditLogResponse])
async def list_audit_logs(
    limit: int = 50,
    admin_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    (Admin only) Retrieve recent security audit logs.
    """
    stmt = select(AuditLog).order_by(desc(AuditLog.timestamp)).limit(limit)
    res = await db.execute(stmt)
    logs = res.scalars().all()
    return logs
