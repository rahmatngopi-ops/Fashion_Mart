import json
import logging
import os
import re
import uuid

from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from lib.auth import get_current_user, require_admin
from lib.db import db
from models.schemas import ListingRequest, ListingResponse, MarketplaceListing, StylistMessage, StylistRequest

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)
MODEL = ("gemini", "gemini-3-flash-preview")

LISTING_SYSTEM = """Kamu adalah copywriter e-commerce fashion Indonesia yang ahli SEO marketplace.
Balas HANYA dengan JSON valid (tanpa markdown) berbentuk:
{"listings":[{"marketplace":"shopee","title":"...","description":"...","tags":["..."],"suggested_price":123000}, ...]}
Wajib 4 item, marketplace berurutan: shopee, tokopedia, tiktok, lazada.
Aturan per marketplace:
- shopee: judul maks 100 karakter, padat kata kunci pencarian populer; deskripsi dengan poin bullet (•), info bahan, ukuran, cara perawatan; 8-10 tag tanpa #.
- tokopedia: judul maks 70 karakter gaya official store; deskripsi terstruktur dengan bagian Spesifikasi, Detail Ukuran, Catatan; 6-8 tag.
- tiktok: judul maks 60 karakter yang catchy; deskripsi dibuka dengan hook kuat + emoji secukupnya + CTA; tag berupa hashtag tren (dengan #) 6-10 buah.
- lazada: judul maks 120 karakter format Brand + Nama + Fitur; deskripsi profesional dengan highlight; 6-8 tag.
suggested_price dalam Rupiah (integer), sesuaikan strategi tiap marketplace dari harga dasar jika ada.
Bahasa: Indonesia."""


def _chat(session_id: str, system: str) -> LlmChat:
    return LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=session_id, system_message=system).with_model(*MODEL)


def _parse_json(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("no json")
    return json.loads(match.group(0))


@router.post("/listing", response_model=ListingResponse)
async def generate_listing(body: ListingRequest, _: dict = Depends(require_admin)):
    prompt = (
        f"Nama produk: {body.name}\nKategori: {body.category or '-'}\n"
        f"Harga dasar: {body.base_price or 'tidak ada'}\nCatatan penjual: {body.notes or '-'}"
    )
    text = ""
    try:
        async for ev in _chat(f"listing-{uuid.uuid4()}", LISTING_SYSTEM).stream_message(UserMessage(text=prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
        data = _parse_json(text)
        listings = [MarketplaceListing(**item) for item in data["listings"]]
    except Exception as exc:  # LLM or parse failure
        logger.error("listing generation failed: %s | %s", exc, text[:300])
        raise HTTPException(status_code=502, detail="AI generation failed, please retry")
    if body.product_id:
        await db.products.update_one(
            {"id": body.product_id}, {"$set": {"listings": [item.model_dump() for item in listings]}}
        )
    return ListingResponse(listings=listings)


async def _stylist_system(lang: str) -> str:
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "category": 1, "price": 1, "colors": 1}).to_list(200)
    catalog = "\n".join(
        f"- id={p['id']} | {p['name']} | {p['category']} | Rp{p['price']:,} | warna: {', '.join(p.get('colors', []))}"
        for p in products
    )
    language = "Bahasa Indonesia" if lang == "id" else "English"
    return f"""You are the FASHION_MART AI personal stylist — warm, editorial, concise. Reply in {language}.
Help shoppers with outfit mix & match for their occasion, body type, weather (Indonesia tropical) and budget.
Recommend items ONLY from this store catalog when suggesting products:
{catalog}
When you recommend a catalog item, include the exact token [[product:ID]] right after mentioning it (ID from the list).
Structure answers with short markdown: a look name as **bold**, bullet points per piece, styling tips, and total estimated price in Rupiah when relevant.
Keep it under 220 words."""


@router.get("/stylist/history", response_model=list[StylistMessage])
async def stylist_history(user: dict = Depends(get_current_user)):
    docs = await db.stylist_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return [StylistMessage(**d) for d in docs]


@router.delete("/stylist/history")
async def clear_stylist_history(user: dict = Depends(get_current_user)):
    await db.stylist_messages.delete_many({"user_id": user["id"]})
    return {"ok": True}


@router.post("/stylist/stream")
async def stylist_stream(body: StylistRequest, user: dict = Depends(get_current_user)):
    history = await db.stylist_messages.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
    history.reverse()
    context = "\n".join(f"{m['role'].upper()}: {m['content']}" for m in history)
    prompt = (f"Previous conversation:\n{context}\n\nNEW MESSAGE: " if context else "") + body.message
    system = await _stylist_system(body.lang)
    user_msg = StylistMessage(role="user", content=body.message)
    await db.stylist_messages.insert_one({**user_msg.model_dump(), "user_id": user["id"]})

    async def gen():
        full = ""
        try:
            async for ev in _chat(f"stylist-{user['id']}-{uuid.uuid4()}", system).stream_message(UserMessage(text=prompt)):
                if isinstance(ev, TextDelta):
                    full += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    break
        except Exception as exc:
            logger.error("stylist stream failed: %s", exc)
            yield f"data: {json.dumps({'error': 'AI stylist unavailable, please retry'})}\n\n"
        if full:
            msg = StylistMessage(role="assistant", content=full)
            await db.stylist_messages.insert_one({**msg.model_dump(), "user_id": user["id"]})
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
