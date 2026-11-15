import type { Metadata } from "next";
import Link from "next/link";
import CourseCard from "@/components/CourseCard";
import PaginationBar from "@/components/PaginationBar";
import { ApiError } from "@/lib/errors";
import { serverFetch } from "@/lib/server-api";
import type { Category, CourseList } from "@/lib/types";

export const metadata: Metadata = { title: "Courses" };

// SSR: ye page URL ke search aur filter par depend karta hai (har combination alag),
// isliye har request par server par banta hai
export const dynamic = "force-dynamic";

type SearchParams = { [key: string]: string | string[] | undefined };

const FILTER_KEYS = ["q", "category", "level", "minPrice", "maxPrice", "minRating", "sort"] as const;
const LIMIT = 12;

const field =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500";

async function loadCourses(query: URLSearchParams) {
  try {
    return { data: await serverFetch<CourseList>(`/courses?${query}`), error: null };
  } catch (e) {
    // galat filter (jaise minPrice=-5) par backend 400 deta hai
    if (e instanceof ApiError && e.status === 400) {
      return { data: null, error: "Some of the filters are not valid. Please check them and try again." };
    }
    throw e;
  }
}

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : "";
  };

  // backend ko sirf wahi bhejo jo URL me khali nahi hai
  const query = new URLSearchParams();
  for (const key of [...FILTER_KEYS, "page"]) {
    const v = get(key);
    if (v) query.set(key, v);
  }
  query.set("limit", String(LIMIT));

  const [categories, { data, error }] = await Promise.all([
    serverFetch<{ categories: Category[] }>("/courses/categories"),
    loadCourses(query),
  ]);

  // pagination ke links me filter bane rahein
  const hrefFor = (p: number) => {
    const params = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      const v = get(key);
      if (v) params.set(key, v);
    }
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/courses?${qs}` : "/courses";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Explore courses</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          <form action="/courses" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="q">Search</label>
              <input id="q" name="q" defaultValue={get("q")} placeholder="e.g. React" className={field} />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="category">Category</label>
              <select id="category" name="category" defaultValue={get("category")} className={field}>
                <option value="">All categories</option>
                {categories.categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="level">Level</label>
              <select id="level" name="level" defaultValue={get("level")} className={field}>
                <option value="">Any level</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium">Price (₹)</span>
              <div className="flex gap-2">
                <input name="minPrice" type="number" min="0" defaultValue={get("minPrice")} placeholder="Min" className={field} />
                <input name="maxPrice" type="number" min="0" defaultValue={get("maxPrice")} placeholder="Max" className={field} />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="minRating">Rating</label>
              <select id="minRating" name="minRating" defaultValue={get("minRating")} className={field}>
                <option value="">Any rating</option>
                <option value="4">4 stars and up</option>
                <option value="3">3 stars and up</option>
                <option value="2">2 stars and up</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="sort">Sort by</label>
              <select id="sort" name="sort" defaultValue={get("sort")} className={field}>
                <option value="">Default (best match when searching, else newest)</option>
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Apply
              </button>
              <Link href="/courses" className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50">
                Clear
              </Link>
            </div>
          </form>
        </aside>

        <section>
          {error && <p className="rounded-lg bg-red-50 p-4 text-red-700">{error}</p>}

          {data && (
            <>
              <p className="mb-4 text-sm text-slate-600">
                {data.pagination.total === 0
                  ? "No courses found. Try different filters."
                  : data.courses.length === 0
                    ? "There are no courses on this page."
                    : `Showing ${(data.pagination.page - 1) * data.pagination.limit + 1}–${
                        (data.pagination.page - 1) * data.pagination.limit + data.courses.length
                      } of ${data.pagination.total} courses`}
              </p>

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.courses.map((c) => (
                  <CourseCard key={c._id} course={c} />
                ))}
              </div>

              <PaginationBar pagination={data.pagination} hrefFor={hrefFor} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}