import uuid

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import clear_session_cookie, get_current_user, hash_password, set_session_cookie, verify_password
from lib.db import db
from models.schemas import LoginInput, RegisterInput, User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=User)
async def register(body: RegisterInput, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = {"id": str(uuid.uuid4()), "name": body.name, "email": email, "role": "customer"}
    await db.users.insert_one({**user, "password_hash": hash_password(body.password)})
    set_session_cookie(response, user["id"])
    return User(**user)


@router.post("/login", response_model=User)
async def login(body: LoginInput, response: Response):
    doc = await db.users.find_one({"email": body.email.lower()})
    if not doc or not verify_password(body.password, doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    set_session_cookie(response, doc["id"])
    return User(**doc)


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=User)
async def me(user: dict = Depends(get_current_user)):
    return User(**user)
