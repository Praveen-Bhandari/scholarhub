"use client";

import { useState } from "react";
import FormError from "./FormError";
import LessonEditor from "./LessonEditor";
import { api } from "@/lib/api";
import { dangerButton, inputClass, secondaryButton, smallPrimary } from "@/lib/ui";
import { useAction } from "@/lib/useAction";
import type { EditorSection } from "@/lib/types";

interface Props {
  courseId: string;
  section: EditorSection;
  index: number;
  locked: boolean;
  onChange: () => Promise<void>;
}

export default function SectionEditor({ courseId, section, index, locked, onChange }: Props) {
  const base = `/courses/${courseId}/sections/${section._id}`;

  const [title, setTitle] = useState(section.title);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"video" | "text">("video");
  const [newMinutes, setNewMinutes] = useState("0");

  const rename = useAction(onChange);
  const remove = useAction(onChange);
  const add = useAction(onChange);

  async function addLesson(e: React.FormEvent) {
    e.preventDefault();
    const ok = await add.run(() =>
      api(`${base}/lessons`, {
        method: "POST",
        body: {
          title: newTitle.trim(),
          type: newType,
          durationMinutes: Math.max(0, Math.round(Number(newMinutes) || 0)),
        },
      })
    );
    if (ok) {
      setNewTitle("");
      setNewMinutes("0");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-500">Section {index + 1}</span>
        <input
          value={title}
          maxLength={120}
          disabled={locked || rename.busy}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} max-w-sm flex-1`}
          aria-label="Section title"
        />
        <button
          type="button"
          className={secondaryButton}
          disabled={locked || rename.busy || !title.trim() || title.trim() === section.title}
          onClick={() => rename.run(() => api(base, { method: "PUT", body: { title: title.trim() } }))}
        >
          Rename
        </button>
        <button
          type="button"
          className={dangerButton}
          disabled={locked || remove.busy}
          onClick={() => {
            if (window.confirm(`Delete section "${section.title}" and all its lessons?`)) {
              remove.run(() => api(base, { method: "DELETE" }));
            }
          }}
        >
          Delete section
        </button>
      </div>
      <FormError error={rename.error} />
      <FormError error={remove.error} />

      <ul className="mt-3 space-y-2">
        {section.lessons.map((l) => (
          <LessonEditor
            key={l._id}
            base={`${base}/lessons/${l._id}`}
            lesson={l}
            locked={locked}
            onChange={onChange}
          />
        ))}
        {section.lessons.length === 0 && <li className="text-sm text-slate-500">No lessons in this section yet.</li>}
      </ul>

      <form onSubmit={addLesson} className="mt-3 border-t border-slate-100 pt-3">
        <FormError error={add.error} />
        <fieldset disabled={locked || add.busy} className="flex flex-wrap items-end gap-2">
          <input
            required
            maxLength={120}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New lesson title"
            className={`${inputClass} max-w-xs flex-1`}
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as "video" | "text")} className={`${inputClass} w-28`}>
            <option value="video">Video</option>
            <option value="text">Text</option>
          </select>
          <input
            type="number"
            min="0"
            step="1"
            value={newMinutes}
            onChange={(e) => setNewMinutes(e.target.value)}
            className={`${inputClass} w-24`}
            aria-label="Duration in minutes"
          />
          <span className="text-xs text-slate-500">min</span>
          <button className={smallPrimary}>{add.busy ? "Adding..." : "+ Add lesson"}</button>
        </fieldset>
      </form>
    </section>
  );
}