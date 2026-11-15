import "dotenv/config";
import mongoose from "mongoose";
import RefreshToken from "../models/RefreshToken.js";
import User from "../models/User.js";
import { generateRandomToken, hashToken } from "../utils/tokens.js";

const BASE = `http://localhost:${process.env.PORT || 5000}/api`;
const PASSWORD = "Auth@12345";
const NEW_PASSWORD = "NewAuth@67890";
const HOUR = 60 * 60 * 1000;
const withEmail = process.argv.includes("--email");

async function call(method, url, { cookie, body } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 429) {
    throw new Error(
      "Rate limit hit. Start the server with DISABLE_RATE_LIMIT=true and run this again."
    );
  }
  let data = null;
  try { data = await res.json(); } catch {}
  const setCookies = res.headers.getSetCookie();
  const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
  return { status: res.status, data, setCookies, cookies };
}

const login = (email, password) => call("POST", "/auth/login", { body: { email, password } });
const refresh = (cookie) => call("POST", "/auth/refresh", { cookie });
const cookieValue = (cookies, name) =>
  cookies.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1);

const rows = [];
function record(label, expected, r, verify) {
  let pass = r.status === expected;
  if (pass && verify) pass = Boolean(verify(r.data));
  rows.push({ label, expected, got: r.status, pass });
  return r;
}
function note(label, expected, got, pass) {
  rows.push({ label, expected, got, pass: Boolean(pass) });
}

async function cleanup() {
  const users = await User.find({ email: /^zauth/ }).select("_id");
  await RefreshToken.deleteMany({ user: { $in: users.map((u) => u._id) } });
  await User.deleteMany({ email: /^zauth/ });
}

// ------------------------------------------------------------------
await mongoose.connect(process.env.MONGO_URI);
await cleanup();

const T = {
  verifyOk: generateRandomToken(),
  verifyExpired: generateRandomToken(),
  resetOk: generateRandomToken(),
  resetExpired: generateRandomToken(),
};

// users seedha database me (email nahi bhejni); tokens ke sirf hash rakhte hain
const mk = (email, extra = {}) =>
  User.create({ name: "Zauth User", email, password: PASSWORD, role: "student", isEmailVerified: true, ...extra });

const zv = await mk("zauth-verified@example.com");
await mk("zauth-unverified@example.com", {
  isEmailVerified: false,
  emailVerifyTokenHash: hashToken(T.verifyOk),
  emailVerifyExpires: new Date(Date.now() + HOUR),
});
await mk("zauth-expired@example.com", {
  isEmailVerified: false,
  emailVerifyTokenHash: hashToken(T.verifyExpired),
  emailVerifyExpires: new Date(Date.now() - HOUR),
});
await mk("zauth-reset@example.com", {
  passwordResetTokenHash: hashToken(T.resetOk),
  passwordResetExpires: new Date(Date.now() + HOUR),
});
await mk("zauth-reset-expired@example.com", {
  passwordResetTokenHash: hashToken(T.resetExpired),
  passwordResetExpires: new Date(Date.now() - HOUR),
});

// ---------- Register (galat input aur duplicate: email nahi jati) ----------
const good = { name: "Zauth New", email: "zauth-new@example.com", password: PASSWORD };
record("Register without a name", 400, await call("POST", "/auth/register", { body: { ...good, name: "" } }));
record("Register with an invalid email", 400, await call("POST", "/auth/register", { body: { ...good, email: "not-an-email" } }));
record("Register with a short password", 400, await call("POST", "/auth/register", { body: { ...good, password: "123" } }));
record("Register with an email that already exists", 409,
  await call("POST", "/auth/register", { body: { ...good, email: "student1@example.com" } }));

if (withEmail) {
  const r = record("Register with role=admin is accepted but makes a student", 201,
    await call("POST", "/auth/register", { body: { ...good, email: "zauth-admin-try@example.com", role: "admin" } }),
    (d) => d.user.role === "student");
  const doc = await User.findOne({ email: "zauth-admin-try@example.com" });
  note("New account starts as an unverified student", "student, unverified",
    `${doc?.role}, ${doc?.isEmailVerified ? "verified" : "unverified"}`,
    doc && doc.role === "student" && doc.isEmailVerified === false && r);
}

// ---------- Email verify ----------
record("Unverified user cannot log in", 403, await login("zauth-unverified@example.com", PASSWORD));
record("Verify without a token", 400, await call("POST", "/auth/verify-email", { body: {} }));
record("Verify with an unknown token", 400,
  await call("POST", "/auth/verify-email", { body: { token: generateRandomToken() } }));
record("Verify with an expired token", 400,
  await call("POST", "/auth/verify-email", { body: { token: T.verifyExpired } }));
record("Verify with a valid token", 200,
  await call("POST", "/auth/verify-email", { body: { token: T.verifyOk } }));
record("After verifying, the user can log in", 200, await login("zauth-unverified@example.com", PASSWORD));
record("A verify token works only once", 400,
  await call("POST", "/auth/verify-email", { body: { token: T.verifyOk } }));

// ---------- Login ----------
const wrong = record("Wrong password", 401, await login("zauth-verified@example.com", "Wrong@12345"));
record("Unknown email gives the same message as a wrong password", 401,
  await login("nobody-zauth@example.com", PASSWORD),
  (d) => d.message === wrong.data.message);

const v = record("Correct password logs in", 200, await login("zauth-verified@example.com", PASSWORD),
  (d) => d.user.role === "student" && !JSON.stringify(d).includes("password"));
