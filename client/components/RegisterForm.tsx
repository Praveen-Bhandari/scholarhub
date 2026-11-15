"use client";

import Link from "next/link";
import { useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "instructor">("student");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api<{ message: string }>("/auth/register", {
        method: "POST",
        body: { name, email, password, role },
      });
      setDoneEmail(email);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (doneEmail) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl">✉️</p>
        <h2 className="text-xl font-semibold">Check your email</h2>
        <p className="text-sm text-slate-600">
          We sent a verification link to <strong>{doneEmail}</strong>. Open it to activate your
          account, then log in.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-indigo-600 hover:underline">
          Go to log in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <FormError error={error} />

      <div>
        <label htmlFor="name" className={labelClass}>Full name</label>
        <input id="name" required maxLength={80} value={name}
          onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>Password</label>
        <input id="password" type="password" required minLength={8} autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
      </div>

      <fieldset>
        <legend className={labelClass}>I want to</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["student", "Learn"],
              ["instructor", "Teach"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm font-medium ${
                role === value
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <button disabled={busy} className={primaryButton}>
        {busy ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}