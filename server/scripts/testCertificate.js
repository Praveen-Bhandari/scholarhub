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
  const old = await Course.find({ title: /^Zcert/ }).select("_id");
  const ids = old.map((c) => c._id);
  await Enrollment.deleteMany({ course: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await Enrollment.syncIndexes(); // certificateId ka unique index pakka lagao
await cleanup();

const instructor = await User.findOne({ email: "instructor1@example.com" });
const student2 = await User.findOne({ email: "student2@example.com" });

const course = await Course.create({
  title: "Zcert Course",
  description: "demo",
  category: "web",
  instructor: instructor._id,
  status: "approved",
  sections: [
    {
      title: "S1", order: 0,
      lessons: [
        { title: "L1", order: 0, durationMinutes: 5 },
        { title: "L2", order: 1, durationMinutes: 10 },
      ],
    },
  ],
});
const cid = course._id.toString();
const [L1, L2] = course.sections[0].lessons.map((l) => l._id.toString());

const s1 = await login("student1@example.com", "newpassword456");
const s2 = await login("student2@example.com", "student123456");
const i1 = await login("instructor1@example.com", "password123");

const certUrl = `/enrollments/${cid}/certificate`;
const done = (id) => `/enrollments/${cid}/lessons/${id}/complete`;

// ---------- Certificate paane se pehle ----------
record("Anonymous asks for a certificate", 401, await call("GET", certUrl, null));
record("Instructor asks for a certificate", 403, await call("GET", certUrl, i1));
record("Invalid course id", 400, await call("GET", "/enrollments/abc/certificate", s1));
record("Student who is not enrolled", 404, await call("GET", certUrl, s2));

record("Student enrolls (setup)", 201, await call("POST", `/courses/${cid}/enroll`, s1));
record("Enrolled but course not finished gives 409", 409, await call("GET", certUrl, s1));

await call("POST", done(L1), s1);
record("One lesson of two is still not enough", 409, await call("GET", certUrl, s1));

// ---------- Course poora ----------
await call("POST", done(L2), s1);
const mine = record("Finished course gives a certificate", 200, await call("GET", certUrl, s1),
  (d) => /^SH-[0-9A-F]{10}$/.test(d.certificate.certificateId) &&
         d.certificate.studentName === "Test Student" &&
         d.certificate.courseTitle === "Zcert Course" &&
         d.certificate.instructorName === "Test Instructor" &&
         Boolean(d.certificate.completedAt) &&
         d.certificate.totalLessons === 2 && d.certificate.totalDurationMinutes === 15);
const certId = mine.data?.certificate?.certificateId;

record("Another student cannot see this certificate", 404, await call("GET", certUrl, s2));

// ---------- Public verify ----------
record("Anyone can verify a certificate (no login)", 200, await call("GET", `/certificates/${certId}`, null),
  (d) => d.valid === true && d.certificate.studentName === "Test Student" &&
         d.certificate.courseTitle === "Zcert Course");
record("Verify response does not expose an email", 200, await call("GET", `/certificates/${certId}`, null),
  (d) => !JSON.stringify(d).includes("@"));
record("Certificate id works in lowercase", 200, await call("GET", `/certificates/${certId.toLowerCase()}`, null),
  (d) => d.valid === true);
record("Badly formed certificate id", 400, await call("GET", "/certificates/abc", null));
record("Certificate id that does not exist", 404, await call("GET", "/certificates/SH-0000000000", null),
  (d) => d.valid === false);

// ---------- Certificate nahi jaata ----------
await call("DELETE", done(L2), s1);
record("Certificate stays after a lesson is uncompleted", 200, await call("GET", certUrl, s1),
  (d) => d.certificate.certificateId === certId);

// ---------- Unique index ----------
let duplicateRejected = false;
try {
  await Enrollment.create({ student: student2._id, course: course._id, certificateId: certId });
} catch (err) {
  duplicateRejected = err.code === 11000;
}
rows.push({
  label: "Same certificate id cannot be saved twice",
  expected: "duplicate rejected",
  got: duplicateRejected ? "duplicate rejected" : "duplicate saved",
  pass: duplicateRejected,
});

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