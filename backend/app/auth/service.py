"""
SentinelAI - Central Authentication & Identity Resolution Service
Coordinates authentication providers, identity resolution, RBAC, sessions, rate limiting, and audit logging.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, List, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.models.database import (
    User, AuthenticationAccount, UserSession, PasswordResetToken,
    AuditLog, LoginAttempt, UserRole, AuthProviderType
)
from app.auth.providers.base import AuthResult
from app.auth.security import (
    create_access_token, generate_secure_token, hash_token, hash_password
)

logger = logging.getLogger("sentinelai.auth.service")
settings = get_settings()


async def check_rate_limit(identifier: str, db: AsyncSession) -> bool:
    """
    Check if an identifier (email or IP) is currently rate limited due to too many failed attempts.
    Returns True if rate limited, False otherwise.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=settings.RATE_LIMIT_WINDOW_MINUTES)
    stmt = (
        select(func.count(LoginAttempt.id))
        .where(
            LoginAttempt.identifier == identifier,
            LoginAttempt.attempt_time >= cutoff,
            LoginAttempt.successful == False,  # noqa: E712
        )
    )
    result = await db.execute(stmt)
    failed_count = result.scalar() or 0
    return failed_count >= settings.RATE_LIMIT_MAX_ATTEMPTS


async def record_login_attempt(identifier: str, successful: bool, db: AsyncSession):
    """Record a login attempt for rate limiting and threat telemetry."""
    attempt = LoginAttempt(
        identifier=identifier,
        attempt_time=datetime.utcnow(),
        successful=successful,
    )
    db.add(attempt)
    await db.commit()


async def create_audit_log(
    db: AsyncSession,
    action: str,
    resource: str,
    status_code: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
):
    """
    Log security-sensitive actions for enterprise compliance and auditability.
    Never stores plaintext credentials or tokens.
    """
    audit = AuditLog(
        timestamp=datetime.utcnow(),
        user_id=user_id,
        action=action,
        resource=resource,
        status=status_code,
        ip_address=ip_address,
        details=details,
    )
    db.add(audit)
    await db.commit()


