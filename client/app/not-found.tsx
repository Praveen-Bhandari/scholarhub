import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-5xl font-bold text-indigo-600">404</p>
      <h1 className="mt-3 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 text-slate-600">The page you are looking for does not exist or was moved.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
        >
          Go home
        </Link>
        <Link
          href="/courses"
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium hover:bg-slate-50"
        >
          Browse courses
        </Link>
      </div>
    </main>
  );
}