"use client";

import { useEffect, useState } from "react";
import BarChart from "./BarChart";
import StatCard from "./StatCard";
import { api } from "@/lib/api";
import { formatMoney, formatMonth, formatPrice } from "@/lib/format";
import type { AdminOverview, MonthPoint, TopCourseRow, TopInstructorRow } from "@/lib/types";

type Metric = "revenue" | "enrollments" | "newUsers";
type TopBy = "enrollments" | "revenue" | "rating";

const METRIC_LABEL: Record<Metric, string> = {
  revenue: "Revenue",
  enrollments: "Enrollments",
  newUsers: "New users",
};
const METRIC_COLOR: Record<Metric, string> = {
  revenue: "bg-indigo-500",
  enrollments: "bg-emerald-500",
  newUsers: "bg-amber-500",
};

export default function AdminAnalytics() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [instructors, setInstructors] = useState<TopInstructorRow[] | null>(null);
  const [monthly, setMonthly] = useState<MonthPoint[] | null>(null);
  const [courses, setCourses] = useState<TopCourseRow[] | null>(null);
  const [months, setMonths] = useState(6);
  const [metric, setMetric] = useState<Metric>("revenue");
  const [by, setBy] = useState<TopBy>("enrollments");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ overview: AdminOverview }>("/analytics/admin/overview"),
      api<{ instructors: TopInstructorRow[] }>("/analytics/admin/top-instructors?limit=5"),
    ])
      .then(([o, i]) => {
        if (cancelled) return;
        setOverview(o.overview);
        setInstructors(i.instructors);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<{ months: MonthPoint[] }>(`/analytics/admin/monthly?months=${months}`)
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

  // top courses: by badalne par
  useEffect(() => {
    let cancelled = false;
    api<{ courses: TopCourseRow[] }>(`/analytics/admin/top-courses?by=${by}&limit=5`)
      .then((d) => {
        if (!cancelled) setCourses(d.courses);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [by]);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;

  function pickMetric(m: Metric) {
    setMetric(m);
  }
  function pickMonths(m: number) {
    setMonths(m);
  }

  return (
    <div className="space-y-8">
      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

      {overview && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            label="Users"
            value={overview.users.total}
            hint={`${overview.users.student} students · ${overview.users.instructor} instructors · ${overview.users.admin} admins · +${overview.users.newLast30Days} in 30 days`}
          />
          <StatCard
            label="Courses"
            value={overview.courses.total}
            hint={`${overview.courses.approved} live · ${overview.courses.pendingReview} in review · ${overview.courses.draft} draft · ${overview.courses.rejected} rejected`}
          />
          <StatCard
            label="Enrollments"
            value={overview.enrollments.total}
            hint={`+${overview.enrollments.last30Days} in 30 days`}
          />
          <StatCard
            label="Revenue"
            value={formatMoney(overview.revenue.total)}
            hint={`${formatMoney(overview.revenue.last30Days)} in 30 days`}
          />
          <StatCard
            label="Completion rate"
            value={`${overview.enrollments.completionRate}%`}
            hint={`${overview.enrollments.completed} finished`}
          />
          <StatCard
            label="Average rating"
            value={overview.ratings.totalReviews > 0 ? `★ ${overview.ratings.averageRating.toFixed(1)}` : "No reviews yet"}
            hint={`${overview.ratings.totalReviews} reviews`}
          />
        </div>
      )}
      {!overview && !error && <p className="text-slate-500">Loading analytics...</p>}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Last {months} months</h2>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(METRIC_LABEL) as Metric[]).map((m) => (
              <button key={m} onClick={() => pickMetric(m)} className={pill(metric === m)}>
                {METRIC_LABEL[m]}
              </button>
            ))}
            <span className="mx-1 w-px bg-slate-200" />
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => pickMonths(m)} className={pill(months === m)}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        {monthly ? (
          <BarChart
            data={monthly.map((p) => ({
              label: formatMonth(p.month),
              value: metric === "revenue" ? p.revenue : metric === "enrollments" ? p.enrollments : (p.newUsers ?? 0),
            }))}
            format={metric === "revenue" ? formatMoney : (n) => String(n)}
            color={METRIC_COLOR[metric]}
          />
        ) : (
          <p className="py-10 text-center text-slate-500">Loading chart...</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Top courses</h2>
          <div className="flex gap-2">
            {(["enrollments", "revenue", "rating"] as TopBy[]).map((b) => (
              <button key={b} onClick={() => setBy(b)} className={`${pill(by === b)} capitalize`}>
                {b}
              </button>
            ))}
          </div>
        </div>
        {!courses && !error && <p className="text-slate-500">Loading courses...</p>}
        {courses && courses.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No approved courses to rank yet.
          </p>
        )}
        {courses && courses.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Course</th>
                  <th className="px-4 py-3 font-medium">Instructor</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">Enrollments</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((c, i) => (
                  <tr key={c._id}>
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="max-w-xs px-4 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3 text-slate-600">{c.instructorName ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(c.price)}</td>
                    <td className="px-4 py-3 text-right">{c.enrollments}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(c.revenue)}</td>
                    <td className="px-4 py-3 text-right">
                      {c.reviewCount > 0 ? `★ ${c.averageRating.toFixed(1)} (${c.reviewCount})` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Top instructors</h2>
        {instructors && instructors.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            No enrollments yet.
          </p>
        )}
        {instructors && instructors.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Instructor</th>
                  <th className="px-4 py-3 text-right font-medium">Courses with students</th>
                  <th className="px-4 py-3 text-right font-medium">Enrollments</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {instructors.map((r, i) => (
                  <tr key={r.instructorId}>
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{r.name ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{r.coursesWithEnrollments}</td>
                    <td className="px-4 py-3 text-right">{r.enrollments}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
