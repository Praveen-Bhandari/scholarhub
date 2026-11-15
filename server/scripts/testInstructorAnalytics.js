import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login failed for ${email}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function get(url, cookie) {
  const res = await fetch(BASE + url, { headers: cookie ? { Cookie: cookie } : {} });
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

async function cleanup() {
  const old = await Course.find({ title: /^Zanalytics/ }).select("_id");
  const ids = old.map((c) => c._id);
  await Enrollment.deleteMany({ course: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await cleanup();

// analytics wala instructor seedha database me (email nahi bhejni)
let analyst = await User.findOne({ email: "instructor3@example.com" });
if (!analyst) {
  analyst = await User.create({
    name: "Analytics Instructor",
    email: "instructor3@example.com",
    password: "instructor123456",
    role: "instructor",
    isEmailVerified: true,
  });
}
const other = await User.findOne({ email: "instructor1@example.com" });
const [u1, u2, u3] = await Promise.all(
  ["student1@example.com", "student2@example.com", "student3@example.com"].map((e) =>
    User.findOne({ email: e })
  )
);

const mk = (title, status, price, rating, reviews, owner = analyst) =>
  Course.create({
    title, description: "demo", category: "web", instructor: owner._id,
    status, price, averageRating: rating, reviewCount: reviews,
    sections: [{ title: "S1", order: 0, lessons: [{ title: "L1", order: 0 }] }],
  });

const A = await mk("Zanalytics A", "approved", 100, 4.5, 2);
const B = await mk("Zanalytics B", "approved", 50, 3, 1);
await mk("Zanalytics Draft", "draft", 0, 0, 0);
await mk("Zanalytics Submitted", "submitted", 0, 0, 0);
const O = await mk("Zanalytics Other", "approved", 999, 0, 0, other); // doosre instructor ka

// mahine ke hisaab se dates (UTC)
const now = new Date();
const monthStart = (offset) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
const day5 = (offset) => new Date(monthStart(offset).getTime() + 5 * 86400000);
const label = (offset) => {
  const d = monthStart(offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

const enr = (student, course, pricePaid, createdAt, completed = false) =>
  Enrollment.create({
    student: student._id, course: course._id, pricePaid, createdAt,
    ...(completed ? { completedAt: new Date() } : {}),
  });

await enr(u1, A, 100, now, true); // is mahine, poora kiya
await enr(u2, A, 100, now); // is mahine
await enr(u1, B, 50, day5(-1)); // pichla mahina
await enr(u3, B, 40, day5(-2)); // do mahine pehle (discount wali price)
await enr(u1, O, 999, now); // doosre instructor ke course me (leak nahi hona chahiye)

const an = await login("instructor3@example.com", "instructor123456");
const i1 = await login("instructor1@example.com", "password123");
const i2 = await login("instructor2@example.com", "password123");
const st = await login("student1@example.com", "newpassword456");
const ad = await login("admin@example.com", "admin12345");

// ---------- Kaun dekh sakta hai ----------
for (const path of ["overview", "courses", "monthly"]) {
  const url = `/analytics/instructor/${path}`;
  record(`${path}: anonymous`, 401, await get(url, null));
  record(`${path}: student`, 403, await get(url, st));
  record(`${path}: admin`, 403, await get(url, ad));
}

// ---------- Overview ----------
record("Overview numbers are correct", 200, await get("/analytics/instructor/overview", an),
  (d) => {
    const o = d.overview;
    return o.courses.draft === 1 && o.courses.submitted === 1 && o.courses.approved === 2 &&
           o.courses.rejected === 0 && o.courses.total === 4 &&
           o.students === 3 && o.enrollments === 4 && o.revenue === 290 &&
           o.completedEnrollments === 1 && o.completionRate === 25 &&
           o.averageRating === 4 && o.totalReviews === 3;
  });
record("Instructor with no courses gets zeros", 200, await get("/analytics/instructor/overview", i2),
  (d) => d.overview.courses.total === 0 && d.overview.students === 0 &&
         d.overview.revenue === 0 && d.overview.averageRating === 0);

// ---------- Har course ----------
record("Course stats: only my 4 courses, best earner first", 200, await get("/analytics/instructor/courses", an),
  (d) => {
    const c = d.courses;
    return c.length === 4 &&
      c[0].title === "Zanalytics A" && c[0].students === 2 && c[0].revenue === 200 &&
      c[0].completed === 1 && c[0].completionRate === 50 &&
      c[1].title === "Zanalytics B" && c[1].students === 2 && c[1].revenue === 90 &&
      c[1].completionRate === 0 &&
      c.slice(2).every((x) => x.students === 0 && x.revenue === 0);
  });
record("Instructor 1 sees own courses, not instructor 3's", 200, await get("/analytics/instructor/courses", i1),
  (d) => d.courses.some((c) => c.title === "Zanalytics Other") &&
         !d.courses.some((c) => c.title === "Zanalytics A"));

// ---------- Mahine ke hisaab se ----------
record("Monthly (3 months): enrollments and revenue per month", 200,
  await get("/analytics/instructor/monthly?months=3", an),
  (d) => JSON.stringify(d.months) === JSON.stringify([
    { month: label(-2), enrollments: 1, revenue: 40 },
    { month: label(-1), enrollments: 1, revenue: 50 },
    { month: label(0), enrollments: 2, revenue: 200 },
  ]));
record("Monthly (6 months): empty months are filled with zero", 200,
  await get("/analytics/instructor/monthly?months=6", an),
  (d) => d.months.length === 6 &&
         d.months.slice(0, 3).every((m) => m.enrollments === 0 && m.revenue === 0) &&
         d.months[5].month === label(0) && d.months[5].revenue === 200);
record("Monthly default is 6 months", 200, await get("/analytics/instructor/monthly", an),
  (d) => d.months.length === 6);
record("months=0 is rejected", 400, await get("/analytics/instructor/monthly?months=0", an));
record("months=25 is rejected", 400, await get("/analytics/instructor/monthly?months=25", an));
record("months=abc is rejected", 400, await get("/analytics/instructor/monthly?months=abc", an));
record("Repeated months parameter is rejected", 400,
  await get("/analytics/instructor/monthly?months=1&months=2", an));

// ------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  expected ${r.expected}, got ${r.got}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);

await cleanup();
await mongoose.disconnect();
process.exit(failed ? 1 : 0);