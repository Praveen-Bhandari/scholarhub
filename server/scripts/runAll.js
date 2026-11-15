import "dotenv/config";
import { spawn } from "child_process";
import path from "path";

const SERVER_DIR = path.join(import.meta.dirname, "..");
const BASE = `http://localhost:${process.env.PORT || 5000}/api`;

// cloud: true = Cloudinary par asli upload karti hain (internet chahiye)
const SUITES = [
  { name: "testAuth" },
  { name: "testRolesOwnership" },
  { name: "testUpload", cloud: true },
  { name: "testAttachments", cloud: true },
  { name: "testListing" },
  { name: "testEnrollmentApi" },
  { name: "testLearn" },
  { name: "testCertificate" },
  { name: "testReviews" },
  { name: "testInstructorAnalytics" },
  { name: "testAdminAnalytics" },
  { name: "testAdminUsers" },
];

// options: --no-cloud (upload wali scripts chhodo), baaki shabd naam ka filter (jaise: listing)
const args = process.argv.slice(2);
const noCloud = args.includes("--no-cloud");
const filters = args.filter((a) => !a.startsWith("--")).map((a) => a.toLowerCase());
const suites = SUITES.filter(
  (s) =>
    (!noCloud || !s.cloud) &&
    (filters.length === 0 || filters.some((f) => s.name.toLowerCase().includes(f)))
);

function run(script) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join("scripts", `${script}.js`)], {
      cwd: SERVER_DIR,
    });
    let output = "";
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("close", (code) =>
      resolve({ code, output, seconds: (Date.now() - started) / 1000 })
    );
  });
}

// ---------- Server chal raha hai? ----------
try {
  const res = await fetch(`${BASE}/health`);
  if (!res.ok) throw new Error();
} catch {
  console.error("The server is not running. Start it in another terminal first:");
  console.error('  $env:DISABLE_RATE_LIMIT = "true"');
  console.error("  npm run dev");
  process.exit(1);
}

if (suites.length === 0) {
  console.error("No test script matches. Names: " + SUITES.map((s) => s.name).join(", "));
  process.exit(1);
}

// ---------- Safai, phir tests ----------
const clean = await run("cleanTestData");
console.log(clean.output.trim());
console.log("");

const results = [];
for (const suite of suites) {
  process.stdout.write(`Running ${suite.name} ... `);
  const r = await run(suite.name);
  const m = r.output.match(/(\d+)\/(\d+) passed/);
  const passed = m ? Number(m[1]) : 0;
  const total = m ? Number(m[2]) : 0;

  let status = "PASS";
  if (!m) status = "CRASHED";
  else if (r.code !== 0 || passed !== total) status = "FAIL";

  console.log(status);
  results.push({ name: suite.name, passed, total, seconds: r.seconds, status, output: r.output });
}

// ---------- Table ----------
const w = Math.max(...results.map((r) => r.name.length), 6);
console.log(`\n${"Script".padEnd(w)}  Result    Time    Status`);
console.log("-".repeat(w + 30));
for (const r of results) {
  console.log(
    `${r.name.padEnd(w)}  ${(r.total ? `${r.passed}/${r.total}` : "-").padEnd(8)}  ` +
      `${(r.seconds.toFixed(1) + "s").padEnd(6)}  ${r.status}`
  );
}

const sumPassed = results.reduce((n, r) => n + r.passed, 0);
const sumTotal = results.reduce((n, r) => n + r.total, 0);
const seconds = results.reduce((n, r) => n + r.seconds, 0);
console.log(
  `\nTotal: ${sumPassed}/${sumTotal} checks passed in ${seconds.toFixed(0)}s across ${results.length} scripts`
);

// ---------- Jo fail hua usse seedha dikhao ----------
const bad = results.filter((r) => r.status !== "PASS");
for (const r of bad) {
  console.log(`\n--- ${r.name}: ${r.status} ---`);
  const lines = r.output.trim().split("\n");
  const fails = lines.filter((l) => l.startsWith("FAIL"));
  console.log((fails.length ? fails : lines.slice(-8)).join("\n"));
}

process.exit(bad.length ? 1 : 0);