import { ApiError } from "@/lib/errors";

// backend ka error aur validation ki list dikhata hai
export default function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  const message =
    error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
  const details = error instanceof ApiError ? error.errors : undefined;

  return (
    <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      <p>{message}</p>
      {details && details.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {details.map((d, i) => (
            <li key={i}>{d.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}