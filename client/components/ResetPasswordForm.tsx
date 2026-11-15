"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export default function ResetPasswordForm() {
  const token = useSearchParams().get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <p className="text-center text-red-700">
        This reset link is missing its token. Please use the link from your email.
      </p>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLocalError(null);
    if (password !== confirm) {
      setLocalError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await api<{ message: string }>("/auth/reset-password", {
        method: "POST",
        body: { token, password },
      });
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">✅</p>
        <p className="text-emerald-700">Your password has been changed. Please log in again.</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormError error={error} />
      {localError && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{localError}</div>
      )}

      <div>
        <label htmlFor="password" className={labelClass}>New password</label>
        <input id="password" type="password" required minLength={8} autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label htmlFor="confirm" className={labelClass}>Confirm new password</label>
        <input id="confirm" type="password" required minLength={8} autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
      </div>

      <button disabled={busy} className={primaryButton}>
        {busy ? "Saving..." : "Set new password"}
      </button>
    </form>
  );
}