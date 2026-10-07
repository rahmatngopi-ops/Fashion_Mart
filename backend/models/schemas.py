"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Auth ----------
class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class User(BaseModel):
    id: str
    name: str
    email: str
    role: Literal["customer", "admin"]


# ---------- Products ----------
Marketplace = Literal["shopee", "tokopedia", "tiktok", "lazada"]


class MarketplaceListing(BaseModel):
    marketplace: Marketplace
    title: str
    description: str
    tags: list[str]
    suggested_price: int


class ProductInput(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=50)
    price: int = Field(gt=0)
    stock: int = Field(ge=0)
    image_url: str = ""
    description: str = ""
    colors: list[str] = []
    sizes: list[str] = []


class Product(ProductInput):
    id: str = Field(default_factory=_uuid)
    listings: list[MarketplaceListing] = []
    created_at: datetime = Field(default_factory=_now)


# ---------- AI ----------
class ListingRequest(BaseModel):
    product_id: str | None = None
    name: str = Field(min_length=1, max_length=150)
    notes: str = ""
    category: str = ""
    base_price: int | None = None


class ListingResponse(BaseModel):
    listings: list[MarketplaceListing]


class StylistRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    lang: Literal["id", "en"] = "id"


class StylistMessage(BaseModel):
    id: str = Field(default_factory=_uuid)
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime = Field(default_factory=_now)


# ---------- Orders ----------
class CartItemInput(BaseModel):
    product_id: str
    quantity: int = Field(gt=0, le=20)
    size: str = ""


class CheckoutInput(BaseModel):
    items: list[CartItemInput] = Field(min_length=1)
    phone: str = Field(min_length=6, max_length=20)
    address: str = Field(min_length=5, max_length=500)


class OrderItem(BaseModel):
    product_id: str
    name: str
    price: int
    quantity: int
    size: str = ""
    image_url: str = ""


PaymentStatus = Literal["pending", "paid", "failed", "expired"]


class Order(BaseModel):
    id: str
    order_code: str
    user_id: str
    items: list[OrderItem]
    gross_amount: int
    phone: str
    address: str
    payment_status: PaymentStatus
    midtrans_status: str | None = None
    payment_type: str | None = None
    snap_token: str | None = None
    created_at: datetime


class CheckoutResponse(BaseModel):
    order: Order
    token: str
    redirect_url: str


class MidtransConfig(BaseModel):
    client_key: str
    is_production: bool
    snap_url: str
