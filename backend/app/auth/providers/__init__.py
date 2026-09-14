"""Authentication Providers Package."""
from app.auth.providers.base import BaseAuthProvider, AuthResult
from app.auth.providers.password import PasswordAuthProvider
from app.auth.providers.google import GoogleOAuthProvider
from app.auth.providers.sso_stub import OIDCAuthProvider, SAMLAuthProvider

__all__ = [
    "BaseAuthProvider",
    "AuthResult",
    "PasswordAuthProvider",
    "GoogleOAuthProvider",
    "OIDCAuthProvider",
    "SAMLAuthProvider",
]
