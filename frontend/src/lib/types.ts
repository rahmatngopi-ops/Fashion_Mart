// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type Role = "customer" | "admin";
export type Marketplace = "shopee" | "tokopedia" | "tiktok" | "lazada";
export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface MarketplaceListing {
  marketplace: Marketplace;
  title: string;
  description: string;
  tags: string[];
  suggested_price: number;
}

export interface ProductInput {
  name: string;
  category: string;
  price: number;
  stock: number;
  image_url: string;
  description: string;
  colors: string[];
  sizes: string[];
}

export interface Product extends ProductInput {
  id: string;
  listings: MarketplaceListing[];
  created_at: string;
}

export interface ListingRequest {
  product_id?: string | null;
  name: string;
  notes: string;
  category: string;
  base_price?: number | null;
}

export interface ListingResponse {
  listings: MarketplaceListing[];
}

export interface StylistMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type OrderStatus = "awaiting_payment" | "paid" | "packed" | "shipped" | "completed" | "cancelled";

export interface CartItemInput {
  product_id: string;
  quantity: number;
  size: string;
  color: string;
}

export interface CheckoutInput {
  items: CartItemInput[];
  recipient_name: string;
  phone: string;
  address: string;
  zone: string;
  courier: string;
  voucher_code: string;
  note: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  color: string;
  image_url: string;
}

export interface TimelineEntry {
  status: OrderStatus;
  at: string;
  note: string;
}

export interface Order {
  id: string;
  order_code: string;
  user_id: string;
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  discount: number;
  gross_amount: number;
  voucher_code: string;
  courier: string;
  courier_label: string;
  zone_label: string;
  recipient_name: string;
  phone: string;
  address: string;
  note: string;
  status: OrderStatus;
  tracking_number: string;
  timeline: TimelineEntry[];
  payment_status: PaymentStatus;
  midtrans_status: string | null;
  payment_type: string | null;
  snap_token: string | null;
  created_at: string;
}

export interface CheckoutResponse {
  order: Order;
  token: string;
  redirect_url: string;
}

export interface AdminStatusUpdate {
  status: "packed" | "shipped" | "completed" | "cancelled";
  tracking_number: string;
}

export interface ShippingZone {
  code: string;
  label: string;
  multiplier: number;
}

export interface CourierOption {
  code: string;
  name: string;
  service: string;
  base_cost: number;
  etd: string;
}

export interface ShippingOptions {
  zones: ShippingZone[];
  couriers: CourierOption[];
}

export type VoucherType = "percent" | "fixed" | "shipping";

export interface VoucherInput {
  code: string;
  type: VoucherType;
  value: number;
  min_spend: number;
  max_discount: number;
  description: string;
  active: boolean;
}

export interface Voucher extends VoucherInput {
  id: string;
}

export interface VoucherValidateResult {
  code: string;
  discount: number;
  description: string;
}

export interface MidtransConfig {
  client_key: string;
  is_production: boolean;
  snap_url: string;
}
