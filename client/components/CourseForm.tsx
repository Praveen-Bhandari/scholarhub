"use client";

import { useState } from "react";
import FormError from "./FormError";
import { inputClass, labelClass, primaryButton } from "@/lib/ui";

export interface CourseFormValues {
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  price: number;
}

interface Props {
  initial?: Partial<CourseFormValues>;
  submitLabel: string;
  busyLabel: string;
  disabled?: boolean; // review me ho to edit band
  onSubmit: (values: CourseFormValues) => Promise<void>;
}

export default function CourseForm({ initial, submitLabel, busyLabel, disabled, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [level, setLevel] = useState<CourseFormValues["level"]>(initial?.level ?? "beginner");
  const [price, setPrice] = useState(String(initial?.price ?? 0));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        level,
        price: Number(price) || 0,
      });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <FormError error={error} />

      <fieldset disabled={disabled || busy} className="space-y-4">
        <div>
          <label htmlFor="title" className={labelClass}>Title</label>
          <input id="title" required maxLength={120} value={title}
            onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea id="description" required rows={5} maxLength={5000} value={description}
            onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="category" className={labelClass}>Category</label>
            <input id="category" required list="category-options" value={category}
              onChange={(e) => setCategory(e.target.value)} className={inputClass} />
            <datalist id="category-options">
              {["web", "mobile", "data", "design", "devops", "security", "business"].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label htmlFor="level" className={labelClass}>Level</label>
            <select id="level" value={level}
              onChange={(e) => setLevel(e.target.value as CourseFormValues["level"])} className={inputClass}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div>
            <label htmlFor="price" className={labelClass}>Price (₹)</label>
            <input id="price" type="number" min="0" step="1" value={price}
              onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            <p className="mt-1 text-xs text-slate-500">0 means free.</p>
          </div>
        </div>

        <button disabled={disabled || busy} className={`${primaryButton} sm:w-auto`}>
          {busy ? busyLabel : submitLabel}
        </button>
      </fieldset>
    </form>
  );
}