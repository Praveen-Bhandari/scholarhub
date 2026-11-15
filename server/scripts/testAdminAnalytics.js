import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const DAY = 86400000;

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

const diff = (a, b) => Math.round((a - b) * 100) / 100;
const sum = (arr, key) => arr.reduce((n, x) => n + x[key], 0); // sirf test ke andar

async function cleanup() {
  const old = await Course.find({ title: /^Zadmin/ }).select("_id");
  const ids = old.map((c) => c._id);
  await Enrollment.deleteMany({ course: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });
  await User.deleteMany({ email: /^zadmin/ });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await cleanup();

const ad = await login("admin@example.com", "admin12345");
const st = await login("student1@example.com", "newpassword456");
const i1 = await login("instructor1@example.com", "password123");

const U = "/analytics/admin";

// ---------- Kaun dekh sakta hai ----------
for (const path of ["overview", "top-courses", "top-instructors", "monthly"]) {
  record(`${path}: anonymous`, 401, await get(`${U}/${path}`, null));
  record(`${path}: student`, 403, await get(`${U}/${path}`, st));
  record(`${path}: instructor`, 403, await get(`${U}/${path}`, i1));
}

// ---------- Nakli data jodne se pehle ke numbers ----------
const before = (await get(`${U}/overview`, ad)).data.overview;
const beforeMonthly = (await get(`${U}/monthly?months=6`, ad)).data.months;

// ---------- Nakli data ----------
const now = new Date();
const mkUser = (name, email, role, createdAt) =>
  User.create({
    name, email, password: "student123456", role, isEmailVerified: true,
    ...(createdAt ? { createdAt } : {}),
  });

const za1 = await mkUser("Zadmin Student 1", "zadmin1@example.com", "student");
const za2 = await mkUser("Zadmin Student 2", "zadmin2@example.com", "student");
const inst = await mkUser("Zadmin Instructor", "zadmin-instructor@example.com", "instructor");
await mkUser("Zadmin Old User", "zadmin-old@example.com", "instructor", new Date(Date.now() - 60 * DAY));

const [u1, u2, u3] = await Promise.all(
  ["student1@example.com", "student2@example.com", "student3@example.com"].map((e) =>
    User.findOne({ email: e })
  )
);

const mk = (title, status, price, rating = 0, reviews = 0) =>
  Course.create({
    title, description: "demo", category: "web", instructor: inst._id,
    status, price, averageRating: rating, reviewCount: reviews,
    sections: [{ title: "S1", order: 0, lessons: [{ title: "L1", order: 0 }] }],
  });

const X = await mk("Zadmin X", "approved", 100);
const T1 = await mk("Zadmin Top Revenue", "approved", 1000000);
const T2 = await mk("Zadmin Top Enroll", "approved", 0);
const T3 = await mk("Zadmin Top Rated", "approved", 0, 5, 9999);
await mk("Zadmin Draft", "draft", 0);
await mk("Zadmin Submitted", "submitted", 0);
await mk("Zadmin Rejected", "rejected", 0);

const enr = (student, course, pricePaid, createdAt, completed = false) =>
  Enrollment.create({
    student: student._id, course: course._id, pricePaid, createdAt,
    ...(completed ? { completedAt: new Date() } : {}),
  });

// X: 3 enrollments (ek 40 din purani), T1: 2 bhaari revenue, T2: 5 free
await enr(u1, X, 100, now, true);
await enr(u2, X, 100, now);
await enr(u3, X, 60, new Date(Date.now() - 40 * DAY));
await enr(za1, T1, 1000000, now);
await enr(za2, T1, 1000000, now);
for (const s of [u1, u2, u3, za1, za2]) await enr(s, T2, 0, now);

// ---------- Overview (farak) ----------
const afterRes = await get(`${U}/overview`, ad);
const after = afterRes.data.overview;

record("Overview: users grew by role and total", 200, afterRes,
  () => after.users.student - before.users.student === 2 &&
        after.users.instructor - before.users.instructor === 2 &&
        after.users.total - before.users.total === 4 &&
        after.users.newLast30Days - before.users.newLast30Days === 3);
record("Overview: courses grew by status", 200, afterRes,
  () => after.courses.approved - before.courses.approved === 4 &&
        after.courses.draft - before.courses.draft === 1 &&
        after.courses.submitted - before.courses.submitted === 1 &&
        after.courses.rejected - before.courses.rejected === 1 &&
        after.courses.total - before.courses.total === 7 &&
        after.courses.pendingReview - before.courses.pendingReview === 1);
record("Overview: enrollments (total and last 30 days)", 200, afterRes,
  () => after.enrollments.total - before.enrollments.total === 10 &&
        after.enrollments.last30Days - before.enrollments.last30Days === 9 &&
        after.enrollments.completed - before.enrollments.completed === 1);
record("Overview: revenue (total and last 30 days)", 200, afterRes,
  () => diff(after.revenue.total, before.revenue.total) === 2000260 &&
        diff(after.revenue.last30Days, before.revenue.last30Days) === 2000200);
record("Overview: ratings are valid numbers", 200, afterRes,
  () => after.ratings.averageRating >= 0 && after.ratings.averageRating <= 5 &&
        after.ratings.totalReviews >= 9999 &&
        after.enrollments.completionRate >= 0 && after.enrollments.completionRate <= 100);
record("Overview does not expose emails or password hashes", 200, afterRes,
  () => !JSON.stringify(afterRes.data).includes("@") && !JSON.stringify(afterRes.data).includes("$2"));

// ---------- Top courses ----------
const byRevenue = record("Top courses by revenue: biggest earner first", 200,
  await get(`${U}/top-courses?by=revenue&limit=5`, ad),
  (d) => d.courses.length <= 5 && d.courses[0].title === "Zadmin Top Revenue" &&
         d.courses[0].revenue === 2000000 && d.courses[0].enrollments === 2 &&
         d.courses[0].instructorName === "Zadmin Instructor" &&
         !JSON.stringify(d).includes("@"));
record("Top courses by enrollments: sorted, and counts are correct", 200,
  await get(`${U}/top-courses?by=enrollments&limit=20`, ad),
  (d) => {
    const counts = d.courses.map((c) => c.enrollments);
    const sorted = counts.every((n, i) => i === 0 || counts[i - 1] >= n);
    const t2 = d.courses.find((c) => c.title === "Zadmin Top Enroll");
    // seed me zyada enrollments wale courses ho sakte hain, to ye list me na bhi aaye
    return sorted && (!t2 || (t2.enrollments === 5 && t2.revenue === 0));
  });
record("Top courses by rating: highest rated first", 200,
  await get(`${U}/top-courses?by=rating&limit=5`, ad),
  (d) => d.courses[0].title === "Zadmin Top Rated" && d.courses[0].averageRating === 5 &&
         d.courses.every((c) => c.reviewCount > 0));
record("Top courses default (by enrollments, 5)", 200, await get(`${U}/top-courses`, ad),
  (d) => d.courses.length <= 5 && d.courses.length > 0);
record("Top courses: unknown 'by' is rejected", 400, await get(`${U}/top-courses?by=bogus`, ad));
record("Top courses: limit=0 is rejected", 400, await get(`${U}/top-courses?limit=0`, ad));
record("Top courses: limit=21 is rejected", 400, await get(`${U}/top-courses?limit=21`, ad));
record("Top courses: repeated parameter is rejected", 400, await get(`${U}/top-courses?limit=1&limit=2`, ad));

// ---------- Top instructors ----------
record("Top instructors: biggest earner first, name only", 200,
  await get(`${U}/top-instructors?limit=5`, ad),
  (d) => d.instructors[0].name === "Zadmin Instructor" &&
         d.instructors[0].revenue === 2000260 && d.instructors[0].enrollments === 10 &&
         d.instructors[0].coursesWithEnrollments === 3 &&
         !JSON.stringify(d).includes("@"));
record("Top instructors: limit=0 is rejected", 400, await get(`${U}/top-instructors?limit=0`, ad));

// ---------- Mahine ke hisaab se ----------
record("Monthly: new users, enrollments, revenue add up", 200, await get(`${U}/monthly?months=6`, ad),
  (d) => {
    const m = d.months;
    const cur = m[5];
    const curBefore = beforeMonthly[5];
    return m.length === 6 &&
      sum(m, "newUsers") - sum(beforeMonthly, "newUsers") === 4 &&
      sum(m, "enrollments") - sum(beforeMonthly, "enrollments") === 10 &&
      diff(sum(m, "revenue"), sum(beforeMonthly, "revenue")) === 2000260 &&
      cur.newUsers - curBefore.newUsers === 3 &&
      cur.enrollments - curBefore.enrollments === 9 &&
      diff(cur.revenue, curBefore.revenue) === 2000200;
  });
record("Monthly default is 6 months", 200, await get(`${U}/monthly`, ad), (d) => d.months.length === 6);
record("Monthly: months=0 is rejected", 400, await get(`${U}/monthly?months=0`, ad));
record("Monthly: months=25 is rejected", 400, await get(`${U}/monthly?months=25`, ad));
record("Monthly: months=abc is rejected", 400, await get(`${U}/monthly?months=abc`, ad));

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