import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import Review from "../models/Review.js";
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

async function call(method, url, cookie, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
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
  const old = await Course.find({ title: /^Zreview/ }).select("_id");
  const ids = old.map((c) => c._id);
  await Review.deleteMany({ course: { $in: ids } });
  await Enrollment.deleteMany({ course: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await Review.syncIndexes();
await cleanup();

const instructor = await User.findOne({ email: "instructor1@example.com" });

let student3 = await User.findOne({ email: "student3@example.com" });
if (!student3) {
  student3 = await User.create({
    name: "Third Student",
    email: "student3@example.com",
    password: "student123456",
    isEmailVerified: true,
  });
}

const base = { description: "demo", category: "web", instructor: instructor._id };
const course = await Course.create({
  ...base, title: "Zreview Course", status: "approved",
  sections: [{ title: "S1", order: 0, lessons: [{ title: "L1", order: 0 }] }],
});
const empty = await Course.create({
  ...base, title: "Zreview Empty", status: "approved",
  sections: [{ title: "S1", order: 0, lessons: [{ title: "L1", order: 0 }] }],
});
const draft = await Course.create({ ...base, title: "Zreview Draft", status: "draft" });

const cid = course._id.toString();
const eid = empty._id.toString();
const did = draft._id.toString();

const s1 = await login("student1@example.com", "newpassword456");
const s2 = await login("student2@example.com", "student123456");
const s3 = await login("student3@example.com", "student123456");
const i1 = await login("instructor1@example.com", "password123");
const ad = await login("admin@example.com", "admin12345");

const rv = `/courses/${cid}/reviews`;

async function checkRating(label, avg, count) {
  record(label, 200, await call("GET", `/courses/${cid}`, null),
    (d) => d.course.averageRating === avg && d.course.reviewCount === count);
}

await call("POST", `/courses/${cid}/enroll`, s1);
await call("POST", `/courses/${cid}/enroll`, s2);

record("Anonymous reviews a course", 401, await call("POST", rv, null, { rating: 5 }));
record("Instructor reviews a course", 403, await call("POST", rv, i1, { rating: 5 }));
record("Admin reviews a course", 403, await call("POST", rv, ad, { rating: 5 }));
record("Student who is not enrolled reviews", 403, await call("POST", rv, s3, { rating: 5 }));
record("Review on a draft course gives 404", 404, await call("POST", `/courses/${did}/reviews`, s1, { rating: 5 }));
record("Review with an invalid course id", 400, await call("POST", "/courses/abc/reviews", s1, { rating: 5 }));

// ---------- Validation ----------
for (const [label, body] of [
  ["Rating 0 is rejected", { rating: 0 }],
  ["Rating 6 is rejected", { rating: 6 }],
  ["Rating 4.5 is rejected", { rating: 4.5 }],
  ['Rating "5" sent as text is rejected', { rating: "5" }],
  ["Missing rating is rejected", { comment: "no rating" }],
  ["Comment over 1000 characters is rejected", { rating: 5, comment: "x".repeat(1001) }],
]) {
  record(label, 400, await call("POST", rv, s1, body));
}

record("Student 1 reviews with 5 stars", 201,
  await call("POST", rv, s1, { rating: 5, comment: "Great course" }),
  (d) => d.review.rating === 5 && d.review.comment === "Great course" && !JSON.stringify(d).includes("@"));
record("Reviewing twice gives 409", 409, await call("POST", rv, s1, { rating: 1 }));
await checkRating("Course rating after 1 review is 5 (1 review)", 5, 1);

record("Student 2 reviews with 4 stars", 201, await call("POST", rv, s2, { rating: 4, comment: "Good" }));
await checkRating("Course rating after 2 reviews is 4.5", 4.5, 2);

record("Student 3 enrolls (setup)", 201, await call("POST", `/courses/${cid}/enroll`, s3));
record("Student 3 reads a review that does not exist", 404, await call("GET", `${rv}/mine`, s3));
record("Student 3 edits a review that does not exist", 404, await call("PUT", `${rv}/mine`, s3, { rating: 3 }));
record("Student 3 reviews with 2 stars", 201, await call("POST", rv, s3, { rating: 2, comment: "Too fast" }));
await checkRating("Course rating after 3 reviews is 3.7", 3.7, 3);

record("Anyone reads reviews: newest first, with summary", 200, await call("GET", rv, null),
  (d) => d.reviews.length === 3 && d.reviews[0].student.name === "Third Student" &&
         d.summary.reviewCount === 3 && d.summary.averageRating === 3.7 &&
         d.summary.distribution[5] === 1 && d.summary.distribution[4] === 1 &&
         d.summary.distribution[2] === 1 && d.summary.distribution[1] === 0 &&
         !JSON.stringify(d).includes("@"));
record("Reviews pagination (limit 2, page 2)", 200, await call("GET", `${rv}?limit=2&page=2`, null),
  (d) => d.reviews.length === 1 && d.pagination.total === 3 &&
         d.pagination.totalPages === 2 && d.pagination.hasNext === false);
record("limit=100 is rejected", 400, await call("GET", `${rv}?limit=100`, null));
record("Draft course reviews give 404", 404, await call("GET", `/courses/${did}/reviews`, null));
record("Invalid course id on the reviews list", 400, await call("GET", "/courses/abc/reviews", null));
record("Course without reviews: empty list, zero summary", 200, await call("GET", `/courses/${eid}/reviews`, null),
  (d) => d.reviews.length === 0 && d.summary.reviewCount === 0 &&
         d.summary.averageRating === 0 && d.summary.distribution[3] === 0);

record("Public listing shows the stored rating", 200, await call("GET", "/courses?q=zreview&limit=50", null),
  (d) => {
    const c = d.courses.find((x) => x._id === cid);
    return c && c.averageRating === 3.7 && c.reviewCount === 3;
  });
record("Sorting by rating puts the reviewed course first", 200,
  await call("GET", "/courses?q=zreview&sort=rating", null),
  (d) => d.courses[0]._id === cid);

record("Student 1 reads own review", 200, await call("GET", `${rv}/mine`, s1),
  (d) => d.review.rating === 5);
record("Edit without any field is rejected", 400, await call("PUT", `${rv}/mine`, s1, {}));
record("Edit with rating 9 is rejected", 400, await call("PUT", `${rv}/mine`, s1, { rating: 9 }));
record("Instructor edits a review", 403, await call("PUT", `${rv}/mine`, i1, { rating: 1 }));
record("Student 3 edits own review (2 to 3 stars)", 200, await call("PUT", `${rv}/mine`, s3, { rating: 3 }),
  (d) => d.review.rating === 3 && d.review.comment === "Too fast");
await checkRating("Course rating after the edit is 4", 4, 3);

// ---------- Delete ----------
record("Student 2 deletes own review", 200, await call("DELETE", `${rv}/mine`, s2));
await checkRating("Course rating after one delete is 4 (2 reviews)", 4, 2);
record("Deleting again gives 404", 404, await call("DELETE", `${rv}/mine`, s2));
record("Student 1 deletes own review", 200, await call("DELETE", `${rv}/mine`, s1));
await checkRating("Course rating is 3 (1 review)", 3, 1);
record("Student 3 deletes own review", 200, await call("DELETE", `${rv}/mine`, s3));
await checkRating("Course rating is back to 0 (no reviews)", 0, 0);

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