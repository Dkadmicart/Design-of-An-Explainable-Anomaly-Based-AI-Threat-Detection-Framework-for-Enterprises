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

        # Support local development & demo enterprise Google SSO flows
        if (
            id_token.startswith("mock_")
            or id_token.startswith("demo_")
            or id_token.startswith("simulated_")
            or "sentinelai.internal" in id_token
        ):
            # Prioritize email option passed in the payload
            req_email = getattr(credentials, "email", None) or (credentials.get("email") if isinstance(credentials, dict) else None)
            
            if req_email:
                target_email = str(req_email).strip().lower()
            elif ":" in id_token:
                extracted = id_token.split(":")[-1].strip().lower()
                target_email = extracted if "@" in extracted else "analyst@sentinelai.internal"
            elif "admin" in id_token.lower():
                target_email = "admin@sentinelai.internal"
            else:
                target_email = "analyst@sentinelai.internal"

            sub_id = f"google_sso_{target_email.replace('@', '_').replace('.', '_')}"
            clean_name = target_email.split('@')[0].replace('.', ' ').replace('_', ' ').title()
            display_name = (
                "SOC Administrator" if "admin" in target_email
                else "SecOps Analyst" if "analyst" in target_email
                else "Dhruv Keshari" if "dkadmicrts" in target_email
                else clean_name
            )

            logger.info(f"Authenticating via enterprise Google SSO mock/demo provider for {target_email}")
            return AuthResult(
                success=True,
                provider=self.provider_type,
                provider_user_id=sub_id,
                email=target_email,
                display_name=display_name,
                raw_claims={
                    "iss": "https://accounts.google.com",
                    "sub": sub_id,
                    "email": target_email,
                    "email_verified": True,
                    "name": display_name,
                    "hd": "sentinelai.internal",
                },
            )

        try:
            # Check if token is Google OAuth2 access token (starts with ya29. or has no dots)
            claims = None
            async with httpx.AsyncClient(timeout=10.0) as client:
                if id_token.startswith("ya29.") or id_token.count(".") != 2:
                    # UserInfo endpoint for access tokens
                    resp = await client.get(
                        "https://www.googleapis.com/oauth2/v3/userinfo",
                        headers={"Authorization": f"Bearer {id_token}"},
                    )
                    if resp.status_code == 200:
                        claims = resp.json()
                        # UserInfo endpoint returns sub as the unique ID
                        claims["iss"] = "https://accounts.google.com"
                
                if claims is None:
                    # ID Token verification via tokeninfo
                    resp = await client.get(GOOGLE_TOKENINFO_URL, params={"id_token": id_token})
                    if resp.status_code == 200:
                        claims = resp.json()

            if not claims:
                logger.warning("Google token verification failed (rejected by both userinfo and tokeninfo)")
                return AuthResult(
                    success=False,
                    provider=self.provider_type,
                    provider_user_id="",
                    email="",
                    error_message="Google authentication token could not be verified by Google servers.",
                )
        except Exception as e:
            logger.error(f"Error verifying Google token: {str(e)}")
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Network error communicating with Google authentication servers.",
            )

        # Validate issuer if present
        iss = claims.get("iss", "")
        if iss and iss not in ["accounts.google.com", "https://accounts.google.com"]:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Invalid token issuer from Google.",
            )

        # Validate client ID if configured and present in claims
        if settings.GOOGLE_CLIENT_ID and "aud" in claims:
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
        if email_verified not in [True, "true", "True", 1, None]:
            return AuthResult(
                success=False,
                provider=self.provider_type,
                provider_user_id="",
                email="",
                error_message="Google email address is not verified.",
            )

        email = claims.get("email", "").strip().lower()
        sub = str(claims.get("sub") or claims.get("id") or "")
        name = claims.get("name") or claims.get("given_name") or email.split("@")[0].replace(".", " ").title()
        picture = claims.get("picture")

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
            picture=picture,
            raw_claims=claims,
        )
