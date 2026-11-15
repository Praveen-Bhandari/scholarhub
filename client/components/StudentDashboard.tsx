"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import ProgressBar from "./ProgressBar";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { EnrollmentRow } from "@/lib/types";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EnrollmentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ enrollments: EnrollmentRow[] }>("/enrollments/mine")
      .then((d) => {
        if (!cancelled) setRows(d.enrollments);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = rows?.filter((r) => r.completedAt).length ?? 0;
  const inProgress = (rows?.length ?? 0) - completed;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">My learning</h1>
      <p className="text-slate-600">Welcome back{user ? `, ${user.name}` : ""}.</p>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {!rows && !error && <p className="mt-6 text-slate-500">Loading your courses...</p>}

      {rows && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              ["Enrolled", rows.length],
              ["In progress", inProgress],
              ["Completed", completed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-3xl font-bold">{value}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-lg font-semibold">You have not enrolled in any course yet</p>
              <Link
                href="/courses"
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
              >
                Browse courses
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((e) => (
                <div key={e._id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium capitalize text-indigo-700">
                      {e.course.category}
                    </span>
                    <span className="capitalize text-slate-500">{e.course.level}</span>
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-semibold">{e.course.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">Enrolled {formatDate(e.createdAt)}</p>

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-sm text-slate-600">
                      <span>
                        {e.completedCount} of {e.totalLessons} lessons
                      </span>
                      <span>{e.progressPercent}%</span>
                    </div>
                    <ProgressBar percent={e.progressPercent} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/learn/${e.course._id}`}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      {e.progressPercent >= 100 ? "Review" : e.completedCount > 0 ? "Continue" : "Start"}
                    </Link>
                    {e.certificateId && (
                      <Link
                        href={`/certificates/${e.certificateId}`}
                        className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        Certificate
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}