import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
const ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(30)]);
const FAKE = Buffer.from("MZ this is not a pdf, it pretends to be one");

async function login(email, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) throw new Error(`Login failed for ${email}`);
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

async function json(method, url, cookie, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

async function sendFile(url, cookie, buffer, type, name) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), name);
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: form,
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

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await Course.deleteMany({ title: /^Attachment Fixture/ });

const i1 = await login("instructor1@example.com", "password123");
const i2 = await login("instructor2@example.com", "password123");
const st = await login("student1@example.com", "newpassword456");

const cid = (await json("POST", "/courses", i1, {
  title: "Attachment Fixture", description: "demo", category: "web",
})).data.course._id;
const sid = (await json("POST", `/courses/${cid}/sections`, i1, { title: "Intro" })).data.section._id;
const lid = (await json("POST", `/courses/${cid}/sections/${sid}/lessons`, i1, { title: "Welcome" })).data.lesson._id;

const url = `/courses/${cid}/sections/${sid}/lessons/${lid}/attachments`;

// --- kaun upload kar sakta hai ---
record("Anonymous uploads an attachment", 401, await sendFile(url, null, PDF, "application/pdf", "a.pdf"));
record("Student uploads an attachment", 403, await sendFile(url, st, PDF, "application/pdf", "a.pdf"));
record("Other instructor uploads an attachment", 403, await sendFile(url, i2, PDF, "application/pdf", "a.pdf"));
record("Lesson that does not exist gives 404", 404,
  await sendFile(`/courses/${cid}/sections/${sid}/lessons/000000000000000000000000/attachments`, i1, PDF, "application/pdf", "a.pdf"));
record("Invalid lesson id gives 400", 400,
  await sendFile(`/courses/${cid}/sections/${sid}/lessons/abc/attachments`, i1, PDF, "application/pdf", "a.pdf"));

// --- file validation ---
record("Text file is rejected", 400, await sendFile(url, i1, Buffer.from("plain text file content"), "text/plain", "a.txt"));
record("Fake PDF (wrong content) is rejected", 400, await sendFile(url, i1, FAKE, "application/pdf", "evil.pdf"));
const big = Buffer.concat([PDF, Buffer.alloc(11 * 1024 * 1024)]);
record("File over 10 MB is rejected", 413, await sendFile(url, i1, big, "application/pdf", "big.pdf"));

// --- sahi uploads ---
const pdf = record("Valid PDF is uploaded", 201,
  await sendFile(url, i1, PDF, "application/pdf", "Lesson Notes.pdf"),
  (d) => d.attachment.resourceType === "raw" && d.attachment.url.startsWith("https://res.cloudinary.com/"));
record("Valid PNG is uploaded", 201,
  await sendFile(url, i1, PNG, "image/png", "diagram.png"),
  (d) => d.attachment.resourceType === "image");
record("Valid ZIP is uploaded (Windows mimetype)", 201,
  await sendFile(url, i1, ZIP, "application/x-zip-compressed", "code.zip"),
  (d) => d.attachment.resourceType === "raw");

// --- limit: ab 3 hain, 2 aur, phir 6th reject ---
record("4th attachment is uploaded", 201, await sendFile(url, i1, PNG, "image/png", "d2.png"));
record("5th attachment is uploaded", 201, await sendFile(url, i1, PNG, "image/png", "d3.png"));
record("6th attachment is rejected (limit 5)", 409, await sendFile(url, i1, PNG, "image/png", "d4.png"));

// --- course me dikh rahe hain? ---
record("Course shows 5 attachments on the lesson", 200,
  await json("GET", `/courses/mine/${cid}`, i1),
  (d) => d.course.sections[0].lessons[0].attachments.length === 5);

// --- delete ---
const aid = pdf.data?.attachment?._id;
record("Other instructor deletes an attachment", 403, await json("DELETE", `${url}/${aid}`, i2));
record("Owner deletes an attachment", 200, await json("DELETE", `${url}/${aid}`, i1));
record("Deleting again gives 404", 404, await json("DELETE", `${url}/${aid}`, i1));
record("Course now shows 4 attachments", 200,
  await json("GET", `/courses/mine/${cid}`, i1),
  (d) => d.course.sections[0].lessons[0].attachments.length === 4);

// ------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  expected ${r.expected}, got ${r.got}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);

const left = (await json("GET", `/courses/mine/${cid}`, i1)).data.course.sections[0].lessons[0].attachments;
for (const a of left) await json("DELETE", `${url}/${a._id}`, i1);
await Course.deleteMany({ title: /^Attachment Fixture/ });
await mongoose.disconnect();
process.exit(failed ? 1 : 0);