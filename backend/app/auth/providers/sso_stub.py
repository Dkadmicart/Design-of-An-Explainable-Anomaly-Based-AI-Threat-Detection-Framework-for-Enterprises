"""
SentinelAI - Enterprise SSO Providers (OIDC & SAML Stubs)
Designed so that Microsoft Entra ID, Okta, Ping Identity, and SAML 2.0 IdPs
can be plugged into the exact same BaseAuthProvider abstraction without modifying
identity resolution, RBAC, or session handling.
"""
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import AuthProviderType
from app.auth.providers.base import BaseAuthProvider, AuthResult


class OIDCAuthProvider(BaseAuthProvider):
    """
    Generic OIDC (OpenID Connect) Provider for Microsoft Entra ID, Okta, Keycloak, etc.
    Plugs directly into the central SentinelAI identity resolution pipeline.
    """

    @property
    def provider_type(self) -> AuthProviderType:
        return AuthProviderType.OIDC

    async def authenticate(self, credentials: Any, db: AsyncSession) -> AuthResult:
        return AuthResult(
            success=False,
            provider=self.provider_type,
            provider_user_id="",
            email="",
            error_message="Enterprise OIDC SSO is not configured for this tenant. Contact administrator.",
        )


class SAMLAuthProvider(BaseAuthProvider):
    """
    Enterprise SAML 2.0 Identity Provider.
    Plugs directly into the central SentinelAI identity resolution pipeline.
    """

    @property
    def provider_type(self) -> AuthProviderType:
        return AuthProviderType.SAML

    async def authenticate(self, credentials: Any, db: AsyncSession) -> AuthResult:
        return AuthResult(
            success=False,
            provider=self.provider_type,
            provider_user_id="",
            email="",
            error_message="Enterprise SAML 2.0 SSO is not configured for this tenant. Contact administrator.",
        )
