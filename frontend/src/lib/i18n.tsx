import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "id" | "en";

const DICT = {
  nav_shop: { id: "Koleksi", en: "Shop" },
  nav_stylist: { id: "AI Stylist", en: "AI Stylist" },
  nav_orders: { id: "Pesanan", en: "Orders" },
  nav_seller: { id: "Seller Studio", en: "Seller Studio" },
  nav_login: { id: "Masuk", en: "Sign in" },
  nav_logout: { id: "Keluar", en: "Sign out" },
  hero_kicker: { id: "Musim Tropis · Edisi 2026", en: "Tropical Season · 2026 Edition" },
  hero_title: { id: "Gaya yang dikurasi,\ndipandu kecerdasan.", en: "Curated style,\nguided by intelligence." },
  hero_sub: {
    id: "Belanja koleksi editorial, minta AI stylist meracik outfit, dan kelola listing di Shopee, Tokopedia, TikTok Shop & Lazada dari satu studio.",
    en: "Shop editorial collections, let an AI stylist build your outfit, and manage listings on Shopee, Tokopedia, TikTok Shop & Lazada from one studio.",
  },
  hero_cta_shop: { id: "Jelajahi Koleksi", en: "Explore Collection" },
  hero_cta_stylist: { id: "Tanya AI Stylist", en: "Ask the AI Stylist" },
  section_new: { id: "Kedatangan Terbaru", en: "New Arrivals" },
  section_see_all: { id: "Lihat semua", en: "View all" },
  feature_stylist_t: { id: "AI Personal Stylist", en: "AI Personal Stylist" },
  feature_stylist_d: { id: "Ceritakan acaramu & budget — dapatkan look lengkap dari koleksi kami.", en: "Tell us the occasion & budget — get a full look from our collection." },
  feature_listing_t: { id: "Generator Listing Multi-Marketplace", en: "Multi-Marketplace Listing Generator" },
  feature_listing_d: { id: "Judul, deskripsi, tag & harga yang dioptimalkan untuk tiap marketplace.", en: "Titles, descriptions, tags & pricing optimized for each marketplace." },
  feature_pay_t: { id: "Pembayaran Aman Midtrans", en: "Secure Midtrans Payments" },
  feature_pay_d: { id: "QRIS, Virtual Account, GoPay, ShopeePay & kartu kredit.", en: "QRIS, Virtual Account, GoPay, ShopeePay & credit cards." },
  all: { id: "Semua", en: "All" },
  search: { id: "Cari produk…", en: "Search products…" },
  add_to_cart: { id: "Tambah ke Tas", en: "Add to Bag" },
  added: { id: "Ditambahkan ke tas", en: "Added to bag" },
  size: { id: "Ukuran", en: "Size" },
  colors: { id: "Warna", en: "Colors" },
  stock: { id: "Stok", en: "Stock" },
  back: { id: "Kembali", en: "Back" },
  cart: { id: "Tas Belanja", en: "Shopping Bag" },
  cart_empty: { id: "Tas belanjamu masih kosong.", en: "Your bag is empty." },
  subtotal: { id: "Subtotal", en: "Subtotal" },
  checkout: { id: "Checkout", en: "Checkout" },
  checkout_title: { id: "Checkout", en: "Checkout" },
  phone: { id: "No. WhatsApp", en: "Phone (WhatsApp)" },
  address: { id: "Alamat pengiriman", en: "Shipping address" },
  pay_midtrans: { id: "Bayar dengan Midtrans", en: "Pay with Midtrans" },
  order_summary: { id: "Ringkasan Pesanan", en: "Order Summary" },
  total: { id: "Total", en: "Total" },
  sandbox_note: { id: "Mode Sandbox: gunakan kartu uji 4811 1111 1111 1114, CVV 123, OTP 112233.", en: "Sandbox mode: use test card 4811 1111 1111 1114, CVV 123, OTP 112233." },
  orders_title: { id: "Riwayat Pesanan", en: "Order History" },
  orders_empty: { id: "Belum ada pesanan.", en: "No orders yet." },
  refresh_status: { id: "Cek status", en: "Check status" },
  pay_now: { id: "Bayar sekarang", en: "Pay now" },
  status_pending: { id: "Menunggu bayar", en: "Awaiting payment" },
  status_paid: { id: "Lunas", en: "Paid" },
  status_failed: { id: "Gagal", en: "Failed" },
  status_expired: { id: "Kedaluwarsa", en: "Expired" },
  login_title: { id: "Selamat datang kembali", en: "Welcome back" },
  register_title: { id: "Buat akun", en: "Create account" },
  name: { id: "Nama lengkap", en: "Full name" },
  email: { id: "Email", en: "Email" },
  password: { id: "Kata sandi", en: "Password" },
  no_account: { id: "Belum punya akun?", en: "No account yet?" },
  have_account: { id: "Sudah punya akun?", en: "Already have an account?" },
  register: { id: "Daftar", en: "Register" },
  demo_admin: { id: "Isi akun demo seller", en: "Fill demo seller account" },
  manifesto: { id: "Mode adalah bahasa. Kami membantumu berbicara lebih fasih.", en: "Fashion is a language. We help you speak it fluently." },
  stylist_title: { id: "Atelier AI Stylist", en: "AI Stylist Atelier" },
  stylist_sub: { id: "Ceritakan acara, gaya, dan budget-mu. Stylist kami meracik look dari koleksi FASHION_MART.", en: "Describe the occasion, style and budget. Our stylist builds looks from the FASHION_MART collection." },
  stylist_placeholder: { id: "Mis. OOTD kondangan modern, budget Rp1,5 juta…", en: "e.g. Modern wedding guest look, budget IDR 1.5M…" },
  stylist_send: { id: "Kirim", en: "Send" },
  stylist_clear: { id: "Mulai ulang", en: "New session" },
  stylist_empty: { id: "Mulai percakapan dengan memilih inspirasi di samping atau tulis sendiri.", en: "Start by picking an inspiration or write your own." },
  stylist_login: { id: "Masuk untuk berkonsultasi dengan AI Stylist.", en: "Sign in to consult the AI Stylist." },
  prompt_1: { id: "OOTD kondangan modern minimalis, budget di bawah Rp1.500.000", en: "Modern minimalist wedding guest outfit under IDR 1.5M" },
  prompt_2: { id: "Smart casual untuk interview kantor di SCBD", en: "Smart casual for an office interview in SCBD" },
  prompt_3: { id: "Look weekend santai ke Bali, tetap stylish", en: "Relaxed but stylish weekend look for Bali" },
  prompt_4: { id: "Padu padan batik untuk acara kantor hari Jumat", en: "Batik mix & match for Friday office event" },
  seller_title: { id: "Seller Studio", en: "Seller Studio" },
  seller_sub: { id: "Katalog terpusat, konten AI per marketplace, dan pesanan toko.", en: "Central catalog, AI content per marketplace, and store orders." },
  tab_catalog: { id: "Katalog", en: "Catalog" },
  tab_listing: { id: "AI Listing", en: "AI Listing" },
  tab_orders: { id: "Pesanan Toko", en: "Store Orders" },
  add_product: { id: "Tambah Produk", en: "Add Product" },
  edit_product: { id: "Ubah Produk", en: "Edit Product" },
  save: { id: "Simpan", en: "Save" },
  cancel: { id: "Batal", en: "Cancel" },
  delete: { id: "Hapus", en: "Delete" },
  category: { id: "Kategori", en: "Category" },
  price: { id: "Harga", en: "Price" },
  image_url: { id: "URL Gambar", en: "Image URL" },
  description: { id: "Deskripsi", en: "Description" },
  colors_csv: { id: "Warna (pisahkan koma)", en: "Colors (comma separated)" },
  sizes_csv: { id: "Ukuran (pisahkan koma)", en: "Sizes (comma separated)" },
  pick_product: { id: "Pilih produk dari katalog", en: "Pick a catalog product" },
  product_name: { id: "Nama produk", en: "Product name" },
  seller_notes: { id: "Catatan (bahan, keunggulan, target pembeli)", en: "Notes (material, USP, target buyer)" },
  generate: { id: "Generate Listing AI", en: "Generate AI Listing" },
  generating: { id: "AI sedang menulis…", en: "AI is writing…" },
  export_csv: { id: "Ekspor CSV", en: "Export CSV" },
  copy: { id: "Salin", en: "Copy" },
  copied: { id: "Disalin ke clipboard", en: "Copied to clipboard" },
  title: { id: "Judul", en: "Title" },
  tags: { id: "Tag", en: "Tags" },
  suggested_price: { id: "Harga saran", en: "Suggested price" },
  listing_empty: { id: "Hasil listing per marketplace akan muncul di sini.", en: "Per-marketplace listings will appear here." },
  customer: { id: "Pelanggan", en: "Customer" },
  error_generic: { id: "Terjadi kesalahan, coba lagi.", en: "Something went wrong, please retry." },
  footer_tag: { id: "Rumah mode digital Indonesia, didukung AI.", en: "Indonesia's AI-powered digital fashion house." },
  ord_awaiting_payment: { id: "Belum Bayar", en: "Unpaid" },
  ord_paid: { id: "Perlu Dikemas", en: "To Pack" },
  ord_packed: { id: "Dikemas", en: "Packed" },
  ord_shipped: { id: "Dikirim", en: "Shipped" },
  ord_completed: { id: "Selesai", en: "Completed" },
  ord_cancelled: { id: "Dibatalkan", en: "Cancelled" },
  buy_now: { id: "Beli Sekarang", en: "Buy Now" },
  pick_variant: { id: "Pilih warna & ukuran terlebih dahulu", en: "Please choose color & size first" },
  quantity: { id: "Jumlah", en: "Quantity" },
  recipient: { id: "Nama penerima", en: "Recipient name" },
  region: { id: "Wilayah pengiriman", en: "Shipping region" },
  courier: { id: "Kurir", en: "Courier" },
  etd_days: { id: "hari", en: "days" },
  shipping: { id: "Ongkos kirim", en: "Shipping" },
  voucher: { id: "Voucher", en: "Voucher" },
  voucher_placeholder: { id: "Masukkan kode voucher", en: "Enter voucher code" },
  apply: { id: "Pakai", en: "Apply" },
  remove: { id: "Hapus", en: "Remove" },
  discount: { id: "Diskon", en: "Discount" },
  note_seller: { id: "Catatan untuk penjual (opsional)", en: "Note for seller (optional)" },
  shipping_info: { id: "Info Pengiriman", en: "Shipping Info" },
  select_region_first: { id: "Pilih wilayah untuk melihat ongkir", en: "Choose a region to see shipping costs" },
  order_detail: { id: "Detail Pesanan", en: "Order Detail" },
  timeline: { id: "Lacak Pesanan", en: "Order Tracking" },
  tracking_no: { id: "No. Resi", en: "Tracking No." },
  cancel_order: { id: "Batalkan Pesanan", en: "Cancel Order" },
  cancel_confirm: { id: "Yakin batalkan pesanan ini?", en: "Cancel this order?" },
  order_received: { id: "Pesanan Diterima", en: "Order Received" },
  view_detail: { id: "Lihat detail", en: "View detail" },
  act_pack: { id: "Kemas Pesanan", en: "Pack Order" },
  act_ship: { id: "Kirim + Resi", en: "Ship + Tracking" },
  act_complete: { id: "Tandai Selesai", en: "Mark Completed" },
  act_cancel: { id: "Batalkan", en: "Cancel" },
  input_resi: { id: "Masukkan nomor resi", en: "Enter tracking number" },
  tab_vouchers: { id: "Voucher", en: "Vouchers" },
  add_voucher: { id: "Tambah Voucher", en: "Add Voucher" },
  min_spend: { id: "Min. belanja", en: "Min. spend" },
  max_discount: { id: "Maks. diskon (0 = tanpa batas)", en: "Max discount (0 = no cap)" },
  value: { id: "Nilai", en: "Value" },
  active: { id: "Aktif", en: "Active" },
  all_orders: { id: "Semua", en: "All" },
  payment_method: { id: "Metode bayar", en: "Payment method" },
} as const;

export type DictKey = keyof typeof DICT;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: DictKey) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (localStorage.getItem("fm_lang") === "en" ? "en" : "id"));
  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("fm_lang", l);
    document.documentElement.lang = l;
    setLangState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang, t: (k: DictKey) => DICT[k][lang] }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n outside provider");
  return ctx;
}
