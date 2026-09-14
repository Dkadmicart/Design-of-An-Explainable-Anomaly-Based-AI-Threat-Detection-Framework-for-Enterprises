"""
SentinelAI - Authentication & User Management Pydantic Schemas
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.database import UserRole, AuthProviderType


class LoginRequest(BaseModel):
    """Email + Password login request."""
    email: EmailStr
    password: str = Field(..., min_length=8)


class GoogleLoginRequest(BaseModel):
    """Google OAuth / OIDC login request."""
    credential: str = Field(..., description="Google ID Token (JWT)")


class TokenResponse(BaseModel):
    """Access token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """Clean user representation returned to client."""
    id: str
    email: str
    display_name: str
    role: UserRole
    is_active: bool
    mfa_enabled: bool
    organization_id: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None
    auth_providers: List[str] = []

    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Authentication success response containing token and user profile."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class UserInviteRequest(BaseModel):
    """Admin request to provision/invite an enterprise user."""
    email: EmailStr
    display_name: str = Field(..., min_length=2, max_length=100)
    role: UserRole = UserRole.SECURITY_ANALYST
    initial_password: Optional[str] = Field(None, min_length=8)


class UpdateRoleRequest(BaseModel):
    """Admin request to change user role."""
    role: UserRole


class UpdateStatusRequest(BaseModel):
    """Admin request to enable or disable an account."""
    is_active: bool


class ForgotPasswordRequest(BaseModel):
    """Password reset initiation request."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Password reset completion request."""
    token: str
    new_password: str = Field(..., min_length=8)


class AuditLogResponse(BaseModel):
    """Audit log entry representation."""
    id: str
    timestamp: datetime
    user_id: Optional[str] = None
    action: str
    resource: str
    status: str
    ip_address: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
