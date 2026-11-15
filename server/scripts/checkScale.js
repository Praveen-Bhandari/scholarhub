import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/Course.js";
import { buildCourseQuery } from "../utils/courseQuery.js";

await mongoose.connect(process.env.MONGO_URI);
await Course.init();

const total = await Course.estimatedDocumentCount();
const approved = await Course.countDocuments({ status: "approved" });
console.log(`Courses in database: ${total} (approved: ${approved})\n`);

// tight: index se hi sort, docs read skip + limit ke aaspaas
// maxExamined: filter wale cases me padhe gaye documents ki seema
const cases = [
  { label: "Newest, page 1", params: { sort: "newest" }, tight: true },
  { label: "Price low to high, page 1", params: { sort: "price_asc" }, tight: true },
  { label: "Top rated, page 1", params: { sort: "rating" }, tight: true },
  { label: "Category (web) + newest, page 1", params: { category: "web" }, tight: true },
  { label: "Newest, page 50", params: { page: 50 }, tight: true },
  { label: "Newest, deep page 400", params: { page: 400 }, tight: true },
  { label: "Search 'react' (relevance)", params: { q: "react" }, allowSort: true, maxExamined: 3000 },
  { label: "Price 500 to 1500 + newest", params: { minPrice: 500, maxPrice: 1500 }, allowSort: true, maxExamined: 300 },
];

const rows = [];
for (const c of cases) {
  const { filter, sort, relevance, limit, skip } = buildCourseQuery(c.params);

  const plan = await Course.find(filter, relevance ? { score: { $meta: "textScore" } } : {})
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .explain("executionStats");

  const stats = plan.executionStats;
  const text = JSON.stringify(plan.queryPlanner.winningPlan);
  const collscan = text.includes("COLLSCAN");
  const memSort = text.includes('"stage":"SORT"');

  let pass = !collscan && (c.allowSort || !memSort);
  if (c.tight) pass = pass && stats.totalDocsExamined <= skip + limit + 50;
  if (c.maxExamined) pass = pass && stats.totalDocsExamined <= c.maxExamined;

  rows.push({
    label: c.label,
    examined: stats.totalDocsExamined,
    keys: stats.totalKeysExamined,
    returned: stats.nReturned,
    ms: stats.executionTimeMillis,
    plan: `${collscan ? "COLLSCAN" : "index"}${memSort ? ", in-memory sort" : ""}`,
    pass,
  });
}

const w = Math.max(...rows.map((r) => r.label.length));
for (const r of rows) {
  console.log(
    `${r.pass ? "PASS" : "FAIL"}  ${r.label.padEnd(w)}  docs read ${String(r.examined).padStart(5)}, ` +
      `keys ${String(r.keys).padStart(5)}, returned ${String(r.returned).padStart(2)}, ${String(r.ms).padStart(3)} ms  (${r.plan})`
  );
}
const failed = rows.filter((r) => !r.pass).length;
console.log(`\n${rows.length - failed}/${rows.length} passed`);
console.log(
  "Note: deep pages read the skipped documents too (docs read grows with the page number).\n" +
    "That is fine for a few hundred pages; for millions of rows cursor pagination is the usual fix."
);

await mongoose.disconnect();
process.exit(failed ? 1 : 0);