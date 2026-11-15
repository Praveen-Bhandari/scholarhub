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
  const old = await Course.find({ title: /^Zlearn/ }).select("_id");
  const ids = old.map((c) => c._id);
  await Enrollment.deleteMany({ course: { $in: ids } });
  await Course.deleteMany({ _id: { $in: ids } });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await cleanup();

const instructor = await User.findOne({ email: "instructor1@example.com" });

const course = await Course.create({
  title: "Zlearn Course",
  description: "demo",
  category: "web",
  instructor: instructor._id,
  status: "approved",
  sections: [
    {
      title: "S1", order: 0,
      lessons: [
        {
          title: "L1", order: 0, content: "lesson one content",
          attachments: [{ name: "notes.pdf", url: "https://example.com/notes.pdf", publicId: "x", resourceType: "raw", bytes: 1 }],
        },
        { title: "L2", order: 1, content: "lesson two content" },
      ],
    },
    { title: "S2", order: 1, lessons: [{ title: "L3", order: 0, content: "lesson three content" }] },
  ],
});
const draft = await Course.create({
  title: "Zlearn Draft", description: "demo", category: "web",
  instructor: instructor._id, status: "draft",
  sections: [{ title: "D1", order: 0, lessons: [{ title: "DL1", order: 0 }] }],
});

const cid = course._id.toString();
const [L1, L2, L3] = course.sections.flatMap((s) => s.lessons.map((l) => l._id.toString()));
const otherLesson = draft.sections[0].lessons[0]._id.toString();

const s1 = await login("student1@example.com", "newpassword456");
const s2 = await login("student2@example.com", "student123456");
const i1 = await login("instructor1@example.com", "password123");
const i2 = await login("instructor2@example.com", "password123");
const ad = await login("admin@example.com", "admin12345");

const learn = `/learn/courses/${cid}`;
const lessonUrl = (id) => `/enrollments/${cid}/lessons/${id}/complete`;

// ---------- Content access ----------
record("Anonymous opens course content", 401, await call("GET", learn, null));
record("Student who is not enrolled opens content", 403, await call("GET", learn, s2));
record("Other instructor opens content", 403, await call("GET", learn, i2));

record("Student enrolls (setup)", 201, await call("POST", `/courses/${cid}/enroll`, s1));
record("Student 2 enrolls (setup)", 201, await call("POST", `/courses/${cid}/enroll`, s2));

record("Enrolled student sees full content and attachments", 200, await call("GET", learn, s1),
  (d) => d.course.sections[0].lessons[0].content === "lesson one content" &&
         d.course.sections[0].lessons[0].attachments.length === 1 &&
         d.progress.progressPercent === 0 && d.progress.resumeLessonId === L1);
record("Owner instructor sees content (no progress)", 200, await call("GET", learn, i1),
  (d) => d.course.sections[0].lessons[0].content === "lesson one content" && d.progress === null);
record("Admin sees content", 200, await call("GET", learn, ad));

record("Draft content: owner can open", 200, await call("GET", `/learn/courses/${draft._id}`, i1));
record("Draft content: admin can open", 200, await call("GET", `/learn/courses/${draft._id}`, ad));
record("Draft content: student gets 404", 404, await call("GET", `/learn/courses/${draft._id}`, s1));
record("Draft content: other instructor gets 404", 404, await call("GET", `/learn/courses/${draft._id}`, i2));
record("Content of a course that does not exist", 404, await call("GET", `/learn/courses/${ZERO_ID}`, s1));
record("Content with an invalid id", 400, await call("GET", "/learn/courses/abc", s1));

// ---------- Progress: kaun kar sakta hai ----------
record("Anonymous completes a lesson", 401, await call("POST", lessonUrl(L1), null));
record("Instructor completes a lesson", 403, await call("POST", lessonUrl(L1), i1));
record("My enrollment in a course I did not join", 404,
  await call("GET", `/enrollments/${draft._id}`, s1));

// ---------- Progress ----------
record("Complete lesson 1: 1 of 3, 33%", 200, await call("POST", lessonUrl(L1), s1),
  (d) => d.progress.completedCount === 1 && d.progress.progressPercent === 33 &&
         d.progress.lastLesson === L1 && d.progress.certificateId === null);
record("Completing the same lesson again changes nothing", 200, await call("POST", lessonUrl(L1), s1),
  (d) => d.progress.completedCount === 1);
record("Lesson from another course is rejected", 404, await call("POST", lessonUrl(otherLesson), s1));
record("Lesson that does not exist is rejected", 404, await call("POST", lessonUrl(ZERO_ID), s1));
record("Invalid lesson id is rejected", 400, await call("POST", lessonUrl("abc"), s1));

record("Student 2 progress is not affected", 200, await call("GET", `/enrollments/${cid}`, s2),
  (d) => d.enrollment.completedCount === 0);

// ---------- Resume ----------
record("Save last lesson (L2)", 200, await call("PUT", `/enrollments/${cid}/last-lesson`, s1, { lessonId: L2 }),
  (d) => d.progress.lastLesson === L2 && d.progress.completedCount === 1);
record("Last lesson from another course is rejected", 404,
  await call("PUT", `/enrollments/${cid}/last-lesson`, s1, { lessonId: otherLesson }));
record("Content now resumes at L2", 200, await call("GET", learn, s1),
  (d) => d.progress.resumeLessonId === L2);

// ---------- Uncomplete ----------
record("Uncomplete lesson 1", 200, await call("DELETE", lessonUrl(L1), s1),
  (d) => d.progress.completedCount === 0 && d.progress.progressPercent === 0);

// ---------- Certificate ----------
await call("POST", lessonUrl(L1), s1);
await call("POST", lessonUrl(L2), s1);
const done = record("Completing every lesson gives 100% and a certificate", 200, await call("POST", lessonUrl(L3), s1),
  (d) => d.progress.progressPercent === 100 && d.progress.completedAt &&
         /^SH-[0-9A-F]{10}$/.test(d.progress.certificateId));
const certId = done.data?.progress?.certificateId;

record("Completing again keeps the same certificate", 200, await call("POST", lessonUrl(L3), s1),
  (d) => d.progress.certificateId === certId);
record("Uncompleting a lesson keeps the certificate", 200, await call("DELETE", lessonUrl(L3), s1),
  (d) => d.progress.progressPercent === 67 && d.progress.certificateId === certId);

// aggregation wali list bhi wahi progress dikhati hai
record("My enrollments list shows the same progress", 200, await call("GET", "/enrollments/mine", s1),
  (d) => {
    const e = d.enrollments.find((x) => x.course._id === cid);
    return e && e.completedCount === 2 && e.progressPercent === 67 && e.certificateId === certId;
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