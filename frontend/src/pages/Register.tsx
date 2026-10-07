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
import { AuthShell } from "@/pages/Login";

export default function Register() {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost<User>("/auth/register", form);
      beginSession();
      window.location.assign("/products");
    } catch (err) {
      toast.error(errMsg(err, t("error_generic")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <form onSubmit={submit} className="w-full space-y-5" data-testid="register-form">
        <h1 className="font-heading text-4xl">{t("register_title")}</h1>
        <div className="space-y-2">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" data-testid="register-name-input" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11" data-testid="register-email-input" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Input id="password" type="password" minLength={6} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11" data-testid="register-password-input" />
        </div>
        <Button type="submit" disabled={busy} className="h-11 w-full" data-testid="auth-register-submit-btn">{t("register")}</Button>
        <p className="text-sm text-muted-foreground">
          {t("have_account")} <Link to="/login" className="text-brand underline-offset-4 hover:underline" data-testid="register-login-link">{t("nav_login")}</Link>
        </p>
      </form>
    </AuthShell>
  );
}