async def resolve_and_authorize_identity(
    auth_result: AuthResult,
    db: AsyncSession,
    ip_address: Optional[str] = None,
) -> User:
    """
    Central Identity Resolution:
    Takes an AuthResult from ANY provider (Password, Google, OIDC, SAML),
    finds or links the internal SentinelAI User, verifies account status and permissions.
    """
    if not auth_result.success:
        await record_login_attempt(auth_result.email or "unknown", successful=False, db=db)
        await create_audit_log(
            db=db,
            action="LOGIN_FAILED",
            resource=f"auth_provider:{auth_result.provider.value}",
            status_code="FAILURE",
            ip_address=ip_address,
            details={"email": auth_result.email, "reason": auth_result.error_message},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_result.error_message or "Invalid email or password.",
        )

    norm_email = auth_result.email.strip().lower()

    # 1. Lookup user by existing AuthenticationAccount
    stmt = (
        select(User)
        .join(AuthenticationAccount, User.id == AuthenticationAccount.user_id)
        .options(selectinload(User.auth_accounts))
        .where(
            AuthenticationAccount.provider == auth_result.provider,
            AuthenticationAccount.provider_user_id == auth_result.provider_user_id,
        )
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    # 2. If not found by specific provider account, match by verified enterprise email
    if not user:
        stmt_user = (
            select(User)
            .options(selectinload(User.auth_accounts))
            .where(User.email == norm_email)
        )
        res_user = await db.execute(stmt_user)
        user = res_user.scalar_one_or_none()

        if not user:
            # Important: Google/SSO login does NOT auto-provision unauthorized accounts
            await record_login_attempt(norm_email, successful=False, db=db)
            await create_audit_log(
                db=db,
                action="LOGIN_REJECTED_UNAUTHORIZED_USER",
                resource=f"auth_provider:{auth_result.provider.value}",
                status_code="REJECTED",
                ip_address=ip_address,
                details={"email": norm_email},
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account does not have access to SentinelAI. Please contact your administrator.",
            )

        # Link this new provider to the verified SentinelAI account
        new_account = AuthenticationAccount(
            user_id=user.id,
            provider=auth_result.provider,
            provider_user_id=auth_result.provider_user_id,
            password_hash=None,
        )
        db.add(new_account)
        await db.commit()
        await db.refresh(user, ["auth_accounts"])
        
        await create_audit_log(
            db=db,
            action="AUTH_PROVIDER_LINKED",
            resource=f"user:{user.id}",
            status_code="SUCCESS",
            user_id=user.id,
            ip_address=ip_address,
            details={"provider": auth_result.provider.value},
        )

    # 3. Check account active status
    if not user.is_active:
        await record_login_attempt(norm_email, successful=False, db=db)
        await create_audit_log(
            db=db,
            action="LOGIN_REJECTED_DISABLED_ACCOUNT",
            resource=f"user:{user.id}",
            status_code="REJECTED",
            user_id=user.id,
            ip_address=ip_address,
            details={"email": user.email},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been disabled. Please contact your administrator.",
        )

    # 4. Successful login update
    user.last_login_at = datetime.utcnow()
    await record_login_attempt(norm_email, successful=True, db=db)
    await db.commit()

    await create_audit_log(
        db=db,
        action="LOGIN_SUCCESS",
        resource=f"user:{user.id}",
        status_code="SUCCESS",
        user_id=user.id,
        ip_address=ip_address,
        details={"provider": auth_result.provider.value, "role": user.role.value},
    )

    return user


async def create_user_session(
    user: User,
    db: AsyncSession,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> Tuple[str, str, int]:
    """
    Generate short-lived JWT access token and secure database-tracked refresh session token.
    Returns (access_token, refresh_token, expires_in_seconds).
    """
    expires_in_seconds = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    token_claims = {
        "sub": user.id,
        "email": user.email,
        "role": user.role.value,
        "display_name": user.display_name,
        "organization_id": user.organization_id,
    }
    access_token = create_access_token(token_claims)

    # Create secure refresh token
    raw_refresh_token = generate_secure_token(48)
    token_db_hash = hash_token(raw_refresh_token)
    session_expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    session = UserSession(
        user_id=user.id,
        refresh_token_hash=token_db_hash,
        user_agent=user_agent[:255] if user_agent else None,
        ip_address=ip_address,
        expires_at=session_expire,
        is_revoked=False,
    )
    db.add(session)
    await db.commit()

    return access_token, raw_refresh_token, expires_in_seconds


async def refresh_user_session(
    refresh_token: str,
    db: AsyncSession,
    ip_address: Optional[str] = None,
) -> Tuple[str, User]:
    """
    Validate refresh token and issue a fresh access token.
    """
    token_db_hash = hash_token(refresh_token)
    stmt = (
        select(UserSession)
        .options(selectinload(UserSession.user).selectinload(User.auth_accounts))
        .where(
            UserSession.refresh_token_hash == token_db_hash,
            UserSession.is_revoked == False,  # noqa: E712
            UserSession.expires_at > datetime.utcnow(),
        )
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session or not session.user or not session.user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or was revoked. Please sign in again.",
        )

    user = session.user
    token_claims = {
        "sub": user.id,
        "email": user.email,
        "role": user.role.value,
        "display_name": user.display_name,
        "organization_id": user.organization_id,
    }
    new_access_token = create_access_token(token_claims)

    return new_access_token, user


async def invalidate_session(refresh_token: str, db: AsyncSession, user_id: Optional[str] = None):
    """Revoke a single user session."""
    token_db_hash = hash_token(refresh_token)
    stmt = (
        update(UserSession)
        .where(UserSession.refresh_token_hash == token_db_hash)
        .values(is_revoked=True)
    )
    await db.execute(stmt)
    await db.commit()

    if user_id:
        await create_audit_log(
            db=db,
            action="LOGOUT",
            resource=f"user:{user_id}",
            status_code="SUCCESS",
            user_id=user_id,
        )


async def invalidate_all_user_sessions(user_id: str, db: AsyncSession):
    """Revoke all active sessions for a user (e.g. after password reset or admin security action)."""
    stmt = (
        update(UserSession)
        .where(UserSession.user_id == user_id, UserSession.is_revoked == False)  # noqa: E712
        .values(is_revoked=True)
    )
    await db.execute(stmt)
    await db.commit()


async def request_password_reset(email: str, db: AsyncSession, ip_address: Optional[str] = None) -> Optional[str]:
    """
    Generate a secure password reset token if account exists.
    Returns plain token string for dispatch (or None if user does not exist).
    Caller must return generic response to avoid user enumeration.
    """
    norm_email = email.strip().lower()
    stmt = select(User).where(User.email == norm_email)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        logger.info(f"Password reset requested for non-existent or inactive email: {norm_email}")
        return None

    # Invalidate previous unused tokens for this user
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.is_used == False)  # noqa: E712
        .values(is_used=True)
    )

    raw_token = generate_secure_token(32)
    token_hash_val = hash_token(raw_token)
    expires_at = datetime.utcnow() + timedelta(hours=1)

    reset_token_rec = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash_val,
        expires_at=expires_at,
        is_used=False,
    )
    db.add(reset_token_rec)
    await db.commit()

    await create_audit_log(
        db=db,
        action="PASSWORD_RESET_REQUESTED",
        resource=f"user:{user.id}",
        status_code="SUCCESS",
        user_id=user.id,
        ip_address=ip_address,
    )

    return raw_token


