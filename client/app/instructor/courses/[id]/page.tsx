import type { Metadata } from "next";
import Link from "next/link";
import CourseEditor from "@/components/CourseEditor";

export const metadata: Metadata = { title: "Edit course" };

// CSR editor: private data. params Next.js me Promise hota hai, isliye await
export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/instructor" className="text-sm text-indigo-600 hover:underline">
        ← Back to dashboard
      </Link>
      <div className="mt-3">
        <CourseEditor id={id} />
      </div>
    </main>
  );
}