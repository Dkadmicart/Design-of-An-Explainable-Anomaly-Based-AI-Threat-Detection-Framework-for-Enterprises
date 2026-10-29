"""
SentinelAI - Base Authentication Provider Interface
Defines the modular contract that all auth providers (Password, Google, OIDC, SAML) must fulfill.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import AuthProviderType


@dataclass
class AuthResult:
    """Standardized identity resolution result produced by any auth provider."""
    success: bool
    provider: AuthProviderType
    provider_user_id: str
    email: str
    display_name: Optional[str] = None
    picture: Optional[str] = None
    error_message: Optional[str] = None
    raw_claims: Optional[Dict[str, Any]] = None


class BaseAuthProvider(ABC):
    """Abstract Base Provider for SentinelAI authentication."""
    
    @property
    @abstractmethod
    def provider_type(self) -> AuthProviderType:
        """Returns the AuthProviderType enum value."""
        pass

    @abstractmethod
    async def authenticate(self, credentials: Any, db: AsyncSession) -> AuthResult:
        """
        Authenticate credentials supplied by the client.
        Must return a standardized AuthResult without coupling to application session logic.
        """
        pass
