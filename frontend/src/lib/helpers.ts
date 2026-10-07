import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet } from "./api";
import type { MidtransConfig, User } from "./types";

export const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await apiGet<User>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
}

export function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body) {
    const d = (e.body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return fallback;
}

// ---------- Midtrans Snap loader ----------
interface SnapCallbacks {
  onSuccess?: (r: unknown) => void;
  onPending?: (r: unknown) => void;
  onError?: (r: unknown) => void;
  onClose?: () => void;
}
declare global {
  interface Window {
    snap?: { pay: (token: string, cb?: SnapCallbacks) => void };
  }
}

let snapPromise: Promise<void> | null = null;

export function loadSnap(): Promise<void> {
  if (window.snap) return Promise.resolve();
  if (!snapPromise) {
    snapPromise = apiGet<MidtransConfig>("/config/midtrans").then(
      (cfg) =>
        new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = cfg.snap_url;
          s.setAttribute("data-client-key", cfg.client_key);
          s.onload = () => resolve();
          s.onerror = () => {
            snapPromise = null;
            reject(new Error("snap load failed"));
          };
          document.head.appendChild(s);
        }),
    );
  }
  return snapPromise;
}

export async function paySnap(token: string, cb: SnapCallbacks): Promise<void> {
  await loadSnap();
  if (!window.snap) throw new Error("snap unavailable");
  window.snap.pay(token, cb);
}
