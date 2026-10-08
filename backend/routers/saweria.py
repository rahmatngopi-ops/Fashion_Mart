"""Saweria-style creator support: profile, Midtrans payment, settlement, history."""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator

from lib.auth import get_current_user, get_optional_user
from lib.db import db
from routers.orders import _api_base, _map_status, _server_key, _snap_base

router = APIRouter(tags=["saweria"])
logger = logging.getLogger(__name__)
MIN_AMOUNT = 5000


# ---------- Models (mirrored in frontend/src/lib/types.ts) ----------
class CreatorProfileInput(BaseModel):
    handle: str = Field(min_length=3, max_length=30)
    display_name: str = Field(min_length=1, max_length=60)
    bio: str = Field(default="", max_length=300)
    avatar_url: str = Field(default="", max_length=500)
    goal_title: str = Field(default="", max_length=80)
    goal_amount: int = Field(default=0, ge=0, le=1_000_000_000)  # 0 = no goal

    @field_validator("handle")
    @classmethod
    def _handle(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.fullmatch(r"[a-z0-9_]+", v):
            raise ValueError("handle: huruf kecil, angka, underscore saja")
        return v


class CreatorProfile(CreatorProfileInput):
    id: str
    user_id: str


SupportStatus = Literal["pending", "paid", "failed", "expired"]


class SupportInput(BaseModel):
    amount: int = Field(ge=MIN_AMOUNT, le=10_000_000)
    supporter_name: str = Field(min_length=1, max_length=50)
    supporter_email: str = Field(default="", max_length=100)
    message: str = Field(default="", max_length=255)


class SupportPublic(BaseModel):
    id: str
    supporter_name: str
    amount: int
    message: str
    status: SupportStatus
    created_at: datetime


class Support(SupportPublic):
    code: str
    creator_id: str
    payment_type: str | None = None


class CreatorPage(BaseModel):
    profile: CreatorProfile
    recent: list[SupportPublic]
    goal_raised: int = 0


class SupportCheckoutResponse(BaseModel):
    support: SupportPublic
    token: str


def _support(doc: dict, model=Support):
    return model(**{**doc, "created_at": doc["created_at"].replace(tzinfo=timezone.utc)})


# ---------- Creator profile ----------
@router.get("/creators/me", response_model=CreatorProfile)
async def my_profile(user: dict = Depends(get_current_user)):
    doc = await db.creators.find_one({"user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="No creator profile")
    return CreatorProfile(**doc)


@router.put("/creators/me", response_model=CreatorProfile)
async def upsert_profile(body: CreatorProfileInput, user: dict = Depends(get_current_user)):
    taken = await db.creators.find_one({"handle": body.handle, "user_id": {"$ne": user["id"]}})
    if taken:
        raise HTTPException(status_code=409, detail="Handle sudah dipakai")
    existing = await db.creators.find_one({"user_id": user["id"]}, {"_id": 0})
    doc = {**(existing or {"id": str(uuid.uuid4()), "user_id": user["id"]}), **body.model_dump()}
    if not existing or (existing.get("goal_title"), existing.get("goal_amount")) != (body.goal_title, body.goal_amount):
        doc["goal_started_at"] = datetime.now(timezone.utc)  # new/changed goal: progress restarts
    await db.creators.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return CreatorProfile(**doc)


@router.get("/creators/me/supports", response_model=list[Support])
async def my_supports(user: dict = Depends(get_current_user)):
    creator = await db.creators.find_one({"user_id": user["id"]})
    if not creator:
        return []
    docs = await db.supports.find({"creator_id": creator["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_support(d) for d in docs]


@router.get("/creators/{handle}", response_model=CreatorPage)
async def creator_page(handle: str):
    doc = await db.creators.find_one({"handle": handle.lower()}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Creator not found")
    recent = await db.supports.find({"creator_id": doc["id"], "status": "paid"}, {"_id": 0}).sort("created_at", -1).to_list(20)
    raised = 0
    if doc.get("goal_amount"):
        match = {"creator_id": doc["id"], "status": "paid"}
        if doc.get("goal_started_at"):
            match["created_at"] = {"$gte": doc["goal_started_at"]}
        agg = await db.supports.aggregate([{"$match": match}, {"$group": {"_id": None, "sum": {"$sum": "$amount"}}}]).to_list(1)
        raised = agg[0]["sum"] if agg else 0
    return CreatorPage(profile=CreatorProfile(**doc), recent=[_support(d, SupportPublic) for d in recent], goal_raised=raised)


# ---------- Payment ----------
@router.post("/creators/{handle}/support", response_model=SupportCheckoutResponse)
async def create_support(handle: str, body: SupportInput, user: dict | None = Depends(get_optional_user)):
    creator = await db.creators.find_one({"handle": handle.lower()}, {"_id": 0})
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    code = f"SWR-{datetime.now(timezone.utc):%y%m%d}-{uuid.uuid4().hex[:8].upper()}"
    doc = {
        "id": str(uuid.uuid4()), "code": code, "creator_id": creator["id"], "amount": body.amount,
        "supporter_name": body.supporter_name, "message": body.message, "status": "pending",
        "payment_type": None, "supporter_user_id": user["id"] if user else None,
        "created_at": datetime.now(timezone.utc),
    }
    email = body.supporter_email or (user["email"] if user else "")
    payload = {
        "transaction_details": {"order_id": code, "gross_amount": body.amount},
        "item_details": [{"id": "SAWERIA", "price": body.amount, "quantity": 1,
                          "name": f"Dukungan untuk {creator['display_name']}"[:50]}],
        "customer_details": {"first_name": body.supporter_name[:50], **({"email": email} if email else {})},
    }
    async with httpx.AsyncClient(timeout=20) as http:
        res = await http.post(f"{_snap_base()}/snap/v1/transactions", json=payload,
                              auth=(_server_key(), ""), headers={"Accept": "application/json"})
    if res.status_code not in (200, 201):
        logger.error("midtrans snap error %s: %s", res.status_code, res.text[:300])
        raise HTTPException(status_code=502, detail="Unable to create Midtrans transaction")
    await db.supports.insert_one(doc)
    return SupportCheckoutResponse(support=_support(doc, SupportPublic), token=res.json()["token"])


async def reconcile_support(doc: dict) -> dict:
    """Authoritative status from Midtrans Status API (idempotent). Also used by the webhook."""
    if doc["status"] != "pending":
        return doc
    async with httpx.AsyncClient(timeout=15) as http:
        res = await http.get(f"{_api_base()}/v2/{doc['code']}/status", auth=(_server_key(), ""))
    data = res.json() if res.status_code == 200 else {}
    if "transaction_status" not in data:
        return doc
    try:
        if int(float(data.get("gross_amount", 0))) != doc["amount"]:
            logger.error("gross amount mismatch for %s", doc["code"])
            return doc
    except ValueError:
        return doc
    update = {"status": _map_status(data), "payment_type": data.get("payment_type")}
    await db.supports.update_one({"id": doc["id"], "status": "pending"}, {"$set": update})
    return {**doc, **update}


@router.post("/supports/{id}/refresh", response_model=SupportPublic)
async def refresh_support(id: str):
    doc = await db.supports.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Support not found")
    return _support(await reconcile_support(doc), SupportPublic)
