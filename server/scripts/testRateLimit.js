import "dotenv/config";

// 127.0.0.1 seedha: har baar wahi IP rahe, isliye counting seedhi rahe
const BASE = `http://127.0.0.1:${process.env.PORT || 5000}/api`;

async function request(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data, headers: res.headers };
}

const login = (email, password) => request("POST", "/auth/login", { email, password });
const goodLogin = () => login("student1@example.com", "newpassword456");
const badLogin = () => login("nobody-rate@example.com", "Wrong@12345");

const rows = [];
function note(label, expected, got, pass) {
  rows.push({ label, expected, got, pass: Boolean(pass) });
}

// ---------- Login limit: sirf failed attempts ginte hain ----------
const goods = [];
for (let i = 0; i < 12; i++) goods.push((await goodLogin()).status);
note("12 successful logins are not counted", "all 200", goods.every((s) => s === 200) ? "all 200" : goods.join(","),
  goods.every((s) => s === 200));

const bads = [];
for (let i = 0; i < 10; i++) bads.push((await badLogin()).status);
note("10 failed logins are all answered normally", "ten 401", bads.every((s) => s === 401) ? "ten 401" : bads.join(","),
  bads.every((s) => s === 401));

const eleventh = await badLogin();
note("The 11th failed login is blocked", "429", String(eleventh.status), eleventh.status === 429);
note("Blocked reply has the message, Retry-After and RateLimit headers", "present", "checked",
  eleventh.status === 429 &&
    eleventh.data?.message === "Too many attempts. Please try again later." &&
    eleventh.headers.has("retry-after") &&
    [...eleventh.headers.keys()].some((k) => k.startsWith("ratelimit")));

const correct = await goodLogin();
note("Even a correct login is blocked while limited", "429", String(correct.status), correct.status === 429);

// authLimiter ek hi hai, isliye register aur forgot-password bhi ruk jate hain
const reg = await request("POST", "/auth/register", {});
note("Register is blocked by the same limit", "429", String(reg.status), reg.status === 429);
const forgot = await request("POST", "/auth/forgot-password", { email: "nobody-rate@example.com" });
note("Forgot password is blocked by the same limit", "429", String(forgot.status), forgot.status === 429);

// baaki routes par asar nahi
const health = await request("GET", "/health");
note("Other routes still work", "200", String(health.status), health.status === 200);

// ---------- Poori API ki limit (15 min me 300) ----------
let hitAt = null;
let apiMessage = null;
for (let i = 1; i <= 400; i++) {
  const r = await request("GET", "/health");
  if (r.status === 429) {
    hitAt = i;
    apiMessage = r.data?.message;
    break;
  }
}
note("API-wide limit stops requests within 300 per 15 minutes", "429 within 301 requests",
  hitAt ? `429 at request ${hitAt}` : "never blocked", hitAt && hitAt <= 301);
note("API-wide block has its own message", "Too many requests. Please slow down.", apiMessage || "none",
  apiMessage === "Too many requests. Please slow down.");
const still = await request("GET", "/health");
note("Everything stays blocked afterwards", "429", String(still.status), still.status === 429);

// ------------------------------------------------------------------
const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  expected ${r.expected}, got ${r.got}`);
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);

if (rows[2].got === "200" || rows[2].got === "401") {
  console.log("\nLooks like the limiter is OFF. Start the server normally (without DISABLE_RATE_LIMIT).");
}
console.log("\nThe server is now rate limited for about 15 minutes.");
console.log("Restart it to clear the counters (type rs in the nodemon terminal, or stop and start it).");

process.exit(failed ? 1 : 0);