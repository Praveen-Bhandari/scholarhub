"use client";

import { useState } from "react";
import AdminAnalytics from "./AdminAnalytics";
import AdminReviewQueue from "./AdminReviewQueue";
import AdminUsers from "./AdminUsers";

type Tab = "review" | "users" | "analytics";

export default function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("review");

  const tabClass = (active: boolean) =>
    `border-b-2 px-4 py-2 text-sm font-semibold ${
      active ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="text-slate-600">Review courses, manage users and watch the platform.</p>

      <div className="mt-6 flex gap-2 border-b border-slate-200">
        <button onClick={() => setTab("review")} className={tabClass(tab === "review")}>
          Course review
        </button>
        <button onClick={() => setTab("users")} className={tabClass(tab === "users")}>
          Users
        </button>
        <button onClick={() => setTab("analytics")} className={tabClass(tab === "analytics")}>
          Analytics
        </button>
      </div>

      <div className="mt-6">
        {tab === "review" && <AdminReviewQueue />}
        {tab === "users" && <AdminUsers />}
        {tab === "analytics" && <AdminAnalytics />}
      </div>
    </main>
  );
}