"use client";

import { useAuth } from "./AuthProvider";

export default function PlaceholderDashboard({ title }: { title: string }) {
  const { user, loading } = useAuth();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-slate-600">
        {loading
          ? "Loading..."
          : user
            ? `Logged in as ${user.name} (${user.role}).`
            : "You are not logged in."}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        This is a placeholder. The real dashboard comes in the next steps.
      </p>
    </main>
  );
}