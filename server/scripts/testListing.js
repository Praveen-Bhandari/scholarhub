import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import User from "../models/User.js";
import { buildCourseQuery } from "../utils/courseQuery.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const CLEAN = { title: /^(Zlisting|Zdetail)/ };
const ZERO_ID = "000000000000000000000000";

async function get(url) {
  const res = await fetch(BASE + url);
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

const rows = [];
function record(label, expected, r, verify) {
  let pass = r.status === expected;
  if (pass && verify) pass = Boolean(verify(r.data));
  rows.push({ label, expected, got: r.status, pass });
  return r;
}

const isSorted = (arr, key, dir) =>
  arr.every((x, i) => i === 0 || (dir === "asc" ? arr[i - 1][key] <= x[key] : arr[i - 1][key] >= x[key]));

async function planOf(params) {
  const { filter, sort, limit } = buildCourseQuery(params);
  const plan = await Course.find(filter).sort(sort).limit(limit).explain("queryPlanner");
  const text = JSON.stringify(plan.queryPlanner.winningPlan);
  return { index: text.includes("IXSCAN"), sort: text.includes('"stage":"SORT"') };
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await Course.deleteMany(CLEAN);
await Course.syncIndexes(); // naye indexes lagao, purane hatao

const instructor = await User.findOne({ email: "instructor1@example.com" });
const cats = ["web", "mobile", "data"];
const levels = ["beginner", "intermediate", "advanced"];

const docs = [];
for (let i = 0; i < 45; i++) {
  docs.push({
    title: i % 5 === 0 ? `Zlisting React Masterclass ${i}` : `Zlisting Course ${i}`,
    description: "demo",
    category: cats[i % 3],
    level: levels[Math.floor(i / 3) % 3],
    price: (i % 9) * 100, // kai courses ki price barabar (tie testing)
    averageRating: ((i * 7) % 11) / 2,
    reviewCount: i,
    instructor: instructor._id,
    status: "approved",
  });
}
for (let i = 0; i < 5; i++) {
  docs.push({
    title: `Zlisting Draft ${i}`,
    description: "demo",
    category: "web",
    instructor: instructor._id,
    status: "draft",
  });
}
await Course.insertMany(docs);

const detail = await Course.create({
  title: "Zdetail Course",
  description: "detail",
  category: "detailtest",
  instructor: instructor._id,
  status: "approved",
  sections: [{
    title: "Intro",
    lessons: [{
      title: "Lesson one",
      content: "secret content",
      durationMinutes: 7,
      attachments: [{ name: "secret.pdf", url: "https://example.com/secret.pdf", publicId: "x", resourceType: "raw", bytes: 1 }],
    }],
  }],
});
const draft = await Course.create({
  title: "Zdetail Draft", description: "d", category: "detailtest", instructor: instructor._id, status: "draft",
});

const base = "/courses?q=zlisting";

// ---------- List aur pagination ----------
const first = record("Default page: 12 courses, 45 approved total, 4 pages", 200,
  await get(`${base}&sort=newest`),
  (d) => d.courses.length === 12 && d.pagination.total === 45 && d.pagination.totalPages === 4 &&
         d.pagination.page === 1 && d.pagination.hasNext === true);
record("List hides sections and rejection reason", 200, first,
  (d) => d.courses.every((c) => !("sections" in c) && !("rejectionReason" in c)));
record("Last page (limit 10, page 5) has 5 courses, no next", 200,
  await get(`${base}&limit=10&page=5&sort=newest`),
  (d) => d.courses.length === 5 && d.pagination.hasNext === false && d.pagination.totalPages === 5);
record("Page beyond the end is empty", 200,
  await get(`${base}&page=99`), (d) => d.courses.length === 0);

// tied prices ke saath har page: na duplicate, na gayab
const seen = new Set();
let dupes = 0;
for (let p = 1; p <= 5; p++) {
  const d = (await get(`${base}&sort=price_asc&limit=10&page=${p}`)).data;
  for (const c of d.courses) {
    if (seen.has(c._id)) dupes++;
    seen.add(c._id);
  }
}
rows.push({
  label: "Pagination with tied prices: no duplicates, none missing",
  expected: "45 unique, 0 duplicates",
  got: `${seen.size} unique, ${dupes} duplicates`,
  pass: seen.size === 45 && dupes === 0,
});

// ---------- Filters ----------
record("Category filter (web)", 200, await get(`${base}&category=web&limit=50`),
  (d) => d.pagination.total === 15 && d.courses.every((c) => c.category === "web"));
record("Level filter (advanced)", 200, await get(`${base}&level=advanced&limit=50`),
  (d) => d.pagination.total > 0 && d.courses.every((c) => c.level === "advanced"));
record("Price range 300 to 500", 200, await get(`${base}&minPrice=300&maxPrice=500&limit=50`),
  (d) => d.pagination.total === 15 && d.courses.every((c) => c.price >= 300 && c.price <= 500));
record("Minimum rating 4", 200, await get(`${base}&minRating=4&limit=50`),
  (d) => d.pagination.total > 0 && d.courses.every((c) => c.averageRating >= 4));
record("Filters combine (web + advanced)", 200, await get(`${base}&category=web&level=advanced&limit=50`),
  (d) => d.pagination.total === 5 && d.courses.every((c) => c.category === "web" && c.level === "advanced"));

// ---------- Sort ----------
record("Sort by price ascending", 200, await get(`${base}&sort=price_asc&limit=50`),
  (d) => isSorted(d.courses, "price", "asc"));
record("Sort by price descending", 200, await get(`${base}&sort=price_desc&limit=50`),
  (d) => isSorted(d.courses, "price", "desc"));
record("Sort by rating", 200, await get(`${base}&sort=rating&limit=50`),
  (d) => isSorted(d.courses, "averageRating", "desc"));

// ---------- Search ----------
record("Search ranks best matches first", 200, await get("/courses?q=zlisting%20react&limit=12"),
  (d) => d.courses.slice(0, 9).every((c) => c.title.includes("React")));
record("Search with no match is empty", 200, await get("/courses?q=qqqxyzzy"),
  (d) => d.pagination.total === 0 && d.courses.length === 0);

// ---------- Galat input ----------
record("page=0 is rejected", 400, await get("/courses?page=0"));
record("limit=abc is rejected", 400, await get("/courses?limit=abc"));
record("limit=1000 is rejected", 400, await get("/courses?limit=1000"));
record("Unknown sort is rejected", 400, await get("/courses?sort=bogus"));
record("Negative price is rejected", 400, await get("/courses?minPrice=-5"));
record("Unknown level is rejected", 400, await get("/courses?level=expert"));
record("minRating above 5 is rejected", 400, await get("/courses?minRating=9"));
record("Repeated parameter is rejected", 400, await get("/courses?category=a&category=b"));

// ---------- Detail ----------
record("Detail shows structure but hides lesson content and email", 200,
  await get(`/courses/${detail._id}`),
  (d) => d.course.sections[0].lessons[0].title === "Lesson one" &&
         d.course.totalLessons === 1 && d.course.totalDurationMinutes === 7 &&
         !JSON.stringify(d).includes("secret") && !JSON.stringify(d).includes("@"));
record("Draft course detail gives 404", 404, await get(`/courses/${draft._id}`));
record("Course that does not exist gives 404", 404, await get(`/courses/${ZERO_ID}`));
record("Invalid course id gives 400", 400, await get("/courses/abc"));

// ---------- Categories ----------
record("Categories with counts", 200, await get("/courses/categories"),
  (d) => d.categories.find((c) => c.category === "detailtest")?.count === 1 &&
         (d.categories.find((c) => c.category === "web")?.count ?? 0) >= 15);

// ---------- Indexes ----------
for (const [label, params] of [
  ["Newest sort uses an index (no in-memory sort)", { sort: "newest" }],
  ["Price sort uses an index (no in-memory sort)", { sort: "price_asc" }],
  ["Rating sort uses an index (no in-memory sort)", { sort: "rating" }],
  ["Category + newest uses an index (no in-memory sort)", { category: "web", sort: "newest" }],
]) {
  const p = await planOf(params);
  rows.push({
    label,
    expected: "IXSCAN, no SORT",
    got: `${p.index ? "IXSCAN" : "no IXSCAN"}, ${p.sort ? "SORT" : "no SORT"}`,
    pass: p.index && !p.sort,
  });
}

// ------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  expected ${r.expected}, got ${r.got}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);

await Course.deleteMany(CLEAN);
await mongoose.disconnect();
process.exit(failed ? 1 : 0);