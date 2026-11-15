import "dotenv/config";
import mongoose from "mongoose";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const ZERO_ID = "000000000000000000000000";
const PASSWORD = "student123456";

async function call(method, url, cookie, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  const cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, data, cookies };
}

// login: status ke saath cookie bhi
const login = (email, password) =>
  call("POST", "/auth/login", null, { email, password });

async function mustLogin(email, password) {
  const r = await login(email, password);
  if (r.status !== 200) throw new Error(`Login failed for ${email}`);
  return r.cookies;
}

const rows = [];
function record(label, expected, r, verify) {
  let pass = r.status === expected;
  if (pass && verify) pass = Boolean(verify(r.data));
  rows.push({ label, expected, got: r.status, pass });
  return r;
}

async function cleanup() {
  const users = await User.find({ email: /^zuser/ }).select("_id");
  await RefreshToken.deleteMany({ user: { $in: users.map((u) => u._id) } });
  await User.deleteMany({ email: /^zuser/ });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await cleanup();

const mk = (name, email, role) =>
  User.create({ name, email, password: PASSWORD, role, isEmailVerified: true });

const zs = await mk("Zuser Student", "zuser-student@example.com", "student");
const zi = await mk("Zuser Instructor", "zuser-instructor@example.com", "instructor");
await mk("Zuser Extra", "zuser-extra@example.com", "student");

const adminDoc = await User.findOne({ email: "admin@example.com" });
const ad = await mustLogin("admin@example.com", "admin12345");
const st = await mustLogin("student1@example.com", "newpassword456");
const i1 = await mustLogin("instructor1@example.com", "password123");

const L = "/admin/users";
const patch = (id, body, cookie = ad) => call("PATCH", `${L}/${id}`, cookie, body);

// ---------- Kaun dekh sakta hai ----------
record("List: anonymous", 401, await call("GET", L, null));
record("List: student", 403, await call("GET", L, st));
record("List: instructor", 403, await call("GET", L, i1));
record("Update: anonymous", 401, await call("PATCH", `${L}/${zs._id}`, null, { role: "admin" }));
record("Update: student", 403, await call("PATCH", `${L}/${zs._id}`, st, { role: "admin" }));
record("Update: instructor", 403, await call("PATCH", `${L}/${zs._id}`, i1, { role: "admin" }));

// ---------- List ----------
record("List shows safe fields only", 200, await call("GET", L, ad),
  (d) => d.users.length > 0 &&
         d.users.every((u) => ["id", "name", "email", "role", "isEmailVerified", "isActive", "createdAt"]
           .every((k) => k in u) && !("password" in u)) &&
         !JSON.stringify(d).includes("$2"));
record("Search by name finds the 3 test users", 200, await call("GET", `${L}?q=zuser`, ad),
  (d) => d.pagination.total === 3);
record("Search is case-insensitive and matches email", 200, await call("GET", `${L}?q=ZUSER-INSTRUCTOR`, ad),
  (d) => d.pagination.total === 1 && d.users[0].email === "zuser-instructor@example.com");
record("Search text is not a regex (.* matches nothing)", 200,
  await call("GET", `${L}?q=${encodeURIComponent(".*")}`, ad),
  (d) => d.pagination.total === 0);
record("Role filter with search", 200, await call("GET", `${L}?q=zuser&role=student`, ad),
  (d) => d.pagination.total === 2 && d.users.every((u) => u.role === "student"));
record("Pagination (limit 2): page 1", 200, await call("GET", `${L}?q=zuser&limit=2&page=1`, ad),
  (d) => d.users.length === 2 && d.pagination.hasNext === true && d.pagination.totalPages === 2);
record("Pagination (limit 2): page 2", 200, await call("GET", `${L}?q=zuser&limit=2&page=2`, ad),
  (d) => d.users.length === 1 && d.pagination.hasNext === false);
record("List: limit=100 is rejected", 400, await call("GET", `${L}?limit=100`, ad));
record("List: page=0 is rejected", 400, await call("GET", `${L}?page=0`, ad));
record("List: unknown role is rejected", 400, await call("GET", `${L}?role=bogus`, ad));
record("List: unknown status is rejected", 400, await call("GET", `${L}?status=bogus`, ad));
record("List: repeated parameter is rejected", 400, await call("GET", `${L}?role=student&role=admin`, ad));

// ---------- Update: galat input ----------
record("Invalid user id", 400, await patch("abc", { role: "student" }));
record("User that does not exist", 404, await patch(ZERO_ID, { role: "student" }));
record("Empty update is rejected", 400, await patch(zs._id, {}));
record("Unknown role is rejected", 400, await patch(zs._id, { role: "owner" }));
record('isActive "false" as text is rejected', 400, await patch(zs._id, { isActive: "false" }));
record("Admin cannot change own role", 403, await patch(adminDoc._id, { role: "student" }));
record("Admin cannot deactivate self", 403, await patch(adminDoc._id, { isActive: false }));

// ---------- Role badalna ----------
const zsCookie = await mustLogin("zuser-student@example.com", PASSWORD);
record("Promote student to instructor", 200, await patch(zs._id, { role: "instructor" }),
  (d) => d.user.role === "instructor" && d.user.isActive === true && !("password" in d.user));
rows.push({
  label: "Role change revoked that user's refresh tokens",
  expected: "0 active tokens",
  got: `${await RefreshToken.countDocuments({ user: zs._id, revoked: false })} active tokens`,
  pass: (await RefreshToken.countDocuments({ user: zs._id, revoked: false })) === 0,
});
record("Old session cannot refresh after role change", 401, await call("POST", "/auth/refresh", zsCookie));
record("Same role again is accepted (no change)", 200, await patch(zs._id, { role: "instructor" }));

// ---------- Deactivate ----------
const ziCookie = await mustLogin("zuser-instructor@example.com", PASSWORD);
record("Before deactivating, /me works", 200, await call("GET", "/auth/me", ziCookie));
record("Admin deactivates the instructor", 200, await patch(zi._id, { isActive: false }),
  (d) => d.user.isActive === false);
record("Deactivated user: /me is closed at once", 401, await call("GET", "/auth/me", ziCookie));
record("Deactivated user: refresh is closed", 401, await call("POST", "/auth/refresh", ziCookie));
record("Deactivated user: login gives 403", 403, await login("zuser-instructor@example.com", PASSWORD),
  (d) => /deactivated/i.test(d.message));
record("Deactivated user: wrong password still gives 401", 401,
  await login("zuser-instructor@example.com", "wrong-password-1"));
record("Status filter: inactive", 200, await call("GET", `${L}?q=zuser&status=inactive`, ad),
  (d) => d.pagination.total === 1 && d.users[0].isActive === false);
record("Status filter: active", 200, await call("GET", `${L}?q=zuser&status=active`, ad),
  (d) => d.pagination.total === 2);

// ---------- Reactivate ----------
record("Admin reactivates the instructor", 200, await patch(zi._id, { isActive: true }),
  (d) => d.user.isActive === true);
record("Reactivated user can log in", 200, await login("zuser-instructor@example.com", PASSWORD));

// ---------- Naya admin ----------
record("Promote instructor to admin", 200, await patch(zi._id, { role: "admin" }),
  (d) => d.user.role === "admin");
const newAdmin = await mustLogin("zuser-instructor@example.com", PASSWORD);
record("New admin can open the users list", 200, await call("GET", L, newAdmin),
  (d) => d.pagination.total > 0);
record("Admin can demote another admin", 200, await patch(zi._id, { role: "student" }),
  (d) => d.user.role === "student");

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