"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import FormError from "./FormError";
import ProgressBar from "./ProgressBar";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import type { MyEnrollment } from "@/lib/types";

const button =
  "mt-4 block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60";

export default function EnrollPanel({ courseId, price }: { courseId: string; price: number }) {
  const { user, loading } = useAuth();
  const [enrollment, setEnrollment] = useState<MyEnrollment | null>(null);
  const [checked, setChecked] = useState(false); // enrollment ki jaanch ho chuki?
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const isStudent = user?.role === "student";

  useEffect(() => {
    if (!isStudent) return;
    let cancelled = false;
    api<{ enrollment: MyEnrollment }>(`/enrollments/${courseId}`)
      .then((d) => {
        if (!cancelled) setEnrollment(d.enrollment);
      })
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 404)) console.error(e);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isStudent, courseId]);

  async function enroll() {
    setBusy(true);
    setError(null);
    try {
      try {
        await api<{ enrollment: { id: string } }>(`/courses/${courseId}/enroll`, { method: "POST" });
      } catch (e) {
        // pehle se enroll hai (409) to bhi aage badho
        if (!(e instanceof ApiError && e.status === 409)) throw e;
      }
      const d = await api<{ enrollment: MyEnrollment }>(`/enrollments/${courseId}`);
      setEnrollment(d.enrollment);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-3xl font-bold">{formatPrice(price)}</p>

      {loading && (
        <button disabled className={button}>
          Loading...
        </button>
      )}

      {!loading && !user && (
        <Link href={`/login?next=/courses/${courseId}`} className={button}>
          Log in to enroll
        </Link>
      )}

      {!loading && user?.role === "instructor" && (
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Instructor accounts cannot enroll. Log in with a student account to take this course.
        </p>
      )}

      {!loading && user?.role === "admin" && (
        <Link href={`/learn/${courseId}`} className={button}>
          View course content (admin)
        </Link>
      )}

      {!loading && isStudent && !checked && (
        <button disabled className={button}>
          Checking...
        </button>
      )}

      {!loading && isStudent && checked && enrollment && (
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm text-slate-600">
              <span>You are enrolled</span>
              <span>{enrollment.progressPercent}%</span>
            </div>
            <ProgressBar percent={enrollment.progressPercent} />
          </div>
          <Link href={`/learn/${courseId}`} className={button.replace("mt-4 ", "")}>
            {enrollment.progressPercent >= 100
              ? "Review the course"
              : enrollment.completedCount > 0
                ? "Continue learning"
                : "Start learning"}
          </Link>
        </div>
      )}

      {!loading && isStudent && checked && !enrollment && (
        <>
          <button onClick={enroll} disabled={busy} className={button}>
            {busy ? "Enrolling..." : price === 0 ? "Enroll for free" : "Enroll now"}
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Payment is not part of this project, so enrolling is instant.
          </p>
        </>
      )}

      {error ? (
        <div className="mt-3">
          <FormError error={error} />
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Full access to every lesson, and a certificate when you finish.
      </p>
    </div>
  );
}
