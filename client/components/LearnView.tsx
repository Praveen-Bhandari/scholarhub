"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import FormError from "./FormError";
import ProgressBar from "./ProgressBar";
import ReviewBox from "./ReviewBox";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { formatDuration } from "@/lib/format";
import type { LearnCourse, LearnLesson, LearnProgress, Progress } from "@/lib/types";

// sirf http(s) link kholte hain (javascript: jaise links nahi)
const isHttp = (url: string) => /^https?:\/\//i.test(url);

function LessonBody({ lesson }: { lesson: LearnLesson }) {
  if (lesson.type === "video") {
    if (isHttp(lesson.content) && /\.(mp4|webm|ogg)(\?.*)?$/i.test(lesson.content)) {
      return <video src={lesson.content} controls className="aspect-video w-full rounded-lg bg-black" />;
    }
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg bg-slate-900 p-4 text-center text-white">
        <p className="text-5xl">▶</p>
        {isHttp(lesson.content) ? (
          <a
            href={lesson.content}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm underline hover:bg-white/20"
          >
            Open video
          </a>
        ) : (
          <p className="mt-3 text-sm text-slate-300">{lesson.content || "No video link has been added yet."}</p>
        )}
      </div>
    );
  }
  return (
    <div className="whitespace-pre-line rounded-lg border border-slate-200 bg-white p-5 text-slate-700">
      {lesson.content || "No content has been added yet."}
    </div>
  );
}

export default function LearnView({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<LearnCourse | null>(null);
  const [progress, setProgress] = useState<LearnProgress | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ course: LearnCourse; progress: LearnProgress | null }>(`/learn/courses/${courseId}`)
      .then((d) => {
        if (cancelled) return;
        setCourse(d.course);
        setProgress(d.progress);
        // resume: pichla lesson, nahi to pehla
        setCurrentId(d.progress?.resumeLessonId ?? d.course.sections[0]?.lessons[0]?._id ?? null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error("Could not load the course"));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const lessons = useMemo(() => course?.sections.flatMap((s) => s.lessons) ?? [], [course]);
  const completed = useMemo(() => new Set(progress?.completedLessons ?? []), [progress]);
  const current = lessons.find((l) => l._id === currentId) ?? null;
  const next = current ? lessons[lessons.indexOf(current) + 1] : undefined;

  function selectLesson(id: string) {
    setCurrentId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    // "kahan ruke" yaad rakhne ke liye (jawab ka intezaar nahi)
    if (progress) {
      api<{ progress: Progress }>(`/enrollments/${courseId}/last-lesson`, {
        method: "PUT",
        body: { lessonId: id },
      }).catch(() => {});
    }
  }

  async function toggleComplete(lesson: LearnLesson) {
    if (!progress) return;
    setBusy(true);
    setActionError(null);
    const wasDone = completed.has(lesson._id);
    try {
      const d = await api<{ progress: Progress }>(
        `/enrollments/${courseId}/lessons/${lesson._id}/complete`,
        { method: wasDone ? "DELETE" : "POST" }
      );
      setProgress({
        ...progress,
        ...d.progress,
        completedLessons: wasDone
          ? progress.completedLessons.filter((id) => id !== lesson._id)
          : [...new Set([...progress.completedLessons, lesson._id])],
      });
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-4xl">🔒</p>
        <h1 className="mt-3 text-xl font-semibold">
          {status === 403
            ? "You do not have access to this course"
            : status === 404
              ? "Course not found"
              : "Could not load the course"}
        </h1>
        <p className="mt-1 text-slate-600">{error.message}</p>
        <Link
          href={status === 403 ? `/courses/${courseId}` : "/courses"}
          className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
        >
          {status === 403 ? "Go to the course page" : "Browse courses"}
        </Link>
      </main>
    );
  }

  if (!course) {
    return <p className="mx-auto max-w-6xl px-4 py-10 text-slate-500">Loading the course...</p>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href={progress ? "/dashboard" : `/courses/${courseId}`} className="text-sm text-indigo-600 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{course.title}</h1>
      <p className="text-sm text-slate-500">
        By {course.instructor?.name ?? "ScholarHub"} · {formatDuration(course.totalDurationMinutes)}
      </p>

      {progress ? (
        <div className="mt-4 max-w-xl">
          <div className="mb-1 flex justify-between text-sm text-slate-600">
            <span>
              {progress.completedCount} of {progress.totalLessons} lessons completed
            </span>
            <span>{progress.progressPercent}%</span>
          </div>
          <ProgressBar percent={progress.progressPercent} />
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Preview mode: you are viewing this course as its owner or an admin. Progress is not tracked.
        </p>
      )}

      {progress?.certificateId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium text-emerald-800">🎉 Course completed! Your certificate is ready.</p>
          <Link
            href={`/certificates/${progress.certificateId}`}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            View certificate
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="h-fit overflow-hidden rounded-xl border border-slate-200 bg-white">
          {course.sections.map((s) => (
            <div key={s._id}>
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-semibold">{s.title}</p>
              {s.lessons.map((l) => (
                <button
                  key={l._id}
                  onClick={() => selectLesson(l._id)}
                  className={`flex w-full items-start gap-2 px-4 py-2 text-left text-sm ${
                    l._id === currentId ? "bg-indigo-50 font-medium text-indigo-700" : "hover:bg-slate-50"
                  }`}
                >
                  <span className={completed.has(l._id) ? "text-emerald-600" : "text-slate-300"}>
                    {progress ? (completed.has(l._id) ? "✔" : "○") : l.type === "video" ? "▶" : "≡"}
                  </span>
                  <span className="flex-1">{l.title}</span>
                  <span className="text-xs text-slate-400">{formatDuration(l.durationMinutes)}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section>
          {current ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{current.title}</h2>
              <LessonBody lesson={current} />

              {current.attachments.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-2 font-semibold">Attachments</h3>
                  <ul className="space-y-1 text-sm">
                    {current.attachments.map((a) => (
                      <li key={a._id}>
                        {isHttp(a.url) ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                            📎 {a.name}
                          </a>
                        ) : (
                          a.name
                        )}
                        {a.bytes ? <span className="text-slate-400"> ({Math.max(1, Math.round(a.bytes / 1024))} KB)</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <FormError error={actionError} />

              <div className="flex flex-wrap gap-3">
                {progress && (
                  <button
                    onClick={() => toggleComplete(current)}
                    disabled={busy}
                    className={
                      completed.has(current._id)
                        ? "rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        : "rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    }
                  >
                    {completed.has(current._id) ? "✔ Completed (click to undo)" : "Mark as complete"}
                  </button>
                )}
                {next && (
                  <button
                    onClick={() => selectLesson(next._id)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                  >
                    Next lesson →
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500">This course has no lessons yet.</p>
          )}
        </section>
      </div>

      {progress && <ReviewBox courseId={courseId} />}
    </main>
  );
}