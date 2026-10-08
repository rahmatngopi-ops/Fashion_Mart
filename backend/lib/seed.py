"""Idempotent seed: admin account + starter catalog. Called at startup and by seed.py."""

import os

from lib.auth import hash_password, verify_password
from lib.db import db
from models.schemas import Product, Voucher

U = "?auto=format&fit=crop&w=900&q=80"
SEED_PRODUCTS = [
    ("Blazer Linen Oversized", "Outerwear", 689000, "https://images.unsplash.com/photo-1691053318576-4bf08315e877" + U,
     "Blazer linen premium potongan oversized, ringan dan adem untuk iklim tropis.", ["Beige", "Hitam"], ["S", "M", "L", "XL"]),
    ("Kemeja Batik Kontemporer", "Atasan", 459000, "https://images.unsplash.com/photo-1740710370552-a49b5b01f80a" + U,
     "Batik cap motif parang modern dengan katun prima, cocok untuk kondangan & kantor.", ["Cokelat", "Navy"], ["M", "L", "XL"]),
    ("Jaket Tailored Navy", "Outerwear", 1290000, "https://images.unsplash.com/photo-1740710748146-a15d840d6f40" + U,
     "Jaket struktural wol campuran dengan lapisan satin, siluet tegas.", ["Navy", "Steel Blue"], ["S", "M", "L"]),
    ("Tote Kulit Vegan", "Aksesoris", 549000, "https://images.unsplash.com/photo-1511556820780-d912e42b4980" + U,
     "Tote bag kulit vegan dengan kompartemen laptop 14 inci.", ["Tan", "Hitam"], []),
    ("Kacamata Tortoiseshell", "Aksesoris", 389000, "https://images.unsplash.com/photo-1537832816519-689ad163238b" + U,
     "Kacamata hitam frame asetat tortoiseshell, lensa UV400.", ["Tortoise"], []),
    ("Setelan Linen Sage", "Setelan", 1890000, "https://images.unsplash.com/photo-1699459867169-515c14378f79" + U,
     "Setelan blazer & celana linen hijau sage, tailoring rapi untuk acara semi-formal.", ["Sage"], ["M", "L", "XL"]),
    ("Kulot Wide-Leg Krem", "Bawahan", 329000, "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1" + U,
     "Celana kulot high-waist bahan crepe jatuh, nyaman untuk kerja & hangout.", ["Krem", "Hitam"], ["S", "M", "L"]),
    ("Syal Sutra Motif Kawung", "Aksesoris", 249000, "https://images.unsplash.com/photo-1601924994987-69e26d50dc26" + U,
     "Syal sutra 90x90 cm motif kawung, bisa jadi hijab, scarf, atau aksen tas.", ["Merah Marun", "Emas"], []),
    ("Dress Midi Satin", "Dress", 799000, "https://images.unsplash.com/photo-1595777457583-95e059d581b8" + U,
     "Dress midi satin slip dengan potongan bias, elegan untuk dinner & kondangan.", ["Champagne", "Hitam"], ["S", "M", "L"]),
    ("Kaos Essential Organik", "Atasan", 179000, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab" + U,
     "Kaos katun organik 24s, potongan relaxed, basic wajib lemari.", ["Putih", "Hitam", "Abu"], ["S", "M", "L", "XL"]),
]


async def seed() -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@fashionmart.id").lower()
    password = os.environ.get("ADMIN_PASSWORD", "Admin123!")
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "id": "admin-fashionmart", "name": "Admin FASHION_MART", "email": email,
            "role": "admin", "password_hash": hash_password(password),
        })
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})

    if await db.products.count_documents({}) == 0:
        docs = [
            Product(name=n, category=c, price=p, stock=25, image_url=img, description=d, colors=col, sizes=sz).model_dump()
            for n, c, p, img, d, col, sz in SEED_PRODUCTS
        ]
        await db.products.insert_many(docs)

    seed_vouchers = [
        Voucher(code="FASHION10", type="percent", value=10, min_spend=300000, max_discount=100000,
                description="Diskon 10% min. belanja Rp300.000 (maks Rp100.000)"),
        Voucher(code="HEMAT50K", type="fixed", value=50000, min_spend=750000,
                description="Potongan Rp50.000 min. belanja Rp750.000"),
        Voucher(code="GRATISONGKIR", type="shipping", value=25000, min_spend=150000,
                description="Gratis ongkir s.d. Rp25.000 min. belanja Rp150.000"),
    ]
    for v in seed_vouchers:
        if not await db.vouchers.find_one({"code": v.code}):
            await db.vouchers.insert_one(v.model_dump())
