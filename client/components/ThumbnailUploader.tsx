"use client";

import { useState } from "react";
import FormError from "./FormError";
import { api } from "@/lib/api";
import { dangerButton, secondaryButton } from "@/lib/ui";
import { useAction } from "@/lib/useAction";

const MAX_BYTES = 2 * 1024 * 1024; // backend jaisa: 2 MB

interface Props {
  courseId: string;
  thumbnail?: { url: string };
  locked: boolean;
  onChange: () => Promise<void>;
}

export default function ThumbnailUploader({ courseId, thumbnail, locked, onChange }: Props) {
  const { busy, error, run } = useAction(onChange);
  const [localError, setLocalError] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // wahi file dobara chun sako
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Image must be 2 MB or smaller.");
      return;
    }
    setLocalError(null);
    const fd = new FormData();
    fd.append("thumbnail", file); // field ka naam backend (uploadRoutes) se
    run(() => api(`/courses/${courseId}/thumbnail`, { method: "PUT", formData: fd }));
  }

  return (
    <div>
      <h2 className="mb-2 text-lg font-bold">Thumbnail</h2>
      <div className="flex flex-wrap items-center gap-4">
        {thumbnail?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail.url} alt="Course thumbnail" className="h-28 w-48 rounded-lg border border-slate-200 object-cover" />
        ) : (
          <div className="flex h-28 w-48 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500">
            No thumbnail
          </div>
        )}

        <div className="space-y-2">
          <label className={`${secondaryButton} inline-block cursor-pointer ${locked || busy ? "pointer-events-none opacity-60" : ""}`}>
            {busy ? "Working..." : thumbnail?.url ? "Replace image" : "Upload image"}
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={locked || busy} />
          </label>
          {thumbnail?.url && (
            <div>
              <button
                type="button"
                disabled={locked || busy}
                className={dangerButton}
                onClick={() => run(() => api(`/courses/${courseId}/thumbnail`, { method: "DELETE" }))}
              >
                Remove
              </button>
            </div>
          )}
          <p className="text-xs text-slate-500">Image, up to 2 MB.</p>
        </div>
      </div>
      {localError && <p className="mt-2 text-sm text-red-600">{localError}</p>}
      <div className="mt-2"><FormError error={error} /></div>
    </div>
  );
}