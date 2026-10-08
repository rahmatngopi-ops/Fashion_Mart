# FASHION_MART — Spec

Fashion AI multi-marketplace web app (bilingual ID/EN, default ID).

## Features
- Storefront: `/` editorial home, `/products` catalog (category filter + search), `/product/:id` detail (size select, add to bag). Cart = localStorage (`fm_cart`) + Sheet drawer.
- Checkout `/checkout` (login required): phone + address → `POST /api/orders/checkout` creates order (server-priced) + Midtrans Snap token (SANDBOX, real keys) → Snap popup → on close/success `POST /api/orders/{id}/refresh` reconciles with Midtrans Status API. `/orders` lists orders with status, "Cek status" and "Bayar sekarang".
- Webhook: `POST /api/webhooks/midtrans` (SHA-512 signature verify, then status API reconcile). Paid → stock decremented.
- AI Stylist `/stylist` (login required): Gemini 3 Flash (`gemini-3-flash-preview`) via Emergent LLM key, SSE stream `POST /api/ai/stylist/stream`; history in `stylist_messages`; product suggestions as `[[product:ID]]` tokens rendered as chips.
- Seller Studio `/seller` (admin only): AI Listing tab (`POST /api/ai/listing` → 4 listings shopee/tokopedia/tiktok/lazada, saved to product.listings when product_id given; copy buttons; client-side CSV export), Catalog CRUD tab, Store Orders tab (`GET /api/admin/orders`).
- Real marketplace APIs NOT connected (content is copy/CSV export).

## Marketplace-style orders (v2)
- Product detail: color + size REQUIRED (when product has them), quantity stepper, "Tambah ke Tas" and "Beli Sekarang" (Buy Now → /checkout with router state, bypasses cart, cart untouched).
- Checkout: recipient, phone, address, shipping zone (5 flat zones × multiplier) + courier (JNE REG/YES, J&T EZ, SiCepat REG/BEST; `GET /api/shipping/options`, cost = round(base*mult/500)*500, server recomputes), voucher (`POST /api/vouchers/validate`), note. Midtrans item_details include SHIPPING and negative VOUCHER line.
- Order.status: awaiting_payment → paid (auto on Midtrans settlement, stock decremented) → packed (seller) → shipped (seller, tracking_number required) → completed (buyer "Pesanan Diterima" or seller). cancelled: buyer `POST /orders/{id}/cancel` allowed in awaiting_payment (also cancels Midtrans txn) or paid (stock restored); seller via `PATCH /api/admin/orders/{id}/status`. Failed/expired payment → cancelled. Every change pushes a `timeline` entry {status, at, note}.
- Pages: `/orders` (status filter tabs), `/orders/:id` (stepper, timeline, resi, actions). Seller Studio "Pesanan Toko" tab: status counters + Kemas / Kirim+Resi dialog / Selesai / Batalkan; "Voucher" tab: create/toggle/delete.
- Seeded vouchers: FASHION10 (10%, min 300k, max 100k), HEMAT50K (Rp50k, min 750k), GRATISONGKIR (shipping up to 25k, min 150k).

## Auth
JWT in httpOnly cookie `fm_session` (7 days). `/api/auth/register|login|logout|me`. Roles: customer (register), admin (seeded).

## Data (Mongo)
users{id,name,email,role,password_hash}, products{id,name,category,price,stock,image_url,description,colors,sizes,listings,created_at}, orders{id,order_code,user_id,items,gross_amount,phone,address,payment_status,midtrans_status,payment_type,snap_token,created_at}, stylist_messages{id,user_id,role,content,created_at}.

## Seed (startup, idempotent)
Admin admin@fashionmart.id / Admin123!; 10 products (e.g. "Blazer Linen Oversized" Rp689.000, "Kaos Essential Organik" Rp179.000).
