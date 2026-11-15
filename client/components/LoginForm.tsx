"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import FormError from "./FormError";
import { HOME_BY_ROLE, safeNext } from "@/lib/auth-helpers";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export default function LoginForm() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  // pehle se login hai to seedha andar
  useEffect(() => {
    if (user) router.replace(next ?? HOME_BY_ROLE[user.role]);
  }, [user, next, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const u = await login(email, password);
      router.replace(next ?? HOME_BY_ROLE[u.role]);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

   if (loading || user) {
    return <p className="text-center text-sm text-slate-500">Checking your session...</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormError error={error} />

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>

      <button disabled={busy} className={primaryButton}>
        {busy ? "Logging in..." : "Log in"}
      </button>

      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-indigo-600 hover:underline">
          Forgot password?
        </Link>
        <Link href="/register" className="text-indigo-600 hover:underline">
          Create an account
        </Link>
      </div>
    </form>
  );
}