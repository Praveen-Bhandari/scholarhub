"use client";

import { useEffect, useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { inputClass, primaryButton } from "@/lib/ui";
import type { MyReview } from "@/lib/types";

export default function ReviewBox({ courseId }: { courseId: string }) {
  const [existing, setExisting] = useState<MyReview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ review: MyReview }>(`/courses/${courseId}/reviews/mine`)
      .then((d) => {
        if (cancelled) return;
        setExisting(d.review);
        setRating(d.review.rating);
        setComment(d.review.comment);
      })
      .catch((e) => {
        // 404 = abhi review nahi diya, theek hai
        if (!(e instanceof ApiError && e.status === 404)) console.error(e);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const d = await api<{ review: MyReview }>(
        `/courses/${courseId}/reviews${existing ? "/mine" : ""}`,
        { method: existing ? "PUT" : "POST", body: { rating, comment } }
      );
      setMessage(existing ? "Your review was updated." : "Thank you for your review!");
      setExisting(d.review);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing || !window.confirm("Delete your review?")) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api<{ message: string }>(`/courses/${courseId}/reviews/mine`, { method: "DELETE" });
      setExisting(null);
      setRating(5);
      setComment("");
      setMessage("Your review was deleted.");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  return (
    <section className="mt-10 rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold">{existing ? "Your review" : "Rate this course"}</h2>

      <form onSubmit={save} className="mt-4 space-y-4">
        <FormError error={error} />
        {message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}

        <div className="flex gap-1" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setRating(n)}
              className={`text-3xl leading-none ${n <= rating ? "text-amber-400" : "text-slate-300"}`}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Tell others what you liked (optional)"
          className={inputClass}
        />

        <div className="flex gap-3">
          <button disabled={busy} className={`${primaryButton} sm:w-auto`}>
            {busy ? "Saving..." : existing ? "Update review" : "Submit review"}
          </button>
          {existing && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </section>
  );
}