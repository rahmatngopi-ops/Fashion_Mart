import { Routes, Route } from "react-router-dom";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Products from "@/pages/Products";
import ProductDetail from "@/pages/ProductDetail";
import Stylist from "@/pages/Stylist";
import Seller from "@/pages/Seller";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Checkout from "@/pages/Checkout";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Creator from "@/pages/Creator";
import SupportPage from "@/pages/SupportPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/stylist" element={<Stylist />} />
        <Route path="/seller" element={<Seller />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/creator" element={<Creator />} />
        <Route path="/s/:handle" element={<SupportPage />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
