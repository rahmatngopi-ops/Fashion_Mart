"""Password hashing, JWT cookie sessions, and current-user dependencies."""

import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, Response

from lib.db import db

COOKIE_NAME = "fm_session"
JWT_ALG = "HS256"
SESSION_DAYS = 7


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def set_session_cookie(response: Response, user_id: str) -> None:
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    token = jwt.encode({"sub": user_id, "exp": exp}, os.environ["JWT_SECRET"], algorithm=JWT_ALG)
    response.set_cookie(
        COOKIE_NAME, token, httponly=True, secure=True, samesite="lax",
        max_age=SESSION_DAYS * 86400, path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


async def get_optional_user(request: Request) -> dict | None:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None
    return await db.users.find_one({"id": payload.get("sub")}, {"_id": 0, "password_hash": 0})


async def get_current_user(user: dict | None = Depends(get_optional_user)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user
