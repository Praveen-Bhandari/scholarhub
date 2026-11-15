import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

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

// file bhejne wala helper. buffer null ho to file ke bina form bhejta hai
async function upload(url, cookie, { field = "thumbnail", buffer, type, name = "file" }) {
  const form = new FormData();
  if (buffer) form.append(field, new Blob([buffer], { type }), name);
  else form.append("note", "no file here");
  const res = await fetch(BASE + url, {
    method: "PUT",
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
await Course.deleteMany({ title: /^Upload Fixture/ });

const i1 = await login("instructor1@example.com", "password123");
const i2 = await login("instructor2@example.com", "password123");
const st = await login("student1@example.com", "newpassword456");

const created = await json("POST", "/courses", i1, {
  title: "Upload Fixture",
  description: "demo",
  category: "web",
});
const cid = created.data.course._id;
const url = `/courses/${cid}/thumbnail`;

// --- kaun upload kar sakta hai ---
record("Anonymous uploads a thumbnail", 401, await upload(url, null, { buffer: PNG, type: "image/png", name: "a.png" }));
record("Student uploads a thumbnail", 403, await upload(url, st, { buffer: PNG, type: "image/png", name: "a.png" }));
record("Other instructor uploads a thumbnail", 403, await upload(url, i2, { buffer: PNG, type: "image/png", name: "a.png" }));

// --- file validation ---
record("Text file (text/plain) is rejected", 400,
  await upload(url, i1, { buffer: Buffer.from("just some text, not an image"), type: "text/plain", name: "a.txt" }));
record("Fake image (text sent as image/png) is rejected", 400,
  await upload(url, i1, { buffer: Buffer.from("this is not really a png file"), type: "image/png", name: "fake.png" }));

const big = Buffer.alloc(3 * 1024 * 1024);
PNG.copy(big, 0, 0, 8);
record("File over 2 MB is rejected", 413, await upload(url, i1, { buffer: big, type: "image/png", name: "big.png" }));
record("Request without a file is rejected", 400, await upload(url, i1, { buffer: null }));
record("Wrong field name is rejected", 400,
  await upload(url, i1, { field: "photo", buffer: PNG, type: "image/png", name: "a.png" }));

// --- sahi upload ---
const first = record("Valid PNG is uploaded", 200,
  await upload(url, i1, { buffer: PNG, type: "image/png", name: "ok.png" }),
  (d) => d.thumbnail.url.startsWith("https://res.cloudinary.com/"));
const firstId = first.data?.thumbnail?.publicId;

const second = record("Thumbnail can be replaced", 200,
  await upload(url, i1, { buffer: PNG, type: "image/png", name: "ok2.png" }),
  (d) => d.thumbnail.publicId !== firstId);

record("Thumbnail is saved on the course", 200,
  await json("GET", `/courses/mine/${cid}`, i1),
  (d) => d.course.thumbnail.publicId === second.data.thumbnail.publicId);

// --- delete ---
record("Other instructor removes the thumbnail", 403, await json("DELETE", url, i2));
record("Owner removes the thumbnail", 200, await json("DELETE", url, i1));
record("Removing again gives 404", 404, await json("DELETE", url, i1));

// ------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  expected ${r.expected}, got ${r.got}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);

await Course.deleteMany({ title: /^Upload Fixture/ });
await mongoose.disconnect();
process.exit(failed ? 1 : 0);