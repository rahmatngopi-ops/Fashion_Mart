from fastapi import APIRouter, Depends, HTTPException

from lib.auth import get_current_user, require_admin
from lib.commerce import COURIERS, ZONES, voucher_discount
from lib.db import db
from models.schemas import ShippingOptions, Voucher, VoucherInput, VoucherValidateInput, VoucherValidateResult

router = APIRouter(tags=["commerce"])


@router.get("/shipping/options", response_model=ShippingOptions)
async def shipping_options():
    return ShippingOptions(zones=ZONES, couriers=COURIERS)


@router.post("/vouchers/validate", response_model=VoucherValidateResult)
async def validate_voucher(body: VoucherValidateInput, _: dict = Depends(get_current_user)):
    discount, doc = await voucher_discount(body.code, body.subtotal, body.shipping_cost)
    return VoucherValidateResult(code=doc["code"], discount=discount, description=doc.get("description", ""))


@router.get("/admin/vouchers", response_model=list[Voucher])
async def list_vouchers(_: dict = Depends(require_admin)):
    return [Voucher(**d) for d in await db.vouchers.find({}, {"_id": 0}).sort("code", 1).to_list(200)]


@router.post("/admin/vouchers", response_model=Voucher)
async def create_voucher(body: VoucherInput, _: dict = Depends(require_admin)):
    code = body.code.strip().upper()
    if await db.vouchers.find_one({"code": code}):
        raise HTTPException(status_code=409, detail="Voucher code exists")
    voucher = Voucher(**{**body.model_dump(), "code": code})
    await db.vouchers.insert_one(voucher.model_dump())
    return voucher


@router.patch("/admin/vouchers/{id}/toggle", response_model=Voucher)
async def toggle_voucher(id: str, _: dict = Depends(require_admin)):
    doc = await db.vouchers.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Voucher not found")
    doc["active"] = not doc.get("active", True)
    await db.vouchers.update_one({"id": id}, {"$set": {"active": doc["active"]}})
    return Voucher(**doc)


@router.delete("/admin/vouchers/{id}")
async def delete_voucher(id: str, _: dict = Depends(require_admin)):
    res = await db.vouchers.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return {"ok": True}
