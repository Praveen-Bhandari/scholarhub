import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import User from "../models/User.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const ZERO_ID = "000000000000000000000000";

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login failed for ${email}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function call(method, url, cookie) {
  const res = await fetch(BASE + url, {
    method,
    headers: cookie ? { Cookie: cookie } : {},
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
  const old = await Course.find({ title: /^Zenroll/ }).select("_id");
  const ids = old.map((c) => c._id);
  await Enrollment.deleteMany({ course: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await cleanup();

const instructor = await User.findOne({ email: "instructor1@example.com" });

// dusra student seedha database me (email nahi bhejni)
let student2 = await User.findOne({ email: "student2@example.com" });
if (!student2) {
  student2 = await User.create({
    name: "Second Student",
    email: "student2@example.com",
    password: "student123456",
    isEmailVerified: true,
  });
}

const course = await Course.create({
  title: "Zenroll Course",
  description: "demo",
  category: "web",
  instructor: instructor._id,
  status: "approved",
  sections: [
    { title: "S1", order: 0, lessons: [{ title: "L1", order: 0 }, { title: "L2", order: 1 }] },
    { title: "S2", order: 1, lessons: [{ title: "L3", order: 0 }] },
  ],
});
const draft = await Course.create({
  title: "Zenroll Draft",
  description: "demo",
  category: "web",
  instructor: instructor._id,
  status: "draft",
});
const cid = course._id.toString();

const s1 = await login("student1@example.com", "newpassword456");
const s2 = await login("student2@example.com", "student123456");
const i1 = await login("instructor1@example.com", "password123");
const ad = await login("admin@example.com", "admin12345");

// --- kaun enroll kar sakta hai ---
record("Anonymous enrolls", 401, await call("POST", `/courses/${cid}/enroll`, null));
record("Instructor enrolls", 403, await call("POST", `/courses/${cid}/enroll`, i1));
record("Admin enrolls", 403, await call("POST", `/courses/${cid}/enroll`, ad));

// --- course ke hisaab se ---
record("Enrolling in a draft course gives 404", 404, await call("POST", `/courses/${draft._id}/enroll`, s1));
record("Enrolling in a course that does not exist gives 404", 404, await call("POST", `/courses/${ZERO_ID}/enroll`, s1));
record("Invalid course id gives 400", 400, await call("POST", "/courses/abc/enroll", s1));

// --- enroll ---
record("Student enrolls in an approved course", 201, await call("POST", `/courses/${cid}/enroll`, s1),
  (d) => d.enrollment.course === cid);
record("Enrolling again gives 409", 409, await call("POST", `/courses/${cid}/enroll`, s1));

// --- meri list ---
record("Anonymous opens my enrollments", 401, await call("GET", "/enrollments/mine", null));
record("Instructor opens my enrollments", 403, await call("GET", "/enrollments/mine", i1));
record("My enrollments show the course with 0% progress", 200, await call("GET", "/enrollments/mine", s1),
  (d) => {
    const e = d.enrollments.find((x) => x.course._id === cid);
    return e && e.totalLessons === 3 && e.completedCount === 0 && e.progressPercent === 0 &&
           e.course.title === "Zenroll Course" && !("sections" in e.course);
  });
record("Another student does not see my enrollment", 200, await call("GET", "/enrollments/mine", s2),
  (d) => d.enrollments.every((x) => x.course._id !== cid));

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