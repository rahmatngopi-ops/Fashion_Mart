from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_admin
from lib.db import db
from models.schemas import Product, ProductInput

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[Product])
async def list_products(category: str | None = None, q: str | None = None):
    query: dict = {}
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.products.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [Product(**d) for d in docs]


@router.get("/{id}", response_model=Product)
async def get_product(id: str):
    doc = await db.products.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**doc)


@router.post("", response_model=Product)
async def create_product(body: ProductInput, _: dict = Depends(require_admin)):
    product = Product(**body.model_dump())
    await db.products.insert_one(product.model_dump())
    return product


@router.put("/{id}", response_model=Product)
async def update_product(id: str, body: ProductInput, _: dict = Depends(require_admin)):
    res = await db.products.update_one({"id": id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return Product(**(await db.products.find_one({"id": id}, {"_id": 0})))


@router.delete("/{id}")
async def delete_product(id: str, _: dict = Depends(require_admin)):
    res = await db.products.delete_one({"id": id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"ok": True}
