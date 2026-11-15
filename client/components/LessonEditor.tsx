"use client";

import { useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { dangerButton, inputClass, labelClass, secondaryButton, smallPrimary } from "@/lib/ui";
import { useAction } from "@/lib/useAction";
import type { EditorLesson } from "@/lib/types";

const MAX_ATTACHMENT = 10 * 1024 * 1024; // backend jaisa: 10 MB

interface Props {
  base: string; // /courses/:id/sections/:sectionId/lessons/:lessonId
  lesson: EditorLesson;
  locked: boolean;
  onChange: () => Promise<void>;
}

export default function LessonEditor({ base, lesson, locked, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [type, setType] = useState(lesson.type);
  const [minutes, setMinutes] = useState(String(lesson.durationMinutes));
  const [content, setContent] = useState(lesson.content);
  const [localError, setLocalError] = useState<string | null>(null);

  const save = useAction(onChange);
  const remove = useAction(onChange);
  const upload = useAction(onChange);
  const removeFile = useAction(onChange);

  function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    save.run(async () => {
      await api(base, {
        method: "PUT",
        body: {
          title: title.trim(),
          type,
          content,
          durationMinutes: Math.max(0, Math.round(Number(minutes) || 0)),
        },
      });
      setOpen(false);
    });
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_ATTACHMENT) {
      setLocalError("File must be 10 MB or smaller.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.append("file", file); // field ka naam backend (uploadRoutes) se
    upload.run(() => api(`${base}/attachments`, { method: "POST", formData: fd }));
  }

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{lesson.title}</p>
          <p className="text-xs text-slate-500">
            {lesson.type === "video" ? "Video" : "Text"} · {formatDuration(lesson.durationMinutes)} ·{" "}
            {lesson.attachments.length} attachment{lesson.attachments.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} onClick={() => setOpen((o) => !o)}>
            {open ? "Close" : "Edit"}
          </button>
          <button
            type="button"
            disabled={locked || remove.busy}
            className={dangerButton}
            onClick={() => {
              if (window.confirm(`Delete lesson "${lesson.title}"?`)) remove.run(() => api(base, { method: "DELETE" }));
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <FormError error={remove.error} />

      {open && (
        <div className="mt-3 space-y-4 border-t border-slate-200 pt-3">
          <form onSubmit={saveLesson} className="space-y-3">
            <FormError error={save.error} />
            <fieldset disabled={locked || save.busy} className="space-y-3">
              <div>
                <label className={labelClass}>Title</label>
                <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as "video" | "text")} className={inputClass}>
                    <option value="video">Video</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Duration (minutes)</label>
                  <input type="number" min="0" step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className={labelClass}>{type === "video" ? "Video URL" : "Lesson text"}</label>
                <textarea
                  rows={type === "video" ? 2 : 6}
                  maxLength={20000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={inputClass}
                  placeholder={type === "video" ? "https://www.youtube.com/watch?v=..." : ""}
                />
              </div>
              <button className={smallPrimary}>{save.busy ? "Saving..." : "Save lesson"}</button>
            </fieldset>
          </form>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Attachments</h4>
            {lesson.attachments.length === 0 && <p className="text-sm text-slate-500">No attachments yet.</p>}
            <ul className="space-y-1">
              {lesson.attachments.map((a) => (
                <li key={a._id} className="flex items-center justify-between gap-2 text-sm">
                  <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-indigo-600 hover:underline">
                    {a.name}
                    {a.bytes ? ` (${Math.max(1, Math.round(a.bytes / 1024))} KB)` : ""}
                  </a>
                  <button
                    type="button"
                    disabled={locked || removeFile.busy}
                    className={dangerButton}
                    onClick={() => removeFile.run(() => api(`${base}/attachments/${a._id}`, { method: "DELETE" }))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <label className={`${secondaryButton} mt-2 inline-block cursor-pointer ${locked || upload.busy ? "pointer-events-none opacity-60" : ""}`}>
              {upload.busy ? "Uploading..." : "+ Add attachment"}
              <input type="file" className="hidden" onChange={pickFile} disabled={locked || upload.busy} />
            </label>
            <p className="mt-1 text-xs text-slate-500">Up to 10 MB. Allowed types are checked by the server.</p>
            {localError && <p className="mt-1 text-sm text-red-600">{localError}</p>}
            <FormError error={upload.error} />
            <FormError error={removeFile.error} />
          </div>
        </div>
      )}
    </li>
  );
}