"""Shipping rates (flat per zone, no live courier API) and voucher discount rules."""

from fastapi import HTTPException

from lib.db import db
from models.schemas import CourierOption, ShippingZone

ZONES = [
    ShippingZone(code="jabodetabek", label="Jabodetabek", multiplier=1.0),
    ShippingZone(code="jawa", label="Pulau Jawa (luar Jabodetabek)", multiplier=1.4),
    ShippingZone(code="sumatera_bali", label="Sumatera, Bali & NTB", multiplier=2.0),
    ShippingZone(code="kalimantan_sulawesi", label="Kalimantan & Sulawesi", multiplier=2.6),
    ShippingZone(code="indonesia_timur", label="Maluku, NTT & Papua", multiplier=3.8),
]
COURIERS = [
    CourierOption(code="jne_reg", name="JNE", service="REG", base_cost=11000, etd="2-3"),
    CourierOption(code="jne_yes", name="JNE", service="YES", base_cost=22000, etd="1"),
    CourierOption(code="jnt_ez", name="J&T", service="EZ", base_cost=10000, etd="2-4"),
    CourierOption(code="sicepat_reg", name="SiCepat", service="REG", base_cost=9500, etd="2-3"),
    CourierOption(code="sicepat_best", name="SiCepat", service="BEST", base_cost=19000, etd="1"),
]


def shipping_quote(zone_code: str, courier_code: str) -> tuple[int, ShippingZone, CourierOption]:
    zone = next((z for z in ZONES if z.code == zone_code), None)
    courier = next((c for c in COURIERS if c.code == courier_code), None)
    if not zone or not courier:
        raise HTTPException(status_code=400, detail="Invalid shipping zone or courier")
    cost = int(round(courier.base_cost * zone.multiplier / 500.0) * 500)
    return cost, zone, courier


async def voucher_discount(code: str, subtotal: int, shipping_cost: int) -> tuple[int, dict]:
    """Return (discount, voucher_doc). Raises 400 with a readable reason when not applicable."""
    doc = await db.vouchers.find_one({"code": code.strip().upper()}, {"_id": 0})
    if not doc or not doc.get("active", True):
        raise HTTPException(status_code=400, detail="Voucher tidak valid / invalid voucher")
    if subtotal < doc.get("min_spend", 0):
        raise HTTPException(status_code=400, detail=f"Minimal belanja Rp{doc['min_spend']:,}".replace(",", "."))
    if doc["type"] == "percent":
        discount = subtotal * doc["value"] // 100
    elif doc["type"] == "fixed":
        discount = doc["value"]
    else:  # shipping
        discount = min(doc["value"], shipping_cost)
    if doc.get("max_discount"):
        discount = min(discount, doc["max_discount"])
    return min(discount, subtotal + shipping_cost - 1), doc
