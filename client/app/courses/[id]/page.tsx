import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EnrollPanel from "@/components/EnrollPanel";
import Rating from "@/components/Rating";
import { ApiError } from "@/lib/errors";
import { formatDate, formatDuration } from "@/lib/format";
import { serverFetch } from "@/lib/server-api";
import type { CourseDetail, CourseList, ReviewList } from "@/lib/types";

// ISR: 60 second baad agli request par page peeche se naya ban jata hai
export const revalidate = 60;

// SSG: build ke waqt top 20 courses ke pages pehle se ban jate hain.
// baaki courses pehli request par bante hain aur phir yaad rakhe jate hain
export async function generateStaticParams() {
  try {
    const data = await serverFetch<CourseList>("/courses?sort=rating&limit=20");
    return data.courses.map((c) => ({ id: c._id }));
  } catch {
    // backend band ho to build na toote, pages pehli request par ban jayenge
    return [];
  }
}

async function loadCourse(id: string): Promise<CourseDetail> {
  try {
    const { course } = await serverFetch<{ course: CourseDetail }>(`/courses/${id}`, {
      revalidate: 60,
    });
    return course;
  } catch (e) {
    // course nahi mila, approved nahi hai, ya id galat: sab ke liye 404
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const { course } = await serverFetch<{ course: CourseDetail }>(`/courses/${id}`, {
      revalidate: 60,
    });
    return { title: course.title, description: course.description.slice(0, 160) };
  } catch {
    return { title: "Course" };
  }
}

export default async function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await loadCourse(id);

  // reviews na aayein to bhi course ka page dikhe
  const reviews = await serverFetch<ReviewList>(`/courses/${id}/reviews?limit=5`, {
    revalidate: 60,
  }).catch(() => null);

  return (
    <main>
      <section className="bg-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-indigo-500/30 px-3 py-0.5 font-medium capitalize">
              {course.category}
            </span>
            <span className="capitalize text-slate-300">{course.level}</span>
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold">{course.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-300">
            <Rating average={course.averageRating} count={course.reviewCount} />
            <span>By {course.instructor?.name ?? "ScholarHub"}</span>
            <span>Updated {formatDate(course.updatedAt)}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-10">
          <section>
            <h2 className="mb-2 text-xl font-bold">About this course</h2>
            <p className="whitespace-pre-line text-slate-700">{course.description}</p>
          </section>

          <section>
            <h2 className="mb-1 text-xl font-bold">Curriculum</h2>
            <p className="mb-3 text-sm text-slate-500">
              {course.sections.length} sections · {course.totalLessons} lessons ·{" "}
              {formatDuration(course.totalDurationMinutes)}
            </p>
            <div className="space-y-2">
              {course.sections.map((s, i) => (
                <details key={s._id} open={i === 0} className="rounded-lg border border-slate-200 bg-white">
                  <summary className="cursor-pointer px-4 py-3 font-medium">
                    {s.title}{" "}
                    <span className="text-sm font-normal text-slate-500">· {s.lessons.length} lessons</span>
                  </summary>
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {s.lessons.map((l) => (
                      <li key={l._id} className="flex items-center justify-between px-4 py-2 text-sm">
                        <span>
                          <span className="mr-2 text-slate-400">{l.type === "video" ? "▶" : "≡"}</span>
                          {l.title}
                        </span>
                        <span className="text-slate-500">{formatDuration(l.durationMinutes)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-bold">Student reviews</h2>
            {!reviews || reviews.summary.reviewCount === 0 ? (
              <p className="text-slate-500">No reviews yet.</p>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-8 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="text-center">
                    <p className="text-4xl font-bold">{reviews.summary.averageRating.toFixed(1)}</p>
                    <p className="text-amber-500">★★★★★</p>
                    <p className="text-sm text-slate-500">{reviews.summary.reviewCount} reviews</p>
                  </div>
                  <div className="min-w-48 flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviews.summary.distribution[String(star)] ?? 0;
                      const pct = (count / reviews.summary.reviewCount) * 100;
                      return (
                        <div key={star} className="flex items-center gap-2 text-sm">
                          <span className="w-10 text-slate-600">{star} ★</span>
                          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                            <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right text-slate-500">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <ul className="space-y-4">
                  {reviews.reviews.map((r) => (
                    <li key={r._id} className="rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.student.name}</span>
                        <span className="text-sm text-slate-500">{formatDate(r.createdAt)}</span>
                      </div>
                      <p className="text-amber-500">
                        {"★".repeat(r.rating)}
                        <span className="text-slate-300">{"★".repeat(5 - r.rating)}</span>
                      </p>
                      {r.comment && <p className="mt-1 text-slate-700">{r.comment}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-6">
          <EnrollPanel courseId={course._id} price={course.price} />
          <ul className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-sm">
            <li className="flex justify-between"><span className="text-slate-500">Level</span><span className="capitalize">{course.level}</span></li>
            <li className="flex justify-between"><span className="text-slate-500">Lessons</span><span>{course.totalLessons}</span></li>
            <li className="flex justify-between"><span className="text-slate-500">Duration</span><span>{formatDuration(course.totalDurationMinutes)}</span></li>
            <li className="flex justify-between"><span className="text-slate-500">Category</span><span className="capitalize">{course.category}</span></li>
          </ul>
        </aside>
      </div>
    </main>
  );
}