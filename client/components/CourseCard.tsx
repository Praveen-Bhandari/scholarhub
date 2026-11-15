import Link from "next/link";
import Rating from "./Rating";
import { formatPrice } from "@/lib/format";
import type { CourseCard as Course } from "@/lib/types";

// thumbnail na ho to category ke hisaab se rang wala box
const COLORS = [
  "from-indigo-500 to-blue-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-orange-500",
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-cyan-500",
  "from-amber-500 to-yellow-500",
];

function colorFor(text: string): string {
  let sum = 0;
  for (const ch of text) sum += ch.charCodeAt(0);
  return COLORS[sum % COLORS.length];
}

export default function CourseCard({ course }: { course: Course }) {
  return (
    <Link
      href={`/courses/${course._id}`}
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {course.thumbnail?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.thumbnail.url} alt="" className="h-36 w-full object-cover" />
      ) : (
        <div
          className={`flex h-36 items-center justify-center bg-linear-to-br ${colorFor(course.category)} text-4xl font-bold text-white/90`}
        >
          {course.title.charAt(0).toUpperCase()}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
            {course.category}
          </span>
          <span className="capitalize text-slate-500">{course.level}</span>
        </div>
        <h3 className="line-clamp-2 font-semibold">{course.title}</h3>
        <p className="text-sm text-slate-500">{course.instructor?.name ?? "ScholarHub"}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <Rating average={course.averageRating} count={course.reviewCount} />
          <span className="font-bold">{formatPrice(course.price)}</span>
        </div>
      </div>
    </Link>
  );
}