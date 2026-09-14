"""
SentinelAI - Authentication & RBAC Dependencies
FastAPI dependencies for route protection and role-based access control.
"""
from typing import Optional, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import get_db
from app.models.database import User, UserRole
from app.auth.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the active user identity from Authorization header or cookie.
    Enforces that the user exists and is active.
    """
    # 1. Try Bearer token from header
    raw_token = token

    # 2. Try auth cookie if not in header
    if not raw_token:
        raw_token = request.cookies.get("sentinelai_access_token")

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(raw_token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or is invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Fetch user from database
    stmt = (
        select(User)
        .options(selectinload(User.auth_accounts))
        .where(User.id == user_id)
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token no longer exists.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account has been deactivated. Please contact your administrator.",
        )

    return user


def require_role(*roles: UserRole):
    """
    RBAC dependency factory.
    Enforces that the authenticated user possesses one of the authorized roles.
    """
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this resource.",
            )
        return current_user
    return role_checker


# Convenient role dependencies
require_admin = require_role(UserRole.ADMIN)
require_analyst = require_role(UserRole.ADMIN, UserRole.SECURITY_ANALYST)
require_viewer = require_role(UserRole.ADMIN, UserRole.SECURITY_ANALYST, UserRole.VIEWER)
