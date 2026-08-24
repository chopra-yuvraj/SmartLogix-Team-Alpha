"""
SmartLogix Gateway — Supabase JWT Auth Dependency (Task 3.2)

Verifies incoming bearer tokens against the Supabase project's JWT secret,
injects the authenticated profile_id + role into request handlers.
Every non-public route uses this dependency.

Never trust a client-supplied shipper_id/driver_id in the body for
authorization decisions — only for data content (rules.md §7).
"""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from schemas import UserRole
from settings import settings

security = HTTPBearer()


class AuthenticatedUser:
    """Represents an authenticated user extracted from a Supabase JWT."""

    def __init__(self, user_id: str, role: UserRole, email: str = ""):
        self.user_id = user_id
        self.role = role
        self.email = email

    def __repr__(self) -> str:
        return f"AuthenticatedUser(id={self.user_id}, role={self.role})"


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> AuthenticatedUser:
    """FastAPI dependency that verifies the Supabase JWT and returns the user.

    Raises 401 if the token is missing, expired, or invalid.
    """
    token = credentials.credentials

    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET not configured",
        )

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
        )

    # Extract role from user_metadata or app_metadata
    user_metadata = payload.get("user_metadata", {})
    app_metadata = payload.get("app_metadata", {})
    role_str = (
        user_metadata.get("role")
        or app_metadata.get("role")
        or "shipper"  # default role
    )

    try:
        role = UserRole(role_str)
    except ValueError:
        role = UserRole.shipper

    email = payload.get("email", "")

    return AuthenticatedUser(user_id=user_id, role=role, email=email)


async def require_shipper(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Dependency that requires the user to be a shipper."""
    if user.role not in (UserRole.shipper, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shipper role required",
        )
    return user


async def require_driver(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Dependency that requires the user to be a driver."""
    if user.role not in (UserRole.driver, UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Driver role required",
        )
    return user


async def require_admin(
    user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> AuthenticatedUser:
    """Dependency that requires the user to be an admin."""
    if user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return user
