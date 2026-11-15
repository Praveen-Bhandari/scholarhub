"use client";

import Link from "next/link";
import { useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // email registered ho ya na ho, backend ka jawab ek jaisa hota hai
      const d = await api<{ message: string }>("/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setMessage(d.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (message) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl">✉️</p>
        <p className="text-sm text-slate-600">{message}</p>
        <Link href="/login" className="inline-block text-sm font-medium text-indigo-600 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormError error={error} />
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>
      <button disabled={busy} className={primaryButton}>
        {busy ? "Sending..." : "Send reset link"}
      </button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">Back to log in</Link>
      </p>
    </form>
  );
}