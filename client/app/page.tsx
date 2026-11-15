import Link from "next/link";
import CourseCard from "@/components/CourseCard";
import { serverFetch } from "@/lib/server-api";
import type { Category, CourseCard as Course, CourseList } from "@/lib/types";

// ISR: page server par banta hai, 60 second yaad rehta hai,
// uske baad agli request par peeche se naya ban jata hai
export const revalidate = 60;

function CourseRow({ title, href, courses }: { title: string; href: string; courses: Course[] }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        <Link href={href} className="text-sm font-medium text-indigo-600 hover:underline">
          View all
        </Link>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <CourseCard key={c._id} course={c} />
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const [top, newest, cats] = await Promise.all([
    serverFetch<CourseList>("/courses?sort=rating&limit=6", { revalidate: 60 }),
    serverFetch<CourseList>("/courses?sort=newest&limit=6", { revalidate: 60 }),
    serverFetch<{ categories: Category[] }>("/courses/categories", { revalidate: 60 }),
  ]);

  return (
    <main>
      <section className="bg-linear-to-br from-indigo-600 to-violet-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight">
            Learn something new every day
          </h1>
          <p className="mt-3 max-w-xl text-indigo-100">
            {top.pagination.total} approved courses from our instructors. Search, enroll, track your
            progress and earn a certificate.
          </p>
          <form action="/courses" className="mt-6 flex max-w-xl gap-2">
            <input
              name="q"
              placeholder="Search for a course, e.g. React"
              className="flex-1 rounded-lg px-4 py-2.5 text-slate-900 outline-none"
            />
            <button className="rounded-lg bg-slate-900 px-5 py-2.5 font-semibold hover:bg-slate-800">
              Search
            </button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-12 px-4 py-10">
        <section>
          <h2 className="mb-4 text-2xl font-bold">Browse by category</h2>
          <div className="flex flex-wrap gap-2">
            {cats.categories.map((c) => (
              <Link
                key={c.category}
                href={`/courses?category=${encodeURIComponent(c.category)}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium capitalize hover:border-indigo-600 hover:text-indigo-600"
              >
                {c.category} <span className="text-slate-400">({c.count})</span>
              </Link>
            ))}
          </div>
        </section>

        <CourseRow title="Top rated" href="/courses?sort=rating" courses={top.courses} />
        <CourseRow title="Newest" href="/courses?sort=newest" courses={newest.courses} />
      </div>
    </main>
  );
}