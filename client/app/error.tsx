"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="mt-3 text-xl font-semibold">Something went wrong</h1>
      <p className="mt-1 text-slate-600">An unexpected error happened. You can try again.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}