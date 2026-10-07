import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { User } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { errMsg } from "@/lib/helpers";
import { beginSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IMG = "https://images.unsplash.com/photo-1649217708362-4368faa2559b?auto=format&fit=crop&w=1000&q=80";

export function AuthShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto grid max-w-7xl gap-0 px-4 py-10 md:grid-cols-2 md:px-8 md:py-16">
      <div className="relative hidden overflow-hidden rounded-l-sm md:block">
        <img src={IMG} alt="Lookbook" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,19,0.2)_0%,rgba(20,20,19,0.75)_100%)]" />
        <p className="absolute bottom-8 left-8 right-8 font-heading text-3xl italic leading-snug text-white">“{t("manifesto")}”</p>
      </div>
      <div className="flex items-center rounded-sm border border-border bg-white p-8 md:rounded-l-none md:p-12">{children}</div>
    </div>
  );
}

export default function Login() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await apiPost<User>("/auth/login", { email, password });
      beginSession();
      window.location.assign(user.role === "admin" ? "/seller" : "/products");
    } catch (err) {
      toast.error(errMsg(err, t("error_generic")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={submit} className="w-full space-y-5" data-testid="login-form">
        <h1 className="font-heading text-4xl">{t("login_title")}</h1>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" data-testid="login-email-input" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" data-testid="login-password-input" />
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full" data-testid="auth-login-submit-btn">{t("nav_login")}</Button>
        <button
          type="button"
          className="w-full rounded-sm border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors duration-200 hover:border-brand hover:text-brand"
          onClick={() => { setEmail("admin@fashionmart.id"); setPassword("Admin123!"); }}
          data-testid="login-demo-admin-btn"
        >
          {t("demo_admin")}
        </button>
        <p className="text-sm text-muted-foreground">
          {t("no_account")} <Link to="/register" className="text-brand underline-offset-4 hover:underline" data-testid="login-register-link">{t("register")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
