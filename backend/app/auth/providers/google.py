"""
SentinelAI - Google OAuth / OIDC Authentication Provider
Validates Google ID tokens via Google's tokeninfo API, extracts verified claims,
and produces standardized AuthResult for identity resolution.
"""
import logging
from typing import Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import get_settings
from app.models.database import AuthProviderType
from app.auth.providers.base import BaseAuthProvider, AuthResult

logger = logging.getLogger("sentinelai.auth.google")
settings = get_settings()

GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo"


class GoogleOAuthProvider(BaseAuthProvider):
    """Google OAuth 2.0 / OIDC provider."""

    @property
    def provider_type(self) -> AuthProviderType:
        return AuthProviderType.GOOGLE

    async def authenticate(self, credentials: Any, db: AsyncSession) -> AuthResult:
        id_token = getattr(credentials, "credential", None) or credentials.get("credential")

        if not id_token:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Missing Google ID token credential.",
            )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})
                if resp.status_code != 200:
                    logger.warning(f"Google tokeninfo rejected: status={resp.status_code}")
                    return AuthResult(
                        success=False,
                        provider=self.provider_type,
                        provider_user_id="",
                        email="",
                        error_message="Google authentication token could not be verified.",
                    )
                
                claims = resp.json()
        except Exception as e:
            logger.error(f"Error verifying Google token: {str(e)}")
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Network error communicating with Google authentication servers.",
            )

        # Validate issuer
        iss = claims.get("iss", "")
        if iss not in ["accounts.google.com", "https://accounts.google.com"]:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Invalid token issuer.",
            )

        # Validate client ID if configured
        if settings.GOOGLE_CLIENT_ID:
            aud = claims.get("aud", "")
            if aud != settings.GOOGLE_CLIENT_ID:
                return AuthResult(
                    success=False,
                    provider=self.provider_type,
                    provider_user_id="",
                    email="",
                    error_message="Google token was issued for an unauthorized client audience.",
                )

        # Check email verification status from Google
        email_verified = claims.get("email_verified")
        if email_verified not in [True, "true", "True", 1]:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Google email address is not verified.",
            )

        email = claims.get("email", "").strip().lower()
        sub = claims.get("sub", "")
        name = claims.get("name") or claims.get("given_name") or email.split("@")[0]

        if not email or not sub:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Google identity claims did not provide email or subject ID.",
            )

        return AuthResult(
            success=True,
            provider=self.provider_type,
            provider_user_id=sub,
            email=email,
            display_name=name,
            raw_claims=claims,
        )