async def complete_password_reset(token: str, new_password: str, db: AsyncSession, ip_address: Optional[str] = None) -> bool:
    """
    Verify reset token and update password hash using Argon2id.
    Revokes all active sessions for security.
    """
    token_hash_val = hash_token(token)
    stmt = (
        select(PasswordResetToken)
        .options(selectinload(PasswordResetToken.user))
        .where(
            PasswordResetToken.token_hash == token_hash_val,
            PasswordResetToken.is_used == False,  # noqa: E712
            PasswordResetToken.expires_at > datetime.utcnow(),
        )
    )
    res = await db.execute(stmt)
    reset_rec = res.scalar_one_or_none()

    if not reset_rec or not reset_rec.user:
        return False

    user = reset_rec.user

    # Mark token as used
    reset_rec.is_used = True

    # Update or create PASSWORD authentication account
    hashed = hash_password(new_password)
    stmt_acc = (
        select(AuthenticationAccount)
        .where(
            AuthenticationAccount.user_id == user.id,
            AuthenticationAccount.provider == AuthProviderType.PASSWORD,
        )
    )
    res_acc = await db.execute(stmt_acc)
    auth_acc = res_acc.scalar_one_or_none()

    if auth_acc:
        auth_acc.password_hash = hashed
        auth_acc.updated_at = datetime.utcnow()
    else:
        new_acc = AuthenticationAccount(
            user_id=user.id,
            provider=AuthProviderType.PASSWORD,
            provider_user_id=user.email,
            password_hash=hashed,
        )
        db.add(new_acc)

    # Invalidate all user sessions
    await invalidate_all_user_sessions(user.id, db)

    await db.commit()

    await create_audit_log(
        db=db,
        action="PASSWORD_CHANGED",
        resource=f"user:{user.id}",
        status_code="SUCCESS",
        user_id=user.id,
        ip_address=ip_address,
    )

    return True


async def seed_default_users(db: AsyncSession):
    """
    Seed initial enterprise administrator and security analyst accounts for immediate access.
    """
    # 1. Admin account
    admin_email = "admin@sentinelai.internal"
    stmt_admin = select(User).where(User.email == admin_email)
    res_admin = await db.execute(stmt_admin)
    existing_admin = res_admin.scalar_one_or_none()

    if not existing_admin:
        admin_user = User(
            email=admin_email,
            display_name="SOC Administrator",
            role=UserRole.ADMIN,
            is_active=True,
            mfa_enabled=False,
        )
        db.add(admin_user)
        await db.flush()

        admin_auth = AuthenticationAccount(
            user_id=admin_user.id,
            provider=AuthProviderType.PASSWORD,
            provider_user_id=admin_email,
            password_hash=hash_password("SentinelAdmin2026!"),
        )
        db.add(admin_auth)
        logger.info(f"Seeded default enterprise administrator: {admin_email}")

    # 2. Analyst account
    analyst_email = "analyst@sentinelai.internal"
    stmt_analyst = select(User).where(User.email == analyst_email)
    res_analyst = await db.execute(stmt_analyst)
    existing_analyst = res_analyst.scalar_one_or_none()

    if not existing_analyst:
        analyst_user = User(
            email=analyst_email,
            display_name="SecOps Analyst",
            role=UserRole.SECURITY_ANALYST,
            is_active=True,
            mfa_enabled=False,
        )
        db.add(analyst_user)
        await db.flush()

        analyst_auth = AuthenticationAccount(
            user_id=analyst_user.id,
            provider=AuthProviderType.PASSWORD,
            provider_user_id=analyst_email,
            password_hash=hash_password("SentinelAnalyst2026!"),
        )
        db.add(analyst_auth)
        logger.info(f"Seeded default enterprise security analyst: {analyst_email}")

    await db.commit()
