export default function Loading() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
        role="status"
        aria-label="Loading"
      />
      <p className="mt-4 text-slate-500">Loading...</p>
    </main>
  );
}