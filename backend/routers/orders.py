import hashlib
import hmac
import logging
import os
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import get_current_user, require_admin
from lib.commerce import shipping_quote, voucher_discount
from lib.db import db
from models.schemas import AdminStatusUpdate, CheckoutInput, CheckoutResponse, MidtransConfig, Order, OrderItem

router = APIRouter(tags=["orders"])
logger = logging.getLogger(__name__)

# Seller-driven transitions: current status -> allowed next statuses
ADMIN_TRANSITIONS = {
    "awaiting_payment": {"cancelled"},
    "paid": {"packed", "cancelled"},
    "packed": {"shipped"},
    "shipped": {"completed"},
}
NOTES = {
    "awaiting_payment": "Pesanan dibuat, menunggu pembayaran",
    "paid": "Pembayaran diterima, menunggu dikemas penjual",
    "packed": "Pesanan sedang dikemas penjual",
    "shipped": "Pesanan diserahkan ke kurir",
    "completed": "Pesanan selesai",
    "cancelled": "Pesanan dibatalkan",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_prod() -> bool:
    return os.environ.get("MIDTRANS_IS_PRODUCTION", "false").lower() == "true"


def _snap_base() -> str:
    return "https://app.midtrans.com" if _is_prod() else "https://app.sandbox.midtrans.com"


def _api_base() -> str:
    return "https://api.midtrans.com" if _is_prod() else "https://api.sandbox.midtrans.com"


def _server_key() -> str:
    return os.environ["MIDTRANS_SERVER_KEY"]


def _utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def _to_order(doc: dict) -> Order:
    doc = {**doc, "created_at": _utc(doc["created_at"])}
    doc["timeline"] = [{**t, "at": _utc(t["at"])} for t in doc.get("timeline", [])]
    return Order(**doc)


def _entry(status: str, note: str = "") -> dict:
    return {"status": status, "at": _now(), "note": note or NOTES[status]}


async def _set_status(doc: dict, status: str, note: str = "", extra: dict | None = None) -> dict:
    entry = _entry(status, note)
    update = {"status": status, **(extra or {})}
    await db.orders.update_one({"id": doc["id"]}, {"$set": update, "$push": {"timeline": entry}})
    return {**doc, **update, "timeline": [*doc.get("timeline", []), entry]}


async def _restock(doc: dict) -> None:
    for item in doc["items"]:
        await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": item["quantity"]}})


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
        if product.get("sizes") and line.size not in product["sizes"]:
            raise HTTPException(status_code=400, detail=f"Pilih ukuran untuk {product['name']}")
        if product.get("colors") and line.color not in product["colors"]:
            raise HTTPException(status_code=400, detail=f"Pilih warna untuk {product['name']}")
        if product["stock"] < line.quantity:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup: {product['name']}")
        items.append(OrderItem(product_id=product["id"], name=product["name"], price=product["price"],
                               quantity=line.quantity, size=line.size, color=line.color,
                               image_url=product.get("image_url", "")))
    subtotal = sum(i.price * i.quantity for i in items)
    shipping_cost, zone, courier = shipping_quote(body.zone, body.courier)
    discount, voucher_code = 0, ""
    if body.voucher_code.strip():
        discount, v = await voucher_discount(body.voucher_code, subtotal, shipping_cost)
        voucher_code = v["code"]
    total = subtotal + shipping_cost - discount

    order_code = f"FM-{_now():%y%m%d}-{uuid.uuid4().hex[:8].upper()}"
    courier_label = f"{courier.name} {courier.service}"
    doc = {
        "id": str(uuid.uuid4()), "order_code": order_code, "user_id": user["id"],
        "items": [i.model_dump() for i in items], "subtotal": subtotal, "shipping_cost": shipping_cost,
        "discount": discount, "gross_amount": total, "voucher_code": voucher_code,
        "courier": courier.code, "courier_label": courier_label, "zone_label": zone.label,
        "recipient_name": body.recipient_name, "phone": body.phone, "address": body.address, "note": body.note,
        "status": "awaiting_payment", "tracking_number": "", "timeline": [_entry("awaiting_payment")],
        "payment_status": "pending", "midtrans_status": None, "payment_type": None, "snap_token": None,
        "created_at": _now(),
    }
    item_details = [{"id": i.product_id[:50], "price": i.price, "quantity": i.quantity,
                     "name": f"{i.name} {i.size} {i.color}".strip()[:50]} for i in items]
    item_details.append({"id": "SHIPPING", "price": shipping_cost, "quantity": 1, "name": f"Ongkir {courier_label}"[:50]})
    if discount:
        item_details.append({"id": "VOUCHER", "price": -discount, "quantity": 1, "name": f"Voucher {voucher_code}"[:50]})
    payload = {
        "transaction_details": {"order_id": order_code, "gross_amount": total},
        "item_details": item_details,
        "customer_details": {
            "first_name": body.recipient_name[:50], "email": user["email"], "phone": body.phone,
            "shipping_address": {"first_name": body.recipient_name[:50], "phone": body.phone, "address": body.address[:200]},
        },
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
    if not data or "transaction_status" not in data:
        return doc
    try:
        if int(float(data.get("gross_amount", 0))) != doc["gross_amount"]:
            logger.error("gross amount mismatch for %s", doc["order_code"])
            return doc
    except ValueError:
        return doc
    pay = _map_status(data)
    update = {"payment_status": pay, "midtrans_status": data.get("transaction_status"),
              "payment_type": data.get("payment_type")}
    await db.orders.update_one({"id": doc["id"]}, {"$set": update})
    doc = {**doc, **update}
    if doc["status"] == "awaiting_payment":
        if pay == "paid":
            for item in doc["items"]:
                await db.products.update_one({"id": item["product_id"]}, {"$inc": {"stock": -item["quantity"]}})
            doc = await _set_status(doc, "paid", f"Pembayaran diterima via {(doc['payment_type'] or 'Midtrans').replace('_', ' ')}")
        elif pay in ("failed", "expired"):
            doc = await _set_status(doc, "cancelled", "Pembayaran gagal / kedaluwarsa")
    return doc


async def _find_order(id: str, user: dict) -> dict:
    query = {"id": id} if user["role"] == "admin" else {"id": id, "user_id": user["id"]}
    doc = await db.orders.find_one(query, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Order not found")
    return doc


@router.get("/orders", response_model=list[Order])
async def my_orders(user: dict = Depends(get_current_user)):
    docs = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [_to_order(d) for d in docs]


@router.get("/orders/{id}", response_model=Order)
async def get_order(id: str, user: dict = Depends(get_current_user)):
    return _to_order(await _find_order(id, user))


@router.post("/orders/{id}/refresh", response_model=Order)
async def refresh_order(id: str, user: dict = Depends(get_current_user)):
    doc = await _find_order(id, user)
    if doc["status"] == "awaiting_payment":
        doc = await _reconcile(doc)
    return _to_order(doc)


@router.post("/orders/{id}/cancel", response_model=Order)
async def cancel_order(id: str, user: dict = Depends(get_current_user)):
    """Buyer may cancel while unpaid or paid-but-not-yet-packed."""
    doc = await _find_order(id, user)
    if doc["status"] == "awaiting_payment":
        doc = await _reconcile(doc)  # don't cancel an order that was just paid without knowing
    if doc["status"] == "awaiting_payment":
        async with httpx.AsyncClient(timeout=15) as http:
            await http.post(f"{_api_base()}/v2/{doc['order_code']}/cancel", auth=(_server_key(), ""))
        doc = await _set_status(doc, "cancelled", "Dibatalkan oleh pembeli")
    elif doc["status"] == "paid":
        await _restock(doc)
        doc = await _set_status(doc, "cancelled", "Dibatalkan oleh pembeli — dana dikembalikan oleh penjual")
    else:
        raise HTTPException(status_code=400, detail="Pesanan sudah dikemas, tidak bisa dibatalkan")
    return _to_order(doc)


@router.post("/orders/{id}/complete", response_model=Order)
async def confirm_received(id: str, user: dict = Depends(get_current_user)):
    doc = await _find_order(id, user)
    if doc["status"] != "shipped":
        raise HTTPException(status_code=400, detail="Pesanan belum dikirim")
    return _to_order(await _set_status(doc, "completed", "Pesanan diterima pembeli"))


@router.get("/admin/orders", response_model=list[Order])
async def all_orders(_: dict = Depends(require_admin)):
    docs = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [_to_order(d) for d in docs]


@router.patch("/admin/orders/{id}/status", response_model=Order)
async def admin_update_status(id: str, body: AdminStatusUpdate, admin: dict = Depends(require_admin)):
    doc = await _find_order(id, admin)
    if body.status not in ADMIN_TRANSITIONS.get(doc["status"], set()):
        raise HTTPException(status_code=400, detail=f"Cannot move order from {doc['status']} to {body.status}")
    extra: dict = {}
    note = ""
    if body.status == "shipped":
        resi = body.tracking_number.strip()
        if not resi:
            raise HTTPException(status_code=400, detail="Nomor resi wajib diisi")
        extra["tracking_number"] = resi
        note = f"Diserahkan ke {doc['courier_label']} · Resi {resi}"
    if body.status == "cancelled":
        if doc["status"] == "paid":
            await _restock(doc)
        note = "Dibatalkan oleh penjual"
    return _to_order(await _set_status(doc, body.status, note, extra))


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
    if doc and doc["status"] == "awaiting_payment":
        await _reconcile(doc)
    return {"ok": True}
