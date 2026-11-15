import type { Metadata } from "next";
import Link from "next/link";
import NewCourseForm from "@/components/NewCourseForm";

export const metadata: Metadata = { title: "New course" };

// SSG shell: form ka data client me jata hai
export default function NewCoursePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/instructor" className="text-sm text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Create a new course</h1>
      <p className="mb-6 text-slate-600">
        Start with the basics. You can add sections, lessons and a thumbnail next, and submit the
        course for review when it is ready.
      </p>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <NewCourseForm />
      </div>
    </main>
  );
}