const rawAccess = cookieValue(v.cookies, "accessToken");
const R1 = cookieValue(v.cookies, "refreshToken");

const accessCookie = v.setCookies.find((c) => c.startsWith("accessToken="));
const refreshCookie = v.setCookies.find((c) => c.startsWith("refreshToken="));
note("Both cookies are HttpOnly", "both HttpOnly", accessCookie && refreshCookie ? "present" : "missing",
  accessCookie && refreshCookie && /HttpOnly/i.test(accessCookie) && /HttpOnly/i.test(refreshCookie));
note("Access cookie is for the whole API, refresh cookie only for /api/auth", "/ and /api/auth", "checked",
  accessCookie && refreshCookie && /Path=\/(;|$)/i.test(accessCookie) && /Path=\/api\/auth/i.test(refreshCookie));
note("Tokens are not in the response body", "not in body", "checked",
  rawAccess && R1 && !JSON.stringify(v.data).includes(rawAccess) && !JSON.stringify(v.data).includes(R1));

const hashed = await RefreshToken.findOne({ tokenHash: hashToken(R1) });
const plain = await RefreshToken.findOne({ tokenHash: R1 });
note("Refresh token is stored as a hash, never as plain text", "hash found, plain not found",
  `${hashed ? "hash found" : "hash missing"}, ${plain ? "plain found" : "plain not found"}`,
  hashed && !plain && hashed.tokenHash.length === 64);

// ---------- /me ----------
record("/me without a cookie", 401, await call("GET", "/auth/me"));
record("/me with a valid cookie", 200, await call("GET", "/auth/me", { cookie: v.cookies }),
  (d) => d.user.email === "zauth-verified@example.com");
record("/me with a fake access token", 401,
  await call("GET", "/auth/me", { cookie: "accessToken=fake.token.value" }),
  (d) => d.code === "INVALID_TOKEN");
record("A refresh token cannot be used as an access token", 401,
  await call("GET", "/auth/me", { cookie: `accessToken=${R1}` }));

// ---------- Refresh: rotation ----------
record("Refresh without a cookie", 401, await refresh());
record("Refresh with a garbage token", 401, await refresh("refreshToken=garbage"));

const s = await login("zauth-verified@example.com", PASSWORD);
const first = record("Refresh gives new tokens", 200, await refresh(s.cookies));
note("Refresh token changes on every refresh (rotation)", "different token",
  cookieValue(first.cookies, "refreshToken") !== cookieValue(s.cookies, "refreshToken") ? "different" : "same",
  cookieValue(first.cookies, "refreshToken") !== cookieValue(s.cookies, "refreshToken"));
const second = record("The new token can be refreshed again", 200, await refresh(first.cookies));

// ---------- Refresh: reuse detection ----------
record("Using an already used token is detected as reuse", 401, await refresh(s.cookies),
  (d) => /reuse/i.test(d.message));
record("After reuse, even the newest token is dead", 401, await refresh(second.cookies));
const active = await RefreshToken.countDocuments({ user: zv._id, revoked: false });
note("After reuse, no active tokens are left for that user", "0 active tokens", `${active} active tokens`, active === 0);

// ---------- Refresh: do saath ----------
const c = await login("zauth-verified@example.com", PASSWORD);
const [a, b] = await Promise.all([refresh(c.cookies), refresh(c.cookies)]);
note("Two simultaneous refreshes with one token: exactly one wins", "200 and 401",
  `${a.status} and ${b.status}`, [a.status, b.status].sort().join(",") === "200,401");

// ---------- Logout ----------
const l = await login("zauth-verified@example.com", PASSWORD);
const out = record("Logout", 200, await call("POST", "/auth/logout", { cookie: l.cookies }));
note("Logout clears both cookies", "both cleared", "checked",
  out.setCookies.some((x) => x.startsWith("accessToken=;")) &&
  out.setCookies.some((x) => x.startsWith("refreshToken=;")));
record("After logout the old refresh token is dead", 401, await refresh(l.cookies));
record("Logout without a cookie is harmless", 200, await call("POST", "/auth/logout"));

// ---------- Password reset ----------
const before = await login("zauth-reset@example.com", PASSWORD); // reset se pehle ka session
const reset = (token, password) =>
  call("POST", "/auth/reset-password", { body: { token, password } });

record("Reset with a weak password", 400, await reset(T.resetOk, "123"));
record("Reset with an unknown token", 400, await reset(generateRandomToken(), NEW_PASSWORD));
record("Reset with an expired token", 400, await reset(T.resetExpired, NEW_PASSWORD));
record("Reset with a valid token", 200, await reset(T.resetOk, NEW_PASSWORD));
record("Old password no longer works", 401, await login("zauth-reset@example.com", PASSWORD));
record("New password works", 200, await login("zauth-reset@example.com", NEW_PASSWORD));
record("Sessions from before the reset are closed", 401, await refresh(before.cookies));
record("A reset token works only once", 400, await reset(T.resetOk, "Another@12345"));
record("Forgot password for an unknown email gives the generic answer", 200,
  await call("POST", "/auth/forgot-password", { body: { email: "nobody-zauth@example.com" } }),
  (d) => /If that email is registered/.test(d.message));

// ------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  expected ${r.expected}, got ${r.got}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);
if (!withEmail) {
  console.log("Skipped: register with role=admin (sends one email). Run with --email to include it.");
}

await cleanup();
await mongoose.disconnect();
process.exit(failed ? 1 : 0);