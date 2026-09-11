import threading
import time
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User, AuditLog, Case
import schemas

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()
oauth2_scheme = security

auth_router = APIRouter()

# Rate limiting state for brute-force protection
_login_attempts = defaultdict(list)
_attempts_lock = threading.Lock()
MAX_LOGIN_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 300  # 5 minutes
LOCKOUT_SECONDS = 300  # 5 minutes


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def get_client_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None
    if "x-forwarded-for" in request.headers:
        return request.headers["x-forwarded-for"].split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | str = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if isinstance(credentials, HTTPAuthorizationCredentials):
        token = credentials.credentials
    elif isinstance(credentials, str):
        token = credentials
    else:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        user_uuid = user_id

    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_roles(*roles: str):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted for role '{current_user.role}'. Required: {', '.join(roles)}",
            )
        return current_user
    return role_checker


def assert_case_access(case: Optional[Case], user: User) -> Case:
    """Assert that the user has permission to view or manipulate the given case."""
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    if user.role in ("admin", "supervisor", "investigator", "analyst"):
        return case
    user_id_str = str(user.id) if user.id is not None else None
    created_by_str = str(case.created_by) if case.created_by is not None else None
    assigned_to_str = str(case.assigned_to) if case.assigned_to is not None else None
    if user_id_str not in (created_by_str, assigned_to_str):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this case",
        )
    return case


def log_action(
    db: Session,
    user_id,
    action: str,
    resource_type: str = None,
    resource_id: str = None,
    details: dict = None,
    ip_address: str = None,
):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id else None,
        ip_address=ip_address,
        details=details or {},
    )
    db.add(entry)
    db.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@auth_router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, request: Request, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)
    now = time.time()
    
    # Rate limit check per username
    with _attempts_lock:
        recent_attempts = [t for t in _login_attempts[payload.username] if now - t < LOGIN_WINDOW_SECONDS]
        _login_attempts[payload.username] = recent_attempts
        if len(recent_attempts) >= MAX_LOGIN_ATTEMPTS:
            oldest_attempt = min(recent_attempts)
            retry_after = max(1, int(LOCKOUT_SECONDS - (now - oldest_attempt)))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts. Account temporarily locked. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )

    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        with _attempts_lock:
            _login_attempts[payload.username].append(time.time())
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Check user active status
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Reset failed attempts on success
    with _attempts_lock:
        _login_attempts.pop(payload.username, None)

    user.last_login = datetime.utcnow()
    db.commit()

    token = create_access_token({"sub": str(user.id), "role": user.role})
    log_action(db, user.id, "login", "user", user.id, ip_address=client_ip)

    return schemas.TokenResponse(
        access_token=token,
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        user={"id": str(user.id), "username": user.username, "role": user.role},
    )


@auth_router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
    }


ALLOWED_USER_CREATION_ROLES = {"investigator", "supervisor"}


@auth_router.post("/users", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: schemas.UserCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin")),
):
    """Admin-only user creation endpoint supporting INVESTIGATOR and SUPERVISOR roles."""
    norm_role = payload.role.strip().lower()
    if norm_role not in ALLOWED_USER_CREATION_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Allowed roles for creation: INVESTIGATOR, SUPERVISOR",
        )

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")

    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=norm_role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    client_ip = get_client_ip(request)
    log_action(
        db,
        current_user.id,
        "create_user",
        "user",
        user.id,
        {"role": norm_role},
        ip_address=client_ip,
    )

    return user

