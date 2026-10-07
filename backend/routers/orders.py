import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import get_current_user, require_admin
from lib.db import db
from models.schemas import CheckoutInput, CheckoutResponse, MidtransConfig, Order, OrderItem

router = APIRouter(tags=["orders"])
logger = logging.getLogger(__name__)


def _is_prod() -> bool:
    return os.environ.get("MIDTRANS_IS_PRODUCTION", "false").lower() == "true"


def _snap_base() -> str:
    return "https://app.midtrans.com" if _is_prod() else "https://app.sandbox.midtrans.com"


def _api_base() -> str:
    return "https://api.midtrans.com" if _is_prod() else "https://api.sandbox.midtrans.com"


def _server_key() -> str:
    return os.environ["MIDTRANS_SERVER_KEY"]


def _to_order(doc: dict) -> Order:
    created = doc["created_at"]
    if created.tzinfo is None:
        doc["created_at"] = created.replace(tzinfo=timezone.utc)
    return Order(**doc)


@router.get("/config/midtrans", response_model=MidtransConfig)
async def midtrans_config():
    return MidtransConfig(
        client_key=os.environ["MIDTRANS_CLIENT_KEY"], is_production=_is_prod(),
        snap_url=f"{_snap_base()}/snap/snap.js",
    )


@router.post("/orders/checkout", response_model=CheckoutResponse)
async def checkout(body: CheckoutInput, user: dict = Depends(get_current_user)):
    items: list[OrderItem] = []
    for line in body.items:
        product = await db.products.find_one({"id": line.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Unknown product: {line.product_id}")
        if product["stock"] < line.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient stock: {product['name']}")
        items.append(OrderItem(product_id=product["id"], name=product["name"], price=product["price"],
                               quantity=line.quantity, size=line.size, image_url=product.get("image_url", "")))
    total = sum(i.price * i.quantity for i in items)
    order_code = f"FM-{datetime.now(timezone.utc):%y%m%d}-{uuid.uuid4().hex[:8].upper()}"
    doc = {
        "id": str(uuid.uuid4()), "order_code": order_code, "user_id": user["id"],
        "items": [i.model_dump() for i in items], "gross_amount": total, "phone": body.phone,
        "address": body.address, "payment_status": "pending", "midtrans_status": None,
        "payment_type": None, "snap_token": None, "created_at": datetime.now(timezone.utc),
    }
    payload = {
        "transaction_details": {"order_id": order_code, "gross_amount": total},
        "item_details": [
            {"id": i.product_id[:50], "price": i.price, "quantity": i.quantity, "name": i.name[:50]} for i in items
        ],
        "customer_details": {"first_name": user["name"][:50], "email": user["email"], "phone": body.phone},
    }
    async with httpx.AsyncClient(timeout=20) as http:
        res = await http.post(f"{_snap_base()}/snap/v1/transactions", json=payload,
                              auth=(_server_key(), ""), headers={"Accept": "application/json"})
    if res.status_code not in (200, 201):
        logger.error("midtrans snap error %s: %s", res.status_code, res.text[:300])
        raise HTTPException(status_code=502, detail="Unable to create Midtrans transaction")
    snap = res.json()
    doc["snap_token"] = snap["token"]
    await db.orders.insert_one(doc)
    return CheckoutResponse(order=_to_order(doc), token=snap["token"], redirect_url=snap["redirect_url"])


def _map_status(status: dict) -> str:
    tx = status.get("transaction_status")
    if tx == "settlement" or (tx == "capture" and status.get("fraud_status") in (None, "accept")):
        return "paid"
    return {"deny": "failed", "cancel": "failed", "failure": "failed", "expire": "expired"}.get(tx, "pending")


async def _reconcile(doc: dict) -> dict:
    """Ask Midtrans for the authoritative status and persist it (idempotent)."""
    async with httpx.AsyncClient(timeout=15) as http:
        res = await http.get(f"{_api_base()}/v2/{doc['order_code']}/status", auth=(_server_key(), ""))
    data = res.json() if res.status_code == 200 else {}
    # Midtrans returns status_code 404 in body when the customer has not chosen a method yet.
    if not data or data.get("status_code") == "404" or "transaction_status" not in data:
        return doc
    try:
        if int(float(data.get("gross_amount", 0))) != doc["gross_amount"]:
            logger.error("gross amount mismatch for %s", doc["order_code"])
            return doc
    except ValueError:
        return doc
    new_status = _map_status(data)
    update = {"payment_status": new_status, "midtrans_status": data.get("transaction_status"),
              "payment_type": data.get("payment_type")}
    if new_status == "paid" and doc["payment_status"] != "paid":
        for item in doc["items"]:
            await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}})
    await db.orders.update_one({"id": doc["id"]}, {"$set": update})
    return {**doc, **update}


@router.get("/orders", response_model=list[Order])
async def my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_to_order(d) for d in docs]


@router.get("/admin/orders", response_model=list[Order])
async def all_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_to_order(d) for d in docs]


@router.post("/orders/{id}/refresh", response_model=Order)
async def refresh_order(id: str, user: dict = Depends(get_current_user)):
    query = {"id": id} if user["role"] == "admin" else {"id": id, "user_id": user["id"]}
    doc = await db.orders.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if doc["payment_status"] == "pending":
        doc = await _reconcile(doc)
    return _to_order(doc)


@router.post("/webhooks/midtrans")
async def midtrans_webhook(request: Request):
    data = await request.json()
    order_code, status_code, gross = data.get("order_id"), data.get("status_code"), data.get("gross_amount")
    if not (order_code and status_code and gross and data.get("signature_key")):
        raise HTTPException(status_code=400, detail="Invalid notification")
    expected = hashlib.sha512(f"{order_code}{status_code}{gross}{_server_key()}".encode()).hexdigest()
    if not hmac.compare_digest(expected, data["signature_key"]):
        raise HTTPException(status_code=403, detail="Invalid signature")
    doc = await db.orders.find_one({"order_code": order_code}, {"_id": 0})
    if doc:
        await _reconcile(doc)
    return {"ok": True}
