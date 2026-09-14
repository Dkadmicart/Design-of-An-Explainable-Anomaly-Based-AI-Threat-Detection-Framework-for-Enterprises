"""
SentinelAI - Email + Password Authentication Provider
Uses Argon2id password verification.
"""
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import User, AuthenticationAccount, AuthProviderType
from app.auth.providers.base import BaseAuthProvider, AuthResult
from app.auth.security import verify_password


class PasswordAuthProvider(BaseAuthProvider):
    """Email + Password authentication provider."""

    @property
    def provider_type(self) -> AuthProviderType:
        return AuthProviderType.PASSWORD

    async def authenticate(self, credentials: Any, db: AsyncSession) -> AuthResult:
        email = getattr(credentials, "email", None) or credentials.get("email")
        password = getattr(credentials, "password", None) or credentials.get("password")

        if not email or not password:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Email and password are required.",
            )

        norm_email = email.strip().lower()

        # Find linked user and password auth account
        stmt = (
            select(User, AuthenticationAccount)
            .join(AuthenticationAccount, User.id == AuthenticationAccount.user_id)
            .where(
                User.email == norm_email,
                AuthenticationAccount.provider == AuthProviderType.PASSWORD,
            )
        )
        res = await db.execute(stmt)
        record = res.first()

        if not record:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id=norm_email,
                email=norm_email,
                error_message="Invalid email or password.",
            )

        user, auth_account = record

        if not auth_account.password_hash or not verify_password(password, auth_account.password_hash):
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id=norm_email,
                email=norm_email,
                error_message="Invalid email or password.",
            )

        return AuthResult(
            success=True,
            provider=self.provider_type,
            provider_user_id=auth_account.provider_user_id,
            email=user.email,
            display_name=user.display_name,
        )
