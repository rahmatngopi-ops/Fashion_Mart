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

export interface CartItemInput {
  product_id: string;
  quantity: number;
  size: string;
}

export interface CheckoutInput {
  items: CartItemInput[];
  phone: string;
  address: string;
}

export interface OrderItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  size: string;
  image_url: string;
}

export interface Order {
  id: string;
  order_code: string;
  user_id: string;
  items: OrderItem[];
  gross_amount: number;
  phone: string;
  address: string;
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

export interface MidtransConfig {
  client_key: string;
  is_production: boolean;
  snap_url: string;
}
