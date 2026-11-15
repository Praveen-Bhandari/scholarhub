import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import Course from "../models/Course.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;

const USERS = {
  admin: { email: "admin@example.com", password: "admin12345" },
  instructor1: { email: "instructor1@example.com", password: "password123" },
  instructor2: { email: "instructor2@example.com", password: "password123" },
  student: { email: "student1@example.com", password: "newpassword456" },
};

const ZERO_ID = "000000000000000000000000";

async function call(method, url, cookie, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // body khali ho sakti hai
  }
  return { status: res.status, data, res };
}

async function login(user) {
  const { status, data, res } = await call("POST", "/auth/login", null, user);
  if (status !== 200) {
    throw new Error(`Login failed for ${user.email} (status ${status})`);
  }
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  return { cookie, id: data.user.id };
}

// setup steps: fail hone par script rok do
async function setup(method, url, cookie, body) {
  const r = await call(method, url, cookie, body);
  if (r.status >= 300) {
    throw new Error(`Setup failed: ${method} ${url} -> ${r.status}`);
  }
  return r.data;
}

const rows = [];
async function check(group, label, expected, fn, verify) {
  const r = await fn();
  let pass = r.status === expected;
  if (pass && verify) pass = Boolean(verify(r.data));
  rows.push({ group, label, expected, got: r.status, pass });
  return r;
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await Course.deleteMany({ title: /^RBAC Fixture/ });

const sessions = {};
for (const [name, u] of Object.entries(USERS)) {
  sessions[name] = await login(u);
}
const as = (name) => sessions[name].cookie;

const payload = { title: "RBAC Fixture", description: "demo", category: "web" };

// ---------- ROLE ----------
await check("Role", "Anonymous creates a course", 401, () =>
  call("POST", "/courses", null, payload)
);
await check("Role", "Student creates a course", 403, () =>
  call("POST", "/courses", as("student"), payload)
);
await check("Role", "Admin creates a course", 403, () =>
  call("POST", "/courses", as("admin"), payload)
);

const created = await check("Role", "Instructor creates a course", 201, () =>
  call("POST", "/courses", as("instructor1"), payload)
);
const cid = created.data.course._id;

const sid = (
  await setup("POST", `/courses/${cid}/sections`, as("instructor1"), { title: "Intro" })
).section._id;
const lid = (
  await setup("POST", `/courses/${cid}/sections/${sid}/lessons`, as("instructor1"), {
    title: "Welcome",
    content: "Hello",
  })
).lesson._id;

await check("Role", "Anonymous lists own courses", 401, () =>
  call("GET", "/courses/mine", null)
);
await check("Role", "Student lists own courses", 403, () =>
  call("GET", "/courses/mine", as("student"))
);
await check("Role", "Student submits a course", 403, () =>
  call("POST", `/courses/${cid}/submit`, as("student"))
);
await check("Role", "Anonymous approves a course", 401, () =>
  call("PATCH", `/admin/courses/${cid}/approve`, null)
);
await check("Role", "Student approves a course", 403, () =>
  call("PATCH", `/admin/courses/${cid}/approve`, as("student"))
);
await check("Role", "Instructor approves own course", 403, () =>
  call("PATCH", `/admin/courses/${cid}/approve`, as("instructor1"))
);
await check("Role", "Instructor opens admin review list", 403, () =>
  call("GET", "/admin/courses", as("instructor1"))
);

// ---------- OWNERSHIP (instructor2, instructor1 ke course par) ----------
const i2 = as("instructor2");
await check("Ownership", "Other instructor reads the course", 403, () =>
  call("GET", `/courses/mine/${cid}`, i2)
);
await check("Ownership", "Other instructor edits the course", 403, () =>
  call("PUT", `/courses/${cid}`, i2, { title: "Hacked" })
);
await check("Ownership", "Other instructor deletes the course", 403, () =>
  call("DELETE", `/courses/${cid}`, i2)
);
await check("Ownership", "Other instructor adds a section", 403, () =>
  call("POST", `/courses/${cid}/sections`, i2, { title: "Injected" })
);
await check("Ownership", "Other instructor edits a section", 403, () =>
  call("PUT", `/courses/${cid}/sections/${sid}`, i2, { title: "Injected" })
);
await check("Ownership", "Other instructor deletes a section", 403, () =>
  call("DELETE", `/courses/${cid}/sections/${sid}`, i2)
);
await check("Ownership", "Other instructor adds a lesson", 403, () =>
  call("POST", `/courses/${cid}/sections/${sid}/lessons`, i2, { title: "Injected" })
);
await check("Ownership", "Other instructor edits a lesson", 403, () =>
  call("PUT", `/courses/${cid}/sections/${sid}/lessons/${lid}`, i2, { title: "Injected" })
);
await check("Ownership", "Other instructor deletes a lesson", 403, () =>
  call("DELETE", `/courses/${cid}/sections/${sid}/lessons/${lid}`, i2)
);
await check("Ownership", "Other instructor submits the course", 403, () =>
  call("POST", `/courses/${cid}/submit`, i2)
);
await check(
  "Ownership",
  "Other instructor's list does not contain the course",
  200,
  () => call("GET", "/courses/mine", i2),
  (d) => !d.courses.some((c) => c._id === cid)
);

// ---------- TAMPERING ----------
await check(
  "Tampering",
  "status and instructor in create body are ignored",
  201,
  () =>
    call("POST", "/courses", as("instructor1"), {
      title: "RBAC Fixture tamper",
      description: "x",
      category: "web",
      status: "approved",
      instructor: ZERO_ID,
    }),
  (d) => d.course.status === "draft" && d.course.instructor === sessions.instructor1.id
);
await check(
  "Tampering",
  "status in update body is ignored",
  200,
  () => call("PUT", `/courses/${cid}`, as("instructor1"), { status: "approved" }),
  (d) => d.course.status === "draft"
);

// ---------- LIFECYCLE ----------
await check("Lifecycle", "Owner submits a course with a lesson", 200, () =>
  call("POST", `/courses/${cid}/submit`, as("instructor1"))
);
await check("Lifecycle", "Owner edits a submitted course", 409, () =>
  call("PUT", `/courses/${cid}`, as("instructor1"), { title: "RBAC Fixture edit" })
);
await check("Lifecycle", "Owner submits again", 409, () =>
  call("POST", `/courses/${cid}/submit`, as("instructor1"))
);
await check("Lifecycle", "Admin rejects without a reason", 400, () =>
  call("PATCH", `/admin/courses/${cid}/reject`, as("admin"), {})
);
await check("Lifecycle", "Admin approves a submitted course", 200, () =>
  call("PATCH", `/admin/courses/${cid}/approve`, as("admin"))
);
await check("Lifecycle", "Admin approves again", 409, () =>
  call("PATCH", `/admin/courses/${cid}/approve`, as("admin"))
);
await check("Lifecycle", "Owner deletes an approved course", 409, () =>
  call("DELETE", `/courses/${cid}`, as("instructor1"))
);
await check("Lifecycle", "Admin approves a course that does not exist", 404, () =>
  call("PATCH", `/admin/courses/${ZERO_ID}/approve`, as("admin"))
);
await check("Lifecycle", "Admin approves with an invalid id", 400, () =>
  call("PATCH", `/admin/courses/abc/approve`, as("admin"))
);
await check("Lifecycle", "Owner reads a course with an invalid id", 400, () =>
  call("GET", "/courses/mine/abc", as("instructor1"))
);
await check("Lifecycle", "Owner reads a course that does not exist", 404, () =>
  call("GET", `/courses/mine/${ZERO_ID}`, as("instructor1"))
);

// ---------- Result ----------
const labelWidth = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(
    `${r.pass ? "PASS" : "FAIL"}  ${r.group.padEnd(10)} ${r.label.padEnd(labelWidth)}  expected ${r.expected}, got ${r.got}`
  );
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);

// docs folder me markdown table
const docsDir = path.join(import.meta.dirname, "..", "..", "docs");
fs.mkdirSync(docsDir, { recursive: true });
const md = [
  "# Role and ownership test table",
  "",
  `Generated by server/scripts/testRolesOwnership.js on ${new Date().toISOString().slice(0, 10)}`,
  "",
  "| # | Area | Case | Expected | Got | Result |",
  "|---|------|------|----------|-----|--------|",
  ...rows.map(
    (r, i) =>
      `| ${i + 1} | ${r.group} | ${r.label} | ${r.expected} | ${r.got} | ${r.pass ? "PASS" : "FAIL"} |`
  ),
  "",
  `**${rows.length - failed}/${rows.length} passed**`,
  "",
].join("\n");
fs.writeFileSync(path.join(docsDir, "role-ownership-table.md"), md);
console.log("Table saved to docs/role-ownership-table.md");

// test courses saaf karo
await Course.deleteMany({ title: /^RBAC Fixture/ });
await mongoose.disconnect();
process.exit(failed ? 1 : 0);