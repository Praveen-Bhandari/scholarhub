"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";

type Result = { kind: "ok" | "error"; message: string } | null;

export default function VerifyEmail() {
  const token = useSearchParams().get("token");
  const [result, setResult] = useState<Result>(null);
  const started = useRef(false);

  useEffect(() => {
    // dev me React effect do baar chalata hai; token ek hi baar chalta hai, isliye ek baar hi bhejo
    if (!token || started.current) return;
    started.current = true;

    api<{ message: string }>("/auth/verify-email", { method: "POST", body: { token } })
      .then((d) => setResult({ kind: "ok", message: d.message }))
      .catch((e) =>
        setResult({
          kind: "error",
          message: e instanceof ApiError ? e.message : "Something went wrong. Please try again.",
        })
      );
  }, [token]);

  const shown: Result = !token
    ? { kind: "error", message: "This verification link is missing its token." }
    : result;

  if (!shown) return <p className="text-center text-slate-600">Verifying your email...</p>;

  return (
    <div className="space-y-4 text-center">
      <p className="text-4xl">{shown.kind === "ok" ? "✅" : "⚠️"}</p>
      <p className={shown.kind === "ok" ? "text-emerald-700" : "text-red-700"}>{shown.message}</p>
      <Link
        href="/login"
        className="inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        Go to log in
      </Link>
    </div>
  );
}