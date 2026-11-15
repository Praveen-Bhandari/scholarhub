"use client";

import { useCallback, useEffect, useState } from "react";
import FormError from "./FormError";
import StatusBadge from "./StatusBadge";
import { api } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { dangerButton, inputClass, smallPrimary } from "@/lib/ui";
import { useAction } from "@/lib/useAction";
import type { AdminReviewCourse } from "@/lib/types";

type Filter = "submitted" | "approved" | "rejected";

function ReviewCard({ course, onChange }: { course: AdminReviewCourse; onChange: () => Promise<void> }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const approve = useAction(onChange);
  const reject = useAction(onChange);
  const pending = course.status === "submitted";

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{course.title}</h3>
          <p className="text-sm text-slate-600">
            by {course.instructor ? `${course.instructor.name} (${course.instructor.email})` : "unknown instructor"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {course.category} · <span className="capitalize">{course.level}</span> · {formatPrice(course.price)} ·
            updated {formatDate(course.updatedAt)}
          </p>
        </div>
        <StatusBadge status={course.status} />
      </div>

      <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm text-slate-700">{course.description}</p>

      {course.status === "rejected" && course.rejectionReason && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">Reason: {course.rejectionReason}</p>
      )}

      <FormError error={approve.error} />
      <FormError error={reject.error} />

      {pending && !rejecting && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className={smallPrimary}
            disabled={approve.busy}
            onClick={() => {
              if (window.confirm(`Approve "${course.title}"? It will go live.`)) {
                approve.run(() => api(`/admin/courses/${course._id}/approve`, { method: "PATCH" }));
              }
            }}
          >
            {approve.busy ? "Approving..." : "Approve"}
          </button>
          <button type="button" className={dangerButton} onClick={() => setRejecting(true)}>
            Reject
          </button>
        </div>
      )}

      {pending && rejecting && (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            reject.run(() =>
              api(`/admin/courses/${course._id}/reject`, { method: "PATCH", body: { reason: reason.trim() } })
            );
          }}
        >
          <label htmlFor={`reason-${course._id}`} className="block text-sm font-medium">
            Reason for rejection (the instructor will see this)
          </label>
          <textarea
            id={`reason-${course._id}`}
            required
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2">
            <button className={dangerButton} disabled={reject.busy || !reason.trim()}>
              {reject.busy ? "Rejecting..." : "Confirm reject"}
            </button>
            <button type="button" className="text-sm text-slate-600 hover:underline" onClick={() => setRejecting(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

export default function AdminReviewQueue() {
  const [filter, setFilter] = useState<Filter>("submitted");
  const [courses, setCourses] = useState<AdminReviewCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await api<{ courses: AdminReviewCourse[] }>(`/admin/courses?status=${filter}`);
    setCourses(d.courses);
  }, [filter]);

  useEffect(() => {
    let cancelled = false;
    api<{ courses: AdminReviewCourse[] }>(`/admin/courses?status=${filter}`)
      .then((d) => {
        if (!cancelled) {
          setCourses(d.courses);
          setError(null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  const pill = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${
      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;

  function choose(f: Filter) {
    setCourses(null);
    setFilter(f);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(["submitted", "approved", "rejected"] as Filter[]).map((f) => (
          <button key={f} onClick={() => choose(f)} className={`${pill(filter === f)} capitalize`}>
            {f === "submitted" ? "Pending review" : f}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}
      {!courses && !error && <p className="text-slate-500">Loading courses...</p>}

      {courses && courses.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          {filter === "submitted" ? "Nothing is waiting for review." : `No ${filter} courses.`}
        </p>
      )}

      {courses && courses.length > 0 && (
        <ul className="space-y-4">
          {courses.map((c) => (
            <ReviewCard key={c._id} course={c} onChange={load} />
          ))}
        </ul>
      )}
    </div>
  );
}