"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BarChart from "./BarChart";
import StatCard from "./StatCard";
import StatusBadge from "./StatusBadge";
import { api } from "@/lib/api";
import { formatMoney, formatMonth } from "@/lib/format";
import type { InstructorCourseRow, InstructorOverview, MonthPoint } from "@/lib/types";

export default function InstructorDashboard() {
  const [overview, setOverview] = useState<InstructorOverview | null>(null);
  const [courses, setCourses] = useState<InstructorCourseRow[] | null>(null);
  const [monthly, setMonthly] = useState<MonthPoint[] | null>(null);
  const [months, setMonths] = useState(6);
  const [metric, setMetric] = useState<"revenue" | "enrollments">("revenue");
  const [error, setError] = useState<string | null>(null);

  // overview aur courses ek baar
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ overview: InstructorOverview }>("/analytics/instructor/overview"),
      api<{ courses: InstructorCourseRow[] }>("/analytics/instructor/courses"),
    ])
      .then(([o, c]) => {
        if (cancelled) return;
        setOverview(o.overview);
        setCourses(c.courses);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // chart: mahino ki sankhya badalne par dobara
  useEffect(() => {
    let cancelled = false;
    api<{ months: MonthPoint[] }>(`/analytics/instructor/monthly?months=${months}`)
      .then((d) => {
        if (!cancelled) setMonthly(d.months);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [months]);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Instructor dashboard</h1>
          <p className="text-slate-600">Your courses, students and earnings.</p>
        </div>
        <Link
          href="/instructor/courses/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
        >
          + New course
        </Link>
      </div>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

      {overview && (
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            label="Courses"
            value={overview.courses.total}
            hint={`${overview.courses.approved} live · ${overview.courses.submitted} in review · ${overview.courses.draft} draft`}
          />
          <StatCard label="Students" value={overview.students} hint="unique learners" />
          <StatCard label="Enrollments" value={overview.enrollments} />
          <StatCard label="Revenue" value={formatMoney(overview.revenue)} />
          <StatCard
            label="Completion rate"
            value={`${overview.completionRate}%`}
            hint={`${overview.completedEnrollments} finished`}
          />
          <StatCard
            label="Average rating"
            value={overview.totalReviews > 0 ? `★ ${overview.averageRating.toFixed(1)}` : "No reviews yet"}
            hint={`${overview.totalReviews} reviews`}
          />
        </div>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Last {months} months</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMetric("revenue")} className={pill(metric === "revenue")}>Revenue</button>
            <button onClick={() => setMetric("enrollments")} className={pill(metric === "enrollments")}>Enrollments</button>
            <span className="mx-1 w-px bg-slate-200" />
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => setMonths(m)} className={pill(months === m)}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        {monthly ? (
          <BarChart
            data={monthly.map((p) => ({
              label: formatMonth(p.month),
              value: metric === "revenue" ? p.revenue : p.enrollments,
            }))}
            format={metric === "revenue" ? formatMoney : (n) => String(n)}
            color={metric === "revenue" ? "bg-indigo-500" : "bg-emerald-500"}
          />
        ) : (
          <p className="py-10 text-center text-slate-500">Loading chart...</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">My courses</h2>
        {!courses && !error && <p className="text-slate-500">Loading courses...</p>}

        {courses && courses.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-semibold">You have not created a course yet</p>
            <Link
              href="/instructor/courses/new"
              className="mt-4 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
            >
              Create your first course
            </Link>
          </div>
        )}

        {courses && courses.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Students</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">Completion</th>
                  <th className="px-4 py-3 text-right font-medium">Rating</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((c) => (
                  <tr key={c._id}>
                    <td className="max-w-xs px-4 py-3 font-medium">
                      <Link href={`/instructor/courses/${c._id}`} className="hover:text-indigo-600">
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-right">{c.students}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(c.revenue)}</td>
                    <td className="px-4 py-3 text-right">{c.students > 0 ? `${c.completionRate}%` : "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {c.reviewCount > 0 ? `★ ${c.averageRating.toFixed(1)} (${c.reviewCount})` : "-"}
                    </td>
                    <td className="space-x-3 px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/instructor/courses/${c._id}`} className="text-indigo-600 hover:underline">
                        Edit
                      </Link>
                      {c.status === "approved" && (
                        <Link href={`/courses/${c._id}`} className="text-slate-600 hover:underline">
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}