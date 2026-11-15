"use client";

import { useCallback, useEffect, useState } from "react";
import CourseForm, { type CourseFormValues } from "./CourseForm";
import FormError from "./FormError";
import SectionEditor from "./SectionEditor";
import StatusBadge from "./StatusBadge";
import ThumbnailUploader from "./ThumbnailUploader";
import { api } from "@/lib/api";
import { inputClass, smallPrimary } from "@/lib/ui";
import { useAction } from "@/lib/useAction";
import type { EditorCourse } from "@/lib/types";

export default function CourseEditor({ id }: { id: string }) {
  const [course, setCourse] = useState<EditorCourse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");

  const reload = useCallback(async () => {
    const d = await api<{ course: EditorCourse }>(`/courses/mine/${id}`);
    setCourse(d.course);
  }, [id]);

  useEffect(() => {
    reload().catch((e: Error) => setLoadError(e.message));
  }, [reload]);

  const addSection = useAction(reload);
  const submit = useAction(reload);

  if (loadError) return <p className="rounded-lg bg-red-50 p-4 text-red-700">{loadError}</p>;
  if (!course) return <p className="py-10 text-center text-slate-500">Loading course...</p>;

  // review me ho to sab edit band (instructor ko status admin hi badlega)
  const locked = course.status === "submitted";
  const canSubmit = course.status === "draft" || course.status === "rejected";

  async function saveDetails(values: CourseFormValues) {
    await api(`/courses/${id}`, { method: "PUT", body: values });
    await reload();
    setNotice("Details saved.");
  }

  async function onAddSection(e: React.FormEvent) {
    e.preventDefault();
    const ok = await addSection.run(() =>
      api(`/courses/${id}/sections`, { method: "POST", body: { title: sectionTitle.trim() } })
    );
    if (ok) setSectionTitle("");
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        <StatusBadge status={course.status} />
      </div>

      {course.status === "rejected" && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-semibold">This course was rejected</p>
          {course.rejectionReason && <p className="mt-1 text-sm">Reason: {course.rejectionReason}</p>}
          <p className="mt-1 text-sm">Fix the issues and submit it for review again.</p>
        </div>
      )}
      {course.status === "submitted" && (
        <div className="rounded-lg bg-amber-50 p-4 text-amber-800">
          Your course is in review. Editing is locked until an admin approves or rejects it.
        </div>
      )}
      {course.status === "approved" && (
        <div className="rounded-lg bg-emerald-50 p-4 text-emerald-800">This course is live.</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Details</h2>
        <CourseForm
          initial={{
            title: course.title,
            description: course.description,
            category: course.category,
            level: course.level,
            price: course.price,
          }}
          submitLabel="Save details"
          busyLabel="Saving..."
          disabled={locked}
          onSubmit={saveDetails}
        />
        {notice && <p className="mt-3 text-sm text-emerald-700">{notice}</p>}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <ThumbnailUploader courseId={id} thumbnail={course.thumbnail} locked={locked} onChange={reload} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Sections and lessons</h2>
        <div className="space-y-4">
          {course.sections.map((s, i) => (
            <SectionEditor key={s._id} courseId={id} section={s} index={i} locked={locked} onChange={reload} />
          ))}
          {course.sections.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              No sections yet. Add your first section below.
            </p>
          )}
        </div>

        <form onSubmit={onAddSection} className="mt-4">
          <FormError error={addSection.error} />
          <fieldset disabled={locked || addSection.busy} className="flex flex-wrap gap-2">
            <input
              required
              maxLength={120}
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="New section title"
              className={`${inputClass} max-w-sm flex-1`}
            />
            <button className={smallPrimary}>{addSection.busy ? "Adding..." : "+ Add section"}</button>
          </fieldset>
        </form>
      </section>

      {canSubmit && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6">
          <h2 className="text-lg font-bold">Ready to publish?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Submit the course for admin review. While it is in review you cannot edit it.
          </p>
          <div className="mt-3"><FormError error={submit.error} /></div>
          <button
            type="button"
            disabled={submit.busy}
            className={`${smallPrimary} mt-3`}
            onClick={() => {
              if (window.confirm("Submit this course for review?")) {
                submit.run(() => api(`/courses/${id}/submit`, { method: "POST" }));
              }
            }}
          >
            {submit.busy ? "Submitting..." : "Submit for review"}
          </button>
        </section>
      )}
    </div>
  );
}